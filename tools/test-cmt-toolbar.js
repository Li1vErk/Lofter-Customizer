/* 评论区工具行冒烟测试（jsdom，逻辑层；几何/视觉留给真机）
 * 覆盖：工具行注入与锚定、楼主 id 区块探测、只看作者隐藏/还原、
 * 排序类挂摘、配置关闭后完全还原。
 * 运行：NODE_PATH=<workspace>/node_modules node tools/test-cmt-toolbar.js */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const defaultsSrc = fs.readFileSync(path.join(ROOT, "defaults.js"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");

const PAGE_HTML = `<!doctype html><html><body>
<div class="postc">
  <a class="author" href="https://hostauthor.lofter.com/">楼主</a>
  <div class="content">正文</div>
  <div class="cmtwrap">
    <div class="cmtform"><textarea></textarea><button class="pub">发布</button></div>
    <ul>
      <li><div class="cmti"><span class="cmtusr"><a href="https://hostauthor.lofter.com/">楼主</a></span><span class="cmthot">楼主的话</span></div></li>
      <li><div class="cmti"><span class="cmtusr"><a href="https://other1.lofter.com/">路人甲</a></span><span class="cmthot">甲的话</span></div></li>
      <li><div class="cmti"><span class="cmtusr"><a href="https://other2.lofter.com/">路人乙</a></span><span class="cmthot">乙的话</span></div></li>
    </ul>
  </div>
</div>
</body></html>`;

function stubChrome(initial) {
  const data = JSON.parse(JSON.stringify(initial));
  const listeners = [];
  return {
    data,
    listeners,
    chrome: {
      storage: {
        local: {
          get: (keys, cb) => setTimeout(() => cb(data), 0),
          set: (obj) => {
            Object.assign(data, obj);
            /* 真实 onChanged 传 {key: {newValue, oldValue}}，不是原始对象 */
            const changes = {};
            Object.keys(obj).forEach((k) => {
              changes[k] = { newValue: obj[k], oldValue: undefined };
            });
            listeners.slice().forEach((fn) => {
              try {
                fn(changes, "local");
              } catch (e) {
                console.error("  [诊断] onChanged 监听器抛错:", e.message);
              }
            });
          },
        },
        onChanged: { addListener: (fn) => listeners.push(fn) },
      },
      runtime: { id: "test" },
    },
  };
}

function boot(settings) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    const det = e.detail && e.detail.stack ? e.detail.stack.split("\n").slice(0, 3).join(" | ") : "";
    console.error("  [jsdomError]", e.message, det);
  });
  const dom = new JSDOM(PAGE_HTML, {
    url: "https://www.lofter.com/",
    runScripts: "outside-only", /* window.eval 在 jsdom 上下文里执行 */
    virtualConsole: vc,
  });
  const w = dom.window;
  if (!w.matchMedia) {
    w.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    });
  }
  if (!w.requestAnimationFrame) w.requestAnimationFrame = (f) => setTimeout(f, 0);
  if (!w.IntersectionObserver) {
    w.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const sc = stubChrome({
    lc_settings_v1: settings,
    lc_official_bl_v1: { names: [] },
  });
  w.chrome = sc.chrome;
  try {
    w.eval(defaultsSrc);
  } catch (e) {
    console.error("defaults.js eval 失败:", e.message);
    process.exit(1);
  }
  let contentErr = null;
  try {
    w.eval(contentSrc);
  } catch (e) {
    /* 主 IIFE 在 jsdom 里可能因缺 API 抛错——评论模块在其之前已定义 */
    contentErr = e;
  }
  return { dom, w, sc, contentErr };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("  ✓ " + msg);
  } else {
    failed += 1;
    console.error("  ✗ " + msg);
  }
}

(async () => {
  const base = {
    enabled: true,
    comment: { toolbar: true },
    filter: { enabled: false, scope: { home: true, tag: true, comment: false }, keywords: [], users: [] },
  };

  console.log("[1] 注入与锚定");
  const t1 = boot(base);
  await sleep(80);
  const d = t1.w.document;
  const bar = d.querySelector(".lc-cmt-tb");
  assert(!!bar, "工具行已注入");
  assert(!!(bar && bar.parentElement && bar.parentElement.classList.contains("cmtform") === false && bar.nextElementSibling && bar.nextElementSibling.querySelector("textarea")), "工具行插在输入框正上方");
  const chips = bar ? bar.querySelectorAll(".lc-chip") : [];
  assert(
    chips.length === 3 &&
      chips[0].textContent === "只看作者" &&
      chips[1].textContent === "从旧到新" &&
      chips[2].textContent === "加载更多评论",
    "三个 chip 文案正确",
  );
  assert(chips[2].style.display === "none", "无官方分页 → 加载更多不渲染");
  const emoji = bar ? bar.querySelector(".lc-emoji") : null;
  assert(
    !!emoji &&
      (() => {
        try {
          return t1.w.getComputedStyle(emoji).marginLeft === "auto";
        } catch (e) {
          return false;
        }
      })(),
    "表情按钮存在且右置（margin-left:auto）",
  );
  assert(!!(emoji && emoji.title.indexOf("下批") >= 0), "表情按钮为占位提示");
  assert(chips[0].title.indexOf("hostauthor") >= 0, "区块级楼主 id 探测到 hostauthor");
  assert(t1.w.document.querySelector(".cmtwrap").getAttribute("data-lc-cmt-area") === "1", "区块根已标记");

  console.log("[2] 只看作者：非楼主行隐藏、楼主行保留");
  chips[0].dispatchEvent(new t1.w.MouseEvent("click", { bubbles: true }));
  const rows = d.querySelectorAll("ul > li");
  assert(rows[0].style.display !== "none" && !rows[0].hasAttribute("data-lc-cmt-filtered"), "楼主行保留");
  assert(rows[1].style.display === "none" && rows[1].hasAttribute("data-lc-cmt-filtered"), "路人甲行隐藏");
  assert(rows[2].style.display === "none" && rows[2].hasAttribute("data-lc-cmt-filtered"), "路人乙行隐藏");

  console.log("[3] 排序：挂类 / 再点还原");
  chips[1].dispatchEvent(new t1.w.MouseEvent("click", { bubbles: true }));
  const ul = d.querySelector("ul");
  assert(ul.classList.contains("lc-cmt-rev"), "列表容器挂上 lc-cmt-rev");
  assert(ul.classList.contains("lc-cmt-rev-comp"), "jsdom 无边框 → 触发外缘线补偿类");
  chips[1].dispatchEvent(new t1.w.MouseEvent("click", { bubbles: true }));
  assert(!ul.classList.contains("lc-cmt-rev") && !ul.classList.contains("lc-cmt-rev-comp"), "再点熄灭，排序类摘除");

  console.log("[4] 只看作者再点还原 + 名单为空不早退");
  chips[0].dispatchEvent(new t1.w.MouseEvent("click", { bubbles: true }));
  assert(!rows[1].hasAttribute("data-lc-cmt-filtered") && !rows[2].hasAttribute("data-lc-cmt-filtered"), "关闭后所有行还原");
  assert(t1.contentErr === null || /lc-iframe-exit/.test(String(t1.contentErr && t1.contentErr.message)) === false, "主 IIFE 未在评论模块阶段抛错");

  console.log("[5] 面板关掉工具行 → 完全还原");
  sc2Set(t1, { comment: { toolbar: false } });
  await sleep(80);
  console.log("  [诊断] enhanceOn=", t1.w.eval("String(cmtEnhanceOn())"),
    "storageListeners=", t1.sc.listeners.length);
  assert(!d.querySelector(".lc-cmt-tb"), "工具行从 DOM 移除");
  assert(!d.getElementById("lc-cmt-toolbar-style"), "工具行样式表移除");

  console.log("[6] filter.enabled=true + 屏蔽名单与只看作者叠加");
  const t2 = boot({
    enabled: true,
    comment: { toolbar: true },
    filter: {
      enabled: true,
      scope: { home: true, tag: true, comment: true },
      keywords: [],
      users: [{ id: "other1", name: "路人甲" }],
    },
  });
  await sleep(80);
  const d2 = t2.w.document;
  const bar2 = d2.querySelector(".lc-cmt-tb");
  const chips2 = bar2.querySelectorAll(".lc-chip");
  chips2[1].dispatchEvent(new t2.w.MouseEvent("click", { bubbles: true })); /* 只开排序，不动只看作者 */
  const rows2 = d2.querySelectorAll("ul > li");
  assert(rows2[1].style.display === "none" && rows2[2].style.display !== "none", "屏蔽名单独立生效（甲隐藏、乙可见）");
  chips2[0].dispatchEvent(new t2.w.MouseEvent("click", { bubbles: true }));
  assert(rows2[0].style.display !== "none" && rows2[1].style.display === "none" && rows2[2].style.display === "none", "两条规则叠加：楼主保留、甲乙全隐");
  chips2[0].dispatchEvent(new t2.w.MouseEvent("click", { bubbles: true }));
  assert(rows2[1].style.display === "none" && rows2[2].style.display !== "none", "关掉只看作者后回到纯名单过滤");

  console.log("[7] 加载更多评论：排序时出现、点击触发官方按钮、加载完自动隐藏");
  const t3 = boot(base);
  const d3 = t3.w.document;
  const pager3 = d3.createElement("a");
  pager3.className = "cmtpager";
  pager3.textContent = "查看更多";
  d3.querySelector(".cmtwrap").appendChild(pager3);
  let pagerClicks = 0;
  pager3.addEventListener("click", () => {
    pagerClicks += 1;
  });
  await sleep(80);
  const bar3 = d3.querySelector(".lc-cmt-tb");
  const chips3 = bar3.querySelectorAll(".lc-chip");
  const more3 = bar3.querySelector(".lc-more");
  assert(!!more3 && more3.style.display === "none", "排序未点亮时不显示（官方分页存在）");
  chips3[1].dispatchEvent(new t3.w.MouseEvent("click", { bubbles: true }));
  await sleep(80);
  assert(more3.style.display !== "none", "从旧到新点亮后显示");
  more3.dispatchEvent(new t3.w.MouseEvent("click", { bubbles: true }));
  assert(pagerClicks === 1, "点击触发官方「查看更多」（程序化 click）");
  pager3.remove();
  await sleep(350); /* 观察器防抖 120ms，等 tick 跑完 */
  assert(more3.style.display === "none", "官方按钮消失（全部加载完）后自动隐藏");

  console.log("[8] 主页模板：分页钮混在列表容器 + 包裹隐藏后键消失");
  /* 真机截图结构：div.bcmtlst 下 .bcmti 行与 a.s-fc2「查看更多」平级。
   * 旧守卫会因这个 a 判 false → 整容器跳过不排（排序没反应）；
   * 旧显隐只判 isConnected → 站点给包裹挂 display:none 后键残留 */
  const t4 = boot(base);
  const d4 = t4.w.document;
  const area4 = d4.createElement("div");
  area4.className = "bcmt";
  area4.innerHTML =
    '<div class="bcmtadd"><div class="bcmtipt" contenteditable="true"></div></div>' +
    '<div class="bcmtmore"><div class="bcmtlst">' +
    '<div class="bcmti"><span class="cmtusr"><a href="https://hostauthor.lofter.com/">楼主</a></span><span class="cmthot">楼主的话</span></div>' +
    '<div class="bcmti"><span class="cmtusr"><a href="https://other1.lofter.com/">路人甲</a></span><span class="cmthot">甲的话</span></div>' +
    '<a class="s-fc2">查看更多</a>' +
    "</div></div>";
  d4.body.appendChild(area4);
  await sleep(80);
  const bar4 = d4.querySelector(".bcmt .lc-cmt-tb");
  assert(!!bar4, "主页式区块已注入工具行");
  const chips4 = bar4.querySelectorAll(".lc-chip");
  const more4 = bar4.querySelector(".lc-more");
  chips4[1].dispatchEvent(new t4.w.MouseEvent("click", { bubbles: true }));
  await sleep(80);
  const lst4 = d4.querySelector(".bcmtlst");
  assert(lst4.classList.contains("lc-cmt-rev"), "分页钮混在容器里也挂上排序类（守卫放行分页钮链）");
  assert(more4.style.display !== "none", "主页式分页钮可见 → 加载更多显示");
  d4.querySelector(".bcmtmore").style.display = "none"; /* 站点加载完的真实手法 */
  await sleep(350); /* 观察器防抖 120ms */
  assert(more4.style.display === "none", "官方分页被 display:none 藏起（加载完）→ 键自动隐藏");

  console.log("[9] 首页式包裹：官方钮在可见外层包裹内，隐藏后键消失");
  /* 真机探测结构：DIV.isayi（可见）> A.w-more2（加载完被 display:none
   * 藏起）> SPAN。旧实现先按可见性过滤再选最内层 → 隐藏的内层被跳过、
   * 可见外层顶成 hit → 键残留。新实现先选最内层、最后统一验可见性 */
  const t5 = boot(base);
  const d5 = t5.w.document;
  const area5 = d5.createElement("div");
  area5.className = "mlistcnt";
  area5.innerHTML =
    '<div class="isay"><div class="isayi">' +
    '<textarea></textarea>' +
    '<a class="w-more2"><span>查看更多</span></a>' +
    "</div></div>" +
    '<div class="cmtwrap2"><ul><li><div class="cmti"><span class="cmtusr"><a href="https://hostauthor.lofter.com/">楼主</a></span><span class="cmthot">楼主的话</span></div></li></ul></div>';
  d5.body.appendChild(area5);
  await sleep(80);
  const bar5 = d5.querySelector(".mlistcnt .lc-cmt-tb");
  assert(!!bar5, "首页式区块已注入工具行");
  const chips5 = bar5.querySelectorAll(".lc-chip");
  const more5 = bar5.querySelector(".lc-more");
  let clicks5 = 0;
  const link5 = d5.querySelector(".w-more2");
  link5.addEventListener("click", () => {
    clicks5 += 1;
  });
  chips5[1].dispatchEvent(new t5.w.MouseEvent("click", { bubbles: true }));
  await sleep(80);
  assert(more5.style.display !== "none", "官方钮可见（藏在链接里）→ 加载更多显示");
  more5.dispatchEvent(new t5.w.MouseEvent("click", { bubbles: true }));
  assert(clicks5 === 1, "点击内层 span 冒泡触发官方链接");
  link5.style.display = "none"; /* 站点加载完的真实手法 */
  await sleep(350);
  assert(more5.style.display === "none", "内层钮隐藏（可见外层包裹仍在）→ 键自动消失");

  console.log("[10] 个人主页 iframe 模板：.bcmtlsta 行 + 不相交的隐藏分页块");
  /* 真机探针结构（2026-09-23）：DIV.bcmtlst > UL > LI > DIV.bcmtlsta 行；
   * 分页 = 可见 DIV.bcmtlsta > A.s-fc2.ztag「查看更多」，另有不相交的
   * DIV.bcmtmore（display:none）同名文案块在文档序更前的位置——旧
   * contains 链选内层时隐藏块永久占位 → cmtFindPager 返回 null →
   * 排序行选择器又没有 .bcmtlsta →「从旧到新」没反应、「加载更多」
   * 不出现。裁切：bar 满宽贴 iframe 视口边缘 → 出界类应关闭 */
  const t6 = boot(base);
  const d6 = t6.w.document;
  const area6 = d6.createElement("div");
  area6.className = "bcmt";
  area6.innerHTML =
    '<div class="bcmtmore s-bd2" style="display:none"><a>查看更多</a></div>' +
    '<div class="bcmtadd"><div class="bcmtipt"><textarea></textarea></div></div>' +
    '<div class="bcmtlst"><ul>' +
    '<li><div class="bcmtlsta clearfix"><span class="bcmtlstf"><a href="https://hostauthor.lofter.com/">楼主</a>：楼主的话</span></div></li>' +
    '<li><div class="bcmtlsta clearfix"><span class="bcmtlstf"><a href="https://other1.lofter.com/">路人甲</a>：甲的话</span></div></li>' +
    '<li><div class="bcmtlsta"><a class="s-fc2 ztag">查看更多</a></div></li>' +
    "</ul></div>";
  d6.body.appendChild(area6);
  await sleep(80);
  const bar6 = d6.querySelector(".bcmt .lc-cmt-tb");
  assert(!!bar6, "主页 iframe 式区块已注入工具行");
  const chips6 = bar6.querySelectorAll(".lc-chip");
  const more6 = bar6.querySelector(".lc-more");
  chips6[1].dispatchEvent(new t6.w.MouseEvent("click", { bubbles: true }));
  await sleep(80);
  const ul6 = d6.querySelector(".bcmtlst ul");
  assert(ul6.classList.contains("lc-cmt-rev"), ".bcmtlsta 行 → 排序类挂上 UL（从旧到新生效）");
  assert(more6.style.display !== "none", "不相交的隐藏 bcmtmore 不占位 → 可见官方钮被选中 → 键显示");
  let clicks6 = 0;
  d6.querySelector(".s-fc2.ztag").addEventListener("click", () => {
    clicks6 += 1;
  });
  more6.dispatchEvent(new t6.w.MouseEvent("click", { bubbles: true }));
  assert(clicks6 === 1, "点击触发可见的官方 a.s-fc2.ztag");
  assert(
    !bar6.classList.contains("lc-ovh-l") && !bar6.classList.contains("lc-ovh-r"),
    "bar 满宽贴视口边缘 → 出界类关闭（防 iframe 视口裁切）",
  );
  d6.querySelector(".s-fc2.ztag").style.display = "none";
  await sleep(350);
  assert(more6.style.display === "none", "可见官方钮被藏起（隐藏 bcmtmore 不顶替）→ 键消失");

  console.log(failed ? `\n${failed} 项断言失败` : "\n全部断言通过");
  process.exit(failed ? 1 : 0);

  function sc2Set(t, patch) {
    t.sc.chrome.storage.local.set({ lc_settings_v1: Object.assign({}, base, patch) });
  }
})().catch((e) => {
  console.error("测试脚本异常:", e);
  process.exit(1);
});
