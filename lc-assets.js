/* lc-assets.js —— #20 大文件素材库（IndexedDB / Blob）
 *
 * 为什么需要：现状把图片 base64 塞进 chrome.storage.local —— 整个扩展共用一个 10MB 池，
 * 且 base64 膨胀 1.33× ⇒ 单文件实际 6–7MB 就写不进，且失败是静默的。本模块把大件搬到
 * **扩展 origin 的 IndexedDB**（存 Blob，无膨胀、配额按磁盘比例），settings 里只留一条
 * 引用字符串 `lcidb:<id>`。
 *
 * 实测依据（2026-10-15 真机，见 docs/idb-migration-plan.md §11.2）：
 *   · SW 里 IDB 存 Blob 与 ArrayBuffer 都通过（SHA-256 对拍）⇒ **选 Blob**（popup 侧免一次
 *     arrayBuffer() 读入、少一份内存副本）
 *   · `btoa` 一次性编码大数组必然爆栈（Maximum call stack size exceeded）⇒ **必须分块 8192**
 *   · `navigator.storage.estimate()` 不含 chrome.storage.local（两个配额池分开）
 *
 * 接入方式（关键）：manifest 的 background.service_worker 是 **classic worker（无 type:module）**
 *   ⇒ 只能用 importScripts，不能用 ES import ⇒ 本文件写成 IIFE 挂全局，SW 与 popup 共用同一份：
 *     background.js 顶部：importScripts('lc-assets.js');      → self.LCAssets
 *     popup.html  ：<script src="lc-assets.js"></script> 在 popup.js 之前
 *
 * 环境自律：SW **没有 DOM**，所以本文件顶层与所有函数内**不得触碰 window / document /
 *   createObjectURL / FileReader**（实测 SW 里 typeof FileReader 竟不是 undefined，但**不押注**）。
 *   字节 → URL 这一步在页面里做，不在本模块。
 *
 * 自检：node tools/test-idb-storage.js
 */
(function () {
  'use strict';

  var G = (typeof globalThis !== 'undefined') ? globalThis
    : (typeof self !== 'undefined') ? self
      : (typeof window !== 'undefined') ? window : this;

  var DB_NAME = 'lc-assets';
  var DB_VERSION = 1;
  var STORE = 'blobs';    /* keyPath: id；index: created */
  var LEGACY = 'legacy';  /* keyPath: id；迁移时留一份原 dataUrl（降级回退用，D6） */
  var REF_PREFIX = 'lcidb:';
  var B64_CHUNK = 8192;   /* 分块步长：实测 8192 安全（一次性编码必爆栈） */

  /* ── 单件上限（**单一真相源**，popup 写侧与 background 读侧都必须引用这两个值）──
   * 依据：runtime.sendMessage 硬顶 64MiB（实测 62MB 过 / 64MB 抛），base64 膨胀 1.33×
   *   ⇒ 理论天花板 ≈ 46MB。真机实测（2026-10-15）：23.3MB 全链路可用 ✅ / 24.6MB 超限。
   * 取 24MB 是「性能 + 场景」双重理由的保守值：8MB 全链路 371ms、23MB 约 1s，
   *   再翻倍会让每次页面加载明显卡顿；而 GIF 背景图到 23MB 已是极端场景。
   * 对外口径统一说「单张 ≤ 23MB」（MAX_MB）。 */
  var MAX_BYTES = 24 * 1024 * 1024;
  var MAX_MB = 23;

  /* id 形态：img_1750000000000_a3f9k2 / aud_...（时间戳 10–16 位 + 6 位 36 进制随机） */
  var ID_RE = /^(?:img|aud)_[0-9]{10,16}_[a-z0-9]{4,8}$/;

  /* ────────────────────────── 引用格式（纯函数） ────────────────────────── */

  function isRef(v) {
    return typeof v === 'string' && v.slice(0, REF_PREFIX.length) === REF_PREFIX;
  }
  function makeRef(id) { return REF_PREFIX + id; }
  function idOf(v) { return isRef(v) ? v.slice(REF_PREFIX.length) : null; }

  /* 白名单守卫：background 中继收到 id 必须先过这里（防越权/畸形 id 拼进 IDB key） */
  function isValidId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 64 && ID_RE.test(id);
  }
  /* 引用字符串直接取 id 并校验（中继入口用这个，一步到位） */
  function idFromRef(ref) {
    var id = idOf(ref);
    return (id && isValidId(id)) ? id : null;
  }

  function rand36(n) {
    var s = '';
    while (s.length < n) s += Math.random().toString(36).slice(2);
    return s.slice(0, n);
  }
  /* kind: 'img'（默认）| 'aud' */
  function newId(kind) {
    var k = (kind === 'aud' || kind === 'audio') ? 'aud' : 'img';
    return k + '_' + Date.now() + '_' + rand36(6);
  }

  /* ────────────────────────── 字节 / base64（纯函数） ────────────────────────── */

  /* 照抄 background.js:65-70 的既有手法（分块 + String.fromCharCode.apply + btoa） */
  function bytesToB64(bytes, step) {
    var s = step || B64_CHUNK;
    var bin = '';
    for (var i = 0; i < bytes.length; i += s) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + s));
    }
    return G.btoa(bin);
  }
  function b64ToBytes(str) {
    var bin = G.atob(str);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* 老 dataUrl → Blob（B2 迁移用）。只认 base64 形态 —— 本插件的 readFile 只产出这种 */
  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    var i = dataUrl.indexOf(',');
    if (i < 0) return null;
    var head = dataUrl.slice(0, i);
    if (!/;base64$/i.test(head)) return null;
    var m = /^data:([^;,]*)/.exec(head);
    var type = (m && m[1]) || 'application/octet-stream';
    try { return new G.Blob([b64ToBytes(dataUrl.slice(i + 1))], { type: type }); }
    catch (e) { return null; }
  }
  /* Blob → base64 dataUrl（B3 导出内嵌用） */
  function blobToDataUrl(blob) {
    if (!blob || typeof blob.arrayBuffer !== 'function') return Promise.reject(new Error('not a blob'));
    return blob.arrayBuffer().then(function (ab) {
      return 'data:' + (blob.type || 'application/octet-stream') + ';base64,'
        + bytesToB64(new Uint8Array(ab), B64_CHUNK);
    });
  }

  /* ────────────────────────── IDB 连接 ────────────────────────── */

  var _db = null, _opening = null;

  function isSupported() {
    try { return !!G.indexedDB; } catch (e) { return false; }
  }

  function open() {
    if (_db) return Promise.resolve(_db);
    if (_opening) return _opening;
    if (!isSupported()) return Promise.reject(new Error('indexedDB unavailable'));

    _opening = new Promise(function (res, rej) {
      var req;
      try { req = G.indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { _opening = null; rej(e); return; }

      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var st = db.createObjectStore(STORE, { keyPath: 'id' });
          st.createIndex('created', 'created', { unique: false });
        }
        if (!db.objectStoreNames.contains(LEGACY)) db.createObjectStore(LEGACY, { keyPath: 'id' });
      };
      req.onsuccess = function () { _db = req.result; _opening = null; res(_db); };
      req.onerror = function () { _opening = null; rej(req.error || new Error('open failed')); };
      /* 别的上下文还开着旧版本连接时会 blocked —— 必须如实报错，不能当成功 */
      req.onblocked = function () { _opening = null; rej(new Error('open blocked')); };
    });
    return _opening;
  }

  function close() {
    if (_db) { try { _db.close(); } catch (e) {} }
    _db = null;
    _opening = null;
  }

  /* 单 store 事务小工具：fn(store, res) —— 事务 complete 时 res(value) */
  function withTx(names, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t;
        try { t = db.transaction(names, mode); }
        catch (e) { rej(e); return; }
        var box = { value: null };
        var done = false;
        function fin() { if (!done) { done = true; res(box.value); } }
        t.oncomplete = fin;
        t.onerror = function () { if (!done) { done = true; rej(t.error || new Error('tx error')); } };
        t.onabort = function () { if (!done) { done = true; rej(t.error || new Error('tx aborted')); } };
        try { fn(t, box); } catch (e) { if (!done) { done = true; rej(e); } }
      });
    });
  }

  /* ────────────────────────── blobs 存取 ────────────────────────── */

  /* meta: { type, size, w, h }（w/h 由 popup 压缩阶段顺手带出，可省一次解码） */
  function putBlob(id, blob, meta) {
    if (!isValidId(id)) return Promise.reject(new Error('bad id: ' + id));
    if (!blob || typeof blob !== 'object') return Promise.reject(new Error('no blob'));
    /* 写侧体积守卫（纵深防御，不是可省的第一道）：
       2026-10-15 真机踩到 —— 24.6MB 时只有读侧（background）拦，于是 popup 照样把
       Blob 写进 IDB：磁盘上留一条**永远读不出来的孤儿记录**，页面图不显示，而且
       用户收不到任何提示（面板只统计 storage.local，也看不见它）。写侧拦掉即可根治。 */
    if (typeof blob.size === 'number' && blob.size > MAX_BYTES) {
      var e = new Error('too large: ' + blob.size);
      e.code = 'TOO_LARGE';
      e.size = blob.size;
      e.maxBytes = MAX_BYTES;
      e.maxMb = MAX_MB;
      return Promise.reject(e);
    }
    meta = meta || {};
    return withTx(STORE, 'readwrite', function (t) {
      t.objectStore(STORE).put({
        id: id,
        blob: blob,
        type: meta.type || blob.type || '',
        size: meta.size || blob.size || 0,
        w: meta.w || 0,
        h: meta.h || 0,
        created: Date.now(),
      });
    }).then(function () { return id; });
  }

  /* 读整条记录（含 Blob）。id 非法 ⇒ undefined（不发事务） */
  function getRecord(id) {
    if (!isValidId(id)) return Promise.resolve(undefined);
    return withTx(STORE, 'readonly', function (t, box) {
      var rq = t.objectStore(STORE).get(id);
      rq.onsuccess = function () { box.value = rq.result || undefined; };
    });
  }

  /* 只要字节 → base64（background 中继用；SW 侧唯一的取值路径） */
  function getAsDataUrl(id) {
    return getRecord(id).then(function (rec) {
      if (!rec || !rec.blob) return null;
      return blobToDataUrl(rec.blob);
    });
  }

  function listIds() {
    return withTx(STORE, 'readonly', function (t, box) {
      var rq = t.objectStore(STORE).getAllKeys();
      rq.onsuccess = function () { box.value = rq.result || []; };
    });
  }

  /* 轻量元数据（不带 Blob）—— 占用面板 / 孤儿对账用 */
  function listMeta() {
    return withTx(STORE, 'readonly', function (t, box) {
      var out = [];
      var rq = t.objectStore(STORE).openCursor();
      rq.onsuccess = function () {
        var c = rq.result;
        if (!c) { box.value = out; return; }
        var v = c.value || {};
        out.push({ id: v.id, type: v.type, size: v.size, w: v.w, h: v.h, created: v.created });
        c.continue();
      };
    });
  }

  /* 删一件：blobs + legacy 一个事务里一起删（不留半条） */
  function del(id) {
    if (!isValidId(id)) return Promise.resolve(false);
    return withTx([STORE, LEGACY], 'readwrite', function (t) {
      t.objectStore(STORE).delete(id);
      t.objectStore(LEGACY).delete(id);
    }).then(function () { return true; });
  }

  /* ────────────────────────── legacy 兜底（D6） ────────────────────────── */

  function putLegacy(id, dataUrl) {
    if (!isValidId(id) || typeof dataUrl !== 'string') return Promise.reject(new Error('bad legacy put'));
    return withTx(LEGACY, 'readwrite', function (t) {
      t.objectStore(LEGACY).put({ id: id, dataUrl: dataUrl });
    });
  }
  function getLegacy(id) {
    if (!isValidId(id)) return Promise.resolve(undefined);
    return withTx(LEGACY, 'readonly', function (t, box) {
      var rq = t.objectStore(LEGACY).get(id);
      rq.onsuccess = function () { box.value = rq.result ? rq.result.dataUrl : undefined; };
    });
  }
  function countLegacy() {
    return withTx(LEGACY, 'readonly', function (t, box) {
      var rq = t.objectStore(LEGACY).count();
      rq.onsuccess = function () { box.value = rq.result || 0; };
    });
  }
  function purgeLegacy() {
    return withTx(LEGACY, 'readwrite', function (t) { t.objectStore(LEGACY).clear(); })
      .then(function () { return true; });
  }

  /* ────────────────────────── 统计（B3 占用面板） ────────────────────────── */

  function usageReport() {
    var out = { supported: isSupported(), usage: null, quota: null, idbUsage: null, count: null, bytes: null, error: null };
    var p = Promise.resolve();
    if (G.navigator && G.navigator.storage && G.navigator.storage.estimate) {
      p = p.then(function () {
        return G.navigator.storage.estimate().then(function (e) {
          out.usage = (e && typeof e.usage === 'number') ? e.usage : null;
          out.quota = (e && typeof e.quota === 'number') ? e.quota : null;
          /* indexedDB 桶是独立口径（实测）；没有就留 null，由面板如实降级展示 */
          out.idbUsage = (e && e.usageDetails && typeof e.usageDetails.indexedDB === 'number')
            ? e.usageDetails.indexedDB : null;
        }, function () {});
      });
    }
    return p.then(function () {
      return listMeta().then(function (m) {
        out.count = m.length;
        out.bytes = m.reduce(function (a, r) { return a + (r.size || 0); }, 0);
      }, function (e) { out.error = String(e && e.message || e); });
    }).then(function () { return out; });
  }

  /* 供 popup 自测/迁移用：清空整个素材库（不动 settings） */
  function clearAll() {
    return withTx([STORE, LEGACY], 'readwrite', function (t) {
      t.objectStore(STORE).clear();
      t.objectStore(LEGACY).clear();
    }).then(function () { return true; });
  }

  G.LCAssets = {
    /* 常量 */
    DB_NAME: DB_NAME, DB_VERSION: DB_VERSION, STORE: STORE, LEGACY: LEGACY,
    REF_PREFIX: REF_PREFIX, B64_CHUNK: B64_CHUNK,
    MAX_BYTES: MAX_BYTES, MAX_MB: MAX_MB,
    /* 引用格式 */
    isRef: isRef, makeRef: makeRef, idOf: idOf, isValidId: isValidId, idFromRef: idFromRef, newId: newId,
    /* 编码 */
    bytesToB64: bytesToB64, b64ToBytes: b64ToBytes,
    dataUrlToBlob: dataUrlToBlob, blobToDataUrl: blobToDataUrl,
    /* 连接 */
    isSupported: isSupported, open: open, close: close,
    /* blobs */
    putBlob: putBlob, getRecord: getRecord, getAsDataUrl: getAsDataUrl,
    listIds: listIds, listMeta: listMeta, del: del, clearAll: clearAll,
    /* legacy */
    putLegacy: putLegacy, getLegacy: getLegacy, countLegacy: countLegacy, purgeLegacy: purgeLegacy,
    /* 统计 */
    usageReport: usageReport,
  };
})();
