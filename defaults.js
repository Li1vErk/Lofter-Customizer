/* ============================================================
 * defaults.js — Lofter Customizer 配置结构
 * ============================================================ */

const LC_STORAGE_KEY = "lc_settings_v1";

/* 字体预置：不打包字体二进制，预置项只负责把"字体名"填进面板输入框。
 * 用户需先自行下载并安装字体到系统，选中预置后浏览器按名称匹配。
 * 注意：名称不能带引号——popup 与 content 两处 sanitize 都会剥掉 `"`；
 * 多候选按 CSS 顺序回退（同名变体/中英文名/Google 版名），命中任意一个即生效。 */
const LC_FONT_PRESETS = [
  { key: "", label: "默认（系统）", family: "" },
  {
    key: "noto-sans-sc",
    label: "思源黑体 · 简洁",
    family: "Source Han Sans SC, Noto Sans SC, 思源黑体",
  },
  {
    key: "lxgw-wenkai",
    label: "霞鹜文楷 · 文艺",
    family: "LXGW WenKai, 霞鹜文楷, LXGW WenKai Screen",
  },
  {
    key: "harmonyos-sans",
    label: "鸿蒙 Sans · 现代",
    family: "HarmonyOS Sans SC, HarmonyOS Sans, 鸿蒙 Sans",
  },
];

const LC_DEFAULTS = {
  enabled: true,
  decorationsVisible: true, // 装饰图全局显示/隐藏
  shortcutsEnabled: true,

  background: {
    mode: "off",
    color: "#e8e8e8",
    gradient: { from: "#a1c4fd", to: "#c2e9fb", angle: 135 },
    pattern: { type: "grid", fg: "#dfe6ee", bg: "#ffffff", size: 26 },
    image: { dataUrl: "", blur: 4 },
    contentAlpha: 100,
  },

  decorations: [], // 页面装饰物数组

  theme: {
    accent: "",
    text: "",
  },

  gtotop: {
    imageDataUrl: "",
    imageSize: 100,
  },

  font: { preset: "", family: "", embedName: "", embedDataUrl: "", scale: 100 },

  card: {
    enabled: true,
    radius: 16,
    gap: 12,
    shadow: true,
    // ========== 卡片出现动画配置 ==========
    animation: "none",
    stagger: true,
    staggerDelay: 80,
    duration: 500,
  },

  navbar: {
    transparent: false,
    blur: false,
  },

  searchPlaceholder: "搜索用户、标签",

  tidy: {
    hideAll: false,
    hideHoverCard: false,
    injectTitles: true,
  },

  darkMode: {
    mode: "off",
    brightness: 90,
  },

  /* 悬浮设置面板（UI 批）：按钮为停靠式，只停靠页面左/右边缘。
   * fabPos = { side: "left"|"right", y: 视口纵坐标 }，null = 默认右侧。
   * 旧版 {x,y} 自由坐标由 content.js 读取时自动按半边迁移。 */
  panel: {
    fabPos: null,
  },
};

function LC_merge(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (typeof base === "object" && base !== null) {
    const out = {};
    for (const k of Object.keys(base))
      out[k] =
        override && k in override ? LC_merge(base[k], override[k]) : base[k];
    if (override && typeof override === "object")
      for (const k of Object.keys(override))
        if (!(k in out)) out[k] = override[k];
    return out;
  }
  return override === undefined ? base : override;
}
function LC_clone(o) {
  return JSON.parse(JSON.stringify(o));
}

if (typeof window !== "undefined") {
  window.LC_DEFAULTS = LC_DEFAULTS;
  window.LC_STORAGE_KEY = LC_STORAGE_KEY;
  window.LC_FONT_PRESETS = LC_FONT_PRESETS;
  window.LC_merge = LC_merge;
  window.LC_clone = LC_clone;
}
