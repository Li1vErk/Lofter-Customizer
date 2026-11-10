/* ============================================================
 * lc-official-tags.js — 官方「标签屏蔽」名单的读取与解析
 * ============================================================
 * 与「官方黑名单」并列的第二条官方通道。两者的接口形态完全不同：
 *   黑名单 —— DWR 直读（getBlacklistUserList 返回条目数组）
 *   标签屏蔽 —— **没有** DWR 读接口，名单由设置页 SSR 直出在
 *              `<textarea name="js">this.p={forbidTags:[...]};</textarea>` 里
 *              （2026-10-23 三轮抓包定档；写侧 updateUserForbidTags 的 param0
 *              是「操作后的完整列表」，所以「先读全量」是写的前置条件）
 *
 * 本文件放的是**纯解析 + 读入口**，两份宿主共用：
 *   · background（classic worker）importScripts 后用于中继 fetch
 *   · popup 通过 <script> 加载，用于三态渲染
 * 因此不能写 ES module 语法，也不能碰 DOM。
 *
 * 为什么不在 popup 里直接 fetch：popup 的 Origin 是 chrome-extension://，
 * 直连 lofter.com 拿不到带登录态的响应（同 lcExportFetch / lcIdbGet 的理由）。
 * ============================================================ */
(function (root) {
  "use strict";

  /* 服务端页文案明示的上限。写侧预检用它，满员转本地 / 走交换。 */
  var LIMIT = 100;

  /* ---------- 纯函数区 ---------- */

  /* 从 start 处的 '[' 开始做括号配对扫描，返回数组正文（不含两侧括号）。
   * 不能用 /\[[^\]]*\]/：标签名里出现 ']' 会被提前截断，名单直接少一条。
   * 需要跳过的坑：字符串里的括号不计数；反斜杠转义的下一个字符要整对跳过。 */
  function scanArray(s, start) {
    var depth = 0;
    var quote = "";
    for (var i = start; i < s.length; i++) {
      var c = s.charAt(i);
      if (quote) {
        if (c === "\\") {
          i++;
          continue;
        }
        if (c === quote) quote = "";
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        continue;
      }
      if (c === "[") depth++;
      else if (c === "]") {
        depth--;
        if (depth === 0) return { body: s.slice(start + 1, i), end: i + 1 };
      }
    }
    return null; /* 没闭合：页面被截断或模板改了 */
  }

  /* 按顶层逗号切分数组正文（引号内的逗号不算） */
  function splitItems(body) {
    var items = [];
    var cur = "";
    var quote = "";
    for (var i = 0; i < body.length; i++) {
      var c = body.charAt(i);
      if (quote) {
        cur += c;
        if (c === "\\") {
          cur += body.charAt(++i);
          continue;
        }
        if (c === quote) quote = "";
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        cur += c;
        continue;
      }
      if (c === ",") {
        items.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.trim()) items.push(cur);
    return items;
  }

  /* 单个元素 → 标签名。双引号/单引号都接受，裸标识符原样返回。
   * 要丢的两种情况（名单要拿去覆盖服务端，脏一条就是事故）：
   *   ① 裸值里混进引号（说明前一段解析串位了） ② 空串
   * 不查「引号结尾是否配对」：scanArray 只在引号闭合时才返回数组正文，
   * splitItems 也不会在引号内切分 ⇒ 走到这里的元素必然成对，那是个到不了的分支。 */
  function toTag(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return "";
    var q = s.charAt(0);
    if (q !== '"' && q !== "'") return /["']/.test(s) ? "" : s;
    s = s.slice(1, -1);
    /* \uXXXX 与常见转义还原：SSR 直出的中文标签常被转成 \u 形式 */
    s = s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, function (_m, e) {
      if (e.charAt(0) === "u") return String.fromCharCode(parseInt(e.slice(1), 16));
      return { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[e] || e;
    });
    /* 解引号之后才可能露出空白（`""` / `"  "`）：这类是模板占位，不是标签 */
    return s.trim() ? s : "";
  }

  /* 在一段文本里找 forbidTags 键后面的数组；出现多次时逐个试到能扫描出数组为止 */
  function tryExtract(s) {
    var re = /["']?forbidTags["']?\s*:\s*\[/g;
    var m;
    while ((m = re.exec(s))) {
      var start = s.lastIndexOf("[", m.index + m[0].length);
      if (start < 0) continue;
      var arr = scanArray(s, start);
      if (!arr) continue;
      var tags = [];
      var items = splitItems(arr.body);
      for (var i = 0; i < items.length; i++) {
        var t = toTag(items[i]);
        if (t) tags.push(t);
      }
      return { ok: true, tags: tags };
    }
    return null;
  }

  /* 取出所有 <textarea name="js"> 的内容 —— SSR 把 this.p 塞在这里面 */
  function jsBlocks(s) {
    var out = [];
    var re = /<textarea[^>]*\bname\s*=\s*["']?js["']?[^>]*>([\s\S]*?)<\/textarea>/gi;
    var m;
    while ((m = re.exec(s))) out.push(m[1]);
    return out;
  }

  /* 提取：**优先**在 textarea[name=js] 里找。
   * 别直接用整页盲搜：页面内联脚本、埋点配置里也可能出现同名字样，抓到那个
   * 就等于把别人的（或空的）数组当成用户名单 —— 拿它去写会把真名单冲掉。 */
  function extractForbidTags(html) {
    var s = String(html || "");
    var blocks = jsBlocks(s);
    for (var i = 0; i < blocks.length; i++) {
      var r = tryExtract(blocks[i]);
      if (r) return r;
    }
    var r2 = tryExtract(s);
    if (r2) return r2;
    return { ok: false, reason: /forbidTags/.test(s) ? "unclosed" : "no-key" };
  }

  /* 三态：「改版了」和「没登录」必须分开报 —— 前者是插件该修，后者是用户该登录，
   * 混成一句话会让两边都往错的方向猜（黑名单卡 2026-10-23 就踩过失败态被盖成 0 人）。 */
  function classify(html) {
    var s = String(html || "");
    var ex = extractForbidTags(s);
    if (ex.ok) return { state: "ok", tags: ex.tags };
    if (/id="loginForm"|name="password"|请先登录|login\.lofter\.com|passport\./i.test(s)) {
      return { state: "login", tags: [] };
    }
    return { state: "changed", tags: [], reason: ex.reason };
  }

  /* ---------- 读入口 ---------- */

  /* 走 background 中继（带 cookie）。**不缓存**：调用方每次写前都要现读一次，
   * 因为 param0 是全量覆盖，拿旧快照写会冲掉手机 App 上的改动。 */
  function fetchList() {
    return new Promise(function (resolve) {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({ ok: false, state: "error", tags: [], reason: "no-runtime" });
        return;
      }
      chrome.runtime.sendMessage({ action: "lcOfficialTagsFetch" }, function (resp) {
        if (chrome.runtime.lastError || !resp) {
          resolve({
            ok: false,
            state: "error",
            tags: [],
            reason: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "no-response",
          });
          return;
        }
        resolve(resp);
      });
    });
  }

  var api = {
    LIMIT: LIMIT,
    toTag: toTag,
    scanArray: scanArray,
    extractForbidTags: extractForbidTags,
    classify: classify,
    fetchList: fetchList,
  };
  root.LCOfficialTags = api;
})(typeof self !== "undefined" ? self : this);
