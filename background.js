// background.js - Service Worker for Manifest V3

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
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== 'lcExportFetch' || typeof msg.url !== 'string') return false;
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