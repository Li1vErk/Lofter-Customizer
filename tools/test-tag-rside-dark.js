/* tag 页右侧栏「参与用户」暗色白底修复回归（jsdom，只校验生成的 CSS 文本）
 *
 * 背景（2026-09-23 用户截图 + DOM 实证）：tag 页右侧参与用户卡挂在
 *   #tageditor .g-box .m-menu —— **不在 #rside、不在任何反色区**。
 *   旧暗色规则全部带 #rside 前缀（脱靶），而浅色管线的
 *   `.g-box:has(.participate-user-title-w)` 无前缀、暗色下照常写 #fff 白底
 *   → 暗色模式下白卡。
 * 修法（与 #rside > * 反相同构，对卡片本地挂滤镜）：
 *   ① 各层底色统一预反色 rgb(225,225,219)，经本地滤镜终显 #1F1F19 与其他卡片一致；
 *   ② .menut/.menub 气泡切片隐藏；
 *   ③ img 双重反相还原头像；
 *   ④ 卡片本地 filter: invert+hue-rotate+brightness（站点配色/雪碧图自反转，免猜色）。
 *
 * 运行：NODE_PATH=<workspace>/node_modules node tools/test-tag-rside-dark.js
 * 注意：main IIFE 依赖 lc-dwr.js 的 LC_dwrCall，必须按 manifest 顺序 eval。 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const load = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* 复刻用户实证的 tag 页侧栏结构（#tageditor 挂载点） */
const PAGE_HTML = `<!doctype html><html><body>
<div id="tageditor"><div class="g-box"><div class="m-menu">
  <div class="menut"></div>
  <div class="menum">
    <ul class="participate-user-title-w"><li class="participate-user-title">参与用户</li></ul>
    <ul class="mtag"><li class="big"><a class="mi itag"><span class="w-img2"><img class="itag" src="x.jpg" alt="u"></span><span class="txt txt-in"><span class="us itag">用户</span><span class="in itag">活跃用户</span></span></a><a class="w-icn2 itag">关注</a></li></ul>
  </div>
  <div class="menub"></div>
</div></div></div>
<div id="main"><div class="m-mlist"><div class="mlistcnt"><div class="isay">卡</div></div></div></div>
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
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

function boot(settings, cb) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => console.error("  [jsdomError]", e.message));
  const dom = new JSDOM(PAGE_HTML, {
    url: "https://www.lofter.com/tag/x",
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
      console.error("  [warn]", f, "eval 失败:", e.message);
    }
  });

  setTimeout(() => {
    const dark = w.document.getElementById("lc-dark-cards");
    cb({
      hasDark: !!dark,
      raw: dark ? dark.textContent : "",
      dc: stripComments(dark ? dark.textContent : ""),
    });
  }, 500);
}

const BASE = "html #tageditor .g-box:has(.participate-user-title-w)";

section("场景 A：暗色 manual（darkMode.brightness 默认 90）");
boot({ enabled: true, darkMode: { mode: "manual" } }, (r) => {
  console.log("[1] 暗色卡片样式表已生成");
  assert(r.hasDark && r.raw.length > 1000, "lc-dark-cards 存在且非空");

  console.log("[2] #tageditor 锚点规则存在（挂载点修复）");
  assert(r.dc.includes(BASE), "存在 `html #tageditor .g-box:has(.participate-user-title-w)` 规则");

  console.log("[3] 各层底色 = 预反色 rgb(225,225,219)（终显 #1F1F19 与其他卡片一致）");
  assert(
    new RegExp(BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ",\\s*" + BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\.m-menu").test(r.dc),
    "内层 .m-menu 一并覆盖",
  );
  assert(
    (r.dc.match(new RegExp(BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^{]*\\{[^}]*\\}", "g")) || []).some(
      (b) => b.includes("background: rgb(225, 225, 219) !important"),
    ),
    "底色写的是预反色 rgb(225, 225, 219)",
  );

  console.log("[4] 卡片本地反相滤镜（站点配色/雪碧图自反转，免猜色）");
  assert(
    new RegExp(
      BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{\\s*filter: invert\\(100%\\) hue-rotate\\(180deg\\) brightness\\(0\\.9\\) !important;",
    ).test(r.dc),
    "g-box 上有 `filter: invert(100%) hue-rotate(180deg) brightness(0.9)`（brightness=90/100）",
  );

  console.log("[5] 头像双重反相还原");
  assert(
    new RegExp(
      BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " img\\s*\\{\\s*filter: invert\\(100%\\) hue-rotate\\(180deg\\) !important;",
    ).test(r.dc),
    "img 在滤镜内再反相一次（终显原图）",
  );

  console.log("[6] 气泡切片隐藏");
  assert(
    new RegExp(
      BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\.menut,\\s*" + BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\.menub\\s*\\{\\s*display: none !important;",
    ).test(r.dc),
    ".menut/.menub display:none（切片不参与反相显形）",
  );

  console.log("[6b] 卡片投影清掉（浅色 box-shadow 在滤镜内反成白晕 = 卡下灰带）");
  assert(
    new RegExp(
      BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ",\\s*" + BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\.m-menu\\s*\\{\\s*box-shadow: none !important;",
    ).test(r.dc),
    "g-box 与 .m-menu 的 box-shadow 均被置 none",
  );

  console.log("[7] 旧 #rside 规则保留（向后兼容，万一别的页面还在 #rside）");
  assert(
    r.dc.includes("html #rside .m-menu:has(.participate-user-title-w) .menum"),
    "#rside 前缀的旧预反色规则仍在",
  );

  section("场景 B：暗色 off（负向对照）");
  boot({ enabled: true, darkMode: { mode: "off" } }, (r2) => {
    assert(!r2.hasDark, "非暗色时不生成 lc-dark-cards（旧规则也不该在）");

    console.log("");
    if (failed) {
      console.error(`✗ ${failed} 项断言失败`);
      process.exit(1);
    }
    console.log("✓ 全部断言通过");
    process.exit(0);
  });
});
