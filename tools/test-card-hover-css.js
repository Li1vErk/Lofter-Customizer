/* 卡片悬停放大 CSS 冒烟测试（jsdom，只校验「生成出来的 CSS 文本」）
 *
 * 背景（2026-09-23 真机 bug）：首页/tag 页博文卡片的悬停放大原由 `.mlistcnt:hover`
 * 驱动，而缩放会让 `.mlistcnt` 的命中盒随卡片一起变高 —— 长文/长图卡（卡片很高）
 * 展开评论区后，放大后的底边伸到下一张卡身上，下一张卡文档序在后、同 z-index 下
 * 画在上层，重叠带里的命中被它抢走 → `.mlistcnt:hover` 变假 → 卡片缩回 → 命中回到
 * 本卡 → 再放大……形成 0.25s 一轮的振荡（放大抖不停、卡内「收起」点不到）。
 *
 * 定稿修法：
 *   ① `transform-origin: 50% 100%`（底边锚点）—— 卡片向上生长、底边与卡内底部
 *      （含「收起」键、评论输入框）位置恒定，不再成为「移动靶」，也不向下覆盖
 *      下一张卡。**这条才是消掉反馈环的关键**。
 *   ② 驱动盒保持 `.mlistcnt:hover` 自身（首版改外层盒的教训见下方「三修」）。
 *
 * 二修：`.mlistcnt` 上的 `position:relative + z-index:2` 抬层**已删**（列进 [2b] 防回归）——
 *   层序本来就是对的（elementFromPoint 在两张卡的重叠带实测，命中归属是本卡），而把
 *   static 改成 relative 会换掉卡内绝对定位后代的包含块 → 每次悬停移入/移出强制整卡
 *   子树重排一次（4 轮悬停布局次数 12 → 8）。
 * 三修：驱动盒退回 `.mlistcnt:hover` 自身。首版改成外层 `.m-mlist:hover` 后真机反馈
 *   「判定范围被扩大：作者头像下方的空白处也能触发放大」；无头实测证实（tools/
 *   debug-hover-area.js）：外层盒比卡盒大时，卡盒外 ±3/+7px 的空白处仍触发 scale≈1.02，
 *   驱动盒取自身时那些点位 scale=1.000。
 * 四修：缓动曲线换 ease-out（旧曲线起步斜率为 0，真机观感「鼠标进去先愣一下才动」），
 *   断言见 [3b]；同批实测还**证伪**了「原点回退居中」与「加 will-change」两条改法
 *   （逐项指标完全相同 → 不是它们的问题，见 [2b] 与 [3b]）。
 * 五修（本版）：真机仍能看出「一点二次的轻微放大」，用户要求给卡片栏加开关
 *   → 新增 `card.hoverZoom`（默认 **true**，保持既有观感；只有显式 false 才关）。
 *   关掉时**两条渲染路径都必须停止生成悬停缩放规则**：
 *     a) 气泡卡整卡那条（`ensureBubbleCards` 的 `${sel}:hover`，连带
 *        transition / transform-origin 整段不生成）；
 *     b) 通用兜底管线卡面那条（`buildCSS` 的 `.mlistcnt:hover::before`，只摘
 *        transform，box-shadow 悬停投影保留）。
 *   断言见 [5]（默认口径＝开、不得因未写字段而变成关）与 [6]（关掉后 a/b 两条
 *   规则都不存在，但卡片矩形/圆角等本体规则照旧生成）。
 *
 * 运行：NODE_PATH=<workspace>/node_modules node tools/test-card-hover-css.js
 * 注意：main IIFE 依赖 lc-dwr.js 提供的 LC_dwrCall，必须按 manifest 顺序连同
 *       defaults.js / hyalite.js / lc-dwr.js 一起 eval，否则整段中断、样式表不生成。 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const load = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const PAGE_HTML = `<!doctype html><html><body>
<div id="main">
  <div class="m-mlist"><div class="mlistcnt"><div class="isay">卡片 A</div></div></div>
  <div class="m-mlist"><div class="mlistcnt"><div class="isay">卡片 B</div></div></div>
</div>
</body></html>`;

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else {
    failed += 1;
    console.error("  ✗ " + msg);
  }
}
function section(t) {
  console.log("\n=== " + t + " ===");
}

/* 把注释剔掉再断言，避免注释里的示例选择器/字段名造成假阳性 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/* 起一个 jsdom 页面，按 manifest 顺序 eval，等初始化完成后回调生成出来的两段 CSS */
function boot(settings, cb) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => console.error("  [jsdomError]", e.message));
  const dom = new JSDOM(PAGE_HTML, {
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
  const store = { lc_settings_v1: settings, lc_official_bl_v1: { names: [] } };
  w.chrome = {
    storage: {
      local: {
        get: (k, cb2) => setTimeout(() => cb2(store), 0),
        set: (o) => Object.assign(store, o),
      },
      onChanged: { addListener() {} },
    },
    runtime: { id: "test" },
  };

  ["defaults.js", "hyalite.js", "lc-dwr.js", "content.js"].forEach((f) => {
    try {
      w.eval(load(f));
    } catch (e) {
      if (f === "content.js") console.error("  [warn] content.js 主 IIFE 中断:", e.message);
      else console.error("  [warn]", f, "eval 失败:", e.message);
    }
  });

  setTimeout(() => {
    const bubble = w.document.getElementById("lc-bubble-cards");
    const base = w.document.getElementById("lc-style");
    cb({
      w,
      hasBubble: !!bubble,
      hasBase: !!base,
      rawBubble: bubble ? bubble.textContent : "",
      rawBase: base ? base.textContent : "",
      bc: stripComments(bubble ? bubble.textContent : ""),
      sc: stripComments(base ? base.textContent : ""),
    });
  }, 500);
}

/* 五修（本版）用：判定「某条 :hover 块是否以 scale 开头」。
   注意**不能**用 `([^}]*)` 去抓 `${sel}:hover { ... }` 的块内容 —— @font-face/faceAdapt
   段里还排在更前面有 `${sel}.lc-face-dark a:hover { color:#fff }`，同样能被前缀匹配到，
   会抓到那个块（第一版断言就这么假挂了）。判据直接带上 `{` 后的第一条声明即可。 */
const BUBBLE_SCALE_OPEN =
  /#main > \.m-mlist:has\(> \.mlistcnt \.isay\) > \.mlistcnt[^{]*:hover\s*\{\s*transform: scale\(1\.02\) !important;/;
/* 通用兜底管线卡面缩放块（这条选择器唯一，可以安全抓块内容） */
const FALLBACK_SEL = /#main > \.m-mlist > \.mlistcnt:hover::before\s*\{([^}]*)\}/;

section("场景 A：默认配置（未写 card.hoverZoom → 应为「开」）");
boot({ enabled: true }, (r) => {
  const { bc, sc, rawBubble, rawBase } = r;

  console.log("[1] 卡片材质样式表已生成");
  assert(!!r.hasBubble && rawBubble.length > 1000, "lc-bubble-cards 存在且非空");
  assert(!!r.hasBase && rawBase.length > 1000, "lc-style 存在且非空");

  console.log("[2] 气泡卡悬停放大：驱动盒 = 卡片自身（判定范围不超过卡盒）");
  assert(
    /#main > \.m-mlist:has\(> \.mlistcnt \.isay\) > \.mlistcnt[^{]*:hover\s*\{\s*transform: scale\(1\.02\) !important;/.test(
      bc,
    ),
    "存在 `.mlistcnt:hover { transform: scale(1.02) }`",
  );
  assert(
    !/:hover\s*>\s*\.mlistcnt/.test(bc),
    "**没有**把外层 `.m-mlist:hover > .mlistcnt` 当驱动盒（否则判定范围扩到卡外留白处）",
  );

  console.log("[2b] 放大规则里不带会让悬停变重的写法（性能回归防线）");
  assert(
    !/#main > \.m-mlist:has\(> \.mlistcnt \.isay\)[^{}]*?:hover\s*\{[^}]*?(position: relative|z-index)/.test(
      bc,
    ),
    "驱动盒 hover 块里**没有** position/z-index 抬层（否则每次悬停整卡重排一次）",
  );
  assert(
    !/:hover\s*\{[^}]*will-change/.test(bc),
    "放大元素上**没有** will-change:transform（整卡提层要重光栅化，实测更贵）",
  );

  console.log("[3] 放大原点锚在底边（卡内底部位置恒定）");
  assert(
    /#main > \.m-mlist:has\(> \.mlistcnt \.isay\) > \.mlistcnt[^{]*\{\s*transition: transform 0\.22s cubic-bezier\(0\.22, 1, 0\.36, 1\) !important;[^}]*transform-origin: 50% 100% !important;/.test(
      bc,
    ),
    "气泡卡 .mlistcnt 静息态即写死 transform-origin: 50% 100%",
  );
  assert(
    /#main > \.m-mlist > \.mlistcnt::before\s*\{[^}]*transform-origin: 50% 100% !important;/.test(
      sc,
    ),
    "通用兜底管线 ::before 同样锚在底边",
  );

  console.log("[3b] 缓动起步不为零（2026-09-23 四修：观感「延迟」的根因）");
  assert(
    !/transform 0?\.2\d?s cubic-bezier\(0\.4, ?0, ?0\.2, ?1\)/.test(bc),
    "气泡卡**不再**用起步斜率为 0 的 cubic-bezier(0.4,0,0.2,1)（真机观感＝进去先愣一下）",
  );
  assert(
    /cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(bc) &&
      /cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(sc),
    "卡片与通用卡面都换成 ease-out cubic-bezier(0.22, 1, 0.36, 1)",
  );

  console.log("[4] 气泡卡仍覆盖通用管线的伪元素放大（箭头不错位）");
  assert(
    /#main > \.m-mlist:has\(> \.mlistcnt \.isay\) > \.mlistcnt[^{]*:hover::before\s*\{\s*transform: none !important;/.test(
      bc,
    ),
    "气泡卡 :hover::before 置空（缩放交给整卡，矩形+尖角不错位）",
  );

  console.log("[5] 五修：默认口径必须是「开」（老配置没这个字段，不能被当成关）");
  assert(
    BUBBLE_SCALE_OPEN.test(bc),
    "气泡卡整卡缩放块里有 `transform: scale(1.02)`",
  );
  assert(
    /transform: scale\(1\.02\) !important;/.test((sc.match(FALLBACK_SEL) || [, ""])[1]),
    "通用兜底卡面 hover 块里有 `transform: scale(1.02)`",
  );

  section("场景 B：card.hoverZoom = false（面板关掉开关）");
  boot({ enabled: true, card: { hoverZoom: false } }, (r2) => {
    const bc2 = r2.bc;
    const sc2 = r2.sc;
    const fallbackBlock = (sc2.match(FALLBACK_SEL) || [, null])[1];

    console.log("[6] 关掉后两条渲染路径都不再生成悬停缩放，但卡片本体照旧");
    assert(!!r2.hasBubble && r2.rawBubble.length > 1000, "lc-bubble-cards 仍生成（卡片没被一起关掉）");
    assert(
      !BUBBLE_SCALE_OPEN.test(bc2) && !/:hover\s*\{\s*transform: scale/.test(bc2),
      "气泡卡整卡那条 `:hover { transform: scale }` 整段消失",
    );
    assert(
      /#main > \.m-mlist:has\(> \.mlistcnt \.isay\) > \.mlistcnt[^{]*::before\s*\{/.test(bc2),
      "气泡卡矩形 ::before（圆角/底色/尖角宿主）仍在 —— 只关动画不关外观",
    );
    assert(
      !/cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(bc2),
      "气泡卡的悬停 transition（含 ease-out 曲线）一并消失，不留死规则",
    );
    assert(!!fallbackBlock, "通用兜底卡面 `:hover::before` 块仍在（只是不缩放）");
    assert(
      !!fallbackBlock && !/transform:/.test(fallbackBlock),
      "该块里**没有** transform（scale 已摘掉）",
    );
    assert(
      !!fallbackBlock && /box-shadow:/.test(fallbackBlock),
      "该块里仍有 box-shadow —— 悬停投影是独立反馈，保留",
    );
    assert(
      !/#main > \.m-mlist > \.mlistcnt:hover::before\s*\{[^}]*transform: scale/.test(sc2),
      "通用兜底管线不再出现 `.mlistcnt:hover::before { transform: scale }`",
    );

    section("场景 C：开关的接线（配置默认值 / 面板 DOM / 事件绑定）");
    const defaultsSrc = load("defaults.js");
    const popupHtml = load("popup.html");
    const popupJs = load("popup.js");
    assert(
      /hoverZoom:\s*true/.test(stripComments(defaultsSrc)),
      "defaults.js 里 card.hoverZoom 默认 true（保持既有观感）",
    );
    assert(
      /id="card-hover-zoom"/.test(popupHtml) && /data-hint="card-hover-zoom-help"/.test(popupHtml),
      "popup.html 卡片外观分组里有开关与说明节点",
    );
    assert(
      /card-hover-zoom/.test(popupJs) &&
        /state\.card\.hoverZoom\s*=/.test(popupJs) &&
        /\$\("card-hover-zoom"\)\.checked/.test(popupJs),
      "popup.js 有回填（loadUI）与写入（change 绑定）两处",
    );

    console.log("");
    if (failed) {
      console.error(`✗ ${failed} 项断言失败`);
      process.exit(1);
    }
    console.log("✓ 全部断言通过");
    process.exit(0);
  });
});
