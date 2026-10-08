/* ============================================================
 * lc-i18n.js — 港澳台繁体运行时（#16 · 2026-10-08）
 *
 * 配套生成物 lc-i18n-dict.js（来自 i18n/vocab.json + zhconv）：
 *   window.LC_I18N_DICT = {
 *     "zh-Hans":      {},                                  // 恒等（简体 = 原文，不查表）
 *     "zh-Hant-TW":   { 简体原文: 譯文, … },                 // 平面表
 *     "zh-Hant-HK":   { … },
 *     "__skel__": { "zh-Hant-TW": { 带\u0000的模板原文: 譯文 }, … }   // 骨架表
 *   }
 *
 * 「骨架表」是什么：模板串被 ${} 切开后不是固定字符串
 * （如 `还没有装饰图，点上方「＋ ${x}」添加第一张`）。构建器把插值位置换成
 * \u0000 存成键，运行时编译成正则整串匹配、按捕获组回填。
 *
 * ── 三条纪律（对应 i18n/vocab.json 的 _strategy）──────────────
 * ① 只翻插件自己注入的 UI 与插件自己的页面（popup）。apply() 必须显式传
 *    插件自有容器，**永不传 document.body** —— content script 里那就是
 *    LOFTER 的 DOM，翻了会破坏匹配锚点（主页设置 / 返回首页 / 添加创作声明…）。
 * ② apply() 走「整节点等值」：文本节点 trim 后必须**整串等于**某条字典键才替换。
 *    这是零误伤的关键 —— LOFTER 昵称、文章正文、从页面抓来的标签文案
 *    不可能整体等于我们自己的某条文案；同时也天然绕开匹配锚点（锚点用
 *    indexOf 的**子串**语义，我们只认整串）。
 * ③ 字典缺失 / 语言为简体 / 未 init 时，全链路恒等，功能零影响。
 *
 * ── 用法 ──────────────────────────────────────────────────
 *   LC_I18N.init()                      读 storage 定语言（异步，回调后即可用）
 *   LC_I18N.t("添加装饰图")              单串（平面直查 + 骨架正则），渲染点单点接入
 *   LC_I18N.apply(el)                   在插件自有容器内做整节点替换（含属性）
 *   LC_I18N.watch(el)                   apply + 守着后续增删改（返回解绑函数）
 *   LC_I18N.observe()                   全文档「发现」插件自有容器并接管
 *                                       （只对命中子树 apply，绝不 apply document）
 *   LC_I18N.onChange(fn)                语言切换回调（storage.onChanged 驱动）
 * ============================================================ */
var LC_I18N = (function () {
  "use strict";

  var STORAGE_KEY = (typeof LC_STORAGE_KEY !== "undefined") ? LC_STORAGE_KEY : "lc_settings_v1";
  var HANS = "zh-Hans";
  var SUPPORTED = [HANS, "zh-Hant-TW", "zh-Hant-HK"];
  /* 数据节点标记：该子树内是 LOFTER 抓来的数据（昵称/正文/标签原文），永不翻译 */
  var RAW = "data-lc-raw";
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var ATTRS = ["title", "placeholder", "aria-label", "alt"];
  var PH = "\u0000";

  /* 插件自有容器的选择器白名单：只认插件专有前缀（lc- / lcsd-）。
   * 绝不能退化成 [class*="lc-"] 这类「任意位置子串」匹配 —— 那会命中
   * 文章里任何恰好含 "lc-" 的站点元素，等于对 LOFTER 的 DOM 动手。
   * `[class^="lc-"]` + `[class*=" lc-"]` 合起来 =「class 列表里有一个
   * 以 lc- 打头的词」；LOFTER 的 class 体系是 s- / g- / m- / b- / isay…
   * 不存在以 lc- 打头的词（站点脚本也不叫 lc-）。 */
  var SEL =
    '[id^="lc-"],[id^="lcsd-"],[class^="lc-"],[class*=" lc-"],' +
    '[class^="lcsd-"],[class*=" lcsd-"],[class*="lc-ep-host"],' +
    '[class*="lc-emoji-panel"],[class*="lc-cmt-tb"],[class*="lc-chip"],' +
    '[data-lc-emoji-host],[data-lc-cmt-tb]';

  var cur = HANS;
  var plane = null;   /* { 原文: 译文 } */
  var skels = [];     /* [{ re, out }] 长键优先 */
  var watchers = [];  /* [{ root, mo }] */
  var listeners = [];
  var inited = false;
  var initStarted = false;

  /* ---------- 字典装载 ---------- */
  function rawDict() {
    if (typeof window !== "undefined" && window.LC_I18N_DICT) return window.LC_I18N_DICT;
    try { if (typeof LC_I18N_DICT !== "undefined") return LC_I18N_DICT; } catch (e) {}
    return null;
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function compileSkels(map) {
    var out = [];
    Object.keys(map || {}).sort(function (a, b) { return b.length - a.length; })
      .forEach(function (k) {
        var parts = k.split(PH);
        var src = "";
        for (var i = 0; i < parts.length; i++) {
          src += escRe(parts[i]);
          if (i < parts.length - 1) src += "([\\s\\S]*?)";
        }
        try { out.push({ re: new RegExp("^" + src + "$"), out: map[k] }); } catch (e) {}
      });
    return out;
  }
  function loadDict() {
    var d = rawDict();
    if (!d || !d[cur]) { plane = null; skels = []; return; }
    plane = d[cur];
    skels = compileSkels((d.__skel__ || {})[cur] || {});
    if (!Object.keys(plane).length && !skels.length) plane = null;
  }

  /* ---------- 语言 ---------- */
  function normalize(v) { return SUPPORTED.indexOf(v) > -1 ? v : HANS; }
  function setLang(v) {
    var next = normalize(v);
    if (next === cur && inited) return false;
    cur = next;
    loadDict();
    return true;
  }
  function lang() { return cur; }
  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }
  function notify() {
    listeners.forEach(function (fn) { try { fn(cur); } catch (e) {} });
    watchers.forEach(function (w) { try { apply(w.root); } catch (e) {} });
    applyPluginUI();
  }

  function init(cb) {
    if (initStarted) { if (typeof cb === "function") cb(cur); return; }
    initStarted = true;
    var finish = function () {
      inited = true;
      reapplyAll();
      applyPluginUI();
      if (typeof cb === "function") cb(cur);
    };
    if (typeof chrome === "undefined" || !chrome || !chrome.storage || !chrome.storage.local) {
      setLang(HANS); finish(); return;
    }
    try {
      chrome.storage.local.get(STORAGE_KEY, function (res) {
        var s = (res && res[STORAGE_KEY]) || {};
        setLang(s.lang);
        finish();
      });
      chrome.storage.onChanged.addListener(function (ch, area) {
        if (area !== "local" || !ch || !ch[STORAGE_KEY]) return;
        var s = (ch[STORAGE_KEY].newValue || {});
        if (setLang(s.lang)) notify();
      });
    } catch (e) { setLang(HANS); finish(); }
  }

  /* ---------- 翻译：单串 ---------- */
  function skelApply(entry, text) {
    var m = entry.re.exec(text);
    if (!m) return null;
    var parts = String(entry.out).split(PH);
    var out = parts[0];
    for (var i = 0; i < m.length - 1; i++) out += (m[i + 1] || "") + (parts[i + 1] || "");
    return out;
  }
  function t(s) {
    if (s == null) return s;
    var str = String(s);
    if (cur === HANS || !str) return s;
    if (plane) {
      var hit = plane[str];
      if (hit != null) return hit;
    }
    for (var i = 0; i < skels.length; i++) {
      var out = skelApply(skels[i], str);
      if (out != null) return out;
    }
    return s;
  }

  /* ---------- 翻译：DOM 整节点等值 ---------- */
  function trNodeText(node) {
    var s = node.nodeValue;
    if (!s) return;
    var k = s.trim();
    if (!k) return;
    var hit = plane[k];
    if (hit != null) {
      /* 用函数式 replacement：译文里的 $& / $1 不作替换模式解释 */
      node.nodeValue = s.replace(k, function () { return hit; });
      return;
    }
    /* 骨架：整段文本是「固定原文 + 运行时插值」拼出来的
     * （如 `读取失败：fetch is not defined。请确认已…重试。` 来自模板串
     *   `读取失败：${err.message}。请确认…`）。这类必须靠骨架正则才认得出来，
     *   否则模板串拼出的整段文案全部漏翻。 */
    for (var i = 0; i < skels.length; i++) {
      var out = skelApply(skels[i], k);
      if (out != null) {
        node.nodeValue = s.replace(k, function () { return out; });
        return;
      }
    }
  }
  function trAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      var v = el.getAttribute(a);
      if (!v) continue;
      if (plane[v] != null) el.setAttribute(a, plane[v]);
    }
  }
  function apply(node) {
    if (cur === HANS || !plane || !node) return node;
    var type = node.nodeType;
    if (type === 3) { trNodeText(node); return node; }
    if (type !== 1 && type !== 9 && type !== 11) return node;
    (function walk(n) {
      if (n.nodeType === 3) { trNodeText(n); return; }
      if (n.nodeType === 1) {
        if (SKIP_TAGS[n.tagName]) return;
        if (n.hasAttribute && n.hasAttribute(RAW)) return;
        trAttrs(n);
      }
      for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
    })(node);
    return node;
  }
  function reapplyAll() {
    if (cur === HANS) return;
    watchers.forEach(function (w) { try { apply(w.root); } catch (e) {} });
  }

  /* ---------- 兜底：扫描页面上所有插件自有容器 ----------
   * 用于「没被 watch 到的注入点」（分享图入口四形态、卡片按钮…）。选择器
   * 只认插件专有前缀 —— 绝不能退化成 [class*="lc-"] 这类宽匹配，那会命中文
   * 章页里任何恰好含 "lc-" 的站点元素，等于对 LOFTER 的 DOM 动手。 */
  function applyPluginUI() {
    if (cur === HANS || !plane || typeof document === "undefined" || !document.querySelectorAll) return;
    var nodes;
    try { nodes = document.querySelectorAll(SEL); } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) apply(nodes[i]);
  }

  /* ---------- 兜底：全文档范围内「发现」插件自有容器并接管 ----------
   * 背景：content 侧的注入点很分散（草稿条 / 搜索面板 / tag 按钮 / 卡片
   * 按钮 / 归档盒 / 导出条与 toast…），逐处挂 watch() 既啰嗦又容易漏。
   * 这里用一个全文档 observer **只做发现** —— 绝不对 document 整体 apply
   * （纪律①）：
   *   · 只处理新增节点 / 文本变动 / 白名单属性变动；
   *   · 判断「该节点是不是插件自有容器」（isOwnEl / SEL），命中才 apply
   *     命中的那棵子树；
   *   · apply() 内部仍是「整节点等值」+ data-lc-raw 跳过，三层收窄。
   * 也就是说：即便前缀判定放过了某个站点节点，只要它的文本不整体等于
   * 我们某条文案，就不会被改动。 */
  var obsMo = null;

  function isOwnEl(el) {
    if (!el || el.nodeType !== 1) return false;
    var id = el.id;
    if (id && (id.indexOf("lc-") === 0 || id.indexOf("lcsd-") === 0)) return true;
    var cl = el.classList;
    if (cl && cl.length) {
      for (var i = 0; i < cl.length; i++) {
        var c = cl[i];
        if (c.indexOf("lc-") === 0 || c.indexOf("lcsd-") === 0) return true;
      }
    }
    var at = el.attributes;
    if (at) {
      for (var j = 0; j < at.length; j++) {
        if (at[j].name.indexOf("data-lc-") === 0) return true;
      }
    }
    return false;
  }

  function takeNode(n) {
    if (!n) return;
    if (n.nodeType === 3) { if (isOwnEl(n.parentNode)) trNodeText(n); return; }
    if (n.nodeType !== 1) return;
    if (isOwnEl(n)) { apply(n); return; }
    /* 少见情形：整棵不是自有容器、但内部含自有容器（把我们的元素塞进
     * 站点容器里）。此时用同一份白名单做一次小范围查询。 */
    var hits;
    try { hits = n.querySelectorAll(SEL); } catch (e) { return; }
    for (var i = 0; i < hits.length; i++) apply(hits[i]);
  }

  function observe() {
    if (obsMo || typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    var root = document.documentElement;
    if (!root) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe, { once: true });
      return;
    }
    obsMo = new MutationObserver(function (muts) {
      if (cur === HANS || !plane) return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "characterData") {
          if (isOwnEl(m.target.parentNode)) trNodeText(m.target);
          continue;
        }
        if (m.type === "attributes") {
          if (isOwnEl(m.target)) trAttrs(m.target);
          continue;
        }
        var added = m.addedNodes || [];
        for (var j = 0; j < added.length; j++) takeNode(added[j]);
      }
    });
    obsMo.observe(root, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  /* ---------- 守着插件自有容器的后续变动 ---------- */
  function watch(root) {
    if (cur !== HANS) apply(root);
    if (!root || typeof MutationObserver === "undefined") return function () {};
    var mo = new MutationObserver(function (muts) {
      if (cur === HANS || !plane) return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "characterData") { trNodeText(m.target); continue; }
        if (m.type === "attributes") { if (m.target) trAttrs(m.target); continue; }
        var added = m.addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 3) trNodeText(n); else apply(n);
        }
      }
    });
    mo.observe(root, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
    watchers.push({ root: root, mo: mo });
    return function () {
      mo.disconnect();
      watchers = watchers.filter(function (w) { return w.mo !== mo; });
    };
  }

  return {
    init: init,
    lang: lang,
    set: setLang,
    t: t,
    apply: apply,
    applyPluginUI: applyPluginUI,
    observe: observe,
    watch: watch,
    onChange: onChange,
    supported: SUPPORTED.slice(),
    RAW_ATTR: RAW,
    HANS: HANS,
    /* 调试/测试用 */
    _ready: function () { return { inited: inited, lang: cur, keys: plane ? Object.keys(plane).length : 0, skels: skels.length }; }
  };
})();
