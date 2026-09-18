/*
 * 字数统计桥接（跑在编辑器 UEditor iframe 里）
 *
 * 为什么存在：编辑器正文 iframe 可能跨域（lf127.net），主帧的
 * content.js 读不到 contentDocument，字数只能由本脚本在帧内
 * 计数后 postMessage 给父帧。消息只含三个整数，无正文内容。
 *
 * 口径必须与 content.js 的 wcCount() 保持一致：
 * 汉字按字、连续英文/数字按词（内部连接符 ' ’ - 不断词）、
 * 标点计入总字符（总字符不含空白）。
 */
(function () {
  if (window.top === window) return; /* 只在子帧运行 */
  if (window.__lcWcFrame) return; /* 防重复注入 */
  window.__lcWcFrame = true;

  var MSG_UPDATE = "lc-wc-update";
  var MSG_PING = "lc-wc-ping";

  /* UEditor iframe 的 body：contenteditable 的 .view（编辑态）。
   * 只认「长得像编辑器」的文档，评论 iframe 等一概不理。 */
  function isEditorDoc() {
    var b = document.body;
    if (!b) return false;
    if (b.isContentEditable || document.designMode === "on") return true;
    return /(^|\s)(view|edui-body-container)(\s|$)/.test(b.className || "");
  }

  var last = null; /* [han, words, chars] 上次上报值 */

  function calc(text) {
    var han = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
    var words = (text.match(/[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g) || []).length;
    return [han, words, text.replace(/\s/g, "").length];
  }

  function send(force) {
    if (!isEditorDoc()) return;
    var text = document.body.innerText || document.body.textContent || "";
    var c = calc(text);
    if (!force && last && last[0] === c[0] && last[1] === c[1] && last[2] === c[2]) {
      return;
    }
    last = c;
    try {
      window.parent.postMessage(
        { type: MSG_UPDATE, han: c[0], words: c[1], chars: c[2] },
        "*"
      );
    } catch (e) {}
  }

  var t = 0;
  function schedule() {
    if (t) return;
    t = setTimeout(function () {
      t = 0;
      send(false);
    }, 160);
  }

  ["input", "keyup", "paste", "cut"].forEach(function (ev) {
    document.addEventListener(ev, schedule, true);
  });

  /* UEditor 的 setContent / 撤销 / 模板插入不走 input 事件，靠 DOM 变更兜底。
   * document_start 注入时 documentElement 可能还没建，就绪后再挂观察器。 */
  function watchMutations() {
    if (!window.MutationObserver || !document.documentElement) return;
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  if (document.documentElement) {
    watchMutations();
  } else {
    document.addEventListener("readystatechange", watchMutations, { once: true });
  }

  /* 主帧兜底轮询：ping 一次、强制上报一次（防任何事件路径漏网） */
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === MSG_PING) send(true);
  });
  setInterval(function () {
    if (!document.hidden) send(false);
  }, 1500);

  send(true);
})();
