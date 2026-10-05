/* ============================================================
 * lc-lpost-music.js — #15 长文章白噪音复活（MAIN world）
 * ============================================================
 * 形态（demo tools/demo-lpost-music.js 收编）：
 *   官方长文章发布页顶栏 ♫ 按钮 + 五项菜单（雷雨 / 大自然 / 水流 /
 *   鸟鸣 / 关闭白噪音）**UI 与播放逻辑都完整**，唯独四首音频硬编码引用
 *   `lofter.nosdn.127.net` —— 该域 **DNS 已不存在**（整个 nosdn.127.net
 *   域下线；同网络下 l.bst.126.net / s1.music.126.net / www.lofter.com
 *   均正常 → 非本地网络问题）。音频真身在 `lofter.lf127.net`，四首全部
 *   200（2016 年网易 NOS 原件、支持 Range；合计 ~37MB，故只在线引用、
 *   不打包）。
 *
 *   所以本模块的定位 = **修好官方已坏的功能**（与 #13 点赞飘心、lpost
 *   「只看作者」同性质），不是新增能力 → **无开关**。
 *
 * 为什么必须是 MAIN world
 * ------------------------------------------------------------
 *   官方是 `this.cmC.src = eyU; this.cmC.play()`（cmC = #music-bg），
 *   隔离世界改不到页面 JS 用的 prototype。项目已有先例：lc-draft-hook.js。
 *
 * 三件事
 * ------------------------------------------------------------
 *   ① 打桩 `HTMLMediaElement.prototype.src`：setter 内把死域透明换成活域，
 *      其余 URL 原样透传 → 官方代码零改动、零时序问题。
 *   ② 修正 HTML 写死的初始 attribute src —— `<audio src="//lofter.nosdn…">`
 *      是 **attribute**，不经 property setter，① 拦不到。
 *   ③ 默认项兜底 —— 官方 `chooseMusicType` 第一行是
 *      `if (hasClass(item,'selected')) return;`，而页面初始选中的恰是
 *      「雷雨」→ 打开页面直接点雷雨无声（官方 UX bug）。做法：菜单项 click
 *      后若 #music-bg 仍 paused，补一次 src + play。判定用**行为实证**
 *      （真的没在播才补），不猜官方分支 → 已在播 / 点「关闭」时不会重复触发。
 *
 * 为什么不做 URL 门禁（与 #13 的差异，理由）
 * ------------------------------------------------------------
 *   长文章发布入口不止一种（独立页 /blog/<user>/new/long/ + 站内弹窗），
 *   URL 形态未全量实证，漏判会导致**功能静默失效**；而全站打桩的代价
 *   等价于零行为 —— 替换条件精确到 `lofter.nosdn.127.net` 这个已不存在的
 *   域，其它页面根本不会出现该字符串。②③ 另有天然门禁（找不到
 *   `#music-bg` / `#menu-music` 就什么都不做）。
 *
 * 来源：官方实现与四曲目映射为 2026-10-05 反混淆公开 CDN
 *   https://l.bst.126.net/s/pt_page_longpost_publish.js（290KB）实读。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 常量与纯函数面（jsdom 测试面） ---------- */

  var DEAD_HOST = 'lofter.nosdn.127.net';
  var LIVE_HOST = 'lofter.lf127.net';
  var BASE = '//' + LIVE_HOST + '/longpost/music/';
  var MENU_SEL = '#menu-music';
  var ITEM_SEL = '#menu-music .item';
  var AUDIO_ID = 'music-bg';

  /* type → 文件（官方脚本里的四个 URL 常量 eyU..eyX 实读） */
  var BY_TYPE = {
    '1': BASE + '4thunderstorm.m4a',   /* 雷雨 */
    '2': BASE + '1lake.m4a',           /* 大自然 */
    '3': BASE + '2water.m4a',          /* 水流 */
    '4': BASE + '3bird.mp3'            /* 鸟鸣 */
  };
  /* 兜底识别用（官方若改掉 inline onclick 时的后备通道） */
  var BY_ICON = {
    'icon-music-rain': '1',
    'icon-music-nature': '2',
    'icon-music-water': '3',
    'icon-music-bird': '4',
    'icon-music-close': '0'
  };

  /* 死域 → 活域；非字符串或无关 URL 原样透传 */
  function fixUrl(v) {
    return (typeof v === 'string' && v.indexOf(DEAD_HOST) !== -1)
      ? v.split(DEAD_HOST).join(LIVE_HOST) : v;
  }

  /* 菜单项 → type：优先抠 inline onclick，其次 icon 类名，再次 close 项 id */
  function typeOf(item) {
    if (!item) return '';
    var m = /chooseMusicType\s*\(\s*this\s*,\s*['"](\d)['"]/.exec(item.getAttribute('onclick') || '');
    if (m) return m[1];
    if (item.id === 'music-item-close') return '0';
    var ic = item.querySelector('span.icon');
    if (ic) {
      var cls = ' ' + (ic.className || '') + ' ';
      for (var k in BY_ICON) {
        if (Object.prototype.hasOwnProperty.call(BY_ICON, k) &&
            cls.indexOf(' ' + k + ' ') !== -1) return BY_ICON[k];
      }
    }
    return '';
  }

  var api = {
    DEAD_HOST: DEAD_HOST,
    LIVE_HOST: LIVE_HOST,
    BASE: BASE,
    BY_TYPE: BY_TYPE,
    BY_ICON: BY_ICON,
    MENU_SEL: MENU_SEL,
    ITEM_SEL: ITEM_SEL,
    AUDIO_ID: AUDIO_ID,
    fixUrl: fixUrl,
    typeOf: typeOf,
  };

  /* Node（无 location）：只导出纯函数面给回归用 */
  var isNode = typeof location === 'undefined';
  if (isNode) {
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    return;
  }

  if (window.__lcLpostMusic) return;          /* 幂等：多入口注入只跑一次 */
  window.__lcLpostMusic = true;

  /* ---------- ① 打桩 src setter ---------- */

  var mediaProto = global.HTMLMediaElement && global.HTMLMediaElement.prototype;
  var patched = false;
  (function patchSrc() {
    if (!mediaProto) return;
    var d = Object.getOwnPropertyDescriptor(mediaProto, 'src');
    if (!d || typeof d.set !== 'function' || !d.configurable) return;
    try {
      Object.defineProperty(mediaProto, 'src', {
        configurable: true,
        enumerable: d.enumerable,
        get: d.get,
        set: function (v) { return d.set.call(this, fixUrl(v)); }
      });
      patched = true;
    } catch (e) { patched = false; }
  })();

  /* ---------- ② 修正 HTML 写死的初始 attribute src ---------- */

  function scanAttrs() {
    var list = document.querySelectorAll('audio');
    for (var i = 0; i < list.length; i++) {
      var v = list[i].getAttribute('src');
      if (v && v.indexOf(DEAD_HOST) !== -1) {
        list[i].setAttribute('src', v.split(DEAD_HOST).join(LIVE_HOST));
      }
    }
  }

  /* ---------- ③ 默认项兜底（官方对已选中项直接 return） ---------- */

  function onClick(e) {
    var t = e.target;
    var item = (t && t.closest) ? t.closest(ITEM_SEL) : null;
    if (!item) return;
    var type = typeOf(item);
    if (!type) return;
    /* 延到官方 inline handler 之后再看结果 */
    setTimeout(function () {
      if (type === '0') return;                 /* 关闭：官方已 pause */
      var a = document.getElementById(AUDIO_ID);
      if (!a || !a.paused) return;              /* 已在播：官方路径正常 */
      var url = BY_TYPE[type];
      if (!url) return;
      try {
        a.src = url;
        var p = a.play();
        if (p && p.catch) p.catch(function () { /* 自动播放被拒等 → 静默 */ });
      } catch (err) { /* ignore */ }
    }, 0);
  }

  /* ---------- 启动 ---------- */

  function start() {
    scanAttrs();
    document.addEventListener('click', onClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  /* 调试/排查面（真机控制台用；同时也是回归入口） */
  api.__state = function () {
    var a = document.getElementById(AUDIO_ID);
    return {
      patched: patched,
      audioFound: !!a,
      src: a ? a.src : null,
      alive: a ? String(a.src).indexOf(LIVE_HOST) !== -1 : null,
      paused: a ? a.paused : null
    };
  };
  api.__start = start;
  global.LC_lpostMusic = api;
})(typeof window !== 'undefined' ? window : globalThis);
