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