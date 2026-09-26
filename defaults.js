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

  font: { preset: "", family: "", off: false, embedName: "", embedDataUrl: "", scale: 100 },

  card: {
    enabled: true,
    radius: 16,
    gap: 12,
    shadow: true,
    /* 卡片材质主开关（2026-09-26）：lightFrost / darkMode.feedTranslucent /
       faceAdapt 三个子功能的总门禁。false = 三者全部停用但子设置保留
       （关了再开原样回来）；true = 子设置各自生效。老配置由 popup 加载时
       回填：任一子项开着即 true（升级前后行为零变化） */
    material: false,
    /* 悬停轻微放大（默认开＝保持既有观感）：鼠标停在博文卡片上时整卡放大
       到 102%（底边锚点 + 0.22s ease-out）。
       关掉 = 两条渲染路径都不再生成悬停缩放规则（气泡卡整卡那条 + 通用
       兜底管线 ::before 那条），卡片圆角/阴影/材质/出现动画一律不受影响，
       悬停投影也保留。
       为什么要有这个开关：这是插件里唯一一条**会改变命中盒**的动画
       （2026-09-23 的「放大抖不停 + 卡内『收起』点不到」就源于它），
       且「卡片跟着鼠标动」本身是主观偏好 —— 留一个一票关停的口子，
       而不是逼用户二选一地忍受或改源码。 */
    hoverZoom: true,
    /* 浅色卡片毛玻璃（实验）：仅浅色模式，插件自绘卡面改半透明白 + 真
       backdrop-filter 磨砂（浅色无反色祖先，没有 backdrop root 限制，
       暗色下此路不通）。卡面 alpha 可调，40%~85% 防深字吃进花背景 */
    lightFrost: false,
    frostAlpha: 0.6,
    /* 卡面自适应材质：浅色模式下采样卡片背后背景亮度，
       偏暗（<0.45）→ 卡面自动切深膜白字（与侧栏玻璃深材质同族语言）。
       滚动/换图驱动的 400ms 节流重采样，深浅切换零动画成本 */
    faceAdapt: true,
    // ========== 卡片出现动画配置 ==========
    animation: "none",
    stagger: true,
    staggerDelay: 80,
    duration: 500,
  },

  /* 导航栏玻璃 —— 两档，互斥（popup 侧联动）：
   *   blur    = 低透毛玻璃：blur(16px) + 白膜，背后内容被磨砂遮住，只留色块
   *   hyalite = 高透液态玻璃：边缘折射 + 焦散 + 菲涅尔边缘光，背后内容可辨认（仅 Chromium）
   * 两档都只在「背景」开启时生效（无背景时导航栏无需透明处理）。
   * 本批（导航栏两档化）起移除独立「导航栏透明」档（效果被毛玻璃完全覆盖），
   * 老配置由 LC_migrateNav() 自动迁移：只开了透明 → 转为毛玻璃。 */
  navbar: {
    blur: false,
    /* 液态玻璃（hyalite）参数为「矮元素安全值」：
     * bevel 会被钳到短边一半，导航栏这类 ~56px 高的条带千万别套内容区的大参数。 */
    hyalite: false,
    glass: {
      bevel: 14,
      thickness: 16,
      slope: 2.4,
      shape: "squircle", // circle | squircle | lip
      blur: 0,
      dispersion: 1.2,
      shade: 0.4,
      rim: 1.6,
      edgeW: 5,
      sat: 0.9,
      light: -140,
    },
    /* 自适应材质：auto = 采样导航栏背后亮度，暗→深膜白字，亮→白膜黑字 */
    matMode: "auto", // auto | light | dark
    matThreshold: 0.5,
  },

  /* 右侧栏液态玻璃（首页 #rside > #slide-bar 里的卡片）。
   * 与导航栏同一套 hyalite 引擎，但目标元素是竖长卡片（≈250×400），
   * 参数需要更大一组（bevel 是「边缘弯曲带宽度」，矮条带用小值，
   * 卡片用大值才有透镜感）。
   * ⚠️ 关键约束：暗色模式原先靠 `#rside > * { filter: invert }` 反色，
   * 而 filter 会建立 backdrop root——玻璃只能采样到该祖先内部的画面
   * （即近乎空白），折射完全失效。故开启后侧栏改用「深色玻璃 + 白字」
   * 直接给色（见 buildCSS 的右侧栏玻璃块），不再叠加反色。 */
  sidebar: {
    hyalite: false,
    /* 仅首页生效（2026-09-23 曾尝试接入查看更多页右侧栏，含范围勾选与
       常开两版，真机均失败且首页玻璃连带异常，已整体回退；tag 页右侧栏
       明确不做——其暗色靠卡片本地 invert 反相，滤镜与玻璃互为 backdrop
       root 互斥） */
    /* 边缘折射（hyalite SVG 滤镜）：Chromium 对 backdrop-filter: url()
       走软件光栅化，卡片常驻视口即持续占用，实测会拖慢全页其他动效
       （博文卡悬停、面板开合）。故侧栏默认只走纯 blur(18px) 磨砂，
       折射作为实验项按需开（观感接近，资源开销差一个量级）。 */
    refract: false,
    glass: {
      bevel: 22,
      thickness: 30,
      slope: 2.6,
      shape: "squircle", // circle | squircle | lip
      blur: 0.6,
      dispersion: 1.4,
      shade: 0.44,
      rim: 1.7,
      edgeW: 6,
      sat: 0.9,
      light: -140,
    },
    matMode: "auto", // auto | light | dark
    matThreshold: 0.5,
  },

  searchPlaceholder: "搜索用户、标签",

  tidy: {
    hideAll: false,
    hideHoverCard: false,
    injectTitles: true,
  },

  /* ========== 功能栏（往页面注入的功能开关）==========
   * 开发约定：每项独立开关、默认关闭——避免老用户升级后被意外改变行为，
   * 也让某个功能失效时可以单项关掉，而不必卸载整个扩展。 */
  tools: {
    /* 长文章实时字数统计：在编辑器右下角常驻显示。
     * 口径（docs 定稿）：汉字按字、连续英文数字按词，标点计入总字符。
     * 已去开关、默认启用：不写长文章的用户进不了长文章编辑器，
     * 完全无感；会写的人属刚需。字段仅为兼容旧存储而保留。 */
    wordCount: true,
  },

  /* ========== 关键词/用户过滤（功能栏 · 默认关闭）==========
   * 范围（分期）：Phase 1 = 首页时间线 + 标签页的博文卡片；
   * Phase 2 = 评论区（comment）——**只认 users，不做关键词匹配**
   * （评论正文短，关键词误杀率不可控），扫描跑在评论区 iframe 的
   * content.js 分支里（manifest all_frames 注入）。发现页暂不启用。
   * keywords 大小写不敏感子串匹配（标题/正文/标签）；
   * users 按 id 精确等值匹配（id 取主页链接 hostname 首段或路径首段，
   * name 仅作展示——昵称会改，id 才是稳定标识）。 */
  filter: {
    enabled: false,
    scope: { home: true, tag: true, comment: false },
    keywords: [],
    users: [],
    tags: [],
    showCounter: true,
  },

  /* ========== 官方黑名单联动（功能栏）==========
   * 通过 LOFTER 自有 DWR 接口（UserBean.*.dwr，Cookie 鉴权、无 token）
   * 在插件内读取/添加/移除官方黑名单，免去进设置页粘贴链接。
   * 与插件本地隐藏的分工：官方拉黑 = 服务端强隔离（对方可感知），
   * 本地隐藏 = 仅自己不看（对方无感）。hideInComments 开启时，评论区
   * 过滤把官方黑名单成员并入隐藏名单（名单镜像存 storage 的
   * lc_official_bl_v1，由 popup / www 域页面帧写入，任意帧只读）。 */
  official: {
    hideInComments: true,
  },

  /* ========== 评论区增强（功能栏 · 默认开启）==========
   * 工具行常驻在评论输入框正上方：左「只看作者」「从旧到新」，
   * 右表情快捷入口（内置免费表情 + 粘贴导入的付费表情，插入
   * [包名/情绪] 文字格式）。表情不单列开关，跟随本总开关；
   * 控件默认熄灭、状态不跨帖保留，不改变页面默认行为；
   * 关闭 = 工具行与表情面板完全不注入，页面零改动。 */
  comment: {
    toolbar: true,
  },

  darkMode: {
    mode: "off",
    brightness: 90,
    /* 信息流淡透底（实验）：反色区内打 rgba(230,230,232,.85)，
       反相显示为 rgba(约25,25,23,.85) 的深色淡透底，背景极淡透出。
       只动三块反色容器自身的底，内层白面不碰（改了会误杀卡片/按钮底） */
    feedTranslucent: false,
    /* 淡透底卡面不透明度（0.35~0.92）：invert 不改 alpha，滑杆值=显示值。
       过低白字在亮背景处吃字，过高失去透的意义 */
    feedTransAlpha: 0.65,
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

/* 配置迁移：移除 navbar.transparent（独立半透明档，本批两档化改动的一部分）。
 * 老用户若「只开了导航栏透明、没开毛玻璃/液态玻璃」，
 * 直接删字段会让导航栏突然回到站点默认黑色 → 迁移为毛玻璃（观感最接近）。
 * 已开 blur / hyalite 的配置不受影响。
 * 迁移后必须删掉 transparent 字段：否则用户手动关掉毛玻璃时，
 * 下次读取又会因残留的 transparent=true 被迁回 blur=true，导致关不掉。 */
function LC_migrateNav(s) {
  if (!s || typeof s !== "object" || !s.navbar) return s;
  const n = s.navbar;
  if (n.transparent === true && !n.blur && !n.hyalite) n.blur = true;
  if ("transparent" in n) delete n.transparent;
  return s;
}

/* 字体显示名 → 真实注册名 别名表：部分字体（如京華老宋体）name 表只有英文名，
   用中文名匹配会回退默认字体，这里在存/读两侧统一归一化 */
const LC_FONT_ALIASES = {
  "京華老宋体": "KingHwa_OldSong",
  "京华老宋体": "KingHwa_OldSong",
};
function LC_normalizeFontFamily(val) {
  if (!val) return val;
  let s = String(val);
  for (const [alias, real] of Object.entries(LC_FONT_ALIASES)) {
    /* 整段等值或逗号列表中的单项都替换，避免误伤其它字体 */
    s = s
      .split(",")
      .map((p) => (p.trim() === alias ? real : p))
      .join(",");
    if (s.trim() === alias) s = real;
  }
  return s;
}

if (typeof window !== "undefined") {
  window.LC_DEFAULTS = LC_DEFAULTS;
  window.LC_STORAGE_KEY = LC_STORAGE_KEY;
  window.LC_FONT_PRESETS = LC_FONT_PRESETS;
  window.LC_merge = LC_merge;
  window.LC_clone = LC_clone;
  window.LC_migrateNav = LC_migrateNav;
  window.LC_normalizeFontFamily = LC_normalizeFontFamily;
}
