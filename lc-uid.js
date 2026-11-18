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
 *      子域页 / popup 读不到全局就读缓存。
 *      **但 content script 读不到页面全局**（isolated world，2026-11-14 真机
 *      暴露）：`lc-uid-main.js` 以 world:MAIN 注入，把身份写到
 *      `<html data-lc-uid data-lc-blog>` 上，这里再从 DOM 读 —— 见 pickAny()。
 *   ② 分桶：filter.buckets[<userId>] = { tags, users, keywords }。
 *      按 userId（数字主键）分，不按 blogName（子域名可以改，改了名单就"丢"）。
 *      开关（enabled / scope / showCounter）留在 filter 顶层 —— 那是
 *      「这台机器怎么表现」，不该跟着账号变。
 *
 * 「未登录」是第二个身份（2026-11-14 作者拍板 A 方案）：
 *   退出登录后不能继续沿用上一个账号的桶 —— 那样面板上摊着别人的关键词，
 *   共用电脑时就是隐私问题。未登录＝匿名桶（`_anonymous`）。
 *   代价是退出登录后过滤暂停；作者实测「未登录时 LOFTER 任何页面都跳登录页，
 *   看不了任何内容」，所以这个代价实际为零。
 *   **缓存不删**：它还记着「上次是谁」，重新登录立刻切回去，1.14 的名单管理
 *   也要靠它显示「上次是哪个号」。
 *
 * 判定「未登录」只能靠**强证据**（URL 落在登录页）。光看 pick() 失败不行：
 * LOFTER 哪天改了全局变量名，所有登录用户都会 pick 失败，那时降级成匿名桶
 * 等于把所有人的名单清空 —— 一次改版就能造成「设置全丢」的灾难性回归。
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
  /* 缓存里那位（= 上次登录的账号）。**不是当前身份**，只在未登录时用于
     认领归属与「上次是哪个号」的显示 */
  var lastRec = null;
  var listeners = [];
  var polling = false;

  /* ---------------- 纯函数 ---------------- */

  /* 取 location。沙箱（自检）里 `window` 是普通对象、没有 location，
   * 所以两条路都试一遍，拿不到就返回 null 由调用方兜底 */
  function loc() {
    try {
      if (typeof location !== "undefined" && location) return location;
    } catch (e) {}
    try {
      if (window && window.location) return window.location;
    } catch (e2) {}
    return null;
  }

  function hostOf(s) {
    s = String(s || "");
    var m = /^[a-z]+:\/\/([^\/?#]+)/i.exec(s);
    return (m ? m[1] : s).replace(/:\d+$/, "").toLowerCase();
  }

  /* 过滤只在 www 域跑（home / tag / comment），子域页没有身份来源 */
  function isWww(x) {
    var h = hostOf(x == null ? (loc() && loc().hostname) || "" : x);
    return h === "www.lofter.com" || h === "lofter.com";
  }

  /* 登录页判定 —— 「确实没登录」的唯一强证据。
   * 作者 2026-11-14 实测：未登录时 LOFTER 任何页面（首页、tag、帖子、从历史
   * 记录点进去）都 302 到 /front/login，看不了任何内容。所以 URL 落在登录页
   * ＝ 没登录，可以放心降级；反过来说，**不在登录页就不要降级**（见文件头）。 */
  function isLoginPage(u) {
    var s;
    if (u == null) {
      var L = loc();
      s = L ? String(L.pathname || "") + String(L.search || "") : "";
    } else {
      s = String(u).replace(/^[a-z]+:\/\/[^\/?#]+/i, "");
    }
    return /(^|\/)(front\/)?log-?in(\/|$|\?|\.)/i.test(s.split("#")[0]);
  }

  /* 从「像 window 的对象」里取身份。只认数字 userId ——
   * `__userIdCrossDomain` 在子域页上等于 "NaN"，不是数字，天然被挡掉。 */
  function pick(w) {    w = w || window;
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

  /* 从 DOM 上读身份（由 world:MAIN 的 lc-uid-main.js 写入）。
   * 这是 content script **唯一**能拿到真实身份的通道 —— 隔离世界的
   * `window` 上没有 LOFTER 的全局变量。DOM 是两个世界共享的。 */
  function pickFromDom() {
    var h = null;
    try {
      h = document.documentElement;
    } catch (e) {}
    if (!h || !h.getAttribute) return null;
    var uid = "";
    var name = "";
    try {
      uid = String(h.getAttribute("data-lc-uid") || "").trim();
      name = String(h.getAttribute("data-lc-blog") || "").trim();
    } catch (e2) {
      return null;
    }
    if (!/^\d{3,20}$/.test(uid)) return null;
    return { uid: uid, blogName: name };
  }

  /* 统一的身份读取：先看全局（主世界 / 测试环境），再看 DOM 桥。
   * - content script：全局那条永远落空，走 DOM
   * - popup：`document` 是自己的页面，属性不存在；它另走 lcWhoAmI 问当前帧
   * - 自检：两条都能喂 */
  function pickAny() {
    var p = pick(window);
    if (p) {
      p.from = "window";
      return p;
    }
    var d = pickFromDom();
    if (d) {
      d.from = "dom";
      return d;
    }
    return null;
  }

  function bucketKey(uid) {
    return uid ? String(uid) : ANON;
  }

  /* 去重键：用户名单里存的是 {id, name}，tag / 关键词是字符串 */
  function keyOf(x) {
    if (x && typeof x === "object") {
      return "id:" + String(x.id == null ? "" : x.id) + "|" + String(x.name == null ? "" : x.name);
    }
    return "s:" + String(x == null ? "" : x);
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
        var a = anon[kk];
        if (!a.length) continue;
        /* **并集去重**，不是「空桶才认领」：匿名桶在登录态下理论上是空的，
         * 还留着内容只有一种可能 —— 上次登出期间（走匿名桶）加的条目。
         * 那时该账号的桶往往已经有内容，按「空桶才认领」会把这些条目静默
         * 丢掉，用户看到的是「我明明加过，怎么没了」。
         * 反向代价（共用电脑时别人在未登录态加的也被认领）远小于静默丢数据。 */
        if (!mine[kk].length) {
          mine[kk] = a.slice();
        } else {
          var seen = Object.create(null);
          for (var s1 = 0; s1 < mine[kk].length; s1++) seen[keyOf(mine[kk][s1])] = 1;
          for (var s2 = 0; s2 < a.length; s2++) {
            var kb = keyOf(a[s2]);
            if (!seen[kb]) {
              seen[kb] = 1;
              mine[kk].push(a[s2]);
            }
          }
        }
        anon[kk] = [];
        changed = true;
      }
    }
    return changed;
  }

  /* 空桶裁剪：`ensureBucket` 在**读路径**上也会建桶（打开面板、判断 tag 页按钮
   * 状态），所以「从没设过屏蔽的账号」也会留下 {tags:[],users:[],keywords:[]}
   * 的空壳。攒几个号就会让「本机几份名单」虚高、管理界面一排 0 条。
   * 保存前剪掉它们 —— 但**当前账号的桶保留**：读路径随时会再建，删了只会让每次
   * 读都重建一遍，没有收益。返回删掉的桶数（自检用）。 */
  function prune(filter) {
    if (!filter || typeof filter !== "object") return 0;
    var all = buckets(filter);
    var keep = bucketKey(cur.uid);
    var n = 0;
    for (var k in all) {
      if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
      if (k === keep) continue;
      var b = all[k];
      var empty = true;
      if (b && typeof b === "object" && !Array.isArray(b)) {
        for (var i = 0; i < KINDS.length; i++) {
          if (Array.isArray(b[KINDS[i]]) && b[KINDS[i]].length) {
            empty = false;
            break;
          }
        }
      }
      if (empty) {
        delete all[k];
        n++;
      }
    }
    return n;
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

  /* ---------------- #41 本机名单管理 ---------------- */

  /* 桶里额外记两个下划线字段（都不参与「空桶」判断，prune 只看三个数组）：
   *   `_blog` 账号名 —— 桶按 uid 分，但名字只有**登录那一刻**知道。
   *           不记下来，切到别的号就再也认不出「1790671747」是谁，
   *           管理界面只能显示一串数字。
   *   `_ts`   最后使用时间 —— 只在切号 / 打开面板时写，且与旧值差不到
   *           1 小时就不写：写 storage.local 会触发每个内容帧重算设置，
   *           纯展示字段不该有写放大。 */
  var TOUCH_MS = 3600 * 1000;

  function touch(filter, uid, blogName, now) {
    if (!filter || typeof filter !== "object") return false;
    var who = uid === undefined ? cur.uid : uid;
    var name = blogName === undefined ? cur.blogName : blogName;
    var b = ensureBucket(filter, who);
    var changed = false;
    if (name && b._blog !== name) {
      b._blog = String(name);
      changed = true;
    }
    var t = now || Date.now();
    if (t - (Number(b._ts) || 0) >= TOUCH_MS) {
      b._ts = t;
      changed = true;
    }
    return changed;
  }

  /* 本机有哪些名单（管理界面用）。只列**有内容**的桶，加一个例外：
   * 已登录时的当前账号 —— 哪怕 0 条也列（「我的名单去哪了」比「一排 0 条」更让人慌）。
   * **未登录时的匿名桶不享受这个例外**（2026-11-16 作者拍板）：用户眼里
   * 「没登录 ＝ 没账号」，列一行「未登录时 0 条」纯属噪音（它是个内部概念）。
   * 但匿名桶真有条目时必须列：那些词此刻正在过滤，不给入口就没地方清。
   * 顺序：当前账号 → 其余按最后使用倒序 → 匿名桶固定最后
   * （它不是"某个账号"，是"未登录那段时间"）。 */
  function entries(filter) {
    var all = buckets(filter);
    var keep = bucketKey(cur.uid);
    var out = [];
    for (var k in all) {
      if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
      var b = all[k];
      if (!b || typeof b !== "object" || Array.isArray(b)) continue;
      var n = 0;
      for (var i = 0; i < KINDS.length; i++) {
        n += Array.isArray(b[KINDS[i]]) ? b[KINDS[i]].length : 0;
      }
      /* 空桶不列。例外只给「已登录时的当前账号」（cur.uid 非空）——
       * 未登录时 keep 是匿名桶，它的空壳不该露脸 */
      if (!n && !(k === keep && cur.uid)) continue;
      out.push({
        key: k,
        uid: k === ANON ? "" : k,
        anon: k === ANON,
        current: k === keep,
        blog: typeof b._blog === "string" ? b._blog : "",
        ts: Number(b._ts) || 0,
        n: n,
      });
    }
    out.sort(function (x, y) {
      if (x.current !== y.current) return x.current ? -1 : 1;
      if (x.anon !== y.anon) return x.anon ? 1 : -1;
      return (y.ts || 0) - (x.ts || 0);
    });
    return out;
  }

  /* 删掉一个桶。调用方负责确认框与落盘 —— 这里只管数据结构 */
  function drop(filter, key) {
    var all = buckets(filter);
    if (!Object.prototype.hasOwnProperty.call(all, key)) return false;
    delete all[key];
    return true;
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

  /* 认一个身份（登录态）。notify 在里面统一发，调用方不用再发一次 */
  function setWho(rec, from) {
    if (!rec || !/^\d{3,20}$/.test(String(rec.uid || ""))) return false;
    var uid = String(rec.uid);
    var name = String(rec.blogName || "");
    var same = cur.uid === uid && cur.blogName === name && cur.done;
    cur.uid = uid;
    cur.blogName = name;
    cur.from = from || "window";
    cur.done = true;
    remember(uid, name);
    if (!same) notify();
    return true;
  }

  /* 降级成匿名身份（未登录）。缓存**不动** —— 它还记着上次是谁 */
  function setAnon(from) {
    var same = cur.uid === "" && cur.done && cur.from === (from || "anon");
    cur.uid = "";
    cur.blogName = "";
    cur.from = from || "anon";
    cur.done = true;
    if (!same) notify();
    return cur;
  }

  /* 全局对象通常晚于 document_start 才定义 ⇒ 轮询一会儿。
   * 一旦读到就和缓存比：不同就写缓存并通知监听者重算（换号场景）。 */
  function watchGlobals(times) {
    if (polling) return;
    polling = true;
    var left = times == null ? 20 : times;
    (function tick() {
      var p = pickAny();
      if (p) {
        polling = false;
        /* 从「匿名（登录页）」回到「有身份」也走第一条：登录页有可能不刷新
         * 就跳进站内（SPA），那时得自己恢复，否则一直是匿名桶 */
        if (p.uid !== cur.uid) {
          setWho(p, p.from || "page");
        } else if (p.blogName && p.blogName !== cur.blogName) {
          /* 只补名字，不用空值把已记下的名字擦掉（LOFTER 有些页面上
           * blogName 是空的，uid 还在） */
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

  /* 解析身份证：先同步看全局（www 页首屏就有），没有再看是不是登录页，
   * 都不是才退回缓存，同时后台轮询全局 */
  function resolve(cb) {
    if (cur.done) {
      if (cb) cb(cur);
      return;
    }
    var p = pickAny();
    if (p) {
      setWho(p, p.from || "page");
      remember(p.uid, p.blogName);
      watchGlobals(4); /* 还有可能后续被改（同一页内换号） */
      if (cb) cb(cur);
      return;
    }
    /* 强证据：URL 在登录页 ⇒ 未登录。绝不看「pick 失败」就下结论（见文件头） */
    if (isLoginPage()) {
      setAnon("login");
      watchGlobals(20); /* 登录页不刷新就跳进站内时，自己恢复 */
      if (cb) cb(cur);
      return;
    }
    cacheGet(function (c) {
      if (c && c.uid && /^\d{3,20}$/.test(String(c.uid))) {
        lastRec = { uid: String(c.uid), blogName: String(c.blogName || "") };
        cur.uid = lastRec.uid;
        cur.blogName = lastRec.blogName;
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
    /* 真实的身份读取（全局 + DOM 桥）。content script 只能用这个 ——
     * `pick(window)` 在隔离世界里永远是 null */
    who: pickAny,
    pickFromDom: pickFromDom,
    migrate: migrate,
    adoptFlat: adoptFlat,
    prune: prune,
    buckets: buckets,
    ensureBucket: ensureBucket,
    list: list,
    flat: flat,
    /* #41：本机名单管理 */
    touch: touch,
    entries: entries,
    drop: drop,
    TOUCH_MS: TOUCH_MS,
    remember: remember,
    resolve: resolve,
    isWww: isWww,
    isLoginPage: isLoginPage,
    setWho: setWho,
    setAnon: setAnon,
    /* 缓存里那位（上次登录的账号）——不是当前身份 */
    last: function () {
      return lastRec ? { uid: lastRec.uid, blogName: lastRec.blogName || "" } : null;
    },
    /* 调用方已经把缓存读出来了（popup 的首次 storage.get 一并读的），
     * 直接喂进来，省一次异步读 + 一次重渲染。
     * 注意这只是「上次登录的账号」，popup 随后会向页面要一次实时身份
     * （lcWhoAmI）来确认现在还登着 —— 那份缓存可能在登出后仍然存在。 */
    adopt: function (rec) {
      if (!rec || !/^\d{3,20}$/.test(String(rec.uid || ""))) return false;
      lastRec = { uid: String(rec.uid), blogName: String(rec.blogName || "") };
      cur.uid = lastRec.uid;
      cur.blogName = lastRec.blogName;
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
    /* 当前身份的显示名：登录态给账号名（没名字给 uid），匿名给「未登录」。
     * 别再用 `blogName() || "未登录"` 自己拼 —— 那会把「登出但缓存还在」
     * 显示成未登录的同时又读着上个账号的名单，状态与数据源对不上 */
    label: function () {
      return cur.blogName || (cur.uid ? cur.uid : "未登录");
    },
    /* 测试用：重置本帧状态，别在业务代码里调 */
    _reset: function () {
      cur = { uid: "", blogName: "", done: false, from: "" };
      lastRec = null;
      listeners = [];
      polling = false;
    },
  };
})();
