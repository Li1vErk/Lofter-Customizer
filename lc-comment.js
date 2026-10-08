/* lc-comment.js —— 评论区与表情子系统（自 content.js 抽出 · S2 纯搬运，2026-10-08）
 *
 * 内容 = 原 content.js 第 3–4093 行（4,091 行），三块互相持有状态、不可再分：
 *   ① 评论区用户过滤（黑名单隐藏 / 空白收缩 / 分割线叠加修复 / 行内快捷隐藏）
 *   ② 评论区工具行（只看作者 / 从旧到新）+ 最近表情行
 *   ③ 表情快捷输入面板（#9，含跨帧桥）+ 评论区诊断探针（lcCmt*）+ lcSetupCommentFilter 装配
 *
 * 与 content.js 共享同一隔离世界顶层作用域：函数声明挂 window、
 * 顶层 const/let 进全局词法环境（与 defaults.js / lc-dwr.js 同款，已实证）。
 * manifest content_scripts[0].js 顺序保证本文件在 content.js 之前注入。
 *
 * 本文件是纯搬运产物 —— 未改任何选择器 / 开关语义 / 存储键。
 */

/* ---------- 评论区用户过滤（Phase 2）----------
 * 与主帧过滤共用一份配置：filter.enabled + filter.scope.comment +
 * filter.users（**只认用户，不做关键词**——评论正文短，关键词误杀
 * 率不可控）。
 * 运行帧范围：顶层帧 + 评论子帧都要跑——部分帖子详情页的评论列表
 * （.cmti 结构）直接渲染在主文档里，不在评论 iframe 内（2026-09-21
 * 实证：只在子帧跑时主文档评论一条都匹配不上）。仅排除编辑器 /
 * about:blank / 模板预览帧。
 * 条目结构支持两套：
 *   a) 新式 .cmti：作者名在 .cmtusr、头像链接在 .w-img2、正文在
 *      .cmthot（首页/tag 页帖子卡片展开区）；
 *   b) 旧式：作者链接与正文同处一行，以正文锚点 .bcmtlstf 或条目类
 *      .bcmti 收敛（评论区 iframe）。
 * 隐藏方式：data 标记 + 样式表 **加上** 内联 display:none 双保险——
 * 卡片由 React 渲染，重渲染会洗掉 data-*（2026-09-21 实证：tag 页
 * 10 个 .cmti 一条都没标记上），内联样式由 1.2s 看门狗补写，
 * 保证被屏蔽者的评论不会"闪回来"。
 * 另外：扫描阶段必须逐链接 try/catch。标记动作排在扫描之后，此前
 * 任何一个异常（SVG className、畸形 href…）都会让整批一枚都不打。 */
let cmtSettings = null;
let cmtObserver = null;
let cmtTimer = 0;
let cmtWatchdog = 0;
/* 重挂（re-arm）状态：评论区 iframe（www.lofter.com/comment.do）是旧式
 * 服务端渲染页，解析时会 document.write() —— 隐式 document.open() 会
 * 清空文档、连带抹掉挂在 document/html 上的监听与已注入的 <style>，
 * 而 content script 每帧只跑一次。故模块必须可重入：定时对比
 * document.documentElement 引用，一旦换过（或样式表被抹掉）就重跑一遍。*/
let cmtStorageBound = false; /* storage.onChanged 只绑一次 */
let cmtProbeBound = false; /* 调试桥挂 window，只绑一次（window 不随文档换） */
let cmtDocEl = null; /* 上次挂载时的 documentElement 引用 */
/* 官方黑名单 blogName 集合（小写）：来自 storage 镜像 lc_official_bl_v1
 * （popup 与 www 域页面帧都能调 DWR，子域页面帧调不通——所以用镜像，
 * 谁能调通谁写，评论过滤只读存储，任意帧都能用） */
let cmtOfficialNames = new Set();
const cmtHidden = new Set();
const cmtPrevDisplay = new WeakMap();
/* 空白收缩：LOFTER 的评论容器常按渲染时内容高度把 height/min-height 写死
 * （展开动画量完就定高），评论被隐藏后内容变矮、容器不跟着缩 —— tag 页
 * 表现为评论区下方一大块空白（2026-09-21 用户截图）。对「含被隐藏条目、
 * 且实际空白 >48px」的祖先挂 .lc-cmt-collapse 强制恢复 auto；等「查看更多」
 * 加载出新评论、空白消失后自动摘掉（每次 cmtApply 重算，自愈）。 */
const CMT_COLLAPSE_CLASS = 'lc-cmt-collapse';
const cmtCollapsed = new Set();
/* 分割线叠加修复（见 cmtSeamSync）：正常状态下每个行间隙恰好一条线，
 * 隐藏行撤掉后两个间隙合并、机制叠加就出粗线/双线。间隙里的线有两种
 * 摘除方式，各对应一个类：
 * - CMT_SEAM_HIDE_CLASS：间隙里的**独立分割线元素**（2026-09-21 tag 页
 *   实测为空的、高 ~1px 的 li，与评论行同类名）—— 多出来的整条藏掉；
 * - CMT_SEAM_CLASS：**行自身边框**（上一行 border-bottom + 下一行
 *   border-top 贴合）—— 摘掉下一行的 border-top。 */
const CMT_SEAM_CLASS = 'lc-cmt-seam';
const cmtSeamMarked = new Set();
const CMT_SEAM_HIDE_CLASS = 'lc-cmt-seam-hide';
const cmtSeamHidden = new Set();
const CMT_STYLE_ID = 'lc-cmt-filter-style';
/* 跨帧诊断中继的存储键（见文件后段 lcCmtPublishSelf）：content script 在
 * 任意帧共享 chrome.storage，用它当中继就不会去碰页面自己的 message 通道 */
const CMT_DIAG_KEY = 'lc_cmt_diag_v1';
const CMT_DIAG_REQ_KEY = 'lc_cmt_diag_req_v1';
/* 诊断快照：控制台调试桥（<html data-lc-probe>）读取，用于定位
 * 「选择器没命中 / id 没匹配上 / 标记被 React 洗掉」三类问题 */
const cmtDiag = {
  ran: false,
  err: '',
  style: false,
  docSwaps: 0,
  chain: [],
  avatars: 0,
  trace: [],
  unresolved: 0,
  scope: false,
  blocked: 0,
  official: 0,
  useOfficial: false,
  cmti: 0,
  bodies: 0,
  links: 0,
  matched: [],
  sample: [],
  items: 0,
  marked: 0,
  lifted: 0,
  collapsed: 0,
  seamHide: 0,
  seamBorder: 0,
  onlyAuthor: false,
  frameHost: '',
  /* 各评论区块解析出的楼主 id（wantDiag 窗口内才刷新）：与 sample
   * 对读可判断「只看作者」全空的定位错误——host 是浏览者自己=表单
   * 头像漏排除；host 是导航来源博客=referrer 污染；host 为空=卡片
   * 结构里找不到作者位 */
  areaHosts: [],
  /* tick 自身开销滚动计数（5s 窗口）：tick 次数 / 累计耗时，探针直读，
   * 用于实证「自激循环是否断净 / 单次 tick 在大文档上花多少」 */
  tickN: 0,
  tickMs: 0,
};
/* 重诊断窗口时间戳：lcCmtPublishSelf（探针入口）置位，cmtApply 在
 * 15s 内才跑全文档诊断扫描（平时只做轻量计数，见 wantDiag） */
let cmtDiagFresh = 0;
/* tick 计数累积器 */
const cmtPerf = { t0: 0, n: 0, ms: 0 };

/* www.lofter.com 下的功能路径首段不是博客 id：/tag/、/lpost/、/post/、
 * /d/ 等取出来是 'tag'/'lpost' 这类功能词。曾把 tag 卡片里「老福鸽儿」
 * 标签链接解析成楼主 id='tag'（真机 2026-09-24：只看作者全空——所有
 * 评论作者都 ≠ 'tag'，全体隐藏且 chip 正常点亮）。作者链接一律是博客
 * 子域形式，www 域下这些路径词直接判空 */
const CMT_WWW_PATH_WORDS = new Set([
  'tag', 'lpost', 'post', 'd', 'view', 'igoto', 'mentionredirect',
  'search', 'new', 'activity', 'apps', 'api', 'www',
]);

function cmtUserId(a) {
  try {
    const u = new URL(a.href, location.href);
    if (!/(^|\.)lofter\.com$/i.test(u.hostname)) return '';
    if (u.hostname !== 'www.lofter.com' && u.hostname !== 'lofter.com') {
      return u.hostname.split('.')[0] || '';
    }
    const segs = u.pathname.split('/').filter(Boolean);
    const seg = segs[0] || '';
    /* /blog/<id> 形式：真 id 在第二段（postmanage 页头 h1 链接即此形，
     * 真机 2026-09-27）——不处理会把 'blog' 当成 id */
    if (seg === 'blog') {
      const id = segs[1] || '';
      return id && !CMT_WWW_PATH_WORDS.has(id) ? id : '';
    }
    if (CMT_WWW_PATH_WORDS.has(seg)) return '';
    return seg;
  } catch (e) {
    return '';
  }
}

/* 头像锚点选择器：只用于诊断计数（cmtDiag.avatars / trace 的 a:）。
 * 注意评论区 iframe 的真实结构里根本没有头像容器（实测 a:0），所以它
 * 不再参与条目容器判据（v1 曾用它，导致 comment.do 帧 matched 命中却
 * items=0）。条目收敛见 cmtFindItem 的「离散单元边界法」。 */
const CMT_AVATAR_SEL =
  '.bcmtimg, [class*="cmtimg"], .w-img2, [class*="w-img"]';

function cmtTagOf(el) {
  try {
    const cn =
      el.className && typeof el.className === 'string'
        ? el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cn ? '.' + cn : '');
  } catch (e) {
    return '?';
  }
}

/* 一个元素「自身或子树里」的正文锚点数（querySelectorAll 不含自身，
 * 而 .bcmtlstf 在评论区是作者名后那个「：」，会自己就是锚点） */
function cmtBodyCount(el) {
  try {
    return (
      el.querySelectorAll('.bcmtlstf, .cmthot').length +
      (el.matches && el.matches('.bcmtlstf, .cmthot') ? 1 : 0)
    );
  } catch (e) {
    return 0;
  }
}

/* 收敛不到容器时记录逐层计数（诊断用）：
 * b=本层正文锚点数、pb=父层正文锚点数（b<pb 的那一层就是行边界）、
 * a=头像数、l=博客链接数 */
function cmtTraceChain(link) {
  const out = [];
  try {
    let el = link.parentElement;
    for (let i = 0; el && el !== document.body && i < 6; i++, el = el.parentElement) {
      let links = 0;
      Array.prototype.forEach.call(el.querySelectorAll('a[href]'), (a) => {
        if (cmtUserId(a)) links += 1;
      });
      const p = el.parentElement;
      out.push(
        cmtTagOf(el) +
          '{b:' + cmtBodyCount(el) +
          ' pb:' + (p ? cmtBodyCount(p) : -1) +
          ' a:' + el.querySelectorAll(CMT_AVATAR_SEL).length +
          ' l:' + links + '}',
      );
    }
  } catch (e) {}
  return out;
}

function cmtFindItem(link) {
  /* 1) 明确的条目容器类名（新式 .cmti / 评论区 iframe 的 .bcmti） */
  const direct = link.closest('.cmti, .bcmti, .bcmt-item');
  if (direct) return direct;
  /* 2) 「离散单元」边界法向上收敛（2026-09-21 按真实 TRACE 定稿）。
   *    评论区 iframe 的实测结构：
   *      li.s-bd2.s-bg2{b:2} > div.bcmtlsta > … > div.bcmtlstj > span.itag
   *      ul.clearfix.ztag{b:78} > li ×N
   *    唯一的可靠边界是 **li → ul 那一刻正文锚点数从 2 跳到 78**：某层的
   *    祖先里只要多出「本层之外的正文」，本层就是一条完整评论。
   *    该结构里没有头像容器（a:0，旧的头像判据在这里恒等于失效），也不该
   *    猜混淆类名，所以判据改成「父层正文数 > 本层正文数 ⇒ 本层是离散单元」，
   *    再加「父层是 ul/ol/dl ⇒ 本层是列表项」兜住单条评论的列表。
   *    安全阀：本层正文数 >4 说明一条评论不该有这么多正文（已越级），
   *    返回 null——宁漏杀不误杀；上行上限 12 层。 */
  let el = link.parentElement;
  let lastCand = null;
  for (let i = 0; el && el !== document.body && i < 12; i++, el = el.parentElement) {
    if (!el.querySelectorAll) continue;
    const cur = cmtBodyCount(el);
    if (cur < 1) continue; /* 还在作者名小块里（无正文），不算条目 */
    if (cur > 4) return null; /* 已越级到评论列表 */
    const p = el.parentElement;
    if (!p) break;
    if (p.tagName === 'UL' || p.tagName === 'OL' || p.tagName === 'DL') return el;
    if (cmtBodyCount(p) > cur) return el; /* 父层含本单元之外的内容 */
    lastCand = el; /* 纯包裹层（父层内容与本层相同），继续上爬 */
  }
  return lastCand;
}

/* @提及 / 引用回链不是作者链接：主站给这类链接挂 loftermentionblogid
 * 属性、class 含 atbox（f-atbox s-fc2），href 走 mentionredirect。
 * 逐个特征判，避免正文里引用别人主页时误杀整条评论。 */
function cmtIsMention(a) {
  if (a.hasAttribute('loftermentionblogid')) return true;
  if (a.className && /(^|\s)f-atbox(\s|$)/.test(a.className)) return true;
  const h = a.getAttribute('href') || '';
  return /mentionredirect/i.test(h);
}

/* 判定一个链接是否为「评论作者」而不是正文里的引用：
 * - @提及/引用回链直接排除；
 * - 作者名容器（.cmtusr / .bcmtusr）与头像容器（.w-img2）里的链接是作者；
 * - 内联布局「作者名：正文…」里作者链接就是正文元素内的第一个非提及
 *   链接，取其后的一律视为正文引用（防止正文里贴了被屏蔽者主页链接
 *   而误杀整条评论）。 */
function cmtIsAuthorLink(a) {
  if (cmtIsMention(a)) return false;
  if (a.closest('[class*="cmtusr"]')) return true;
  if (a.closest('.w-img2, [class*="w-img"]')) return true;
  const body = a.closest('.bcmtlstf, .cmthot');
  if (body) {
    const first = Array.prototype.find.call(
      body.querySelectorAll('a[href]'),
      (x) => !cmtIsMention(x),
    );
    return first === a;
  }
  return true; /* 不在正文元素内，交由 cmtFindItem 按容器收敛 */
}

/* 行内（旧式）结构里，作者链接 = 该条评论里**第一个**非提及博客链接
 * （头像链接或作者名链接，二者同属作者）；其后出现的博客链接都视为正文
 * 里的引用。评论区 iframe 实测一行最多 7 个博客链接（头像、作者名、
 * 回复 @xx…），若不设这道栏，正文里贴了被屏蔽者的主页链接就会把别人的
 * 整行评论藏掉（False positive 比漏杀更糟，用户此前专门验证过 @提及
 * 不误杀）。位置判定需要先收敛出条目容器，所以单独成函数在收敛后调用。 */
function cmtIsRowAuthor(a, row) {
  if (a.closest('[class*="cmtusr"]') || a.closest('.w-img2, [class*="w-img"]')) {
    return true;
  }
  if (!row || !row.querySelectorAll) return true;
  const all = row.querySelectorAll('a[href]');
  for (let i = 0; i < all.length; i++) {
    const x = all[i];
    if (cmtIsMention(x) || !cmtUserId(x)) continue;
    return x === a;
  }
  return false;
}

/* 行单位提升：把「命中的元素」抬到它所在的那一行（行容器）再隐藏。
 * 2026-09-21 tag 页探针实证：命中的是 div.cmti，而它独居于 li.a-slide 内，
 * 该 li 自身带 `border-top: solid 0.571px`、内层隐藏后**自己仍高 1px 且可见**
 * —— 只藏 .cmti 会留下 li 这条上边框，与下一行自己的 border-top 贴在一起
 * （每行都画自己的上边框）→ 分割线看起来更粗。抬到 li 整行隐藏，残影边框
 * 与那 1px 高度一并消失。
 * 抬升判据是结构性的：**父层只包着当前这一个元素** ⇒ 父层的内容就是这一行，
 * 所以不猜类名、也不看边框；UL/OL/表格与 body/html 一律不抬（那是列表容器
 * 或文档根，不是行）；最多 6 层，防止意外爬到过大的容器上。 */
function cmtRowUnit(el) {
  let cur = el;
  for (let i = 0; i < 6; i++) {
    const p = cur.parentElement;
    if (!p || p === document.body || p === document.documentElement) break;
    const tag = p.tagName;
    if (
      tag === 'UL' ||
      tag === 'OL' ||
      tag === 'TABLE' ||
      tag === 'TBODY' ||
      tag === 'THEAD' ||
      tag === 'TR'
    ) {
      break;
    }
    if (p.children.length !== 1) break; /* 父层还装着别的元素：不是行容器 */
    cur = p;
  }
  return cur;
}

function cmtHide(el) {
  if (!cmtPrevDisplay.has(el)) cmtPrevDisplay.set(el, el.style.display);
  el.setAttribute('data-lc-cmt-filtered', '1');
  el.style.setProperty('display', 'none', 'important');
}

function cmtUnhide(el) {
  if (!el.hasAttribute('data-lc-cmt-filtered')) return;
  el.removeAttribute('data-lc-cmt-filtered');
  const prev = cmtPrevDisplay.get(el);
  if (prev) el.style.display = prev;
  else el.style.removeProperty('display');
  cmtPrevDisplay.delete(el);
}

/* 看门狗：React 重渲染把内联样式/标记/类名洗掉时补写回来（1.2s，只遍历
 * 自己隐藏过的那几个条目与收缩过的容器，开销可忽略） */
function cmtStartWatchdog() {
  if (cmtWatchdog) return;
  cmtWatchdog = setInterval(() => {
    if (!cmtHidden.size && !cmtCollapsed.size) return;
    cmtHidden.forEach((el) => {
      if (!el.isConnected) {
        cmtHidden.delete(el);
        return;
      }
      if (el.style.getPropertyValue('display') !== 'none') {
        el.setAttribute('data-lc-cmt-filtered', '1');
        el.style.setProperty('display', 'none', 'important');
      }
    });
    /* 收缩类被重渲染洗掉时补挂；但只补「还藏着隐藏条目」的容器，
     * 与 cmtCollapseSync 的摘类策略一致（状态判据，非测量判据） */
    cmtCollapsed.forEach((el) => {
      if (!el.isConnected) {
        cmtCollapsed.delete(el);
        return;
      }
      let hasHidden = false;
      cmtHidden.forEach((item) => {
        if (el.contains(item)) hasHidden = true;
      });
      if (!hasHidden) {
        cmtCollapsed.delete(el);
        el.classList.remove(CMT_COLLAPSE_CLASS);
        return;
      }
      if (!el.classList.contains(CMT_COLLAPSE_CLASS)) {
        el.classList.add(CMT_COLLAPSE_CLASS);
      }
    });
    cmtDiag.marked = cmtHidden.size;
    cmtDiag.collapsed = cmtCollapsed.size;
  }, 1200);
}

/* 一个容器的「实际空白高度」：clientHeight 减去可见子元素的 offsetHeight
 * 与上下 padding。display:none 的子元素不计入 —— 残留的空白就是这个差值 */
function cmtBlankOf(el) {
  try {
    let sum = 0;
    Array.prototype.forEach.call(el.children, (c) => {
      if (getComputedStyle(c).display === 'none') return;
      sum += c.offsetHeight;
    });
    const cs = getComputedStyle(el);
    const pad =
      (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    return el.clientHeight - pad - sum;
  } catch (e) {
    return 0;
  }
}

/* 收缩同步：对每个被隐藏条目的祖先（≤6 层）测量空白，>48px 才挂收缩类。
 * 摘类条件是**状态**而非测量：只要容器里还有本插件隐藏的条目就保持收缩。
 * —— 绝不能按「测得空白 ≤48 就摘」：LOFTER 自己的定高/展开脚本会反复
 * 重写容器内联高度，一摘一挂就和它拉锯，表现为空白不停缩回展开地抖
 * （2026-09-21 用户实测）。带 !important 的类永远压得过它的内联样式，
 * 挂上后它写什么都无效，拉锯自然停止；等容器里没有隐藏条目了（名单
 * 清空 / 关闭开关 / 「查看更多」后我们不再隐藏任何行）才恢复原状。 */
function cmtCollapseSync() {
  const cands = new Set();
  cmtHidden.forEach((item) => {
    let el = item.parentElement;
    for (
      let i = 0;
      el && el !== document.body && i < 6;
      i++, el = el.parentElement
    ) {
      cands.add(el);
    }
  });
  cands.forEach((el) => {
    if (el === document.body || el === document.documentElement) return;
    if (cmtCollapsed.has(el)) return; /* 已收缩：保持，不反复摘挂 */
    if (cmtBlankOf(el) > 48) {
      el.classList.add(CMT_COLLAPSE_CLASS);
      cmtCollapsed.add(el);
    }
  });
  cmtCollapsed.forEach((el) => {
    if (!el.isConnected) {
      cmtCollapsed.delete(el);
      return;
    }
    let hasHidden = false;
    cmtHidden.forEach((item) => {
      if (el.contains(item)) hasHidden = true;
    });
    if (!hasHidden) {
      cmtCollapsed.delete(el);
      el.classList.remove(CMT_COLLAPSE_CLASS);
    }
  });
  cmtDiag.collapsed = cmtCollapsed.size;
}

/* 分割线叠加修复（统一算法）。探针实证（2026-09-21）：tag 页隐藏元素是
 * div.cmti，prev/next 均为 null —— 它是父级 li 里唯一的子元素，行单位是
 * 父级 li，**在 .cmti 层找兄弟永远落空**。因此先做行单位提升（cmtSeamUnit：
 * 自身没有元素兄弟就向上找，≤6 层），再在行单位层面处理。
 *
 * 间隙清点：隐藏行撤掉后，相邻两行之间的「线」可能来自三种机制 ——
 * 独立分割线元素（空、高 ≤2px 的 li）、上一行的 border-bottom、下一行的
 * border-top。正常状态下每个间隙恰好一条线；隐藏后两个间隙合并，机制
 * 叠加就出粗线/双线。规则：数出每个可见间隙的线总数，**超出 1 条的逐个
 * 摘除 —— 优先摘分割线元素，不够再摘下一行的 border-top**（有分割线时
 * 不动边框、只有双边框时才摘边框，避免「只有上边框/只有下边框」设计里
 * 把唯一的线删掉）。
 * 边框测量用 computed style，读不到时回退行内样式（jsdom 等无布局环境）。
 * 标记每次全量重算：隐藏集合变化后自动还原。 */
function cmtBorderW(el, top) {
  /* 必须「确实有可见边框样式」才算数：jsdom 对无边框元素会给出
   * border-width:16px 的幽灵值（border-style 仍是 none），真机上
   * border-style:none 时宽度也为 0 —— 用 style 判据一并挡掉。 */
  const pick = (cs, inline) => {
    let st = '';
    let w = 0;
    try {
      st = String(
        (top ? cs.borderTopStyle : cs.borderBottomStyle) || '',
      ).toLowerCase();
      w = parseFloat(top ? cs.borderTopWidth : cs.borderBottomWidth) || 0;
    } catch (e) {}
    if (!st && inline) {
      st = String(
        (top ? inline.borderTopStyle : inline.borderBottomStyle) || '',
      ).toLowerCase();
      if (!w) w = parseFloat(top ? inline.borderTopWidth : inline.borderBottomWidth) || 0;
    }
    if (!st || st === 'none' || st === 'hidden') return 0;
    return w > 0 ? w : 0;
  };
  try {
    const v = pick(getComputedStyle(el), el.style);
    if (v > 0) return v;
  } catch (e) {}
  return pick({}, el.style);
}

/* 行单位提升：与隐藏用的 cmtRowUnit 共用同一判据，避免两套口径分叉
 * （隐藏已抬到行单位后，这里通常原样返回） */
function cmtSeamUnit(el) {
  return cmtRowUnit(el);
}

function cmtHasHiddenRow(el) {
  if (!el) return false;
  if (cmtHidden.has(el)) return true;
  let has = false;
  cmtHidden.forEach((item) => {
    if (!has && el.contains(item)) has = true;
  });
  return has;
}

function cmtIsDividerEl(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.classList.contains(CMT_SEAM_HIDE_CLASS)) return true;
  try {
    if ((el.textContent || '').trim() !== '') return false;
    const h = el.offsetHeight;
    return h > 0 && h <= 2;
  } catch (e) {
    return false;
  }
}

function cmtSeamSync() {
  const units = new Set();
  cmtHidden.forEach((el) => units.add(cmtSeamUnit(el)));
  const parents = new Set();
  units.forEach((u) => {
    if (u.parentElement) parents.add(u.parentElement);
  });
  const wantHide = new Set();
  const wantSeam = new Set();
  parents.forEach((p) => {
    /* 可见子元素序列（含隐藏行的子树视作不存在） */
    const kids = [];
    Array.prototype.forEach.call(p.children, (c) => {
      if (cmtHasHiddenRow(c)) return;
      kids.push(c);
    });
    /* 第 1 步：连续的分割线元素只留最靠上的一条（其余藏掉） */
    let runStart = -1;
    for (let i = 0; i <= kids.length; i++) {
      const isDiv = i < kids.length && cmtIsDividerEl(kids[i]);
      if (isDiv) {
        if (runStart < 0) {
          runStart = i;
        } else {
          wantHide.add(kids[i]);
        }
      } else {
        runStart = -1;
      }
    }
    /* 第 2 步：两行之间的间隙若仍有 >1 条线（分割线 + 行边框叠加），
     * 先摘分割线，不够再摘下一行的 border-top */
    for (let i = 0; i < kids.length; i++) {
      if (cmtIsDividerEl(kids[i])) continue;
      const divs = [];
      let j = i + 1;
      while (j < kids.length && cmtIsDividerEl(kids[j])) {
        divs.push(kids[j]);
        j += 1;
      }
      if (j >= kids.length) break;
      const a = kids[i];
      const b = kids[j];
      /* 保留下来的分割线数 */
      let lines = 0;
      divs.forEach((d) => {
        if (!wantHide.has(d)) lines += 1;
      });
      if (cmtBorderW(a, false) > 0) lines += 1;
      if (cmtBorderW(b, true) > 0) lines += 1;
      if (lines > 1) {
        let excess = lines - 1;
        for (let k = divs.length - 1; k >= 0 && excess > 0; k--) {
          if (!wantHide.has(divs[k])) {
            wantHide.add(divs[k]);
            excess -= 1;
          }
        }
        if (excess > 0) wantSeam.add(b);
      }
      i = j - 1;
    }
  });
  wantHide.forEach((el) => {
    el.classList.add(CMT_SEAM_HIDE_CLASS);
    cmtSeamHidden.add(el);
  });
  cmtSeamHidden.forEach((el) => {
    if (!wantHide.has(el) || !el.isConnected) {
      el.classList.remove(CMT_SEAM_HIDE_CLASS);
      cmtSeamHidden.delete(el);
    }
  });
  wantSeam.forEach((el) => {
    el.classList.add(CMT_SEAM_CLASS);
    cmtSeamMarked.add(el);
  });
  cmtSeamMarked.forEach((el) => {
    if (!wantSeam.has(el) || !el.isConnected) {
      el.classList.remove(CMT_SEAM_CLASS);
      cmtSeamMarked.delete(el);
    }
  });
  cmtDiag.seamHide = cmtSeamHidden.size;
  cmtDiag.seamBorder = cmtSeamMarked.size;
}

function cmtApply() {
  const f = cmtSettings && cmtSettings.filter;
  const on = !!(
    cmtSettings &&
    cmtSettings.enabled &&
    f &&
    f.enabled &&
    f.scope &&
    f.scope.comment
  );
  const useOfficial = !!(
    cmtSettings &&
    cmtSettings.official &&
    cmtSettings.official.hideInComments
  );
  const blocked = new Set(
    on
      ? (f.users || [])
          .map((u) => String(u.id || '').toLowerCase())
          .filter(Boolean)
      : [],
  );
  /* 官方黑名单成员（面板开关「评论区也隐藏黑名单用户」）并入名单：
   * 官方拉黑 = 服务端隔离，但别人的帖子评论区不在隔离范围，评论仍可见 */
  if (on && useOfficial) {
    cmtOfficialNames.forEach((n) => blocked.add(String(n).toLowerCase()));
  }
  /* 评论区增强「只看作者」：独立于关键词过滤开关（属 comment 工具行，
   * 不是 filter.scope.comment 的下游），但共用同一套定位/隐藏脚手架。
   * 早退门禁必须合并判断——只看作者开启时即便屏蔽名单为空也不能早退
   * （handoff 4.2 坑 1：否则「名单为空 + 只看作者开」一点效果都没有）。 */
  const onlyOn = cmtEnhanceOn() && cmtOnlyAuthorOn;
  /* 隐藏判据：屏蔽名单命中 或（只看作者开启 且 该行作者 ≠ 楼主）。
   * 楼主未知 / 行作者未知一律不隐藏（宁漏杀不误杀）。 */
  const wantHide = (id, row) => {
    if (on && blocked.has(id)) return true;
    if (onlyOn) {
      const host = cmtRowHost(row);
      if (host && id && id !== host) return true;
    }
    return false;
  };

  let st = document.getElementById(CMT_STYLE_ID);
  if (!st) {
    st = document.createElement('style');
    st.id = CMT_STYLE_ID;
    (document.head || document.documentElement).appendChild(st);
  }
  /* 等值不写：textContent 赋非空值时哪怕内容一字不差，DOM 规范也是
   * 「先删光子节点再插新文本节点」，必产生 childList 变异 → 观察器唤醒
   * → 120ms 后再 tick → 再重写……自激 tick 循环（tag 页主线程被永久
   * 打断，展开/收起卡顿、表情面板迟钝的真凶；真机 2026-09-24 实锤：
   * 节流+其他守卫全上了仍卡，就剩这一处每 tick 必写） */
  const filterCss = on || onlyOn
    ? '[data-lc-cmt-filtered] { display: none !important; }\n' +
      '.' +
      CMT_COLLAPSE_CLASS +
      ' { height: auto !important; min-height: 0 !important; max-height: none !important; }\n' +
      '.' +
      CMT_SEAM_CLASS +
      ' { border-top-width: 0 !important; }\n' +
      '.' +
      CMT_SEAM_HIDE_CLASS +
      ' { display: none !important; }'
    : '';
  if (st.textContent !== filterCss) st.textContent = filterCss;

  /* 重诊断查询（.cmti 计数 / 链采样 / 结构自省等 5 轮全文档扫描）只在
   * 探针要数据的 15s 窗口内跑：平时每 tick 白扫 tag 页大文档，是展开
   * 动画期间 8Hz tick 的固定开销。探针入口 lcCmtPublishSelf 会置时间戳 */
  const wantDiag = Date.now() - cmtDiagFresh < 15000;
  cmtDiag.scope = on;
  cmtDiag.onlyAuthor = onlyOn;
  cmtDiag.frameHost = cmtFrameHost || '';
  cmtDiag.blocked = blocked.size;
  cmtDiag.official = cmtOfficialNames.size;
  cmtDiag.useOfficial = useOfficial;
  cmtDiag.err = '';
  cmtDiag.style = !!document.getElementById(CMT_STYLE_ID);
  cmtDiag.trace = [];
  cmtDiag.unresolved = 0;
  if (wantDiag) {
    cmtDiag.cmti = document.querySelectorAll('.cmti').length;
    cmtDiag.bodies = document.querySelectorAll('.bcmtlstf, .cmthot').length;
    cmtDiag.avatars = document.querySelectorAll(CMT_AVATAR_SEL).length;
    cmtDiag.areaHosts = [];
    try {
      document.querySelectorAll('[data-lc-cmt-area]').forEach((r) => {
        cmtDiag.areaHosts.push(cmtAreaHost.get(r) || '');
      });
    } catch (e) {}
    /* 被隐藏行的作者 id（前 6 行）：与 areaHosts 对读即可判定「只看
     * 作者」误杀类型——host 错（host 不在评论区作者集合里）还是行
     * 作者 id 解析错（隐藏行作者与 host 本该相等） */
    cmtDiag.hiddenAuthors = [];
    try {
      let hn = 0;
      cmtHidden.forEach((el) => {
        if (hn >= 6) return;
        hn += 1;
        const a = el.querySelector('a[href]');
        cmtDiag.hiddenAuthors.push(a ? cmtUserId(a) : '');
      });
    } catch (e) {}
    /* 条目结构自省：从第一个正文锚点向上列 5 层 tag.className，用于核对
     * 真实容器类名（换结构时不至于只能靠猜）。 */
    cmtDiag.chain = [];
    try {
      let cel = document.querySelector('.bcmtlstf, .cmthot');
      for (let i = 0; cel && i < 5; i++, cel = cel.parentElement) {
        cmtDiag.chain.push(cmtTagOf(cel));
      }
    } catch (e) {}

    /* 作者 id 采样：名单为空（blocked=0）时也能从探针判断「选择器与 id
     * 解析是否正常」——若 sample 非空说明链接抓得到，只是没人被屏蔽。 */
    const sample = [];
    try {
      document
        .querySelectorAll(
          '.cmti .cmtusr a[href], .cmti .w-img2 a[href], [class*="cmtusr"] a[href]',
        )
        .forEach((a) => {
          if (sample.length >= 5) return;
          const sid = cmtUserId(a);
          if (sid && sample.indexOf(sid) < 0) sample.push(sid);
        });
    } catch (e) {}
    cmtDiag.sample = sample;
  }

  if ((!on || !blocked.size) && !onlyOn) {
    /* 关闭路径：全部隐藏撤销还原（主路径走差量，不走这里） */
    cmtHidden.forEach((el) => cmtUnhide(el));
    cmtHidden.clear();
    cmtDiag.links = 0;
    cmtDiag.matched = [];
    cmtDiag.items = 0;
    cmtDiag.marked = 0;
    cmtCollapseSync(); /* 隐藏全撤销后，收缩容器也随之还原 */
    cmtSeamSync(); /* 分割线/边框叠加修复类同步摘除 */
    if (cmtWatchdog) {
      clearInterval(cmtWatchdog);
      cmtWatchdog = 0;
    }
    return;
  }

  const items = new Set();
  const linkIds = [];
  const matched = [];
  /* 逐链接 try/catch：任一异常都不能中断整批标记 */
  const guard = (fn) => {
    try {
      fn();
    } catch (e) {
      cmtDiag.err = String(e);
    }
  };

  /* A) 新式 .cmti 条目：行级首链决策——每行只由它的第一个有效作者链
   * 接决定藏/留。回复行（「A 回复了 B：…」）里被回复者的链接也在作者
   * 名容器内，若每个链接各判各的，作者本人的回复行会被「回复目标 ≠
   * 楼主」误杀（真机 2026-09-24：作者的回复在只看作者下消失） */
  const decidedRows = new Set();
  guard(() => {
    document
      .querySelectorAll('.cmti .cmtusr a[href], .cmti .w-img2 a[href]')
      .forEach((a) => {
        const id = cmtUserId(a);
        if (!id) return;
        linkIds.push(id);
        const item = a.closest('.cmti');
        if (item && decidedRows.has(item)) return; /* 本行已判，后链不再看 */
        if (!wantHide(id, item)) {
          if (item) decidedRows.add(item);
          return;
        }
        matched.push(id);
        if (item) {
          decidedRows.add(item);
          items.add(item);
        }
      });
  });

  /* B) 旧式 / 评论区 iframe 条目：扫链接，靠 cmtIsAuthorLink 判定
   * 作者位置（新式 .cmti 由上面那条更严的位置限定分支处理）。
   * 扫描范围收敛：评论区都标了 data-lc-cmt-area（cmtTbSync 先跑），
   * 只扫这些根内的链接——tag 页全文档几千条链接每 tick 扫一遍是展开
   * 动画掉帧的大头；没有任何标记根时（工具行关、纯过滤模式）退回
   * 全文档扫，保持旧覆盖面 */
  guard(() => {
    const decidedB = new Set(); /* 行级首链决策（同 A 分支，防回复目标误杀） */
    const scanLinks = (root) => {
      root.querySelectorAll('a[href]').forEach((a) => {
        if (a.closest('.cmti')) return; /* 已由新式分支处理 */
        if (!cmtIsAuthorLink(a)) return;
        const id = cmtUserId(a);
        if (!id) return;
        linkIds.push(id);
        const item = cmtFindItem(a);
        if (item && decidedB.has(item)) return;
        if (!wantHide(id, item)) {
          if (item) decidedB.add(item);
          return;
        }
        matched.push(id);
        if (!item) {
          /* 命中名单却收敛不到条目容器：记逐层计数，供诊断定位 */
          cmtDiag.unresolved += 1;
          if (cmtDiag.trace.length < 2) {
            cmtDiag.trace.push({ id, chain: cmtTraceChain(a) });
          }
        } else if (cmtIsRowAuthor(a, item)) {
          decidedB.add(item);
          items.add(item);
        }
      });
    };
    const areas = document.querySelectorAll('[data-lc-cmt-area]');
    if (areas.length) {
      areas.forEach((r) => scanLinks(r));
    } else {
      scanLinks(document);
    }
  });

  /* 差量隐藏：只写「该藏还没藏」「该露还没露」的行。此前是每 tick 先
   * 撤销全部隐藏再重打——只要有行真被藏住（只看作者 / 屏蔽命中），
   * 每 tick 必产生成批 style 变异 → 观察器 → 再 tick……自激循环第二
   * 处（真机 2026-09-24：面板打开快、关闭/只看作者/从旧到新触发慢，
   * 正是「点击后有行被藏 → 循环启动 → 之后一切操作都钝」） */
  const units = new Set();
  items.forEach((el) => {
    /* 抬到行单位再整行隐藏：否则残留行容器的上边框会与下一行叠成粗线
     * （见 cmtRowUnit 注释） */
    const unit = cmtRowUnit(el);
    if (unit !== el) cmtDiag.lifted += 1;
    units.add(unit);
  });
  const dropUnits = [];
  cmtHidden.forEach((el) => {
    if (!units.has(el) || !el.isConnected) {
      cmtUnhide(el);
      dropUnits.push(el);
    }
  });
  dropUnits.forEach((el) => cmtHidden.delete(el));
  units.forEach((unit) => {
    if (!cmtHidden.has(unit)) {
      cmtHide(unit);
      cmtHidden.add(unit);
    }
  });
  cmtCollapseSync(); /* 隐藏后收缩残留空白（定高容器不随内容变矮） */
  cmtSeamSync(); /* 隐藏后：分割线元素/行边框叠加 → 间隙只留一条线 */
  cmtDiag.links = linkIds.length;
  cmtDiag.matched = Array.from(new Set(matched)).slice(0, 20);
  cmtDiag.items = items.size;
  cmtDiag.marked = cmtHidden.size;
  if (items.size) cmtStartWatchdog();
  else if (cmtWatchdog) {
    clearInterval(cmtWatchdog);
    cmtWatchdog = 0;
  }
}

/* ---------- 评论区工具行（只看作者 / 从旧到新 / 表情入口）----------
 * 设计定稿（2026-09-22 与作者对齐）：
 * - 落位：评论输入框正上方，宽度对齐输入框——表情按钮右缘 = 输入框
 *   右缘，「发布」上方刻意留白（工具行整行属于输入框，不属于发布键）。
 *   输入框与发布键同行的场景（首页/tag 页）量测后用 margin-right 让位。
 * - 无外框融入样式：未激活 = 灰字无边框（中性灰，反色后自然可读，
 *   故不需要预反色处理），hover 提亮；激活 = 浅底胶囊（强调色 12%
 *   透明底 + 同色文字）。
 *   强调色固定为插件面板同款蓝紫 #7c80d2（2026-09-24 与作者对齐：
 *   选中态与 popup 面板统一；此前取的是站点作者链接色，改掉了）。
 *   暗色下工具行位于反色区内，写预反色值（见 cmtTbApplyAccent）。
 * - 排序「从旧到新」走 CSS column-reverse（零 DOM 改写，天然抗 React
 *   重渲染），只作用于已加载的评论；「查看更多」追加的更旧评论会被
 *   一并纳入反转、视觉出现在顶部，与「从旧到新」语义一致。
 *   外缘线补偿：站点若用 first-child 规则压掉首行上边框，反转后视觉
 *   顶行（DOM 末行）会出现多余线 → 运行时检测并把 DOM 末行上边框归零。
 * - 状态不跨帖保留：锚定的输入框全部换新（翻到另一帖）即复位。
 * - 表情快捷输入（#9）：右缘对齐输入框的入口按钮 + 面板，见下方
 *   「表情快捷输入」段；开关跟随本工具行总开关，不单列。
 * - 楼主 id 分层探测：帧级（博客子域 / comment.do referrer / URL 参数）
 *   → 区块级 DOM（评论区块向上找第一个非评论区博客链接 = 帖子作者位）。
 *   找不到时「只看作者」置灰，绝不瞎猜（误把别人当楼主比不支持更糟）。 */
const CMT_TB_STYLE_ID = 'lc-cmt-toolbar-style';
const CMT_REV_CLASS = 'lc-cmt-rev';
const CMT_REV_COMP_CLASS = 'lc-cmt-rev-comp';
/* 评论列表锚点：判定「这段是不是评论区」与收敛区块根 */
const CMT_LIST_SEL =
  '.cmti, .bcmti, .bcmt-item, .bcmtlsta, .bcmtlstf, .cmthot';
/* 评论输入框候选。必须同时满足「所在区块含评论列表锚点」才认定是
 * 评论输入框——排除首页发布框、搜索框等同形元素 */
const CMT_INPUT_SEL =
  'textarea, [contenteditable="true"], .bcmtipt, .editdiv';
let cmtOnlyAuthorOn = false; /* 只看作者（运行态，不跨帖保留） */
let cmtSortOn = false; /* 从旧到新（运行态，不跨帖保留） */
let cmtFrameHost = ''; /* 帧级楼主 id（子域 / referrer / URL 参数） */
let cmtFrameHostTried = false;
const cmtAreaHost = new WeakMap(); /* 区块根 → 楼主 id */
const cmtAreas = new Map(); /* 输入框元素 → { bar, formBlock, root } */
let cmtTbPrevInputs = null; /* 上一轮锚定的输入框集合（换帖复位判据） */
let cmtTbRevealT = 0; /* 显示兜底节拍：变异停了也要凑够「连续两轮稳定」 */

function cmtEnhanceOn() {
  /* 旧存储没有 comment 字段 = 默认开启（工具行是常驻体验，控件本身
   * 默认熄灭、不改变页面行为，所以能力开关可以放心默认开） */
  return !!(
    cmtSettings &&
    cmtSettings.enabled !== false &&
    (!cmtSettings.comment || cmtSettings.comment.toolbar !== false)
  );
}

/* 帧级楼主 id：主页查看全文 / 主页文章页的子域即楼主；comment.do 独立
 * 帧从 referrer（宿主帖子页通常是 xxx.lofter.com/lpost/...）与 URL 参数
 * 兜底。帧内不变，只算一次。
 * 关键限定：referrer/URL 参数兜底只允许在「文章帧」上用（路径含
 * lpost/post/d/comment.do）——首页/tag/发现这类 www 顶级页一帧几十个
 * 各不相干的卡片，没有统一楼主；若从博客页导航过来，referrer 还会把
 * 那个博客域名带进来污染整页（真机 2026-09-24：tag 页「只看作者」全
 * 空，正是 referrer 里残留的博客域被当成了全页楼主） */
function cmtFrameHostDetect() {
  if (cmtFrameHostTried) return cmtFrameHost;
  try {
    const m = location.hostname.match(/^([a-z0-9-]+)\.lofter\.com$/i);
    if (m && !/^(www|api)$/i.test(m[1])) {
      cmtFrameHost = m[1].toLowerCase();
      cmtFrameHostTried = true;
      return cmtFrameHost;
    }
    const isArticleFrame =
      /\/(lpost|post|d)\//.test(location.pathname) ||
      /comment\.do/i.test(location.pathname + location.search);
    if (!isArticleFrame) {
      cmtFrameHostTried = true;
      return cmtFrameHost;
    }
    const r = String(document.referrer || '').match(
      /^https?:\/\/([a-z0-9-]+)\.lofter\.com/i,
    );
    if (r && !/^(www|api)$/i.test(r[1])) {
      cmtFrameHost = r[1].toLowerCase();
      cmtFrameHostTried = true;
      return cmtFrameHost;
    }
    const q = new URLSearchParams(location.search);
    const keys = ['blogid', 'blogname', 'hostid', 'username'];
    for (let i = 0; i < keys.length; i++) {
      const v = (q.get(keys[i]) || '').toLowerCase();
      if (/^[a-z0-9][a-z0-9_-]{0,49}$/.test(v)) {
        cmtFrameHost = v;
        cmtFrameHostTried = true;
        return cmtFrameHost;
      }
    }
    /* www 顶级文章页（/lpost/…）嵌 comment.do 帧：referrer 是 www 被排除、
     * URL 参数只有 pid/bid 数字 id——帧级三层全空（真机 2026-09-27：专栏
     * 文章页只看作者置灰）。同源父文档兜底：comment.do 与 www 宿主同源，
     * 内容脚本可读父文档——定位自身 iframe 元素，沿父文档向上找博客链接
     * （与区块级探测同法）。跨源父帧（经典子域宿主）在 referrer 一层就已
     * 成功，走不到这里；parent 访问失败（跨源）同样安全跳过。
     * 注意不设 tried：父文档是 React 晚渲染，作者链接可能还没出来，
     * 留待下一次 sync 重试（成功才缓存） */
    if (window.parent && window.parent !== window) {
      let pdoc = null;
      try {
        pdoc = window.parent.document;
      } catch (e) {
        pdoc = null;
      }
      if (pdoc) {
        let anchor = null;
        try {
          const fr = pdoc.querySelectorAll('iframe');
          for (let i = 0; i < fr.length; i++) {
            try {
              if (fr[i].contentWindow === window) {
                anchor = fr[i];
                break;
              }
            } catch (e) {}
          }
        } catch (e) {}
        const id = anchor ? cmtHostFromDom(anchor, null) : '';
        if (id) {
          cmtFrameHost = id;
          cmtFrameHostTried = true;
          return cmtFrameHost;
        }
      }
    }
  } catch (e) {}
  return cmtFrameHost;
}

/* 区块级楼主 id：从评论区块向上找第一个「不在评论列表里」的博客链接
 * （帖子卡片/文章容器的作者位）。首页/tag 页一帧多卡片，各区块各算各。
 * @提及/引用回链与评论列表内的链接全部排除；skipEl（评论表单块）内的
 * 链接也排除——输入框旁挂的是浏览者自己的头像链接，不排除就会把
 * 「你自己」解析成楼主，只看作者时除了你自己的评论全被藏掉（真机
 * 2026-09-24：作者明明评论过，开启后仍全空）。 */
function cmtHostFromDom(root, skipEl) {
  try {
    let el = root;
    for (
      let i = 0;
      el && el !== document.body && el !== document.documentElement && i < 10;
      i++, el = el.parentElement
    ) {
      const links = el.querySelectorAll('a[href]');
      for (let j = 0; j < links.length; j++) {
        const a = links[j];
        if (cmtIsMention(a)) continue;
        if (skipEl && skipEl.contains(a)) continue;
        if (
          a.closest('.cmti, .bcmti, .bcmt-item, [class*="cmtlst"], [class*="cmtipt"]')
        ) {
          continue;
        }
        const id = cmtUserId(a);
        if (id) return id;
      }
    }
  } catch (e) {}
  return '';
}

/* 行的楼主 id：帧级优先（主页查看全文 / comment.do），否则查行所属
 * 区块在 cmtAreaHost 里的缓存（首页/tag 页多卡片场景） */
function cmtRowHost(row) {
  if (cmtFrameHost) return cmtFrameHost;
  try {
    const root = row && row.closest && row.closest('[data-lc-cmt-area]');
    if (root) {
      const h = cmtAreaHost.get(root);
      if (h) return h;
    }
  } catch (e) {}
  return '';
}

function cmtTbEnsureStyle() {
  let st = document.getElementById(CMT_TB_STYLE_ID);
  if (!st) {
    st = document.createElement('style');
    st.id = CMT_TB_STYLE_ID;
    (document.head || document.documentElement).appendChild(st);
  }
  const css =
    /* position+z-index：负 margin-bottom 把输入框包裹层提到工具行下半截
     * 之上（DOM 顺序靠后＝绘制更上），透明但会吃掉 chip 下半的点击——
     * 抬一层让工具行整行可点（真机已踩：只有文字偏上位置能点中） */
    '.lc-cmt-tb{display:flex;align-items:center;gap:2px;margin:0 0 1px;font-size:12px;line-height:1;' +
    'position:relative;z-index:1;visibility:hidden;}' +
    /* 浅锚（0 评论卡片）：工具行上方是站点 isay 气泡展开容器的
     * padding/margin，负 margin 抵消之，让工具行贴近上方分割线。
     * 经验值 -20px：宁少勿多——过量会把表情图标顶进分割线里 */
    '.lc-cmt-tb.lc-tb-shallow{margin-top:-20px;}' +
    '.lc-cmt-tb .lc-chip{appearance:none;-webkit-appearance:none;background:transparent;border:0;' +
    'padding:3px 9px;margin:0;border-radius:999px;font-family:inherit;font-size:12px;line-height:1.5;' +
    'color:var(--lc-cmt-muted,#8f8f8f);cursor:pointer;transition:color .15s,background-color .15s;}' +
    '.lc-cmt-tb.lc-ovh-l .lc-chip:first-child{margin-left:-9px;}' + /* 文字对齐输入框左缘（框已对齐，9px 是 chip 内边距）；仅当左缘有余量，贴视口边会裁切 */
    '.lc-cmt-tb .lc-chip:hover{color:var(--lc-cmt-strong,#5c5c5c);}' +
    '.lc-cmt-tb .lc-chip.lc-on{color:var(--lc-cmt-accent,#7c80d2);' +
    'background:var(--lc-cmt-accent-bg,rgba(124,128,210,.12));}' +
    '.lc-cmt-tb .lc-chip.lc-dis{opacity:.45;cursor:default;}' +
    '.lc-cmt-tb .lc-chip.lc-dis:hover{color:var(--lc-cmt-muted,#8f8f8f);}' +
    '.lc-cmt-tb .lc-emoji{margin-left:auto;appearance:none;-webkit-appearance:none;background:transparent;' +
    'border:0;padding:3px 0 3px 2px;cursor:pointer;color:var(--lc-cmt-muted,#8f8f8f);display:flex;' +
    'align-items:center;transition:color .15s;}' +
    /* 出界画法仅在有余量时启用：右缘贴视口时 padding-right 收 0，
     * 图标右缘正好落在输入框右缘上，不再被 iframe 视口裁切 */
    '.lc-cmt-tb.lc-ovh-r .lc-emoji{margin-right:-4px;padding-right:2px;}' +
    '.lc-cmt-tb .lc-emoji:hover{color:var(--lc-cmt-strong,#5c5c5c);}' +
    '.lc-cmt-tb .lc-emoji.lc-on{color:var(--lc-cmt-strong,#5c5c5c);}' +
    '.lc-cmt-tb .lc-emoji svg{width:16px;height:16px;display:block;}' +
    /* 最近表情行（2026-09-26，输入框正下方，模拟 App 端）：文字 chip。
     * 单行 nowrap + 超出即藏尾（个数按行宽自适应，名字长就少放）——
     * 不换行，换行会把评论区高度顶得一跳一跳。margin-top 负值上贴：
     * 官方表单块自带下边距，正值会显得离输入框很远（20260926b 真机） */
    '.lc-cmt-eprow{display:flex;flex-wrap:nowrap;align-items:center;gap:4px;margin-top:-6px;overflow:hidden;font-size:12px;}' +
    '.lc-cmt-eprow .lc-ep-rchip{appearance:none;-webkit-appearance:none;background:transparent;' +
    'border:1px solid rgba(140,140,150,.38);border-radius:999px;color:inherit;font:inherit;' +
    'font-size:12px;line-height:1;padding:4px 9px;cursor:pointer;white-space:nowrap;flex:0 0 auto;opacity:.85;}' +
    '.lc-cmt-eprow .lc-ep-rchip:hover{background:rgba(130,130,150,.14);opacity:1;}' +
    /* 深膜适配（2026-09-26 用户反馈）：浅色模式下卡面自适应材质切深膜
     * 后，工具行/快捷行的浅色模式深灰字在深底上看不见。靠 .lc-face-dark
     * 祖先选择器换肤（3 类权重 > 基础 2 类，无需 !important）；lc-on 的
     * 主题色在深膜上本来可见，保持不动（accent 变量由 cmtTbApplyAccent
     * 按反相状态算好） */
    '.lc-face-dark .lc-cmt-tb .lc-chip{color:rgba(255,255,255,.78);}' +
    '.lc-face-dark .lc-cmt-tb .lc-chip:hover{color:#fff;}' +
    '.lc-face-dark .lc-cmt-tb .lc-chip.lc-dis,.lc-face-dark .lc-cmt-tb .lc-chip.lc-dis:hover{color:rgba(255,255,255,.4);}' +
    '.lc-face-dark .lc-cmt-tb .lc-emoji{color:rgba(255,255,255,.85);}' +
    '.lc-face-dark .lc-cmt-tb .lc-emoji:hover,.lc-face-dark .lc-cmt-tb .lc-emoji.lc-on{color:#fff;}' +
    '.lc-face-dark .lc-cmt-eprow .lc-ep-rchip{border-color:rgba(255,255,255,.35);color:rgba(255,255,255,.88);}' +
    '.lc-face-dark .lc-cmt-eprow .lc-ep-rchip:hover{background:rgba(255,255,255,.14);color:#fff;}' +
    /* 排序：CSS 反转，零 DOM 改写。list-style 一并压掉（UL 在 flex 下
     * 的 marker 盒会顶出列表外） */
    '.' + CMT_REV_CLASS +
    '{display:flex !important;flex-direction:column-reverse !important;list-style:none !important;}' +
    /* 外缘线补偿：站点压掉首行上边框时，反转后视觉顶行（DOM 末行）
     * 会多出一条线 → 归零。是否需要由运行时检测决定（见 cmtSortSync） */
    '.' + CMT_REV_COMP_CLASS + ' > *:last-child{border-top-width:0 !important;}' +
    /* 页面级 toast（快捷「隐藏」的反馈/撤销） */
    '.lc-cmt-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);' +
    'z-index:2147483000;background:rgba(30,30,34,.92);color:rgba(255,255,255,.92);' +
    'font-size:13px;line-height:1.4;padding:9px 16px;border-radius:999px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;gap:12px;}' +
    '.lc-cmt-toast a{color:#8ea1ff;cursor:pointer;text-decoration:none;font-weight:600;}' +
    /* 快捷「隐藏」追加进官方 .cmtopt（float 收缩盒）会把键数从 4 变 5，
     * 总宽 136→170px，超出官方贴排临界宽 → 正文被挤换行、条目撑高
     * （2026-09-25 真机量测：键宽恒 24px、键距恒 10px）。把键距收到
     * 3px：5 键总宽 135px ≤ 136px，几何与官方行完全一致，正文零扰动。
     * :has() 门禁：功能关闭（按钮被摘）时官方间距原样保留 */
    '.cmti .cmtopt:has(a.lc-cmt-hide-btn) a{margin-left:3px !important;}';
  /* 等值不写：无条件重写文本节点会触发 MutationObserver → 再排 tick
   * → 又重写……自激 tick 循环，tag 页这类大文档上主线程被持续打断 */
  if (st.textContent !== css) st.textContent = css;
}

/* 强调色：固定用插件面板同款蓝紫（2026-09-24 与作者定稿：选中态与
 * popup 面板统一，不再取站点作者链接色）。
 * 反色区补偿：暗色管线的 invert+hue-rotate 会反转子树里的颜色，chip
 * 在反色区内，故暗色下写「预反色值」，屏幕上显示出来才是同一支蓝紫；
 * 面板挂在 documentElement（不在反色区）照直写原值。 */
function cmtTbApplyAccent(bar) {
  const accent =
    lcEpDark() && lcEpInverted(bar) ? lcEpInvertHex(EP_ACCENT) : EP_ACCENT;
  const v = parseInt(accent.slice(1), 16);
  const rgb =
    ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255);
  const bg = 'rgba(' + rgb + ',0.12)';
  /* 等值不写（自激 tick 循环防线，见 cmtTbEnsureStyle） */
  if (bar.style.getPropertyValue('--lc-cmt-accent') !== accent) {
    bar.style.setProperty('--lc-cmt-accent', accent);
  }
  if (bar.style.getPropertyValue('--lc-cmt-accent-bg') !== bg) {
    bar.style.setProperty('--lc-cmt-accent-bg', bg);
  }
}

/* 显示兜底：稳定性门槛要「连续两轮量测一致」，但 tick 由 DOM 变异驱动
 * ——布局安定后若不再变异就永远等不到第二轮。只要有工具行还没显示，
 * 就用短节拍自催 tick；全部显示后自停。 */
function cmtTbRevealWatch() {
  if (cmtTbRevealT) return;
  cmtTbRevealT = setInterval(() => {
    let pending = false;
    cmtAreas.forEach((rec) => {
      if (rec.bar && rec.bar.isConnected && rec.bar.style.visibility !== 'visible') {
        pending = true;
      }
    });
    if (!pending || !cmtEnhanceOn()) {
      clearInterval(cmtTbRevealT);
      cmtTbRevealT = 0;
      return;
    }
    cmtTick();
  }, 160);
}

/* 分页钮「真的在渲染」吗：站点加载完全部评论后未必移除按钮，常见做法
 * 是给外层包裹挂 display:none（元素仍连在 DOM 上）——只判 isConnected
 * 会误判成「还有更多」，工具行上的「加载更多评论」就残留不消失。
 * 沿祖先链查计算样式，任何一层 display:none 即视为不存在 */
function cmtPagerShown(el) {
  let n = el;
  while (n && n.nodeType === 1) {
    try {
      if (getComputedStyle(n).display === 'none') return false;
    } catch (e) {
      return true; /* 查不出就宁可信其有，行为与旧版一致 */
    }
    n = n.parentElement;
  }
  return true;
}

/* 候选元素的「真实可见文字」：textContent 把 display:none 子孙的文字
 * 也算进去——官方钮加载完被藏起后，可见外层包裹的 textContent 仍含
 * 钮文案，会顶成假命中（真机已踩）。逐层下钻，被藏起的子树不计入。
 * 注意只判 display:none：visibility 是继承属性，jsdom 的层叠计算
 * 不完整会把管线样式表的 hidden 错误继承过来（测试环境已踩），
 * 真实站点藏分页钮用的也是 display:none */
function cmtVisibleText(el) {
  try {
    if (getComputedStyle(el).display === 'none') return '';
  } catch (e) {
    return el.textContent || ''; /* 查不出就退回旧判据 */
  }
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent || '';
    else if (n.nodeType === 1) out += cmtVisibleText(n);
  });
  return out;
}

/* 找本区块的官方「查看更多」分页钮：按文案匹配（不依赖混淆类名），
 * 排除评论行内部的同文案文本（评论正文提到"查看更多"不误伤）与
 * 笔记（点赞/转载）列表的同文案分页（.notes /.more_notes_link，
 * 主页查看全文页实测踩过）。判定分两道：
 * ① 自身沿祖先链无 display:none（cmtPagerShown）；
 * ② 自身有真实可见的钮文案（cmtVisibleText）——主页模板里藏起的
 *    .bcmtmore 与可见的 a.s-fc2.ztag 是两个不相交的块，文档序在前的
 *    隐藏块若只按 contains 链选最内层会永久占位，可见官方钮永远
 *    替换不了它（真机已踩：「加载更多评论」键不出现）。命中多个时
 *    取最内层（不含其他可见候选者）。找不到返回 null */
function cmtFindPager(root) {
  const cands = [];
  const all = root.querySelectorAll('a,button,span,div');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.closest('.lc-cmt-tb')) continue;
    if (el.closest('.cmti, .bcmti, .bcmt-item')) continue;
    if (el.closest('.notes, .more_notes_link')) continue;
    const t = (el.textContent || '').trim();
    if (!t || t.length > 10 || !/^(查看更多|更多评论|加载更多)/.test(t)) {
      continue;
    }
    if (!cmtPagerShown(el)) continue;
    if (!/^(查看更多|更多评论|加载更多)/.test(cmtVisibleText(el).trim())) {
      continue;
    }
    cands.push(el);
  }
  for (let i = 0; i < cands.length; i++) {
    let innermost = true;
    for (let j = 0; j < cands.length; j++) {
      if (i !== j && cands[i].contains(cands[j])) {
        innermost = false;
        break;
      }
    }
    if (innermost) return cands[i];
  }
  return null;
}

/* 0 评论卡片的表单识别：祖先链（≤8 层）上类名/id 含 cmt（LOFTER
 * 评论族类名 .cmti/.bcmti/.cmtform/.bcmtipt 全带 cmt；搜索框不带）
 * → 认定是评论表单，可挂「仅表情」工具行。
 * 2026-09-25 补：tag/首页 0 评论卡片展开后的评论输入框
 * （.w-inputxt[contenteditable] + .w-bbtn 发布钮）整条祖先链是
 * isaym3/isaym2-do/isaym2-open/isay，一个 cmt 都没有——真机探针
 * 实锤 21/22 卡 NO_INPUT + 卡 3 被 Commentish 拦截。补认 isaym 系；
 * 但首页发布框复用 isay 系类名（buildCSS 7867-7875 证实），靠
 * publishArea/publishlayer 祖先明确排除 */
function cmtCommentishForm(el) {
  try {
    if (
      el.closest &&
      el.closest('#publishArea, .publishlayer, .publishlayerwrap, .publishMain')
    ) {
      return false;
    }
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 8; i++, n = n.parentElement) {
      const q =
        (typeof n.className === 'string' ? n.className : '') +
        ' ' +
        (n.id || '');
      if (/cmt/i.test(q)) return true;
      if (/isaym/i.test(q)) return true;
    }
  } catch (e) {}
  return false;
}
/* 浅锚终点：容器里出现 发布/评论 按钮就算到头（工具行插在它前面）。
 * 文本比较去空白——0 评论卡片的发布钮渲染为「发 布」（真机
 * DevTools 实锤），带空格时精确等值永远不中，浅锚会爬过头 */
function cmtHasPublishBtn(el) {
  try {
    const btns = el.querySelectorAll('button, [role="button"], a');
    for (let i = 0; i < btns.length; i++) {
      const t = (btns[i].textContent || '').replace(/\s+/g, '');
      if (t === '发布' || t === '评论') return true;
    }
  } catch (e) {}
  return false;
}

function cmtTbBuildBar() {
  const bar = document.createElement('div');
  bar.className = 'lc-cmt-tb';
  bar.setAttribute('data-lc-cmt-tb', '1');
  /* 注意：工具行自插入起保持恒定 footprint（满高度），对齐边距在
   * 插入的同一任务里同步应用——显示帧只切 visibility、零布局变化。
   * 曾试过「隐藏期零占位（height:0）、显示帧再恢复高度」，结果
   * 站点在展开动画期间量测评论区高度时看到中途变化的布局，反复
   * 开合后卡片位置漂移（A/B 实验证实：关开关循环完全稳定）。
   * 代价是插入到显示之间有一行 ~7px 的空白占位，可接受 */
  const mk = (act, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lc-chip';
    b.textContent = label;
    b.dataset.act = act;
    bar.appendChild(b);
    return b;
  };
  mk('only', '只看作者');
  mk('sort', '从旧到新');
  /* 「加载更多评论」：只在从旧到新点亮且官方分页存在时显示
   * （sync 里控制），点击 = 程序化触发官方按钮，加载全走站点原生 */
  const moreB = mk('more', '加载更多评论');
  moreB.classList.add('lc-more');
  moreB.style.display = 'none';
  moreB.title = '加载更多评论';
  const emoji = document.createElement('button');
  emoji.type = 'button';
  emoji.className = 'lc-emoji';
  emoji.dataset.act = 'emoji';
  emoji.title = '表情快捷输入';
  emoji.setAttribute('aria-label', '表情快捷输入');
  emoji.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
    '<circle cx="8" cy="8" r="6.2"/>' +
    '<circle cx="5.9" cy="6.6" r="0.7" fill="currentColor" stroke="none"/>' +
    '<circle cx="10.1" cy="6.6" r="0.7" fill="currentColor" stroke="none"/>' +
    '<path d="M5.4 9.7q2.6 2.1 5.2 0"/></svg>';
  bar.appendChild(emoji);
  /* 点 chip 不夺焦点（mousedown preventDefault，click 照常触发）：
   * 否则点表情钮会把焦点从输入框抢走 → 站点对 blur 的响应是收起
   * 评论表单并重渲染——面板开着时输入框/发布键错位、最近表情行被
   * React 洗掉。面板本体（epHost）早有同款防护，工具行这里补上。
   * 全部 chip 统一处理：只看作者/从旧到新/加载更多也不需要抢焦点 */
  bar.addEventListener('mousedown', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) {
      e.preventDefault();
    }
  });
  bar.addEventListener('click', (e) => {
    const b =
      e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'emoji') {
      /* 开关关闭时入口整体隐藏（见 cmtTbSync），这里再兜一道 */
      if (!lcEpOn()) return;
      lcEpToggle(bar);
      return;
    }
    if (act === 'only') {
      if (b.classList.contains('lc-dis')) return;
      cmtOnlyAuthorOn = !cmtOnlyAuthorOn;
    } else if (act === 'sort') {
      cmtSortOn = !cmtSortOn;
    } else if (act === 'more') {
      if (b.classList.contains('lc-dis')) return;
      let rec = null;
      cmtAreas.forEach((r) => {
        if (r.bar === bar) rec = r;
      });
      const pager = rec && cmtFindPager(rec.root);
      if (pager) pager.click(); /* 加载/去重/收起全走站点原生 */
      return;
    }
    cmtTick();
  });
  /* i18n（#16）：工具行（只看作者 / 从旧到新 / 加载更多评论 / 表情入口）
   * 是插件注入的独立容器，在此一次接管；后续改文案（lc-dis 态等）由 watcher 跟上 */
  if (typeof LC_I18N !== "undefined") LC_I18N.watch(bar);
  return bar;
}

/* ---------- 最近表情行（2026-09-26，输入框正下方，模拟 App 端）----------
 * 数据现成（epData.recent，插入即前插），过期条目由 lcEpPruneRecent 清。
 * 位置：formBlock 之后 = 输入框（含发布钮）正下方。内容指纹（含顺序）
 * 变化才重建节点；行宽变化只重新裁切藏尾——稳定态零写入，不喂自激 */
function cmtEpRowEntries() {
  const out = [];
  for (let i = 0; i < epData.recent.length && out.length < EP_RECENT_MAX; i++) {
    const r = epData.recent[i];
    if (!lcEpRecentValid(r)) continue;
    const c = r.pack ? lcEpPack(r.pack) : null;
    if (c && c.enabled === false) continue; /* 停用包不进快捷行 */
    out.push(r);
  }
  return out;
}
function cmtEpRowFill(rec, row) {
  const list = cmtEpRowEntries();
  const sig = list.map((r) => (r.pack || '') + '|' + r.name).join(';');
  if (sig !== rec.rowSig) {
    rec.rowSig = sig;
    while (row.firstChild) row.removeChild(row.firstChild);
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const full = lcEpFmt(r.pack, r.name);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lc-ep-rchip';
      b.textContent = r.name;
      b.title = full + '（点击插入）';
      b.setAttribute('data-full', full);
      row.appendChild(b);
    }
    rec.rowW = -1; /* 内容变了强制重新裁切 */
  }
  const w = row.clientWidth;
  if (w && w !== rec.rowW) {
    rec.rowW = w;
    const kids = row.children;
    for (let i = 0; i < kids.length; i++) kids[i].style.display = '';
    let i = kids.length;
    while (i > 0 && row.scrollWidth > w + 1) {
      i--;
      kids[i].style.display = 'none';
    }
  }
  const show = list.length > 0;
  if ((row.style.display !== 'none') !== show) {
    row.style.display = show ? '' : 'none';
  }
}
/* 行对齐（2026-09-26 用户反馈：chips 行原来占满 formBlock 全宽顶格
 * 两边）：左右缘都对齐输入框（与工具行同宽，观感统一）。增量 margin
 * 方案同 cmtTbSync 的宽度对齐——margin 生效后的残余差 <0.5px 即收敛，
 * 不回清（回清=0↔pad 振荡，工具行已踩过）。
 * 0 评论页毒 margin 实锤（第五轮探针 20260926）：表情面板开合会把表单
 * 容器切成横向 flex，本行变成输入框右侧的压缩 flex 项（left 顶到输入
 * 框右缘、top 反而更高）——对齐在这种状态下量到的几何全是错的，写出
 * ml=-389 冻结回 block 态后行被撑到 778px、推出卡片左缘 389px（「行
 * 消失 + 输入框发布键错位」的根源）。门禁：行不在输入框正下方 = 异常
 * 态，display:none 退出布局流（flex 里不生成盒，顺便还站点一个干净布
 * 局）；回到 block 态后下轮 sync 自动恢复，且增量式对齐一次就冲掉旧
 * 毒 margin，无需清理例程 */
function cmtEpRowAlign(row, input) {
  try {
    const ir = input.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (ir.width <= 0 || rr.width <= 0) return;
    if (rr.top <= ir.top || rr.left >= ir.right - 2) {
      if (row.style.display !== 'none') row.style.display = 'none';
      return;
    }
    const curL = parseFloat(row.style.marginLeft) || 0;
    const curR = parseFloat(row.style.marginRight) || 0;
    const mL = curL + (ir.left - rr.left);
    const mR = curR + (rr.right - ir.right);
    if (Math.abs(mL - curL) > 0.5) row.style.marginLeft = mL + 'px';
    if (Math.abs(mR - curR) > 0.5) row.style.marginRight = mR + 'px';
  } catch (e) {}
}
function cmtEpRowSync(rec, input) {
  let row = rec.row;
  if (!row || !row.isConnected || row.previousElementSibling !== rec.formBlock) {
    if (row && row.parentNode) row.parentNode.removeChild(row);
    row = document.createElement('div');
    row.className = 'lc-cmt-eprow';
    row.style.display = 'none';
    /* 点 chip 不夺焦点（同工具行防护）：mousedown 默认把焦点从输入框
     * 抢走——contenteditable 的光标选区丢失、插入哑火，站点还会在
     * blur 时收起表单重渲染（0 评论页「点一次出现再点一次消失」循环
     * 的根源之一）。mousedown preventDefault，click 照常触发 */
    row.addEventListener('mousedown', (e) => e.preventDefault());
    row.addEventListener('click', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('.lc-ep-rchip') : null;
      if (!b) return;
      const full = b.getAttribute('data-full');
      /* 插入成功后 recent 自动前插（lcEpPushRecent），指纹含顺序 →
       * 立即重填一次，被点的 chip 当场跳到行首 */
      if (full && lcEpInsertInto(input, full)) cmtEpRowFill(rec, row);
    });
    try {
      rec.formBlock.insertAdjacentElement('afterend', row);
    } catch (e) {
      return;
    }
    rec.row = row;
    rec.rowSig = '';
    rec.rowW = -1;
  }
  cmtEpRowFill(rec, row);
  if (row.style.display !== 'none') {
    cmtEpRowAlign(row, input);
    /* 对齐改了 margin → 行宽变了 → 立即重裁一次，不等下轮 tick。
     * 但对齐若判定异常态收起了行（display:none），此处不得再放出来，
     * 否则刚退出的 flex 布局又被塞回一个污染项 */
    if (row.style.display !== 'none') cmtEpRowFill(rec, row);
  }
}

/* 工具行同步：发现评论输入框 → 注入/清理工具行 → 标区块根与楼主 id →
 * chip 状态刷新 → 宽度对齐。幂等全量重算，React 洗掉就重插。 */
function cmtTbSync() {
  const on = cmtEnhanceOn();
  /* 表情面板门禁：跟随工具行总开关，关 → 面板节点与样式表整体摘除 */
  lcEpGate();
  /* 清理：输入框离场 / 工具行被 React 洗掉 / 功能关闭 */
  cmtAreas.forEach((rec, input) => {
    if (!on || !input.isConnected || (rec.bar && !rec.bar.isConnected)) {
      if (rec.bar && rec.bar.parentNode) {
        rec.bar.parentNode.removeChild(rec.bar);
      }
      if (rec.row && rec.row.parentNode) {
        rec.row.parentNode.removeChild(rec.row);
      }
      if (rec.root) rec.root.removeAttribute('data-lc-cmt-area');
      cmtAreas.delete(input);
    }
  });
  if (!on) {
    document.querySelectorAll('.' + CMT_REV_CLASS).forEach((el) => {
      el.classList.remove(CMT_REV_CLASS, CMT_REV_COMP_CLASS);
    });
    cmtOnlyAuthorOn = false;
    cmtSortOn = false;
    try {
      const st = document.getElementById(CMT_TB_STYLE_ID);
      if (st) st.remove();
    } catch (e) {}
    return;
  }
  cmtTbEnsureStyle();
  cmtFrameHostDetect();
  const seenForms = new Set();
  try {
    document.querySelectorAll(CMT_INPUT_SEL).forEach((input) => {
      /* 输入框 → 表单块：向上爬到「再上一层就含评论列表」为止，
       * 表单块即工具行的插入锚点（插在它前面 = 输入框正上方）。
       * 快路径：上轮锚定的 formBlock 仍连着、且工具行仍紧贴它前面
       * （= 未漂移），直接复用，免爬 6 层 × 每 tick——tag 页十几个
       * 输入框 × 8Hz tick 的固定大头。漂移/换锚由下方防漂移检查兜住 */
      const prevRec = cmtAreas.get(input);
      let fb;
      if (
        prevRec &&
        prevRec.formBlock &&
        prevRec.formBlock.isConnected &&
        prevRec.bar.nextElementSibling === prevRec.formBlock
      ) {
        fb = prevRec.formBlock;
      } else {
        fb = input;
        for (let i = 0; i < 6; i++) {
          const p = fb.parentElement;
          if (!p || p === document.body || p === document.documentElement) {
            break;
          }
          if (p.querySelector(CMT_LIST_SEL)) break;
          fb = p;
        }
      }
      let root = fb.parentElement;
      /* 必须是评论区：优先认评论列表锚点。列表一条都没有时（首页/tag
       * 页 0 评论的卡片）不能直接放弃——表情按钮要常在；且深爬上去的
       * fb 已抬到卡片顶部（甚至 body），工具行会插错位置，而只看作者/
       * 从旧到新没有列表可作用。退化为「仅表情」工具行：改用浅锚
       * （含 发布/评论 按钮的最小容器），并用祖先类名含 cmt 排除首页
       * 发布框、搜索框等同形输入 */
      let emojiOnly = false;
      if (
        !root ||
        root === document.body ||
        root === document.documentElement ||
        !root.querySelector(CMT_LIST_SEL)
      ) {
        if (!cmtCommentishForm(input)) return;
        fb = input;
        for (let i = 0; i < 4; i++) {
          const p = fb.parentElement;
          if (!p || p === document.body || p === document.documentElement) {
            break;
          }
          if (cmtHasPublishBtn(p)) break;
          fb = p;
        }
        root = fb.parentElement;
        if (!root || root === document.body || root === document.documentElement) {
          return;
        }
        emojiOnly = true;
      }
      if (seenForms.has(fb)) return; /* 同一表单块多个输入元素只插一条 */
      seenForms.add(fb);
      const rec = prevRec || {};
      if (!prevRec) {
        const bar = cmtTbBuildBar();
        /* 浅锚模式：工具行插在输入行容器之前，顶部隔着站点 isay 气泡
         * 展开容器的 padding/margin，与上方分割线之间空出一大截——
         * 用负 margin 拉向分割线（值见 cmtTbEnsureStyle 的 shallow 规则） */
        if (emojiOnly) bar.classList.add('lc-tb-shallow');
        try {
          fb.parentElement.insertBefore(bar, fb);
        } catch (e) {
          return;
        }
        rec.bar = bar;
        rec.formBlock = fb;
        rec.root = root;
        rec.emojiOnly = emojiOnly;
        rec.insertedAt = Date.now();
        cmtAreas.set(input, rec);
        cmtTbRevealWatch();
      }
      rec.formBlock = fb;
      rec.root = root;
      /* 0 评论时是「仅表情」工具行；评论随后加载出来要能升级成完整版 */
      rec.emojiOnly = emojiOnly;
      /* 防漂移：React 重排可能把外插节点挪离锚点，旧的内联边距就
       * 残留在错误位置继续拉扯布局（真机表现＝反复开合评论区卡片
       * 位置漂移）。工具行必须始终紧贴 formBlock 正前方，发现挪位
       * 就重插回去并清掉内联边距/显示状态，让下面的对齐逻辑同一
       * 任务里重算——单次布局变化，不产生多段跳动 */
      if (
        rec.bar.parentElement !== fb.parentElement ||
        rec.bar.nextElementSibling !== fb
      ) {
        rec.bar.style.margin = '0';
        rec.bar.style.visibility = '';
        rec.stableKey = '';
        try {
          fb.parentElement.insertBefore(rec.bar, fb);
        } catch (e) {}
      }
      /* 区块标记 + 楼主 id（cmtApply 的「只看作者」谓词要查这两样）。
       * 等值不写：setAttribute 同值也会触发 MutationObserver，喂自激
       * tick 循环 */
      if (root.getAttribute('data-lc-cmt-area') !== '1') {
        root.setAttribute('data-lc-cmt-area', '1');
      }
      if (!cmtAreaHost.get(root)) {
        const h = cmtFrameHost || cmtHostFromDom(root, rec.formBlock);
        if (h) cmtAreaHost.set(root, h);
      }
      /* chip 状态与置灰；「仅表情」工具行（0 评论的卡片）整个收起
       * chip——只看作者/从旧到新没有列表可作用，留着只会让人点空 */
      const host = cmtFrameHost || cmtAreaHost.get(root) || '';
      const chips = rec.bar.querySelectorAll('.lc-chip');
      const onlyChip = chips[0];
      const sortChip = chips[1];
      const chipsGone = rec.emojiOnly ? 'none' : '';
      if (onlyChip && sortChip) {
        /* 等值不写：display 同值赋值同样触发 style 属性变异，喂自激
         * tick 循环（观察器每 120ms 被自己上一轮的写入再唤醒） */
        if (onlyChip.style.display !== chipsGone) {
          onlyChip.style.display = chipsGone;
        }
        if (sortChip.style.display !== chipsGone) {
          sortChip.style.display = chipsGone;
        }
        onlyChip.classList.toggle('lc-on', cmtOnlyAuthorOn);
        onlyChip.classList.toggle('lc-dis', !host);
        onlyChip.title = host
          ? '只显示楼主（' + host + '）的评论'
          : '未识别到楼主，本区块暂不支持';
        sortChip.classList.toggle('lc-on', cmtSortOn);
        sortChip.title = '按时间从旧到新排列（只作用于已加载的评论）';
      }
      /* 「加载更多评论」显隐：从旧到新点亮 且 官方分页存在才显示；
       * 官方按钮进入加载态（disabled/aria-disabled）时镜像置灰。
       * 官方按钮被站点移除（全部加载完）→ 本键自动隐藏。
       * tick 由 MutationObserver 防抖驱动，站点分页区的任何变化都会
       * 触发重算，无需额外观察器 */
      const moreChip = rec.bar.querySelector('.lc-more');
      if (moreChip) {
        const pager =
          cmtSortOn && !rec.emojiOnly ? cmtFindPager(root) : null;
        const busy =
          pager &&
          (pager.disabled === true ||
            pager.getAttribute('aria-disabled') === 'true');
        const d = pager ? '' : 'none';
        if (moreChip.style.display !== d) moreChip.style.display = d;
        moreChip.classList.toggle('lc-dis', !!busy);
        moreChip.title = busy
          ? '加载中…'
          : '加载更多评论（等同官方「查看更多」）';
      }
      cmtTbApplyAccent(rec.bar);
      /* 表情入口：显隐跟随工具行总开关（不留点不动的死按钮） */
      const epBtn = rec.bar.querySelector('.lc-emoji');
      if (epBtn) {
        const show = lcEpOn();
        if ((epBtn.style.display !== 'none') !== show) {
          epBtn.style.display = show ? '' : 'none';
        }
      }
      /* 最近表情行：输入框正下方（内容指纹/行宽双门禁，稳定态零写入） */
      cmtEpRowSync(rec, input);
      /* 宽度对齐：左缘对输入框左缘（margin-left）、右缘对输入框右缘
       * （margin-right）。要把已生效的 margin 还原回「自由缘」再算目标
       * 值：直接拿当前差值当 margin，补偿生效后差值归零又会被清掉 →
       * 0↔pad 无限振荡（真机已踩）。
       * 布局时序约定（真机 A/B 验证过）：边距在插入的同一任务里就应用
       * 到位，工具行 footprint 自此恒定；显示门槛只切 visibility，显示
       * 瞬间零布局变化——站点会在展开动画期间量测评论区高度，显示帧
       * 再改布局会让它量到中途值，反复开合后卡片位置漂移。
       * 显示前小边距修正随便追（不可见）；显示后只纠 >3px 大偏移。 */
      try {
        const ir = input.getBoundingClientRect();
        const br = rec.bar.getBoundingClientRect();
        if (ir.width > 0 && br.width > 0) {
          const curR = parseFloat(rec.bar.style.marginRight) || 0;
          const curL = parseFloat(rec.bar.style.marginLeft) || 0;
          const freeRight = br.right + curR; /* 未补偿时工具行本来的右缘 */
          const freeLeft = br.left - curL; /* 未补偿时工具行本来的左缘 */
          const tR = Math.min(600, Math.max(0, freeRight - ir.right));
          const tL = Math.min(600, Math.max(0, ir.left - freeLeft));
          /* 垂直间距：站点常在输入框包裹层出 padding-top（首页/tag 页
           * 实测 .isayi.add 18px），bar↔输入框白盒被拉开 ~19px。包裹层
           * margin-top 为 0 时负 margin-bottom 可以整体上提（不塌陷吃
           * 掉），不动站点元素、摘除工具行自动还原。若某入口是 margin
           * 出的间距，负 margin 会被塌陷吸收、此路无效——宁大勿抖 */
          const gap = ir.top - br.bottom;
          const curMB = parseFloat(rec.bar.style.marginBottom) || 0;
          const tMB = gap > 4 ? Math.max(-40, curMB - (gap - 4)) : curMB;
          const revealed = rec.bar.style.visibility === 'visible';
          const dz = revealed ? 3 : 0.5; /* 显示后死区：小抖不追 */
          if (
            Math.abs(tR - curR) > dz ||
            Math.abs(tL - curL) > dz ||
            Math.abs(tMB - curMB) > dz
          ) {
            rec.bar.style.marginLeft = tL.toFixed(2) + 'px';
            rec.bar.style.marginRight = tR.toFixed(2) + 'px';
            rec.bar.style.marginBottom = tMB.toFixed(2) + 'px';
          }
          /* 出界避让：胶囊左探/表情右探靠负 margin 伸出工具行盒子，
           * 但个人主页评论区 iframe 里输入框满宽到视口边缘（bar 左缘
           * = 视口左缘），伸出部分被 iframe 视口本身裁掉（真机已踩：
           * 胶囊左侧/表情右侧被切平，且无任何 overflow:hidden 祖先）。
           * 左有 9px、右有 4px 余量才启用出界；贴边时用不出界画法。
           * clientWidth 量不出（jsdom 等）视为有余量，维持旧行为 */
          try {
            const vw = document.documentElement.clientWidth;
            const br2 = rec.bar.getBoundingClientRect();
            rec.bar.classList.toggle('lc-ovh-l', !vw || br2.left >= 9);
            rec.bar.classList.toggle('lc-ovh-r', !vw || vw - br2.right >= 4);
          } catch (e) {}
          if (!revealed) {
            /* 显示门槛：注入常发生在展开动画中途，输入框会相对容器
             * 漂移，等量测稳定再显示可避免按键跟着动画挪动；自催节拍
             * 由 cmtTbRevealWatch 兜底。但真机（2026-09-24）发现站点
             * 评论区的图片/字体加载会让输入框位置在两三秒内持续微动，
             * 「连续两轮一致」迟迟不满足 → 工具行迟到 3 秒。加最长
             * 等待兜底：插入 700ms 后无条件显示（显示后只纠 >3px 大
             * 偏移，不会跳）；精度同步放宽到 1px，0.5px 级微动不再
             * 重置稳定计数 */
            const key = [ir.left, ir.right, ir.top]
              .map((v) => Math.round(v))
              .join(',');
            if (
              rec.stableKey === key ||
              Date.now() - (rec.insertedAt || 0) > 700
            ) {
              rec.bar.style.visibility = 'visible';
              rec.aligned = true;
            } else {
              rec.stableKey = key;
            }
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
  /* 不跨帖保留：上一轮锚定的输入框全部离场（翻到另一帖）即复位 */
  if (cmtAreas.size) {
    if (cmtTbPrevInputs && cmtTbPrevInputs.size) {
      let anyOld = false;
      cmtAreas.forEach((rec, input) => {
        if (cmtTbPrevInputs.has(input)) anyOld = true;
      });
      if (!anyOld) {
        cmtOnlyAuthorOn = false;
        cmtSortOn = false;
      }
    }
    cmtTbPrevInputs = new Set(Array.from(cmtAreas.keys()));
  }
}

/* 排序同步：给每个评论区块的列表容器挂/摘反转类。
 * 容器校验：元素子节点必须全部是评论行或分割线——防止把「查看更多」
 * 等非评论子元素也反转到列表另一端（此时跳过该容器，宁可不排）。 */
function cmtSortSync() {
  const want = cmtEnhanceOn() && cmtSortOn;
  /* 早退：排序熄灭且页面上已无反转类时无事可做——否则每个 tick 都要
   * 逐区块扫评论行、逐行抬行单位（tag 页长 feed 上是不小的固定开销） */
  if (!want && !document.querySelector('.' + CMT_REV_CLASS)) return;
  const roots = document.querySelectorAll('[data-lc-cmt-area]');
  Array.prototype.forEach.call(roots, (root) => {
    const rows = root.querySelectorAll(
      '.cmti, .bcmti, .bcmt-item, .bcmtlsta',
    );
    if (!rows.length) return;
    const units = new Set();
    Array.prototype.forEach.call(rows, (r) => units.add(cmtRowUnit(r)));
    const firstUnit = cmtRowUnit(rows[0]);
    const listEl = firstUnit && firstUnit.parentElement;
    if (!listEl || listEl === document.body) return;
    let ok = true;
    /* 个人主页模板的官方「查看更多」直接混在列表容器里、与评论行平级
     * （真机截图：div.bcmtlst 下 .bcmti 与 a.s-fc2 并排）——放行分页钮
     * 及其到列表容器之间的包裹链，否则守卫判 false、整个容器跳过不排
     * （真机表现＝「从旧到新」点了没反应） */
    const pager = cmtFindPager(root);
    Array.prototype.forEach.call(listEl.children, (c) => {
      if (c.nodeType !== 1 || units.has(c) || cmtIsDividerEl(c)) return;
      if (pager && c.contains(pager)) return;
      ok = false;
    });
    if (!ok) return;
    if (want) {
      /* 补偿检测须在常态下量：首行上边框为 0 说明站点用了 first-child
       * 规则压线，反转后要把 DOM 末行（视觉顶行）的上边框归零 */
      let comp = false;
      try {
        comp = cmtBorderW(listEl.children[0], true) === 0;
      } catch (e) {}
      listEl.classList.add(CMT_REV_CLASS);
      listEl.classList.toggle(CMT_REV_COMP_CLASS, comp);
    } else {
      listEl.classList.remove(CMT_REV_CLASS, CMT_REV_COMP_CLASS);
    }
  });
}

/* 统一节拍。顺序重要：工具行先把区块根与楼主 id 标好，「只看作者」的
 * 谓词才能查到 host；排序最后挂类。 */
function cmtTick() {
  const tp0 = Date.now();
  cmtTbSync();
  cmtApply();
  cmtSortSync();
  cmtHideBtnSync();
  /* 面板锚在按钮上方、滚动实时跟随（scroll 捕获监听，见 lcEpEnsureGlobal），
   * 唯一另外要跟的是工具行被 React 洗掉：cmtTick 里检查 owner 存活
   * （跨帧模式下 owner 在本帧、面板开在顶层，存活检查通过桥消息收面板） */
  if (epRemote) {
    if (epRemoteOpen && epOwner && !epOwner.isConnected) lcEpRemoteClose();
  } else if (epOpen && epOwner && !epOwner.isConnected) {
    lcEpClose();
  }
  /* 开销滚动计数（5s 窗口）：探针 tickN/tickMs 直读。tickN 持续 ≈8/s
   * = 还有自激写入没断净；tickMs/tickN = 单次 tick 在当前文档上的成本 */
  cmtPerf.n += 1;
  cmtPerf.ms += Date.now() - tp0;
  if (!cmtPerf.t0 || Date.now() - cmtPerf.t0 > 5000) {
    cmtPerf.t0 = Date.now();
    cmtDiag.tickN = cmtPerf.n;
    cmtDiag.tickMs = cmtPerf.ms;
    cmtPerf.n = 0;
    cmtPerf.ms = 0;
  }
}

/* ================= 评论区行内快捷「隐藏」（官方操作条尾部）=================
 * 官方悬停操作条（.cmtopt：加黑/投诉/删除/回复）是常驻 DOM，悬停显隐由
 * 行级控制——追加一个同款链接即可继承官方样式与显隐，无需注入/看门。
 * 点击 = 写入 filter.users（与头像处「隐藏」同一份名单，语义统一：隐藏
 * TA 的评论与帖子）。写入走 storage get→改→set 小事务（onCmtHideClick
 * 处注释了为什么不走主逻辑的 filterPersist/settings），onChanged 自动
 * 更新 cmtSettings 并触发 cmtTick 重算隐藏。行被 React 重渲染洗掉后由
 * tick 补挂（等值守卫——已存在即跳过，不产生 DOM 变更，不自激）。 */
function cmtHideBtnSync() {
  try {
    const f = cmtSettings && cmtSettings.filter;
    const on = !!(
      cmtSettings &&
      cmtSettings.enabled &&
      f &&
      f.enabled &&
      f.scope &&
      f.scope.comment
    );
    document.querySelectorAll('.cmtopt').forEach((opt) => {
      if (!on) {
        /* 功能关闭时清掉残留按钮（避免点了没效果的死按钮） */
        opt.querySelectorAll('a.lc-cmt-hide-btn').forEach((b) => b.remove());
        return;
      }
      if (opt.querySelector('a.lc-cmt-hide-btn')) return;
      if (!opt.closest('.cmti')) return;
      const btn = document.createElement('a');
      btn.href = '#';
      btn.className = 'cmtj s-fc4 xtag lc-cmt-hide-btn';
      btn.textContent = '隐藏';
      btn.title =
        '隐藏该用户的所有评论与帖子（与头像处的「隐藏」同一名单，可在扩展面板撤销）';
      btn.addEventListener('click', onCmtHideClick);
      opt.appendChild(btn);
    });
  } catch (e) {}
}

/* 行作者：行内第一个 id 解析非空的链接（文档序=作者位，与「行级首链
 * 决策」同一约定——回复行的回复目标链接在作者名之后，不会被取到） */
function cmtRowAuthorOf(row) {
  try {
    const links = row.querySelectorAll('a[href]');
    for (let i = 0; i < links.length; i++) {
      const id = cmtUserId(links[i]);
      if (!id) continue;
      let name = (links[i].textContent || '').trim();
      if (!name) {
        const t = links[i].getAttribute('title') || '';
        name = t.split(' - ')[0].trim();
      }
      return { id: id, name: name || id };
    }
  } catch (e) {}
  return null;
}

/* 20260925e 版曾在这里调主逻辑 IIFE 内的 filterPersist()——函数声明在
 * 内层作用域，顶层 comment 模块根本看不见，点击必抛 ReferenceError：
 * push 只进了内存、storage 没写、onChanged 不触发 → 评论不消失、面板
 * 0 人、刷新全丢。20260925f 起不经 settings、不调 filterPersist，直接
 * 对 storage 做 get→改→set 小事务：评论区常驻 comment.do 子帧，那里面
 * window.settings 根本没初始化（主逻辑只在顶层帧跑），依赖 settings
 * 本身就是个错。写成功后 onChanged（cmtStorageBound 监听）会同步本帧
 * cmtSettings 并 cmtTick 重算，行立即隐藏。 */
function onCmtHideClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const row = (e.currentTarget || e.target).closest('.cmti');
  const author = row && cmtRowAuthorOf(row);
  if (!author) {
    cmtPageToast('没识别到这条评论的作者');
    return;
  }
  try {
    chrome.storage.local.get(LC_STORAGE_KEY, (res) => {
      let cur;
      try {
        cur = res[LC_STORAGE_KEY] || {};
      } catch (er) {
        cur = {};
      }
      if (!cur.filter) cur.filter = LC_clone(LC_DEFAULTS.filter);
      if (!Array.isArray(cur.filter.users)) cur.filter.users = [];
      if (cur.filter.users.some((u) => u.id === author.id)) {
        cmtPageToast('「' + author.name + '」已在隐藏名单');
        return;
      }
      cur.filter.users.push({ id: author.id, name: author.name });
      chrome.storage.local.set({ [LC_STORAGE_KEY]: cur }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          cmtPageToast('写入失败：' + err.message);
          return;
        }
        cmtPageToast('已隐藏「' + author.name + '」的评论与帖子', () => {
          cmtFilterUsersRemove(author.id);
        });
      });
    });
  } catch (err) {
    cmtPageToast('隐藏失败（' + String((err && err.message) || err) + '）');
  }
}

/* 撤销：同样走 storage 小事务（按 id 摘除），不依赖本帧 settings */
function cmtFilterUsersRemove(id) {
  try {
    chrome.storage.local.get(LC_STORAGE_KEY, (res) => {
      const cur = res[LC_STORAGE_KEY] || {};
      if (cur.filter && Array.isArray(cur.filter.users)) {
        const next = cur.filter.users.filter((u) => u.id !== id);
        if (next.length !== cur.filter.users.length) {
          cur.filter.users = next;
          chrome.storage.local.set({ [LC_STORAGE_KEY]: cur }, () => {});
        }
      }
    });
  } catch (e) {}
}

/* 页面级 toast（底部居中胶囊，4s 自动消失；undo 回调可选）。
 * 与表情面板的 lcEpToast 独立——那个挂在 epHost 上，评论区没有宿主 */
let cmtToastT = 0;
function cmtPageToast(msg, undo) {
  try {
    const old = document.querySelector('.lc-cmt-toast');
    if (old) old.remove();
    const d = document.createElement('div');
    d.className = 'lc-cmt-toast';
    d.appendChild(document.createTextNode(msg));
    if (undo) {
      const a = document.createElement('a');
      a.textContent = '撤销';
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        d.remove();
        undo();
      });
      d.appendChild(a);
    }
    document.body.appendChild(d);
    clearTimeout(cmtToastT);
    cmtToastT = setTimeout(() => {
      const t = document.querySelector('.lc-cmt-toast');
      if (t) t.remove();
    }, 4000);
  } catch (e) {}
}

/* ================= 表情快捷输入（评论工具行右侧入口 · #9）=================
 * 定稿见 docs/todo-priorities.md #9，交互原型 tools/demo-emoji-panel.html。
 * 只做「文字格式」：把 [包名/情绪] 插到评论输入框，网页端显示文字、
 * App 端由官方渲染成表情图；不请求网络、不读站点数据，与站点零耦合。
 * 落位：挂 documentElement + position:absolute（不在 body/#main 内）——
 * ① 逃出站点容器的 overflow 裁切；② 逃出暗色管线的 invert 反色区，
 * 颜色按真值写、不必预反色。工具行 chip 在反色区内，故暗色下 chip 的
 * 强调色写「预反色值」，两侧视觉才一致（#7c80d2，与 popup 面板同色）。
 * 定位：锚在表情按钮上方 6px（恒定全高 348，允许顶部超出屏幕，向上
 * 滚动即可见全貌；不向下展开）；页面坐标 + absolute，滚动/缩放时由
 * 捕获监听实时重算、始终贴着按钮走；z-index 压在导航栏之下、压在
 * 蒙版之上（无导航帧除外）。开关跟随「评论工具行」总开关，不单列。 */
const EP_KEY = 'lc_emoji_v1';
const EP_STYLE_ID = 'lc-emoji-panel-style';
/* 面板落位几何的自动上报键：面板每次打开落位后写入（含帧 URL / 内联
 * 尺寸 / 渲染矩形 / 帧宽 / DPR）。面板通常挂在评论区子帧里，顶层帧的
 * 探针看不到 epHost —— 各帧用 storage.onChanged 把最新落位缓存进内存
 * （epDiagCache），lcCmtPayload 同步带上，不再走异步合并（会被子帧
 * 汇总覆写冲掉，实测两次丢字段）。10 分钟内的数据才算数。 */
const EP_DIAG_KEY = 'lc_ep_diag_v1';
let lcEpDiagLast = 0; /* 诊断上报节流：滚动跟随时落位每帧都跑，存储至多 1s 一写 */
let epDiagCache = null;
try {
  chrome.storage.local.get(EP_DIAG_KEY, (res) => {
    epDiagCache = (res && res[EP_DIAG_KEY]) || null;
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch[EP_DIAG_KEY])
      epDiagCache = ch[EP_DIAG_KEY].newValue || null;
  });
} catch (e) {}
const EP_RECENT_MAX = 12;
const EP_ACCENT = '#7c80d2';
const EP_CORE_TABS = ['老福鸽', '老福鸽约稿专属', '联动', '道具'];
/* 内置免费包只读（不可改名/删除）：祁煜 + 燕云合并进「联动」tab，
 * 但格式里必须写各自真实包名，故用 [包名, 表情名] 二元组存 */
const EP_BUILTIN = [
  {
    tab: '老福鸽',
    items: [
      '吹爆太太', '给你喜欢', '狗头', '多谢款待', '哈哈哈', 'kswl', '打call',
      '甜哭了', '刀傻了', '揍审核', '拜托拜托', '裤子飞飞', '吃瓜', '求投喂',
      '满头问号', '下次一定', '我酸了', '禁止涩涩', '握草', '生日快乐',
      '有个朋友', '高考必胜',
    ],
  },
  {
    tab: '老福鸽约稿专属',
    items: [
      '在吗', '我来了', '稍等', '排单中', '请发设定', 'OK', '在炒了', '久等了',
      '期待', '不好意思', '请用草稿', '请用线稿', '请用色稿', '请用成稿',
      '好看死了', '辛苦了', '无需修改', 'sorry', '多谢', '收到',
    ],
  },
  {
    tab: '联动',
    items: [
      ['祁煜生日联动', '晚安'], ['祁煜生日联动', '好的'],
      ['祁煜生日联动', '安慰'], ['祁煜生日联动', '打招呼'],
      ['燕云老福鸽', '大火爆炒'], ['燕云老福鸽', '好好吃饭'],
      ['燕云老福鸽', '摄星拿月'], ['燕云老福鸽', '你来燕了'],
    ],
  },
];
const EP_PROP_NAME = '更新求踢'; /* 官方唯一互动道具：单独发才触发 */
let epData = { custom: [], recent: [] };
let epView = 'normal'; /* normal | import | manage */
let epTab = '老福鸽';
/* 「最近」不再设面板栏（2026-09-26 用户拍板）：最近使用的表情直接排
 * 在输入框下方（lc-cmt-eprow 快捷行），高频路径连面板都不用开；面板
 * 打开就是最常用的老福鸽 */
let epDraft = null;
let epOwner = null; /* 打开面板的那条工具行 */
let epHost = null;
let epOpen = false;
let epLastKey = '';
let epSaveT = 0;
let epAnimT = 0; /* 收起动画的延迟复位定时器 */
let epToastT = 0;
let epGlobalBound = false;
/* 跨帧模式（专栏文章页）：整个评论区活在 comment.do 子帧里，面板若画在
 * 子帧内会被 iframe 边界裁切（宽度卡死、顶部出不了文档顶）。改为子帧只
 * 保留工具行与插入逻辑，面板由顶层帧托管渲染，两边用 postMessage 通讯：
 *   子帧→顶层  open/move(按钮几何) outside(Esc/点外) close
 *   顶层→子帧  insert(文本) close
 * epRemote 指本帧是否为子帧；顶层侧会话状态以 epRmt* 命名 */
const epRemote = window !== window.top;
let epRemoteOpen = false; /* 子帧侧：面板当前开在顶层 */
let epRmtBound = false; /* 子帧侧：桥接监听已绑 */
let epRmtWin = null; /* 顶层侧：面板所属子帧的 window */
let epRmtFrame = null; /* 顶层侧：对应 iframe 元素（实时取矩形） */
let epRmtBr = null; /* 顶层侧：子帧最近上报的按钮视口矩形 */
let epRmtInputRight = null; /* 顶层侧：子帧输入框右缘（面板对齐用） */
let epTopHostBound = false; /* 顶层侧：托管监听已绑 */
/* 导航栏兜底扫描缓存：全量 querySelectorAll + getComputedStyle 偏重，
 * 结果 2s 内直接复用（导航栏的 fixed/sticky 形态不会频繁变化） */
const lcEpNavCache = { t: 0, el: null, z: 0, raw: '' };

/* ---------- 主题 / 色值 ---------- */
function lcEpOn() {
  /* 表情入口跟随「评论工具行」总开关，不单列开关 */
  return !!cmtEnhanceOn();
}
/* 深膜联动（2026-09-26 用户拍板）：锚点所在卡正处自适应材质的深膜态
 * （背景图偏暗）时面板同切深色。类只在开/关面板那一刻计算，打开期间
 * 卡片膜态变化不追（面板生命周期短，不值得挂观察） */
function lcEpFaceDark() {
  try {
    if (epOwner && epOwner.isConnected) {
      return !!epOwner.closest('.lc-face-dark');
    }
    if (epRmtFrame && epRmtFrame.isConnected) {
      return !!epRmtFrame.closest('.lc-face-dark');
    }
  } catch (e) {}
  return false;
}
function lcEpHostDark() {
  return lcEpDark() || lcEpFaceDark();
}
function lcEpDark() {
  try {
    if (cmtSettings && cmtSettings.enabled === false) return false;
    const d =
      (window.settings && window.settings.darkMode) ||
      (cmtSettings && cmtSettings.darkMode) ||
      null;
    if (!d) return false;
    /* 四档统一判定（defaults.js）：off/manual/auto/schedule（按时段） */
    if (typeof LC_darkActive === 'function') return LC_darkActive(d);
    if (d.mode === 'manual') return true;
    if (d.mode === 'auto') {
      return !!(
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }
  } catch (e) {}
  return false;
}
/* 祖先链上是否有 filter（暗色管线用 invert+hue-rotate 反色）。
 * 有 → 该子树里的颜色会被反转，强调色要写预反色值 */
function lcEpInverted(el) {
  try {
    let n = el;
    while (n && n.nodeType === 1) {
      const f = getComputedStyle(n).filter;
      if (f && f !== 'none') return true;
      if (n === document.documentElement) break;
      n = n.parentElement;
    }
  } catch (e) {}
  return false;
}
/* invert(100%) hue-rotate(180deg) 的逆变换（与主管线的 computeDarkAccent
 * 同一套矩阵：两次变换互为逆，故写逆值再经反色显示 = 原色） */
function lcEpInvertHex(hex) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex || ''));
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const hr = -0.574 * r + 1.43 * g + 0.144 * b;
  const hg = 0.426 * r + 0.43 * g + 0.144 * b;
  const hb = 0.426 * r + 1.43 * g - 0.856 * b;
  const one = (x) => 1 - Math.max(0, Math.min(1, x));
  const to = (x) =>
    Math.round(Math.max(0, Math.min(1, one(x))) * 255)
      .toString(16)
      .padStart(2, '0');
  return '#' + to(hr) + to(hg) + to(hb);
}

/* ---------- 数据 ---------- */
function lcEpBlank() {
  return { custom: [], recent: [] };
}
function lcEpLoad(raw) {
  try {
    const d = raw && typeof raw === 'object' ? raw : null;
    epData = {
      custom: d && Array.isArray(d.custom) ? d.custom : [],
      recent: d && Array.isArray(d.recent) ? d.recent : [],
    };
  } catch (e) {
    epData = lcEpBlank();
  }
  lcEpPruneRecent();
  if (epOpen) lcEpRender();
}
function lcEpSaveSoon() {
  clearTimeout(epSaveT);
  epSaveT = setTimeout(() => {
    try {
      chrome.storage.local.set({ [EP_KEY]: epData });
    } catch (e) {}
  }, 180);
}
function lcEpPack(packName) {
  for (let i = 0; i < epData.custom.length; i++) {
    if (epData.custom[i].pack === packName) return epData.custom[i];
  }
  return null;
}
function lcEpAlias(c) {
  return (c && c.alias) || (c && c.pack) || '';
}
function lcEpFmt(pack, name) {
  return pack ? '[' + pack + '/' + name + ']' : '[' + name + ']';
}
function lcEpEsc(s) {
  return String(s).replace(/[&<>"]/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function lcEpFlat(tab) {
  const out = [];
  for (let i = 0; i < EP_BUILTIN.length; i++) {
    const p = EP_BUILTIN[i];
    if (p.tab !== tab) continue;
    for (let j = 0; j < p.items.length; j++) {
      const it = p.items[j];
      if (typeof it === 'string') out.push({ pack: p.tab, name: it });
      else out.push({ pack: it[0], name: it[1] });
    }
  }
  return out;
}
function lcEpBuiltinGroups(tab) {
  const g = [];
  const seen = {};
  lcEpFlat(tab).forEach((it) => {
    if (!seen[it.pack]) {
      seen[it.pack] = { pack: it.pack, items: [] };
      g.push(seen[it.pack]);
    }
    seen[it.pack].items.push(it.name);
  });
  return g;
}
function lcEpInputOf(bar) {
  let out = null;
  cmtAreas.forEach((rec, input) => {
    if (rec.bar === bar) out = input;
  });
  return out;
}

/* ---------- 样式 ---------- */
const EP_CSS = `
.lc-ep-host{position:absolute;z-index:500;width:340px;height:348px;display:none;
  flex-direction:column;font-size:13px;line-height:1.6;color:var(--ep-text);
  --ep-card:#ffffff;--ep-sub:#f6f6fa;--ep-line:#ececf2;--ep-text:#3a3a44;
  --ep-muted:#8d8d9a;--ep-strong:#5c5c5c;--ep-hover:#f6f6f6;--ep-chipbd:#e4e4e4;
  --ep-accent:#7c80d2;--ep-accent-bg:rgba(124,128,210,.12);--ep-danger:#e74c3c;
  --ep-amber:#8a5b00;--ep-amberbg:#fdf3dd;--ep-x-bg:rgba(0,0,0,.10);--ep-x-fg:#8d8d9a;
  --ep-sb:rgba(0,0,0,.22);--ep-sbh:rgba(0,0,0,.42);}
.lc-ep-host,.lc-ep-host *{box-sizing:border-box}
.lc-ep-host.lc-dk{--ep-card:#26262e;--ep-sub:#202027;--ep-line:#3b3b47;--ep-text:#e7e7ef;
  --ep-muted:#a2a2b0;--ep-strong:#c9c9d6;--ep-hover:#2e2e38;--ep-chipbd:#45454f;
  --ep-accent-bg:rgba(124,128,210,.22);--ep-danger:#ff6b5e;--ep-amber:#e2c184;
  --ep-amberbg:#332a18;--ep-x-bg:rgba(255,255,255,.12);--ep-x-fg:#a2a2b0;
  --ep-sb:rgb(90,90,84);--ep-sbh:rgb(126,126,118);}
.lc-ep-host.lc-open{display:flex}
/* 开合动画（2026-09-26）：display none→flex 时入场动画自动重播；
 * 收起由 lcEpClose 加 lc-out 播 120ms 退场后再整体复位 */
.lc-ep-host.lc-open .lc-emoji-panel{animation:lcEpIn .16s ease-out}
.lc-ep-host.lc-out .lc-emoji-panel{animation:lcEpOut .12s ease-in forwards}
@keyframes lcEpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes lcEpOut{from{opacity:1}to{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){.lc-ep-host.lc-open .lc-emoji-panel,.lc-ep-host.lc-out .lc-emoji-panel{animation:none}}
.lc-emoji-panel{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;
  /* 磨砂（2026-09-26 用户拍板）：与站点卡片同款配方——半透明底 +
   * backdrop blur；深膜/暗色由 .lc-dk 变量换底色（保持半透明） */
  background:rgba(255,255,255,.72);
  -webkit-backdrop-filter:blur(26px) saturate(1.5);backdrop-filter:blur(26px) saturate(1.5);
  border:1px solid var(--ep-line);border-radius:12px;
  box-shadow:0 8px 28px rgba(0,0,0,.18)}
.lc-ep-host.lc-dk .lc-emoji-panel{background:rgba(38,38,46,.78)}
.lc-ep-sb{scrollbar-width:thin;scrollbar-color:var(--ep-sb) transparent}
.lc-ep-sb::-webkit-scrollbar{width:8px;height:8px}
.lc-ep-sb::-webkit-scrollbar-track{background:transparent}
.lc-ep-sb::-webkit-scrollbar-thumb{background:var(--ep-sb);border-radius:4px}
.lc-ep-sb::-webkit-scrollbar-thumb:hover{background:var(--ep-sbh)}
.lc-ep-sb::-webkit-scrollbar-corner{background:transparent}
.lc-ep-nav{flex:0 0 auto}
.lc-ep-tabs-core{display:flex;gap:4px;padding:8px 8px 2px;overflow:hidden}
.lc-ep-tabs-mine{display:flex;gap:4px;align-items:center;height:36px;padding:0 8px;margin-top:4px;
  overflow-x:auto;overflow-y:hidden;border-top:1px solid var(--ep-line)}
.lc-ep-mine-hint{font-size:11px;color:var(--ep-muted);opacity:.8;white-space:nowrap}
.lc-ep-tab{flex:0 0 auto;appearance:none;border:0;background:transparent;padding:3px 9px;
  border-radius:999px;font:12px/1.5 inherit;color:var(--ep-muted);cursor:pointer;white-space:nowrap}
.lc-ep-tab:hover{color:var(--ep-strong)}
.lc-ep-tab.on{color:var(--ep-accent);background:var(--ep-accent-bg)}
.lc-ep-tab.off{opacity:.45}
.lc-ep-plus{margin-left:auto;color:var(--ep-accent);border:1px solid var(--ep-accent);
  border-radius:999px;padding:0 7px;font-size:13px;line-height:20px;height:22px;
  background:transparent;cursor:pointer}
.lc-ep-plus:hover{background:var(--ep-accent-bg)}
.lc-ep-bar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:9px 10px 8px;border-bottom:1px solid var(--ep-line);font-size:12px;color:var(--ep-muted)}
.lc-ep-bar .ttl{color:var(--ep-text);font-weight:500}
.lc-ep-mini{appearance:none;border:1px solid var(--ep-chipbd);background:transparent;border-radius:6px;
  padding:2px 8px;font:11px/1.6 inherit;color:var(--ep-muted);cursor:pointer}
.lc-ep-mini:hover{color:var(--ep-strong);background:var(--ep-hover)}
.lc-ep-mini.on{color:var(--ep-accent);border-color:var(--ep-accent)}
.lc-ep-body{flex:1 1 auto;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:8px 10px 10px}
/* 居中不用 justify-content:center：内容比容器高时（窄面板下说明文字
 * 折行变多就会）center 会向顶底两侧同时溢出，顶部溢出滚动永远够不到
 * （道具按钮被削成一条边）。margin-block:auto 在有空间时同样居中，
 * 溢出时自动归零、退化为正常的顶部对齐 + 可滚动 */
.lc-ep-body.center{display:flex;flex-direction:column}
.lc-ep-body.center>*{margin-block:auto}
.lc-ep-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.lc-ep-chip{position:relative;appearance:none;border:1px solid transparent;background:transparent;
  border-radius:6px;padding:5px 6px;font:12px/1.4 inherit;color:var(--ep-text);cursor:pointer;
  text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lc-ep-chip:hover{background:var(--ep-hover);border-color:var(--ep-chipbd)}
.lc-ep-chip.off{opacity:.4;cursor:not-allowed}
.lc-ep-chip .lc-ep-x{position:absolute;top:2px;right:2px;width:14px;height:14px;line-height:14px;
  border-radius:50%;background:var(--ep-x-bg);color:var(--ep-x-fg);font-size:10px;text-align:center;
  opacity:0;transition:opacity .12s,background-color .12s,color .12s}
.lc-ep-chip:hover .lc-ep-x{opacity:1}
.lc-ep-chip .lc-ep-x:hover{background:var(--ep-danger);color:#fff}
.lc-ep-group{margin:0 0 12px}
.lc-ep-group:last-child{margin-bottom:0}
.lc-ep-ghead{display:flex;align-items:center;gap:6px;margin:0 0 5px;font-size:12px;
  color:var(--ep-muted);min-height:20px}
.lc-ep-ghead .gname{color:var(--ep-text);font-weight:500}
.lc-ep-ghead input.gname{font:12px inherit;color:var(--ep-text);background:var(--ep-sub);
  border:1px solid var(--ep-accent);border-radius:4px;padding:0 4px;width:112px;outline:none}
.lc-ep-ghead .gtag{font-size:10px;padding:0 5px;border-radius:4px;border:1px solid var(--ep-chipbd);
  cursor:pointer}
.lc-ep-ghead .gtag.rent{color:var(--ep-amber);border-color:var(--ep-amber);background:var(--ep-amberbg)}
.lc-ep-ghead .tgl{font-size:11px;cursor:pointer;padding:0 4px;border-radius:4px;color:var(--ep-muted)}
.lc-ep-ghead .tgl:hover{background:var(--ep-hover);color:var(--ep-text)}
.lc-ep-ghead .tgl.on{color:var(--ep-amber)}
.lc-ep-ghead .del{color:var(--ep-danger);cursor:pointer;font-size:11px;margin-left:auto}
.lc-ep-note{font-size:11px;color:var(--ep-muted);padding:0 0 6px}
.lc-ep-sub p{margin:0 0 6px;font-size:11px;color:var(--ep-muted);line-height:1.7}
.lc-ep-sub textarea{width:100%;height:84px;resize:none;font:12px/1.6 inherit;color:var(--ep-text);
  background:var(--ep-sub);border:1px solid var(--ep-line);border-radius:6px;padding:6px 8px;outline:none}
.lc-ep-sub textarea:focus{border-color:var(--ep-accent)}
.lc-ep-sub .row{display:flex;gap:6px;margin-top:5px;align-items:center;flex-wrap:wrap}
.lc-ep-summary{font-size:12px;color:var(--ep-text)}
.lc-ep-summary b{font-weight:500}
.lc-ep-summary .skip{color:var(--ep-muted);font-size:11px}
.lc-ep-warn{color:var(--ep-amber);font-size:11px;margin-top:6px;line-height:1.7}
.lc-ep-plist{margin-top:8px;border-top:1px solid var(--ep-line);padding-top:7px}
.lc-ep-phead{font-size:11px;color:var(--ep-muted);margin:0 0 5px;line-height:1.6}
.lc-ep-prow{display:flex;align-items:center;gap:6px;padding:3px 2px;font-size:12px;min-height:26px}
.lc-ep-prow .pn{color:var(--ep-text);font-weight:500;max-width:150px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lc-ep-prow .alias{font-size:11px;color:var(--ep-muted);min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.lc-ep-prow .pc{font-size:11px;color:var(--ep-muted);margin-left:auto;white-space:nowrap}
.lc-ep-seg{display:inline-flex;border:1px solid var(--ep-chipbd);border-radius:6px;overflow:hidden;
  flex:0 0 auto}
.lc-ep-seg b{font:11px/1.9 inherit;font-weight:400;padding:0 6px;cursor:pointer;color:var(--ep-muted);
  user-select:none}
.lc-ep-seg b:hover{background:var(--ep-hover)}
.lc-ep-seg b.on{background:var(--ep-accent-bg);color:var(--ep-accent)}
.lc-ep-seg b.on.rent{background:var(--ep-amberbg);color:var(--ep-amber)}
.lc-ep-seg.ro{opacity:.6;cursor:default}
.lc-ep-seg.ro b{cursor:default}
.lc-ep-seg.ro b:hover{background:transparent}
.lc-ep-seg.ro b.on:hover{background:var(--ep-accent-bg)}
.lc-ep-seg.ro b.on.rent:hover{background:var(--ep-amberbg)}
.lc-ep-rentbar{flex:0 0 auto;padding:4px 10px;font-size:11px;line-height:1.6;color:var(--ep-amber);
  background:var(--ep-amberbg);border-bottom:1px solid var(--ep-line)}
.lc-ep-rentbar.off{color:var(--ep-muted);background:transparent}
.lc-ep-empty{text-align:center;color:var(--ep-muted);font-size:12px;padding:0 10px;line-height:2}
.lc-ep-special{width:100%;margin:2px 0 4px;padding:10px 12px;background:var(--ep-amberbg);
  color:var(--ep-amber);border:0;border-radius:8px;display:block;font:13px/1.5 inherit;
  cursor:pointer;text-align:left}
.lc-ep-special:hover{filter:brightness(.98)}
.lc-ep-prop p{margin:8px 2px 0;font-size:11px;color:var(--ep-muted);line-height:1.7}
.lc-ep-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:6px 10px 9px;font-size:11px;color:var(--ep-muted);border-top:1px solid var(--ep-line)}
.lc-ep-foot .hint{min-width:0}
.lc-ep-toast{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);
  background:var(--ep-text);color:var(--ep-card);border-radius:8px;padding:6px 12px;font-size:12px;
  display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,.2);white-space:nowrap}
.lc-ep-toast a{color:var(--ep-accent);cursor:pointer;text-decoration:none}
`;

function lcEpEnsureStyle() {
  let st = document.getElementById(EP_STYLE_ID);
  if (!st) {
    st = document.createElement('style');
    st.id = EP_STYLE_ID;
    (document.head || document.documentElement).appendChild(st);
  }
  if (st.textContent !== EP_CSS) st.textContent = EP_CSS;
  return st;
}
function lcEpEnsureDom() {
  const root = document.documentElement || document.body;
  if (!root) return null;
  if (epHost && epHost.isConnected) return epHost;
  lcEpEnsureStyle();
  epHost = document.createElement('div');
  epHost.className = 'lc-ep-host';
  epHost.setAttribute('data-lc-emoji-host', '1');
  const panel = document.createElement('div');
  panel.className = 'lc-emoji-panel';
  epHost.appendChild(panel);
  /* 关键：面板内 mousedown 一律不夺焦点（面板里的输入框除外）。否则点
   * 表情按钮会把焦点从页面编辑器抢走，contenteditable 的光标选区随之
   * 丢失，execCommand('insertText') 插不进去（专栏评论区的老式编辑器
   * 就是这么哑火的；textarea 页走 value 直写不受影响）。这是编辑器
   * 工具栏按钮的标准做法：mousedown preventDefault，click 照常触发 */
  epHost.addEventListener('mousedown', (e) => {
    const t = e.target;
    try {
      if (
        t &&
        t.nodeType === 1 &&
        t.closest &&
        t.closest('input, textarea, [contenteditable="true"]')
      ) {
        return; /* 面板自己的输入控件（导入框/别名编辑等）要正常拿焦点 */
      }
    } catch (err) {}
    e.preventDefault();
  });
  root.appendChild(epHost);
  /* i18n（#16）：面板是插件自有容器 —— 在此接管翻译，后续 lcEpRender*
   * 往里写的内容由 watcher 自动跟上（无需逐处包 T()） */
  if (typeof LC_I18N !== "undefined") LC_I18N.watch(epHost);
  return epHost;
}
function lcEpPanelEl() {
  return epHost ? epHost.querySelector('.lc-emoji-panel') : null;
}
/* 关 = 从页面彻底摘除（入口同步隐藏），不留任何节点与样式 */
function lcEpTeardown() {
  epOpen = false;
  epOwner = null;
  epDraft = null;
  epRmtWin = null;
  epRmtFrame = null;
  epRmtBr = null;
  epRmtInputRight = null;
  /* 退场动画的定时器要一并撤（与 lcEpClose 对偶）：留着会在 120ms 后
     对着已摘除的 epHost 写 className → 未捕获 TypeError */
  clearTimeout(epAnimT);
  if (epHost && epHost.parentNode) epHost.parentNode.removeChild(epHost);
  epHost = null;
  try {
    const st = document.getElementById(EP_STYLE_ID);
    if (st) st.remove();
  } catch (e) {}
}
function lcEpGate() {
  if (!lcEpOn()) {
    if (epRemote && epRemoteOpen) lcEpRemoteClose();
    if (epHost || epOpen) lcEpTeardown();
    return false;
  }
  return true;
}
/* 面板尺寸恒定 340×348，锚在按钮上方 6px、允许顶部超出屏幕；打开时
 * 算一次，之后由 scroll/resize 捕获监听实时重算跟随按钮（rAF 节流） */
function lcEpPlace() {
  if (!epOpen) return;
  if (!epHost) return;
  /* 几何先行：蒙版探测要在面板的预期落点上做——蒙版只盖住面板那块
   * 区域，不一定盖住按钮（发现-趋势页就是按钮在蒙版外、面板在蒙版内） */
  const vw = document.documentElement.clientWidth || 0;
  const sx = window.scrollX || window.pageXOffset || 0;
  const sy = window.scrollY || window.pageYOffset || 0;
  let br = { top: 0, bottom: 0, right: 0 };
  let ir = null;
  if (epRmtFrame) {
    /* 跨帧会话：锚点在子帧里。子帧上报的是按钮/输入框的「子帧视口坐
     * 标」，加上 iframe 元素在顶层视口的实时矩形即得顶层视口坐标——
     * 顶层滚动由 scroll 跟随重算，子帧滚动由子帧转发 move 消息 */
    if (!epRmtFrame.isConnected) {
      lcEpClose();
      return;
    }
    let fr = { left: 0, top: 0 };
    try {
      fr = epRmtFrame.getBoundingClientRect();
    } catch (e) {}
    br = {
      top: fr.top + (epRmtBr ? epRmtBr.top : 0),
      bottom: fr.top + (epRmtBr ? epRmtBr.bottom : 0),
      right: fr.left + (epRmtBr ? epRmtBr.right : 0),
    };
    if (epRmtInputRight != null) {
      ir = { right: fr.left + epRmtInputRight, width: 1 };
    }
  } else {
    if (!epOwner || !epOwner.isConnected) {
      lcEpClose();
      return;
    }
    try {
      br = epOwner.getBoundingClientRect();
    } catch (e) {}
    const input = lcEpInputOf(epOwner);
    try {
      if (input) ir = input.getBoundingClientRect();
    } catch (e) {}
  }
  const w = vw ? Math.min(340, vw - 16) : 340;
  const rightEdge = ir && ir.width ? ir.right : br.right;
  let left = vw ? Math.min(vw - w - 8, rightEdge - w) : rightEdge - w;
  if (!vw || left < 8) left = 8;
  /* 全高 348 锚在按钮上方 6px，顶端允许超出「文档顶」：面板永远完整
   * 地贴在按钮上方，按钮靠近屏幕顶部时面板上缘被视口自然裁掉，导航
   * 栏（z 更高）盖住露出的部分。不做顶端钳 0 / 高度收缩——那会把整
   * 板压在文档顶和按钮之间挤成矮条（跨帧会话里子帧内滚动时尤为明显，
   * 用户明确否决了该行为）。仅当视口本身极矮时按视口高度收一下，防
   * 底边整个出屏 */
  let h = 348;
  try {
    const vhEp = document.documentElement.clientHeight || 0;
    if (vhEp > 120 && h > vhEp - 8) h = vhEp - 8;
  } catch (e) {}
  const top = (br.top || 0) - 6 - h;

  /* 层级探测：重落位（滚动跟随）时面板已可见，会挡住 elementFromPoint
   * ——先整板隐身，探完再恢复。display 不能动（会闪），visibility 不影响布局 */
  const prevVis = epHost.style.visibility;
  epHost.style.visibility = 'hidden';
  /* 1) 导航栏：视口顶部中央的命中元素向上找 fixed/sticky 层；
   * 2) 蒙版：面板预期落点中心的命中元素向上找定位 z 层（只认 ≥100 的，
   *    避免把普通内容的 z:1 当成蒙版）。面板要压在蒙版之上、导航栏
   *    之下；蒙版若连导航栏都压过，就贴着蒙版上面走 */
  let navZ = 0;
  let navZRaw = '';
  let navEl = null;
  try {
    /* 命中探测：只在视口顶部中央探一点，可能被页面自身元素恰好挡住
     * （专栏等页面顶部有横幅/标签条）——左、中、右各试一次 */
    const xs = [Math.min(vw / 2, 300), 24, Math.max(24, vw - 24)];
    for (let xi = 0; xi < xs.length && !navEl; xi++) {
      let n = document.elementFromPoint(xs[xi], 12);
      while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          /* 只有「矮条」才算导航栏。全屏覆盖层（发现页图片查看器、
           * 各类弹窗蒙版）也挂在视口顶部且是 fixed——若当成导航栏，
           * 面板会被放到它下面一层（z=99996 被 z=99997 的查看器盖住
           * 就是这么来的）。高度超过视口 1/3 的一律按覆盖层处理 */
          let overlay = false;
          try {
            const r = n.getBoundingClientRect();
            const vh0 = document.documentElement.clientHeight || 800;
            if (r.height > 200 || r.height > vh0 / 3) overlay = true;
          } catch (err) {}
          if (!overlay) {
            navEl = n;
            navZRaw = String(cs.zIndex);
            const v = parseInt(cs.zIndex, 10);
            if (!isNaN(v)) navZ = v;
          }
          break;
        }
        n = n.parentElement;
      }
    }
    /* 兜底扫描：命中探测全部落空时（首页/tag 页见过），全量找「宽≥
     * 0.4 屏、高≤160、贴视口顶」的 fixed/sticky 矮条。有 2s 缓存，
     * 滚动跟随时不会每帧全量扫 */
    if (!navEl) {
      const nowNav = Date.now();
      if (
        lcEpNavCache.t &&
        nowNav - lcEpNavCache.t < 2000 &&
        lcEpNavCache.el &&
        lcEpNavCache.el.isConnected
      ) {
        navEl = lcEpNavCache.el;
        navZ = lcEpNavCache.z;
        navZRaw = lcEpNavCache.raw;
      } else {
        const vh0 = document.documentElement.clientHeight || 800;
        const els = document.querySelectorAll('div,header,nav,section,aside');
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          let cs;
          let r;
          try {
            cs = getComputedStyle(el);
            r = el.getBoundingClientRect();
          } catch (e2) {
            continue;
          }
          if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
          if (r.height <= 0 || r.width < vw * 0.4 || r.top > 60) continue;
          if (r.height > 160 || r.height > vh0 / 3) continue;
          const v = parseInt(cs.zIndex, 10);
          const z = isNaN(v) ? 0 : v;
          if (!navEl || z > navZ) {
            navEl = el;
            navZ = z;
            navZRaw = String(cs.zIndex);
          }
        }
        lcEpNavCache.t = nowNav;
        lcEpNavCache.el = navEl;
        lcEpNavCache.z = navZ;
        lcEpNavCache.raw = navZRaw;
      }
    }
    /* 有效层级修正：导航栏自己的 z 可能被外层堆叠上下文「困住」——
     * fixed/sticky 包装层、transform/filter/backdrop-filter 容器、
     * isolation 等在 Chrome 里都会开新上下文，导航栏的 9998 在根上下
     * 文里根本不算数，面板 z=9997 照样画在它上面（真机 DevTools 实
     * 锤：面板 9997 < 导航栏 9998，视觉上却反过来）。从导航栏逐级向
     * 上找最外层的「开堆叠上下文」祖先，用它的数字 z 作有效 navZ；
     * 最外层若是 auto 则归 0，交由几何裁切兜底 */
    try {
      let n2 = navEl && navEl.parentElement;
      while (n2 && n2.nodeType === 1 && n2 !== document.body && n2 !== document.documentElement) {
        const cs2 = getComputedStyle(n2);
        const ctx =
          cs2.position === 'fixed' ||
          cs2.position === 'sticky' ||
          (cs2.position !== 'static' && cs2.zIndex !== 'auto') ||
          cs2.transform !== 'none' ||
          cs2.filter !== 'none' ||
          (cs2.backdropFilter && cs2.backdropFilter !== 'none') ||
          parseFloat(cs2.opacity) < 1 ||
          cs2.isolation === 'isolate' ||
          cs2.mixBlendMode !== 'normal';
        if (ctx) {
          const v2 = parseInt(cs2.zIndex, 10);
          navZ = isNaN(v2) ? 0 : v2;
          navZRaw = String(cs2.zIndex) + '@outer';
        }
        n2 = n2.parentElement;
      }
    } catch (e2) {}
  } catch (e) {}
  let maskZ = 0;
  try {
    const vh = document.documentElement.clientHeight || 800;
    /* 探测点取面板「可见部分」的中点：top 允许负值后，几何中心可能
     * 落在视口外/导航栏底下，钳到 4 会探到导航栏自己。按可见区间取
     * 中点，再在向上爬时跳过已识别的导航栏元素，避免把导航栏当蒙版 */
    const visTop = Math.max(top, 0);
    const visBot = Math.min(top + h, vh);
    const cy = visBot > visTop ? (visTop + visBot) / 2 : Math.min(Math.max(top + h / 2, 4), Math.max(4, vh - 4));
    const cx = Math.min(Math.max(left + w / 2, 4), Math.max(4, vw - 4));
    let n = document.elementFromPoint(cx, cy);
    while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement) {
      if (navEl && n === navEl) {
        n = n.parentElement;
        continue;
      }
      const cs = getComputedStyle(n);
      if (cs.position !== 'static') {
        const v = parseInt(cs.zIndex, 10);
        if (!isNaN(v) && v >= 100) {
          /* 只认「近乎全屏」的覆盖层（发现页图片查看器这类）。页面普通
           * 元素自带的高 z（哪怕上万）不该把面板抬到导航栏之上——导航
           * 栏必须始终能盖住面板，这是用户明确的优先级 */
          let full = false;
          try {
            const r = n.getBoundingClientRect();
            const vh1 = document.documentElement.clientHeight || 800;
            full = r.width >= vw * 0.8 && r.height >= vh1 * 0.8;
          } catch (e2) {}
          if (full) {
            maskZ = v;
            break;
          }
        }
      }
      n = n.parentElement;
    }
  } catch (e) {}
  let z;
  /* 面板永远待在导航栏之下（导航栏要能盖住面板，用户明确要求）；
   * 蒙版只有比导航栏更高（如发现页图片查看器盖过导航栏）时才需要
   * 越过它——否则导航栏优先，面板贴着导航栏下面走 */
  const zBelowNav = navZ > 1 ? navZ - 1 : 0;
  const zAboveMask = maskZ > 0 && maskZ >= navZ ? maskZ + 1 : 0;
  if (zAboveMask || zBelowNav) {
    z = Math.max(zAboveMask, zBelowNav);
  } else {
    z = 2147482000; /* 无导航无蒙版（comment.do 子帧等） */
  }
  epHost.style.visibility = prevVis; /* 探测完恢复，隐身只限探测期间 */
  if (epHost.style.zIndex !== String(z)) epHost.style.zIndex = String(z);
  const css = {
    position: 'absolute',
    width: w + 'px',
    height: h + 'px',
    left: Math.round(left + sx) + 'px',
    top: Math.round(top + sy) + 'px',
  };
  Object.keys(css).forEach((k) => {
    if (epHost.style[k] !== css[k]) epHost.style[k] = css[k];
  });
  /* 导航栏遮盖（毛玻璃透出优先）：导航栏数字 z 可信时（zBelowNav 生效，
   * 面板真的画在玻璃栏下层），不裁切——让导航栏的 backdrop-filter 把
   * 面板模糊地映出来，这是想要的玻璃质感。只有拿不到数字 z（导航栏
   * z:auto / 探测只靠扫描兜底）或蒙版盖过导航栏时才用几何裁切兜底：
   * 把面板伸进导航栏竖直带内的部分裁掉，防面板浮在玻璃栏上面。裁切
   * 每次落位都重算，fixed/sticky 导航、任意滚动位置都成立 */
  let clip = '';
  if (navEl && !(zBelowNav > 0 && z === zBelowNav)) {
    try {
      const nr = navEl.getBoundingClientRect();
      const cut = nr.bottom - top; /* 面板盒顶到导航栏底缘（同一视口口径） */
      if (nr.height > 0 && cut > 0) {
        clip = cut >= h ? 'inset(100% 0 0 0)' : 'inset(' + Math.round(cut) + 'px 0 0 0)';
      }
    } catch (e) {}
  }
  if (epHost.style.clipPath !== clip) epHost.style.clipPath = clip;
  const cls = 'lc-ep-host lc-open' + (lcEpHostDark() ? ' lc-dk' : '');
  if (epHost.className !== cls) epHost.className = cls;
  /* 落位几何自动上报（见 EP_DIAG_KEY 注释）：探针任何时候都能取到
   * 最近一次落位的真实数值。滚动跟随时落位每帧都跑，节流 1s 一写 */
  try {
    const now = Date.now();
    if (now - lcEpDiagLast > 1000) {
      lcEpDiagLast = now;
      const r2 = epHost.getBoundingClientRect();
      chrome.storage.local.set({
      [EP_DIAG_KEY]: {
        url: location.href.slice(0, 160),
        isTop: window === window.top,
        z: epHost.style.zIndex,
        navZ: navZRaw || String(navZ || 0),
        maskZ: maskZ || 0,
        inline: epHost.style.width + ' x ' + epHost.style.height,
        rect: [r2.left, r2.top, r2.width, r2.height].map(Math.round),
        clientW: document.documentElement.clientWidth,
        clientH: document.documentElement.clientHeight,
        sy: window.scrollY || 0,
        ownerTop: Math.round(br.top || 0),
        h: Math.round(h),
        dpr: window.devicePixelRatio,
        t: now,
      },
      });
    }
  } catch (e) {}
}
/* 落位时机：打开时算一次 + scroll/resize 实时跟随（见 lcEpOpenFor 的
 * 监听），面板始终锚在按钮上方。唯一要跟的另一件事是「工具行被
 * React 洗掉」：在 cmtTick 里检查 owner 存活，没了就收面板 */
function lcEpToast(msg, undo) {
  if (!epHost) return;
  const old = epHost.querySelector('.lc-ep-toast');
  if (old) old.remove();
  const d = document.createElement('div');
  d.className = 'lc-ep-toast';
  const s = document.createElement('span');
  s.textContent = (typeof LC_I18N !== "undefined") ? LC_I18N.t(msg) : msg;
  d.appendChild(s);
  if (undo) {
    const a = document.createElement('a');
    a.textContent = (typeof LC_I18N !== "undefined") ? LC_I18N.t('撤销') : '撤销';
    a.addEventListener('click', () => {
      undo();
      d.remove();
    });
    d.appendChild(a);
  }
  epHost.appendChild(d);
  clearTimeout(epToastT);
  epToastT = setTimeout(() => d.remove(), 4000);
}

/* ---------- 渲染 ---------- */
function lcEpRender() {
  const panel = lcEpPanelEl();
  if (!panel) return;
  const sc = panel.querySelector('.lc-ep-body');
  const st = sc ? sc.scrollTop : 0;
  const mc = panel.querySelector('.lc-ep-tabs-mine');
  const ml = mc ? mc.scrollLeft : 0;
  const ti = panel.querySelector('#lc-ep-imp');
  const tv = ti ? ti.value : null;

  if (epTab.indexOf('c:') === 0 && !lcEpPack(epTab.slice(2))) epTab = '老福鸽';
  const key = epView + '|' + (epView === 'normal' ? epTab : '');
  const prevView = epLastKey.split('|')[0];
  const keep = key === epLastKey;
  epLastKey = key;

  let h;
  if (epView === 'import') h = lcEpViewImport();
  else if (epView === 'manage') h = lcEpViewManage();
  else h = lcEpViewNormal();
  panel.innerHTML = h;
  lcEpBind(panel);
  const nb = panel.querySelector('.lc-ep-body');
  if (nb && keep && st) nb.scrollTop = st;
  const nm = panel.querySelector('.lc-ep-tabs-mine');
  if (nm && ml && epView === 'normal' && prevView === 'normal') nm.scrollLeft = ml;
  const nt = panel.querySelector('#lc-ep-imp');
  if (nt) nt.value = tv !== null ? tv : epDraft ? epDraft.raw : '';
}
function lcEpViewNormal() {
  let h = '<div class="lc-ep-nav">';
  h +=
    '<div class="lc-ep-tabs-core">' +
    EP_CORE_TABS.map((t) => {
      return (
        '<button class="lc-ep-tab' +
        (t === epTab ? ' on' : '') +
        '" data-tab="' +
        lcEpEsc(t) +
        '">' +
        lcEpEsc(t) +
        '</button>'
      );
    }).join('') +
    '<button class="lc-ep-tab lc-ep-plus" data-tab="＋" title="添加自己买的表情包">＋</button></div>';
  h += '<div class="lc-ep-tabs-mine lc-ep-sb">';
  if (!epData.custom.length) {
    h +=
      '<span class="lc-ep-mine-hint">自己买的表情包会排在这里 —— 点右上「＋」粘贴导入</span>';
  } else {
    epData.custom.forEach((c) => {
      const on = 'c:' + c.pack === epTab;
      const cls =
        'lc-ep-tab' + (on ? ' on' : '') + (c.enabled === false ? ' off' : '');
      h +=
        '<button class="' +
        cls +
        '" data-tab="c:' +
        lcEpEsc(c.pack) +
        '" title="' +
        lcEpEsc(lcEpAlias(c)) +
        '">' +
        lcEpEsc(lcEpAlias(c)) +
        (c.perpetual === false ? '·月租' : '') +
        '</button>';
    });
  }
  h += '</div></div>';
  const c = epTab.indexOf('c:') === 0 ? lcEpPack(epTab.slice(2)) : null;
  if (c && c.enabled === false) {
    h +=
      '<div class="lc-ep-rentbar off">这个包已停用 · 到「管理」里启用后才好点进去发</div>';
  } else if (c && c.perpetual === false) {
    h += '<div class="lc-ep-rentbar">月租套装 · 到期后这些表情不再渲染</div>';
  }
  const b = lcEpBodyOfTab();
  h += '<div class="lc-ep-body lc-ep-sb' + (b.center ? ' center' : '') + '">' + b.h + '</div>';
  h +=
    '<div class="lc-ep-foot"><span class="hint">网页端显示文字格式，App 端会渲染成表情图片</span>' +
    '<button class="lc-ep-mini" data-act="manage-on">管理</button></div>';
  return h;
}
function lcEpBodyOfTab() {
  if (epTab === '道具') {
    return {
      center: true,
      h:
        '<div class="lc-ep-prop">' +
        '<button class="lc-ep-special" data-ins="' +
        lcEpEsc(lcEpFmt('', EP_PROP_NAME)) +
        '">' +
        lcEpEsc(EP_PROP_NAME) +
        '</button>' +
        '<p>官方目前唯一的互动道具。点一下把 [更新求踢] 放进输入框；App 端点它会直接发送，单独手打发送也触发。<br>' +
        '<b>和别的文字或表情夹在一起发就会失效</b>，变成普通文字。</p></div>',
    };
  }
  if (epTab === '联动') {
    let h = '';
    lcEpBuiltinGroups('联动').forEach((g) => {
      h +=
        '<div class="lc-ep-group"><div class="lc-ep-ghead"><span class="gname">' +
        lcEpEsc(g.pack) +
        '</span><span>' +
        g.items.length +
        '</span></div><div class="lc-ep-grid">' +
        g.items
          .map((n) => {
            const full = lcEpFmt(g.pack, n);
            return (
              '<button class="lc-ep-chip" data-ins="' +
              lcEpEsc(full) +
              '" title="' +
              lcEpEsc(full) +
              '">' +
              lcEpEsc(n) +
              '</button>'
            );
          })
          .join('') +
        '</div></div>';
    });
    return { h };
  }
  if (epTab.indexOf('c:') === 0) {
    const c = lcEpPack(epTab.slice(2));
    if (!c) return { center: true, h: '<div class="lc-ep-empty">这个表情包已经不在了</div>' };
    if (!c.items.length) {
      return {
        center: true,
        h:
          '<div class="lc-ep-empty">这个包还是空的<br><span style="font-size:11px">点「＋」粘贴导入，或到「管理」里补</span></div>',
      };
    }
    return {
      h:
        '<div class="lc-ep-grid">' +
        c.items
          .map((n) => {
            const full = lcEpFmt(c.pack, n);
            return (
              '<button class="lc-ep-chip' +
              (c.enabled === false ? ' off' : '') +
              '" data-ins="' +
              lcEpEsc(full) +
              '" title="' +
              lcEpEsc(full) +
              '">' +
              lcEpEsc(n) +
              '</button>'
            );
          })
          .join('') +
        '</div>',
    };
  }
  return {
    h:
      '<div class="lc-ep-grid">' +
      lcEpFlat(epTab)
        .map((it) => {
          const full = lcEpFmt(it.pack, it.name);
          return (
            '<button class="lc-ep-chip" data-ins="' +
            lcEpEsc(full) +
            '" title="' +
            lcEpEsc(full) +
            '">' +
            lcEpEsc(it.name) +
            '</button>'
          );
        })
        .join('') +
      '</div>',
  };
}
function lcEpViewImport() {
  return (
    '<div class="lc-ep-bar"><span class="ttl">添加自己的表情包</span>' +
    '<button class="lc-ep-mini" data-act="back">返回</button></div>' +
    '<div class="lc-ep-body lc-ep-sb">' +
    lcEpImportHtml() +
    '</div>' +
    '<div class="lc-ep-foot"><span class="hint">在 App 里点一遍再复制，比手打快</span></div>'
  );
}
function lcEpImportHtml() {
  let t =
    '<div class="lc-ep-sub"><p>在 App 里把要的表情挨个点进一条评论，然后复制整段粘进来；' +
    '不想要的复制时删掉即可，也可以直接在框里手打 <b>[包名/表情名]</b> 补充：</p>' +
    '<textarea id="lc-ep-imp" placeholder="[星尘/比心][星尘/大哭][糯米太太/贴贴]…"></textarea>' +
    '<div class="row"><button class="lc-ep-mini" data-act="parse">解析</button>';
  if (epDraft) {
    t +=
      '<span class="lc-ep-summary">识别到 <b>' +
      epDraft.packs.length +
      '</b> 个包 · <b>' +
      epDraft.count +
      '</b> 个表情（已去重）' +
      (epDraft.exist
        ? '<span class="skip">，' + epDraft.exist + ' 个已存在会跳过</span>'
        : '') +
      '</span>' +
      '<button class="lc-ep-mini on" data-act="save-import">全部保存</button>';
  }
  t += '</div>';
  if (epDraft && epDraft.warn) t += '<div class="lc-ep-warn">' + lcEpEsc(epDraft.warn) + '</div>';
  if (epDraft) t += lcEpPackListHtml();
  return t + '</div>';
}
function lcEpPackListHtml() {
  let h =
    '<div class="lc-ep-plist"><div class="lc-ep-phead">将要保存的包 —— 默认永久，买的是月租就点一下切换：</div>';
  for (let i = 0; i < epDraft.packs.length; i++) {
    const p = epDraft.packs[i];
    const c = lcEpPack(p.pack);
    const rent = p.rent === true;
    h +=
      '<div class="lc-ep-prow"><span class="pn" title="' +
      lcEpEsc(p.pack) +
      '">' +
      lcEpEsc(p.pack) +
      '</span>';
    if (c) {
      if (c.alias && c.alias !== c.pack) {
        h += '<span class="alias">现名：' + lcEpEsc(c.alias) + '</span>';
      }
      h +=
        '<span class="pc">' +
        p.items.length +
        ' 个</span>' +
        '<span class="lc-ep-seg ro" title="这个包已经添加过，沿用它的现有设置，要改去「管理」">' +
        '<b class="' + (c.perpetual ? 'on' : '') + '">永久</b>' +
        '<b class="' + (c.perpetual ? '' : 'on rent') + '">月租</b></span>';
    } else {
      h +=
        '<span class="pc">' +
        p.items.length +
        ' 个</span>' +
        '<span class="lc-ep-seg" data-seg="' +
        lcEpEsc(p.pack) +
        '">' +
        '<b class="' + (rent ? '' : 'on') + '" data-rent="0">永久</b>' +
        '<b class="' + (rent ? 'on rent' : '') + '" data-rent="1">月租</b></span>';
    }
    h += '</div>';
  }
  return h + '</div>';
}
function lcEpViewManage() {
  let h =
    '<div class="lc-ep-bar"><span class="ttl">管理我的表情包</span>' +
    '<button class="lc-ep-mini on" data-act="back">完成</button></div>';
  if (!epData.custom.length) {
    h +=
      '<div class="lc-ep-body lc-ep-sb center"><div class="lc-ep-empty">还没有添加自己的表情包<br>' +
      '<span style="font-size:11px">回到面板点「＋」，粘贴导入</span></div></div>';
  } else {
    h += '<div class="lc-ep-body lc-ep-sb">';
    for (let i = 0; i < epData.custom.length; i++) h += lcEpManageGroup(epData.custom[i]);
    h += '</div>';
  }
  /* foot 右侧挂「清空最近使用」：自动清理只管失效条目，主动重置记录
     靠这里（无确认，记录可重建，误点零成本） */
  h +=
    '<div class="lc-ep-foot"><span class="hint">改动即时保存</span>' +
    (epData.recent.length
      ? '<span data-clrrec style="color:var(--ep-danger);cursor:pointer;font-size:11px" title="清空输入框下方「最近使用」一行">清空最近使用</span>'
      : '') +
    '</div>';
  return h;
}
function lcEpManageGroup(c) {
  let g =
    '<div class="lc-ep-group"><div class="lc-ep-ghead">' +
    '<input class="gname" data-pack="' +
    lcEpEsc(c.pack) +
    '" value="' +
    lcEpEsc(lcEpAlias(c)) +
    '">' +
    '<span>' +
    c.items.length +
    '</span>' +
    '<span class="gtag' +
    (c.perpetual ? '' : ' rent') +
    '" data-type="' +
    lcEpEsc(c.pack) +
    '" title="点一下切换永久 / 月租">' +
    (c.perpetual ? '永久' : '月租') +
    '</span>' +
    '<span class="tgl' +
    (c.enabled === false ? ' on' : '') +
    '" data-tg="' +
    lcEpEsc(c.pack) +
    '">' +
    (c.enabled === false ? '已停用·点启用' : '停用') +
    '</span>' +
    '<span class="del" data-delpack="' +
    lcEpEsc(c.pack) +
    '">删除整包</span></div>' +
    '<div class="lc-ep-note">只改这里的显示名，发出去的格式仍是 <b>' +
    lcEpEsc(c.pack) +
    '</b></div><div class="lc-ep-grid">';
  for (let j = 0; j < c.items.length; j++) {
    const full = lcEpFmt(c.pack, c.items[j]);
    g +=
      '<button class="lc-ep-chip' +
      (c.enabled === false ? ' off' : '') +
      '" data-ins="' +
      lcEpEsc(full) +
      '" title="' +
      lcEpEsc(full) +
      '">' +
      lcEpEsc(c.items[j]) +
      '<span class="lc-ep-x" data-dp="' +
      lcEpEsc(c.pack) +
      '" data-dn="' +
      lcEpEsc(c.items[j]) +
      '">×</span></button>';
  }
  if (!c.items.length) {
    g += '<span style="font-size:11px;color:var(--ep-muted)">（空的）</span>';
  }
  g += '</div></div>';
  return g;
}

/* ---------- 交互 ---------- */
function lcEpBind(panel) {
  const all = (s) => Array.prototype.slice.call(panel.querySelectorAll(s));
  all('.lc-ep-tab').forEach((b) => {
    b.addEventListener('click', () => {
      const t = b.dataset.tab;
      if (t === '＋') {
        epView = 'import';
        epDraft = null;
        lcEpRender();
        return;
      }
      epTab = t;
      epView = 'normal';
      lcEpRender();
    });
  });
  all('[data-ins]').forEach((b) => {
    b.addEventListener('click', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.dp) return;
      if (epView !== 'normal') return;
      if (b.classList.contains('off')) {
        lcEpToast('这个包已停用，在「管理」里启用后再发');
        return;
      }
      lcEpInsert(b.dataset.ins);
    });
  });
  all('[data-dp]').forEach((x) => {
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      lcEpDelOne(x.dataset.dp, x.dataset.dn);
    });
  });
  all('[data-delpack]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      lcEpDelPack(b.dataset.delpack);
    });
  });
  all('[data-clrrec]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      epData.recent = [];
      lcEpSaveSoon();
      lcEpRender();
      lcEpToast('已清空最近使用记录');
    });
  });
  all('[data-type]').forEach((t) => {
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = lcEpPack(t.dataset.type);
      if (c) {
        c.perpetual = !c.perpetual;
        lcEpSaveSoon();
        lcEpRender();
      }
    });
  });
  all('[data-tg]').forEach((t) => {
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = lcEpPack(t.dataset.tg);
      if (c) {
        c.enabled = c.enabled === false;
        lcEpSaveSoon();
        lcEpRender();
      }
    });
  });
  all('.lc-ep-seg[data-seg] b').forEach((b) => {
    b.addEventListener('click', () => {
      if (!epDraft) return;
      const pn = b.parentNode.dataset.seg;
      const want = b.dataset.rent === '1';
      let p = null;
      for (let i = 0; i < epDraft.packs.length; i++) {
        if (epDraft.packs[i].pack === pn) p = epDraft.packs[i];
      }
      if (!p || p.rent === want) return;
      p.rent = want;
      lcEpRender();
    });
  });
  /* 重命名：blur / change 即提交并退出编辑态（点空白也能退出） */
  all('input[data-pack]').forEach((inp) => {
    const commit = () => {
      const c = lcEpPack(inp.dataset.pack);
      if (c && inp.value.trim() && inp.value.trim() !== lcEpAlias(c)) {
        c.alias = inp.value.trim();
        lcEpSaveSoon();
      }
      lcEpRender();
    };
    inp.addEventListener('change', commit);
    inp.addEventListener('blur', commit);
  });
  all('[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'manage-on') {
        epView = 'manage';
        lcEpRender();
      } else if (a === 'back') {
        epView = 'normal';
        epDraft = null;
        lcEpRender();
      } else if (a === 'parse') {
        lcEpParse();
      } else if (a === 'save-import') {
        lcEpSaveImport();
      }
    });
  });
}
function lcEpDelOne(packName, name) {
  const c = lcEpPack(packName);
  if (!c) return;
  const k = c.items.indexOf(name);
  if (k > -1) c.items.splice(k, 1);
  lcEpPruneRecent();
  lcEpSaveSoon();
  lcEpRender();
}
function lcEpDelPack(packName) {
  let idx = -1;
  for (let i = 0; i < epData.custom.length; i++) {
    if (epData.custom[i].pack === packName) idx = i;
  }
  if (idx < 0) return;
  const gone = epData.custom.splice(idx, 1)[0];
  if (epTab === 'c:' + packName) epTab = '老福鸽';
  /* 撤销只还原整包，最近里的过期条目不跟着回来（条目已清，恢复成本高） */
  lcEpPruneRecent();
  lcEpSaveSoon();
  lcEpRender();
  lcEpToast('已删除「' + lcEpAlias(gone) + '」整包', () => {
    epData.custom.splice(idx, 0, gone);
    lcEpSaveSoon();
    lcEpRender();
  });
}
/* 插入到光标处（不是尾部）。textarea 走原生 setter + input 事件，
 * React 才能感知；contenteditable（站点的 .bcmtipt/.editdiv）走
 * execCommand('insertText')，失败再退化为 Range 手工插入 */
/* 老式假输入框（实测 comment.do 的 div.bcmtipt，contentEditable=false，
 * 2026-09-24 探针日志实锤）：先按真实用户行为戳一下（站点多半在点击/
 * 聚焦时才把真编辑器换上来），再在自身和表单块范围内找真正可编辑的
 * 元素。实在没有就把这个 div 临时转成可编辑——它是可见的评论框，站点
 * 提交多半直接读它的文本。返回真正可插入的元素，失败返回 null */
function lcEpWakeEditable(box) {
  try {
    ['mousedown', 'mouseup', 'click'].forEach((ty) => {
      box.dispatchEvent(
        new MouseEvent(ty, { bubbles: true, cancelable: true }),
      );
    });
    box.focus();
  } catch (e) {}
  const scopes = [
    box,
    box.parentElement,
    box.closest('form') ||
      (box.parentElement && box.parentElement.parentElement),
  ];
  for (let i = 0; i < scopes.length; i++) {
    const sc = scopes[i];
    if (!sc || !sc.querySelector) continue;
    try {
      const alt = sc.querySelector(
        'textarea, [contenteditable="true"], [contenteditable=""]',
      );
      if (alt) return alt;
    } catch (e) {}
  }
  try {
    box.contentEditable = 'true';
    return box;
  } catch (e) {
    return null;
  }
}
/* 跨帧桥：带 __lcEp 标记的 postMessage。顶层侧收消息时还会校验
 * source 是本页某个 iframe 的 contentWindow，防任意页面伪造 */
function lcEpPostTo(win, extra) {
  try {
    win.postMessage(Object.assign({ __lcEp: 1 }, extra), '*');
  } catch (e) {}
}
function lcEpInsert(text) {
  /* 跨帧会话：面板在顶层、输入框在子帧——插入必须回到子帧执行
   * （成功后子帧自己推最近使用、失败由子帧回吐 toast） */
  if (epRmtWin) {
    lcEpPostTo(epRmtWin, { type: 'insert', text: String(text == null ? '' : text) });
    return true;
  }
  const input = epOwner ? lcEpInputOf(epOwner) : null;
  return lcEpInsertInto(input, text);
}
/* 指定输入框插入（最近 chips 行用：行元素自己持有 input 引用，不依赖
 * 面板的 epOwner 状态——chip 点击时面板多半根本没开） */
function lcEpInsertInto(input, text) {
  if (!input) {
    lcEpToast('插入失败：找不到输入框，关掉面板重开一次再试');
    return false;
  }
  let target = input;
  if (!input.isContentEditable && typeof input.value !== 'string') {
    target = lcEpWakeEditable(input);
    if (!target) {
      lcEpToast('插入失败：这个输入框类型不受支持（' + (input.tagName || '?') + '）');
      return false;
    }
  }
  let ok = false;
  try {
    if (target.isContentEditable) {
      /* 面板已防焦点丢失（mousedown preventDefault），编辑器选区通常
       * 还在；万一丢了（脚本切换视图等）就退化到末尾插入 */
      target.focus();
      try {
        ok = document.execCommand('insertText', false, text);
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
          try {
            const r = document.createRange();
            r.selectNodeContents(target);
            r.collapse(false); /* 光标落到编辑器末尾 */
            const s2 = window.getSelection();
            s2.removeAllRanges();
            s2.addRange(r);
            ok = document.execCommand('insertText', false, text);
          } catch (e) {
            ok = false;
          }
        } else {
          const r = sel.getRangeAt(0);
          r.deleteContents();
          const tn = document.createTextNode(text);
          r.insertNode(tn);
          r.setStartAfter(tn);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          ok = true;
        }
      }
      /* 老式编辑器（comment.do 的 ztag 系）靠 input 事件同步内部状态 */
      if (ok) {
        try {
          target.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (err) {}
      }
    } else if (typeof target.value === 'string') {
      const s = target.selectionStart == null ? target.value.length : target.selectionStart;
      const e = target.selectionEnd == null ? target.value.length : target.selectionEnd;
      const next = target.value.slice(0, s) + text + target.value.slice(e);
      try {
        const proto =
          target.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(target, next);
      } catch (err) {
        target.value = next;
      }
      try {
        target.setSelectionRange(s + text.length, s + text.length);
      } catch (err) {}
      try {
        target.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) {}
      ok = true;
    } else {
      /* 既不是 contenteditable 也没有字符串 value（站点怪异容器）——
       * 不静默：给出可见提示，避免「点了没反应」无从排查 */
      ok = false;
    }
  } catch (e) {
    ok = false;
  }
  if (!ok) {
    lcEpToast('插入失败：这个输入框类型不受支持（' + (target.tagName || '?') + '）');
    try {
      console.warn(
        '[lc] emoji insert failed:',
        'orig=' + input.tagName + '/' + (typeof input.className === 'string' ? input.className : ''),
        'target=' + target.tagName,
        'contentEditable=' + target.isContentEditable,
        'class=' + (typeof target.className === 'string' ? target.className : ''),
      );
    } catch (err) {}
  }
  if (ok) lcEpPushRecent(text);
  return ok;
}
function lcEpPushRecent(text) {
  const m = /^\[([^/[\]\n]+)\/([^/[\]\n]+)\]$/.exec(String(text || ''));
  const pack = m ? m[1] : '';
  const name = m ? m[2] : String(text || '').replace(/[[\]]/g, '');
  if (!name || name === EP_PROP_NAME) return;
  epData.recent = epData.recent.filter((r) => !(r.pack === pack && r.name === name));
  epData.recent.unshift({ pack, name });
  epData.recent = epData.recent.slice(0, EP_RECENT_MAX);
  lcEpSaveSoon();
}
/* ---------- 最近列表的过期清理（2026-09-26 用户实测：测试用的 666
 * 从包里删掉后仍留在最近里，点了也发的是死格式）----------
 * 有效性 = 自定义包在且 items 含该名；或内置平面清单含该 (pack,name)。
 * 停用（enabled=false）不算过期——启用后要能原样回来 */
function lcEpBuiltinHas(pack, name) {
  for (let i = 0; i < EP_BUILTIN.length; i++) {
    const p = EP_BUILTIN[i];
    for (let j = 0; j < p.items.length; j++) {
      const it = p.items[j];
      if (
        typeof it === 'string'
          ? p.tab === pack && it === name
          : it[0] === pack && it[1] === name
      ) {
        return true;
      }
    }
  }
  return false;
}
function lcEpRecentValid(r) {
  if (!r || !r.name) return false;
  if (r.pack) {
    const c = lcEpPack(r.pack);
    if (c) return c.items.indexOf(r.name) > -1;
    return lcEpBuiltinHas(r.pack, r.name);
  }
  return lcEpBuiltinHas('', r.name);
}
function lcEpPruneRecent() {
  const kept = epData.recent.filter(lcEpRecentValid);
  if (kept.length === epData.recent.length) return false;
  epData.recent = kept;
  lcEpSaveSoon();
  try {
    /* 快捷行的内容指纹作废，下轮同步即重建（顺序敏感，直接置空最稳） */
    cmtAreas.forEach((rec) => {
      rec.rowSig = '';
    });
  } catch (e) {}
  return true;
}
/* 导入解析：不校验合法性（付费包名千千万，格式对不对 App 端说了算），
 * 不勾选（不想要的复制时删掉即可），只报识别到的包/表情数 */
function lcEpParse() {
  const el = lcEpPanelEl() ? lcEpPanelEl().querySelector('#lc-ep-imp') : null;
  const raw = el ? el.value : '';
  const re = /\[([^/[\]\n]{1,24})\/([^/[\]\n]{1,24})\]/g;
  const map = {};
  const order = [];
  const seen = {};
  let m;
  let count = 0;
  let exist = 0;
  while ((m = re.exec(raw))) {
    const key = m[1] + '\u0000' + m[2];
    if (seen[key]) continue;
    seen[key] = 1;
    if (!map[m[1]]) {
      map[m[1]] = [];
      order.push(m[1]);
    }
    map[m[1]].push(m[2]);
    count++;
    const c = lcEpPack(m[1]);
    if (c && c.items.indexOf(m[2]) > -1) exist++;
  }
  if (!order.length) {
    epDraft = null;
    lcEpToast('没识别到表情格式，检查一下是不是复制全了');
    lcEpRender();
    return;
  }
  let warn = '';
  if (
    raw.indexOf('[' + EP_PROP_NAME + ']') > -1 &&
    raw.replace(/\[[^\]\n]{1,50}\]/g, '').trim()
  ) {
    warn =
      '内容里还有别的文字或表情，[更新求踢] 这样发出去会失效，已跳过不导入。';
  }
  epDraft = { packs: [], count, exist, warn, raw };
  for (let i = 0; i < order.length; i++) {
    epDraft.packs.push({ pack: order[i], items: map[order[i]], rent: false });
  }
  lcEpRender();
}
function lcEpSaveImport() {
  if (!epDraft) return;
  let n = 0;
  let skip = 0;
  let firstNew = '';
  for (let i = 0; i < epDraft.packs.length; i++) {
    const p = epDraft.packs[i];
    let c = lcEpPack(p.pack);
    if (!c) {
      /* 新包按解析时选的类型建；已存在的包沿用现有设置（归并追加） */
      c = {
        pack: p.pack,
        alias: p.pack,
        perpetual: p.rent !== true,
        enabled: true,
        items: [],
      };
      epData.custom.push(c);
    }
    for (let j = 0; j < p.items.length; j++) {
      if (c.items.indexOf(p.items[j]) > -1) {
        skip++;
        continue;
      }
      c.items.push(p.items[j]);
      n++;
      if (!firstNew) firstNew = p.pack;
    }
  }
  epDraft = null;
  epView = 'normal';
  if (firstNew) epTab = 'c:' + firstNew;
  lcEpSaveSoon();
  lcEpRender();
  lcEpToast('已保存 ' + n + ' 个新表情' + (skip ? '，' + skip + ' 个已存在跳过' : ''));
}

/* ---------- 开合 ---------- */
/* 全局监听（Esc / 点外关闭 / 滚动跟随）：本地面板与顶层托管面板共用，
 * 首次开面板时绑一次 */
function lcEpEnsureGlobal() {
  if (epGlobalBound) return;
  epGlobalBound = true;
  document.addEventListener(
    'keydown',
    (e) => {
      if (epOpen && e.key === 'Escape') lcEpClose();
    },
    true,
  );
  document.addEventListener(
    'mousedown',
    (e) => {
      if (!epOpen) return;
      const t = e.target;
      if (!t) return;
      try {
        if (epHost && epHost.contains(t)) return;
        if (t.nodeType === 1 && t.closest && t.closest('.lc-emoji')) return;
      } catch (err) {}
      lcEpClose();
    },
    true,
  );
  /* 滚动跟随：面板锚在按钮上方，滚动/缩放时实时重算贴回按钮。
   * scroll 用捕获——内层滚动容器（发现页 feed 等）的 scroll 事件
   * 不冒泡，捕获阶段的 window 监听能收到；rAF 节流到每帧一次 */
  let epPlaceRaf = 0;
  const epFollowScroll = () => {
    if (!epOpen || epPlaceRaf) return;
    epPlaceRaf = requestAnimationFrame(() => {
      epPlaceRaf = 0;
      if (epOpen) lcEpPlace();
    });
  };
  window.addEventListener('scroll', epFollowScroll, {
    capture: true,
    passive: true,
  });
  window.addEventListener('resize', epFollowScroll);
}
function lcEpOpenFor(bar) {
  if (!lcEpOn()) return;
  if (epRemote) {
    lcEpRemoteOpenFor(bar);
    return;
  }
  if (epRmtWin) {
    /* 本地开面板前收掉跨帧会话（同页内外两套评论框的罕见布局） */
    lcEpPostTo(epRmtWin, { type: 'close' });
    epRmtWin = null;
    epRmtFrame = null;
    epRmtBr = null;
    epRmtInputRight = null;
    epOpen = false;
  }
  lcEpEnsureDom();
  if (!epHost) return;
  epOwner = bar;
  epOpen = true;
  epView = 'normal';
  epDraft = null;
  /* 收起动画播到一半被重开：撤掉退场态，入场动画随 display 翻转重播 */
  clearTimeout(epAnimT);
  if (epHost.classList.contains('lc-out')) epHost.classList.remove('lc-out');
  lcEpRender();
  lcEpPlace();
  const eb = bar && bar.querySelector ? bar.querySelector('.lc-emoji') : null;
  if (eb) eb.classList.add('lc-on');
  lcEpEnsureGlobal();
}
function lcEpClose() {
  if (!epOpen && !epHost) return;
  const wasRemote = !!(epOpen && epRmtWin);
  epOpen = false;
  epOwner = null;
  epDraft = null;
  if (wasRemote) {
    /* 通知子帧收尾（按钮 lc-on 高亮、状态复位）；子帧不会再回发，
     * 它的 close 处理有 epRemoteOpen 门禁，不会成环 */
    lcEpPostTo(epRmtWin, { type: 'close' });
    epRmtWin = null;
    epRmtFrame = null;
    epRmtBr = null;
    epRmtInputRight = null;
  }
  if (epHost) {
    const finishClose = () => {
      /* 定时器可能在面板被门禁整体摘除之后才到点（lcEpTeardown 置空
         epHost + 已 clearTimeout，这里是第二道保险）——缺这条时
         epHost.className 抛未捕获 TypeError 打到控制台 */
      if (!epHost) return;
      epHost.className = 'lc-ep-host' + (lcEpHostDark() ? ' lc-dk' : '');
      const t = epHost.querySelector('.lc-ep-toast');
      if (t) t.remove();
    };
    if (epHost.classList.contains('lc-open')) {
      /* 收起动画：先保住 display:flex 播 120ms 退场，再整体复位。
       * 期间 epOpen 已为 false——几何跟随/插入等全部停走，纯视觉 */
      epHost.classList.add('lc-out');
      clearTimeout(epAnimT);
      epAnimT = setTimeout(finishClose, 120);
    } else {
      finishClose();
    }
  }
  document.querySelectorAll('.lc-cmt-tb .lc-emoji.lc-on').forEach((el) => {
    el.classList.remove('lc-on');
  });
}
function lcEpToggle(bar) {
  if (!lcEpOn()) return;
  if (epRemote) {
    if (epRemoteOpen && epOwner === bar) {
      lcEpRemoteClose();
      return;
    }
    lcEpRemoteOpenFor(bar);
    return;
  }
  if (epOpen && epOwner === bar) {
    lcEpClose();
    return;
  }
  lcEpOpenFor(bar);
}

/* ---------- 跨帧桥：子帧侧 ---------- */
/* 专栏文章页的评论区整体在 comment.do 子帧里，面板若画在子帧内会被
 * iframe 边界裁切。子帧只保留工具行/输入框/插入逻辑，面板由顶层帧
 * 托管渲染；几何上报用「子帧视口坐标」，顶层乘上 iframe 实时矩形换算 */
function lcEpRemoteGeom(bar) {
  let br = { top: 0, bottom: 0, right: 0 };
  try {
    br = bar.getBoundingClientRect();
  } catch (e) {}
  let inputRight = null;
  try {
    const input = lcEpInputOf(bar);
    if (input) inputRight = input.getBoundingClientRect().right;
  } catch (e) {}
  return {
    br: { top: br.top, bottom: br.bottom, right: br.right },
    inputRight: inputRight,
  };
}
function lcEpRemoteSend(type, extra) {
  try {
    const t = window.top;
    if (t && t !== window) {
      t.postMessage(Object.assign({ __lcEp: 1, type: type }, extra), '*');
    }
  } catch (e) {}
}
function lcEpRemoteBindSub() {
  if (epRmtBound) return;
  epRmtBound = true;
  /* 子帧滚动 → 按钮在 iframe 视口里的位置变了 → 上报新几何 */
  let moveRaf = 0;
  const sendMove = () => {
    moveRaf = 0;
    if (!epRemoteOpen || !epOwner) return;
    lcEpRemoteSend('move', lcEpRemoteGeom(epOwner));
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!epRemoteOpen || moveRaf) return;
      moveRaf = requestAnimationFrame(sendMove);
    },
    { capture: true, passive: true },
  );
  window.addEventListener('resize', () => {
    if (!epRemoteOpen || moveRaf) return;
    moveRaf = requestAnimationFrame(sendMove);
  });
  /* 顶层看不见 iframe 内部的点击：面板开着时，点子帧内任何地方
   * （除表情按钮本身）都视为点外，转发顶层收面板 */
  document.addEventListener(
    'mousedown',
    (e) => {
      if (!epRemoteOpen) return;
      const t = e.target;
      try {
        if (t && t.nodeType === 1 && t.closest && t.closest('.lc-emoji')) return;
      } catch (err) {}
      lcEpRemoteSend('outside', {});
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (epRemoteOpen && e.key === 'Escape') lcEpRemoteSend('outside', {});
    },
    true,
  );
  /* 顶层指挥：插入 / 收面板 */
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__lcEp !== 1) return;
    if (e.source !== window.top) return; /* 只听顶层指挥 */
    if (d.type === 'insert') {
      if (!epOwner) return;
      const ok = lcEpInsert(d.text);
      if (!ok) {
        lcEpRemoteSend('toast', { msg: '插入失败：输入框不可用，关掉面板重开再试' });
      }
    } else if (d.type === 'close') {
      lcEpRemoteClose();
    }
  });
}
function lcEpRemoteOpenFor(bar) {
  lcEpRemoteBindSub();
  epOwner = bar;
  epRemoteOpen = true;
  lcEpRemoteSend('open', lcEpRemoteGeom(bar));
  const eb = bar && bar.querySelector ? bar.querySelector('.lc-emoji') : null;
  if (eb) eb.classList.add('lc-on');
}
function lcEpRemoteClose() {
  if (!epRemoteOpen) return;
  epRemoteOpen = false;
  epOwner = null;
  document.querySelectorAll('.lc-cmt-tb .lc-emoji.lc-on').forEach((el) => {
    el.classList.remove('lc-on');
  });
  lcEpRemoteSend('close', {});
}

/* ---------- 跨帧桥：顶层托管侧 ---------- */
/* 顶层帧收到子帧的 open/move 后在本页渲染面板；插入指令发回子帧。
 * 只认「本页 iframe 的 contentWindow」发来的消息，防外部页面伪造 */
function lcEpBindTopHost() {
  if (epTopHostBound || epRemote) return;
  epTopHostBound = true;
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__lcEp !== 1) return;
    let frame = null;
    try {
      const ifs = document.querySelectorAll('iframe');
      for (let i = 0; i < ifs.length; i++) {
        if (ifs[i].contentWindow === e.source) {
          frame = ifs[i];
          break;
        }
      }
    } catch (err) {}
    if (!frame) return;
    if (d.type === 'bye') {
      /* 子帧文档被站点重建（导航/重载）：旧会话作废，收面板 */
      if (epOpen && epRmtWin === e.source) lcEpClose();
      return;
    }
    if (!lcEpOn()) return;
    if (d.type === 'open' || d.type === 'move') {
      epRmtWin = e.source;
      epRmtFrame = frame;
      epRmtBr = d.br || null;
      epRmtInputRight = d.inputRight != null ? d.inputRight : null;
      if (d.type === 'open') {
        if (epOpen && !epRmtWin) lcEpClose(); /* 本地会话让位 */
        if (!epOpen) {
          epOpen = true;
          epView = 'normal';
          epDraft = null;
          lcEpEnsureDom();
          if (!epHost) return;
          clearTimeout(epAnimT);
          if (epHost.classList.contains('lc-out')) epHost.classList.remove('lc-out');
          lcEpRender();
          lcEpEnsureGlobal(); /* Esc/点外/滚动跟随与本地路径共用 */
        }
      }
      if (epOpen) lcEpPlace();
    } else if (d.type === 'outside') {
      if (epOpen && epRmtWin) lcEpClose();
    } else if (d.type === 'close') {
      /* 子帧侧自己收了面板（toggle / 工具行被 React 洗掉 / 总开关关闭） */
      if (epOpen && epRmtWin === e.source) lcEpClose();
    } else if (d.type === 'toast') {
      if (epOpen) lcEpToast(d.msg || '');
    }
  });
}
/* 装配：顶层帧挂托管监听；子帧向顶层报到——若顶层还留着本 iframe
 * 旧文档的遗留面板（站点重建了 comment.do），立即作废收起 */
lcEpBindTopHost();
if (epRemote) lcEpRemoteSend('bye', {});

function lcSetupCommentFilter() {
  cmtDiag.ran = true;
  /* 可重入：旧观察者可能挂在已被 document.write 重建掉的旧 <html> 上，
   * 样式表也可能随文档一起被抹掉 —— 一律先拆再建。 */
  if (cmtObserver) {
    try {
      cmtObserver.disconnect();
    } catch (e) {}
    cmtObserver = null;
  }
  try {
    const old = document.getElementById(CMT_STYLE_ID);
    if (old) old.remove();
  } catch (e) {}
  chrome.storage.local.get(
    ['lc_settings_v1', 'lc_official_bl_v1', EP_KEY],
    (res) => {
      cmtSettings = res['lc_settings_v1'] || {};
      const obl = res['lc_official_bl_v1'] || {};
      cmtOfficialNames = new Set(
        (Array.isArray(obl.names) ? obl.names : []).map(String),
      );
      lcEpLoad(res[EP_KEY]);
      cmtTick();
      /* 观察当前这一份 documentElement（重挂后可能已经是新的那个） */
      if (cmtObserver || !document.documentElement) return;
      cmtObserver = new MutationObserver(() => {
        /* 节流（非防抖）：首笔变异就排定 tick，后续变异不再顺延。
         * tag 页展开评论时站点连绵不断地写 DOM（列表分批插入、图片
         * 占位替换），防抖会把 tick 一直推到风暴停歇之后——工具行发
         * 现输入框就迟到 ~3s（真机实测 3.8s）。tick 幂等全量重算，
         * 跑在风暴中也安全，限频 ~8Hz 足够 */
        if (cmtTimer) return;
        cmtTimer = setTimeout(() => {
          cmtTimer = 0;
          cmtTick();
        }, 120);
      });
      cmtObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    },
  );
  if (cmtStorageBound) return;
  cmtStorageBound = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['lc_settings_v1']) {
      cmtSettings = changes['lc_settings_v1'].newValue || {};
      cmtTick();
    }
    if (changes['lc_official_bl_v1']) {
      const v = changes['lc_official_bl_v1'].newValue || {};
      cmtOfficialNames = new Set(
        (Array.isArray(v.names) ? v.names : []).map(String),
      );
      cmtTick();
    }
    /* 自定义表情（跨帧共享：面板开在哪个帧，哪个帧就用同一份数据） */
    if (changes[EP_KEY]) {
      lcEpLoad(changes[EP_KEY].newValue);
    }
    /* 跨帧诊断中继（见 lcCmtPublishSelf）：子帧收到顶层帧的探测请求就自报；
     * 顶层帧收到任何一帧的诊断就重新汇总。只认这两个键，不会自激循环。 */
    if (changes[CMT_DIAG_REQ_KEY]) {
      const pid = changes[CMT_DIAG_REQ_KEY].newValue;
      if (pid && window !== window.top) lcCmtPublishSelf(pid);
    }
    if (changes[CMT_DIAG_KEY] && window === window.top) {
      lcCmtRender(changes[CMT_DIAG_KEY].newValue || {});
    }
  });
  /* 窗口尺寸变化 → 工具行与输入框右缘重新对齐（量测型补偿，防抖）。
   * 与 storage.onChanged 一样只在首帧绑一次（cmtStorageBound 门禁） */
  let cmtTbResizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(cmtTbResizeT);
    cmtTbResizeT = setTimeout(cmtTick, 200);
  });
}

function lcCmtGateOk() {
  try {
    const href = location.href;
    if (/^about:/i.test(href) || /^about:/i.test(document.URL || '')) return false;
    if (window.name === 'theme_preview' || href.includes('themesettingproxy.html')) {
      return false;
    }
    if (href.includes('lf127.net')) return false; /* 编辑器帧：不插手 */
    return true;
  } catch (e) {
    return false;
  }
}

/* 挂载 / 重挂。评论区 iframe（www.lofter.com/comment.do）是旧式服务端渲染
 * 页，解析时会 document.write()：隐式 document.open() 把文档清空重建，
 * 此前注入的样式表与挂在旧 document/html 上的监听全部失效 —— 而 content
 * script 每帧只执行一次，所以必须自己发现「文档被换过」并重跑
 * （2026-09-21 实证：该帧探针显示「本帧无桥」，正是这个成因）。 */
function lcCmtArm() {
  if (!lcCmtGateOk()) return;
  const el = document.documentElement;
  if (!el) return;
  if (cmtDocEl && el !== cmtDocEl) cmtDiag.docSwaps += 1;
  cmtDocEl = el;
  /* documentElement 上也挂一份（兼容不冒泡的事件派发；重挂时随新文档
   * 换新元素，用 expando 防止同一元素重复绑定） */
  try {
    if (!el.__lcCmtProbe) {
      el.__lcCmtProbe = 1;
      el.addEventListener('lc-probe-cmt', lcCmtReport);
    }
  } catch (e) {}
  lcSetupCommentFilter();
}

/* 调试桥挂在 window 上（不是 document）：document.open() 会清空文档上的
 * 监听，而 window 上的监听在文档被重建后依然存活。任意帧可用：控制台
 * dispatch 'lc-probe-cmt' → 读 <html data-lc-probe-cmt>；跨域 iframe 需在
 * DevTools 的帧选择器里切到该帧再执行。事件最好带 {bubbles:true} 才能
 * 到达 window（另在 documentElement 上也挂一份，兼容不冒泡的派发）。 */
function lcCmtPayload() {
  const payload = {
    /* 构建标记：浏览器里跑探针看不到这个字段 = 扩展没重载 / 页面没刷新，
     * 三处修复（0 评论退化、z 探测、面板几何）都还在旧版本上。
     * 20260924d：玻璃透出优先——navZ 数字可信时不裁切（backdrop-filter
     * 直接糊住面板），仅 z:auto/扫描兜底/蒙版盖过导航栏时几何裁切；
     * 20260924c：蒙版只认近乎全屏覆盖层 + 导航栏全量扫描兜底 +
     * 蒙版只认近乎全屏的覆盖层 + 导航栏探测加全量扫描兜底（2s 缓存），
     * EP_DIAG 新增 navZ/maskZ */
    probeVer: '20260926n', /* n：回滚 o 轮三个定时触发（开/关面板补 sync + 350ms 回检）——真机实锤「过渡态跑对齐=写毒 margin」：展开评论区动画中触发的对齐写坏 margin，旧行带着毒 margin 骗过几何门禁，每次展开多一行。维持 m 版仅门禁方案；0 评论页行消失（缺恢复触发源）另想不依赖定时器的恢复路径 */
    url: location.href.slice(0, 160),
    isTop: window === window.top,
    docSwapped: document.documentElement !== cmtDocEl,
    diag: cmtDiag,
  };
  /* 表情面板几何（专栏文章面板偏窄的排查字段）：帧宽 / 内联尺寸 /
   * 实际渲染矩形 / DPR。面板没建时也输出 present:false —— 探针输出
   * 顶层有 emojiPanel 这个键本身就说明新代码在跑 */
  try {
    if (typeof epHost !== 'undefined' && epHost && epHost.isConnected) {
      const r = epHost.getBoundingClientRect();
      payload.emojiPanel = {
        present: true,
        open: epOpen,
        pos: getComputedStyle(epHost).position,
        z: getComputedStyle(epHost).zIndex,
        inline: epHost.style.width + ' x ' + epHost.style.height,
        rect: [r.left, r.top, r.width, r.height].map(Math.round),
        clientW: document.documentElement.clientWidth,
        dpr: window.devicePixelRatio,
      };
    } else {
      payload.emojiPanel = { present: false };
    }
  } catch (e) {}
  /* 面板多半挂在评论区子帧，本帧看不到 epHost —— 用缓存补上最近一次
   * 落位几何（任何帧跑探针都能拿到） */
  try {
    if (
      epDiagCache &&
      !payload.emojiPanel &&
      Date.now() - (epDiagCache.t || 0) <= 600000
    ) {
      payload.epDiag = epDiagCache;
    }
  } catch (e) {}
  return payload;
}

/* 跨帧汇总 v2（2026-09-21 改走 chrome.storage 中继）。
 * 评论 iframe（comment.do，www.lofter.com）与帖子页（xxx.lofter.com）不同源，
 * 父帧读不到它的 DOM，只能让它自报。早先用 postMessage 广播，结果撞进页面
 * 自己的 message 处理器（core.js / pt_page_control.js 把 e.data 当字符串
 * 做 indexOf → "Uncaught TypeError: ceW.indexOf is not a function"）。
 * content script 在任意帧都共享 chrome.storage，用它当中继完全不碰页面的
 * 消息通道：
 *   顶层帧探测 → 写 CMT_DIAG_REQ_KEY = probeId
 *   各子帧 onChanged 收到 → lcCmtPublishSelf(probeId) 写入 CMT_DIAG_KEY[帧URL]
 *   顶层帧监听 CMT_DIAG_KEY → 汇总写回 <html data-lc-probe-cmt>
 * 每条诊断都带 probeId，只汇总本轮结果，跨次探测不串数据。 */
let cmtProbeId = 0;

/* 本帧自报：写中继存储 + 顺手写本帧 <html data-lc-probe-cmt>（在子帧控制台
 * 直接跑探针时也能立刻看到单帧结果） */
function lcCmtPublishSelf(id) {
  const pid = id || cmtProbeId || Date.now();
  /* 探针要数据了：开 15s 重诊断窗口并立刻跑一轮 tick，让 cmtDiag 里的
   * 全文档扫描字段（cmti/avatars/sample/chain）是新鲜的（平时这些被
   * wantDiag 门禁跳过，见 cmtApply） */
  cmtDiagFresh = Date.now();
  cmtTick();
  let payload = null;
  try {
    payload = Object.assign({ probeId: pid }, lcCmtPayload());
  } catch (e) {
    return;
  }
  try {
    document.documentElement.dataset.lcProbeCmt = JSON.stringify(payload);
  } catch (e) {}
  try {
    const key = String(payload.url || location.href).slice(0, 160);
    chrome.storage.local.get(CMT_DIAG_KEY, (res) => {
      const map = (res && res[CMT_DIAG_KEY]) || {};
      map[key] = payload;
      /* 只留最近 8 帧，避免存储无限增长 */
      const keys = Object.keys(map);
      if (keys.length > 8) {
        keys.sort((a, b) => (map[a].probeId || 0) - (map[b].probeId || 0));
        while (keys.length > 8) delete map[keys.shift()];
      }
      chrome.storage.local.set({ [CMT_DIAG_KEY]: map });
    });
  } catch (e) {}
}

/* 顶层帧：把本轮（probeId 相同）各帧的诊断汇总成数组。顶层帧自己那份用
 * 内存里的 cmtDiag 现取（不必等存储往返），保证输出里一定有 #0 那行。 */
function lcCmtRender(map) {
  if (window !== window.top) return;
  try {
    const list = Object.keys(map || {})
      .map((k) => map[k])
      .filter((x) => x && x.probeId === cmtProbeId && !x.isTop)
      .sort((a, b) => (b.diag && b.diag.bodies ? 1 : 0) - (a.diag && a.diag.bodies ? 1 : 0));
    const merged = [
      Object.assign({ probeId: cmtProbeId }, lcCmtPayload()),
    ].concat(list);
    document.documentElement.dataset.lcProbeCmt = JSON.stringify(
      merged.length === 1 ? merged[0] : merged,
    );
  } catch (e) {}
}

function lcCmtReport() {
  cmtProbeId = Date.now();
  lcCmtPublishSelf(cmtProbeId);
  if (window !== window.top) return;
  /* 广播探测请求：各子帧监听到该键变化后自报（见 lcSetupCommentFilter） */
  try {
    chrome.storage.local.set({ [CMT_DIAG_REQ_KEY]: cmtProbeId });
  } catch (e) {}
}

if (lcCmtGateOk() && !cmtProbeBound) {
  cmtProbeBound = true;
  /* 只监听自己的探测事件；页面自身的 message 通道一律不碰（v1 曾用
   * postMessage 跨帧广播，会撞进页面的 core.js 处理器并抛 TypeError） */
  try {
    window.addEventListener('lc-probe-cmt', lcCmtReport);
  } catch (e) {}
}

lcCmtArm();

/* 前 20 秒每秒对一次 documentElement 引用（之后自动停掉，不留常驻定时器）：
 * 文档没被换过时几乎零开销。 */
let cmtArmTries = 0;
const cmtArmTimer = setInterval(() => {
  cmtArmTries += 1;
  if (cmtArmTries > 20) {
    clearInterval(cmtArmTimer);
    return;
  }
  if (!lcCmtGateOk()) return;
  if (document.documentElement !== cmtDocEl) {
    lcCmtArm();
    return;
  }
  /* 文档没换但样式表被抹掉（极端情况）也补挂一次 */
  if (!document.getElementById(CMT_STYLE_ID)) lcCmtArm();
}, 1000);
