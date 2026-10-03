/* ============================================================
 * lc-draft.js — #12 B-lite「编辑防丢兜底」正式版
 * ============================================================
 * 形态（demo 真机验收通过后收编，tools/demo-draft-guard.js）：
 *   快照/恢复逻辑只在普通文章编辑器帧（lofter.lf127.net/…/pc-publish.html）
 *   运行——demo 实证正文只存在这一帧的 .ProseMirror 里，标题/tag 在
 *   父帧（哈希类区，走官方草稿兜底）；top 帧只挂状态徽标（见下）；
 *   其它子帧静默退出。
 *
 *   · 变更检测（2026-10-03 真机探针修正）：**以 .ProseMirror 的 DOM 变更
 *     为准**（MutationObserver），input 事件只作快路径补充。原因：ProseMirror
 *     对 Backspace/Delete（尤其带选区）在 keydown 里 preventDefault 后自改
 *     DOM，**根本不派发 input** —— 只监听 input 会让「删掉一整段」这一拍
 *     永不落盘（tools/probe-delete-trigger.js 实证：删除全程只有 keydown +
 *     mutation，无 beforeinput / input）。节流 ≤2s 一拍、最快 0.8s 补拍；
 *     净字数突变时**立即落拍**不等节流。快照写 chrome.storage.local
 *     （键 lc_draft_snap_v1，**分层时间轴约 30 版 / 覆盖约 20 分钟**，
 *     14 天过期自动清）——纯本地写入，断网照常工作；
 *   · 快照历史入口：空白带左下常驻 pill「快照历史 · N ▾」→ 向上弹出
 *     面板（相对时间 · 字数 · 与当前差值，与当前正文一致的那版标
 *     「当前」），每行可富文本复制；面板头部可「钉住当前版」（手动钉版：
 *     不参与时间窗折叠、不被自动清理）与「清空历史」。挂载方式经真机
 *     demo A/B 定稿为 **M1（editorHost 内绝对定位）**——随弹窗滚动自然
 *     跟随；M2（挂 body + 视口坐标）滚动后需持续重算、只差不好，弃用。
 *     入口与恢复浮条互斥（同占空白带左下角）；显示门槛 ≥2 版（1 版无
 *     历史可翻）。
 *   · pagehide（刷新/关页瞬间）兜一次最终快照：sessionStorage 同步写
 *     兜住卸载竞态（打完字 <2s 就刷新时 chrome.storage 异步写可能丢），
 *     下次 boot 捞回合并；
 *   · 快照按文章隔离：文章键 = 保存接口 postId（fetch/XHR 钩子截获；
 *     拿到前用一次性临时键兜底、拿到后整体改挂），父帧经跨帧桥同步——
 *     旧方案按编辑器 URL 段分组，被实证该段是容器常量、已废弃；
 *   · 恢复判定：文章键就位后「本篇最新快照比当前内容新且不同」→
 *     postMessage 广播父帧出恢复浮条；内容追平后广播撤收；
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

  /* ================= 粘贴友好化（复制前翻译，jsdom 测试面） =================
   * 编辑器把 @ / 链接 / 图片包在自己的私有结构里
   * （<div class="v-popper…" contenteditable="false"> 包裹），快照 HTML 原样
   * 粘回时 ProseMirror 不认这种结构，会把包裹连同内容整体丢弃
   * （2026-10-03 真机粘贴实测：@ 连文字一起消失、图片粘不出来、链接退纯文字）。
   * 复制前翻译成通用形态，三类各自处理（翻译目标同样经真机实测校准）：
   *   a.caret-node        → 纯文本（@昵称至少留下来）
   *   .lofter-link-node   → 显示文字是网址时构造真 `<a href target="_blank">`
   *                         （PM 自家复制链接节点 = 标准 `<a>`，站内 `<a>` 粘回保留
   *                         为绿色链接、外链被降级；真机探针实证）；
   *                         填过链接文字时网址不在 DOM 里，输出标题纯文本
   *   .img-node           → 「[图片]」占位。裸 <img> 粘回 PM 收下但渲染空白，
   *                         含义不明；文字占位明确提示需手动重传
   * 纯函数语义：不改入参，返回新 HTML；没有私有结构时原样返回。 */
  function pasteFriendly(html) {
    if (!html) return '';
    if (!/[<][^>]*(v-popper|caret-node|lofter-link-node|img-node)/.test(String(html))) {
      return html;
    }
    var root = document.createElement('div');
    root.innerHTML = html;
    /* 把「元素所在的 v-popper 包裹」换成 replacement；找不到包裹就换元素本身 */
    function swap(inner, replacement) {
      var host = inner.closest('.v-popper') || inner;
      if (!host.parentNode) return;
      if (replacement) host.parentNode.replaceChild(replacement, host);
      else host.parentNode.removeChild(host);
    }
    /* @某人：a.caret-node 的 href 是 javascript:void(0)，真实指向在编辑器
     * 内部状态里，DOM 里拿不到 → 只保昵称文字 */
    Array.prototype.slice.call(root.querySelectorAll('a.caret-node')).forEach(function (a) {
      swap(a, document.createTextNode(String(a.textContent || '')));
    });
    /* 插入链接：网址不在 DOM（显示文字=链接文字，没填则是网址本身）。
     * 2026-10-03 探针（`probe-paste-html`）钉死形态：编辑器的粘贴解析认标准
     * `<a href target="_blank">`（手贴站内网址变绿、PM 自家复制链接节点输出同一形态）。
     * 站内 `<a>` 粘回会保留为链接，外链被 LOFTER 降级成文字（降级结果与纯文本无异）。
     * 所以：显示文字是网址 → 构造成真 `<a>`；填过链接文字的标题型网址不在 DOM，
     * 只能输出标题纯文本。
     * 链接文字里的空格 LOFTER 以字面 "&nbsp;" 文本存储（粘贴实测粘出字面实体），
     * 替换回正常空格 */
    var URL_SHAPE = /^(https?:\/\/)?[^\s/]+\.[a-z]{2,}([\/?#]\S*)?$/i;
    Array.prototype.slice.call(root.querySelectorAll('.lofter-link-node')).forEach(function (n) {
      var txt = String(n.textContent || '').replace(/&nbsp;/g, ' ').trim();
      if (!txt) { swap(n, null); return; }
      if (!URL_SHAPE.test(txt)) { swap(n, document.createTextNode(txt)); return; }
      var a = document.createElement('a');
      a.href = /^https?:\/\//i.test(txt) ? txt : 'https://' + txt;
      a.target = '_blank';
      a.textContent = txt;
      swap(n, a);
    });
    /* 图片：v-popper 包裹结构粘回必被丢弃，裸 <img> 也渲染成空白 →
     * 换成文字占位，明确告诉用户「这里曾有一张图，要手动重传」 */
    Array.prototype.slice.call(root.querySelectorAll('.img-node')).forEach(function (n) {
      swap(n, document.createTextNode('[图片]'));
    });
    return root.innerHTML;
  }
  /* 分层时间轴（#12 定稿）：为什么不是简单环形 —— SAVE_MIN_GAP=2000 把写入
   * 压成恒定 2s 一拍，RING=5 只覆盖最近 8s ≈ Ctrl+Z 的射程，救不了真实场景
   * 「删了、又写了五分钟才发现」。改成按年龄分四段位、各自配额：
   *   tier1  age < 10s     每拍都留（2s 间隔 → 5 版，≈10s）
   *   tier2  age < 320s    每 20s 一窗（窗内留最新一条），18 窗（≈5min）
   *   tier3  age < 24h     每 2min 一窗，10 窗（总纵深 ≈22min）
   *   tier4  age ≥ 24h     每 12h 一窗（每天 1–2 版），8 窗 → 天级纵深
   *                          （密集写每天 2 版 ≈ 4 天；一天一版 ≈ 8 天；
   *                          14 天过期是硬上限）
   *
   * 用「绝对时间窗」而不是「与最新一条的间隔」或「年龄窗」：两者都以会滚动
   * 的参照物为锚（前者每次写入重置锚、后者条目随年龄换桶），实测都退化成
   * 6 版 —— 旧条目永远等不到「活到」下一个档位就被同窗更新的一条挤掉。
   * 窗号取 floor(ts / bucket)（对时间取整，写死不变），一条快照终身属于
   * 它的窗，档位才立得住。另外「配额 × 窗宽」必须 > 该段位年龄跨度 + 两窗余量，
   * 否则条目还在本段位里就被挤出、升不到下一段位（踩过两次：15 窗 ×20s = 300s
   * 正好等于跨度 → 边界窗一出现就把最老那条挤掉；16 窗时窗距按「相对最新候选」
   * 计数，最老那条在年龄 300~320s 之间就被挤出 → tier3 一条都攒不起来）。
   * 取 cap = 跨度/窗宽 + 2。实测收敛值（tools/test-lc-draft.js 覆盖）：连续写作
   * 稳定 31 版 / 纵深 ≈22 分钟；写入稀疏时保留更早的时刻（每 5min 一版写
   * 100 分钟 → 12 版 / 纵深 55min）；跨会话（草稿页同 postId 重开）继续往
   * tier4 攒 → 「昨天 / 几小时前」的版本也翻得回来（2026-10-02 需求对齐：
   * 用户拍板 B 方案「抢救 + 跨会话天级」）。
   *
   * 另有两条独立于时间轴的保留机制：
   *   · 钉版（pin）：不受时间窗折叠、不占段位配额。分两类——
   *     ① 字数突变强制留版：一次净字数变化 ≥ JUMP_CHARS 时，把「突变后」
   *        与「突变前」**两版都钉住**——「选中一大段 → 删除」必留「删之前」
   *        那版，而它恰恰是最想找回的（2026-10-03 真机反馈 + 纯函数仿真）；
   *     ② 手动钉版（带 label）：用户在历史面板点「钉住当前版本」显式存档，
   *        单列 MANUAL_CAP，不对齐时间轴也不被自动清理（见 merge / PIN_CAP /
   *        MANUAL_CAP / snapshotNow）。
   *   · 全局配额（quotaTrim）：单篇上限 + 总体积封顶，防多篇草稿长期累积
   *     撑爆 chrome.storage.local 的 10MB（见 writeItems）；钉住的版本豁免
   *     单篇上限与体积裁剪。
   *
   * items 按时间倒序 → 年龄随下标单调递增 → 段位天然是连续分块，一次线性
   * 扫描即可。返回值仍为倒序，items[0] 恒为最新 —— 恢复浮条/徽标等既有
   * 读取处不受影响。存量约 31 版 × 5–20KB HTML ≈ 155–620KB，
   * chrome.storage.local 上限 10MB 无压力；旧 {v:1} 数据照常读入（不迁移）。 */
  var TIERS = [
    { max: 10 * 1000, bucket: 0, cap: 5 },
    { max: 320 * 1000, bucket: 20 * 1000, cap: 18 },
    { max: 24 * 3600 * 1000, bucket: 120 * 1000, cap: 10 },
    { max: Infinity, bucket: 12 * 3600 * 1000, cap: 8 }
  ];
  function merge(items, snap, now) {
    now = now || Date.now();
    var all = [snap].concat(prune(items, now));   /* 顺手剪掉 14 天过期项 */
    /* 防御性排序：正常写入恒「最新在前」，但时钟回拨 / 旧数据错序时
     * 段位扫描依赖年龄单调，先排一遍保证结果仍按时间倒序 */
    all.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    var out = [];
    var used = [0, 0, 0, 0];
    var lastBucket = [-1, -1, -1, -1];
    var usedPin = 0, usedManual = 0;
    for (var i = 0; i < all.length; i++) {
      var it = all[i];
      if (!it || typeof it.ts !== 'number') continue;
      /* 钉住的版本（pin）：不受时间窗折叠、不占 TIERS 段位配额。
       *   · 手动钉（带 label）：用户显式「钉住当前版本」→ 单列 MANUAL_CAP，
       *     既不被自动 pin 挤掉，也不被时间窗折叠（2026-10-03 需求）；
       *   · 自动 pin（无 label）：字数突变强制留版——突变后那版 + 「突变前」
       *     那一版（见 snapshotNow 的 pre 处理）→ 受 PIN_CAP 约束。
       * 「删之前那版」的优先级高于一切时间策略，这是本功能的核心承诺。 */
      if (it.pin) {
        if (it.label) {
          if (usedManual >= MANUAL_CAP) continue;
          out.push(it);
          usedManual++;
          continue;
        }
        if (usedPin >= PIN_CAP) continue;
        out.push(it);
        usedPin++;
        continue;
      }
      var age = now - it.ts;
      if (age < 0) age = 0;                       /* 时钟回拨防御 */
      var t = 0;
      while (t < TIERS.length - 1 && age >= TIERS[t].max) t++;
      if (used[t] >= TIERS[t].cap) continue;      /* 该段位配额满 */
      var b = TIERS[t].bucket;
      if (b) {
        var key = Math.floor(it.ts / b);          /* 绝对时间窗（不随年龄漂移） */
        if (key === lastBucket[t]) continue;      /* 同窗已有更新的一条 */
        lastBucket[t] = key;
      }
      out.push(it);
      used[t]++;
    }
    return out;
  }
  /* pin 配额：字数突变留版也必须有上限（否则反复大增大删可无限堆积）。
   * 只约束「自动 pin」；手动钉版走 MANUAL_CAP 单列（见 merge） */
  var PIN_CAP = 20;
  /* 手动钉版（用户显式「钉住当前版本」）上限：钉住的版本不参与时间窗折叠、
   * 不因单篇配额出局，但总数仍要封顶（每篇 20 版，最老的手动钉先出局） */
  var MANUAL_CAP = 20;
  /* 净字数变化达到该值 → 本拍强制留版（钉住，不被时间窗折叠），并把
   * 「变化前」那一版一并钉住（pre）。30 字 ≈ 一句话以上：正常打字/删词
   * 不触发，选中整段删除必触发 */
  var JUMP_CHARS = 30;
  /* 编辑器变更合并窗：一次 ProseMirror 操作会拆成多批 mutation（实证
   * 14 条记录/一次打字），攒 100ms 再读一次正文，避免逐批强制布局 */
  var MUT_MERGE_MS = 100;
  /* 全局配额常量（配合 writeItems 前的 quotaTrim，定义见该函数处）。
   * 必须声明在「帧门禁 early-return」之前：父帧 / Node 纯函数导出两条
   * 路径都会提前返回，声明放后部的话这两边拿到的是 undefined——
   * quotaTrim 会把所有条目判为超限，清空历史直接写空整库（回归抓到过） */
  var PER_AID_CAP = 60;
  var TOTAL_CHARS = 2 * 1024 * 1024;
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
      aid: AID,   /* 文章标识：消费端按它分组（见「文章隔离」注释） */
    };
  }

  /* ================= 时间展示（快照历史的行标签） =================
   * 分层后跨度约 20 分钟 → 只用 HH:MM 会让相邻若干行看着一模一样；
   * 列表用相对时间（刚刚 / N 秒前 / N 分钟前 / 昨天 HH:MM / MM-DD HH:MM），
   * 悬停给完整 HH:MM:SS（title）。 */
  function hhmm(ts) {
    try { return new Date(ts).toTimeString().slice(0, 5); } catch (e) { return '??:??'; }
  }
  function relTime(ts, now) {
    now = now || Date.now();
    var diff = Math.max(0, now - ts);
    if (diff < 5000) return '刚刚';
    if (diff < 60000) return Math.round(diff / 1000) + ' 秒前';
    if (diff < 3600000) return Math.round(diff / 60000) + ' 分钟前';
    var d = new Date(ts), n = new Date(now);
    var sameDay = d.getFullYear() === n.getFullYear() &&
                  d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    if (sameDay) return hhmm(ts);
    var y = new Date(now - 86400000);
    if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() &&
        d.getDate() === y.getDate()) {
      return '昨天 ' + hhmm(ts);
    }
    var mm = d.getMonth() + 1, dd = d.getDate();
    return (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd + ' ' + hhmm(ts);
  }
  function secOf(ts) {
    try { return new Date(ts).toTimeString().slice(0, 8); } catch (e) { return '--:--:--'; }
  }

  var api = {
    norm: norm,
    hasImage: hasImage,
    merge: merge,
    prune: prune,
    decide: decide,
    collect: collect,
    relTime: relTime,
    secOf: secOf,
    forAid: forAid,
    rekey: rekey,
    quotaTrim: quotaTrim,
    pasteFriendly: pasteFriendly,
    /* 配额常量对测试面公开（回归里直接断言边界，避免与实现各写一份魔数） */
    PER_AID_CAP: PER_AID_CAP,
    PIN_CAP: PIN_CAP,
    MANUAL_CAP: MANUAL_CAP,
    JUMP_CHARS: JUMP_CHARS,
  };

  /* ================= 文章隔离 =================
   * 快照必须按文章分组：否则写完 A 篇再打开 B 篇，历史面板列的是 A 的
   * 版本（跨文章串味、误复制），且 boot 判定「快照 ≠ 当前正文」必然成立
   * → 浮条在任何一篇上都误报（2026-10-02 真机实证）。
   *
   * 键的演进（2026-10-02 两轮真机实证）：
   *  v1  取编辑器 URL 里 pc-publish.html 前一段——被证伪：
   *      9592-17573000008847 两天两篇草稿完全相同，该段是编辑器容器
   *      常量不是文章 ID，按它分组等于全站一篇（历史互通、计数跨篇连涨）。
   *  v2（现行）保存接口里的 postId（tools/probe-aid.js 探针三组实证）：
   *      · 新草稿首次 AUTO_SAVE：请求 URL /Blog/<user>/new/text/、请求体
   *        postId 为空 → 响应 response.id 返回服务端分配的号；
   *      · 已存草稿：请求 URL /edit/<permalink>、请求体自带 postId；
   *      · 同篇稳定、异篇不同；「存为草稿」后页面自动刷新，重开同篇
   *        请求体即带 postId → 跨会话延续。
   * 会话时序（2026-10-02 [lc-debug] 真机实证修正）：自动保存请求由
   * **顶层帧**发出（日志 `req#26 /edit/810c5c05_34f664f00 本帧
   * host=www.lofter.com`）——编辑器 iframe 里那份 MAIN 世界钩子永远抓不到
   * 它（此前一直抓不到，正是「重开就没历史」的病根）。键链路现为：
   *   顶层帧钩子抓 postId → 顶层帧 postMessage **转发进编辑器 iframe**
   *   （带 __lcAidRelay）→ 编辑器 setAid 切键。
   * 拿到 postId 前用随机临时键 tmp-* 兜住最初几秒的快照；拿到后把临时键下
   * 的快照整体改挂正式键（历史跟着草稿走），并补一次恢复判定——崩溃快照
   * 的浮条从「启动时」挪到「首次自动保存时」出现（键在启动时还不可知，
   * 延迟约 3s）。若顶层帧在打开草稿时就从 /postPreEdit 拿到键（早于打字），
   * 编辑器帧开机还会主动问一次顶层帧，历史可即时显示（免等 3s）。
   * 判定带 bornAt 护栏：本会话内产生的快照（含刚改挂的）一律不出浮条，
   * 防「自己 1 秒前写的内容」误报。
   * 临时键跨「同标签页卸载 → 重载」复用（pagehide 经 sessionStorage 交接）：
   * 未保存过的新稿在刷新后仍认得出自己刷前那几拍的快照，浮条照常出；拿到
   * postId 即退役该键（防同标签页下一篇新稿继承）。仍无归属的只剩「未经
   * 卸载的硬崩溃（停电/杀掉进程，pagehide 没跑）」这一种，其快照静默等
   * 14 天过期——如需一并救，得靠内容指纹认领，另行评估（有误挂风险）。
   * 兼容性：v1 按 9592-* 存的存量快照全部失配 → 静默等 14 天过期
   * （发版时无存量用户，可接受）。 */
  /* 保存接口响应/请求体 → postId 的提取逻辑在 lc-draft-hook.js（MAIN
   * 世界，探针实证 URL/响应形态见该文件头）；本文件只经 postMessage
   * 收报文（跨世界可达），收到的键形态在 setAid 里把关。 */
  /* 把 from 键下的快照整体改挂 to 键（临时键 → 正式键，「历史跟着草稿
   * 走」）。纯函数：无匹配时原样返回（调用方用引用相等判断「没动过」）；
   * 有匹配时返回新数组、不改入参 */
  function rekey(items, from, to) {
    var n = 0;
    var out = (items || []).map(function (it) {
      if (it && it.aid === from) {
        n++;
        /* 整条搬运、只换 aid：pin / label / textLen 都必须留着——早先只挑
         * ts/html/text/aid 四个字段重建，会把 pin 洗掉（改挂正式键后
         * 「删之前那版」重新变回可折叠，2026-10-03 复查发现） */
        var o = {};
        for (var k in it) {
          if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
        }
        o.aid = to;
        return o;
      }
      return it;
    });
    return n ? out : (items || []);
  }
  /* 取某篇文章的快照子集（过滤 + 按时间倒序） */
  function forAid(items, aid) {
    return (items || []).filter(function (it) { return it && it.aid === aid; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  }

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
  /* 编辑器帧的当前文章键：先随机临时键兜住最初几秒，钩子拿到 postId
   * 后 setAid 切正式键（见「文章隔离」v2 说明） */
  function newTmpAid() {
    return 'tmp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  /* 临时键要在「同一标签页的卸载 → 重载」之间复用：否则刷新后换新键，刷前
   * 最后几秒的快照与 pagehide pending 全部失配 → 明明有唯一副本却不出浮条、
   * 且永远看不见（静默等 14 天过期）。
   * 实证（2026-10-02 作者真机）：首页发布栏写 12 字 → 3 秒内刷新（官方自动
   * 保存尚未跑过）→ 弹窗自动重开、内容空白，浮条没出现——而这正是「断网/
   * 崩溃保险」最该生效的场景（首页新稿在「存为草稿」前根本没有 postId）。
   * 传递方式：pagehide 把当前临时键写进 sessionStorage（同标签页刷新后仍在；
   * sessionStorage 按 origin 隔离，编辑器帧 lf127 与顶层 www.lofter.com 不互串）
   * → 下次 boot 取用并消费；拿到 postId 时该键退役（见 setAid / onPageHide），
   * 避免同标签页里开下一篇新稿时继承了本篇的快照。 */
  var TMP_KEY = 'lc_draft_tmpkey_v1';
  function sessionTmpAid() {
    try {
      var prev = sessionStorage.getItem(TMP_KEY);
      sessionStorage.removeItem(TMP_KEY);   /* 消费：一次交接只复用一次 */
      if (prev && /^tmp-/.test(prev)) return prev;
    } catch (e) { /* ignore */ }
    return newTmpAid();
  }
  var AID = isEditorFrame ? sessionTmpAid() : '';
  var bornAt = Date.now(); /* 本帧出生时刻：恢复判定护栏（judgeAfterAid） */

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
    var histItems = [];   /* 父帧镜像的快照列表（倒序）——入口文案与面板行都读它 */
    var curLen = null;    /* 编辑器帧经跨帧桥报来的「当前正文净字数」（未收到 = null） */
    var histPill = null;  /* #12 入口 pill（空白带左下） */
    var histPanel = null; /* #12 历史面板（向上弹出在空白带之上） */
    var histLabel = '';   /* 上次写入的入口文案 —— 只在变化时写，防 MutationObserver 自愈回环 */
    var histBound = false; /* Esc / 点外关闭是否已挂 */

    function fmt(ts) { return hhmm(ts); }
    function charCount(t) { return String(t || '').replace(/\s/g, '').length; }
    /* 当前文章标识：编辑器帧经跨帧桥广播（v2 键 = 保存接口 postId；URL 段
     * 已被证伪为编辑器容器常量，见「文章隔离」）。未收到广播时为 ''——
     * 不匹配任何快照，UI 空转等下一条广播（boot 判定/输入节拍都会带） */
    var frameAid = '';
    function curAid() { return frameAid; }
    /* 存储里是全部文章的快照；父帧 UI 只认当前文章这一份 */
    var rawItems = [];
    function refreshHist() {
      histItems = forAid(rawItems, curAid());
      lastSnap = histItems.length && histItems[0] && histItems[0].ts ? histItems[0] : null;
    }
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
    function frameWin() {
      var f = document.querySelector(IFRAME_SEL);
      try { return (f && f.contentWindow) || null; } catch (e) { return null; }
    }
    /* 把当前文章键推给编辑器帧（跨域 postMessage）。__lcAidRelay 标记来源：
     * 编辑器帧只认「本帧钩子直接报」或「父/顶层帧转发」两种形态。
     * 只在键是正式键（p+数字）时推——临时键 tmp-* 是编辑器帧自己的，别回流。 */
    function pushAid() {
      if (!/^p\d+$/.test(frameAid)) return;
      var w = frameWin();
      try {
        if (w) w.postMessage({ __lcAidFound: frameAid, __lcAidRelay: true }, '*');
      } catch (e) { /* ignore */ }
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
      bindHistGlobal(false);
      closeHistPanel();
      if (histPill && histPill.parentNode) histPill.parentNode.removeChild(histPill);
      histPill = null;
      histLabel = '';
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
      bindHistGlobal(guardOn);
      if (!guardOn) { cleanup(); return; }
      refreshHist();   /* iframe 换篇 / 首次挂载 → 重算本篇快照集 */
      syncBadge();
      renderHistPill();
    }
    /* 徽标（官方「草稿已保存」胶囊行首 / 自立门户）—— 与历史入口相互独立 */
    function syncBadge() {
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
        /* 只在文案真变化时写：无条件赋值即便内容相同也会换掉文本节点、
         * 产生 childList mutation → 本观察器再次 sync → 再写……形成
         * 每 200ms 一轮的自愈死循环（副作用见 renderHistPill 的淡出注释） */
        var bt = badgeText();
        if (badge.textContent !== bt) badge.textContent = bt;
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
        var bt2 = badgeText();   /* 同上：只在变化时写，掐断 observer 自愈循环 */
        if (badge.textContent !== bt2) badge.textContent = bt2;
      }
    }
    function scheduleSync() {
      if (!syncTimer) syncTimer = setTimeout(sync, 200);
    }

    /* ---------- #12 快照历史：入口 pill + 面板 ----------
     * 挂载方式由真机 demo A/B 定稿为 **M1**（挂 editorHost 内、绝对定位）：
     * 位置随弹窗滚动自然跟随（M2 挂 body + 视口坐标是一次性 rect 折算，
     * 滚动后 pill 停在旧位、点开面板才跳回，且两种模式都没被弹窗裁切 →
     * M2 无优势只剩劣势，弃用）。互斥：同一角落的恢复浮条出现 → 入口让位、
     * 面板收起（一屏两个控件会让层级变糊）。 */
    function el(tag, css, text) {
      var n = document.createElement(tag);
      if (css) n.style.cssText = css;
      if (text != null) n.textContent = text;
      return n;
    }
    var BTN_CSS = 'flex:none!important;cursor:pointer!important;border:0!important;' +
      'border-radius:6px!important;padding:2px 8px!important;' +
      'font:11px/1.4 system-ui,sans-serif!important;font-weight:400!important;' +
      'background:rgba(255,255,255,.14)!important;color:#ddd!important;';
    function mkBtn(text, title) {
      var b = el('button', BTN_CSS, text);
      if (title) b.title = title;
      return b;
    }
    function setHistLabel() {
      if (!histPill) return;
      var s = '快照历史 · ' + histItems.length + (histPanel ? ' ▴' : ' ▾');
      if (histLabel === s) return;   /* 同值不写：写 DOM 会触发自愈 sync 回环 */
      histLabel = s;
      histPill.textContent = s;
    }
    function closeHistPanel() {
      if (histPanel && histPanel.parentNode) histPanel.parentNode.removeChild(histPanel);
      histPanel = null;
      if (histPill) histPill.classList.remove('lc-open');   /* 胶囊回落影子态 */
      setHistLabel();
    }
    /* 面板滚动条：深色面板上浏览器默认亮色滚动条太扎眼（2026-10-03 真机反馈）。
     * 规则只挂 #lc-draft-panel 一个 id，不碰 LOFTER 页面其他滚动条。
     * 平时半透明、悬停面板才显现实底——写作时减少干扰。注意不能用
     * scrollbar-width/scrollbar-color 标准属性：Chromium 一旦看到它们
     * 就禁用 ::-webkit-* 规则，悬停变色就没了（扩展只跑 Chromium，够了） */
    function ensureHistPanelStyle() {
      if (document.getElementById('lc-draft-panel-css')) return;
      var st = document.createElement('style');
      st.id = 'lc-draft-panel-css';
      st.textContent =
        '#lc-draft-panel::-webkit-scrollbar{width:8px!important;height:8px!important}' +
        '#lc-draft-panel::-webkit-scrollbar-track{background:transparent!important}' +
        '#lc-draft-panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16)!important;' +
        'border-radius:4px!important;background-clip:padding-box!important}' +
        '#lc-draft-panel:hover::-webkit-scrollbar-thumb{background:rgba(255,255,255,.42)!important;' +
        'border-radius:4px!important;background-clip:padding-box!important}' +
        '#lc-draft-panel::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.6)!important}' +
        /* 历史胶囊两态（2026-10-03 定稿）：常态 = 幽灵态 + 低透明度（写作时
         * 几乎看不见）；悬停 = 深色胶囊实底白字；面板展开期间同样实底。
         * 背景/文字必须走样式表——行内 !important 压不过也躲不开，放行内
         * 的话 :hover 规则永远输给行内声明（上一版就栽在这） */
        '#lc-draft-pill{background:rgba(20,20,28,.06)!important;color:rgba(64,64,74,.6)!important;' +
        'box-shadow:none!important;opacity:.22!important}' +
        '#lc-draft-pill:hover{background:rgba(20,20,28,.88)!important;color:#fff!important;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.25)!important;opacity:1!important}' +
        '#lc-draft-pill.lc-open{background:rgba(20,20,28,.92)!important;color:#fff!important;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.25)!important;opacity:1!important}';
      document.head.appendChild(st);
    }
    /* 胶囊实底态：面板展开时保持实底（否则半透明胶囊顶着面板很怪），
     * 收起回落。悬停实底走 CSS（:hover），展开态走类名 */
    function openHistPanel() {
      if (histPanel || bar || histItems.length < 2) return;
      var host = editorHost();
      if (!host) return;
      ensureHistPanelStyle();
      histPanel = el('div', 'position:absolute!important;left:12px!important;bottom:52px!important;' +
        'width:320px!important;max-height:240px!important;overflow:auto!important;' +
        'overscroll-behavior:contain!important;z-index:2147483647!important;' +
        'background:rgba(24,24,32,.97)!important;color:#fff!important;' +
        'font:12px/1.6 system-ui,sans-serif!important;border:1px solid rgba(255,255,255,.14)!important;' +
        'border-radius:8px!important;box-shadow:0 6px 24px rgba(0,0,0,.4)!important;');
      histPanel.id = 'lc-draft-panel';
      renderHistRows();
      host.appendChild(histPanel);
      if (histPill) histPill.classList.add('lc-open');      /* 胶囊保持实底 */
      setHistLabel();
      /* 首开时可能还没收到过长（父帧与编辑器帧各自异步启动、先后不定）→
       * 主动问一次，否则差值列与「当前」标记会空着等下一次写入 */
      if (curLen === null) askLen();
    }
    function askLen() {
      var f = document.querySelector(IFRAME_SEL);
      try {
        if (f && f.contentWindow) f.contentWindow.postMessage({ __lcDraftAskLen: true }, '*');
      } catch (e) { /* ignore */ }
    }
    function renderHistRows() {
      if (!histPanel) return;
      histPanel.textContent = '';
      /* 头部两行：①「本地快照 · 最近 N 版」+「按时间倒序」（右对齐小字）
       * ②操作按钮行。320px 里单行塞不下「标题+两按钮+提示」（≈340px+），
       * 之前被 flex 压缩得逐字竖排换行（2026-10-03 真机截图），改两行后排 */
      var hd = el('div', 'position:sticky!important;top:0!important;z-index:2!important;' +
        'display:flex!important;' +
        'flex-direction:column!important;gap:5px!important;padding:8px 10px 7px!important;' +
        'background:rgba(30,30,40,1)!important;border-bottom:1px solid rgba(255,255,255,.1)!important;' +
        'font-weight:600!important;');
      var titleRow = el('span', 'display:flex!important;align-items:baseline!important;' +
        'justify-content:space-between!important;white-space:nowrap!important;');
      titleRow.appendChild(el('span', '', '本地快照 · 最近 ' + histItems.length + ' 版'));
      titleRow.appendChild(el('span', 'font-weight:400!important;opacity:.6!important;font-size:11px!important;',
        '按时间倒序'));
      hd.appendChild(titleRow);
      /* 清空历史：只清本篇历史列表、保留最新一版 + 手动钉住的版本。
       * 自动钉（绿「钉」，字数突变强制留版）一并清掉——用户主动清空的意图
       * 是「这些旧版我不要了」，机器自动留的保险丝不该赖着不走（2026-10-03
       * 真机反馈）；手动钉是用户显式存的里程碑，必须幸免。他篇快照不动。
       * 两段式确认（点一次变「确认清空？」，3 秒不点回落）防手滑 */
      var clearBtn = mkBtn('清空历史',
        '保留最新一版与手动钉住的版本；自动留版与更早的历史一起清掉（其他文章的快照不受影响）');
      clearBtn.addEventListener('click', function () {
        if (clearBtn.dataset.arm !== '1') {
          clearBtn.dataset.arm = '1';
          clearBtn.textContent = '确认清空？';
          setTimeout(function () {
            if (clearBtn.parentNode) { clearBtn.dataset.arm = ''; clearBtn.textContent = '清空历史'; }
          }, 3000);
          return;
        }
        var aid = curAid();
        chrome.storage.local.get(KEY, function (res) {
          var all = (res && res[KEY] && res[KEY].items) || [];
          var mine = forAid(all, aid);
          if (mine.length > 1) {
            /* 保留：最新一版（继续兜底）+ 手动钉（label='手动'，用户显式
             * 存档）；自动钉（字数突变强制留版）与普通历史一起清，见上注 */
            writeItems(mine.filter(function (it, i) {
                return i === 0 || (it.pin && it.label === '手动');
              })
              .concat(all.filter(function (it) { return it && it.aid !== aid; })));
          }
        });
        clearBtn.dataset.arm = '';
        clearBtn.textContent = '已清空 ✓';
      });
      /* 「钉住当前版本」：正文在编辑器帧，父帧读不到 → 发一条消息让它自己钉。
       * 钉住的版本不参与时间窗折叠、不被自动清理（单列 MANUAL_CAP）。
       * 真正的反馈是列表里多出一行带「钉」标记的版本（storage 变化会重渲染） */
      var pinBtn = mkBtn('钉住当前版',
        '把这一刻的正文存成一个钉住的版本：不参与时间窗折叠，也不会被自动清理（每篇最多 20 个）');
      pinBtn.addEventListener('click', function () {
        var f = document.querySelector(IFRAME_SEL);
        try {
          if (f && f.contentWindow) f.contentWindow.postMessage({ __lcDraftPinNow: true }, '*');
        } catch (e) { /* ignore */ }
        pinBtn.textContent = '已钉住 ✓';
        setTimeout(function () { if (pinBtn.parentNode) pinBtn.textContent = '钉住当前版'; }, 1800);
      });
      /* 按钮排一起、清空在前（既有测试与肌肉记忆都按第一个按钮是「清空历史」） */
      var btnWrap = el('span', 'flex:none!important;display:flex!important;gap:6px!important;');
      btnWrap.appendChild(clearBtn);
      btnWrap.appendChild(pinBtn);
      hd.appendChild(btnWrap);
      histPanel.appendChild(hd);
      /* 「当前」标记：只在 == 当前净字数的最靠前那行打（跨帧桥给不到 html，
       * 只做长度匹配；同长度撞车时取最新的一条） */
      var curIdx = -1;
      if (curLen != null) {
        for (var k = 0; k < histItems.length; k++) {
          if (charCount(histItems[k].text) === curLen) { curIdx = k; break; }
        }
      }
      for (var j = 0; j < histItems.length; j++) {
        histPanel.appendChild(mkHistRow(histItems[j], j === curIdx));
      }
    }
    function mkHistRow(it, isCur) {
      var row = el('div', 'display:flex!important;align-items:center!important;gap:8px!important;' +
        'padding:6px 10px!important;border-top:1px solid rgba(255,255,255,.06)!important;');
      var tt = el('span', 'flex:none!important;width:74px!important;opacity:.95!important;',
        relTime(it.ts));
      tt.title = secOf(it.ts);   /* 悬停给完整秒级 */
      row.appendChild(tt);
      var len = charCount(it.text);
      row.appendChild(el('span', 'flex:none!important;width:52px!important;opacity:.65!important;' +
        'text-align:right!important;', len + ' 字'));
      if (isCur) {
        row.appendChild(el('span', 'flex:none!important;background:#7c80d2!important;color:#fff!important;' +
          'border-radius:9px!important;padding:1px 7px!important;font-size:10px!important;', '当前'));
      }
      /* 钉住标记：手动钉 = 「手动」，自动钉（突变前后两版）= 「钉」。
       * 这两类都不参与时间窗折叠，是「删掉的内容」唯一能找回来的入口 */
      if (it.pin) {
        var pinChip = el('span', 'flex:none!important;background:' +
          (it.label ? '#b07d1a' : '#5c7a3a') + '!important;color:#fff!important;' +
          'border-radius:9px!important;padding:1px 7px!important;font-size:10px!important;',
          it.label || '钉');
        pinChip.title = it.label
          ? '你手动钉住的版本：不参与时间窗折叠，也不会被自动清理'
          : '大幅删改「之前」的版本已自动钉住：不会被时间窗折叠掉，用来找回刚删掉的内容';
        row.appendChild(pinChip);
      }
      var d = '—';
      if (curLen != null) {
        d = len === curLen
          ? '与当前正文一致'
          : '比当前 ' + (len > curLen ? '+' : '−') + Math.abs(len - curLen) + ' 字';
      }
      row.appendChild(el('span', 'flex:1 1 auto!important;opacity:.55!important;font-size:11px!important;', d));
      var btn = el('button', 'flex:none!important;cursor:pointer!important;border:0!important;' +
        'border-radius:6px!important;padding:3px 9px!important;font:11px/1.4 system-ui,sans-serif!important;' +
        'background:rgba(255,255,255,.14)!important;color:#ddd!important;', '复制');
      btn.addEventListener('click', function () {
        var ok = copyHtml(it.html);   /* 复用：隐藏容器选区 + execCommand 富文本 */
        btn.textContent = ok ? '已复制 ✓' : '复制失败';
        setTimeout(function () { if (btn.parentNode) btn.textContent = '复制'; }, 1600);
      });
      row.appendChild(btn);
      return row;
    }
    /* 入口胶囊两态（2026-10-03 定稿）：**常态永远是影子**——不因打字或
     * 新快照短暂变亮（用户明确不要这个打扰）；鼠标悬停到胶囊上才显现
     * 深色实底，面板展开期间也保持实底。纯 CSS 驱动，无计时器、无类名
     * 切换（此前那套「空闲 6 秒淡出 + 写入时点亮」已撤） */
    function renderHistPill() {
      var host = editorHost();
      /* 门槛：≥2 版才出现（只有 1 版时没有「历史」可翻，避免点了只有一行） */
      if (bar || histItems.length < 2 || !host) {
        if (histPanel) closeHistPanel();
        if (histPill) {
          if (histPill.parentNode) histPill.parentNode.removeChild(histPill);
          histPill = null;
          histLabel = '';
        }
        return;
      }
      if (!histPill) {
        ensureHistPanelStyle();   /* 胶囊常态/悬停样式也在注入的样式表里，创建时就要有 */
        histPill = el('div', 'position:absolute!important;left:12px!important;bottom:12px!important;' +
          'z-index:2147483647!important;display:flex!important;align-items:center!important;gap:4px!important;' +
          'font:12px/1.6 system-ui,sans-serif!important;padding:3px 10px!important;border-radius:12px!important;' +
          'cursor:pointer!important;' +
          'transition:background .18s ease,color .18s ease,box-shadow .18s ease,opacity .25s ease!important;' +
          'user-select:none!important;white-space:nowrap!important;');
        histPill.id = 'lc-draft-pill';
        histPill.addEventListener('click', function () {
          if (histPanel) closeHistPanel(); else openHistPanel();
        });
        host.appendChild(histPill);
        histLabel = '';
      }
      /* 文案只在版数变化时真正写 DOM（setHistLabel 自带同值守卫）——
       * sync() 由全页 MutationObserver 驱动，页面任何角落的 DOM 抖动都会
       * 走到这里，无条件写会自愈成死循环（2026-10-03 真机：胶囊从不淡出） */
      setHistLabel();
      var tip = '本机防丢快照（' + histItems.length + ' 版）——点击查看历史版本';
      if (histPill.getAttribute('title') !== tip) histPill.setAttribute('title', tip);
    }
    function onHistKey(e) {
      if (e.key !== 'Escape' || !histPanel) return;
      closeHistPanel();
    }
    function onHistDown(e) {
      if (!histPanel) return;
      if (histPanel.contains(e.target) || (histPill && histPill.contains(e.target))) return;
      closeHistPanel();
    }
    function bindHistGlobal(on) {
      if (on && !histBound) {
        histBound = true;
        document.addEventListener('keydown', onHistKey, true);
        document.addEventListener('mousedown', onHistDown, true);
      } else if (!on && histBound) {
        histBound = false;
        document.removeEventListener('keydown', onHistKey, true);
        document.removeEventListener('mousedown', onHistDown, true);
      }
    }

    /* ---------- 恢复浮条（父帧版）：编辑器 iframe 父容器左下，空白带内 ---------- */
    function hideRecoverBar() {
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      bar = null;
      renderHistPill();   /* 浮条收起 → 入口回来 */
    }
    /* 富文本复制：隐藏容器选区 + execCommand（复制的是快照本身而非当前
     * 编辑器内容，语义更准；demo 实测 ProseMirror 粘贴保留段落）。
     * 复制前先过 pasteFriendly（见纯函数区）把编辑器私有结构翻译成通用 HTML */
    function copyHtml(html) {
      var holder = document.createElement('div');
      holder.contentEditable = 'true';
      holder.style.cssText =
        'position:fixed!important;left:-9999px!important;top:0!important;opacity:0!important;';
      holder.innerHTML = pasteFriendly(html);
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
        /* 只认当前文章的快照：他篇快照与本篇正文必然不同，
         * 不隔离的话打开任何一篇都会误报（2026-10-02 真机实证） */
        var items = forAid((res && res[KEY] && res[KEY].items) || [], curAid());
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
        closeHistPanel();   /* 互斥：浮条占用同一角落 → 面板收起 */
        renderHistPill();   /*          且入口让位 */
      });
    }

    try {
      chrome.storage.local.get([SET_KEY, KEY], function (res) {
        var s = (res && res[SET_KEY]) || {};
        guardOn = !!(s.draft && s.draft.guard);
        rawItems = (res && res[KEY] && res[KEY].items) || [];
        refreshHist();
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
              rawItems = (changes[KEY].newValue && changes[KEY].newValue.items) || [];
              refreshHist();
              if (badge) badge.textContent = badgeText();
              renderHistPill();                    /* 版数变化 → 入口文案跟随 */
              if (histPanel) renderHistRows();     /* 面板开着 → 行列表刷新 */
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
       * 另带 __lcDraftLen（当前正文净字数）供历史面板标「当前」与算差值——
       * 编辑器在跨域 iframe 里，父帧读不到正文，只能靠这条桥。
       * 只认编辑器 iframe 的 contentWindow，防外域消息伪造 */
      window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (!d || typeof d !== 'object') return;
        var hasLen = typeof d.__lcDraftLen === 'number';
        var hasRecover = typeof d.__lcDraftRecover === 'boolean';
        var hasAid = typeof d.__lcDraftAid === 'string' && !!d.__lcDraftAid;
        if (!hasLen && !hasRecover && !hasAid) return;
        var f = document.querySelector(IFRAME_SEL);
        var src = null;
        try { src = (f && f.contentWindow) || null; } catch (err) { src = null; }
        if (!src || e.source !== src) return;
        if (hasAid && d.__lcDraftAid !== frameAid) {
          frameAid = d.__lcDraftAid;      /* 键就位/切换（tmp→postId）→ 重算本篇 */
          refreshHist();
          syncBadge();
          renderHistPill();
          if (histPanel) renderHistRows();
        }
        if (hasLen) {
          curLen = d.__lcDraftLen;
          if (histPanel) renderHistRows();
        }
        if (!hasRecover) return;
        if (d.__lcDraftRecover) showRecoverBar();
        else hideRecoverBar();
      });
      /* 文章键（postId）转发 —— 自动保存请求实测由**本帧（顶层帧）**发出
       * （2026-10-02 [lc-debug]：req#26 /edit/… 本帧 host=www.lofter.com），
       * 编辑器 iframe 里那份 MAIN 钩子永远抓不到它；而快照得按这个键分组、
       * 由编辑器帧自己写盘 → 顶层帧收到钩子报文后必须立刻转发进 iframe。
       * 拿到键本帧也先用上：入口/面板/徽标立即可按本篇过滤。 */
      window.addEventListener('message', function (e) {
        var d = e && e.data;
        if (!d || typeof d !== 'object') return;
        /* 编辑器帧开机主动来问（它可能在本帧拿到键之前就启动）→ 回推一次 */
        if (d.__lcDraftAskAid === true) {
          if (e.source === frameWin()) pushAid();
          return;
        }
        if (typeof d.__lcAidFound !== 'string' || e.source !== window) return;
        if (!/^p\d+$/.test(d.__lcAidFound)) return;
        if (d.__lcAidFound !== frameAid) {
          frameAid = d.__lcAidFound;
          if (guardOn) {              /* guard 关 = 零 UI（键照收照转发） */
            refreshHist();
            syncBadge();
            renderHistPill();
            if (histPanel) renderHistRows();
          }
        }
        pushAid();
      });
    } catch (e) { /* 扩展上下文失效等：静默 */ }
  }

  /* ================= 编辑器帧运行时 ================= */
  if (window.__lcDraft) return;
  window.__lcDraft = true;

  /* 扩展上下文失效（重载扩展后旧页面）等场景静默退出 */
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  var running = false;
  var preAid = '';        /* start 前收到的文章键暂存（转发可能早于 guard 判定） */
  var onInput = null, onPageHide = null;
  var lastSave = 0, timer = 0;
  var edObs = null;        /* 编辑器内容 MutationObserver（见「变更检测」） */
  var edObsTarget = null;  /* 已观察的编辑器元素：换元素要重挂 */
  var edTry = 0;           /* 等编辑器出现（懒挂载）的重试计数 */
  var edWatch = 0;         /* 看门狗：编辑器根被重建 → 重挂观察器 */
  var mutTimer = 0;        /* mutation 合并窗定时器 */
  var memPrev = null;      /* 内存里上一拍正文（不落盘）：突变时作「变化前」 */

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
  /* ---------- 全局配额（quotaTrim）----------
   * 跨会话累积后（tier4 天级 + pin）快照会长期留存，多篇草稿叠加可能撑爆
   * chrome.storage.local 的 10MB 配额 → 写入前统一修剪：
   *   ① 单篇上限：同一 aid 最多留最新 PER_AID_CAP 版（最新优先，最老先出）；
   *   ② 总体积封顶：序列化后超 TOTAL_CHARS 字符时从最老开始丢（至少保 1 版）。
   * 配额以「字符数」估算体积（JSON.stringify().length，UTF-16 码元数）：
   * 上限取 2M 字符，中文正文按 UTF-8 落盘最多 ~6MB，留足 10MB 配额的安全边。
   * PER_AID_CAP / TOTAL_CHARS 的声明在「帧门禁」之前（原因见彼处注释）。 */
  function quotaTrim(items) {
    items = items || [];
    /* ① 单篇上限：数组约定「最新在前」（merge 的输出序）→ 从头往后数，
     *    每篇只留最先遇到的 PER_AID_CAP 条（= 最新那些），最老的自然出局。
     *    **钉住的版本（pin）不计数、直接留**：它们是用户显式存档或「突变前
     *    那一版」，被配额顺手丢掉就白钉了。数量上限已由 merge 的
     *    PIN_CAP / MANUAL_CAP 各自封住，这里不会无限增长。 */
    var seen = {};
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      if (it.pin) { out.push(it); continue; }
      var k = it.aid || '';
      seen[k] = (seen[k] || 0) + 1;
      if (seen[k] <= PER_AID_CAP) out.push(it);
    }
    /* ② 总体积封顶：超限时从**最老的非钉住条目**开始丢（数组尾往前找），
     *    只剩钉住版本则停手——钉住的不为体积让路（否则「体积超了就把用户
     *    手动钉的那版删掉」是本末倒置） */
    var guard = 0;
    while (out.length > 1 && guard++ < 1000) {
      var size;
      try { size = JSON.stringify({ v: 2, items: out }).length; }
      catch (e) { break; }                        /* 序列化失败就不动了，别把数据弄丢 */
      if (size <= TOTAL_CHARS) break;
      var cut = -1;
      for (var j = out.length - 1; j >= 0; j--) {
        if (!out[j].pin) { cut = j; break; }
      }
      if (cut < 0) break;
      out.splice(cut, 1);
    }
    return out;
  }
  function writeItems(items, cb) {
    if (!items.length) { stRemove(function () { if (cb) cb(); }); return; }
    stSet({ v: 2, items: quotaTrim(items) }, function () { if (cb) cb(); });
  }

  /* ---------- 恢复提示：判定 + 广播（浮条 UI 在父帧腾座空白带） ----------
   * 顺带把「当前正文净字数」带给父帧（历史面板标「当前」与算 ±N 字要用，
   * 编辑器在跨域 iframe 里父帧读不到正文）。len 只在已知时带。 */
  function curTextLen() {
    var el = document.querySelector('.ProseMirror');
    if (!el) return null;
    var t = el.innerText != null ? el.innerText : (el.textContent || '');
    return String(t).replace(/\s/g, '').length;
  }
  function announce(box) {
    try { window.parent.postMessage(box, '*'); } catch (e) { /* ignore */ }
  }
  /* 每条广播都带当前文章键：父帧靠它做隔离分组（URL 段已证伪，见
   * 「文章隔离」）；键切换（tmp→postId）时父帧据此重算本篇快照集 */
  function announceRecover(visible, len) {
    var box = { __lcDraftRecover: !!visible, __lcDraftAid: AID };
    if (typeof len === 'number') box.__lcDraftLen = len;
    announce(box);
  }
  /* 纯长度广播：不碰浮条显隐（父帧只更新面板里的「当前」与差值） */
  function announceLen(len) {
    if (typeof len !== 'number') return;
    announce({ __lcDraftLen: len, __lcDraftAid: AID });
  }

  /* ---------- 文章键：临时键 → postId 正式键 ----------
   * 钩子拿到 postId 后调 setAid：
   *  ① 临时键下已有的快照整体改挂正式键（历史跟着草稿走，不断档）；
   *  ② 捞回键未定时留在 sessionStorage 的同篇 pending（见 boot）；
   *  ③ 补一次恢复判定——崩溃快照的浮条从「启动时」挪到「首次自动
   *     保存时」出现（键在启动时不可知，延迟约 3s）。
   * 判定带 bornAt 护栏：本帧出生后产生的快照（含刚改挂的本会话快照）
   * 一律不出浮条，防「自己 1 秒前写的内容」误报。 */
  function takePendingFor(aid) {
    try {
      var raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || p.aid !== aid || typeof p.ts !== 'number' || typeof p.html !== 'string') {
        return null;
      }
      sessionStorage.removeItem(PENDING_KEY);
      return p;
    } catch (e) { return null; }
  }
  function judgeAfterAid(aid) {
    readItems(function (all) {
      var mine = forAid(all, aid);
      var el = document.querySelector('.ProseMirror');
      var show = !!mine.length && mine[0].ts < bornAt &&
        decide(mine[0], el ? el.innerHTML : '') === 'prompt';
      announceRecover(show, curTextLen());
    });
  }
  function setAid(next) {
    if (!next || next === AID || !/^p\d+$/.test(next)) return;
    var old = AID;
    AID = next;
    /* 临时键退役：本次会话已归属正式键，后续若还有卸载也不再交接旧临时键 */
    try { sessionStorage.removeItem(TMP_KEY); } catch (e) { /* ignore */ }
    readItems(function (all) {
      /* 只有临时键才允许整体改挂：已持正式键的会话再收到新号（同篇刷新换
       * 号、或页面里出现别的保存请求）会把旧篇历史整批搬走 = 偷历史
       * （2026-10-02 代码审查发现）。正式键 → 正式键只切当前键，不动存储
       * 里的归属，存储里的旧篇数据原地不动 */
      var moved = /^tmp-/.test(old) ? rekey(all, old, next) : all;
      var pend = takePendingFor(next);
      if (moved === all && !pend) { judgeAfterAid(next); return; }
      var list = moved;
      if (pend && !(list.length && norm(list[0].html) === norm(pend.html))) {
        list = merge(list, pend, Date.now());  /* pending 自带 ts/aid，可直接进 merge */
      }
      writeItems(list, function () { judgeAfterAid(next); });
    });
  }
  /* 文章键从哪来——两条路（键形态只认 p+纯数字；页面理论上可伪造，最坏
   * 后果是快照分组错一篇，无安全面）：
   *  ① 主路径：**顶层帧转发**（带 __lcAidRelay）。自动保存请求实测由顶层帧
   *     发出（见文件头「会话时序」），本帧里那份钩子抓不到它；
   *  ② 兜底：本帧 MAIN 钩子直接报（e.source === window）。
   * 只认「本窗口」或「父/顶层帧」两种来源，别的帧乱塞的键不收。 */
  try {
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (!d || typeof d.__lcAidFound !== 'string') return;
      var fromSelf = e.source === window;
      var fromTop = d.__lcAidRelay === true &&
        (e.source === window.top || e.source === window.parent);
      if (!fromSelf && !fromTop) return;
      /* guard 读盘是异步的：转发可能早于 boot 判定 → 暂存，start 时补切（防止
       * 开头这一枪丢了导致整段会话停在临时键、历史接不上） */
      if (!running) { preAid = d.__lcAidFound; return; }
      setAid(d.__lcAidFound);
    });
    /* 开机问一次顶层帧：它可能在本帧监听器就位前就拿到了键（打开草稿时
     * /postPreEdit 早于打字）→ 主动拉一次，历史即时显示、免等首次自动保存 */
    try { window.parent.postMessage({ __lcDraftAskAid: true }, '*'); } catch (e) { /* ignore */ }
  } catch (e) { /* ignore */ }

  /* ---------- 快照写入 ----------
   * opt.pre    「变化前」那一版的内容（内存里上一拍，见 processEditorChange）
   * opt.jump   调用方已判定这是突变（净字数变化 ≥ JUMP_CHARS）→ 直接钉
   * opt.manual 手动钉版（用户点「钉住当前版本」）→ pin + label
   * 兼容：无参调用 = 原来的节拍落拍 */
  function snapshotNow(opt) {
    opt = opt || {};
    var el = document.querySelector('.ProseMirror');
    if (!el) return;
    var snap = collect(el);
    if (!snap) return; /* 空文不写：防「空快照覆盖有效快照」 */
    readItems(function (all) {
      var mine = forAid(all, AID);            /* 只与本篇的快照比对/合并 */
      var latest = mine[0];
      /* 内容与最新一版相同 → 通常不必再写；但**手动钉版例外**：用户就是要
       * 「把这一刻钉住」，把已有那条就地升格，而不是写一条重复行 */
      if (latest && norm(latest.html) === norm(snap.html)) {
        if (opt.manual && (!latest.pin || !latest.label)) {
          latest.pin = 1;
          latest.label = '手动';
          writeItems(merge(mine.slice(1), latest, Date.now()).concat(otherAid(all, AID)),
            function () { lastSave = Date.now(); announceRecover(false, snap.textLen); });
          return;
        }
        announceRecover(false, snap.textLen); /* 内容追平快照 → 撤浮条 + 同步字数（幂等） */
        return;
      }
      var s = { ts: Date.now(), html: snap.html, text: snap.text, aid: AID, textLen: snap.textLen };
      if (opt.manual) {
        s.pin = 1;
        s.label = '手动';                     /* 手动钉版单列 MANUAL_CAP，见 merge */
      } else {
        /* 字数突变强制留版：一次净字数变化 ≥ JUMP_CHARS → 钉住这版，不被
         * 时间窗折叠。场景：「选中一大段 → 删除」发生在 20s 窗内时，普通
         * 分层只留窗内最新一条，「删之前」就丢了——而这恰是最想找回的版本 */
        var prevLen = latest ? (typeof latest.textLen === 'number' ? latest.textLen
          : String(latest.text || '').replace(/\s/g, '').length) : 0;
        if (opt.jump || (latest && Math.abs(snap.textLen - prevLen) >= JUMP_CHARS)) s.pin = 1;
      }
      /* 「突变前」那一版也必须留住（2026-10-03 真机反馈 + 仿真证死）：pin 此前
       * 只钉突变后，突变前那版是普通拍，20s 一过就被同窗折叠掉。来源依次退让：
       *   ① 已有钉住的 → 不动；
       *   ② 内存里上一拍恰好等于存储最新那版（常态）→ 直接给它打 pin；
       *   ③ 内存那版存储里还没有（打字太快没落盘 / 刚启动）→ 补写独立 pinned 版；
       *   ④ 拿不到内存版 → 退而钉存储里最新那版。 */
      var pre = [];
      if (s.pin && !opt.manual && !(latest && latest.pin)) {
        var preHtml = opt.pre && typeof opt.pre.html === 'string' ? opt.pre.html : '';
        if (latest && preHtml && norm(latest.html) === norm(preHtml)) {
          latest.pin = 1;
        } else if (preHtml && norm(preHtml) !== norm(s.html)) {
          pre.push({ ts: Math.max(0, s.ts - 1), html: preHtml, text: opt.pre.text || '',
            aid: AID, textLen: opt.pre.textLen, pin: 1 });
        } else if (latest) {
          latest.pin = 1;
        }
      }
      /* pre 一并进 merge：让它照常过 14 天过期与段位/配额逻辑（merge 内部
       * 会重排为时间倒序，不用担心 pre 被 concat 到尾巴上） */
      writeItems(merge(pre.concat(mine), s, Date.now()).concat(otherAid(all, AID)), function () {
        lastSave = Date.now();
        /* 新快照已与当前正文对齐 → 浮条的前提（快照比当前新）不再成立，
         * 撤浮条让位给历史入口；被「追平」的那版仍在 history 里可复制。
         * 漏掉这步的后果：编辑已有草稿时浮条永不消失 → 入口被永久压制，
         * 而「改错了想找回上一版」恰恰是历史功能的主场景（2026-10-02 真机发现）。 */
        announceRecover(false, snap.textLen);
      });
    });
  }
  /* 存储里不属于当前文章的快照（写入时原样保留，不参与本篇合并） */
  function otherAid(items, aid) {
    return (items || []).filter(function (it) { return it && it.aid !== aid; });
  }
  /* 正文被删空时的兜底：空文不写快照（防「空快照覆盖有效快照」），但
   * 「删空之前」那版必须留住——全选删除正是最典型的「删掉一整段」场景
   * （2026-10-03 探针实录：Ctrl+A → Delete 后 len=0，只留 childList 增删） */
  function pinPreOnly(pre) {
    if (!pre || typeof pre.html !== 'string' || !pre.html) return;
    readItems(function (all) {
      var mine = forAid(all, AID);
      if (mine.length && norm(mine[0].html) === norm(pre.html)) {
        if (mine[0].pin) return;              /* 已是钉住版，无事可做 */
        mine[0].pin = 1;
      } else {
        mine = [{ ts: Date.now(), html: pre.html, text: pre.text || '',
          aid: AID, textLen: pre.textLen, pin: 1 }].concat(mine);
      }
      writeItems(merge(mine.slice(1), mine[0], Date.now()).concat(otherAid(all, AID)),
        function () {
          lastSave = Date.now();
          announceRecover(false, curTextLen());
        });
    });
  }
  /* ---------- 变更检测：DOM 变更为准，input 只作快路径 ----------
   * 实证（tools/probe-delete-trigger.js，2026-10-03 真机）：
   *   · 打字：keydown → beforeinput（未阻止）→ mutation → **input** 正常派发；
   *   · Backspace / Delete（尤其带选区）：keydown ──> mutation，
   *     keydown(bubble) 的 defaultPrevented = true，**beforeinput / input 全无**
   *     —— ProseMirror 在 keydown 里 preventDefault 后自改 DOM。
   * 所以只监听 input 会让「删掉一整段」这一拍永不落盘（用户看到的就是
   * 「删完等几秒也没快照」）。改用 MutationObserver 做ground truth，input 保留
   * 作打字快路径（两路都只调 schedule()，有 timer 去重，不会重复写）。 */
  function editorEl() { return document.querySelector('.ProseMirror'); }
  function attachEditorObserver() {
    if (!running) return;                       /* stop 后遗留的重试/看门狗不再重挂 */
    var el = editorEl();
    if (!el) {
      /* 编辑器懒挂载（弹窗先出壳、正文后到）→ 每 500ms 试一次，最多 60s */
      if (edTry++ > 120) return;
      setTimeout(attachEditorObserver, 500);
      return;
    }
    if (edObs && edObsTarget === el) return;
    if (edObs) { edObs.disconnect(); edObs = null; }
    edObsTarget = el;
    edObs = new MutationObserver(onEditorMutated);
    /* 只关心内容：childList（增删节点/段落）+ characterData（改字）。
     * 不监听 attributes —— ProseMirror 会频繁改 class/占位属性，监听它纯噪声 */
    edObs.observe(el, { childList: true, characterData: true, subtree: true });
    memPrev = collect(el);   /* 起始基线：紧跟启动就删也能取到「变化前」 */
    /* 看门狗：编辑器根一旦被框架重建，旧观察器随旧节点一起静默失效（再也
     * 收不到回调、无从察觉）→ 每 2s 比一次引用，换了就重挂。开销可忽略 */
    if (!edWatch) {
      edWatch = setInterval(function () {
        if (!running) { clearInterval(edWatch); edWatch = 0; return; }
        if (editorEl() !== edObsTarget) attachEditorObserver();
      }, 2000);
    }
  }
  function detachEditorObserver() {
    if (edObs) { edObs.disconnect(); edObs = null; }
    if (edWatch) { clearInterval(edWatch); edWatch = 0; }
    edObsTarget = null;
    edTry = 0;
    if (mutTimer) { clearTimeout(mutTimer); mutTimer = 0; }
    memPrev = null;
  }
  /* 一次操作会拆成多批 mutation（探针实录：一次打字 14 条记录）→ 攒
   * MUT_MERGE_MS 再读一次正文，避免逐批 innerText 强制布局 */
  function onEditorMutated() {
    if (mutTimer) return;
    mutTimer = setTimeout(function () { mutTimer = 0; processEditorChange(); }, MUT_MERGE_MS);
  }
  function processEditorChange() {
    var el = editorEl();
    if (!el) return;
    if (edObsTarget && edObsTarget !== el) { attachEditorObserver(); return; } /* 编辑器被重建 */
    var snap = collect(el);
    var pre = memPrev;                          /* 变化前那一拍（内存，不落盘） */
    if (!snap) {                                /* 删空了：内容不写，但「删之前」要留 */
      /* 有内容 → 全空 恒是一次全选删除，不看 JUMP_CHARS（哪怕只有 10 个字，
       * 那也是整篇没了，值得留） */
      if (pre && typeof pre.textLen === 'number' && pre.textLen > 0) pinPreOnly(pre);
      memPrev = null;
      return;
    }
    var prevLen = pre && typeof pre.textLen === 'number' ? pre.textLen : null;
    memPrev = { html: snap.html, text: snap.text, textLen: snap.textLen };
    if (prevLen != null && Math.abs(snap.textLen - prevLen) >= JUMP_CHARS) {
      snapshotNow({ jump: true, pre: pre });    /* 突变 → 立即落拍，不等 2s 节流 */
      return;
    }
    schedule();
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
    readItems(function (all) {
      var mine = forAid(all, AID);
      /* 捞 pagehide 同步兜底的 pending：打完字 <2s 就刷新时 chrome.storage
       * 异步写入有卸载竞态（快照可能丢），sessionStorage 同步写必成、
       * 同标签页刷新后保留 → 这里捞回合并，落盘后再广播（父帧读得到）。
       * pending 带写入时的 aid：只认「键一致」的——键未定（tmp）或异篇
       * 时**保留不删**，同篇下次自动保存拿到正式键后由 setAid 捞回 */
      var pending = null;
      try {
        var raw = sessionStorage.getItem(PENDING_KEY);
        if (raw) pending = JSON.parse(raw);   /* 只读不删，匹配才消费 */
      } catch (e) { /* ignore */ }
      if (pending && typeof pending.ts === 'number' && typeof pending.html === 'string' &&
          pending.aid === AID) {
        try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
        var dup = mine.length && norm(mine[0].html) === norm(pending.html);
        if (!dup) {
          mine = merge(mine, pending, Date.now());
          writeItems(mine.concat(otherAid(all, AID)), function () { judge(mine); }); /* 落盘后再判定广播 */
          return;
        }
      }
      judge(mine);
    });
    function judge(its) {
      var show = false;
      if (its.length) {
        var el = document.querySelector('.ProseMirror');
        show = decide(its[0], el ? el.innerHTML : '') === 'prompt';
      }
      announceRecover(show, curTextLen()); /* 一致也广播 false：父帧据此不出浮条 */
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
    attachEditorObserver();   /* 变更检测主力：DOM 变更（含不派发 input 的删除） */
    onPageHide = function () {
      var el = document.querySelector('.ProseMirror');
      if (!el) return;
      var snap = collect(el);
      if (!snap) return;
      var full = {
        ts: Date.now(), html: snap.html, text: snap.text, aid: AID,
        textLen: snap.textLen
      };
      /* 同步兜底先行：页面卸载后异步 chrome.storage 可能没跑完（刷新
       * 竞态），sessionStorage 同步写必落，下次 boot 捞回合并。
       * 必须自带 ts：boot 靠 typeof pending.ts === 'number' 识别有效性
       * （踩过：直接 stringify(collect(el)) 没有 ts → 兜底从未生效，
       * 测试没抓到是因为夹具自己伪造了带 ts 的 pending） */
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(full)); } catch (e) {}
      /* 临时键交接给下一次加载（同标签页刷新/崩溃重载后仍能对上本篇快照）；
       * 已归属正式键（p+数字）的不写——下一帧该开新稿、用新临时键 */
      try {
        if (/^tmp-/.test(AID)) sessionStorage.setItem(TMP_KEY, AID);
      } catch (e) { /* ignore */ }
      readItems(function (all) {
        var mine = forAid(all, AID);
        var latest = mine[0];
        if (latest && norm(latest.html) === norm(snap.html)) return;
        writeItems(merge(mine, full, Date.now()).concat(otherAid(all, AID)));
      });
    };
    window.addEventListener('pagehide', onPageHide);
    boot();
    if (preAid) { var a0 = preAid; preAid = ''; setAid(a0); }  /* 补切暂存的键 */
  }
  function stop() {
    if (!running) return;
    running = false;
    if (onInput) document.removeEventListener('input', onInput, true);
    if (onPageHide) window.removeEventListener('pagehide', onPageHide);
    onInput = onPageHide = null;
    detachEditorObserver();
    if (timer) { clearTimeout(timer); timer = 0; }
    announceRecover(false, curTextLen()); /* 关停：父帧浮条一并撤 */
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
  /* 父帧面板「钉住当前版本」→ 把这一刻的正文钉成手动钉版（单列配额、
   * 不被时间窗折叠）。正文只在编辑器帧，父帧读不到，只能由本帧执行 */
  try {
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (!d || typeof d !== 'object' || d.__lcDraftPinNow !== true) return;
      if (e.source !== window.parent) return;   /* 只认父帧，防外域伪造 */
      if (running) snapshotNow({ manual: true });
    });
  } catch (e) { /* ignore */ }
  /* 父帧问「当前正文净字数」（首次展开历史面板时） → 回一条纯长度广播 */
  try {
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (!d || typeof d !== 'object' || d.__lcDraftAskLen !== true) return;
      if (e.source !== window.parent) return;   /* 只认父帧提问，防外域伪造 */
      announceLen(curTextLen());
    });
  } catch (e) { /* ignore */ }
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes || !changes[SET_KEY]) return;
      var s = (changes[SET_KEY] && changes[SET_KEY].newValue) || {};
      apply(!!(s.draft && s.draft.guard));
    });
  } catch (e) { /* ignore */ }

  /* 调试/探针面：__setAid 供测试/控制台驱动键切换（仅编辑器帧有定义）；
   * __snapshotNow / __pinNow 供测试驱动落拍与手动钉版 */
  api.__setAid = setAid;
  api.__snapshotNow = snapshotNow;
  api.__pinNow = function () { snapshotNow({ manual: true }); };
  global.LC_draft = api;
})(typeof window !== 'undefined' ? window : globalThis);
