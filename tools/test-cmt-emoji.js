/* 表情快捷输入冒烟测试（jsdom，逻辑层；几何/视觉留给真机 + demo 原型）
 * 覆盖：开关门禁（跟随评论工具行总开关，关=零注入）、面板挂点
 * （documentElement，逃出 body/#main 反色区与站点容器裁切）、内置包
 * 清单与分组、插入到光标、最近使用、[更新求踢] 道具、粘贴导入
 * （解析/类型/归并）、管理视图（重命名只改显示名、删单个、删整包+撤销、
 * 停用/启用）、存储落盘、Esc / 点面板外关闭。
 * 运行：NODE_PATH=<workspace>/node_modules node tools/test-cmt-emoji.js */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const defaultsSrc = fs.readFileSync(path.join(ROOT, "defaults.js"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");

const PAGE_HTML = `<!doctype html><html><body>
<div class="postc">
  <a class="author" href="https://hostauthor.lofter.com/">楼主</a>
  <div class="cmtwrap">
    <div class="cmtform"><textarea></textarea><button class="pub">发布</button></div>
    <ul>
      <li><div class="cmti"><span class="cmtusr"><a href="https://hostauthor.lofter.com/">楼主</a></span><span class="cmthot">楼主的话</span></div></li>
      <li><div class="cmti"><span class="cmtusr"><a href="https://other1.lofter.com/">路人甲</a></span><span class="cmthot">甲的话</span></div></li>
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
            /* 深拷贝入库：这样断言读到的确实是「写出去的快照」，
               而不是还挂着页面里那个可变对象的引用 */
            const changes = {};
            Object.keys(obj).forEach((k) => {
              data[k] = JSON.parse(JSON.stringify(obj[k]));
              changes[k] = { newValue: data[k], oldValue: undefined };
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

function boot(settings, extra, pageHtml) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    /* 主 IIFE 需要 lc-dwr.js（本测试没加载），预期内报错，不刷屏 */
    if (/LC_dwrCall/.test(e.message)) return;
    console.error("  [jsdomError]", e.message);
  });
  const dom = new JSDOM(pageHtml || PAGE_HTML, {
    url: "https://www.lofter.com/",
    runScripts: "outside-only",
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
  const sc = stubChrome(
    Object.assign(
      { lc_settings_v1: settings, lc_official_bl_v1: { names: [] } },
      extra || {},
    ),
  );
  w.chrome = sc.chrome;
  w.eval(defaultsSrc);
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
  if (cond) console.log("  ✓ " + msg);
  else {
    failed += 1;
    console.error("  ✗ " + msg);
  }
}

const ON = { enabled: true, comment: { toolbar: true } };
const OFF = { enabled: true, comment: { toolbar: false } };

(async () => {
  console.log("[1] 工具行总开关关：表情入口随之隐藏、页面零注入");
  const t0 = boot(OFF);
  await sleep(80);
  const d0 = t0.w.document;
  assert(!d0.querySelector(".lc-cmt-tb"), "工具行不注入");
  assert(!d0.querySelector(".lc-emoji"), "表情入口不注入");
  assert(!d0.querySelector(".lc-ep-host"), "面板节点零注入");
  assert(!d0.getElementById("lc-emoji-panel-style"), "样式表零注入");

  console.log("[2] 打开开关：面板挂 documentElement（不在 body 内）");
  const t = boot(ON);
  await sleep(80);
  const d = t.w.document;
  const panel = () => d.querySelector(".lc-ep-host");
  const all = (s) => Array.prototype.slice.call(d.querySelectorAll(s));
  const btn = d.querySelector(".lc-emoji");
  assert(!!btn && btn.style.display !== "none", "入口出现（不再是占位）");
  assert(btn.title === "表情快捷输入", "标题已去掉「下批上线」");
  btn.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  assert(!!panel(), "点击展开面板");
  assert(
    panel().parentElement === d.documentElement,
    "面板挂在 documentElement（逃出 body/#main 反色区与容器裁切）",
  );
  assert(panel().classList.contains("lc-open"), "面板为展开态");
  assert(!!d.getElementById("lc-emoji-panel-style"), "样式表已注入");

  console.log("[3] 内置包清单与分组");
  const coreTabs = () =>
    all(".lc-ep-tabs-core .lc-ep-tab").map((b) => b.textContent);
  assert(
    coreTabs().join("|") === "最近|老福鸽|老福鸽约稿专属|联动|道具|＋",
    "核心 tab 顺序固定（最近/老福鸽/约稿专属/联动/道具/＋）",
  );
  assert(!!d.querySelector(".lc-ep-mine-hint"), "没有自定义包时第二行给导入引导");
  const clickTab = (lab) => {
    all(".lc-ep-tabs-core .lc-ep-tab")
      .filter((b) => b.textContent === lab)[0]
      .dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  };
  clickTab("老福鸽");
  assert(all(".lc-ep-chip").length === 22, "老福鸽 22 个");
  clickTab("老福鸽约稿专属");
  assert(all(".lc-ep-chip").length === 20, "约稿专属 20 个");
  clickTab("联动");
  assert(
    all(".lc-ep-ghead .gname").map((e) => e.textContent).join("/") ===
      "祁煜生日联动/燕云老福鸽",
    "联动按真实包名分两组（不用悬停猜 IP）",
  );
  assert(all(".lc-ep-chip").length === 8, "联动共 8 个");
  assert(
    all(".lc-ep-chip").some((c) => c.dataset.ins === "[祁煜生日联动/晚安]"),
    "联动 chip 里写的是真实包名",
  );

  console.log("[4] 插入到光标处 + 最近使用 + 落盘");
  const input = d.querySelector(".cmtform textarea");
  clickTab("老福鸽");
  input.value = "好看 ";
  input.setSelectionRange(3, 3);
  all(".lc-ep-chip")
    .filter((c) => c.dataset.ins === "[老福鸽/吹爆太太]")[0]
    .dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  assert(
    input.value === "好看 [老福鸽/吹爆太太]",
    "插到光标处而不是尾部",
  );
  await sleep(320);
  const store = t.sc.data["lc_emoji_v1"];
  assert(!!store, "写入 lc_emoji_v1");
  assert(
    store.recent.length === 1 &&
      store.recent[0].pack === "老福鸽" &&
      store.recent[0].name === "吹爆太太",
    "最近使用已落盘",
  );
  clickTab("最近");
  assert(!!d.querySelector(".lc-ep-chip"), "最近 tab 收录刚才用过的表情");

  console.log("[5] 道具 tab：[更新求踢] 单独成栏");
  clickTab("道具");
  const prop = d.querySelector(".lc-ep-special");
  assert(!!prop && prop.textContent === "更新求踢", "道具 tab 有互动道具按钮");
  input.value = "好看 ";
  input.setSelectionRange(3, 3);
  prop.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  assert(input.value === "好看 [更新求踢]", "点一下插入 [更新求踢]");
  await sleep(320);
  assert(
    t.sc.data["lc_emoji_v1"].recent.every((r) => r.name !== "更新求踢"),
    "道具不进「最近使用」",
  );

  console.log("[6] ＋ 只做导入（不与管理叠加）");
  const plus = () => all(".lc-ep-tabs-core .lc-ep-tab").filter((b) => b.textContent === "＋")[0];
  plus().dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  assert(!d.querySelector(".lc-ep-tabs-core"), "导入视图没有 tab 栏");
  assert(!d.querySelector("[data-delpack]"), "导入视图不出现已有包的管理控件");
  assert(!!d.querySelector("#lc-ep-imp"), "导入视图有粘贴框");
  const imp = () => d.querySelector("#lc-ep-imp");
  const clickAct = (a) =>
    d
      .querySelector('[data-act="' + a + '"]')
      .dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  imp().value = "[测试/安慰][测试/打招呼][测试2/大火爆炒][测试/安慰]";
  clickAct("parse");
  const sum = d.querySelector(".lc-ep-summary").textContent;
  assert(/2\s*个包/.test(sum) && /3\s*个表情/.test(sum), "只报包数与表情数（已去重）：" + sum);
  assert(
    all(".lc-ep-prow .pn").map((e) => e.textContent).join("|") === "测试|测试2",
    "解析结果逐条列出包名",
  );
  assert(
    all(".lc-ep-seg b.on").map((b) => b.textContent).join("|") === "永久|永久",
    "类型默认永久",
  );
  all('.lc-ep-seg[data-seg="测试"] b')
    .filter((b) => b.dataset.rent === "1")[0]
    .dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  assert(
    imp().value.indexOf("[测试2/大火爆炒]") > -1,
    "切永久/月租不会把粘贴内容冲掉",
  );
  clickAct("save-import");
  assert(!!d.querySelector(".lc-ep-tabs-core"), "保存后回到普通视图");
  await sleep(320);
  const st1 = t.sc.data["lc_emoji_v1"];
  assert(st1.custom.length === 2, "落盘 2 个自定义包");
  assert(
    st1.custom.filter((c) => c.pack === "测试")[0].perpetual === false,
    "导入时选的月租已保存",
  );
  assert(
    st1.custom.filter((c) => c.pack === "测试2")[0].perpetual === true,
    "没动的包仍是永久",
  );
  assert(
    all(".lc-ep-tabs-mine .lc-ep-tab").some((b) => /测试.*月租/.test(b.textContent)),
    "月租包 tab 带「·月租」标记",
  );

  console.log("[7] 同名包归并追加，且不动已有类型");
  plus().dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  imp().value = "[测试/飞吻]";
  clickAct("parse");
  assert(
    !!d.querySelector(".lc-ep-seg.ro") && !d.querySelector(".lc-ep-seg[data-seg]"),
    "已存在的包类型组只读（沿用现有设置）",
  );
  clickAct("save-import");
  await sleep(320);
  const st2 = t.sc.data["lc_emoji_v1"];
  assert(st2.custom.length === 2, "归并进同名包、不新建");
  assert(
    st2.custom.filter((c) => c.pack === "测试")[0].items.indexOf("飞吻") > -1,
    "归并后新表情追加进原包",
  );
  assert(
    st2.custom.filter((c) => c.pack === "测试")[0].perpetual === false,
    "归并不覆盖已有的月租设置",
  );

  console.log("[8] [更新求踢] 导入检测");
  plus().dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  imp().value = "[星尘/比心][更新求踢]谢谢大大";
  clickAct("parse");
  assert(
    !!d.querySelector(".lc-ep-warn") &&
      /失效/.test(d.querySelector(".lc-ep-warn").textContent),
    "混着文字的 [更新求踢] 给出失效提示",
  );
  imp().value = "[更新求踢]";
  clickAct("parse");
  assert(!d.querySelector(".lc-ep-summary"), "单独的 [更新求踢] 不入库（不算表情）");
  clickAct("back");

  console.log("[9] 管理视图：只碰已有包");
  d.querySelector('[data-act="manage-on"]').dispatchEvent(
    new t.w.MouseEvent("click", { bubbles: true }),
  );
  assert(
    d.querySelector(".lc-ep-bar .ttl").textContent === "管理我的表情包",
    "进入管理视图",
  );
  assert(!d.querySelector("#lc-ep-imp"), "管理视图里没有导入框");
  const rin = all('input[data-pack="' + "测试" + '"]')[0];
  rin.value = "测试包";
  rin.dispatchEvent(new t.w.Event("blur"));
  await sleep(320);
  const st3 = t.sc.data["lc_emoji_v1"];
  assert(
    st3.custom.filter((c) => c.pack === "测试")[0].alias === "测试包",
    "重命名失焦即提交",
  );
  assert(
    all(".lc-ep-chip").every((c) => (c.dataset.ins || "").indexOf("[测试包/") === -1),
    "只改显示别名，发出去的格式仍是 [测试/…]",
  );
  const beforeItems = st3.custom.filter((c) => c.pack === "测试")[0].items.length;
  all(".lc-ep-chip .lc-ep-x")
    .filter((x) => x.dataset.dp === "测试")[0]
    .dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  await sleep(320);
  assert(
    t.sc.data["lc_emoji_v1"].custom.filter((c) => c.pack === "测试")[0].items
      .length === beforeItems - 1,
    "删单个表情",
  );
  d.querySelector('[data-delpack="测试2"]').dispatchEvent(
    new t.w.MouseEvent("click", { bubbles: true }),
  );
  await sleep(320);
  assert(
    t.sc.data["lc_emoji_v1"].custom.length === 1,
    "删除整包",
  );
  const undo = d.querySelector(".lc-ep-toast a");
  assert(!!undo, "删整包出 toast 撤销（不弹确认框打断）");
  undo.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  await sleep(320);
  assert(t.sc.data["lc_emoji_v1"].custom.length === 2, "撤销把整包还回来");
  d.querySelector('[data-tg="测试"]').dispatchEvent(
    new t.w.MouseEvent("click", { bubbles: true }),
  );
  await sleep(320);
  assert(
    t.sc.data["lc_emoji_v1"].custom.filter((c) => c.pack === "测试")[0].enabled ===
      false,
    "停用整包",
  );

  console.log("[10] 关 / 开：Esc、点面板外、关工具行总开关");
  d.dispatchEvent(new t.w.KeyboardEvent("keydown", { key: "Escape" }));
  assert(!panel().classList.contains("lc-open"), "Esc 关闭面板");
  d.querySelector('[data-act="back"]').dispatchEvent(
    new t.w.MouseEvent("click", { bubbles: true }),
  );
  btn.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true }));
  assert(panel().classList.contains("lc-open"), "可再次展开");
  d.body.dispatchEvent(new t.w.MouseEvent("mousedown", { bubbles: true }));
  assert(!panel().classList.contains("lc-open"), "点面板外关闭");
  t.sc.chrome.storage.local.set({
    lc_settings_v1: { enabled: true, comment: { toolbar: false } },
  });
  await sleep(120);
  assert(!d.querySelector(".lc-cmt-tb"), "工具行移除（表情入口随之消失）");
  assert(!d.querySelector(".lc-ep-host"), "面板节点整体移除");
  assert(!d.getElementById("lc-emoji-panel-style"), "面板样式表移除");
  t.sc.chrome.storage.local.set({ lc_settings_v1: ON });
  await   sleep(120);
  assert(!!d.querySelector(".lc-emoji"), "重新打开 → 入口回来（跟随总开关）");

  console.log("[11] 0 评论的卡片：仅表情工具行仍注入");
  const PAGE_NO_CMT = `<!doctype html><html><body>
<div class="postc">
  <a class="author" href="https://hostauthor.lofter.com/">楼主</a>
  <div class="cmtwrap">
    <div class="cmtform"><textarea></textarea><button class="pub">发布</button></div>
  </div>
</div>
</body></html>`;
  const t11 = boot(ON, null, PAGE_NO_CMT);
  await sleep(80);
  const d11 = t11.w.document;
  const bar11 = d11.querySelector(".lc-cmt-tb");
  assert(!!bar11, "无评论列表也注入工具行（仅表情）");
  const chips11 = bar11 ? bar11.querySelectorAll(".lc-chip") : [];
  assert(
    !!bar11 &&
      Array.prototype.every.call(
        chips11,
        (c) => c.style.display === "none",
      ),
    "只看作者/从旧到新 chip 收起（没有列表可作用）",
  );
  const ep11 = bar11 ? bar11.querySelector(".lc-emoji") : null;
  assert(!!ep11 && ep11.style.display !== "none", "表情按钮在");
  ep11.dispatchEvent(new t11.w.MouseEvent("click", { bubbles: true }));
  const panel11 = d11.querySelector(".lc-ep-host");
  assert(!!panel11 && panel11.classList.contains("lc-open"), "0 评论也能展开面板");
  const ta11 = d11.querySelector("textarea");
  d11.querySelector('.lc-ep-tab[data-tab="老福鸽"]').dispatchEvent(
    new t11.w.MouseEvent("click", { bubbles: true }),
  );
  const chip11 = d11.querySelector('.lc-ep-chip[data-ins="[老福鸽/狗头]"]');
  chip11.dispatchEvent(new t11.w.MouseEvent("click", { bubbles: true }));
  assert(ta11.value === "[老福鸽/狗头]", "插入到 0 评论卡片的输入框", );
  assert(!!d11.querySelector('.lc-cmt-tb[data-lc-cmt-tb]'), "工具行在发布框前");

  console.log("[12] 非评论区输入不误伤：搜索框/发布框不注入");
  const PAGE_SEARCH = `<!doctype html><html><body>
<div class="searchbox"><input type="text"/><button>搜索</button></div>
<div class="composer"><textarea></textarea><button>发布</button></div>
</body></html>`;
  const t12 = boot(ON, null, PAGE_SEARCH);
  await sleep(80);
  assert(!t12.w.document.querySelector(".lc-cmt-tb"), "无 cmt 族类名的输入不注入工具行");

  console.log(failed ? `\n${failed} 项断言失败` : "\n全部断言通过");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("测试脚本异常:", e);
  process.exit(1);
});
