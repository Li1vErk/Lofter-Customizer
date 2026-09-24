/* 面板首帧防白闪 —— theme-boot.js
 * ---------------------------------------------------------------
 * 为什么是独立文件、而不是 popup.html <head> 里的内联 <script>：
 * MV3 扩展页默认 CSP 为 `script-src 'self'`，内联脚本会被浏览器直接拒绝执行
 * （实测控制台原文：Executing inline script violates the following Content
 * Security Policy directive 'script-src 'self''）。第一版把这段逻辑写在
 * 内联块里，于是防白闪从未生效——暗色下 FAB 面板依旧先画一帧浅色，再随
 * body 的 250ms 背景过渡翻暗，用户能看到明显的「亮 → 暗」过程。
 * 拆成同源外部文件既能过 CSP，也仍是 parser-blocking：只要它排在 <head>、
 * 且在任何 <body> 内容之前，就在第一帧之前执行完毕。
 *
 * 逻辑：宿主 content.js 建 iframe 时把当前深浅写进 URL（popup.html?lcDark=1），
 * 这里据此先给 <html> 挂 lc-pre-dark 顶住第一帧（--lc-bg 等变量见 popup.html
 * 的 `html.lc-pre-dark body` 选择器，与 body.dark 同组共用，不存在第二套色值）。
 * 真值（chrome.storage）到手后由 popup.js 的 applyDarkFollow 撤掉本标记、
 * 交给 body.dark 接管——两者同一任务内完成，计算值不变，不会触发过渡。
 * 工具栏弹窗（非 iframe）没有该参数，行为完全不变。
 */
(function () {
  try {
    if (/(?:^|[?&])lcDark=1(?:&|$)/.test(location.search)) {
      document.documentElement.classList.add("lc-pre-dark");
    }
  } catch (e) {
    /* 非扩展环境（直接 file:// 打开调试等）静默降级，不影响其它逻辑 */
  }
})();
