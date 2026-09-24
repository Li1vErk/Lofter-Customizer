/* 首页（传统 DOM）搜索下拉栏暗色黑字修复回归（jsdom，只校验生成的 CSS 文本）
 *
 * 背景（2026-09-23 用户截图实证）：暗色模式下首页 top-bar 搜索下拉里
 *   tag 文字/用户昵称/「ID:」全是黑字。根因是 hyalite「面板豁免」——浅色段按
 *   「面板=白底」假设把面板内 --lc-nav-ink 重定义成黑墨，而 hyalite 通用规则
 *   `#lofter-top-bar span:not(...) { color: var(--lc-nav-ink) !important }`
 *   直命中面板里每个 span（直命中不吃继承）→ 黑字。「相关的文章」列有更高
 *   特异性的哈希链白字规则、tag 专色 span 被豁免，故幸免。
 * 修法：暗色段把面板内 --lc-nav-ink 翻白（同特异性、后生成者胜）+ 带豁免
 *   守卫的 span 兜底（hyalite 关闭时也稳）+ 悬停规则翻墨色变量跟随强调色。
 *
 * 运行：NODE_PATH=<workspace>/node_modules node tools/test-search-drop-dark.js
 * 注意：main IIFE 依赖 lc-dwr.js 的 LC_dwrCall，必须按 manifest 顺序 eval。 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const load = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const PAGE_HTML = `<!doctype html><html><body>
<div id="lofter-top-bar"><div class="x-content-web"><div class="x-body-web">
  <a class="pill"><span class="txt">昵称</span></a>
  <span class="GpLmHKrgQS9DGUHQapUffw==">tag</span>
</div></div></div>
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

function boot(settings, cb) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", () => {});
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
      console.error("  [warn]", f, "eval 失败:", e.message);
    }
  });

  setTimeout(() => {
    let all = "";
    w.document.querySelectorAll("style").forEach((s) => {
      all += s.textContent + "\n";
    });
    cb(all);
  }, 500);
}

const FLIP = "--lc-nav-ink: rgba(255, 255, 255, 0.9)";
const DARK_INK = "--lc-nav-ink: rgba(0, 0, 0, 0.75)";
const SPAN_GUARD =
  '#lofter-top-bar [class*="-body-web"] span:not([class*="GpLmHKrgQS9DGUHQapUffw=="]):not([class*="WeY35c7R15DuCplrvtXRHg=="])';

section("场景 A：暗色 manual + hyalite 开");
boot({ enabled: true, darkMode: { mode: "manual" }, navbar: { hyalite: true } }, (css) => {
  console.log("[1] 面板墨色翻面存在");
  assert(css.includes(FLIP), "暗色段把面板内 --lc-nav-ink 重定义为白墨");

  console.log("[2] 翻面必须晚于浅色黑墨豁免（同特异性后者胜）");
  assert(css.includes(DARK_INK), "浅色段黑墨豁免仍在（不破坏浅色面板）");
  assert(css.indexOf(FLIP) > css.indexOf(DARK_INK), "翻面规则在黑墨豁免之后生成");

  console.log("[3] span 墨色兜底存在且带豁免守卫");
  assert(css.includes(SPAN_GUARD), "兜底规则排除 tag 专色（GpLm）与日期（WeY35）span");

  console.log("[4] 悬停规则翻墨色变量（span 不吃继承，跟随强调色）");
  assert(
    /a:not\(\[class\*="AV8Mt74pTEHQXrEBEKFaUg=="\]\):hover\s*\{[^}]*--lc-nav-ink:/s.test(css),
    "a:hover 块里重定义 --lc-nav-ink",
  );

  section("场景 B：暗色 manual + hyalite 关（兜底不依赖 hyalite）");
  boot({ enabled: true, darkMode: { mode: "manual" }, navbar: { hyalite: false } }, (css2) => {
    assert(css2.includes(FLIP), "翻面规则仍在");
    assert(css2.includes(SPAN_GUARD), "span 兜底仍在（站点自身深字也覆盖）");

    section("场景 C：暗色 off（负向对照）");
    boot({ enabled: true, darkMode: { mode: "off" }, navbar: { hyalite: true } }, (css3) => {
      assert(!css3.includes(FLIP), "非暗色时不生成翻面规则（浅色面板保持深字）");

      console.log("");
      if (failed) {
        console.error(`✗ ${failed} 项断言失败`);
        process.exit(1);
      }
      console.log("✓ 全部断言通过");
      process.exit(0);
    });
  });
});
