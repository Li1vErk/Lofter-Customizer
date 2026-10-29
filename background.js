// background.js - Service Worker for Manifest V3

/* #20 大文件素材库（IndexedDB）：popup 写、SW 读。
 * 接入方式：manifest 的 background.service_worker **没有**声明 type:module ⇒ 这是
 * classic worker ⇒ 只能用 importScripts（不能 ES import）。lc-assets.js 因此写成
 * IIFE 挂全局，SW 与 popup 共用同一份实现。
 * 必须在这一行之后才使用 self.LCAssets。 */
importScripts('lc-assets.js');

chrome.commands.onCommand.addListener((command) => {
  // 先读取设置，检查快捷键是否启用
  chrome.storage.local.get('lc_settings_v1', (result) => {
    const settings = result.lc_settings_v1 || {};
    
    // 如果快捷键被禁用，不执行任何操作
    if (settings.shortcutsEnabled === false) return;
    
    // 快捷键默认启用（undefined 也视为启用）
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      switch (command) {
        case 'toggle-decorations':
          chrome.tabs.sendMessage(tabs[0].id, { action: 'shortcutToggleDecorations' });
          break;
        case 'toggle-edit-mode':
          chrome.tabs.sendMessage(tabs[0].id, { action: 'shortcutToggleEditMode' });
          break;
        case 'toggle-dark-mode':
          chrome.tabs.sendMessage(tabs[0].id, { action: 'shortcutToggleDarkMode' });
          break;
      }
    });
  });
});

/* #10 文章导出：详情页抓取中继。
 * postmanage 页（www.lofter.com）逐篇抓博客子域的详情页会跨域重定向，
 * content script 直 fetch 撞 CORS；SW 有 host_permissions（*.lofter.com），
 * 由这里代抓并回传 HTML 文本。credentials:'include' 带登录态（SSR 直出依赖）。 */
/* 2026-10-29 安全自查补的守卫：**这是全扩展唯一带登录态的出站通道**
 * （credentials:'include'），原来只校验「url 是字符串」就代抓。导出与身份探针的目标
 * 永远在 LOFTER 自家域名内，所以收紧成白名单 —— 万一上游出现注入（例如用户导入别人
 * 分享的主题包 JSON），也无法把它当成「带 cookie 的任意 URL 代理」来用。
 * 注意：`(?:[a-z0-9-]+\.)*` 只允许子域标签，`https://lofter.com.evil.com/` 这类
 * 前缀伪造（`lofter.com` 后不是 `/`）与 userinfo 形态（`lofter.com@evil.com`）都不匹配。 */
const LC_FETCH_ALLOW = /^https:\/\/(?:[a-z0-9-]+\.)*(?:lofter\.com|lf127\.net)(?::\d+)?\//i;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'lcExportFetch' || typeof msg.url !== 'string') return false;
  if (!LC_FETCH_ALLOW.test(msg.url)) {
    sendResponse({ ok: false, status: 0, error: 'host not allowed' });
    return false;
  }
  fetch(msg.url, { credentials: 'include', redirect: 'follow' })
    .then((r) => {
      if (!r.ok) { sendResponse({ ok: false, status: r.status }); return; }
      r.text().then((text) => sendResponse({ ok: true, status: r.status, text }));
    })
    .catch((e) => sendResponse({ ok: false, status: 0, error: String(e) }));
  return true; // 异步 sendResponse
});

/* #14 分享图：图片中继。
 * avaimg.lf127.net（头像域）不回 ACAO → content script 直连取不到像素（canvas 污染，
 * toBlob 抛 SecurityError）。SW 有 *.lf127.net host_permissions，代抓后转 dataURL 回传——
 * SW 无 DOM，拿不到 blob URL / createObjectURL，只能回字符串；dataURL 在 content 侧
 * 不污染 canvas（同源语义）。
 * 只放行图片：content-type 必须 image/*，且体积上限 8MB（防误传/内存爆掉）。 */
const LC_IMG_MAX = 8 * 1024 * 1024;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'lcFetchImage' || typeof msg.url !== 'string') return false;
  if (!/^https:\/\/[a-z0-9.-]+\.(lf127\.net|lofter\.com)\//i.test(msg.url)) {
    sendResponse({ ok: false, error: 'host not allowed' });
    return false;
  }
  fetch(msg.url, { credentials: 'omit' })
    .then((r) => {
      if (!r.ok) { sendResponse({ ok: false, status: r.status }); return; }
      const type = r.headers.get('content-type') || '';
      if (!/^image\//i.test(type)) { sendResponse({ ok: false, error: 'not an image: ' + type }); return; }
      r.arrayBuffer().then((buf) => {
        if (buf.byteLength > LC_IMG_MAX) { sendResponse({ ok: false, error: 'too large' }); return; }
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 8192) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        }
        sendResponse({ ok: true, status: r.status, dataUrl: 'data:' + type + ';base64,' + btoa(bin) });
      }).catch((e) => sendResponse({ ok: false, error: String(e) }));
    })
    .catch((e) => sendResponse({ ok: false, status: 0, error: String(e) }));
  return true; // 异步 sendResponse
});

/* #20 素材中继：页面（content script）取「扩展 origin 的 IndexedDB」里的图片字节。
 * 为什么必须绕这一道：content script 访问的是**宿主页 origin** 的存储，读不到扩展的库；
 * 而扩展 origin 造出来的 blob: URL 在 lofter.com 里是跨源，CSS / img.src 都取不到 ⇒
 * 只能在**页内**建 URL。于是链路是「SW 读 IDB → base64 回传 → 页面 atob 成 Blob →
 * 页内 createObjectURL」，与上面 lcFetchImage 完全同构（SW 无 DOM ⇒ 只能回字符串）。
 * 守卫：ref 必须过 lc-assets.js 的白名单正则（挡路径穿越与畸形 id），且只回 base64 一个字段。 */
/* 单件上限**引用 lc-assets.js 的单一真相源**（不要在这里另写一个数字：写侧 popup 与读侧
   这里一旦不同步，就会出现「写得进、读不出」的孤儿记录 —— 2026-10-15 真机踩过）。
   对外口径「原图 ≤ 23MB」；下方兜底值只在 lc-assets.js 加载失败时生效。 */
const LC_ASSET_MAX = (self.LCAssets && self.LCAssets.MAX_BYTES) || 24 * 1024 * 1024;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'lcIdbGet' || typeof msg.ref !== 'string') return false;
  const A = self.LCAssets;
  if (!A) { sendResponse({ ok: false, error: 'assets module missing' }); return false; }
  const id = A.idFromRef(msg.ref);
  if (!id) { sendResponse({ ok: false, error: 'bad ref' }); return false; }
  A.getRecord(id)
    .then((rec) => {
      if (!rec || !rec.blob) { sendResponse({ ok: false, error: 'not found' }); return; }
      rec.blob.arrayBuffer()
        .then((ab) => {
          const u8 = new Uint8Array(ab);
          if (u8.length > LC_ASSET_MAX) { sendResponse({ ok: false, error: 'too large' }); return; }
          const type = rec.type || rec.blob.type || 'application/octet-stream';
          sendResponse({ ok: true, type: type, dataUrl: 'data:' + type + ';base64,' + A.bytesToB64(u8) });
        })
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
    })
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // 异步 sendResponse
});