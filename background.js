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