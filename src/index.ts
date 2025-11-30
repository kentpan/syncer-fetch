import { FetchFactory } from './factory.js';
import type { RequestOptions, ProxyRequestOptions, ConcurrentDownloadOptions, Platform, ProxyList } from './types.js';

const instance = new FetchFactory();

interface SyncerFetch {
  (url: string, options?: RequestOptions): Promise<import('./types.js').RequestResult>;
  request: (url: string, options?: RequestOptions) => Promise<import('./types.js').RequestResult>;
  proxy: (url: string, options?: ProxyRequestOptions) => Promise<import('./types.js').RequestResult>;
  downloadAll: (urls: string[], options?: ConcurrentDownloadOptions) => Promise<PromiseSettledResult<import('./types.js').RequestResult>[]>;
  uploads: (file: Blob | Record<string, any>, platforms: Platform[], options?: RequestOptions) => Promise<PromiseSettledResult<import('./types.js').RequestResult & { platform: string }>[]>;
  Aborter: () => AbortController;
  fileType: (contentType?: string | null, url?: string) => 'image' | 'text' | 'blob';
  toBase64: (blob: Blob | string) => Promise<string>;
  blobToString: (blob: Blob) => Promise<string | any>;
}

const $syncer = (url: string, options?: RequestOptions) => instance.request(url, options);

$syncer.request = (url: string, options?: RequestOptions) => instance.request(url, options);
$syncer.proxy = (url: string, options?: RequestOptions) => instance.requestWithProxy(url, options);
$syncer.downloadAll = (urls: string[], options?: RequestOptions) => instance.downloadConcurrent(urls, options);
$syncer.uploads = (file: Blob | Record<string, any>, platforms: Platform[], options?: RequestOptions) => instance.uploadParallel(file, platforms, options);
$syncer.Aborter = () => instance.createController();
$syncer.fileType = (contentType: string, url: string) => instance.detectFileType(contentType, url);
$syncer.toBase64 = (blob: Blob | string) => instance.toBase64(blob);
$syncer.blobToString = (blob: Blob) => instance.blobToString(blob);

export { $syncer as default };

export { FetchFactory };
export type * from './types.js';
