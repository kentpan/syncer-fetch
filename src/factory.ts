import type {
  ProxyList,
  ProxyRequestOptions,
  RequestOptions,
  RequestResult,
  Platform,
  ConcurrentDownloadOptions,
} from './types.js';
import { ConcurrencyController } from './controller.js';

export class FetchFactory {
  private defaultOptions: Required<Pick<RequestOptions, 'timeout' | 'retries' | 'retryDelay'>>;

  constructor() {
    this.defaultOptions = {
      timeout: 15000,
      retries: 3,
      retryDelay: 1000,
    };
  }

  createController(): AbortController {
    return new AbortController();
  }

  detectFileType(contentType?: string | null, _url?: string): 'image' | 'text' | 'blob' {
    if (contentType) {
      if (contentType.startsWith('image/')) return 'image';
      if (contentType.startsWith('text/')) return 'text';
    }
    return 'blob';
  }

  async toBase64(blob: Blob | string): Promise<string> {
    if (blob === '' || (typeof blob !== 'string' && blob.type && blob.size === 0)) {
      blob = '\n';
    }

    if (typeof blob === 'string') {
      return this.txtToBase64(blob);
    }

    const isImage = blob.type.startsWith('image/');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.replace(/^data:.+;base64,/, ''));
        } else {
          reject(new Error('FileReader result is not a string'));
        }
      };
      reader.onerror = (err) => reject(isImage ? '图片转换失败:' + err : err);
      reader.readAsDataURL(blob);
    });
  }

  base64ToString(base64: string): string {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  async blobToString(blob: Blob): Promise<string | any> {
    const isJson = /json$/i.test(blob.type);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        let result = reader.result;
        if (typeof result === 'string') {
          result = result.replace(/^data:.+;base64,/, '');
        } else {
          throw new Error('Expected a string result from FileReader');
        }
        result = this.base64ToString(result);
        if (isJson) {
          try {
            resolve(JSON.parse(result));
          } catch {
            resolve(result);
          }
        } else {
          resolve(result);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  }

  txtToBase64(str = ''): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const binary = Array.from(data, byte => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }

  private async handleResponse(response: Response): Promise<{
    data: Blob;
    fileType: 'image' | 'text' | 'blob';
    contentType: string;
    size: string | null;
  }> {
    const contentType = response.headers.get('content-type') || '';
    const fileType = this.detectFileType(contentType, response.url);
    const data = await response.blob();
    return {
      data,
      fileType,
      contentType,
      size: response.headers.get('content-length'),
    };
  }

  async request(url: string, options: RequestOptions = {}): Promise<RequestResult> {
    const opts = { ...this.defaultOptions, ...options };
    // 创建独立的控制器用于超时控制
    const timeoutController = this.createController();
    // 获取外部传入的信号（如果有的话）
    const externalSignal = opts.signal;

    const result: RequestResult = {
      url,
      code: null,
      msg: '',
      data: null,
      loaded: 0,
      total: 0,
      duration: 0,
      fileType: 'blob',
      contentType: '',
      size: 0,
    };

    const startTime = Date.now();
    let timeoutId: number | null = null;

    try {
      if (opts.before) {
        await opts.before(url, opts);
      }

      if (opts.platform) {
        result.platform = opts.platform;
        delete opts.platform;
      }

      // 设置超时控制
      if (opts.timeout > 0) {
        timeoutId = setTimeout(() => timeoutController.abort(), opts.timeout);
      }

      // 构建 fetch 选项
      const fetchOptions: RequestInit = {
        method: opts.method || 'GET',
        headers: opts.headers,
        signal: timeoutController.signal,
      };

      // 如果有外部信号，需要组合信号
      if (externalSignal instanceof AbortSignal) {
        // 使用 AbortSignal.any 组合多个信号（如果支持）
        if ('any' in AbortSignal) {
          fetchOptions.signal = AbortSignal.any([timeoutController.signal, externalSignal]);
        } else {
          // 兼容性处理：手动监听外部信号
          externalSignal.addEventListener('abort', () => {
            timeoutController.abort();
          });
        }
      }

      const response = await fetch(url, fetchOptions);

      result.code = response.status;

      switch (response.status) {
        case 200:
        case 201:
        case 204:
          result.msg = 'ok';
          break;
        case 429:
          result.msg = '请求频率超限，请稍后重试';
          break;
        case 401:
          result.msg = '未授权，请检查认证信息';
          break;
        case 403:
          result.msg = '禁止访问';
          break;
        case 404:
          result.msg = '资源未找到';
          break;
        case 500:
          result.msg = '服务器内部错误';
          break;
        default:
          result.msg = `请求失败: ${response.statusText}`;
      }

      const handledData = await this.handleResponse(response);
      result.data = handledData.data;
      result.fileType = handledData.fileType;
      result.contentType = handledData.contentType;
      result.size = handledData.size || 0;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        result.code = 0;
        result.msg = '请求已取消';
      } else {
        result.code = error.code || -1;
        result.msg = error.message || '网络错误';
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      result.duration = Date.now() - startTime;
      if (opts.after) {
        await opts.after(url, result);
      }
    }

    return result;
  }

  async requestWithProxy(url: string, options: ProxyRequestOptions = {}): Promise<RequestResult> {
    const { proxies, ...opts } = options;

    if (!proxies || !Array.isArray(proxies) || proxies.length === 0) {
      return await this.request(url, opts);
    }

    let lastError: RequestResult | null = null;
    for (const proxy of proxies) {
      try {
        const proxyOptions = { timeout: 5000, ...opts };
        let proxyUrl: string;

        if (typeof proxy === 'string') {
          proxyUrl = `${proxy}${url}`;
        } else {
          if (proxy.perfix) {
            proxyUrl = `${proxy.url}${url}`;
          } else {
            const urlObj = new URL(url);
            const path = urlObj.pathname + urlObj.search + urlObj.hash;
            proxyUrl = `${proxy.url}${path}`;
          }
        }

        const result = await this.request(proxyUrl, proxyOptions);
        if (result.code && result.code >= 200 && result.code < 300) {
          return result;
        }
        lastError = result;
      } catch (error: any) {
        lastError = {
          code: -1,
          msg: error.message,
          url: typeof proxy === 'string' ? proxy : proxy.url,
          data: null,
          loaded: 0,
          total: 0,
          duration: 0,
          fileType: 'blob',
          contentType: '',
          size: 0,
        };
      }
    }

    return lastError || { code: -1, msg: '所有代理请求失败', url, data: null, loaded: 0, total: 0, duration: 0, fileType: 'blob', contentType: '', size: 0 };
  }

  async downloadConcurrent(urls: string[], options: ConcurrentDownloadOptions = {}): Promise<PromiseSettledResult<RequestResult>[]> {
    const maxConcurrency = options.maxConcurrency || 3;
    const controller = new ConcurrencyController(maxConcurrency);

    const tasks = urls.map(url => () => this.requestWithProxy(url, options));
    const promises = tasks.map(task => controller.add(task));
    return await Promise.allSettled(promises);
  }

  async uploadParallel(file: Blob | Record<string, any>, platforms: Platform[], options: RequestOptions = {}): Promise<PromiseSettledResult<RequestResult & { platform: string }>[] | any> {
    const uploadPromises = platforms.map(async (platform) => {
      try {
        const finalOptions = { ...options };

        if (!(file instanceof globalThis.Blob)) {
          const requestBody = {
            ...file,
            ...(platform.branch && { branch: platform.branch }),
            ...(platform.sha && { sha: platform.sha }),
          };
          finalOptions.body = JSON.stringify(requestBody);
          finalOptions.headers = { 'Content-Type': 'application/json', ...platform.headers, ...finalOptions.headers };
        } else {
          finalOptions.body = file;
          finalOptions.headers = { ...platform.headers, ...finalOptions.headers };
        }

        finalOptions.method = options.method || platform.method || 'POST';

        const result = await this.request(platform.url, finalOptions);
        return { platform: platform.name, ...result };
      } catch (error: any) {
        return { platform: platform.name, code: -1, msg: error.message, data: null, loaded: 0, total: 0, duration: 0, fileType: 'blob', contentType: '', size: 0 };
      }
    });

    return await Promise.allSettled(uploadPromises);
  }
}