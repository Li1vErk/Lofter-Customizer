/* 右侧栏玻璃回归（jsdom，只校验生成的 CSS 文本）——回退锁定版
 *
 * 背景：2026-09-23 曾尝试把查看更多页（新版 React）右侧栏接入玻璃引擎
 *   （先做 scopeHome/scopeMore 范围勾选、二改去掉范围常开），两次真机
 *   均失败（查看更多页无效果，且首页导航玻璃/侧栏磨砂连带异常），用户
 *   定案**整体回退**到接入前状态：引擎只服务首页 #slide-bar，
 *   #application 平行块、双根看门、范围配置全部移除。
 *   tag 页右侧栏不接的决策维持不变。
 * 断言口径：
 *   - 开 = 首页块（含 ①反色让位）生成，磨砂 blur(18px) saturate(150%)；
 *   - 折射档 = backdrop-filter 为 var(--hyalite, blur(16px))；
 *   - 关 = 块不生成、①让位恢复；
 *   - 全库（content/defaults/popup）无 #application 玻璃残留、无 scope 字段。
 *
 * 运行：NODE_PATH=<workspace>/node_modules node tools/test-side-glass.js
 * 注意：main IIFE 依赖 lc-dwr.js 的 LC_dwrCall，必须按 manifest 顺序 eval。 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const load = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const PAGE_HTML = `<!doctype html><html><body>
<div id="rside"><div id="slide-bar"><div class="x-box-web">卡</div></div></div>
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

function boot(sidebar, cb, stubHyalite) {
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
  const store = {
    lc_settings_v1: { enabled: true, sidebar },
    lc_official_bl_v1: { names: [] },
  };
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
  /* 折射档依赖 Hyalite.supported()；jsdom 不具备真实 CSS 支持时打桩 */
  if (stubHyalite) {
    w.Hyalite = {
      supported: () => true,
      attach() {},
      detach() {},
      refresh() {},
    };
  }

  setTimeout(() => {
    let all = "";
    w.document.querySelectorAll("style").forEach((s) => {
      all += s.textContent + "\n";
    });
    cb(all);
  }, 500);
}

const HOME_GLASS = '#rside #slide-bar [class*="-box-web"].lc-side-glass {';
const YIELD_MARK = "反色让位"; // ① 注释锚（首页反色让位规则独有）

const SIDE = (over) =>
  Object.assign(
    {
      hyalite: true,
      refract: false,
      matMode: "auto",
    },
    over || {},
  );

section("场景 A：开启（默认磨砂）");
boot(SIDE(), (css) => {
  assert(css.includes(HOME_GLASS), "首页玻璃块生成");
  assert(css.includes(YIELD_MARK), "① 反色让位在");
  assert(
    /#rside #slide-bar \[class\*="-box-web"\]\.lc-side-glass \{[^}]*backdrop-filter: blur\(18px\) saturate\(150%\)/s.test(
      css,
    ),
    "磨砂参数 blur(18px) saturate(150%)",
  );

  section("场景 B：折射档");
  boot(SIDE({ refract: true }), (css2) => {
    assert(css2.includes(HOME_GLASS), "折射档首页玻璃块生成");
    assert(
      /#rside #slide-bar \[class\*="-box-web"\]\.lc-side-glass \{[^}]*backdrop-filter: var\(--hyalite, blur\(16px\)\)/s.test(
        css2,
      ),
      "backdrop-filter 为 var(--hyalite, blur(16px))",
    );

    section("场景 C：主开关关");
    boot(SIDE({ hyalite: false }), (css3) => {
      assert(!css3.includes(HOME_GLASS), "首页玻璃块不生成");
      assert(!css3.includes(YIELD_MARK), "① 反色让位一并撤（首页暗色反白恢复）");

      section("回退锁定：无查看更多页接入残留");
      const cj = load("content.js");
      assert(
        !cj.includes(".lc-side-glass") ||
          !/#application[^{]*lc-side-glass/.test(cj),
        "content.js: 无 #application 玻璃块",
      );
      const elsFn = cj.slice(
        cj.indexOf("function lcSideGlassEls"),
        cj.indexOf("function lcSideHyDetachAll"),
      );
      assert(
        elsFn.includes("#slide-bar") &&
          !elsFn.includes("#application") &&
          !/scopeHome|scopeMore/.test(elsFn),
        "content.js: 元素收集仅首页来源、无范围分支",
      );
      const watchFn = cj.slice(
        cj.indexOf("function lcSideWatchStart"),
        cj.indexOf("function lcSideWatchStop"),
      );
      assert(
        watchFn.includes('getElementById("rside")') &&
          !watchFn.includes('getElementById("application")'),
        "content.js: 看门只观察 #rside",
      );
      const d = load("defaults.js");
      assert(!/scopeHome\s*:/.test(d), "defaults: 无 scopeHome 字段");
      assert(!/scopeMore\s*:/.test(d), "defaults: 无 scopeMore 字段");
      const h = load("popup.html");
      assert(!h.includes("sidebar-scope-"), "popup.html: 无生效范围勾选");
      const pj = load("popup.js");
      assert(!pj.includes("sidebar-scope-"), "popup.js: 无生效范围绑定");

      console.log("");
      if (failed) {
        console.error(`✗ ${failed} 项断言失败`);
        process.exit(1);
      }
      console.log("✓ 全部断言通过");
      process.exit(0);
    });
  }, true);
});
