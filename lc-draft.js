/* ============================================================
 * lc-draft.js — #12 B-lite「编辑防丢兜底」正式版
 * ============================================================
 * 形态（demo 真机验收通过后收编，tools/demo-draft-guard.js）：
 *   快照/恢复逻辑只在普通文章编辑器帧（lofter.lf127.net/…/pc-publish.html）
 *   运行——demo 实证正文只存在这一帧的 .ProseMirror 里，标题/tag 在
 *   父帧（哈希类区，走官方草稿兜底）；top 帧只挂状态徽标（见下）；
 *   其它子帧静默退出。
 *
 *   · 输入节流（≤2s 一拍，最快 0.8s 补拍）把 .ProseMirror 的
 *     HTML/纯文本快照写 chrome.storage.local（键 lc_draft_snap_v1，
 *     环形保留 5 版，14 天过期自动清）——纯本地写入，断网照常工作；
 *   · pagehide（刷新/关页瞬间）兜一次最终快照：sessionStorage 同步写
 *     兜住卸载竞态（打完字 <2s 就刷新时 chrome.storage 异步写可能丢），
 *     下次 boot 捞回合并；
 *   · 帧加载时「有非空快照且与当前内容不一致」→ postMessage 广播父帧
 *     出恢复浮条；内容追平快照后广播撤收；
 *   · top 帧：状态徽标宿主 + 恢复浮条宿主，全部 UI 在编辑区外——给
 *     编辑器 iframe 父容器注入 padding-bottom:44px 腾出底部空白带
 *     （probe-moveout2.js 实证：父容器变高、iframe 不动、tag 区整体
 *     下推 44px），官方「草稿已保存」提示行（含字数）的 absolute
 *     bottom:12px 参照 padding box 自动落进空白带，徽标挂其行首；
 *     官方提示未出现时在空白带右下自立门户，提示出现即迁入；恢复
 *     浮条挂同带左侧（复制 = 隐藏容器选区 + execCommand 富文本，
 *     复制的是快照本身），浅暗一致。guard 关 = 零 UI 零注入。
 *
 * 边界（docs/todo-priorities.md #12 定稿）：
 *   · 只保正文：标题与标签走官方草稿兜底（官方草稿标题+正文都存）；
 *   · 断网期间新上传的图片救不回（blob 引用，刷新即失效）；
 *   · 不做自动回填——ProseMirror 自管状态，直写 DOM 有被洗掉风险。
 * 开关：settings.draft.guard（默认关），storage.onChanged 实时启停。
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'lc_draft_snap_v1';
  var SET_KEY = 'lc_settings_v1';
  var PENDING_KEY = 'lc_draft_pending_v1';   /* pagehide 同步兜底（sessionStorage） */
  var RING = 5;                              /* 环形保留版本数 */
  var EXPIRE_MS = 14 * 24 * 60 * 60 * 1000;  /* 快照过期：14 天 */
  var SAVE_MIN_GAP = 2000;                   /* 连续输入时快照间隔上限 */
  var SAVE_IDLE = 800;                       /* 相邻两拍最小间隔（兜底补拍） */

  /* ================= 纯函数（jsdom 测试面） ================= */

  /* 比对口径：剥掉段落 id（ProseMirror 每次会话重排 p_ id，不剥会
   * 永远误判「内容不同」→ 浮条误触发）+ 去掉全部空白（标签间空白与
   * 文字内空格都不参与比对——比对只关心「内容是否相同」） */
  function norm(h) {
    return String(h || '')
      .replace(/\sid="[^"]*"/g, '')
      .replace(/\s+/g, '')
      .trim();
  }
  function hasImage(html) {
    return /<img/i.test(String(html || ''));
  }
  /* 新快照插到最前，环形封顶 */
  function ringPush(items, snap) {
    return [snap].concat(items || []).slice(0, RING);
  }
  /* 过期清理：ts 缺失/非数字视为过期（脏数据防御） */
  function prune(items, now) {
    now = now || Date.now();
    return (items || []).filter(function (it) {
      return it && typeof it.ts === 'number' && now - it.ts < EXPIRE_MS;
    });
  }
  /* 恢复判定：无快照/空快照 → null；一致 → silent；不同 → prompt。
   * 空快照 = 无文字且无图片（防「空快照覆盖有效快照」后误提示） */
  function decide(snap, curHtml) {
    if (!snap || !snap.html) return null;
    if (!norm(snap.text) && !hasImage(snap.html)) return null;
    return norm(snap.html) === norm(curHtml) ? 'silent' : 'prompt';
  }
  /* 读取编辑器正文；空（无文字且无图）返回 null——空文不写快照 */
  function collect(el) {
    if (!el) return null;
    var html = el.innerHTML || '';
    var text = el.innerText != null ? el.innerText : (el.textContent || '');
    if (!String(text).trim() && !hasImage(html)) return null;
    return {
      html: html,
      text: String(text),
      textLen: String(text).replace(/\s/g, '').length,
    };
  }

  var api = {
    norm: norm,
    hasImage: hasImage,
    ringPush: ringPush,
    prune: prune,
    decide: decide,
    collect: collect,
  };

  /* ================= 帧门禁 =================
   * Node（无 location）放行给测试；浏览器只认 pc-publish.html 帧。
   * manifest all_frames 会把本文件带进所有帧，这里逐帧自筛。 */
  var isNode = typeof location === 'undefined';
  var isEditorFrame = false;
  var isTopFrame = false;
  try {
    isEditorFrame = /\/pc-publish\.html(\?|#|$)/.test(String(location.href));
    isTopFrame = window.top === window;
  } catch (e) { /* ignore */ }
  if (!isNode && !isEditorFrame && !isTopFrame) return; /* 其它子帧静默 */

  if (isNode && typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  if (!isEditorFrame) {
    startTopBadgeHost(); /* top 帧：只挂状态徽标，不做快照 */
    return;
  }

  /* ================= top 帧：状态徽标 + 恢复浮条宿主 =================
   * 编辑器帧视口=正文区，fixed UI 钉哪都压字（2026-09-28 多轮真机
   * 反馈）→ 全部 UI 迁父帧「腾座」布局（tools/probe-moveout2.js 四项
   * 实证通过）：给编辑器 iframe 父容器注入 padding-bottom:44px 腾出
   * 底部空白带（父容器变高、iframe 不动、tag 区整体下推 44px）——
   * 官方「草稿已保存」提示行（含字数）的 absolute bottom:12px 参照
   * padding box，自动落进空白带；徽标挂其行首；官方提示未出现时在
   * 同一空白带右下自立门户，提示出现即迁入；恢复浮条挂同带左侧。
   * 状态同步走 chrome.storage.onChanged；guard 关 = 零 UI 零注入
   * （padding 一并撤）。 */
  function startTopBadgeHost() {
    if (window.__lcDraftTop) return;
    window.__lcDraftTop = true;
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    var PILL_SEL = '.rc-dialog-body div[class*="dl+rqIrnR1qGO7K68aqRXQ"]';
    var PILL_SEL_FALLBACK = 'div[class*="dl+rqIrnR1qGO7K68aqRXQ"]';
    var IFRAME_SEL = 'iframe[src*="pc-publish"]';
    var PAD_PX = '44px';
    var guardOn = false;
    var lastSnap = null;
    var badge = null;
    var ownWrap = null;
    var bar = null;
    var obs = null;
    var syncTimer = 0;

    function fmt(ts) {
      try { return new Date(ts).toTimeString().slice(0, 5); } catch (e) { return '??:??'; }
    }
    function charCount(t) { return String(t || '').replace(/\s/g, '').length; }
    function badgeText() {
      return lastSnap && lastSnap.ts
        ? '防丢快照 · ' + fmt(lastSnap.ts) + ' · ' + charCount(lastSnap.text) + ' 字'
        : '防丢快照 · 监听中';
    }
    function makeBadge(withSep) {
      var el = document.createElement('span');
      el.id = 'lc-draft-badge';
      el.style.cssText =
        'flex:none!important;font:12px/1.6 system-ui,sans-serif!important;' +
        'color:inherit!important;opacity:.85!important;white-space:nowrap!important;' +
        'pointer-events:none!important;' +
        (withSep
          ? 'padding-right:6px!important;margin-right:2px!important;' +
            'border-right:1px solid rgba(128,128,128,.35)!important;'
          : '');
      el.textContent = badgeText();
      return el;
    }
    function editorHost() {
      var f = document.querySelector(IFRAME_SEL);
      return (f && f.parentElement) || null;
    }
    /* 腾座注入：标记挂宿主元素防重复；React 重建宿主时 MutationObserver
     * → sync 会补注。padding-bottom 参照 padding box，提示行的
     * bottom:12px 随之落进空白带（探针实证，勿改 44 除非重跑探针） */
    function applyPad(on) {
      var host = editorHost();
      if (!host) return;
      if (on && !host.__lcPadOn) {
        host.__lcPadOn = true;
        try { host.style.setProperty('padding-bottom', PAD_PX, 'important'); } catch (e) {}
      } else if (!on && host.__lcPadOn) {
        host.__lcPadOn = false;
        try { host.style.removeProperty('padding-bottom'); } catch (e) {}
      }
    }
    function cleanup() {
      if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
      badge = null;
      if (ownWrap && ownWrap.parentNode) ownWrap.parentNode.removeChild(ownWrap);
      ownWrap = null;
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      bar = null;
    }
    function sync() {
      syncTimer = 0;
      applyPad(guardOn);
      if (!guardOn) { cleanup(); return; }
      var pill = document.querySelector(PILL_SEL) ||
                 document.querySelector(PILL_SEL_FALLBACK);
      if (pill) {
        /* 官方胶囊在 → 徽标插行首（胶囊右锚不动、向左生长）；自立门户撤收 */
        if (ownWrap && ownWrap.parentNode) ownWrap.parentNode.removeChild(ownWrap);
        ownWrap = null;
        /* 站点官方在胶囊链上挂了原生 title（悬停出「自动保存编辑中的内
         * 容」提示），与我们的 ::after 气泡叠加成双份（2026-09-29 真机
         * 反馈；首轮只清胶囊+子孙无效 → title 实际挂在祖先 wrapper 或
         * 被 React 重渲染补回）→ 胶囊、子孙、祖先三路都清。React 补回
         * 时 MutationObserver（含 title 属性监听）→ sync 会再清（自愈） */
        try {
          if (pill.hasAttribute('title')) pill.removeAttribute('title');
          Array.prototype.forEach.call(
            pill.querySelectorAll('[title]'),
            function (n) { n.removeAttribute('title'); });
          var stop = pill.closest('.rc-dialog-body');
          var anc = pill.parentElement;
          while (anc) {
            if (anc.hasAttribute('title')) anc.removeAttribute('title');
            if (anc === stop) break;
            anc = anc.parentElement;
          }
        } catch (e) { /* ignore */ }
        if (!badge || badge.parentNode !== pill) {
          if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
          badge = makeBadge(true);
          pill.insertBefore(badge, pill.firstChild);
        }
        badge.textContent = badgeText();
        return;
      }
      /* 无官方胶囊 → 空白带右下自立门户（padding 已腾出位置） */
      var host = editorHost();
      if (host) {
        if (!ownWrap || !ownWrap.parentNode) {
          cleanup();
          ownWrap = document.createElement('div');
          ownWrap.id = 'lc-draft-badge-host';
          ownWrap.style.cssText =
            'position:absolute!important;right:12px!important;bottom:12px!important;' +
            'z-index:2147483646!important;display:flex!important;align-items:center!important;' +
            'background:rgba(20,20,28,.88)!important;color:#fff!important;' +
            'font:12px/1.6 system-ui,sans-serif!important;padding:3px 10px!important;' +
            'border-radius:12px!important;box-shadow:0 2px 8px rgba(0,0,0,.25)!important;';
          host.appendChild(ownWrap);
          badge = makeBadge(false);
          ownWrap.appendChild(badge);
        }
        if (badge) badge.textContent = badgeText();
      }
    }
    function scheduleSync() {
      if (!syncTimer) syncTimer = setTimeout(sync, 200);
    }

    /* ---------- 恢复浮条（父帧版）：编辑器 iframe 父容器左下，空白带内 ---------- */
    function hideRecoverBar() {
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      bar = null;
    }
    /* 富文本复制：隐藏容器选区 + execCommand（复制的是快照本身而非当前
     * 编辑器内容，语义更准；demo 实测 ProseMirror 粘贴保留段落） */
    function copyHtml(html) {
      var holder = document.createElement('div');
      holder.contentEditable = 'true';
      holder.style.cssText =
        'position:fixed!important;left:-9999px!important;top:0!important;opacity:0!important;';
      holder.innerHTML = html;
      document.body.appendChild(holder);
      var ok = false;
      try {
        var range = document.createRange();
        range.selectNodeContents(holder);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        ok = document.execCommand('copy');
        sel.removeAllRanges();
      } catch (e) { /* ignore */ }
      if (holder.parentNode) document.body.removeChild(holder);
      return ok;
    }
    function showRecoverBar() {
      if (bar || !guardOn) return;
      var host = editorHost();
      if (!host) return;
      chrome.storage.local.get(KEY, function (res) {
        var items = (res && res[KEY] && res[KEY].items) || [];
        var snap = items.length && items[0] && items[0].ts ? items[0] : null;
        if (!snap || !guardOn) return;
        hideRecoverBar();
        bar = document.createElement('div');
        bar.id = 'lc-draft-bar';
        bar.style.cssText =
          'position:absolute!important;left:12px!important;bottom:12px!important;' +
          'z-index:2147483647!important;display:flex!important;align-items:center!important;' +
          'gap:6px!important;max-width:calc(100% - 32px)!important;' +
          'background:rgba(24,24,32,.95)!important;color:#fff!important;' +
          'font:12px/1.6 system-ui,sans-serif!important;padding:5px 10px!important;' +
          'border-radius:8px!important;border:1px solid rgba(255,255,255,.14)!important;' +
          'box-shadow:0 4px 16px rgba(0,0,0,.35)!important;';
        var msg = document.createElement('span');
        msg.style.cssText =
          'flex:0 1 auto!important;overflow:hidden!important;' +
          'text-overflow:ellipsis!important;white-space:nowrap!important;';
        msg.textContent = '检测到本机快照 ' + fmt(snap.ts) + ' · ' + charCount(snap.text) + ' 字';
        bar.title = '比当前正文新——可能是断网或崩溃前写的，复制可找回';
        function mkBtn(label, primary) {
          var b = document.createElement('button');
          b.textContent = label;
          b.style.cssText =
            'flex:none!important;cursor:pointer!important;border:0!important;border-radius:6px!important;' +
            'padding:5px 12px!important;font:12px/1.4 system-ui,sans-serif!important;' +
            (primary
              ? 'background:#7c80d2!important;color:#fff!important;'
              : 'background:rgba(255,255,255,.14)!important;color:#ddd!important;');
          return b;
        }
        var copyBtn = mkBtn('复制全文', true);
        var clearBtn = mkBtn('忽略并清除', false);
        copyBtn.addEventListener('click', function () {
          var ok = copyHtml(snap.html);
          copyBtn.textContent = ok ? '已复制 ✓ Ctrl+V 粘贴' : '复制失败';
        });
        clearBtn.addEventListener('click', function () {
          try { chrome.storage.local.remove(KEY, function () {}); } catch (e) {}
          hideRecoverBar();
        });
        bar.appendChild(msg);
        bar.appendChild(copyBtn);
        bar.appendChild(clearBtn);
        host.appendChild(bar);
      });
    }

    try {
      chrome.storage.local.get([SET_KEY, KEY], function (res) {
        var s = (res && res[SET_KEY]) || {};
        guardOn = !!(s.draft && s.draft.guard);
        var items = (res && res[KEY] && res[KEY].items) || [];
        lastSnap = items.length && items[0] && items[0].ts ? items[0] : null;
        sync();
        try {
          chrome.storage.onChanged.addListener(function (changes, area) {
            if (area !== 'local' || !changes) return;
            if (changes[SET_KEY]) {
              var s2 = changes[SET_KEY].newValue || {};
              guardOn = !!(s2.draft && s2.draft.guard);
              sync();
            }
            if (changes[KEY]) {
              var its = (changes[KEY].newValue && changes[KEY].newValue.items) || [];
              lastSnap = its.length && its[0] && its[0].ts ? its[0] : null;
              if (badge) badge.textContent = badgeText();
            }
          });
          obs = new MutationObserver(scheduleSync);
          obs.observe(document.documentElement || document, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['title'] /* React 补回 title → 触发再清 */
          });
        } catch (e) { /* ignore */ }
      });
      /* 接收编辑器帧广播：有恢复 → 父帧出浮条；无/已追平 → 收浮条。
       * 只认编辑器 iframe 的 contentWindow，防外域消息伪造 */
      window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (!d || typeof d !== 'object' || typeof d.__lcDraftRecover !== 'boolean') return;
        var f = document.querySelector(IFRAME_SEL);
        var src = null;
        try { src = (f && f.contentWindow) || null; } catch (err) { src = null; }
        if (!src || e.source !== src) return;
        if (d.__lcDraftRecover) showRecoverBar();
        else hideRecoverBar();
      });
    } catch (e) { /* 扩展上下文失效等：静默 */ }
  }

  /* ================= 编辑器帧运行时 ================= */
  if (window.__lcDraft) return;
  window.__lcDraft = true;

  /* 扩展上下文失效（重载扩展后旧页面）等场景静默退出 */
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  var running = false;
  var onInput = null, onPageHide = null;
  var lastSave = 0, timer = 0;

  /* ---------- storage（单键 get→改→set，storage 端天然串行化） ---------- */
  function stGet(fn) {
    try {
      chrome.storage.local.get(KEY, function (res) { fn((res && res[KEY]) || null); });
    } catch (e) { fn(null); }
  }
  function stSet(val, fn) {
    try {
      var o = {}; o[KEY] = val;
      chrome.storage.local.set(o, function () { if (fn) fn(); });
    } catch (e) { if (fn) fn(); }
  }
  function stRemove(fn) {
    try { chrome.storage.local.remove(KEY, function () { if (fn) fn(); }); }
    catch (e) { if (fn) fn(); }
  }
  function readItems(cb) {
    stGet(function (data) {
      var items = (data && data.items) || [];
      var kept = prune(items, Date.now());
      cb(kept, kept.length !== items.length);
    });
  }
  function writeItems(items, cb) {
    if (!items.length) { stRemove(function () { if (cb) cb(); }); return; }
    stSet({ v: 1, items: items }, function () { if (cb) cb(); });
  }

  /* ---------- 恢复提示：判定 + 广播（浮条 UI 在父帧腾座空白带） ---------- */
  function announceRecover(visible) {
    try { window.parent.postMessage({ __lcDraftRecover: !!visible }, '*'); } catch (e) { /* ignore */ }
  }

  /* ---------- 快照写入 ---------- */
  function snapshotNow() {
    var el = document.querySelector('.ProseMirror');
    if (!el) return;
    var snap = collect(el);
    if (!snap) return; /* 空文不写：防「空快照覆盖有效快照」 */
    readItems(function (items) {
      var latest = items[0];
      if (latest && norm(latest.html) === norm(snap.html)) {
        announceRecover(false); /* 内容追平快照 → 通知父帧撤浮条（幂等） */
        return;
      }
      var s = { ts: Date.now(), html: snap.html, text: snap.text };
      writeItems(ringPush(items, s), function () {
        lastSave = Date.now();
      });
    });
  }
  /* 节流：至少 SAVE_MIN_GAP 一拍；两拍间隔被压到 SAVE_IDLE 以下时按
   * SAVE_IDLE 补拍（输入密集时约等于每 2 秒必有一版） */
  function schedule() {
    if (timer) return;
    var wait = lastSave === 0
      ? SAVE_MIN_GAP
      : Math.min(SAVE_MIN_GAP, Math.max(SAVE_IDLE, SAVE_MIN_GAP - (Date.now() - lastSave)));
    timer = setTimeout(function () { timer = 0; snapshotNow(); }, wait);
  }

  /* ---------- 启停 ---------- */
  function boot() {
    readItems(function (items) {
      /* 捞 pagehide 同步兜底的 pending：打完字 <2s 就刷新时 chrome.storage
       * 异步写入有卸载竞态（快照可能丢），sessionStorage 同步写必成、
       * 同标签页刷新后保留 → 这里捞回合并，落盘后再广播（父帧读得到） */
      var pending = null;
      try {
        var raw = sessionStorage.getItem(PENDING_KEY);
        if (raw) {
          pending = JSON.parse(raw);
          sessionStorage.removeItem(PENDING_KEY);
        }
      } catch (e) { /* ignore */ }
      if (pending && typeof pending.ts === 'number' && typeof pending.html === 'string') {
        var dup = items.length && norm(items[0].html) === norm(pending.html);
        if (!dup) {
          items = ringPush(items, pending);
          writeItems(items, function () { judge(items); }); /* 落盘后再判定广播 */
          return;
        }
      }
      judge(items);
    });
    function judge(its) {
      var show = false;
      if (its.length) {
        var el = document.querySelector('.ProseMirror');
        show = decide(its[0], el ? el.innerHTML : '') === 'prompt';
      }
      announceRecover(show); /* 一致也广播 false：父帧据此不出浮条 */
    }
  }
  function start() {
    if (running) return;
    running = true;
    onInput = function (e) {
      var t = e.target;
      if (!t || !t.closest || !t.closest('.ProseMirror')) return;
      schedule();
    };
    document.addEventListener('input', onInput, true);
    onPageHide = function () {
      var el = document.querySelector('.ProseMirror');
      if (!el) return;
      var snap = collect(el);
      if (!snap) return;
      /* 同步兜底先行：页面卸载后异步 chrome.storage 可能没跑完（刷新
       * 竞态），sessionStorage 同步写必落，下次 boot 捞回合并 */
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(snap)); } catch (e) {}
      readItems(function (items) {
        var latest = items[0];
        if (latest && norm(latest.html) === norm(snap.html)) return;
        writeItems(ringPush(items, { ts: Date.now(), html: snap.html, text: snap.text }));
      });
    };
    window.addEventListener('pagehide', onPageHide);
    boot();
  }
  function stop() {
    if (!running) return;
    running = false;
    if (onInput) document.removeEventListener('input', onInput, true);
    if (onPageHide) window.removeEventListener('pagehide', onPageHide);
    onInput = onPageHide = null;
    if (timer) { clearTimeout(timer); timer = 0; }
    announceRecover(false); /* 关停：父帧浮条一并撤 */
    lastSave = 0;
  }
  function apply(on) { if (on) start(); else stop(); }

  function readConfig(cb) {
    try {
      chrome.storage.local.get(SET_KEY, function (res) {
        var s = (res && res[SET_KEY]) || {};
        cb(!!(s.draft && s.draft.guard));
      });
    } catch (e) { cb(false); }
  }

  readConfig(apply);
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes || !changes[SET_KEY]) return;
      var s = (changes[SET_KEY] && changes[SET_KEY].newValue) || {};
      apply(!!(s.draft && s.draft.guard));
    });
  } catch (e) { /* ignore */ }

  /* 调试/探针面 */
  global.LC_draft = api;
})(typeof window !== 'undefined' ? window : globalThis);
