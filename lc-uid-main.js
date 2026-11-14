/* ============================================================
 * lc-uid-main.js — 把「当前登录的是谁」从页面主世界搬到 DOM 上
 * ============================================================
 * 为什么必须有这个文件（2026-11-14 真机暴露的架构级问题）：
 *   content script 跑在 **isolated world**，`window` 是隔离的 ——
 *   LOFTER 用页面脚本定义的 `window.lofterGlobalSignInUser` /
 *   `window.blogName` 在那边**根本不存在**。
 *   当初的探针是「F12 → Console 粘贴」，那是主世界，所以读得到 uid；
 *   而插件代码在 content script 里，`pick(window)` 从头到尾返回 null。
 *   后果：#40 的分账号从没真正生效 —— 缓存 `lc_uid_v1` 没人写，popup 的
 *   adopt 永远失败，当前账号永远是空，名单全住在匿名桶里。表面上过滤还能用，
 *   所以一直没被发现；直到「登出后界面应该空白」这条上线才露馅。
 *
 * 本脚本只做一件事：轮询主世界的那几个全局，读到就写到
 *   <html data-lc-uid="2165070853" data-lc-blog="3yell6w">
 * 上（DOM 是两个世界共享的），然后收工。
 *
 * 不读不写 storage、不调 chrome.* —— MAIN world 里没有扩展 API，
 * 也不该有。只写 DOM 属性，不碰页面状态。
 *
 * 已知限制：
 *   · 页面内登出但不刷新时属性还在。实际不会发生 —— LOFTER 登出会跳登录页，
 *     那是新文档，本脚本重跑、读不到身份、写 data-lc-uid-none。
 *   · 等 10 秒仍读不到就记 `data-lc-uid-none="1"`，让 lc-uid.js 能区分
 *     「还没跑/还没就绪」和「确实没登录」。
 * ============================================================ */
(function () {
  "use strict";

  if (window.__lcUidMain) return; /* 同一帧重复注入（多份 manifest 条目）时只跑一次 */
  window.__lcUidMain = true;

  var TRIES = 40; /* 40 × 250ms = 10s，足够等页面脚本就绪 */
  var n = 0;

  /* 与 lc-uid.js 的 pick() 同口径：只认 3~20 位数字 userId。
   * 子域页的 __userIdCrossDomain === "NaN" 天然被挡掉（不是数字）。 */
  function pick() {
    var cands = [];
    try {
      if (window.lofterGlobalSignInUser) cands.push(window.lofterGlobalSignInUser);
    } catch (e) {}
    try {
      if (window.userSignedIn) cands.push(window.userSignedIn);
    } catch (e2) {}
    cands.push(window); /* 首页上 window.blogName / window.userId 是顶层变量 */
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var uid = "";
      var name = "";
      try {
        uid = String(c.userId == null ? "" : c.userId).trim();
        name = String(c.blogName == null ? "" : c.blogName).trim();
      } catch (e3) {
        continue;
      }
      if (/^\d{3,20}$/.test(uid)) return { uid: uid, blogName: name };
    }
    return null;
  }

  function write(p) {
    var h = document.documentElement;
    if (!h || !h.setAttribute) return false; /* document_start 时极少数情况还没有 <html> */
    h.setAttribute("data-lc-uid", p.uid);
    h.setAttribute("data-lc-blog", p.blogName || "");
    h.setAttribute("data-lc-uid-at", String(Date.now()));
    return true;
  }

  (function tick() {
    var p = pick();
    if (p && write(p)) return;
    if (n++ >= TRIES) {
      try {
        document.documentElement.setAttribute("data-lc-uid-none", "1");
      } catch (e) {}
      return;
    }
    setTimeout(tick, 250);
  })();
})();
