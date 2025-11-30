# Syncer Fetch

一个适合并发上传下载二进制内容的fetch封装库，支持代理、并发控制、重试机制等功能。

## 安装

```bash
npm install syncer-fetch
```

或者使用CDN：

```html
<script src="https://cdn.jsdelivr.net/npm/syncer-fetch/dist/index.js"></script>
```

## 使用方法

### 基本用法

```javascript
import $syncer from 'syncer-fetch';

// 简单GET请求
const result = await $syncer('https://api.example.com/data');
console.log(result.data);
```

### 高级选项

```javascript
const result = await $syncer.request('https://api.example.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' }),
  timeout: 10000, // 10秒超时
  retries: 2, // 失败后重试2次
  before: async (url, options) => {
    console.log('请求开始:', url);
  },
  after: async (url, result) => {
    console.log('请求完成:', result.code);
  }
});
```

### 代理请求

```javascript
// 使用字符串代理列表
const result = await $syncer.proxy('https://api.example.com/data', {
  proxies: [
    'https://proxy1.example.com/',
    'https://proxy2.example.com/'
  ]
});

// 使用对象代理列表
const result = await $syncer.proxy('https://api.example.com/data', {
  proxies: [
    { url: 'https://proxy1.example.com/', perfix: true },  // 完整URL拼接
    { url: 'https://proxy2.example.com/', perfix: false }  // 仅路径拼接
  ]
});
```

### 并发下载

```javascript
const urls = [
  'https://example.com/file1.zip',
  'https://example.com/file2.zip',
  'https://example.com/file3.zip'
];

// 设置最大并发数为2
const results = await $syncer.downloadAll(urls, {
  maxConcurrency: 2
});

// 处理结果
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`文件 \${index + 1} 下载成功:`, result.value);
  } else {
    console.error(`文件 \${index + 1} 下载失败:`, result.reason);
  }
});
```

### 并行上传

```javascript
// 上传文件对象
const file = document.querySelector('input[type="file"]').files[0];

// 配置多个上传平台
const platforms = [
  { 
    name: 'GitHub', 
    url: 'https://api.github.com/contents/file.txt', 
    method: 'PUT',
    headers: {
      'Authorization': 'token your-github-token'
    }
  },
  { 
    name: 'GitLab', 
    url: 'https://gitlab.com/api/v4/projects/1/files', 
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': 'your-gitlab-token'
    }
  }
];

// 执行并行上传
const results = await $syncer.uploads(file, platforms, {
  headers: {
    'Content-Type': 'application/json'
  }
});

// 处理上传结果
results.forEach(result => {
  if (result.status === 'fulfilled') {
    console.log(`\${result.value.platform} 上传成功:`, result.value);
  } else {
    console.error(`上传失败:`, result.reason);
  }
});
```

### 上传JSON数据

```javascript
const jsonData = {
  content: 'Hello World',
  filename: 'example.txt'
};

const platforms = [
  { 
    name: 'API1', 
    url: 'https://api.example.com/upload', 
    method: 'POST',
    branch: 'main',  // Git相关参数
    sha: 'abc123'    // Git相关参数
  }
];

const results = await $syncer.uploads(jsonData, platforms);
```

### 文件处理

```javascript
// 将Blob转换为Base64
const blob = new Blob(['Hello World'], { type: 'text/plain' });
const base64 = await $syncer.toBase64(blob);
console.log('Base64:', base64);

// 将Blob转换为字符串
const text = await $syncer.blobToString(blob);
console.log('Text:', text);

// 检测文件类型
const fileType = $syncer.fileType('image/png', 'https://example.com/image.png');
console.log('File type:', fileType); // 'image'

const textType = $syncer.fileType('text/html', 'https://example.com/page.html');
console.log('File type:', textType); // 'text'
```

### 取消请求

```javascript
// 创建AbortController
const controller = $syncer.Aborter();

// 设置5秒后自动取消
setTimeout(() => controller.abort(), 5000);

try {
  const result = await $syncer.request('https://api.example.com/slow-data', {
    signal: controller.signal,
    timeout: 10000
  });
  console.log('请求成功:', result);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('请求已取消');
  } else {
    console.error('请求失败:', error);
  }
}
```

### 请求钩子

```javascript
const result = await $syncer.request('https://api.example.com/data', {
  before: async (url, options) => {
    console.log('准备发送请求:', url);
    // 可以在这里修改options
    options.headers = {
      ...options.headers,
      'X-Request-ID': generateRequestId()
    };
  },
  after: async (url, result) => {
    console.log('请求完成:', {
      url,
      status: result.code,
      duration: result.duration
    });
    
    // 记录请求日志
    logRequest({
      url,
      status: result.code,
      duration: result.duration,
      size: result.size
    });
  }
});
```

## API 参考

### `$syncer(url, options)`

基本的请求方法，等同于 `$syncer.request(url, options)`。

**参数:**
- `url` (string): 请求URL
- `options` (object): 请求选项，详见 `$syncer.request`

**返回值:** `Promise<object>` - 请求结果对象

### `$syncer.request(url, options)`

核心请求方法，支持完整的配置选项。

**参数:**
- `url` (string): 请求URL
- `options` (object): 请求选项
  - `method` (string): HTTP方法，默认为 `'GET'`
  - `headers` (object): 请求头对象
  - `body` (string|Blob|FormData): 请求体
  - `timeout` (number): 超时时间（毫秒），默认为 `15000`
  - `retries` (number): 重试次数，默认为 `3`
  - `retryDelay` (number): 重试延迟（毫秒），默认为 `1000`
  - `signal` (AbortSignal): 取消请求的信号
  - `before` (function): 请求前回调函数
    - 参数: `(url, options) => void`
  - `after` (function): 请求后回调函数
    - 参数: `(url, result) => void`
  - `progress` (function): 进度回调函数
    - 参数: `(url, loaded, total) => void`
  - `platform` (string): 平台标识

**返回值:**
```javascript
Promise<{
  url: string,        // 请求URL
  code: number,       // HTTP状态码
  msg: string,        // 状态消息
  data: Blob,         // 响应数据
  fileType: string,   // 文件类型: 'image' | 'text' | 'blob'
  contentType: string, // 内容类型
  size: number,       // 响应大小
  loaded: number,     // 已加载数据量
  total: number,      // 总数据量
  duration: number,   // 请求耗时（毫秒）
  platform?: string   // 平台标识（如果提供）
}>
```

### `$syncer.proxy(url, options)`

使用代理发送请求，自动尝试多个代理直到成功。

**参数:**
- `url` (string): 请求URL
- `options` (object): 请求选项，包含额外的 `proxies` 数组
  - `proxies` (array): 代理列表，支持两种格式：
    - 字符串格式: `'https://proxy.example.com/'`
    - 对象格式: `{ url: string, perfix: boolean }`
      - `url`: 代理服务器URL
      - `perfix`: 是否将完整URL拼接到代理URL后
        - `true`: `proxyUrl + originalUrl`
        - `false`: `proxyUrl + pathname + search + hash`

**返回值:** `Promise<object>` - 请求结果对象

### `$syncer.downloadAll(urls, options)`

并发下载多个文件，支持并发控制。

**参数:**
- `urls` (string[]): URL数组
- `options` (object): 请求选项
  - `maxConcurrency` (number): 最大并发数，默认为 `3`
  - 其他选项同 `$syncer.request`

**返回值:** `Promise<PromiseSettledResult[]>` - 所有下载结果的Promise数组

### `$syncer.uploads(file, platforms, options)`

并行上传文件到多个平台。

**参数:**
- `file` (Blob|object): 要上传的文件或数据对象
- `platforms` (object[]): 平台配置数组
  - `name` (string): 平台名称
  - `url` (string): 上传URL
  - `method` (string): HTTP方法，默认为 `'POST'`
  - `headers` (object): 请求头
  - `branch` (string): 分支名称（用于Git平台）
  - `sha` (string): SHA值（用于Git平台）
- `options` (object): 请求选项，同 `$syncer.request`

**返回值:** `Promise<PromiseSettledResult[]>` - 所有上传结果的Promise数组

### `$syncer.Aborter()`

创建一个AbortController实例，用于取消请求。

**返回值:** `AbortController` - 可用于取消请求的控制器

**示例:**
```javascript
const controller = $syncer.Aborter();
controller.abort(); // 取消请求
```

### `$syncer.fileType(contentType, url)`

根据内容类型和URL检测文件类型。

**参数:**
- `contentType` (string): 内容类型（MIME类型）
- `url` (string): URL（可选）

**返回值:** `string` - 文件类型
- `'image'` - 图片类型
- `'text'` - 文本类型
- `'blob'` - 二进制类型（默认）

**示例:**
```javascript
 $type = $syncer.fileType('image/png'); // 'image'
 $type = $syncer.fileType('text/html'); // 'text'
 $type = $syncer.fileType('application/octet-stream'); // 'blob'
```

### `$syncer.toBase64(blob)`

将Blob转换为Base64字符串。

**参数:**
- `blob` (Blob): 要转换的Blob对象

**返回值:** `Promise<string>` - Base64字符串

**示例:**
```javascript
const blob = new Blob(['Hello'], { type: 'text/plain' });
const base64 = await $syncer.toBase64(blob);
console.log(base64); // 'SGVsbG8='
```

### `$syncer.blobToString(blob)`

将Blob转换为字符串，自动检测并解析JSON。

**参数:**
- `blob` (Blob): 要转换的Blob对象

**返回值:** `Promise<string|object>` - 字符串或解析后的JSON对象

**示例:**
```javascript
// 文本文件
const textBlob = new Blob(['{"name": "John"}'], { type: 'text/plain' });
const text = await $syncer.blobToString(textBlob);
console.log(text); // '{"name": "John"}'

// JSON文件
const jsonBlob = new Blob(['{"name": "John"}'], { type: 'application/json' });
const obj = await $syncer.blobToString(jsonBlob);
console.log(obj); // { name: 'John' }
```

## 错误处理

库提供了完善的错误处理机制：

```javascript
try {
  const result = await $syncer.request('https://api.example.com/data');
  
  // 检查HTTP状态码
  if (result.code >= 200 && result.code < 300) {
    console.log('请求成功:', result.data);
  } else {
    console.error('请求失败:', result.msg);
  }
} catch (error) {
  // 处理网络错误、超时等异常
  if (error.name === 'AbortError') {
    console.log('请求被取消');
  } else {
    console.error('网络错误:', error.message);
  }
}
```

## 状态码说明

库自动将常见的HTTP状态码转换为友好的错误消息：

| 状态码 | 消息 | 说明 |
|--------|------|------|
| 200/201/204 | 'ok' | 请求成功 |
| 401 | '未授权，请检查认证信息' | 需要身份验证 |
| 403 | '禁止访问' | 没有访问权限 |
| 404 | '资源未找到' | URL不存在 |
| 429 | '请求频率超限，请稍后重试' | 触发频率限制 |
| 500 | '服务器内部错误' | 服务器问题 |
| 0 | '请求已取消' | 被AbortController取消 |
| -1 | '网络错误' | 网络连接问题 |

## 许可证

MIT License
