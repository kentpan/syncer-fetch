class f {
  constructor(e = 3) {
    this.running = 0, this.queue = [], this.maxConcurrency = e;
  }
  async add(e) {
    return new Promise((a, r) => {
      this.queue.push({ task: e, resolve: a, reject: r }), this.process();
    });
  }
  async process() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0)
      return;
    this.running++;
    const { task: e, resolve: a, reject: r } = this.queue.shift();
    try {
      const n = await e();
      a(n);
    } catch (n) {
      r(n);
    } finally {
      this.running--, this.process();
    }
  }
}
class g {
  constructor() {
    this.defaultOptions = {
      timeout: 15e3,
      retries: 3,
      retryDelay: 1e3
    };
  }
  createController() {
    return new AbortController();
  }
  detectFileType(e, a) {
    if (e) {
      if (e.startsWith("image/")) return "image";
      if (e.startsWith("text/")) return "text";
    }
    return "blob";
  }
  async toBase64(e) {
    if ((e === "" || typeof e != "string" && e.type && e.size === 0) && (e = `
`), typeof e == "string")
      return this.txtToBase64(e);
    const a = e.type.startsWith("image/");
    return new Promise((r, n) => {
      const s = new FileReader();
      s.onloadend = () => {
        typeof s.result == "string" ? r(s.result.replace(/^data:.+;base64,/, "")) : n(new Error("FileReader result is not a string"));
      }, s.onerror = (t) => n(a ? "图片转换失败:" + t : t), s.readAsDataURL(e);
    });
  }
  base64ToString(e) {
    const a = atob(e), r = a.length, n = new Uint8Array(r);
    for (let s = 0; s < r; s++)
      n[s] = a.charCodeAt(s);
    return new TextDecoder("utf-8").decode(n);
  }
  async blobToString(e) {
    const a = /json$/i.test(e.type);
    return new Promise((r, n) => {
      const s = new FileReader();
      s.onloadend = () => {
        let t = s.result;
        if (typeof t == "string")
          t = t.replace(/^data:.+;base64,/, "");
        else
          throw new Error("Expected a string result from FileReader");
        if (t = this.base64ToString(t), a)
          try {
            r(JSON.parse(t));
          } catch {
            r(t);
          }
        else
          r(t);
      }, s.onerror = (t) => n(t), s.readAsDataURL(e);
    });
  }
  txtToBase64(e = "") {
    const r = new TextEncoder().encode(e), n = Array.from(r, (s) => String.fromCharCode(s)).join("");
    return btoa(n);
  }
  async handleResponse(e) {
    const a = e.headers.get("content-type") || "", r = this.detectFileType(a, e.url);
    return {
      data: await e.blob(),
      fileType: r,
      contentType: a,
      size: e.headers.get("content-length")
    };
  }
  async request(e, a = {}) {
    const r = { ...this.defaultOptions, ...a }, n = this.createController(), s = r.signal, t = {
      url: e,
      code: null,
      msg: "",
      data: null,
      loaded: 0,
      total: 0,
      duration: 0,
      fileType: "blob",
      contentType: "",
      size: 0
    }, c = Date.now();
    let l = null;
    try {
      r.before && await r.before(e, r), r.platform && (t.platform = r.platform, delete r.platform), r.timeout > 0 && (l = setTimeout(() => n.abort(), r.timeout));
      const i = {
        method: r.method || "GET",
        headers: r.headers,
        signal: n.signal
      };
      s instanceof AbortSignal && ("any" in AbortSignal ? i.signal = AbortSignal.any([n.signal, s]) : s.addEventListener("abort", () => {
        n.abort();
      }));
      const u = await fetch(e, i);
      switch (t.code = u.status, u.status) {
        case 200:
        case 201:
        case 204:
          t.msg = "ok";
          break;
        case 429:
          t.msg = "请求频率超限，请稍后重试";
          break;
        case 401:
          t.msg = "未授权，请检查认证信息";
          break;
        case 403:
          t.msg = "禁止访问";
          break;
        case 404:
          t.msg = "资源未找到";
          break;
        case 500:
          t.msg = "服务器内部错误";
          break;
        default:
          t.msg = `请求失败: ${u.statusText}`;
      }
      const y = await this.handleResponse(u);
      t.data = y.data, t.fileType = y.fileType, t.contentType = y.contentType, t.size = y.size || 0;
    } catch (i) {
      i.name === "AbortError" ? (t.code = 0, t.msg = "请求已取消") : (t.code = i.code || -1, t.msg = i.message || "网络错误");
    } finally {
      l && clearTimeout(l), t.duration = Date.now() - c, r.after && await r.after(e, t);
    }
    return t;
  }
  async requestWithProxy(e, a = {}) {
    const { proxies: r, ...n } = a;
    if (!r || !Array.isArray(r) || r.length === 0)
      return await this.request(e, n);
    let s = null;
    for (const t of r)
      try {
        const c = { timeout: 5e3, ...n };
        let l;
        if (typeof t == "string")
          l = `${t}${e}`;
        else if (t.perfix)
          l = `${t.url}${e}`;
        else {
          const u = new URL(e), y = u.pathname + u.search + u.hash;
          l = `${t.url}${y}`;
        }
        const i = await this.request(l, c);
        if (i.code && i.code >= 200 && i.code < 300)
          return i;
        s = i;
      } catch (c) {
        s = {
          code: -1,
          msg: c.message,
          url: typeof t == "string" ? t : t.url,
          data: null,
          loaded: 0,
          total: 0,
          duration: 0,
          fileType: "blob",
          contentType: "",
          size: 0
        };
      }
    return s || { code: -1, msg: "所有代理请求失败", url: e, data: null, loaded: 0, total: 0, duration: 0, fileType: "blob", contentType: "", size: 0 };
  }
  async downloadConcurrent(e, a = {}) {
    const r = a.maxConcurrency || 3, n = new f(r), t = e.map((c) => () => this.requestWithProxy(c, a)).map((c) => n.add(c));
    return await Promise.allSettled(t);
  }
  async uploadParallel(e, a, r = {}) {
    const n = a.map(async (s) => {
      try {
        const t = { ...r };
        if (e instanceof globalThis.Blob)
          t.body = e, t.headers = { ...s.headers, ...t.headers };
        else {
          const l = {
            ...e,
            ...s.branch && { branch: s.branch },
            ...s.sha && { sha: s.sha }
          };
          t.body = JSON.stringify(l), t.headers = { "Content-Type": "application/json", ...s.headers, ...t.headers };
        }
        t.method = r.method || s.method || "POST";
        const c = await this.request(s.url, t);
        return { platform: s.name, ...c };
      } catch (t) {
        return { platform: s.name, code: -1, msg: t.message, data: null, loaded: 0, total: 0, duration: 0, fileType: "blob", contentType: "", size: 0 };
      }
    });
    return await Promise.allSettled(n);
  }
}
const d = new g(), h = (o, e) => d.request(o, e);
h.request = (o, e) => d.request(o, e);
h.proxy = (o, e) => d.requestWithProxy(o, e);
h.downloadAll = (o, e) => d.downloadConcurrent(o, e);
h.uploads = (o, e, a) => d.uploadParallel(o, e, a);
h.Aborter = () => d.createController();
h.fileType = (o, e) => d.detectFileType(o, e);
h.toBase64 = (o) => d.toBase64(o);
h.blobToString = (o) => d.blobToString(o);
export {
  g as FetchFactory,
  h as default
};
//# sourceMappingURL=index.js.map
