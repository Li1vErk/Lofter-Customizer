/* 表情面板跨帧托管 E2E（jsdom）：专栏文章页的评论区在 comment.do 子帧里，
 * 面板由顶层帧托管渲染（否则被 iframe 边界裁切）。覆盖：
 *   1) 子帧点表情按钮 → 面板出现在顶层文档（子帧内无面板节点）
 *   2) 顶层点表情 chip → 指令跨帧回子帧，插入子帧输入框
 *   3) 顶层点面板外 → 面板收起，子帧按钮高亮同步清除
 *   4) 按钮二次点击 → toggle 收起；再点 → 重开
 * 双 JSDOM 方案：jsdom 30 已不导出 ResourceLoader、iframe 真实装载不可控，
 * 改为两个 JSDOM 手工桥接——子帧 window 用 Proxy 影子 window.top/parent，
 * 双向 postMessage 手工派发（source 按真实语义填写）。生产代码零改动。
 * 运行：NODE_PATH=<workspace>/node_modules node tools/test-cmt-emoji-remote.js */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const defaultsSrc = fs.readFileSync(path.join(ROOT, "defaults.js"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");

const PARENT_HTML = `<!doctype html><html><body>
<div class="postc"><a class="author" href="https://a.lofter.com/">楼主</a></div>
<iframe id="cmtframe" src="about:blank"></iframe>
</body></html>`;

const SUB_HTML = `<!doctype html><html><body>
<div class="cmtwrap">
  <div class="cmtform"><textarea></textarea><button class="pub">发布</button></div>
  <ul><li><div class="cmti"><span class="cmtusr"><a href="https://a.lofter.com/">楼主</a></span><span class="cmthot"> hi</span></div></li></ul>
</div>
</body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) {
    passed++;
    console.log("  ✓ " + name);
  } else {
    failed++;
    console.log("  ✗ " + name);
  }
}

function stubChrome(initial) {
  const data = JSON.parse(JSON.stringify(initial));
  const listeners = [];
  const chrome = {
    storage: {
      local: {
        get: (keys, cb) => setTimeout(() => cb(data), 0),
        set: (obj) => {
          const changes = {};
          Object.keys(obj).forEach((k) => {
            data[k] = JSON.parse(JSON.stringify(obj[k]));
            changes[k] = { newValue: data[k], oldValue: undefined };
          });
          listeners.slice().forEach((fn) => {
            try {
              fn(changes, "local");
            } catch (e) {}
          });
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    runtime: { id: "test" },
  };
  return { data, chrome };
}

function patchWin(w) {
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
}

async function main() {
  const vc = new VirtualConsole();
  vc.on("jsdomError", () => {}); /* 静默 notImplemented / 缺站点 API 的噪音 */

  const domA = new JSDOM(PARENT_HTML, {
    url: "https://www.lofter.com/lpost/810c5c05_34ec60eca",
    runScripts: "outside-only",
    virtualConsole: vc,
  });
  const domB = new JSDOM(SUB_HTML, {
    url: "https://www.lofter.com/comment.do?pid=1",
    runScripts: "outside-only",
    virtualConsole: vc,
  });
  const wa = domA.window;
  const wb = domB.window;
  patchWin(wa);
  patchWin(wb);

  /* 双向 postMessage 手工桥（source 按真实语义：谁发的谁就是 source；
   * 派发目标 = postMessage 的接收方 window） */
  wa.postMessage = (data) => {
    setTimeout(() => {
      wa.dispatchEvent(new wa.MessageEvent("message", { data: data, source: wb }));
    }, 0);
  };
  wb.postMessage = (data) => {
    setTimeout(() => {
      wb.dispatchEvent(new wb.MessageEvent("message", { data: data, source: wa }));
    }, 0);
  };

  /* 子帧内容脚本在「window.top/parent 指向顶层」的影子下求值：
   * Proxy 只拦 top/parent，其余全部透传真实 winB */
  const subShadow = new Proxy(wb, {
    get(t, k) {
      if (k === "top" || k === "parent") return wa;
      return t[k];
    },
  });

  /* 顶层帧：iframe 元素的 contentWindow 影子化为 winB（托管侧用它验证
   * 消息来源是「本页 iframe」） */
  const frameEl = wa.document.getElementById("cmtframe");
  try {
    Object.defineProperty(frameEl, "contentWindow", {
      get: () => wb,
      configurable: true,
    });
  } catch (e) {
    console.log("  [警告] contentWindow 影子化失败:", e.message);
  }

  const sc = stubChrome({
    lc_settings_v1: { comment: { toolbar: true, emojiPanel: true } },
    lc_official_bl_v1: { names: [] },
  });
  wa.chrome = sc.chrome;
  wb.chrome = sc.chrome; /* 两帧共享同一份 storage（跨帧同步的前提） */

  wa.eval(defaultsSrc);
  try {
    wa.eval(contentSrc);
  } catch (e) {
    console.log("  [顶层] 主 IIFE 抛错（预期内）:", e.message.slice(0, 60));
  }
  wb.eval(defaultsSrc);
  try {
    wb.eval(
      "(function(window){\n" + defaultsSrc + "\n" + contentSrc + "\n})",
    )(subShadow);
  } catch (e) {
    console.log("  [子帧] 脚本抛错:", e.message.slice(0, 80));
  }
  await sleep(120); /* storage.get 回调 + cmtTick 构建 + postMessage 异步 */

  const subDoc = wb.document;
  const bar = subDoc.querySelector(".lc-cmt-tb");
  ok(!!bar, "子帧评论工具行已注入");
  const btn = bar && bar.querySelector('[data-act="emoji"]');
  ok(!!btn, "表情按钮在子帧工具行上");
  if (!btn) return finish();

  /* 1) 子帧点按钮 → 面板出现在顶层 */
  btn.click();
  await sleep(80);
  const host = wa.document.querySelector(".lc-ep-host");
  ok(!!host && host.classList.contains("lc-open"), "面板开在顶层文档");
  ok(!subDoc.querySelector(".lc-ep-host"), "子帧内无面板节点");
  const panel = host && host.querySelector(".lc-emoji-panel");
  ok(!!panel, "顶层面板已渲染");
  const tabs = panel ? panel.querySelectorAll(".lc-ep-tab").length : 0;
  ok(tabs > 0, "导航 tab 已渲染（" + tabs + " 个）");

  /* 2) 切到内置包，点 chip → 指令回子帧插入输入框 */
  const tabBtn = panel.querySelector('.lc-ep-tab[data-tab="老福鸽"]');
  if (tabBtn) tabBtn.click();
  await sleep(30);
  const chip = panel.querySelector("[data-ins]");
  ok(!!chip, "内置包 chip 已渲染");
  const ta = subDoc.querySelector(".cmtform textarea");
  if (chip) chip.click();
  await sleep(100);
  ok(
    ta && ta.value.indexOf("[老福鸽/") === 0,
    "跨帧插入子帧输入框: " + (ta ? ta.value : "×"),
  );

  /* 3) 顶层点面板外 → 收起，子帧高亮同步清除 */
  wa.document.body.dispatchEvent(new wa.MouseEvent("mousedown", { bubbles: true }));
  await sleep(80);
  ok(host && !host.classList.contains("lc-open"), "顶层点外 → 面板收起");
  ok(!btn.classList.contains("lc-on"), "子帧按钮高亮同步清除");

  /* 4) toggle：再开 → 再点同按钮 → 收 */
  btn.click();
  await sleep(60);
  ok(host && host.classList.contains("lc-open"), "再次点按钮 → 重开");
  btn.click();
  await sleep(60);
  ok(host && !host.classList.contains("lc-open"), "同按钮再点 → toggle 收起");

  finish();
}

function finish() {
  console.log(
    "\n" +
      (failed ? "有 " + failed + " 项失败" : "全部断言通过") +
      "（" +
      passed +
      " 项）",
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("测试运行失败:", e);
  process.exit(1);
});
