// 代理配置
export interface ProxyConfig {
  url: string;
  perfix?: boolean; // true: 拼接完整URL, false: 仅拼接路径
}

export type ProxyList = (string | ProxyConfig)[];

// 平台配置
export interface Platform {
  name: string;
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  branch?: string; // Git 相关
  sha?: string; // Git 相关
}

// 核心请求选项
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: BodyInit | Record<string, any> | null;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
  platform?: string;
  before?: (url: string, options: RequestOptions) => Promise<void>;
  after?: (url: string, result: RequestResult) => Promise<void>;
  progress?: (url: string, loaded: number, total: number) => void;
}

// 代理请求选项
export interface ProxyRequestOptions extends RequestOptions {
  proxies?: ProxyList;
}

// 并发下载选项
export interface ConcurrentDownloadOptions extends ProxyRequestOptions {
  maxConcurrency?: number;
}

// 请求结果
export interface RequestResult {
  url: string;
  code: number | null;
  msg: string;
  data: Blob | null;
  fileType: 'image' | 'text' | 'blob';
  contentType: string;
  size: number | string;
  loaded: number;
  total: number;
  duration: number;
  platform?: string;
}

// 并发控制器任务
export interface QueuedTask<T> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}
