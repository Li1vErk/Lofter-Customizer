/* ============================================================
 * lc-uid.js — 「当前登录的是谁」+ 本地名单按账号分桶
 * ============================================================
 * 背景（2026-11-13 探针取证 tools/probe-current-user.js）：
 *   · 首页/标签页/评论 iframe（www.lofter.com）上，三个全局对象都给出
 *     `userId=2165070853` / `blogName=3yell6w`：
 *       window.lofterGlobalSignInUser / window.userSignedIn / window.blogName+userId
 *   · 子域页（xxx.lofter.com）**一个都没有**，只有一个坏掉的
 *     `window.__userIdCrossDomain === "NaN"`。子域名在那儿是「博主」不是「访客」，
 *     所以子域页永远不能当身份来源。
 *   · 过滤的生效范围只有 home / tag / comment，三处都在 www 域
 *     （评论 iframe 就是 www.lofter.com/comment.do）⇒ 够用。
 *
 * 所以本模块干两件事：
 *   ① 采集：从 www 页面的全局对象里读 uid，写进 lc_uid_v1 缓存；
 *      子域页 / popup 读不到全局就读缓存。**未登录不清缓存** —— 退出登录后
 *      还在首页逛，之前设的屏蔽得继续生效。
 *   ② 分桶：filter.buckets[<userId>] = { tags, users, keywords }。
 *      按 userId（数字主键）分，不按 blogName（子域名可以改，改了名单就"丢"）。
 *      开关（enabled / scope / showCounter）留在 filter 顶层 —— 那是
 *      「这台机器怎么表现」，不该跟着账号变。
 *
 * 老数据迁移：filter.tags / users / keywords 这三份平铺数组先搬进「匿名桶」，
 * 等第一次拿到 uid 且该账号的桶还是空的，再把匿名桶认领过来。先搬后认领
 * 这两步都是幂等的，多帧同时跑结果一样。
 * ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (window.LCUid) return;

  var CACHE_KEY = "lc_uid_v1";
  var ANON = "_anonymous";
  var KINDS = ["tags", "users", "keywords"];

  /* 采集结果（本帧内存态） */
  var cur = { uid: "", blogName: "", done: false, from: "" };
  var listeners = [];
  var polling = false;

  /* ---------------- 纯函数 ---------------- */

  /* 从「像 window 的对象」里取身份。只认数字 userId ——
   * `__userIdCrossDomain` 在子域页上等于 "NaN"，不是数字，天然被挡掉。 */
  function pick(w) {
    w = w || window;
    var cands = [];
    try {
      if (w.lofterGlobalSignInUser) cands.push(w.lofterGlobalSignInUser);
    } catch (e) {}
    try {
      if (w.userSignedIn) cands.push(w.userSignedIn);
    } catch (e2) {}
    cands.push(w); /* 首页上 window.blogName / window.userId 是顶层变量 */
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

  function bucketKey(uid) {
    return uid ? String(uid) : ANON;
  }

  function buckets(filter) {
    if (!filter || typeof filter !== "object") return {};
    if (!filter.buckets || typeof filter.buckets !== "object" || Array.isArray(filter.buckets)) {
      filter.buckets = {};
    }
    return filter.buckets;
  }

  /* 取（必要时建）某个桶，并保证三个字段都是数组 */
  function ensureBucket(filter, uid) {
    var all = buckets(filter);
    var k = bucketKey(uid);
    var b = all[k];
    if (!b || typeof b !== "object" || Array.isArray(b)) b = all[k] = {};
    for (var i = 0; i < KINDS.length; i++) {
      if (!Array.isArray(b[KINDS[i]])) b[KINDS[i]] = [];
    }
    return b;
  }

  /* 老数据迁移（幂等）：
   * ① 平铺的 tags/users/keywords → 匿名桶（只在桶里还没有内容时搬，绝不覆盖）
   * ② 拿到 uid 后，若该账号的桶是空的，把匿名桶认领过来（老用户升级后
   *    第一次登录看到的就是自己原来的名单，不会"设置全没了"） */
  function migrate(filter, uid) {
    if (!filter || typeof filter !== "object") return false;
    var changed = false;
    var anon = ensureBucket(filter, "");
    for (var i = 0; i < KINDS.length; i++) {
      var k = KINDS[i];
      var old = filter[k];
      if (!Array.isArray(old)) continue;
      if (old.length && !anon[k].length) {
        anon[k] = old.slice();
        changed = true; /* 只有真搬了东西才值得写盘：空数组删掉不算变更，
                          否则「加载即将迁移」会把默认值当变更写回存储 */
      }
      /* 老字段删掉：留着会被当成「当前名单」读，单一口径才不会双写 */
      delete filter[k];
    }
    if (uid) {
      var mine = ensureBucket(filter, uid);
      for (var j = 0; j < KINDS.length; j++) {
        var kk = KINDS[j];
        if (!mine[kk].length && anon[kk].length) {
          mine[kk] = anon[kk].slice();
          anon[kk] = [];
          changed = true;
        }
      }
    }
    return changed;
  }

  /* 导入老备份专用：把平铺名单**覆盖**进当前账号的桶。
   * 和 migrate 的区别：migrate 只补空桶（升级场景，宁可不动用户的现状），
   * 导入的语义却是「按这一份覆盖」，所以这里直接盖。
   * 只认**非空**数组：1.13 起导出的文件里带着 `tags: []` 这种默认值空壳，
   * 拿空数组去盖会把对方自己的名单清掉 —— 分享场景正好踩这条。 */
  function adoptFlat(filter, uid) {
    if (!filter || typeof filter !== "object") return false;
    var who = uid === undefined ? cur.uid : uid;
    var mine = ensureBucket(filter, who);
    var hit = false;
    for (var i = 0; i < KINDS.length; i++) {
      var k = KINDS[i];
      if (!Array.isArray(filter[k])) continue;
      if (filter[k].length) {
        mine[k] = filter[k].slice();
        hit = true;
      }
      delete filter[k]; /* 老字段留着会被当成第二个真相源 */
    }
    migrate(filter, who);
    return hit;
  }

  /* 读：当前账号的名单（未登录 / 从没登录过 ⇒ 匿名桶） */
  function list(filter, kind) {
    var b = ensureBucket(filter, cur.uid);
    return b[kind] || [];
  }

  /* 一次性取三份，过滤主循环用 */
  function flat(filter) {
    var b = ensureBucket(filter, cur.uid);
    return { tags: b.tags, users: b.users, keywords: b.keywords };
  }

  /* ---------------- 缓存 ---------------- */

  function cacheGet(cb) {
    try {
      chrome.storage.local.get(CACHE_KEY, function (r) {
        cb((r && r[CACHE_KEY]) || null);
      });
    } catch (e) {
      cb(null);
    }
  }

  function remember(uid, blogName) {
    if (!uid) return;
    var payload = { uid: String(uid), blogName: String(blogName || ""), ts: Date.now() };
    cacheGet(function (c) {
      if (c && String(c.uid) === payload.uid && String(c.blogName || "") === payload.blogName) {
        return; /* 同值不写：每个页面帧都写一次会引发无谓的跨帧广播 */
      }
      try {
        var o = {};
        o[CACHE_KEY] = payload;
        chrome.storage.local.set(o);
      } catch (e) {}
    });
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](cur);
      } catch (e) {}
    }
  }

  /* 全局对象通常晚于 document_start 才定义 ⇒ 轮询一会儿。
   * 一旦读到就和缓存比：不同就写缓存并通知监听者重算（换号场景）。 */
  function watchGlobals(times) {
    if (polling) return;
    polling = true;
    var left = times == null ? 20 : times;
    (function tick() {
      var p = pick(window);
      if (p) {
        polling = false;
        if (p.uid !== cur.uid) {
          cur.uid = p.uid;
          cur.blogName = p.blogName;
          cur.from = "window";
          remember(p.uid, p.blogName);
          notify();
        } else if (p.blogName && p.blogName !== cur.blogName) {
          cur.blogName = p.blogName;
          remember(p.uid, p.blogName);
        }
        return;
      }
      if (left-- <= 0) {
        polling = false;
        return;
      }
      setTimeout(tick, 250);
    })();
  }

  /* 解析身份证：先同步看全局（www 页首屏就有），没有就读缓存，同时后台轮询全局 */
  function resolve(cb) {
    if (cur.done) {
      if (cb) cb(cur);
      return;
    }
    var p = pick(window);
    if (p) {
      cur.uid = p.uid;
      cur.blogName = p.blogName;
      cur.from = "window";
      cur.done = true;
      remember(p.uid, p.blogName);
      watchGlobals(4); /* 还有可能后续被改（同一页内换号） */
      if (cb) cb(cur);
      return;
    }
    cacheGet(function (c) {
      if (c && c.uid && /^\d{3,20}$/.test(String(c.uid))) {
        cur.uid = String(c.uid);
        cur.blogName = String(c.blogName || "");
        cur.from = "cache";
      }
      cur.done = true;
      watchGlobals(20); /* 5 秒内等全局出现；子域页等不到就静默结束 */
      if (cb) cb(cur);
    });
  }

  window.LCUid = {
    CACHE_KEY: CACHE_KEY,
    ANON: ANON,
    KINDS: KINDS,
    pick: pick,
    migrate: migrate,
    adoptFlat: adoptFlat,
    buckets: buckets,
    ensureBucket: ensureBucket,
    list: list,
    flat: flat,
    remember: remember,
    resolve: resolve,
    /* 调用方已经把缓存读出来了（popup 的首次 storage.get 一并读的），
     * 直接喂进来，省一次异步读 + 一次重渲染 */
    adopt: function (rec) {
      if (!rec || !/^\d{3,20}$/.test(String(rec.uid || ""))) return false;
      cur.uid = String(rec.uid);
      cur.blogName = String(rec.blogName || "");
      cur.from = "cache";
      cur.done = true;
      return true;
    },
    cur: function () {
      return cur;
    },
    uid: function () {
      return cur.uid;
    },
    blogName: function () {
      return cur.blogName;
    },
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
    },
    /* popup 用：缓存里那位的账号名（本地段头显示用） */
    label: function () {
      return cur.blogName || (cur.uid ? cur.uid : "未登录");
    },
    /* 测试用：重置本帧状态，别在业务代码里调 */
    _reset: function () {
      cur = { uid: "", blogName: "", done: false, from: "" };
      listeners = [];
      polling = false;
    },
  };
})();
