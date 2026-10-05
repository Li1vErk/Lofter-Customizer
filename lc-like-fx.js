/* ============================================================
 * lc-like-fx.js — #13 长文章页点赞飘心（官方功能补齐）
 * ============================================================
 * 形态（demo 真机验收通过后收编，tools/demo-like-fx.js）：
 *   长文章页（= 专栏文章页，/lpost/<permalink>）底部 ♥ 官方只有
 *   「变红」，没有首页/趋势页那套飘心特效。本模块把官方同款动画
 *   补到这一页——**定位是补官方缺失，不是新功能**，故无开关、
 *   无生效范围勾选（docs/todo-priorities.md #13 定稿）。
 *
 *   · 页面门禁：`/lpost/` + 顶层帧；其余页面零行为零注入。
 *   · 触发跟**类变化**走（MutationObserver class），不跟原始 click：
 *     官方点赞是异步请求、且回调本身有 bug（pt_page_longcontrol.js
 *     抛 `Cannot read properties of null (reading 'status')`），跟
 *     click 会让特效与官方视觉状态脱节；跟类变化则恒一致。
 *   · 状态类语义（2026-10-05 真机实锤，首版假设曾反）：
 *     `btn-liking` = 未赞（灰，常态）；`btn-likd` = 已赞（红）。
 *     只在 未赞 → 已赞 方向飘心；取消点赞不触发（官方在首页/趋势页
 *     有「裂开」动画，长文章页 v1 不做，keyframes 已存档备查）。
 *   · 宿主＝图标元素 `#icon-like`（不是整个按钮）：按钮是 215×50
 *     display:block 居中盒，写死像素会随热度数字位数 / 缩放 / 字体
 *     漂移；挂图标则用官方原版几何（相对图标 left/top 1px）自动对齐。
 *   · 素材走站内绝对路径 /rsc/img/icon6.png?002（retina 屏自动换
 *     icon6-retina.png?001），页面自身就引用该雪碧图 → 非新增远程请求。
 *   · 全自有类名（lc-like-anim / lc-like-fly）+ 动画改名 lcLike，
 *     不碰官方任何类名与 DOM 结构；pointer-events:none 不挡点击。
 *
 * keyframes / 几何来源：2026-10-05 从公开 CDN pt_lib_macro.css?e0051e0e…
 * 抽取的官方原版（`.w-icn-0b-do-anim span:first-child` + `@-webkit-keyframes
 * like`），本文件仅改名与收窄选择器。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 常量与纯函数面（jsdom 测试面） ---------- */

  var BTN_SEL = '.btn-like';
  var ICON_SEL = '#icon-like, .icon-like';
  var HOST_CLS = 'lc-like-anim';     /* 挂宿主（图标）上的定位/层叠类 */
  var FLY_CLS = 'lc-like-fly';       /* 飘心 span 自身 */
  var STYLE_ID = 'lc-like-fx-style';
  var DONE_FALLBACK_MS = 700;        /* animationend 兜底（0.5s 动画 + 余量） */

  /* 官方原版动画与几何，仅改名 lcLike 防与站点动画重名 */
  var CSS = [
    '@keyframes lcLike{0%{opacity:0}70%{opacity:1}100%{opacity:0;transform:scale(1.1) translate(-15px,-60px)}}',
    '.' + HOST_CLS + '{position:relative;overflow:visible;z-index:100;}',
    '.' + HOST_CLS + ' .' + FLY_CLS + '{position:absolute;left:1px;top:1px;width:43px;height:40px;opacity:0;',
    'background:url("/rsc/img/icon6.png?002") -6px -150px no-repeat;',
    'transform:scale(0.4);transform-origin:left top;animation:lcLike .5s linear;pointer-events:none;}',
    '@media (min-resolution:2dppx){.' + HOST_CLS + ' .' + FLY_CLS + '{',
    'background-image:url("/rsc/img/retina/icon6-retina.png?001");background-size:59px auto;}}'
  ].join('');

  /* 页面门禁：只认长文章页（= 专栏文章页） */
  function isLpost(pathname) {
    return /^\/lpost\//.test(String(pathname || ''));
  }

  var api = {
    CSS: CSS,
    isLpost: isLpost,
    BTN_SEL: BTN_SEL,
    ICON_SEL: ICON_SEL,
    HOST_CLS: HOST_CLS,
    FLY_CLS: FLY_CLS,
  };

  /* Node（无 location）：只导出纯函数面给回归用 */
  var isNode = typeof location === 'undefined';
  if (isNode) {
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    return;
  }

  if (!isLpost(location.pathname)) return;             /* 非长文章页：零行为 */
  try { if (window.top !== window) return; } catch (e) { return; } /* 子帧静默 */
  if (window.__lcLikeFx) return;                      /* 幂等：多入口注入只跑一次 */
  window.__lcLikeFx = true;

  /* ---------- 效果本体 ---------- */

  var ORIGIN = { dx: 0, dy: 0 };   /* 起点微调（留作真机微调口，默认官方几何） */

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* 在按钮的图标元素上飘一颗心；宿主即图标，位置随按钮布局自动跟随 */
  function fly(btn) {
    if (!btn) return;
    var host = btn.querySelector(ICON_SEL) || btn;
    var old = host.querySelector('.' + FLY_CLS);   /* 动画中再翻转：先清旧再发新 */
    if (old) old.remove();
    host.classList.add(HOST_CLS);
    var span = document.createElement('span');
    span.className = FLY_CLS;
    span.style.left = (1 + ORIGIN.dx) + 'px';
    span.style.top = (1 + ORIGIN.dy) + 'px';
    host.appendChild(span);
    var done = function () {
      span.remove();
      host.classList.remove(HOST_CLS);
      span.removeEventListener('animationend', done);
    };
    span.addEventListener('animationend', done);
    setTimeout(done, DONE_FALLBACK_MS);           /* 兜底：animationend 万一不回来 */
  }

  /* ---------- 触发：类翻转 未赞(btn-liking) → 已赞(btn-likd) ---------- */

  var lastLiked = new WeakMap();   /* 每个按钮上次是否已赞；undefined = 首见 */

  function isLiked(btn) { return btn.classList.contains('btn-likd'); }

  function record(btn) { lastLiked.set(btn, isLiked(btn)); }

  function scan() {
    Array.prototype.slice.call(document.querySelectorAll(BTN_SEL)).forEach(record);
  }

  function onMutate(ms) {
    ms.forEach(function (m) {
      /* 新按钮后到（懒渲染 / 动态插入）：先登记初始态，否则它的第一次类变化
       * 会被当成「首见」而漏掉一次真实点赞 */
      if (m.type === 'childList') {
        Array.prototype.slice.call(m.addedNodes || []).forEach(function (n) {
          if (!n || n.nodeType !== 1) return;
          if (n.matches && n.matches(BTN_SEL)) record(n);
          if (n.querySelectorAll) Array.prototype.slice.call(n.querySelectorAll(BTN_SEL)).forEach(record);
        });
        return;
      }
      var btn = m.target;
      if (!btn || !btn.classList || !btn.classList.contains('btn-like')) return;
      var was = lastLiked.get(btn);
      var now = isLiked(btn);
      lastLiked.set(btn, now);
      if (was === undefined) return;              /* 首见只记录，不触发 */
      if (!was && now) fly(btn);                  /* 仅点赞方向；取消不触发 */
    });
  }

  function start() {
    injectStyle();
    scan();
    if (!document.body) return;
    new MutationObserver(onMutate).observe(document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  /* 调试/探针面（jsdom 回归与真机排查用） */
  api.__fly = fly;
  api.__start = start;
  global.LC_likeFx = api;
})(typeof window !== 'undefined' ? window : globalThis);
