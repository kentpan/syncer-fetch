(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.$syncer = factory());
}(typeof self !== 'undefined' ? self : window, function () { 'use strict';

    class fetchFactory {
        constructor() {
            this.defaultOptions = {
                timeout: 15000,
                retries: 3,
                retryDelay: 1000
            };
        }

        /**
         * 创建AbortController
         */
        createController() {
            return new AbortController();
        }

        /**
         * 检测文件类型
         */
        detectFileType(contentType, url) {

            if (contentType) {
                if (contentType.startsWith('image/')) return 'image';
                // if (contentType.includes('json')) return 'json';
                if (contentType.startsWith('text/')) return 'text';
            }

            return 'blob';
        }
        /**
         * 图片专用转换 (FileReader)
         * @param {Blob} blob
         * @returns {Promise<string>} Base64字符串
         */
        toBase64(blob) {
            if (blob === '' || (blob.type && blob.size === 0)) blob = '\n';
            let isImage = false;
            if (!blob.type) return Promise.resolve(this.txtToBase64(blob))
            if (blob.type.startsWith('image/')) {
                console.log(`检测到图片格式: ${blob.type}`);
                isImage = true;
            } else {
                console.log(`其他文件格式: ${blob.type || '未知'}`);
            }
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.replace(/^data:.+;base64,/, ''));
                reader.onerror = (err) => reject(isImage ? '图片转换失败:' + err : err);
                reader.readAsDataURL(blob);
            });
        }

        base64ToString(base64) {
            // 解码Base64字符串为Uint8Array
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            // 使用TextDecoder将Uint8Array转换为字符串
            return new TextDecoder('utf-8').decode(bytes);
        }

        async blobToString(blob) {
            // 使用TextDecoder解码Blob
            let isJson = blob instanceof Blob && /json$/i.test(blob.type);
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    let result = reader.result.replace(/^data:.+;base64,/, '');
                    console.log("result:", result);
                    result = this.base64ToString(result);
                    if (isJson) {
                        let json = result
                        try {
                            json = JSON.parse(result);
                        } catch {}
                        resolve(json);
                    } else {
                        resolve(result);
                    }
                }
                reader.readAsDataURL(blob);
            });
        }

        txtToBase64(str = '') {
            // 空文件也需要base64编码
            // 创建 TextEncoder 实例
            const encoder = new TextEncoder('utf-8');
            
            // 将字符串编码为 Uint8Array
            const data = encoder.encode(str);
            
            // 将字节数组转换为二进制字符串
            const binary = Array.from(data, byte => 
                String.fromCharCode(byte)).join('');
            
            // 编码为 Base64
            return btoa(binary);
        }

        /**
         * 自动处理响应数据
         */
        async handleResponse(response, options = {}) {
            const contentType = response.headers.get('content-type') || '';
            const url = response.url;
            const fileType = this.detectFileType(contentType, url);

            const data = await response.blob();

            return {
                data,
                fileType,
                contentType,
                size: response.headers.get('content-length') || 0
            };
        }

        /**
         * 核心请求方法
         */
        async request(url, options = {}) {
            const opts = { ...this.defaultOptions, ...options };
            const controller = opts.signal || this.createController();

            let result = {
                url,
                code: null,
                msg: '',
                data: null,
                loaded: 0,
                total: 0,
                duration: 0
            };

            const startTime = Date.now();
            
            let timeoutId = null;

            try {
                // 请求前回调
                if (opts.before) {
                    await opts.before(url, opts);
                }

                if (opts.platform) {
                    result.platform = opts.platform;
                    delete opts.platform;
                }

                // 设置超时处理
                if (opts.timeout > 0) {
                    timeoutId = setTimeout(() => {
                        controller.abort();
                    }, opts.timeout);
                }

                console.log("fetch:", url, opts);
                const response = await fetch(url, {
                    method: 'GET',
                    ...opts,
                    signal: controller.signal
                });

                result.code = response.status;

                // 处理特殊状态码
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

                // 处理响应数据
                const handledData = await this.handleResponse(response, opts);
                result.data = handledData.data;
                result.fileType = handledData.fileType;
                result.contentType = handledData.contentType;
                result.size = handledData.size;

                // 流式进度处理
                // if (opts.progress && response.body && handledData.fileType !== 'text' && handledData.fileType !== 'json') {
                //     const reader = response.body.getReader();
                //     const contentLength = response.headers.get('content-length');
                //     result.total = parseInt(contentLength) || 0;

                //     const chunks = [];
                //     let loaded = 0;

                //     while (true) {
                //         const { done, value } = await reader.read();
                //         if (done) break;

                //         chunks.push(value);
                //         loaded += value.length;
                //         result.loaded = loaded;

                //         opts.progress(url, loaded, result.total);
                //     }

                //     // 重新组合数据
                //     if (opts.readMode === 'blob' || (opts.readMode === 'auto' && handledData.fileType === 'binary')) {
                //         result.data = new Blob(chunks, { type: handledData.contentType });
                //     }
                // }

            } catch (error) {
                if (error.name === 'AbortError') {
                    result.code = 0;
                    result.msg = '请求已取消';
                } else {
                    result.code = error.code || -1;
                    result.msg = error.message || '网络错误';
                }
            } finally {
                // 在finally块中清除超时定时器，确保无论如何都会清理
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                
                result.duration = Date.now() - startTime;

                // 完成后回调
                if (opts.after) {
                    await opts.after(url, result);
                }
            }

            return result;
        }

        /**
         * 带代理支持的请求方法
         */
        async requestWithProxy(url, options = {}) {
            const { proxies, ...opts } = options;
            
            // 如果没有提供代理，使用普通请求
            if (!proxies || !Array.isArray(proxies) || proxies.length === 0) {
                return await this.request(url, opts);
            }
            
            // 尝试使用代理
            let lastError = null;
            for (const proxy of proxies) {
                try {
                    // 设置3秒超时
                    const proxyOptions = {
                        timeout: 5000,
                        ...opts,
                    };
                    
                    // 构建代理URL
                    let proxyUrl;
                    if (typeof proxy === 'string') {
                        proxyUrl = `${proxy}${url}`;
                    } else {
                        if (proxy.perfix) {
                            // 直接将完整URL拼接到代理URL后面
                            proxyUrl = `${proxy.url}${url}`;
                        } else {
                            // 只将路径部分拼接到代理URL后面
                            const urlObj = new URL(url);
                            const path = urlObj.pathname + urlObj.search + urlObj.hash;
                            proxyUrl = `${proxy.url}${path}`;
                        }
                    }
                    
                    const result = await this.request(proxyUrl, proxyOptions);
                    
                    // 如果请求成功，返回结果
                    if (result.code >= 200 && result.code < 300) {
                        return result;
                    }
                    
                    // 如果请求失败，记录错误并尝试下一个代理
                    lastError = result;
                } catch (error) {
                    lastError = {
                        code: -1,
                        msg: error.message,
                        url: proxy.url
                    };
                }
            }
            
            // 所有代理都失败，返回最后一个错误
            return lastError || {
                code: -1,
                msg: '所有代理请求失败',
                url
            };
        }

        /**
         * 并发下载
         */
        async downloadConcurrent(urls, options = {}) {
            const maxConcurrency = options.maxConcurrency || 3;
            const controller = new ConcurrencyController(maxConcurrency);
            
            const tasks = urls.map(url => 
                () => this.requestWithProxy(url, options)
            );
            
            const promises = tasks.map(task => controller.add(task));
            return await Promise.allSettled(promises);
        }

        /**
         * 并行上传
         */
        async uploadParallel(file, platforms, options = {}) {
            const uploadPromises = platforms.map(async (platform) => {
                try {
                    // 判断上传类型
                    if (file && typeof file === 'object') {
                        
                        // 根据平台调整请求体格式
                        const requestBody = {
                            ...file,
                            ...(platform.branch && { branch: platform.branch }),
                            ...(platform.sha && { sha: platform.sha })
                        };
                        
                        options.body = JSON.stringify(requestBody);
                        // 确保Content-Type为application/json
                        options.headers = {
                            'Content-Type': 'application/json',
                            ...platform.headers
                        };
                    } else {
                        // 文件上传模式 - 使用原始文件对象
                        options.body = file;
                    }
                    options.method = options.method || platform.method || 'POST';

                    const result = await this.request(platform.url, options);
                    return { platform: platform.name, ...result };
                } catch (error) {
                    return { 
                        platform: platform.name, 
                        code: -1, 
                        msg: error.message 
                    };
                }
            });

            return await Promise.allSettled(uploadPromises);
        }
    }

    /**
     * 并发控制器
     */
    class ConcurrencyController {
        constructor(maxConcurrency = 3) {
            this.maxConcurrency = maxConcurrency;
            this.running = 0;
            this.queue = [];
        }

        async add(task) {
            return new Promise((resolve, reject) => {
                this.queue.push({
                    task,
                    resolve,
                    reject
                });
                this.process();
            });
        }

        async process() {
            if (this.running >= this.maxConcurrency || this.queue.length === 0) {
                return;
            }

            this.running++;
            const { task, resolve, reject } = this.queue.shift();

            try {
                const result = await task();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this.running--;
                this.process();
            }
        }
    }

    // 创建实例
    const instance = new fetchFactory();
    // 导出便捷方法
    const ktFetch = async (url, options) => {
        return await instance.request(url, options);
    };

    ktFetch.request = (url, options) => instance.request(url, options);
    ktFetch.proxy = (url, options) => instance.requestWithProxy(url, options);
    ktFetch.downloadAll = (urls, options) => instance.downloadConcurrent(urls, options);
    ktFetch.uploads = (file, platforms, options) => instance.uploadParallel(file, platforms, options);
    ktFetch.Aborter = () => instance.createController();
    ktFetch.fileType = (contentType, url) => instance.detectFileType(contentType, url);
    ktFetch.toBase64 = (file) => instance.toBase64(file);
    ktFetch.blobToString = (blob) => instance.blobToString(blob);

    return ktFetch;
}));
