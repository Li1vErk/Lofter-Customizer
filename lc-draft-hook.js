/* ============================================================
 * lc-draft-hook.js — #12 文章隔离 v2：保存接口钩子（MAIN 世界）
 * ============================================================
 * 为什么单独一个文件跑 MAIN 世界：content script 默认在隔离世界，
 * hook 不到页面自己的 fetch/XHR（tools/probe-aid.js 探针实证：AUTO_SAVE
 * 请求由页面 bundle pc-post-text-publish.*.js 发出）。MV3 content_scripts
 * 支持 world:"MAIN"（Chrome/Edge 111+，2023-），声明式注入、不经
 * background、不受页面 CSP 限制。
 *
 * 装在**哪一帧**（2026-10-02 真机 [lc-debug] 实证，此前判断错过一轮）：
 * 自动保存请求由**顶层帧**发出 —— 日志 `req#26 /edit/810c5c05_34f664f00`
 * 后跟 `xhr 命中保存 URL … 本帧 host=www.lofter.com`，而 lofter.lf127.net
 * 编辑器 iframe 里那份钩子一条都没抓到。所以：
 *   · manifest match 同时覆盖 `*.lofter.com`（顶层）与
 *     `lofter.lf127.net/lofter-admin/*`（编辑器帧，其它发布流仍可能从帧内发）；
 *   · postMessage 只到本帧 → 顶层帧的 lc-draft.js 负责把键转发进编辑器
 *     iframe（见该文件「文章键转发」一节），编辑器帧那边才写得了快照。
 *
 * 钩子做两件事（只读、不改请求）：
 *   ① 保存接口抠 postId。URL 形态（tools/probe-aid.js 三组实证）：
 *      · 新草稿首次 AUTO_SAVE：/Blog/<user>/new/text/，请求体 postId 为空
 *        → 响应 response.id 返回服务端分配的号；
 *      · 已存草稿：/edit/<permalink>，请求体自带 postId，先到先报。
 *      响应识别要求 id 纯数字且带 permalink 字段，避免误吃其它接口的同名 id。
 *   ② /postPreEdit 响应里抠同一篇的键 —— 打开草稿时顶层帧先请求它拿内容
 *      预填编辑器，若响应里带 id+permalink，历史就能在「打字之前」显示，
 *      不必等首次自动保存（约 3s）。形态已实证（2026-10-02 真机：响应
 *      response.oldPost.{id,permalink,…}，提取键 p14217006848 命中），
 *      仍保留严把关（深扫 ≤3 层 + permalink 形态校验），不匹配即回落 ①。
 * postMessage 报文可被页面伪造 → 隔离侧只认 p+纯数字 形态，最坏后果
 * 是快照分组错一篇，无安全面。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__lcSaveHookMain) return;
  window.__lcSaveHookMain = true;

  var SAVE_URL_RE = /(\/edit\/|\/new\/text)/i;
  var PREEDIT_RE = /\/postPreEdit/i;
  /* permalink 实测形态 `810c5c05_34f664f00` / `818c5c05_34f66o7efc` */
  var PERMALINK_RE = /^[0-9a-f]{6,}_[0-9a-z]{6,}$/i;

  /* ── 诊断开关 ──
   * DBG：请求流水（每条请求一行、上限 80 行）+ 命中保存 URL + report 报文。
   *   2026-10-02 定位「保存请求从哪一帧发出」时开启过，结论已落地 → 默认关；
   *   以后再遇到「键没上来」类问题，改 true 重载即可看全程。 */
  var DBG = false;
  var seenReq = 0;
  var TAG = 'background:#c0392b;color:#fff;padding:1px 6px;border-radius:3px';
  function out(m) {
    try { console.log('%c[lc-debug] ' + m, TAG); } catch (e) { /* ignore */ }
  }
  function dbg(m) { if (DBG) out(m); }
  function dbgReq(u) {
    if (!DBG || seenReq >= 80) return;
    seenReq++;
    var p = String(u || '');
    try { p = new URL(p, location.href).pathname; } catch (e) { /* ignore */ }
    dbg('req#' + seenReq + ' ' + p + '  @' + location.host);
  }
  dbg('hook 已装 @ host=' + location.host + '  top=' + (window === window.top) +
    '  href=' + String(location.href).slice(0, 90));

  /* 请求体 → postId：站点实际用 urlencoded（Content-Type 探针实证：
   * title=&blogId=…&postId=14216993428&…）；兼容 JSON（"postId":…）。
   * 空串/0（新草稿未保存）取不到 → 放行等响应 */
  function pidFromBody(body) {
    var m = /(?:^|[^A-Za-z0-9])postId["']?\s*[:=]\s*"?(\d{8,})/.exec(String(body || ''));
    return m ? m[1] : '';
  }
  /* 响应 → postId：{meta:{status:200},response:{…,id:"142170191312",
   * permalink:"818c5c05_34f66o7efc",…}} */
  function pidFromRes(txt) {
    try {
      var r = JSON.parse(txt);
      r = r && r.response;
      if (r && typeof r.permalink === 'string' && /^\d{8,}$/.test(String(r.id))) {
        return String(r.id);
      }
    } catch (e) { /* 非 JSON 忽略 */ }
    return '';
  }
  /* /postPreEdit 响应 → postId（形态未实证，故深扫 ≤3 层 + 严把关：
   * 必须有 permalink 且形如 <hex>_<hex>，再配 8 位以上纯数字 id。
   * 拿不到就返回空串 → 回落到首次自动保存那条路径，不影响既有行为） */
  function pidFromPreEdit(txt) {
    var root = null;
    try { root = JSON.parse(txt); } catch (e) { return ''; }
    var hit = '';
    (function walk(o, d) {
      if (hit || !o || typeof o !== 'object' || d > 3) return;
      if (typeof o.permalink === 'string' && PERMALINK_RE.test(o.permalink) &&
          /^\d{8,}$/.test(String(o.id))) { hit = String(o.id); return; }
      for (var k in o) {
        if (Object.prototype.hasOwnProperty.call(o, k)) walk(o[k], d + 1);
      }
    })(root, 0);
    return hit;
  }
  function onPreEdit(txt) {
    report(pidFromPreEdit(txt));
  }
  function report(pid) {
    if (!pid) return;
    dbg('report -> p' + pid + '  (本帧 host=' + location.host + ')');
    try { window.postMessage({ __lcAidFound: 'p' + pid }, '*'); } catch (e) { /* ignore */ }
  }

  /* ---- hook fetch ---- */
  var of = window.fetch;
  if (typeof of === 'function') {
    window.fetch = function (input, init) {
      var url = '';
      try { url = (typeof input === 'string' ? input : (input && input.url)) || ''; } catch (e) {}
      dbgReq(url);
      try {
        var body = init && init.body;
        if (body && SAVE_URL_RE.test(url)) {
          dbg('fetch 命中保存 URL: ' + String(url).slice(0, 90));
          report(pidFromBody(String(body)));
        }
      } catch (e) { /* ignore */ }
      var r = of.apply(this, arguments);
      try {
        if (SAVE_URL_RE.test(url)) {
          r.then(function (res) {
            try {
              res.clone().text().then(function (t) { report(pidFromRes(t)); }).catch(function () {});
            } catch (e) { /* ignore */ }
          }).catch(function () {});
        } else if (PREEDIT_RE.test(url)) {
          r.then(function (res) {
            try {
              res.clone().text().then(function (t) { onPreEdit(t); }).catch(function () {});
            } catch (e) { /* ignore */ }
          }).catch(function () {});
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  }

  /* ---- hook XHR ---- */
  try {
    var oxOpen = XMLHttpRequest.prototype.open;
    var oxSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.__lcUrl = u;
      dbgReq(u);
      return oxOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (b) {
      var u = this.__lcUrl;
      try {
        if (b && SAVE_URL_RE.test(String(u || ''))) {
          dbg('xhr 命中保存 URL: ' + String(u).slice(0, 90));
          report(pidFromBody(String(b)));
        }
      } catch (e) { /* ignore */ }
      this.addEventListener('load', function () {
        try {
          var uu = String(u || '');
          if (SAVE_URL_RE.test(uu)) report(pidFromRes(this.responseText));
          else if (PREEDIT_RE.test(uu)) onPreEdit(this.responseText);
        } catch (e) { /* ignore */ }
      });
      return oxSend.apply(this, arguments);
    };
  } catch (e) { /* ignore */ }
})();
