window.decorationsGloballyHidden = false;

/* 子帧分支整体包进 IIFE：原来的提前退出靠顶层 throw（控制台会显示成
 * 红色 Uncaught Error，用户每次开 DevTools 都被吓一跳），改成 IIFE 里
 * return —— 语义相同（跳过该帧的后续主逻辑），零报错 */
/* 子帧分支与主帧主逻辑共用一个外层函数：子帧各分支处理完直接 return
 * （不会执行到下面的主逻辑），主帧自然落到主逻辑。历史上这里用顶层
 * throw 提前退出，控制台会显示红色 Uncaught Error；改成 IIFE+return
 * 又破坏过退出语义（return 只退 IIFE，子帧继续跑主逻辑 → 子帧多出
 * 悬浮按钮、管线重复执行，2026-09-24 实测回归）。现在同层收编，两种
 * 问题都不存在 */
(function () {
  /* i18n（#16 港澳台繁体）：先定界面语言（storage 异步，回调后 LC_I18N 才
   * 真正可用）。zh-Hans 下全链路恒等，零影响。
   *   · watch() 由各模块在自己的容器构建点挂（评论面板 / 工具行 / 分享图面板）；
   *   · observe() 是全文档兜底 —— 只「发现」以 lc-/lcsd- 打头的插件自有
   *     容器，命中才在其子树内做整节点等值替换，绝不 apply document 本身。
   * 两者在 lc-i18n.js 内都有幂等守卫，主帧 / 评论帧 / control 帧都安全。 */
  if (typeof LC_I18N !== "undefined") {
    LC_I18N.init();
    LC_I18N.observe();
  }

  if (window !== window.top) {
  const href = location.href;

  /* about:blank / about:srcdoc 帧：既不是评论区，也不该走评论区的反色管线。
   * manifest 为字数桥接开启 match_about_blank 后，content.js 会注入进编辑器
   * 自己的 about:blank 子帧；一旦落到下面的评论区分支，该帧会再叠一层
   * body{filter:invert} 滤镜，与父帧 #main 的反色相互抵消 →
   * 编辑器变白底黑字（v1.1.1 实测回归）。这类帧一律不插手：
   * 编辑器暗色由父帧 applyLongpostEditorDark 负责，计数由 wc-frame.js 负责。 */
  if (/^about:/i.test(href) || /^about:/i.test(document.URL || '')) {
    return;
  }

  /* 模板预览帧（主页设置 → 模板 → 预览）：预览必须展示模板原貌。
   * 该帧是 *.lofter.com 子域，此前掉进评论区分支被 body{filter:invert}
   * 整帧反转（浅色模板变暗色卡、图片反色，2026-09-21 实证）→
   * 预览帧一律不插手，暗色/过滤等全部不生效。 */
  if (window.name === 'theme_preview' || href.includes('themesettingproxy.html')) {
    return;
  }

  // 编辑器 iframe (lf127.net)
  if (href.includes('lf127.net')) {
    chrome.storage.local.get('lc_settings_v1', (res) => {
      const s = res['lc_settings_v1'] || {};
      const checkAndApply = (settings) => {
        const mode = settings?.darkMode?.mode || 'off';
        const isDark = mode === 'manual' ||
          (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        let st = document.getElementById('lc-editor-dark');
        if (!st) {
          st = document.createElement('style');
          st.id = 'lc-editor-dark';
          (document.head || document.documentElement).appendChild(st);
        }
        /* 暗色基础（仅暗色上色）。底部让位已撤销（2026-09-29）：官方
         * 提示行与恢复浮条迁至父帧「腾座」空白带（lc-draft 给编辑器
         * iframe 父容器注入 padding-bottom），编辑区内不再有任何浮层 */
        st.textContent = (isDark ? `
            html, body, .pc-publish-container, [class*="editor"], [contenteditable] {
              background: rgb(30, 30, 36) !important;
              color: rgba(255, 255, 255, 0.85) !important;
            }
            img { filter: none !important; }
            /* 滚动条 */
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: rgb(30, 30, 36); }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
          ` : '');
      };
      checkAndApply(s);
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes['lc_settings_v1']) {
          checkAndApply(changes['lc_settings_v1'].newValue || {});
        }
      });
    });
    return;
  }

  // 评论区 iframe (原有逻辑)
  let styleEl = null;
  let emojiObserver = null;

  const clearEmojiFix = () => {
    // 清除内联 filter
    document.querySelectorAll('.bcmtlstf.s-fc4.itag').forEach(el => {
      el.style.removeProperty('filter');
      delete el.dataset.emojiFixed;
    });
    // 清除包裹的 span
    document.querySelectorAll('.bcmtlstf.s-fc4.itag span[style*="invert"]').forEach(span => {
      span.replaceWith(span.textContent);
    });
    if (emojiObserver) {
      emojiObserver.disconnect();
      emojiObserver = null;
    }
  };

  const applyDark = () => {
    if (styleEl) return;
    const isLpost = document.referrer.includes('lofter.com/lpost/');
    styleEl = document.createElement('style');
styleEl.textContent = `
  body {
    filter: invert(100%) hue-rotate(180deg) !important;
  }
  /* img 还原不能只做 lpost：body{filter:invert} 会连帧内图片一起反色，
   * 而 control 帧（博客页顶栏：V 标/关注钮/返回首页）与普通博客页评论帧
   * 同样落进本分支——2026-10-08 lofguancha 真机实锤 V 标金底白 V 反成
   * 暗底黑 V（评论区表情图同理）。lpost 页早已全量还原且久经验证，
   * 各帧内容同类，统一还原。 */
  img {
    filter: invert(100%) hue-rotate(180deg) !important;
  }
  /* V 标不是 <img>——是 <b> 元素上的 CSS 背景精灵图（.boprt ul .vicon a b，
   * flagv…），img 规则够不着。与 www 主管线 a.vicon「白色icon反转回来」
   * （~12655）同款补偿：对精灵元素再做一次反色 = 还原本色。
   * 2026-10-08 lofguancha 真机实锤（DevTools：b{background:url(flagv)}）。 */
  .boprt ul .vicon a b,
  .boprt .vicon b {
    filter: invert(100%) hue-rotate(180deg) !important;
  }
.bcmtipt {
  border-color: rgba(255, 255, 255, 0.15) !important;
  filter: invert(100%) hue-rotate(180deg) !important;
  background: ${isLpost ? 'rgb(35, 35, 35)' : 'rgb(220, 220, 220)'} !important;
}
.editdiv {
  filter: ${isLpost ? 'none' : 'invert(100%) hue-rotate(180deg)'} !important;
  color: white !important;
}
  .s-bd2 {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }
`;
    (document.head || document.documentElement).appendChild(styleEl);

    if (isLpost) {
      const fixEmoji = () => {
        document.querySelectorAll('.bcmtlstf.s-fc4.itag').forEach(el => {
          if (el.dataset.emojiFixed) return;
          el.dataset.emojiFixed = '1';
          const text = el.textContent.replace(/[\s\u00a0]/g, '');
          const nonEmoji = text.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '');
          if (nonEmoji.length === 0 && text.length > 0) {
            el.style.setProperty('filter', 'invert(100%) hue-rotate(180deg)', 'important');
          } else {
            const html = el.innerHTML;
            const newHtml = html.replace(
              /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu,
              '<span style="filter: invert(100%) hue-rotate(180deg); display: inline-block;">$1</span>'
            );
            if (newHtml !== html) el.innerHTML = newHtml;
          }
        });
      };
      fixEmoji();
      emojiObserver = new MutationObserver(fixEmoji);
      emojiObserver.observe(document.body, { childList: true, subtree: true });
    }
  };

  const removeDark = () => {
    clearEmojiFix();
    if (styleEl) { styleEl.remove(); styleEl = null; }
  };

  const checkDark = (s) => {
    const mode = s?.darkMode?.mode || 'off';
    const isDark = mode === 'manual' ||
      (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      if (document.head) setTimeout(applyDark, 300);
      else document.addEventListener('DOMContentLoaded', () => setTimeout(applyDark, 300));
    } else {
      removeDark();
    }
  };

  chrome.storage.local.get('lc_settings_v1', (res) => {
    checkDark(res['lc_settings_v1'] || {});
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['lc_settings_v1']) {
      checkDark(changes['lc_settings_v1'].newValue || {});
    }
  });

  /* 评论区 iframe 分支到此为止，不执行主帧主逻辑 */
  return;
  }
  /* ============================================================
   * 以下仅主帧执行 —— content.js 主逻辑
   * ============================================================ */
  (() => {
  "use strict";

  /* ---------- FOUC 防止：页面加载前隐藏 ---------- */
  const hideStyle = document.createElement("style");
  hideStyle.textContent = "html { visibility: hidden !important; }";
  (document.head || document.documentElement).appendChild(hideStyle);

  // 300ms 后强制显示，防止脚本出错导致页面永远隐藏
  const foucTimeout = setTimeout(() => {
    if (hideStyle.parentNode) hideStyle.remove();
  }, 300);

  let foucCleared = false;
  function clearFouc() {
    if (!foucCleared) {
      clearTimeout(foucTimeout);
      if (hideStyle.parentNode) hideStyle.remove();
      foucCleared = true;
    }
  }

  const STYLE_ID = "lc-style";
  const FONT_ID = "lc-font-face";
  const BG_ID = "lc-bg";

  /* ---------- 即时应用缓存样式（防止FOUC）---------- */
  const CACHE_KEY = "lc_css_cache";
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(el);
    el.textContent = cached;
    clearFouc();
  }

  window.settings = LC_clone(LC_DEFAULTS);

  /* ---------- Emoji 保护（深色模式下抵消反色）---------- */
  const EMOJI_REGEX =
    /(?:[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{00A9}\u{00AE}\u{2122}\u{3030}\u{303D}\u{3297}\u{3299}]|[\u{FE0F}]|[\u{200D}]|[\u{E0020}-\u{E007F}]|[\u{1F7E0}-\u{1F7EB}]|[\u{1FA70}-\u{1FAFF}]|[\u{2B50}\u{2B55}]|[\u{231A}-\u{231B}]|[\u{23F0}-\u{23F3}]|[\u{2728}]|[\u{274C}\u{274E}]|[\u{2753}-\u{2757}]|[\u{2763}\u{2764}]|[\u{2795}-\u{2797}]|[\u{27B0}\u{27BF}]|[\u{25AA}-\u{25AB}]|[\u{25B6}\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}])/gu;

  function protectEmojis(force) {
    if (!settings.enabled || !isDarkMode()) return;

    // 批量管理页：.g-bdc 不在全局 filter 反色范围内，
    // 反向 filter 会把正常 emoji 变暗，跳过保护
    if (document.body.classList.contains("p-body7")) return;

    const skipTags = new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "IFRAME",
      "TEXTAREA",
      "INPUT",
    ]);

    /* 扫描范围：applyAll（force=true）全页扫一次；observer 链只扫
       本轮新增节点（lcPendingNodes），队列为空直接返回——
       全页 TreeWalker 每批变异都跑是暗色卡顿的根因（探针实证） */
    let roots;
    if (force) {
      roots = [document.querySelector("#application") || document.body];
    } else {
      if (!lcPendingNodes.length) return;
      roots = lcPendingNodes.splice(0);
    }

    roots.forEach((root) => {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (!node.textContent || !EMOJI_REGEX.test(node.textContent)) {
              return NodeFilter.FILTER_REJECT;
            }
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest('.lc-emoji-wrap, [contenteditable="true"]'))
              return NodeFilter.FILTER_REJECT;
            if (skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        },
        false,
      );

      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);

      nodes.forEach((textNode) => {
        const text = textNode.textContent;
        EMOJI_REGEX.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = EMOJI_REGEX.exec(text)) !== null) {
          const idx = match.index;
          if (idx > lastIndex) {
            fragment.appendChild(
              document.createTextNode(text.slice(lastIndex, idx)),
            );
          }
          const span = document.createElement("span");
          span.className = "lc-emoji-wrap";
          span.textContent = match[0];
          fragment.appendChild(span);
          lastIndex = idx + match[0].length;
        }

        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.parentNode.replaceChild(fragment, textNode);
      });
    });
  }

  /* ---------- 安全检查函数（防止恶意代码注入）---------- */
  function sanitizeColor(val) {
    if (val === "" || val === null || val === undefined) return "";
    if (/^#[0-9a-fA-F]{6}$/.test(val)) return val;
    if (/^#[0-9a-fA-F]{3}$/.test(val)) return val;
    return "#666666";
  }
  function sanitizeFont(val) {
    if (!val) return "";
    return LC_normalizeFontFamily(
      String(val).replace(/[;{}@<>"`\\]/g, "").trim()
    );
  }
  function sanitizeDataUrl(val) {
    if (!val) return "";
    if (val.startsWith("data:image/") && !val.includes('"')) return val;
    return "";
  }
  function sanitizeNumber(val, min, max, def) {
    const n = Number(val);
    if (isNaN(n)) return def;
    return Math.max(min, Math.min(max, n));
  }
  /* ---------- 工具函数 ---------- */
  function patternCSS(type, fg, bg, size) {
    const s = `${size}px`;
    const base = bg === "transparent" ? "" : `background-color:${bg};`;
    switch (type) {
      case "grid":
        return (
          base +
          `background-image:linear-gradient(${fg} 1px,transparent 1px),linear-gradient(90deg,${fg} 1px,transparent 1px);background-size:${s} ${s};`
        );
      case "dots": {
        const r = Math.max(1.5, size / 14);
        return (
          base +
          `background-image:radial-gradient(${fg} ${r}px,transparent ${r + 0.6}px);background-size:${s} ${s};`
        );
      }
      case "stripes":
        return `background:repeating-linear-gradient(45deg,${bg === "transparent" ? "transparent" : bg},${bg === "transparent" ? "transparent" : bg} ${s},${fg} ${s},${fg} calc(${s} * 2));`;
      default:
        return base;
    }
  }

  /* ---------- 背景层 ---------- */
  function layer(id, z) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      (document.body || document.documentElement).appendChild(el);
    }
    el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${z};`;
    return el;
  }
  function removeLayer(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  /* ---------- 字体 ---------- */
  /* 字体不再打包二进制：预置项只把字体名填进面板输入框，用户自行安装到系统。
     下面仅保留"自定义字体文件直接嵌入"的通道（预留，当前面板无入口，未接线）。 */
  function applyFontFace() {
    let el = document.getElementById(FONT_ID);
    const f = settings.font;
    const rules = [];
    if (settings.enabled && f.embedDataUrl && f.embedName) {
      rules.push(
        `@font-face{font-family:"${f.embedName}";src:url("${f.embedDataUrl}");font-display:swap;}`,
      );
    }
    if (!rules.length) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = FONT_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = rules.join("\n");
  }

  function activeFontFamily() {
    const f = settings.font;
    /* 用户在 popup 状态条点了「停用」：回系统默认字体，字体名列表保留 */
    if (f.off) return "";
    const stack = [];
    if (f.embedName && f.embedDataUrl) stack.push(`"${f.embedName}"`);
    if (f.family) {
      /* 未加引号的 family 名含括号/空格等字符时是非法 CSS，整条声明会被浏览器
         丢弃（華康超明體(P) 实证：状态条显示生效中但页面回默认字体），所以
         逐个名字加引号；CSS generic 关键字不能加引号（加了会变成"同名字体"） */
      for (let name of String(f.family).split(",")) {
        name = name.trim();
        if (!name) continue;
        stack.push(
          /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(sans-)?serif|ui-monospace)$/i.test(name)
            ? name
            : `"${name}"`
        );
      }
    }
    if (stack.length) stack.push("sans-serif");
    return stack.join(", ");
  }

  /* ── 暗色模式主题色预处理（抵消 filter: invert + hue-rotate(180deg)）── */
  function computeDarkAccent(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return "#666666";
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    // Step 1: hue-rotate(180deg) 矩阵，cos180°=-1, sin180°=0
    const hr = -0.574 * r + 1.43 * g + 0.144 * b;
    const hg = 0.426 * r + 0.43 * g + 0.144 * b;
    const hb = 0.426 * r + 1.43 * g - 0.856 * b;
    // Step 2: invert(100%)
    const ir = 1 - Math.max(0, Math.min(1, hr));
    const ig = 1 - Math.max(0, Math.min(1, hg));
    const ib = 1 - Math.max(0, Math.min(1, hb));
    const toHex = (v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(ir)}${toHex(ig)}${toHex(ib)}`;
  }

  /* ---------- 主 CSS 构建 ---------- */
  /* buildCSS 结果缓存：仅在 settings 版本变化时重建。
     背景：MutationObserver 高频触发 applyStyle()，此前每次都深拷贝整个 settings
     （含装饰图/音效 base64，可达数 MB）并重建数百 KB CSS，导致主线程持续拥塞。 */
  let _cssVersion = 0;
  let _cachedCSS = null;
  let _cachedCSSVer = -1;
  function invalidateCSS() {
    _cssVersion++;
  }

  /* 热路径专用：值没变就不写样式，避免反复弄脏样式引发强制重算 */
  function setStyleIfChanged(el, prop, val, priority) {
    if (
      el.style.getPropertyValue(prop) === val &&
      el.style.getPropertyPriority(prop) === (priority || "")
    )
      return;
    el.style.setProperty(prop, val, priority);
  }

  function buildCSS() {
    if (!settings.enabled) return "";
    if (_cachedCSS !== null && _cachedCSSVer === _cssVersion) return _cachedCSS;

    /* ---------- 安检：复制并净化用户设置 ----------
       decorations（含装饰图 dataUrl、互动音效 soundFile）体积大且 buildCSS
       不使用，剔除后再深拷贝，避免每次克隆数 MB 字符串 ---------- */
    const s = JSON.parse(
      JSON.stringify({ ...settings, decorations: [] }),
    );
    if (s.theme) s.theme.accent = sanitizeColor(s.theme.accent);
    if (s.background) {
      if (s.background.color)
        s.background.color = sanitizeColor(s.background.color);
      if (s.background.gradient) {
        s.background.gradient.from = sanitizeColor(s.background.gradient.from);
        s.background.gradient.to = sanitizeColor(s.background.gradient.to);
        s.background.gradient.angle = sanitizeNumber(
          s.background.gradient.angle,
          0,
          360,
          135,
        );
      }
      if (s.background.pattern) {
        s.background.pattern.fg = sanitizeColor(s.background.pattern.fg);
        s.background.pattern.bg = sanitizeColor(s.background.pattern.bg);
        s.background.pattern.size = sanitizeNumber(
          s.background.pattern.size,
          1,
          200,
          20,
        );
        if (!["grid", "dots", "stripes"].includes(s.background.pattern.type))
          s.background.pattern.type = "grid";
      }
      if (s.background.image) {
        s.background.image.dataUrl = sanitizeDataUrl(
          s.background.image.dataUrl,
        );
        s.background.image.blur = sanitizeNumber(
          s.background.image.blur,
          0,
          50,
          0,
        );
      }
      s.background.contentAlpha = sanitizeNumber(
        s.background.contentAlpha,
        0,
        100,
        100,
      );
    }
    if (s.card) {
      s.card.radius = sanitizeNumber(s.card.radius, 0, 100, 16);
      s.card.gap = sanitizeNumber(s.card.gap, 15, 30, 15);
    }
    if (s.font) {
      s.font.scale = sanitizeNumber(s.font.scale, 50, 200, 100);
      s.font.family = sanitizeFont(s.font.family);
      s.font.embedName = sanitizeFont(s.font.embedName);
      /* 迁移：早期版本由 preset 直接指定字体，现已改为"预置只填入字体名"。
         老配置若只选了预置而没填名字，把预置名补进 family，避免字体静默失效。 */
      if (!s.font.family && s.font.preset) {
        const p = LC_FONT_PRESETS.find((x) => x.key === s.font.preset);
        if (p && p.family) s.font.family = p.family;
      }
    }
    if (s.darkMode) {
      s.darkMode.brightness = sanitizeNumber(
        s.darkMode.brightness,
        10,
        150,
        90,
      );
    }
    if (s.gtotop) {
      s.gtotop.imageDataUrl = sanitizeDataUrl(s.gtotop.imageDataUrl);
      s.gtotop.imageSize = sanitizeNumber(s.gtotop.imageSize, 10, 300, 100);
    }
    /* ---------- 安检结束 ---------- */

    const out = [];
    const fr = (s.card.radius || 16) + "px";
    const gap = (s.card.gap || 15) + "px";
    const shadow = s.card.shadow
      ? "0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)"
      : "none";
    const longpostShadow = s.card.shadow
      ? "0 4px 20px rgba(0,0,0,0.15)"
      : "none";
    /* 悬停轻微放大（面板「卡片 › 卡片外观 › 悬停轻微放大」，默认开）。
       关掉时本管线的通用兜底卡面 `::before` 不再生成 :hover 的 scale；
       气泡卡那条（缩放挂在整卡上）由 ensureBubbleCards 的 scopes[0].hover
       同源控制，两处都读同一个字段。
       注意只关「放大」：悬停投影是独立的悬停反馈，保留。 */
    const cardHoverZoom = s.card.hoverZoom !== false;

    /* ========== 卡片出现动画关键帧 ========== */
    const anim = settings.card.animation || "none";
    const duration = (settings.card.duration || 500) / 1000; // 转成秒
    const stagger = settings.card.stagger !== false;
    const staggerDelay = (settings.card.staggerDelay || 80) / 1000; // 转成秒

    if (anim !== "none") {
      // 关键帧定义
      let keyframes = "";
      switch (anim) {
        case "floatUp":
          keyframes = `
            @keyframes lc-card-appear {
              from { opacity: 0; transform: translateY(24px); }
            }`;
          break;
        case "fadeIn":
          keyframes = `
            @keyframes lc-card-appear {
              from { opacity: 0; }
            }`;
          break;
        case "scaleIn":
          keyframes = `
            @keyframes lc-card-appear {
              from { opacity: 0; transform: scale(0.92); }
            }`;
          break;
        case "slideIn":
          keyframes = `
            @keyframes lc-card-appear {
              from { opacity: 0; transform: translateX(-30px); }
            }`;
          break;
      }

      // 卡片初始状态：隐藏（等待滚动触发）
      out.push(`
        ${keyframes}
        /* 卡片初始状态：不可见，等待 Intersection Observer 触发 */
        .m-mlist:not(.lc-card-ready) {
          opacity: 0;
        }
        /* 动画播放后的状态：终态写在基类（opacity:1、transform 缺省 none），
           关键帧只定义 from。backwards 只填延迟期（防交错延迟闪终态），
           播完不保留任何填帧值——不能用 forwards！Chrome 对 forwards 填帧
           会永久保留合成层 transform 节点（即使终点是 none），该渲染面会让
           卡面 backdrop-filter 采不到页面背景（浅色磨砂失效） */
        .m-mlist.lc-card-visible {
          opacity: 1;
          animation: lc-card-appear ${duration}s cubic-bezier(0.4, 0, 0.2, 1) backwards;
        }
      `);
    }

    /* ========== 全局弹窗（保存确认等）圆角 + 浅色毛玻璃 ========== */
    out.push(LC_CSS.light.s4715({ fr, s, longpostShadow, computeDarkAccent }));

    /* ── 全局背景透明化 ── */
    if (s.background.mode !== "off") {
      out.push(`
        html, body,
        .g-bd, .g-bdc, #main, #rside { background-color: transparent !important; }
      `);
    } else {
      /* 背景关闭时：恢复 Lofter 原版背景 */
      out.push(`
        /* 确保新版页面容器不强制透明，让原版背景显示 */
        #application.lofter-root-container,
        #application.lofter-root-container > [class*="box-web"] {
          background: initial !important;
        }
        /* 恢复背景图容器链 */
        #application.lofter-root-container > [class*="box-web"] > [class*="IiOL8wMgNi6Lv9LPtNvjMQ"] {
          background: transparent !important;
        }
        #application.lofter-root-container > [class*="box-web"] > [class*="IiOL8wMgNi6Lv9LPtNvjMQ"] > [class*="rp2Too2wX46bs0iA6tkUoA"] {
          background-size: cover !important;
          background-position: center !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: -1 !important;
        }
      `);
    }

    /* ============================================================
     * 新版 React 页面覆盖（设置页/合集页/搜索页等）
     * 这些页面使用 #application.lofter-root-container 结构
     * 与旧版 #main/#rside 页面完全隔离
     * ============================================================ */
    if (s.background.mode !== "off") {
      out.push(LC_CSS.light.s5016({ fr, s }));
    }

    /* 精品连载页：浅色模式主题色细节（写在暗色块之前，暗色规则靠后覆盖）。
       站点 create.f32c 样式表用 #application.lofter-root-container 前缀 +
       !important，特异性 (1,1,x)，所以这里必须带 id 前缀才能压住 */
    {
      const A = s.theme.accent || "#667eea";
      const SCOPE = "#application.lofter-root-container";
      out.push(LC_CSS.light.s5081({ SCOPE, A }));
    }

    /* ===== 创作者中心页（style-14_XXXX 系，数字随机轮换须通配）=====
       控制台两轮取证：挡背景图的是 #application 直下的 GCOIK 层
       （rgb(250,250,250) 实底）；三块内容实际全透明（白卡视觉来自
       挡板），毛玻璃直接打在块容器上；侧栏选中项修饰类 lgj+...，
       图标 svg currentColor（站点写死青绿 78,183,186） */
    {
      const A = s.theme.accent || "#667eea";
      const SCOPE = "#application.lofter-root-container";
      const dark = isDarkMode();
      out.push(LC_CSS.light.s5477({ SCOPE, dark, fr, A }));
    }

    /* ── 黑名单设置页：圆角毛玻璃布局（浅色值；暗色的色值在下方反色区覆盖）── */
    out.push(LC_CSS.light.s5615());
    /* ── 账号设置页：主题色适配（浅色值；暗色在下方块再统一）──
       路径实证：/front/homesite/user-setting（探针 2026-09-20），兼容 /setting */
    const onSettingPage = /\/(setting|front\/homesite\/user-setting)\b/.test(
      location.pathname,
    );
    if (onSettingPage) {
      const SA = s.theme.accent || "#667eea";
      out.push(`
        /* 站内通知/版权/性别勾选框：rc-checkbox 结构（input + .rc-checkbox-inner） */
        .rc-checkbox-input:checked + .rc-checkbox-inner {
          background-color: ${SA} !important;
          border-color: ${SA} !important;
        }
        .rc-checkbox-input:focus + .rc-checkbox-inner {
          border-color: ${SA} !important;
        }
        /* 「绑定邮箱账号/查看说明/修改兴趣」旁箭头：站点把 #4EB7BA
           硬编码在 path 的 stroke 属性上，CSS stroke 属性可覆盖表示属性 */
        svg path[stroke="#4EB7BA"] { stroke: ${SA} !important; }
        /* 保存键：主色按钮中唯一不带 <a> 子元素的（黑名单/标签屏蔽/注销
           按钮同类名但内含链接，浅色下保持站点灰底不动） */
        button[class*="buttonColorPrimary"]:not(:has(a)) {
          background: ${SA} !important;
          border-color: ${SA} !important;
          color: #fff !important;
        }
      `);
    }
    if (isDarkMode()) {
      out.push(LC_CSS.dark.s5725({ s, computeDarkAccent }));
    }

    /* JS 修复："存为草稿"按钮样式（浅色/暗色）+ 悬停放大 */
    {
      setTimeout(() => {
        /* hex 转 rgba 辅助函数 */
        const hexToRgba = (hex, alpha) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        const accent = s.theme.accent || '#667eea';

        const fixSaveDraftBtn = () => {
          const isDark = isDarkMode();
          /* 发布弹窗卡片背景：只修改 .rc-dialog-content，不影响外部遮罩 */
          document.querySelectorAll('.rc-dialog-content').forEach(card => {
            if (isDark) {
              card.style.setProperty('background', '#1a1a1a', 'important');
              card.style.setProperty('background-color', '#1a1a1a', 'important');

              /* 修复内部白色背景元素 */
              /* 1. 昵称容器 */
              card.querySelectorAll('div[class*="urcGfQnlhfmfvALBTFtbGg"]').forEach(el => {
                el.style.setProperty('background', '#1a1a1a', 'important');
                el.style.setProperty('background-color', '#1a1a1a', 'important');
                /* 昵称文字改为浅色 */
                const h5 = el.querySelector('h5');
                if (h5) {
                  h5.style.setProperty('color', '#fff', 'important');
                }
              });
              /* 2. 标签输入框 */
              card.querySelectorAll('input[class*="w-dQ9b9jTYV3mEgugQlGGw"]').forEach(el => {
                el.style.setProperty('background', 'rgba(255, 255, 255, 0.08)', 'important');
                el.style.setProperty('background-color', 'rgba(255, 255, 255, 0.08)', 'important');
                el.style.setProperty('border-color', 'rgba(255, 255, 255, 0.08)', 'important');
                el.style.setProperty('color', '#fff', 'important');
              });
              /* 2b. 标题输入框：暗色模式 */
              card.querySelectorAll('input[class*="GW6o7hf2sxDrwBGIfCv1fw"]').forEach(el => {
                el.style.setProperty('background', 'rgba(255, 255, 255, 0.08)', 'important');
                el.style.setProperty('background-color', 'rgba(255, 255, 255, 0.08)', 'important');
                el.style.setProperty('border-color', 'rgba(255, 255, 255, 0.15)', 'important');
                el.style.setProperty('color', '#fff', 'important');
              });
              /* 3. 取消/预览按钮：深灰底而不是纯黑 */
              card.querySelectorAll('button.lc-dialog-btn-cancel').forEach(el => {
                el.style.setProperty('background', '#2a2a2a', 'important');
                el.style.setProperty('background-color', '#2a2a2a', 'important');
                el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.08)', 'important');
                el.style.setProperty('color', '#e0e0e0', 'important');
              });
              /* 3b. 其他设置项边框（加入合集/回礼设置/创作声明等）：调暗 */
              card.querySelectorAll('.rc-dialog-body div[role="button"], .rc-dialog-body [class*="uQThfn8Id0NabYNky5E9WA"] > div').forEach(el => {
                /* 「草稿已保存」状态行不参与边框压暗（暗色下要与编辑区
                 * 融为一体，见统一弹窗暗色基础豁免规则；也防明暗切换
                 * 来回在内联样式上残留边框） */
                if (String(el.className).indexOf('dl+rqIrnR1qGO7K68aqRXQ') !== -1 ||
                    String(el.className).indexOf('_5+z9dJrZIs23YiDIxPMWgw') !== -1) return;
                const style = getComputedStyle(el);
                if (style.borderColor.includes('255, 255, 255') || style.borderColor.includes('237, 237, 237')) {
                  el.style.setProperty('border-color', 'rgba(255, 255, 255, 0.08)', 'important');
                }
              });
              /* 4. 工具栏容器 */
              card.querySelectorAll('div[class*="cSDVDhc-EThw0HXGKoiv4g"]').forEach(el => {
                el.style.setProperty('background', '#1a1a1a', 'important');
                el.style.setProperty('background-color', '#1a1a1a', 'important');
              });
              /* 5. "发布文字"标题：暗色模式白色字 */
              card.querySelectorAll('h3[class*="_9lTkmRbhaNRnKCEqE51NfA"]').forEach(el => {
                el.style.setProperty('color', '#fff', 'important');
              });
              /* 5b. "定时发布"标题：双向切换 */
              card.querySelectorAll('div[class*="eMO8PZa97JlexfCPmjMIrw"]').forEach(el => {
                if (isDark) {
                  el.style.setProperty('background', 'transparent', 'important');
                  el.style.setProperty('background-color', 'transparent', 'important');
                  el.style.setProperty('color', '#fff', 'important');
                } else {
                  el.style.setProperty('background', 'transparent', 'important');
                  el.style.setProperty('background-color', 'transparent', 'important');
                  el.style.setProperty('color', '#333', 'important');
                }
              });
              /* 5c. rc-dialog-header 和 rc-dialog-title：去除白色背景 */
              card.querySelectorAll('.rc-dialog-header, .rc-dialog-title, header').forEach(el => {
                el.style.setProperty('background', 'transparent', 'important');
                el.style.setProperty('background-color', 'transparent', 'important');
              });
              /* 5c. 定时发布日期输入框：双向切换 */
              card.querySelectorAll('.rc-dialog-header input, .rc-dialog-title input, input[title=""]').forEach(el => {
                if (isDark) {
                  el.style.setProperty('background', 'rgba(255, 255, 255, 0.08)', 'important');
                  el.style.setProperty('background-color', 'rgba(255, 255, 255, 0.08)', 'important');
                  el.style.setProperty('border-color', 'rgba(255, 255, 255, 0.15)', 'important');
                  el.style.setProperty('color', '#fff', 'important');
                } else {
                  el.style.setProperty('background', 'rgba(0, 0, 0, 0.03)', 'important');
                  el.style.setProperty('background-color', 'rgba(0, 0, 0, 0.03)', 'important');
                  el.style.setProperty('border-color', 'rgba(0, 0, 0, 0.08)', 'important');
                  el.style.setProperty('color', '#333', 'important');
                }
              });
            } else {
              /* 浅色模式：恢复白色背景 */
              card.style.setProperty('background', '#fff', 'important');
              card.style.setProperty('background-color', '#fff', 'important');

              /* 恢复内部元素白色背景 */
              /* 1. 昵称容器 */
              card.querySelectorAll('div[class*="urcGfQnlhfmfvALBTFtbGg"]').forEach(el => {
                el.style.setProperty('background', '#fff', 'important');
                el.style.setProperty('background-color', '#fff', 'important');
                /* 昵称文字恢复深色 */
                const h5 = el.querySelector('h5');
                if (h5) {
                  h5.style.setProperty('color', '#333', 'important');
                }
              });
              /* 2. 标签输入框：文字改更深的灰色 */
              card.querySelectorAll('input[class*="w-dQ9b9jTYV3mEgugQlGGw"]').forEach(el => {
                el.style.setProperty('background', 'rgba(0, 0, 0, 0.05)', 'important');
                el.style.setProperty('background-color', 'rgba(0, 0, 0, 0.05)', 'important');
                el.style.setProperty('border-color', 'rgba(0, 0, 0, 0.1)', 'important');
                el.style.setProperty('color', '#222', 'important');
              });
              /* 2b. 标题输入框：浅色模式恢复正常样式 */
              card.querySelectorAll('input[class*="GW6o7hf2sxDrwBGIfCv1fw"]').forEach(el => {
                el.style.setProperty('background', 'rgba(0, 0, 0, 0.03)', 'important');
                el.style.setProperty('background-color', 'rgba(0, 0, 0, 0.03)', 'important');
                el.style.setProperty('border-color', 'rgba(0, 0, 0, 0.08)', 'important');
                el.style.setProperty('color', '#333', 'important');
              });
              /* 3. 取消/预览按钮：浅灰底而不是纯白 */
              card.querySelectorAll('button.lc-dialog-btn-cancel').forEach(el => {
                el.style.setProperty('background', '#f0f0f0', 'important');
                el.style.setProperty('background-color', '#f0f0f0', 'important');
                el.style.setProperty('border', '1px solid rgba(0, 0, 0, 0.08)', 'important');
                el.style.setProperty('color', '#333', 'important');
              });
              /* 3b. 其他设置项边框（加入合集/回礼设置/创作声明等）：调暗 */
              card.querySelectorAll('.rc-dialog-body div[role="button"], .rc-dialog-body [class*="uQThfn8Id0NabYNky5E9WA"] > div').forEach(el => {
                /* 「草稿已保存」状态行不参与边框压暗（暗色下要与编辑区
                 * 融为一体，见统一弹窗暗色基础豁免规则；也防明暗切换
                 * 来回在内联样式上残留边框） */
                if (String(el.className).indexOf('dl+rqIrnR1qGO7K68aqRXQ') !== -1 ||
                    String(el.className).indexOf('_5+z9dJrZIs23YiDIxPMWgw') !== -1) return;
                const style = getComputedStyle(el);
                if (style.borderColor.includes('255, 255, 255') || style.borderColor.includes('237, 237, 237')) {
                  el.style.setProperty('border-color', 'rgba(255, 255, 255, 0.08)', 'important');
                }
              });
              /* 4. 工具栏容器 */
              card.querySelectorAll('div[class*="cSDVDhc-EThw0HXGKoiv4g"]').forEach(el => {
                el.style.setProperty('background', '#fff', 'important');
                el.style.setProperty('background-color', '#fff', 'important');
              });
              /* 5. "发布文字"标题：浅色模式深色字 */
              card.querySelectorAll('h3[class*="_9lTkmRbhaNRnKCEqE51NfA"]').forEach(el => {
                el.style.setProperty('color', '#333', 'important');
              });
            }

            /* 创建合集弹窗输入框适配（合集名称 / 合集简介） */
            lcFixCollectionFields();
          });
          /* 写文章弹窗下拉栏：容器背景 */
          document.querySelectorAll('[data-selector-options-box="true"]').forEach(box => {
            const parent = box.parentElement;
            if (parent) {
              parent.style.setProperty('background', 'transparent', 'important');
              parent.style.setProperty('background-color', 'transparent', 'important');
            }
            if (isDark) {
              box.style.setProperty('background', '#1a1a1a', 'important');
              box.style.setProperty('background-color', '#1a1a1a', 'important');
            } else {
              box.style.setProperty('background', '#fff', 'important');
              box.style.setProperty('background-color', '#fff', 'important');
            }
          });
          /* 下拉栏选项样式：单独 style 标签注入 */
          let dropdownStyle = document.getElementById('lc-dropdown-style');
          if (!dropdownStyle) {
            dropdownStyle = document.createElement('style');
            dropdownStyle.id = 'lc-dropdown-style';
            document.head.appendChild(dropdownStyle);
          }
          const dropdownAccent = s.theme.accent || '#667eea';
          dropdownStyle.textContent = `
            html body [data-selector-option-item="true"] {
              color: ${isDark ? '#e0e0e0' : '#333'} !important;
              background: transparent !important;
            }
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"],
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"]:hover,
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"]:focus,
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"]:active {
              color: ${dropdownAccent} !important;
              background: transparent !important;
            }
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"] div,
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"] span,
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"]:hover div,
            html body [data-selector-option-item="true"][class*="nCO8jkU5S5uhOeJ4R0WfeA"]:hover span {
              color: ${dropdownAccent} !important;
            }
          `;
          /* tag 选择下拉栏：背景色修复（包含内部 tag 项） */
          document.querySelectorAll('div[class*="rQxQaXg3m0HmPXj3sVzp9Q"]').forEach(box => {
            if (isDark) {
              box.style.setProperty('background', '#1a1a1a', 'important');
              box.style.setProperty('background-color', '#1a1a1a', 'important');
              box.querySelectorAll('div[class*="YpNH-NsaAmz3y7ucJaHUKQ"]').forEach(tag => {
                tag.style.setProperty('background', '#2a2a2a', 'important');
                tag.style.setProperty('background-color', '#2a2a2a', 'important');
                tag.style.setProperty('color', '#e0e0e0', 'important');
              });
            } else {
              box.style.setProperty('background', '#fff', 'important');
              box.style.setProperty('background-color', '#fff', 'important');
              box.querySelectorAll('div[class*="YpNH-NsaAmz3y7ucJaHUKQ"]').forEach(tag => {
                tag.style.setProperty('background', '#f0f0f0', 'important');
                tag.style.setProperty('background-color', '#f0f0f0', 'important');
                tag.style.setProperty('color', '#333', 'important');
              });
            }
          });
          /* 礼物设置弹窗：毛玻璃背景，模式切换时更新 */
document.querySelectorAll('main[class*="lc-gift-processed"]').forEach(card => {
  if (isDark) {
    card.style.setProperty('background', 'rgba(26, 26, 26, 0.85)', 'important');
    card.style.setProperty('background-color', 'rgba(26, 26, 26, 0.85)', 'important');
  } else {
    card.style.setProperty('background', 'rgba(255, 255, 255, 0.85)', 'important');
    card.style.setProperty('background-color', 'rgba(255, 255, 255, 0.85)', 'important');
  }
  card.style.setProperty('backdrop-filter', 'blur(20px) saturate(180%)', 'important');
  card.style.setProperty('-webkit-backdrop-filter', 'blur(20px) saturate(180%)', 'important');
  /* 标题颜色：适配暗色（header 直接包含文字或包含 span） */
  const header = card.querySelector('header');
  if (header) {
    /* header 直接包含文字（无 span） */
    if (header.textContent.trim() && !header.querySelector('span')) {
      header.style.setProperty('color', isDark ? '#fff' : '#333', 'important');
    }
    /* header 里的 span */
    const title = header.querySelector('span');
    if (title) {
      title.style.setProperty('color', isDark ? '#fff' : '#333', 'important');
    }
    /* 关闭按钮 SVG */
    const svg = header.querySelector('svg');
    if (svg) {
      svg.style.setProperty('color', isDark ? '#fff' : '#333', 'important');
      const paths = svg.querySelectorAll('path');
      paths.forEach(path => {
        path.style.setProperty('fill', isDark ? '#fff' : '#2E2E2E', 'important');
      });
    }
  }
  /* 勾选圆圈（彩蛋/隐藏结局/赠礼）：主题色 */
  card.querySelectorAll('svg[class*="fCyaqohAW9-BEP1Py9SmAw"]').forEach(svg => {
    svg.style.setProperty('color', accent, 'important');
  });
  /* 新建回礼方案按钮：主题色 */
  card.querySelectorAll('button[class*="_2L7u24zJTfYlRWXFEEz0-w"]').forEach(btn => {
    btn.style.setProperty('color', accent, 'important');
    btn.style.setProperty('border-color', accent, 'important');
    btn.style.setProperty('background', 'transparent', 'important');
    btn.style.setProperty('background-color', 'transparent', 'important');
  });
  /* 按钮：根据文字区分"确定"（主题色）和"取消"（灰色） */
  card.querySelectorAll('button[class*="lc-gift-btn-cancel"], button[class*="lc-gift-btn-ok"]').forEach(btn => {
    const text = btn.textContent.trim();
    if (text === '确定' || text === '确认') {
      /* 确定按钮：主题色 */
      btn.style.setProperty('background', accent, 'important');
      btn.style.setProperty('background-color', accent, 'important');
      btn.style.setProperty('color', '#fff', 'important');
      btn.style.setProperty('border', '1px solid ' + accent, 'important');
    } else {
      /* 取消按钮：灰色 */
      btn.style.setProperty('background', isDark ? '#2a2a2a' : '#f0f0f0', 'important');
      btn.style.setProperty('background-color', isDark ? '#2a2a2a' : '#f0f0f0', 'important');
      btn.style.setProperty('color', isDark ? '#e0e0e0' : '#333', 'important');
      btn.style.setProperty('border', '1px solid ' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'), 'important');
    }
  });
  /* 输入回礼内容框：适配深色 */
  card.querySelectorAll('textarea[class*="rSh02TGsliQWlNQIQwDy5w"]').forEach(textarea => {
    textarea.style.setProperty('background', isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', 'important');
    textarea.style.setProperty('background-color', isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', 'important');
    textarea.style.setProperty('color', isDark ? '#fff' : '#333', 'important');
    textarea.style.setProperty('border-color', isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', 'important');
  });
  /* 小标签：适配深色 */
  card.querySelectorAll('div[class*="tHMv-2zQ6LOrJ4P8wCJ0zQ"]').forEach(tag => {
    tag.style.setProperty('background', isDark ? '#2a2a2a' : '#f0f0f0', 'important');
    tag.style.setProperty('background-color', isDark ? '#2a2a2a' : '#f0f0f0', 'important');
    tag.style.setProperty('color', isDark ? '#e0e0e0' : '#333', 'important');
  });
});
          /* 定时发布日历面板：根据模式切换背景色（覆盖所有子面板） */
          document.querySelectorAll('.lofter-common-date-picker-panel, .lofter-common-date-picker-container, .lofter-common-date-picker-date-panel, .lofter-common-date-picker-datetime-panel, .lofter-common-date-picker-body, .lofter-common-date-picker-content').forEach(panel => {
            if (isDark) {
              panel.style.setProperty('background', 'rgba(35, 35, 42, 0.98)', 'important');
              panel.style.setProperty('background-color', 'rgba(35, 35, 42, 0.98)', 'important');
            } else {
              panel.style.setProperty('background', '#fff', 'important');
              panel.style.setProperty('background-color', '#fff', 'important');
            }
          });
          /* 时间选择器数字：浅色切深色时保持可见 */
          document.querySelectorAll('.lofter-common-date-picker-time-panel, .lofter-common-date-picker-time-panel *').forEach(el => {
            if (el.textContent.trim() && !el.children.length) {
              el.style.setProperty('color', isDark ? '#e0e0e0' : '#333', 'important');
            }
          });
          /* 时间选择器悬停背景：深灰底 */
          document.querySelectorAll('.lofter-common-date-picker-time-panel [class*="cell"], .lofter-common-date-picker-time-panel [class*="item"], .lofter-common-date-picker-time-panel li').forEach(el => {
            el.addEventListener('mouseenter', () => {
              el.style.setProperty('background', isDark ? '#2a2a2a' : '#f0f0f0', 'important');
            });
            el.addEventListener('mouseleave', () => {
              el.style.setProperty('background', 'transparent', 'important');
            });
          });
          /* "允许他人转载至LOFTER"勾选圆圈：跟随主题色 */
          document.querySelectorAll('svg[class*="_39-EL-wmeTU07JWbLZqUvg"]').forEach(svg => {
            svg.style.setProperty('color', accent, 'important');
          });
          /* 定时发布"确定"按钮：跟随主题色 */
          document.querySelectorAll('button.lofter-common-date-picker-ok, .lofter-common-date-picker-ok button, li.lofter-common-date-picker-ok button').forEach(btn => {
            btn.style.setProperty('background', accent + ' !important', 'important');
            btn.style.setProperty('background-color', accent + ' !important', 'important');
            btn.style.setProperty('color', '#fff !important', 'important');
          });
          document.querySelectorAll('button, div[role="button"], a[role="button"]').forEach(btn => {
            if (btn.textContent.trim() === '存为草稿') {
              if (isDark) {
                /* 暗色模式：黑底 + 主题色边框和文字 */
                btn.style.setProperty('background', '#1a1a1a', 'important');
                btn.style.setProperty('background-color', '#1a1a1a', 'important');
                btn.style.setProperty('border', '1px solid ' + accent, 'important');
                btn.style.setProperty('color', accent, 'important');
              } else {
                /* 浅色模式：主题色底 + 白色字 */
                btn.style.setProperty('background', accent, 'important');
                btn.style.setProperty('background-color', accent, 'important');
                btn.style.setProperty('border', '1px solid ' + accent, 'important');
                btn.style.setProperty('color', '#fff', 'important');
              }
              btn.style.setProperty('border-radius', '999px', 'important');
              btn.style.setProperty('transition', 'transform 0.2s ease, background-color 0.2s ease', 'important');
              btn.style.setProperty('cursor', 'pointer', 'important');
            }
          });
        };

        /* 悬停放大效果（事件委托，避免重复绑定） */
        if (!window.__saveDraftHoverBound) {
          window.__saveDraftHoverBound = true;
          document.addEventListener('mouseover', (e) => {
            const btn = e.target.closest('button, div[role="button"], a[role="button"]');
            if (btn && btn.textContent.trim() === '存为草稿') {
              btn.style.setProperty('transform', 'scale(1.05)', 'important');
            }
          });
          document.addEventListener('mouseout', (e) => {
            const btn = e.target.closest('button, div[role="button"], a[role="button"]');
            if (btn && btn.textContent.trim() === '存为草稿') {
              btn.style.setProperty('transform', 'scale(1)', 'important');
            }
          });
        }

        fixSaveDraftBtn();
        new MutationObserver(fixSaveDraftBtn).observe(document.body, {
          childList: true,
          subtree: true
        });
      }, 1000);
    }

    /* 新版页面：导航栏 — 强制清除所有层级背景
       注意：本块与老管线 applyNavbar 一样**不看背景开关**——
       背景为「关闭」时（站点默认白底）玻璃依然生效，
       否则同一次点击在两个管线上表现不一致（老管线生效、新管线失效）。 */
    const navHy =
      settings.navbar.hyalite &&
      window.Hyalite &&
      Hyalite.supported();
    if (s.navbar.blur || s.navbar.hyalite) {
      out.push(LC_CSS.light.s6873({ navHy, s, isDarkMode }));
    }

    /* 新版页面：右侧栏模块白底圆角 */
    out.push(`
      #application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"] {
        background-color: rgba(255, 255, 255, 0.95) !important;
        border-radius: ${fr} !important;
        box-shadow: ${shadow} !important;
        border: none !important;
        overflow: hidden !important;
        margin-bottom: 12px !important;
      }
      #application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"]:last-child {
        margin-bottom: 0 !important;
      }
    `);

    /* 新版页面：右侧栏链接悬停轻微放大 */
    out.push(`
      #application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"] a {
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s ease !important;
      }
      #application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"] a:hover {
        transform: scale(1.04) !important;
      }
    `);

    /* 新版页面：查看更多页作者昵称和tag悬停轻微放大 */
    out.push(`
      #application.lofter-root-container [class*="page-web"] a > span:first-of-type {
        display: inline-block !important;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      #application.lofter-root-container [class*="page-web"] a > span:first-of-type:hover {
        transform: scale(1.04) !important;
      }
      #application.lofter-root-container [class*="page-web"] a[href*="/tag/"] {
        display: inline-block !important;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      #application.lofter-root-container [class*="page-web"] a[href*="/tag/"]:hover {
        transform: scale(1.04) !important;
      }
    `);

    /* 新版页面：下拉栏白底圆角+链接悬停轻微放大 */
    out.push(LC_CSS.pages.s7038());

    /* ── 字体 ── */
    const fam = activeFontFamily();
    if (fam) {
      out.push(`
        /* 全局字体 */
        * { font-family: ${fam} !important; }
      `);
    }
    if (s.font.scale !== 100) {
      out.push(LC_CSS.pages.s7086({ s }));
    }

    /* ── 导航栏
   注意：#lofter-top-bar 带有内联 style="background:#1F1F1F"
    必须用 !important 才能覆盖内联样式
       ── */
    if (s.navbar.blur || s.navbar.hyalite) {
      out.push(LC_CSS.light.s7129({ s }));
    }

    /* ── 主题色 ── */
    if (s.theme.accent) {
      const a = s.theme.accent;
      const aHover = `color-mix(in srgb, ${a} 80%, #000)`;
      out.push(LC_CSS.light.s7186({ s, computeDarkAccent, fr, shadow, a, aHover, isDarkMode }));

      /* ── 创建合集「+」：圆形主题色底 + 白色加号 ──
      暗色下由暗色段的本地反向 filter 抵消 #main 反色（浅色无 filter），
      所以这里必须写原始主题色——computeDarkAccent 会双重补偿变暗紫 */
      out.push(LC_CSS.pages.s8094({ s }));
    }

    /* ── 私信页：纯毛玻璃卡（2026-10-03 拍板：无条件生效，不受卡片开关控制；
       圆角仍跟全局圆角设置、投影跟卡片投影开关走）── */
    out.push(LC_CSS.light.s8141({ fr, shadow }));

    /* ── 圆角卡片 ── */
    if (s.card.enabled) {
      out.push(LC_CSS.light.s8189({ fr, shadow, s, gap, cardHoverZoom, isDarkMode, computeDarkAccent }));
    }
    /* ── 隐藏推广内容 ── */
    if (s.tidy.hideAll) {
      out.push(`
    /* APP 二维码 */
    .qr-wrap, [class*="qrcode"],
    #sidebara4darea,
    .m-side-download-tip,
    .g-boxv2.m-side-download-tip,
    #j-tagser-app-down,
    .g-boxv2:has(.erweima),
    /* 创作者广告/达人扶持 */
    [id^="flight"], [id*="flight"],
    .sidebara4darea,
    #lofter-common-page-footer,
    a[href="/darenapply"],
    a[href^="/daren"],
    /* 话题推荐 */
    #activityRecommendbox,
    .m-activityRecommend,
    [id*="activityRecommend"],
    [class*="activityRecommend"],
/* 长文章页推荐文章列表 */
.m-recom .u-post-list,
.m-recom .intro
{ display: none !important; }
  `);
    }

    /* ── 隐藏悬停弹窗 ── */
    if (s.tidy.hideHoverCard) {
      out.push(`
    .w-sel-7,
    .a-w-sel.usercard,
    .a-w-sel[class*="-7"] { display: none !important; }
  `);
    }

    /* ── 悬停弹窗圆角毛玻璃气泡（深浅通用）── */
    const isDark = isDarkMode();
    const popupBg = isDark
      ? "rgba(25, 25, 30, 0.55)"
      : "rgba(255, 255, 255, 0.55)";
    const popupBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
    const popupShadow = isDark
      ? "0 12px 32px rgba(0,0,0,0.45)"
      : "0 12px 32px rgba(0,0,0,0.15)";
    const popupText = isDark ? "rgba(255,255,255,0.9)" : "#333";
    const popupAccent = isDark
      ? s.theme.accent || "#ccc"
      : s.theme.accent || "#666";

    out.push(LC_CSS.light.s10177({ popupBg, popupBorder, popupShadow, isDark, popupText, popupAccent, s }));

    /* 导航栏层级，确保搜索下拉不被遮住 */
    out.push(LC_CSS.light.s10386({ fr, shadow }));

    /* ---------- 导航栏下拉菜单：浅色模式强制白底 ---------- */
    out.push(LC_CSS.light.s10575({ s, isDarkMode, settings }));

    /* 合集“添加文章”弹窗：悬停/勾选跟随主题色（浅暗通用，
       弹窗经 Portal 挂到 body、不在 #main 反色区内，主题色直接写即可） */
    out.push(`
/* 文章卡片悬停（或已勾选）边框跟随主题色——边框画在 post-item 的
   内层混淆 div 上（站点样式 border: 2px solid #16DA01），需穿透到 > div */
.post-item:hover > div,
.post-item:has(.rc-checkbox-checked) > div {
  border-color: ${s.theme.accent || "#667eea"} !important;
}
/* 右下角勾选框选中态跟随主题色 */
span.rc-checkbox.post-check.rc-checkbox-checked .rc-checkbox-inner {
  background-color: ${s.theme.accent || "#667eea"} !important;
  border-color: ${s.theme.accent || "#667eea"} !important;
}
`);

    /* ── 深色模式 ── */
    if (isDarkMode()) {
      /* ---------- 草稿页亮度变量 ---------- */
      const b = (settings.darkMode.brightness || 90) / 100;
      const d = Math.round(28 * b); // 28@100% → 90%时≈25, 50%时≈14, 150%时≈42
      const draftCard = `rgba(${d}, ${d}, ${d + 2}, 0.72)`;
      const draftNav = `rgba(${d}, ${d}, ${d + 2}, 0.75)`;
      const draftMain = `rgba(${d}, ${d}, ${d + 2}, 0.82)`;
      const draftDrop = `rgba(${Math.max(0, d - 2)}, ${Math.max(0, d - 2)}, ${Math.max(0, d)}, 0.88)`;
      const draftDropSolid = `rgba(${Math.max(0, d - 2)}, ${Math.max(0, d - 2)}, ${Math.max(0, d)}, 0.97)`;
      const draftModal = `rgba(${Math.max(0, d - 4)}, ${Math.max(0, d - 4)}, ${Math.max(0, d - 2)}, 0.92)`;
      /* 预反色直写：目标暗色 T（近灰）→ 反写亮值 V。V 经子元素反色链
         invert(100%) + hue-rotate(180deg) + brightness(b) 还原为 ≈T。
         近灰色 hue-rotate 影响极小，忽略；V = 255 - T/brightness。 */
      const preInv = (hex) => {
        const t = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16));
        return "#" + t
          .map((c) => Math.round(255 - Math.min(255, c / b)).toString(16).padStart(2, "0"))
          .join("");
      };
      out.push(LC_CSS.dark.s10826({ draftCard, fr, draftDrop, s, computeDarkAccent, draftNav, b, draftMain, settings, preInv, draftModal, lcSideGlassOn, isDarkMode, draftDropSolid }));
      /* ── 发布框内标签placeholder、合集、回礼、声明文字及图标调亮 ── */
      out.push(LC_CSS.light.s13499({ draftNav, s, computeDarkAccent, draftCard, draftDrop }));
    }

    /* ── 浅色模式：趋势页关注/喜欢按钮悬停主题色（原版绿色 → 主题色）── */
    if (settings.enabled && !isDarkMode() && s.theme.accent) {
      out.push(`
body #masonryWrap .followbtn:hover,
body #masonryWrap .likebtn:hover {
  color: ${s.theme.accent} !important;
  border-color: ${s.theme.accent} !important;
}
`);
    }

    /* ── 登录页"背景作品来自"链接文字替换 ── */
    if (settings.background.mode !== "off") {
      out.push(`
        /* 隐藏原版"背景作品来自"文字 */
        #application.lofter-root-container [class*="TySqcf5cUIZoICYSV2M1tA"] span {
          display: none !important;
        }
        /* 插入新文字 */
        #application.lofter-root-container [class*="TySqcf5cUIZoICYSV2M1tA"]::after {
          content: "感谢使用 Lofter-Customizer" !important;
          color: #fff !important; 
          font-size: inherit !important;
        }
      `);
    }

    if (settings.enabled && s.theme.accent) {
      out.push(LC_CSS.pages.s13829({ s, isDarkMode }));
    }

    if (settings.enabled && isDarkMode() && s.theme.accent) {
      out.push(LC_CSS.dark.s13915({ computeDarkAccent, s }));
    }
    if (settings.enabled && s.theme.accent) {
      out.push(LC_CSS.pages.s14023({ s, computeDarkAccent, fr, isDarkMode }));

      if (settings.enabled && s.theme.accent) {
        const accent = isDarkMode()
          ? computeDarkAccent(s.theme.accent)
          : s.theme.accent;
        out.push(`
      /* 我关注的人页面：昵称/导航/取消关注悬停主题色 */
      html body .g-bdc:has(.m-glist) .m-tabbar a.ztag:hover,
      html body .g-bdc:has(.m-glist) .m-glist a.xtag:hover {
        color: ${accent} !important;
      }
    `);
      }
    }

    /* ============================================================
     * 新版 React 页面暗色修复（查看更多/合集/设置页）
     * 用 JS 动态检测背景色，避开哈希类名问题
     * ============================================================ */
    if (document.querySelector("#application.lofter-root-container")) {
      // 搜索框边框：只在暗色时注入
      if (isDarkMode()) {
        const searchBorderFix = document.createElement("style");
        searchBorderFix.id = "lc-search-fix";
        searchBorderFix.textContent = `
      #application.lofter-root-container input {
        border: none !important;
        background: transparent !important;
      }
#application.lofter-root-container [class*="box-web"] a span {
  color: rgba(255, 255, 255, 0.85) !important;
}
    `;
        document.head.appendChild(searchBorderFix);
      }

      // 卡片和侧边栏：始终监听，内部判断模式
      const fixDarkCards = () => {
        const dark = isDarkMode();
        document.querySelectorAll("#application div").forEach((el) => {
          const bg = getComputedStyle(el).backgroundColor;

          if (!dark) {
            // 浅色模式下移除所有暗色注入的样式标签
            document
              .querySelectorAll('style[id="lc-search-fix"]')
              .forEach((s) => s.remove());

            if (
              el.style.background?.includes("30, 30, 36") ||
              (el.style.background === "transparent" && el.style.backdropFilter)
            ) {
              el.style.removeProperty("background");
              el.style.removeProperty("backdrop-filter");
              el.style.removeProperty("-webkit-backdrop-filter");
              el.style.removeProperty("border");
              el.style.removeProperty("box-shadow");
              el.style.removeProperty("border-radius");
              el.style.removeProperty("box-sizing");
            }
            return;
          }

          if (bg === "rgb(246, 246, 246)") {
            const rect = el.getBoundingClientRect();
            if (rect.width > 600) return;
            if (rect.width >= 200 && rect.width <= 270) return;
            setStyleIfChanged(el, 
              "background",
              "rgba(30, 30, 36, 0.72)",
              "important",
            );
            setStyleIfChanged(el, 
              "backdrop-filter",
              "blur(16px) saturate(140%)",
              "important",
            );
            setStyleIfChanged(el, 
              "border",
              "1px solid rgba(255,255,255,0.08)",
              "important",
            );
            setStyleIfChanged(el, 
              "box-shadow",
              "0 4px 24px rgba(0,0,0,0.35)",
              "important",
            );
            setStyleIfChanged(el, "border-radius", "12px", "important");
            setStyleIfChanged(el, "box-sizing", "border-box", "important");
          }
          if (bg === "rgb(255, 255, 255)") {
            const rect = el.getBoundingClientRect();
            if (rect.width > 600) {
              setStyleIfChanged(el, "background", "transparent", "important");
            }
          }
          if (
            el.className &&
            typeof el.className === "string" &&
            el.className.includes("box-web") &&
            /* 侧栏玻璃卡片交还给 CSS（内联 !important 会盖掉玻璃膜） */
            !el.classList.contains("lc-side-glass")
          ) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 200 && rect.width < 350) {
              setStyleIfChanged(el, 
                "background",
                "rgba(30, 30, 36, 0.72)",
                "important",
              );
              setStyleIfChanged(el, 
                "backdrop-filter",
                "blur(16px) saturate(140%)",
                "important",
              );
              setStyleIfChanged(el, "border-radius", "12px", "important");
              setStyleIfChanged(el, 
                "border",
                "1px solid rgba(255,255,255,0.08)",
                "important",
              );
            }
          }
        });
      };

      setTimeout(fixDarkCards, 500);
      /* rAF 节流：#application 下 DOM 变动频繁，避免每批变异都全量扫描所有 div */
      let _fdcRaf = 0;
      const observer = new MutationObserver(() => {
        if (_fdcRaf) return;
        _fdcRaf = requestAnimationFrame(() => {
          _fdcRaf = 0;
          fixDarkCards();
        });
      });
      observer.observe(document.querySelector("#application"), {
        childList: true,
        subtree: true,
      });
    }

    /* 定时发布日期输入框：hover/focus 边框主题色 */
    out.push(`
      html body .lofter-common-date-picker-input:hover,
      html body .lofter-common-date-picker-focused,
      html body .lofter-common-date-picker-focused .lofter-common-date-picker-input,
      html body .lofter-common-date-picker-input:focus-within {
        border-color: ${s.theme.accent || "#667eea"} !important;
        box-shadow: 0 0 0 2px ${s.theme.accent || "#667eea"}33 !important;
      }
    `);

    /* 定时发布"确定"按钮：全局规则，浅色/暗色都生效 */
    out.push(`
      html body .lofter-common-date-picker-ok button,
      html body button.lofter-common-date-picker-ok,
      html body button.lofter-common-date-picker-ok:disabled,
      html body .lofter-common-date-picker-ok button:disabled,
      html body li.lofter-common-date-picker-ok button,
      html body li.lofter-common-date-picker-ok button:disabled {
        background: ${s.theme.accent || "#667eea"} !important;
        background-color: ${s.theme.accent || "#667eea"} !important;
        color: #fff !important;
        opacity: 1 !important;
      }
    `);

    /* ========== 右侧栏液态玻璃（hyalite）==========
     * 首页右侧栏的玻璃卡片。放在本函数最末是刻意的：暗色区先前的
     * `#rside > * { filter: invert }` / `#rside #slide-bar [class*="-box-web"]`
     * 都是 !important，只能靠「同源选择器抬特异性 + 表内后序」压过去。
     * 反色必须整个让位：filter 会建立 backdrop root，玻璃只能采样到该祖先
     * 内部的画面（近乎空白），折射直接失效（这一步是探针最容易漏的坑）。 */
    /* 边缘折射是实验项（默认关）：backdrop-filter: url() 走软件光栅化，
       常驻视口会拖慢全页动效。默认为纯 blur 磨砂——GPU 加速、开销低一档，
       且不依赖 hyalite 库（任何支持 backdrop-filter 的浏览器都能用） */
    const sideRefract = !!(settings.sidebar && settings.sidebar.refract);
    const sideHy =
      settings.sidebar &&
      settings.sidebar.hyalite &&
      (sideRefract ? !!(window.Hyalite && Hyalite.supported()) : true);
    /* 首页块：sideHy 开即输出。① 的「反色让位」是首页反色管线的对应面，
       与玻璃同开同关 */
    if (sideHy) {
      /* 玻璃卡锚选择器：首页 slide-bar 玻璃卡 + 他人喜欢页喜欢列表卡
         （2026-09-29 扩）——同一开关、同一套膜/深膜/白字规则。
         ⚠️ favblog 形态必须**无条件输出**、用纯 CSS `:not(:has(#slide-bar))`
         判页（2026-09-29 第二次真机实锤）：此前用 buildCSS 执行时刻的
         querySelector 判页，而 buildCSS 有版本缓存（invalidateCSS 只在
         配置变更时调用），#rside 由 React 晚渲染时首build判 false 后
         缓存终身 → 让位/膜 CSS 整块缺失，收集链照常挂类 → 玻璃膜在、
         暗色反色也在 → 深膜白字被反色反成「白底黑字」。纯 CSS 判页
         随 DOM 实时生效，无时序敏感；:has(#likesidelist) 本身就排除了
         首页/tag 页（它们没有该节点），:not(:has(#slide-bar)) 再排除
         有 slide-bar 的页面（推荐页等），首页语义与扩前完全一致 */
      /* 选择器对拼接（2026-09-29 第四次真机实锤后的定案形态）：
         ⚠️ 绝不能把多选择器存成「A, B」字符串再写 `${sel}.xxx` ——
         后缀只落在最后一个选择器（B/favblog）上，A（首页）裸奔：
         ③ 深膜失去 .lc-glass-dark 条件（一直暗材质）、④⑥⑥b 的
         后代部分在首页全灭（暗字/白条头/白分割线）、⑥ 的裸 A 还
         命中卡片本身把膜打成 transparent。改为 parts 数组 +
         withSuffix 逐个拼后缀 */
      const sideCardParts = [
        '#rside #slide-bar [class*="-box-web"]',
        "#rside:not(:has(#slide-bar)) .g-box .m-menu:has(#likesidelist)",
        /* tag 页参与用户卡（2026-09-30 双探针实证：站点改版后挂在
           #rside > #tageditor > .g-box > .m-menu）。无 #slide-bar 守卫
           同样适用（tag 页本就没有 slide-bar）；锚 .participate-user-title-w
           与其他形态互不命中 */
        "#rside:not(:has(#slide-bar)) .g-box .m-menu:has(.participate-user-title-w)",
      ];
      const sideAnyParts = [
        "#rside #slide-bar .lc-side-glass",
        "#rside:not(:has(#slide-bar)) .g-box .m-menu.lc-side-glass",
      ];
      const lcSideJoin = (parts, suffix) =>
        parts.map((p) => p + suffix).join(",\n        ");
      /* ②③ 膜锚（带 .lc-side-glass 的卡自身） */
      const sideCardSel = lcSideJoin(sideCardParts, ".lc-side-glass");
      const sideCardDark = lcSideJoin(
        sideCardParts,
        ".lc-side-glass.lc-glass-dark",
      );
      /* ④-⑧ 内容锚（卡自身/后代；suf 为空串时即卡自身） */
      const sideCardAny = lcSideJoin(sideAnyParts, "");
      const sideCardEl = (el) => lcSideJoin(sideAnyParts, " " + el);
      const sideCardDarkEl = (el) =>
        lcSideJoin(sideAnyParts, ".lc-glass-dark" + (el ? " " + el : ""));
      /* 让位选择器表用 join 组装（防悬挂逗号整条规则非法）。
         favblog 形态同样带 :not(:has(#slide-bar)) 纯 CSS 判页 */
      const yieldSel = [
        '#rside:has(#slide-bar [class*="-box-web"]) > *',
        '#rside:has(#slide-bar [class*="-box-web"]) img',
        '#rside:has(#slide-bar [class*="-box-web"]) .lc-emoji-wrap',
        "#rside:not(:has(#slide-bar)):has(.g-box .m-menu #likesidelist) > *",
        "#rside:not(:has(#slide-bar)):has(.g-box .m-menu #likesidelist) img",
        "#rside:not(:has(#slide-bar)):has(.g-box .m-menu #likesidelist) .lc-emoji-wrap",
        /* tag 页：反相挂在 #rside > #tageditor 上（整列容器），但整列里
           只有参与用户卡一块可见内容（2026-09-30 探针：其余 5 个子级全 0×0），
           故只让 #tageditor 一层——兄弟容器（#tagManager 等 React 晚挂）
           保留各自反相，将来渲染也不受影响。比 favblog/首页的整列让位更精准。
           ⚠️ 判据用单层 :has(.participate-user-title-w)（不要嵌套
           :has(#tageditor ... :has(...))——嵌套 :has 在 jsdom/nwsapi 下
           匹配不到，回归测试无法自证） */
        "#rside:has(.participate-user-title-w) #tageditor",
      ].join(",\n        ");
      out.push(LC_CSS.light.s14394({ yieldSel, sideCardSel, sideRefract, sideCardEl, sideCardDark, sideCardAny, s, sideCardDarkEl }));
    }

    _cachedCSS = out.join("\n");
    _cachedCSSVer = _cssVersion;
    return _cachedCSS;
  }

  function applyStyle() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    const css = buildCSS();
    /* 内容没变时不重赋 textContent（避免全文档样式重算）、不写 sessionStorage */
    if (el.textContent !== css) {
      el.textContent = css;
      sessionStorage.setItem(CACHE_KEY, css);
    }

    /* ── 批量管理页下拉圆角独立注入（绕过大字符串解析丢失问题）── */
    if (document.body?.classList.contains("p-body7") && !isDarkMode()) {
      let p7el = document.getElementById("lc-body7-dropdown");
      if (!p7el) {
        p7el = document.createElement("style");
        p7el.id = "lc-body7-dropdown";
        document.head.appendChild(p7el);
      }
      p7el.textContent = `
        html body.p-body7 .m-calendar,
        html body.p-body7 .m-calendar.ztag,
        html body.p-body7 .m-tagsch,
        html body.p-body7 .m-tagsch.m-tagsch-1,
        html body.p-body7 .m-tagsch.ztag {
          border-radius: 12px !important;
          overflow: hidden !important;
          background: rgba(255,255,255,0.82) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
        }
        html body.p-body7 .m-tagsch .tbox,
        html body.p-body7 .m-tagsch ul {
          border-radius: 12px !important;
          overflow: hidden !important;
          background: transparent !important;
        }
        html body.p-body7 .m-calendar table {
          border-radius: 12px !important;
          overflow: hidden !important;
          border-collapse: separate !important;
        }
        html body.p-body7 .m-calendar li.empty,
        html body.p-body7 .m-calendar li.empty a,
        html body.p-body7 .m-calendar li.empty em {
          background: transparent !important;
          color: rgba(0,0,0,0.25) !important;
        }
      `;
    }

    /* 暗色模式下强制移除亮色注入，避免覆盖 buildCSS() 里的暗色样式 */
    if (isDarkMode()) {
      const p7el = document.getElementById("lc-body7-dropdown");
      if (p7el) p7el.remove();
    }
    /* 浅色模式下强制移除暗色注入 */
    if (!isDarkMode()) {
      const searchFix = document.getElementById("lc-search-fix");
      if (searchFix) searchFix.remove();
    }

    /* 草稿页/审核中心卡片自绘气泡（浅暗两用，颜色随模式切换） */
    ensureBubbleCards();
  }

  /* ---------- 强制覆盖标签页绿色竖条和用户名样式 ---------- */
  function forceTagPageStyles() {
    if (!settings.enabled || !settings.theme.accent) return;

    // 竖条
    document
      .querySelectorAll(".m-pushtag .w-huoy span.js-act > b")
      .forEach((el) => {
        el.style.setProperty("background", settings.theme.accent, "important");
        el.style.setProperty(
          "background-color",
          settings.theme.accent,
          "important",
        );
      });

    // 用户名（只注入一次 transition，避免重复）
    document
      .querySelectorAll(".m-pushtag ul.tdata li .colb > a.name")
      .forEach((el) => {
        if (!el.dataset.lcStyled) {
          el.style.setProperty("display", "inline-block", "important");
          el.style.setProperty(
            "transition",
            "color 0.2s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1)",
            "important",
          );
          el.addEventListener("mouseenter", () => {
            el.style.setProperty("color", settings.theme.accent, "important");
            el.style.setProperty("transform", "scale(1.05)", "important");
          });
          el.addEventListener("mouseleave", () => {
            el.style.removeProperty("color");
            el.style.removeProperty("transform");
          });
          el.dataset.lcStyled = "1";
        }
      });
  }

  /* ---------- 统一弹窗暗色模式入口 ---------- */
  function applyAllDialogsDark() {
    if (!settings.enabled) return;

    /* ── A. rc-dialog 体系弹窗统一处理 ── */
    document
      .querySelectorAll(".rc-dialog-content:not(.lc-dialog-processed)")
      .forEach((dialog) => {
        dialog.classList.add("lc-dialog-processed");

        const title =
          dialog
            .querySelector(".rc-dialog-title, header")
            ?.textContent?.trim() || "";
        if (title.includes("选择礼物")) {
          dialog.classList.add("lc-dialog-gift-picker");
          dialog
            .querySelectorAll("ul > li")
            .forEach((el) => el.classList.add("lc-gift-item"));
          dialog
            .querySelectorAll(".rc-checkbox")
            .forEach((el) => el.classList.add("lc-gift-checkbox"));
        } else if (title.includes("确定关闭吗")) {
          dialog.classList.add("lc-dialog-confirm-close");
        } else if (title.includes("添加创作声明")) {
          /* 创作声明弹窗：暗色下内层面板/文字需要专属规则 */
          dialog.classList.add("lc-dialog-declaration");
        }

        // 按钮class无论深浅都加
        const footer = dialog.querySelector(".rc-dialog-footer, footer");
        if (footer) {
          const btns = footer.querySelectorAll("button");
          btns.forEach((btn, idx) => {
            if (
              btn.classList.contains("lfc-modal-btn-primary") ||
              idx === btns.length - 1
            ) {
              btn.classList.add("lc-dialog-btn-ok");
            } else {
              btn.classList.add("lc-dialog-btn-cancel");
            }
          });
        }
      });

    /* 模式切换跟随：lc-dialog-dark 每次调用都按当前模式同步。
       此前只在新弹窗首次处理时决定一次（lc-dialog-processed 一次性
       标记），弹窗开着切浅/暗会停留在旧模式——暗→浅时输入框保持
       白字（白底上看不见），浅→暗时整个弹窗没有任何暗色规则 */
    document.querySelectorAll(".rc-dialog-content").forEach((dialog) => {
      dialog.classList.toggle("lc-dialog-dark", isDarkMode());
    });

    /* ── B. 礼物设置（非 rc-dialog，独立 main 元素）── */
    document
      .querySelectorAll("main:not(.lc-gift-processed)")
      .forEach((main) => {
        const header = main.querySelector("header");
        if (!header || header.textContent.trim() !== "礼物设置") return;

        main.classList.add("lc-gift-processed");

        /* 子元素标记类无条件加（CSS 全部以 .lc-gift-dark 为前缀，
           浅色下父类不存在即不生效）；父类在下方统一按当前模式同步，
           支持弹窗开着切换浅/暗主题 */
        main
          .querySelectorAll('textarea, input[type="text"]')
          .forEach((el) => el.classList.add("lc-gift-input"));
        main.querySelectorAll('div[role="button"]').forEach((el) => {
          if (el.closest("footer")) return;
          const txt = el.textContent.trim();
          if (txt.length > 0 && txt.length < 15)
            el.classList.add("lc-gift-tag");
        });

        main
          .querySelectorAll("label")
          .forEach((el) => el.classList.add("lc-gift-label"));
        const footer = main.querySelector("footer");
        if (footer) {
          const btns = footer.querySelectorAll("button");
          if (btns[0]) btns[0].classList.add("lc-gift-btn-cancel");
          if (btns[1]) btns[1].classList.add("lc-gift-btn-ok");
        }
      });

    /* 礼物设置 main 的暗色父类同样按当前模式同步（与 rc-dialog 一致） */
    document.querySelectorAll("main.lc-gift-processed").forEach((main) => {
      main.classList.toggle("lc-gift-dark", isDarkMode());
    });
  }

  /* ---------- 创建合集弹窗：输入框按当前模式写回内联样式（幂等） ----------
     站点暗色系统只在弹窗渲染时按"当时"的模式写一次内联样式，之后切换主题不会更新；
     而内联 !important 无法被外部 CSS 覆盖 → 必须在这里按当前模式主动写回。
     锚点用 placeholder 文案（不随构建混淆变化）。 */
  function lcFixCollectionFields() {
    if (!document.querySelector(".rc-dialog-content, .rc-dialog")) return;
    const isDark = isDarkMode();
    const setInline = (el, k, v) => {
      if (el.style.getPropertyValue(k) !== v) {
        el.style.setProperty(k, v, "important");
      }
    };
    document
      .querySelectorAll(".rc-dialog-content, .rc-dialog")
      .forEach((card) => {
        /* 合集名称输入框：原版浅色下无边框，补一个淡边框便于识别 */
        const collName = card.querySelector('input[placeholder*="不超过15"]');
        if (collName) {
          if (isDark) {
            setInline(collName, "background", "rgba(255, 255, 255, 0.08)");
            setInline(
              collName,
              "background-color",
              "rgba(255, 255, 255, 0.08)",
            );
            setInline(collName, "border", "1px solid rgba(255, 255, 255, 0.18)");
            setInline(collName, "color", "#fff");
          } else {
            setInline(collName, "background", "#fff");
            setInline(collName, "background-color", "#fff");
            setInline(collName, "border", "1px solid rgba(0, 0, 0, 0.12)");
            setInline(collName, "color", "#333");
          }
        }
        /* 合集简介 textarea：暗色用比卡片(#1a1a1a)略亮一档的深灰 */
        const collDesc = card.querySelector(
          'textarea[placeholder*="快速了解合集内容"]',
        );
        if (collDesc) {
          if (isDark) {
            setInline(collDesc, "background", "#2C2C2C");
            setInline(collDesc, "background-color", "#2C2C2C");
            setInline(collDesc, "border", "1px solid rgba(255, 255, 255, 0.10)");
            setInline(collDesc, "color", "rgba(255, 255, 255, 0.9)");
          } else {
            setInline(collDesc, "background", "#fff");
            setInline(collDesc, "background-color", "#fff");
            setInline(collDesc, "border", "1px solid rgba(0, 0, 0, 0.12)");
            setInline(collDesc, "color", "#333");
          }
        }
      });
  }

  /* ---------- 弹窗输入框暗色修复（供轮询 + MutationObserver 共用）----------
     创作声明弹窗内输入框及父级边框精确处理。站点 JS 在点击勾选键/
     开关等交互时会用内联 !important 重写浅色样式（内联 !important
     高于一切 CSS 规则，CSS 兜底压不住），只有把我们自己的内联样式
     写回去才能覆盖——之前只靠 300ms 轮询，点击后有一帧露出白框
     （闪烁来源）。MutationObserver 监听 style 属性变化后即时调用
     本函数，空窗缩到微秒级。setStyleIfChanged 幂等，不会死循环 */
  function lcFixDialogInputs() {
    document.querySelectorAll(".lc-dialog-dark input").forEach((input) => {
      const parent = input.parentElement;
      if (!parent || parent.tagName !== "DIV") return;

      // input 本身统一暗色
      setStyleIfChanged(input,
        "border-color",
        "rgba(255,255,255,0.15)",
        "important",
      );
      setStyleIfChanged(input,
        "background",
        "rgba(255,255,255,0.08)",
        "important",
      );

      if (input.readOnly || input.disabled) {
        setStyleIfChanged(parent,
          "border",
          "1px solid rgba(255,255,255,0.15)",
          "important",
        );
        setStyleIfChanged(parent,
          "background",
          "rgba(255,255,255,0.08)",
          "important",
        );
        setStyleIfChanged(parent, "box-shadow", "none", "important");

        // 只对时间/地点选择器（placeholder 包含"选择"）撑满高度
        const ph = input.placeholder || "";
        if (ph.includes("选择")) {
          setStyleIfChanged(parent, "padding-top", "6px", "important");
          setStyleIfChanged(parent, "padding-bottom", "6px", "important");
        }

        // 关键修复：外层 role="button" 容器去白底、去白框
        const btnWrap = input.closest('[role="button"]');
        if (btnWrap) {
          setStyleIfChanged(btnWrap, "background", "transparent", "important");
          setStyleIfChanged(btnWrap, "border", "none", "important");
          setStyleIfChanged(btnWrap, "box-shadow", "none", "important");
        }
      } else {
        // 可编辑输入框（原作者、链接）：父级清除边框，避免双层方框
        setStyleIfChanged(parent, "border", "none", "important");
      }
    });
  }

  /* ---------- 弹窗样式变化监听（全局只启动一次）----------
     站点 JS 交互时用内联 !important 重写浅色样式（点击勾选键/
     开关时输入框闪白框的根因），轮询有 300ms 空窗。这里监听
     style/class 属性变化 + childList 节点插入即时重修：
     - style/class：站点改写已有元素的内联样式（拍摄时间框闪烁）
     - childList：勾选/取消"授权转载"时 React 重建原作者/原作链接
       输入框，新节点连同浅色内联样式一起插入，纯属性监听不触发
     必须在回调里同步修复：MutationObserver 回调运行在微任务时机
     （DOM 变更后、浏览器绘制前），同步写暗色样式 = 零闪帧；若用
     rAF 推迟到下一帧，浏览器会先画出一帧站点浅色样式（闪白帧）。
     同一批 DOM 变更只触发一次回调，setStyleIfChanged 幂等，
     我方写入触发的 mutation 检查后无变化即止，无死循环 */
  let _dialogStyleObserver = null;
  function startDialogStyleObserver() {
    if (_dialogStyleObserver) return;
    _dialogStyleObserver = new MutationObserver(() => {
      if (!settings.enabled || !isDarkMode()) return;
      if (!document.querySelector(".lc-dialog-dark")) return;
      lcFixDialogInputs();
    });
    _dialogStyleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
      childList: true,
      subtree: true,
    });
  }

  /* ---------- 达人认证页：图标/提示文字/返回首页键毛玻璃卡 ---------- */
  /* 页面无可用类名（诊断实证内容层全是裸 div/哈希层），沿用"存为
     草稿"键的按文字匹配先例：TreeWalker 找包含"请前往LOFTER APP"
     与"返回首页"的文本宿主元素（最深层、成本低），再取两者共同
     祖先上一整张毛玻璃卡（用户要求三元素合到同一张卡，图标/文字/
     按键都在其内）。颜色随模式，dataset 记模式号，切换主题时重打 */
  function lcStyleDarenApplyGlass() {
    const app = document.getElementById("application");
    if (!app) return;
    const isDark = isDarkMode();
    const mode = isDark ? "dark" : "light";
    if (app.dataset.lcDarenGlass === mode) return;
    const findTextOwner = (txt) => {
      const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.indexOf(txt) > -1) return node.parentElement;
      }
      return null;
    };
    const textEl = findTextOwner("请前往LOFTER APP");
    if (!textEl) return;
    const btnEl = findTextOwner("返回首页");
    const glass = (el, pad) => {
      if (!el) return;
      el.style.setProperty("background", isDark ? "rgba(31, 31, 25, 0.7)" : "rgba(255, 255, 255, 0.62)", "important");
      el.style.setProperty("backdrop-filter", "blur(16px) saturate(" + (isDark ? "140" : "160") + "%)", "important");
      el.style.setProperty("-webkit-backdrop-filter", "blur(16px) saturate(" + (isDark ? "140" : "160") + "%)", "important");
      el.style.setProperty("border-radius", "16px", "important");
      el.style.setProperty("box-sizing", "border-box", "important");
      el.style.setProperty("padding", pad, "important");
    };
    let common = textEl;
    while (common && btnEl && !common.contains(btnEl)) {
      common = common.parentElement;
    }
    if (common && common !== app) {
      glass(common, "22px 30px");
    } else {
      /* 共同祖先不存在或就是 #application（会盖全页）时退回各打各的 */
      glass(textEl, "16px 24px");
      glass(btnEl, "10px 22px");
    }
    app.dataset.lcDarenGlass = mode;
  }

  /* ---------- 创作者中心页：暗色文字提亮（按计算色 JS 改写） ---------- */
  /* CSS 无法按"颜色"选元素；控制台取证页面文字色五档：
     #1F1F19 / rgba(0,0,0,.75) / #666 / #999 / 继承 #333。
     暗色下逐元素改写为浅色并打 data 标记；浅色下摘掉内联色恢复原样。
     dataset 记模式号，切换主题时先摘再打 */
  /* 文章数据块 style 属性看守：React 每次 commit 重写 inline style，
     主 observer 只监听 childList 收不到 attribute 变更，一次性内联写
     会被冲掉（实证：inline bg 回到 transparent）。单独看守该元素的
     style 属性，被冲掉立即写回；值相同不产生新 mutation，收敛不循环 */
  let lcGkGuard = null;
  let lcGkGuardEl = null;
  let lcGkWant = null;
  function lcFixCreatorCenter() {
    const app = document.getElementById("application");
    if (!app) return;
    /* 页面门禁：style-14_XXXX 的数字每次加载随机（实测 5731/1965/3461
       等轮换），硬编码哈希会导致整函数永远 return（实证：GKRM8Z3
       看守未挂上的根因）。改用通配 -page-web，与客服中心页同惯例 */
    const page = app.querySelector('[class*="-page-web"]');
    if (!page) return;
    const isDark = isDarkMode();
    const r = ((settings.card && settings.card.radius) || 16) + "px";
    /* 侧栏毛玻璃：CSS 版被站点同优先级 !important 在级联后序压掉
       （实测圆角生效但 bg/blur 被覆写），改用内联 !important——
       级联优先级最高，稳赢。两模式都要，每次调用幂等写回 */
    const side = app.querySelector('[class*="Pa+-GkpdlzH-TTBCea3AMQ"]');
    if (side) {
      side.style.setProperty("background", isDark ? "rgba(31, 31, 25, 0.7)" : "rgba(255, 255, 255, 0.62)", "important");
      side.style.setProperty("backdrop-filter", "blur(16px) saturate(" + (isDark ? "140" : "160") + "%)", "important");
      side.style.setProperty("-webkit-backdrop-filter", "blur(16px) saturate(" + (isDark ? "140" : "160") + "%)", "important");
      side.style.setProperty("border-radius", r, "important");
    }
    /* 文章数据块毛玻璃：该块身上有站点 inline background transparent
       !important，且会被 React commit 反复重写（见上方看守注释），
       内联写 + 看守 observer 双保险 */
    const gk = app.querySelector('[class*="GKRM8Z3DDLSN8H1UORgzkA"]');
    if (gk) {
      /* 期望值放模块级 lcGkWant：observer 回调读共享状态而非闭包——
         observer 只在元素首次出现时挂一次，若回调捕获当时 isDark，
         模式切换后 React 重写 style 时旧闭包会把浅色冲回暗色
         （实证：浅色模式容器仍是暗玻璃） */
      lcGkWant = {
        bg: isDark ? "rgba(31, 31, 25, 0.7)" : "rgba(255, 255, 255, 0.62)",
        blur: "blur(16px) saturate(" + (isDark ? "140" : "160") + "%)",
        r: r,
      };
      const gkApply = () => {
        if (!lcGkWant) return;
        if (gk.style.getPropertyValue("background") !== lcGkWant.bg) {
          gk.style.setProperty("background", lcGkWant.bg, "important");
          gk.style.setProperty("backdrop-filter", lcGkWant.blur, "important");
          gk.style.setProperty("-webkit-backdrop-filter", lcGkWant.blur, "important");
          gk.style.setProperty("border-radius", lcGkWant.r, "important");
        }
      };
      if (lcGkGuardEl !== gk) {
        if (lcGkGuard) lcGkGuard.disconnect();
        lcGkGuard = new MutationObserver(gkApply);
        lcGkGuard.observe(gk, { attributes: true, attributeFilter: ["style"] });
        lcGkGuardEl = gk;
      }
      gkApply();
    }
    if (!isDark) {
      /* 浅色：只需摘一次内联色（模式号防重复） */
      if (page.dataset.lcCcText !== "light") {
        page.querySelectorAll("[data-lc-cc-text]").forEach((el) => {
          el.style.removeProperty("color");
          el.style.removeProperty("background");
          el.removeAttribute("data-lc-cc-text");
        });
        page.dataset.lcCcText = "light";
      }
      return;
    }
    /* 暗色：每次都重扫——SPA 局部重渲染会新增未处理元素，
       不能用模式号早退。已处理的元素计算色变成映射值、
       不在 map 里，天然幂等 */
    /* 作品缩略图外层 <a>：实测白底 rgb(245,245,245) 画在这一层
       （内层 div 的暗底已生效），透明化让暗色缩略块透出 */
    page.querySelectorAll('[class*="_9cZmEJaV-ySSFD4tbawePA"]').forEach((a) => {
      a.style.setProperty("background", "transparent", "important");
      a.setAttribute("data-lc-cc-text", "1");
    });
    const map = {
      "rgb(31, 31, 31)": "rgb(217, 217, 217)",
      "rgb(51, 51, 51)": "rgb(217, 217, 217)",
      "rgba(0, 0, 0, 0.75)": "rgba(255, 255, 255, 0.8)",
      "rgb(102, 102, 102)": "rgb(185, 185, 185)",
      "rgb(153, 153, 153)": "rgb(150, 150, 145)",
    };
    page.querySelectorAll("*").forEach((el) => {
      const to = map[getComputedStyle(el).color];
      if (to) {
        el.style.setProperty("color", to, "important");
        el.setAttribute("data-lc-cc-text", "1");
      }
    });
    /* 主题色实心键 / 选中态筛选键：通用映射写出的浅灰 217 在彩色底上
       不清晰，强制纯白（含内部 span）。旧版本写下的 217 内联因 map
       幂等跳过不会自愈，这里每次暗色重扫直接覆写；标记同款属性，
       浅色模式统一摘除 */
    page
      .querySelectorAll(
        'aside[aria-label="连载作品筛选"] button[aria-pressed="true"], button[class*="eurwS-3Ul-a4VcnLVRUNCQ"], button[class*="rTJCL2feQxu8OAlsa5nUCw"], button[class*="gaMFcFLrz8MzQMjWztEkNg"], button[class*="l8wGBlACyy3nd3eBHk6WiQ"]',
      )
      .forEach((el) => {
        el.style.setProperty("color", "rgb(255, 255, 255)", "important");
        el.setAttribute("data-lc-cc-text", "1");
        el.querySelectorAll("span").forEach((sp) => {
          sp.style.setProperty("color", "rgb(255, 255, 255)", "important");
          sp.setAttribute("data-lc-cc-text", "1");
        });
      });
    /* "推荐操作-更多"键：文字改主题色（同"发布章节"）——
       摘掉旧版本写下的 217 内联，让上面的 CSS 主题色生效 */
    page
      .querySelectorAll('button[class*="GF95OWvkh+6f26hQB49HSA"]')
      .forEach((el) => {
        el.style.removeProperty("color");
      });
    page.dataset.lcCcText = "dark";
  }

  /* ---------- Portal 轮询（全局只启动一次）---------- */
  let _portalInterval = null;
  function startPortalPolling() {
    if (_portalInterval) return;
    _portalInterval = setInterval(() => {
      if (!settings.enabled) return;

      /* 创建合集弹窗输入框：主题切换后站点不会更新内联样式，这里按当前模式兜底写回（幂等） */
      lcFixCollectionFields();

      // 浅色模式：清除搜索下拉日期 span 的暗色内联样式
      if (!isDarkMode()) {
        document
          .querySelectorAll('#lofter-top-bar [class*="-body-web"] span')
          .forEach((span) => {
            const txt = span.textContent.trim();
            if (/^\d{2}-\d{2}$/.test(txt) || /^\d{4}-\d{2}-\d{2}$/.test(txt)) {
              span.style.removeProperty("background");
              span.style.removeProperty("border-radius");
              span.style.removeProperty("padding");
              span.style.removeProperty("color");
            }
          });
        return;
      }

      /* 大多数页面既无日期选择器也无暗色弹窗，直接跳过重扫描 */
      const hasPicker = !!document.querySelector(
        ".lofter-common-date-picker-dropdown, .lofter-common-date-picker-panel-container",
      );
      const hasDarkDialog = !!document.querySelector(".lc-dialog-dark");
      if (!hasPicker && !hasDarkDialog) {
        // 仍需处理搜索下拉日期 span（唯一在无弹窗页面也会出现的元素）
        document
          .querySelectorAll('#lofter-top-bar [class*="-body-web"] span')
          .forEach((span) => {
            const txt = span.textContent.trim();
            if (/^\d{2}-\d{2}$/.test(txt) || /^\d{4}-\d{2}-\d{2}$/.test(txt)) {
              setStyleIfChanged(span, 
                "background",
                "rgba(25,25,30,0.85)",
                "important",
              );
              setStyleIfChanged(span, "border-radius", "3px", "important");
              setStyleIfChanged(span, "padding", "1px 5px", "important");
              setStyleIfChanged(span, 
                "color",
                "rgba(255,255,255,0.6)",
                "important",
              );
            }
          });
        return;
      }

      // 日期选择器外层实底
      if (hasPicker) {
      document
        .querySelectorAll(".lofter-common-date-picker-dropdown")
        .forEach((el) => {
          setStyleIfChanged(el, 
            "background",
            "rgba(35, 35, 42, 0.98)",
            "important",
          );
          setStyleIfChanged(el, 
            "border",
            "1px solid rgba(255,255,255,0.1)",
            "important",
          );
          setStyleIfChanged(el, "border-radius", "8px", "important");
          setStyleIfChanged(el, 
            "box-shadow",
            "0 8px 24px rgba(0,0,0,0.4)",
            "important",
          );
        });
      // 日期选择器内部面板实底
      document
        .querySelectorAll(
          ".lofter-common-date-picker-panel-container, .lofter-common-date-picker-panel, .lofter-common-date-picker-date-panel",
        )
        .forEach((el) => {
          setStyleIfChanged(el, 
            "background",
            "rgba(35, 35, 42, 0.98)",
            "important",
          );
        });
      } // end hasPicker

      // 创作声明内输入框及父级边框精确处理（抽为共用函数，
      // MutationObserver 即时修复也调用它）
      if (hasDarkDialog) {
        lcFixDialogInputs();
      } // end hasDarkDialog

      // 搜索下拉日期 span 暗色背景（精准匹配，避免误伤 tag/昵称）
      document
        .querySelectorAll('#lofter-top-bar [class*="-body-web"] span')
        .forEach((span) => {
          const txt = span.textContent.trim();
          if (/^\d{2}-\d{2}$/.test(txt) || /^\d{4}-\d{2}-\d{2}$/.test(txt)) {
            setStyleIfChanged(span, 
              "background",
              "rgba(25,25,30,0.85)",
              "important",
            );
            setStyleIfChanged(span, "border-radius", "3px", "important");
            setStyleIfChanged(span, "padding", "1px 5px", "important");
            setStyleIfChanged(span, 
              "color",
              "rgba(255,255,255,0.6)",
              "important",
            );
          }
        });
    }, 300);
  }

  /* ---------- Switch 轮询（全局只启动一次）---------- */
  let _switchInterval = null;
  function startSwitchPolling() {
    if (_switchInterval) return;
    _switchInterval = setInterval(() => {
      if (!settings.enabled || !settings.theme.accent) return;
      document.querySelectorAll(".rc-switch").forEach((el) => {
        if (el.classList.contains("rc-switch-checked")) {
          // 开启状态：刷主题色
          setStyleIfChanged(el, 
            "background-color",
            settings.theme.accent,
            "important",
          );
          setStyleIfChanged(el, 
            "background",
            settings.theme.accent,
            "important",
          );
          setStyleIfChanged(el, 
            "border-color",
            settings.theme.accent,
            "important",
          );
        } else {
          // 关闭状态：清除残留的内联样式，让 CSS 恢复灰色
          el.style.removeProperty("background-color");
          el.style.removeProperty("background");
          el.style.removeProperty("border-color");
        }
      });
      // checkbox 勾选主题色
      document
        .querySelectorAll(
          ".lc-dialog-gift-picker .rc-checkbox-checked .rc-checkbox-inner",
        )
        .forEach((el) => {
          setStyleIfChanged(el, 
            "background",
            settings.theme.accent,
            "important",
          );
          setStyleIfChanged(el, 
            "background-color",
            settings.theme.accent,
            "important",
          );
          setStyleIfChanged(el, 
            "border-color",
            settings.theme.accent,
            "important",
          );
        });
      document
        .querySelectorAll(
          ".lc-dialog-gift-picker .rc-checkbox:not(.rc-checkbox-checked) .rc-checkbox-inner",
        )
        .forEach((el) => {
          el.style.removeProperty("background");
          el.style.removeProperty("background-color");
          el.style.removeProperty("border-color");
        });
    }, 300);
  }
  /* ---------- 气泡卡片（首页博文 / 草稿页 / 审核中心）：自绘，浅暗两用 ----------
     站点气泡由 .isay 系列切片背景图拼成（箭头烙在图里、矩形宽度=内容区+箭头区），
     浅暗统一改为自绘：透明化切片 → 伪元素画圆角矩形（左缘从内容区开始，长度
     缩短一个箭头区）+ 左侧尖角（有头像时）。
     暗色 rgb(225,225,219)（经 invert+hue-rotate 显示为 #1F1F19），浅色 #fff。 */
  /* 暗色卡面取色：信息流淡透底（实验）开启时用半透明预反色值，
     让卡面与容器一起透出背景图（alpha 不受 invert 影响，只反 RGB） */
  function lcFeedCardBg() {
    if (
      settings.darkMode &&
      settings.darkMode.feedTranslucent &&
      settings.card &&
      settings.card.material
    ) {
      /* 用户可调不透明度（35%~92%）：invert/brightness 都不改 alpha，
         滑杆值与显示值直映射；越界夹取防白字吃进亮背景 */
      const a = Math.min(
        0.92,
        Math.max(0.35, Number(settings.darkMode.feedTransAlpha) || 0.65),
      );
      return `rgba(230, 230, 232, ${a})`;
    }
    return "rgb(225, 225, 219)";
  }
  /* 半透明卡面的 inset 高光描边（实验）：顶缘 1px 亮线 + 内侧 1px 微光圈，
     给透明玻璃「厚度」。反色区内要写预反色值——黑色经 invert 显示为白，
     且 brightness 乘 0 不变，alpha 原样保留；非淡透底返回 none 与旧观感一致 */
  function lcFeedFaceShadow() {
    if (
      settings.darkMode &&
      settings.darkMode.feedTranslucent &&
      settings.card &&
      settings.card.material
    )
      return "inset 0 1px 0 rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(0, 0, 0, 0.1)";
    return "none";
  }
  function ensureBubbleCards() {
    const el = document.getElementById("lc-bubble-cards");
    if (!settings.enabled) {
      if (el) el.remove();
      return;
    }
    startBubbleObserver();
    const dark = isDarkMode();
    /* 浅色毛玻璃（实验）：无反色祖先 → backdrop-filter 能采到真实背景，
       这是暗色反色区里做不到的（backdrop root 限制）。alpha 夹取 40%~85% */
    const lightFrost =
      !dark &&
      settings.card &&
      settings.card.material &&
      settings.card.lightFrost;
    const frostAlpha = Math.min(
      0.85,
      Math.max(0.4, Number(settings.card && settings.card.frostAlpha) || 0.6),
    );
    const frostCSS = lightFrost
      ? "backdrop-filter: blur(26px) saturate(150%) !important;\n" +
        "        -webkit-backdrop-filter: blur(26px) saturate(150%) !important;"
      : "";
    /* 磨砂开启时的入场动画改造（两段式观感根治）：
       ① .m-mlist 自身的 transform 是渲染面，挡卡面采样 → 容器动画置空，
          入场位移改排到卡面子元素与卡面/箭头伪元素上（backdrop-filter
          元素自身的 transform 不影响自己的采样）；
       ② 卡面宿主元素自身 opacity≠1 同样成为 backdrop root（实证：只搬
          transform 后仍有「半透明→磨砂」渐变）→ 卡面/箭头动画只含
          transform（全程 opacity=1），内容层单独做透明度渐入 */
    const cardDur = ((settings.card && settings.card.duration) || 500) / 1000;
    const animMode = settings.card.animation || "none";
    const faceFrom =
      animMode === "floatUp"
        ? "translateY(24px)"
        : animMode === "scaleIn"
          ? "scale(0.92)"
          : animMode === "slideIn"
            ? "translateX(-30px)"
            : "";
    const faceAdapt =
      !dark && settings.card && settings.card.material && settings.card.faceAdapt;
    /* 悬停轻微放大（面板「卡片 › 卡片外观 › 悬停轻微放大」，默认开）。
       关掉时 ${sel} 的 transition / transform-origin / :hover 三段一起不生成
       （只留 scale 那行会变成死规则），气泡卡其余外观不受影响。
       与 buildCSS 里通用兜底管线的 cardHoverZoom 读同一字段、同口径。 */
    const hoverZoom = !(settings.card && settings.card.hoverZoom === false);
    const frostInCSS = lightFrost
      ? `
      .m-mlist.lc-card-visible {
        animation: none !important;
      }
      ${
        faceFrom
          ? `.m-mlist.lc-card-visible > *,
      .m-mlist.lc-card-visible > *::before,
      .m-mlist.lc-card-visible > *::after {
        animation: lc-face-appear ${cardDur}s cubic-bezier(0.4, 0, 0.2, 1) backwards;
        animation-delay: var(--lc-face-delay, 0s);
      }
      @keyframes lc-face-appear {
        from { transform: ${faceFrom}; }
      }`
          : ""
      }
      .m-mlist.lc-card-visible > * > * {
        animation: lc-face-fade ${cardDur}s cubic-bezier(0.4, 0, 0.2, 1) backwards;
        animation-delay: var(--lc-face-delay, 0s);
      }
      @keyframes lc-face-fade {
        from { opacity: 0; }
      }`
      : "";
    /* 自适应卡面材质：卡背后背景区域偏暗 → 卡面切深膜白字（与侧栏玻璃
       同族语言）。JS 按 computed ::before 识别「画了卡面的卡片」并采样
       打 .lc-face-dark（类名是构建 hash，只能这样圈定），CSS 按 per-card
       类切换膜色与文字色。深膜保留磨砂模糊（frostCSS 不动）。
       **必须按 scope 现算**（入参 sel）：旧实现把这个模板写在外层、
       引用后面才声明的 pubBase 和 map 回调参数 sel —— faceAdapt 一开
       就 `Cannot access 'pubBase' before initialization`（TDZ），
       ensureBubbleCards 整段中断、样式表写入在抛错点之后永远走不到，
       于是卡片整体回落 buildCSS 的通用 #fff 白实底（且旧表残留，
       表现为「再开启无任何变化」）。 */
    const lcFaceAdaptCSS = (sel) =>
      faceAdapt
        ? `
      ${pubBase}.lc-face-dark::before,
      ${sel}.lc-face-dark::before {
        background: rgba(22, 22, 26, 0.55) !important;
        background-color: rgba(22, 22, 26, 0.55) !important;
      }
      ${pubBase}.lc-face-dark::after,
      ${sel}.lc-face-dark::after {
        background: rgba(22, 22, 26, 0.55) !important;
        background-color: rgba(22, 22, 26, 0.55) !important;
      }
      ${pubBase}.lc-face-dark a,
      ${pubBase}.lc-face-dark span,
      ${pubBase}.lc-face-dark p,
      ${pubBase}.lc-face-dark div,
      ${pubBase}.lc-face-dark li,
      ${pubBase}.lc-face-dark h1,
      ${pubBase}.lc-face-dark h2,
      ${pubBase}.lc-face-dark h3,
      ${pubBase}.lc-face-dark h4,
      ${pubBase}.lc-face-dark time,
      ${pubBase}.lc-face-dark em,
      ${pubBase}.lc-face-dark b,
      ${pubBase}.lc-face-dark i,
      ${sel}.lc-face-dark a,
      ${sel}.lc-face-dark span,
      ${sel}.lc-face-dark p,
      ${sel}.lc-face-dark div,
      ${sel}.lc-face-dark li,
      ${sel}.lc-face-dark h1,
      ${sel}.lc-face-dark h2,
      ${sel}.lc-face-dark h3,
      ${sel}.lc-face-dark h4,
      ${sel}.lc-face-dark time,
      ${sel}.lc-face-dark em,
      ${sel}.lc-face-dark b,
      ${sel}.lc-face-dark i {
        color: rgba(255, 255, 255, 0.88) !important;
      }
      ${pubBase}.lc-face-dark a:hover,
      ${sel}.lc-face-dark a:hover {
        color: #fff !important;
      }
      /* 深膜下的站点浅底控件（评论输入框/发布按钮等）：JS 采样时按
       * 「自带浅色背景」实测贴 .lc-face-ctl（主题色按钮彩底自带白字，
       * 不贴），统一切半透明深膜样式。不豁免的话 lc-face-dark 的白字
       * 直接落在控件自带白底上——白底白字，打的字看不见（真机
       * 2026-09-24 实锤：tag 页深膜卡评论区输入框） */
      ${pubBase}.lc-face-dark .lc-face-ctl,
      ${sel}.lc-face-dark .lc-face-ctl {
        background: rgba(255, 255, 255, 0.1) !important;
        background-color: rgba(255, 255, 255, 0.1) !important;
        color: rgba(255, 255, 255, 0.92) !important;
        border-color: rgba(255, 255, 255, 0.15) !important;
        /* 站点控件常带 transition:all——标签补挂时白→膜会走一段可见的
         * 渐变（观感也是「闪一下白」）。换肤瞬变，不过渡 */
        transition: none !important;
      }
      ${pubBase}.lc-face-dark .lc-face-ctl span,
      ${pubBase}.lc-face-dark .lc-face-ctl div,
      ${pubBase}.lc-face-dark .lc-face-ctl a,
      ${sel}.lc-face-dark .lc-face-ctl span,
      ${sel}.lc-face-dark .lc-face-ctl div,
      ${sel}.lc-face-dark .lc-face-ctl a {
        color: rgba(255, 255, 255, 0.92) !important;
      }
      ${pubBase}.lc-face-dark .lc-face-ctl:hover,
      ${sel}.lc-face-dark .lc-face-ctl:hover {
        background-color: rgba(255, 255, 255, 0.16) !important;
      }
      ${pubBase}.lc-face-dark .lc-face-ctl::placeholder,
      ${pubBase}.lc-face-dark .lc-face-ctl:empty::before,
      ${sel}.lc-face-dark .lc-face-ctl::placeholder,
      ${sel}.lc-face-dark .lc-face-ctl:empty::before {
        color: rgba(255, 255, 255, 0.45) !important;
      }
      /* 深膜下的榜单下拉面板：白底会突兀，随深膜切暗底。底色同样
       * 分内层（无条件）+ 组件根（悬停/展开态）两层，收起不画防横线；
       * 文字显式写白（不依赖上方通配，面板文字元素结构未核实） */
      ${pubBase}.lc-face-dark .tag-header-w .a-w-sel .selc,
      ${pubBase}.lc-face-dark .tag-header-w .a-w-sel .selcc,
      ${sel}.lc-face-dark .tag-header-w .a-w-sel .selc,
      ${sel}.lc-face-dark .tag-header-w .a-w-sel .selcc {
        background-color: rgba(34, 34, 40, 0.96) !important;
      }
      /* 组件根 :hover 底色已删（20260925v）：同浅色版，根盒大一圈=「放大一圈」 */
      ${pubBase}.lc-face-dark .tag-header-w .a-w-sel span,
      ${pubBase}.lc-face-dark .tag-header-w .a-w-sel li,
      ${pubBase}.lc-face-dark .tag-header-w .a-w-sel a,
      ${pubBase}.lc-face-dark .tag-header-w .a-w-sel div,
      ${sel}.lc-face-dark .tag-header-w .a-w-sel span,
      ${sel}.lc-face-dark .tag-header-w .a-w-sel li,
      ${sel}.lc-face-dark .tag-header-w .a-w-sel a,
      ${sel}.lc-face-dark .tag-header-w .a-w-sel div {
        color: rgba(255, 255, 255, 0.92) !important;
      }
      /* 评论分割线随深膜调暗（2026-09-25 用户反馈）：站点浅灰线在深膜
       * 上是亮线。分割线类名有两套家族——旧评论组件 .cmti/.bcmti 与
       * 新 isay 组件 li.isaym2（2026-09-25 真机 DOM 实锤；独立分割线
       * 元素还与行同类名，猜类名必漏）——改按 [data-lc-cmt-area] 子树
       * 统一压 border-color，线不管画在谁身上都命中。白 12% 在深膜上
       * 是「隐约可见」档；评论区输入框边框（lc-face-ctl 白 15%）被
       * 同化成 12%，肉眼无差 */
      ${pubBase}.lc-face-dark [data-lc-cmt-area],
      ${pubBase}.lc-face-dark [data-lc-cmt-area] *,
      ${sel}.lc-face-dark [data-lc-cmt-area],
      ${sel}.lc-face-dark [data-lc-cmt-area] * {
        border-color: rgba(255, 255, 255, 0.12) !important;
      }
      /* 「查看更多」分页钮（a.w-more2）：亮灰条是背景精灵图
       * （icon24.png），深膜规则换色换不掉背景图 → 去图换深膜底，圆角
       * 自补（原本由精灵图自带）；文字白 88% 已由上方通配规则覆盖 */
      ${pubBase}.lc-face-dark a.w-more2,
      ${sel}.lc-face-dark a.w-more2 {
        background-image: none !important;
        background-color: rgba(255, 255, 255, 0.1) !important;
        border-radius: 4px !important;
        transition: none !important;
      }
      ${pubBase}.lc-face-dark a.w-more2:hover,
      ${sel}.lc-face-dark a.w-more2:hover {
        background-color: rgba(255, 255, 255, 0.16) !important;
      }`
      : "";
    const color = dark
      ? lcFeedCardBg()
      : lightFrost
        ? `rgba(255, 255, 255, ${frostAlpha})`
        : "#fff";
    /* 首页卡片与站内其它卡片同圆角（两模式都跟随用户设置。
       2026-09-24 修：暗色原硬编码 12px（v1.0.0 遗留），导致暗色下调不了
       圆角而浅色正常——非刻意设计，随用户圆角走）；
       草稿页/审核中心固定 12px */
    const userRadius = ((settings.card && settings.card.radius) || 16) + "px";
    const scopes = [
      {
        name: "首页博文卡片（.isay 气泡结构）",
        /* 排除 tag 页台头/最新最热栏等容器型气泡（与 buildCSS 2671-2673 的排除一致，
           它们不是博文卡片，不该画卡片矩形/尖角/悬停放大） */
        sel:
          "#main > .m-mlist:has(> .mlistcnt .isay) > .mlistcnt" +
          ":not(:has(.tag-header-w)):not(:has(.m-tabbar)):not(:has(.isaym3))" +
          ":not(:has(.publishlayer))",
        radius: userRadius,
        hover: hoverZoom, /* 悬停整体轻微放大（原版效果，幅度 1.02；面板可关） */
      },
      {
        name: "草稿页 + 审核中心卡片（含 #listEmptyItem 空状态）",
        sel: "#main .post-history-item .m-mlist > .mlistcnt",
        radius: "12px",
      },
      {
        name: "自动发布页队列文章卡片（与草稿页同构 isayt/isaym/isaym2/isayb）",
        /* 队列卡在 #mainbox > .m-mlist 下（非 #main 直接子级），且与 zdfb 卡
           分属不同 .m-mlist，故用页面级锚点 #main:has(.m-zdfb) 限定只在
           自动发布页生效；zdfb 卡是 isayt3 结构，被 :has(> .isay .isayt) 排除 */
        sel: "#main:has(.m-zdfb) #mainbox .m-mlist > .mlistcnt:has(> .isay .isayt)",
        radius: "12px",
      },
      {
        name: "tag 页台头（磨砂+材质；无尖角无悬停，卡面贴边不腾头像区）",
        sel: "#main > .m-mlist:has(> .mlistcnt .tag-header-w) > .mlistcnt",
        radius: userRadius,
        noArrow: true,
        flush: true,
        stack: true,
      },
      {
        name: "tag 页最新/最热 tab 栏（磨砂+材质；无尖角无悬停）",
        sel: "#main > .m-mlist:has(> .mlistcnt .m-tabbar) > .mlistcnt",
        radius: userRadius,
        noArrow: true,
        flush: true,
        stack: true,
      },
    ];
    /* 他人喜欢页台头（「xx的喜欢」，#favpageheader > .mlistcnt > .isay >
       .isaym3）：不再进本管线（2026-10-02 改版）。原方案是宿主 ::before
       自绘整卡——但宿主盒比台头内容高出一截，卡面下缘与下方作品卡相接，
       材质关时还与 .isaym3 切片的实底叠成「两层卡片」（用户截图实锤）。
       现改为：宿主卡面由 buildCSS 排除规则统一 display:none（材质开关
       都藏），卡面由 .isaym3 切片自持——
         · 材质关：buildCSS 推荐卡片实底（浅 #fff / 暗预反色）原样保留；
         · 材质开：见下方「他人喜欢页台头切片材质补丁」，直接给 .isaym3
           上磨砂/材质面（与下方作品卡不相接的台头小卡）。
       （2026-09-29 的宿主自绘 scope——html #favpageheader.m-mlist +
       isolate 锁堆叠 + flush 贴边——连同 buildCSS 的 :not(#favpageheader)
       豁免一并作废：不再画宿主 ::before，无需堆叠上下文） */
    /* 首页发布栏（publishlayer）专属段：站点雪碧图气泡在暗色下会把头像
       包进去（浅色白底上结构不可见，控制台枚举实锤 isayt/isaym/isayb
       全宽 585px 是唯一残存画底者）。与博文卡同思路改为自绘：
       透明化切片 → ::before 画卡片矩形（左缘由 fixDraftBubble 量头像
       右缘写入 --lc-pub-left，让出头像）→ ::after 小尖角指向头像。
       注意：发布栏 .m-mlist 不是 #main 的直接子级（旧规则
       #main > .m-mlist .isayb 从未命中它可证），选择器不能带 #main >，
       用 html 前缀抬特异性即可 */
    const pubBase =
      "html .m-mlist:has(> .mlistcnt .publishlayer) > .mlistcnt";
    /* 工具栏悬停主题色：发布栏在 #main 反色区内，需写预反色值 */
    const pubAccent =
      settings.theme && settings.theme.accent
        ? computeDarkAccent(settings.theme.accent)
        : "#667eea";
    const pubCss = `
      /* ===== 首页发布栏：自绘头像外置气泡卡（浅暗两用） ===== */
      html .m-mlist:has(> .mlistcnt .publishlayer) .isay,
      html .m-mlist:has(> .mlistcnt .publishlayer) .isay > div,
      html .m-mlist:has(> .mlistcnt .publishlayer) .isayt,
      html .m-mlist:has(> .mlistcnt .publishlayer) .isaym,
      html .m-mlist:has(> .mlistcnt .publishlayer) .isayb,
      html .m-mlist:has(> .mlistcnt .publishlayer) .isayc {
        background: transparent !important;
        background-image: none !important;
      }
      ${pubBase} {
        position: relative !important;
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
      }
      ${pubBase}::before {
        content: "" !important;
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        left: var(--lc-pub-left, 96px) !important;
        background: ${color} !important;
        border-radius: 12px !important;
        box-shadow: ${lcFeedFaceShadow()} !important;
        ${frostCSS}
        z-index: -1 !important;
        pointer-events: none !important;
      }
      ${pubBase}:hover::before {
        transform: none !important;
        /* 悬停也保持卡面内阴影（高光描边）；同时继续压站点悬停阴影副作用 */
        box-shadow: ${lcFeedFaceShadow()} !important;
      }
      ${pubBase}::after {
        content: "" !important;
        position: absolute !important;
        top: 18px !important;
        left: var(--lc-pub-left, 96px) !important;
        transform: translateX(-100%) !important;
        width: 13px !important;
        height: 22px !important;
        background: ${color} !important;
        ${frostCSS}
        clip-path: polygon(0 50%, 100% 0, 100% 100%) !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      /* ===== 收起态发布栏（#publishBarArea 实底白卡 → 自绘卡面） =====
          白底唯一画在 #publishBarArea（2026-09-30 探针实锤：computed
          rgb(255,255,255) + radius 15px，栏内五个 .publishlink 是整张
          活动 PNG 的 <a>、无子元素，paints.self 再无他人）。在 #main
          反相区内，暗色被反相成纯黑 → 与展开态同思路：清站点实底，
          ::before 自绘画卡面（暗色 = 预反色深底不再是纯黑，浅色 =
          白/磨砂随卡片材质）。isolate 锁卡面：宿主无滤镜兜底的堆叠
          上下文，z-index:-1 会逃逸被内容层盖掉（favblog 台头同病） */
      html #publishBarArea {
        position: relative !important;
        isolation: isolate !important;
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
      }
      html #publishBarArea::before {
        content: "" !important;
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        background: ${color} !important;
        border-radius: ${userRadius} !important;
        box-shadow: ${lcFeedFaceShadow()} !important;
        ${frostCSS}
        z-index: -1 !important;
        pointer-events: none !important;
      }
      /* ===== 键位白砖消除：活动 PNG 自带纯白实底 =====
          2026-09-30 真机两轮实锤：①磨砂卡面上五键各一块白砖（图底
          烤死纯白非透明）；②mix-blend-mode:multiply 无效——隔离组内
          backdrop 是半透明白磨砂面，白×白=不透明白，blend 数学上
          走不通。改用 SVG 滤镜按亮度扣白（alpha = 1 − 亮度，
          sRGB 插值）：黑图标/文字保留、白底变透明，不依赖 backdrop、
          隔离组内外都成立；暗色经祖先反相图标自然变白。滤镜宿主
          SVG 由 fixDraftBubble 注入（不能 display:none，部分浏览器
          拒绝渲染引用滤镜），0×0 绝对定位。头像照片非白底、不在
          .publishlink 圈内，不受影响 */
      html #publishPostBar .publishlink {
        filter: url(#lc-knockout-white) !important;
      }
      /* ===== 深膜态（浅色模式 + 背景图偏暗）：随卡面自适应 =====
          lcUpdateFaceMaterial 对 #publishBarArea 采样，亮度低于阈值贴
          lc-pub-dark（与信息流卡 .lc-face-dark 同源同阈值，frost 保留）。
          图标是扣白后的黑色（浅色无祖先反相），深膜上必须反相成白 */
      html #publishBarArea.lc-pub-dark::before {
        background: rgba(22, 22, 26, 0.55) !important;
        background-color: rgba(22, 22, 26, 0.55) !important;
      }
      html #publishBarArea.lc-pub-dark .publishlink {
        filter: url(#lc-knockout-white) invert(1) !important;
      }
      /* ===== 浅色悬停主题色染色（材质开即接管，不依赖 faceAdapt） =====
          站点 :hover 换绿色活动 PNG，反相观感差，且绿底经扣白后是半透明
          混色 → 染出来的主题色发灰发暗（2026-09-30 作者反馈「比主题色
          暗一点」）。与暗色同法：钉回 base 图（字形与静息一致）+ accent-l
          滤镜（扣白 + feFlood 灌原始主题色）→ 字形内实色即精确主题色。
          材质关 = 原版观感，绿色悬停保留 */
      ${
        settings.card && settings.card.material
          ? `html #publishPostBar[data-lc-pub-imgs] .publishlink:hover {
        background-image: var(--lc-pub-img) !important;
        filter: url(#lc-knockout-accent-l) !important;
      }`
          : ""
      }
      /* ===== 加入合集下拉选中勾：清掉雪碧图，自绘主题色对勾 =====
          （浅暗两用；下拉面板在 #main 反色区内，暗色写预反色） */
      html .m-mlist:has(> .mlistcnt .publishlayer) .zlst .selected-icon {
        background: none !important;
        background-image: none !important;
        position: relative !important;
      }
      html .m-mlist:has(> .mlistcnt .publishlayer) .zlst .selected-icon::after {
        content: "" !important;
        position: absolute !important;
        left: 50% !important;
        top: 50% !important;
        width: 9px !important;
        height: 5px !important;
        border-left: 2px solid ${
          dark
            ? computeDarkAccent(settings.theme.accent || "#667eea")
            : settings.theme.accent || "#667eea"
        } !important;
        border-bottom: 2px solid ${
          dark
            ? computeDarkAccent(settings.theme.accent || "#667eea")
            : settings.theme.accent || "#667eea"
        } !important;
        transform: translate(-50%, -65%) rotate(-45deg) !important;
      }
      ${dark ? `
      /* ===== 暗色：编辑器与下方小栏目加细边框（避免糊成一整块） =====
          发布栏在反色区，边框写预反色 rgb(178,178,172)，
          反相后显示约 #4F4F55 浅灰细线 */
      html .m-mlist:has(> .mlistcnt .publishlayer) .edui-editor {
        border: 1px solid rgb(178, 178, 172) !important;
        border-radius: 8px !important;
      }
      html .m-mlist:has(> .mlistcnt .publishlayer) .edui-editor-toolbarboxouter {
        border-bottom: 1px solid rgb(178, 178, 172) !important;
      }
      html .m-mlist:has(> .mlistcnt .publishlayer) .tagArea,
      html .m-mlist:has(> .mlistcnt .publishlayer) .collectionArea,
      html .m-mlist:has(> .mlistcnt .publishlayer) .pcGiftArea {
        border-radius: 8px !important;
        /* inset 阴影画边框：零布局影响（border+padding 会挤动内部
            浮动元素，曾把加入合集的 .zdwn 箭头挤进回礼设置行） */
        box-shadow: inset 0 0 0 1px rgb(178, 178, 172) !important;
      }
      /* 回礼设置/创作声明两行之间的分割线 */
      html .m-mlist:has(> .mlistcnt .publishlayer) .pcGiftArea > div:first-child {
        border-bottom: 1px solid rgb(178, 178, 172) !important;
      }
      /* ===== 暗色：编辑器工具栏悬停跟随主题色 =====
          UEditor 悬停既有纯 CSS :hover 也有 JS 加的 edui-state-hover，
          两路都覆盖；背景写预反色主题色，反相后显示原主题色 */
      html .m-mlist:has(> .mlistcnt .publishlayer) .edui-toolbar .edui-button:hover .edui-button-body,
      html .m-mlist:has(> .mlistcnt .publishlayer) .edui-toolbar .edui-menubutton:hover .edui-button-body,
      html .m-mlist:has(> .mlistcnt .publishlayer) .edui-toolbar .edui-state-hover .edui-button-body,
      html .m-mlist:has(> .mlistcnt .publishlayer) .edui-toolbar .edui-state-hover .edui-menubutton-body {
        background: ${pubAccent} !important;
        background-image: none !important;
        border-radius: 4px !important;
      }
      /* ===== 暗色：展开时的背景遮罩 =====
          站点 .overlayer 是 .isay 的直接子 div，被上面的
          ".isay > div 透明化"误杀 → 暗色展开后主列两侧没有压暗底
          （浅色模式保留站点原样）。反色区内写预反色白 → 反相后即深色压暗层 */
      html .m-mlist:has(> .mlistcnt .publishlayer) .overlayer {
        background: rgba(255, 255, 255, 0.62) !important;
        background-image: none !important;
      }
      /* ===== 暗色：收起态按键悬停钉回原图 + 主题色染色 =====
          站点 :hover 换绿色活动 PNG（.m-nav2 .n21:hover 等五条
          background-image 规则，DevTools 实锤），反相后成怪异粉色。
          fixDraftBubble 已把每键 base 图 URL 写进 --lc-pub-img 并在
          栏上打 data-lc-pub-imgs 标记 → :hover 钉回原图；真机实锤
          钉回后与静息态同图、「悬停没颜色」→ 再叠 lc-knockout-accent
          滤镜（扣白 + feFlood 灌预反色主题色）把图标染成主题色；
          悬停位移反馈由既有下沉动画承担（lc-style）。钉图规则带标记
          才输出：var 未设时悬停会变空白键。
          特异性 html#…[data] .publishlink:hover = (1,3,1) 压站点
          .m-nav2 .n21:hover 的 (0,3,0) 与常驻扣白规则的 (1,1,2)。
          浅色保留站点绿色悬停不动 */
      html #publishPostBar[data-lc-pub-imgs] .publishlink:hover {
        background-image: var(--lc-pub-img) !important;
        filter: url(#lc-knockout-accent) !important;
      }
      ` : ""}
    `;
    const css =
      (dark
        ? `
      /* 覆盖 buildCSS 里字面量 #fff 的卡片底规则（#main > .m-mlist > .mlistcnt::before）：
         暗色滤镜会把 #fff 反相成纯黑 #000000，统一改为 #1F1F19 预置反色值。
         用 html 前缀抬高特异性，保证不受样式表注入顺序影响。 */
      html #main > .m-mlist > .mlistcnt::before {
        background: ${lcFeedCardBg()} !important;
      }
    `
        : "") +
      (settings.card && settings.card.material
        ? `
      /* ===== 他人喜欢页台头切片材质补丁（xx的喜欢；2026-10-02 改版） =====
         buildCSS 的「推荐卡片」规则（浅色 .isaym3:has(.m-ilike) 写 #fff
         实底 / 暗色 html #main .isaym3:has(.m-ilike) 写预反色）同时服务
         推荐页推荐卡，不能按开关删；这里用更高特异性
         （#favpageheader + .mlistcnt + :has = 1 id 3 class 1 type，
         压过暗色补丁的 1 id 2 class 1 type 与浅色的 0 id 2 class）
         把材质面直接写进台头切片 .isaym3（磨砂/半透明随材质，暗色
         预反色底与首页卡同源 lcFeedCardBg，阴影同 lcFeedFaceShadow）：
         宿主大卡已由 buildCSS 排除规则统一 display:none（材质开关都
         藏），台头只剩这张与下方作品卡不相接的小卡 */
      html #favpageheader > .mlistcnt .isaym3:has(.m-ilike) {
        background: ${color} !important;
        background-image: none !important;
        box-shadow: ${lcFeedFaceShadow()} !important;
        border-radius: ${userRadius} !important;
        ${frostCSS}
      }`
        : "") +
      scopes
        .map(
        ({ name, sel, list, radius, hover, noArrow, flush, stack, isolate }) => `
      /* ===== ${name} ===== */
      ${sel} {
        position: relative !important;
        /* stack/isolate：宿主必须自建堆叠上下文，::before 的 z-index:-1 才会被
           锁在卡内（垫到内容底下）。博文卡靠暗色滤镜的 filter 建立
           上下文，tag 页台头/tab 栏是 float 静态流，缺这条时 -1 会
           穿透到更外层，磨砂跑到容器卡背面（20260925s 用户截图实锤）。
           isolate 与 stack 的区别：只建上下文锁卡面，不做子面改造——
           供单块内容台头用（2026-09-29 favblog 台头：宿主无 filter 无
           isolation，-1 逃逸后卡面被页面层盖掉，浅暗两模式台头「消失」） */
        ${stack || isolate ? "isolation: isolate !important;" : ""}
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
      }
      /* 透明化原版气泡切片背景（含烙在图里的箭头）；站点暗色系统的内联
         背景由 fixDraftBubble() JS 移除，这里只管样式表层 */
      ${sel} .isay,
      ${sel} .isay > div,
      ${sel} .isayt, ${sel} .isayt3,
      ${sel} .isaym, ${sel} .isaym2, ${sel} .isaym3,
      ${sel} .isayb, ${sel} .isayc {
        background: transparent !important;
        background-image: none !important;
      }
      /* 切片上的伪元素装饰（原箭头/角标）隐藏，避免双箭头 */
      ${sel} .isayt3::before, ${sel} .isayt3::after,
      ${sel} .isaym3::before, ${sel} .isaym3::after {
        display: none !important;
      }
      /* 卡片矩形：左缘从内容区开始（JS 量切片偏移写入 --lc-bubble-left，
         量不出时 CSS 兜底 21px），长度不再包含原箭头区。
         阴影/悬停缩放来自通用卡片规则，气泡卡带尖角，缩放会让矩形与尖角
         错位，故统一为扁平（与草稿页一致），并覆盖通用规则的 #fff 白卡
         （暗色下会被滤镜反相成纯黑） */
      ${sel}::before {
        content: "" !important;
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        left: ${flush ? "0" : "var(--lc-bubble-left, 21px)"} !important;
        background: ${color} !important;
        border-radius: ${radius} !important;
        box-shadow: ${lcFeedFaceShadow()} !important;
        ${frostCSS}
        z-index: -1 !important;
        pointer-events: none !important;
      }
      ${sel}:hover::before {
        transform: none !important;
        /* 悬停也保持卡面内阴影（高光描边）；同时继续压站点悬停阴影副作用 */
        box-shadow: ${lcFeedFaceShadow()} !important;
      }
      ${frostInCSS}
      ${lcFaceAdaptCSS(sel)}
      ${stack
        ? `/* 台头/tab 栏子面（20260925u）：.m-tabbar 在 .isaym3.tag-header-w
         内、与 .m-itag 同卡（20260925t $0 探针实锤），整卡 ::before 是
         连续矩形——两块内容之间的空隙也盖着面，观感成「包裹台头和
         最新最热的大容器卡片」（用户要求隐藏）。改为子面：整卡面
         隐藏，.m-itag/.m-tabbar 各画各的磨砂面，空隙露出页面背景 */
      ${sel}::before {
        display: none !important;
      }
      ${sel} .m-itag,
      ${sel} .m-tabbar {
        position: relative !important;
        isolation: isolate !important;
        background: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
        border: none !important;
      }
      ${sel} .m-itag::before,
      ${sel} .m-tabbar::before {
        content: "" !important;
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        background: ${color} !important;
        border-radius: ${radius} !important;
        box-shadow: ${lcFeedFaceShadow()} !important;
        ${frostCSS}
        z-index: -1 !important;
        pointer-events: none !important;
      }`
        : ""}
      ${stack
        ? `/* 台头/tab 栏内部站点背景清透（20260925t，T2 控制台实证）：
         管线的透明化规则只覆盖 .isay 家族，台头 .m-itag/.m-activity
         与最新最热栏 .m-tabbar 自身的白底/雪碧图会把卡面压在下面
         ——「磨砂做在卡片背面」真凶。注意 .m-tabbar 就在
         .isaym3.tag-header-w 内（同一张卡）；.a-w-sel 的下拉面板
         底（selc/selcc）不能动，那是「全部」展开的暗底 */
      ${sel} .m-itag,
      ${sel} .m-activity,
      ${sel} .itagfav,
      ${sel} .itagt,
      ${sel} .m-tabbar,
      ${sel} .tab-w,
      ${sel} .recommend-type-wrap,
      ${sel} .update-time {
        background: transparent !important;
        background-image: none !important;
      }`
        : ""}
      ${stack
        ? `/* 深膜下子面换膜色：lcFaceAdaptCSS 的膜色规则挂在
         ${sel}::before（已 display:none），子面要单独覆盖。
         无条件输出（同 lcFaceAdaptCSS）：靠 JS 加 .lc-face-dark
         类切换——dark 只代表全站暗色模式，别拿它当开关
         （20260925v 修：浅色模式下深膜子面失效真凶） */
      ${sel}.lc-face-dark .m-itag::before,
      ${sel}.lc-face-dark .m-tabbar::before {
        background: rgba(22, 22, 26, 0.55) !important;
        background-color: rgba(22, 22, 26, 0.55) !important;
      }
      /* 深膜下 tab 链接白字：.m-tabbar 在 .tag-header-w 内，但
         lcFaceAdaptCSS 的白字清单只覆盖 .a-w-sel 区域，最新/最热
         链接会留在深色（白底清掉后黑字在深膜上看不见） */
      ${sel}.lc-face-dark .m-tabbar .tab-w a,
      ${sel}.lc-face-dark .m-tabbar .update-time {
        color: rgba(255, 255, 255, 0.92) !important;
      }`
        : ""}
      ${hover
        ? `/* 悬停轻微放大：scale 加在卡片整体上，矩形+尖角作为整体等比缩放不错位
         （通用规则只 scale ::before 矩形，会与尖角错位，已在上面禁掉）。
         ★ 2026-09-23 修「悬停放大抖不停 + 卡内『收起』点不到」（长文/长图卡
         展开评论区后必现，短卡因底边伸出量 ≈ 卡距最多「相接」故看不出）：
         ① transform-origin 取**底边**（本次修复的真正关键）：卡片向上生长，
            底边与卡内底部（含「收起」键、评论输入框、评论工具行）位置恒定
            —— 不再成为「移动靶」，也不向下覆盖下一张卡。居中缩放时底边会
            下移 1% 卡高，长卡下移几十 px 压到下一张卡身上，光标贴底时命中
            在「本卡 ↔ 下卡」之间来回翻转 → 放大抖不停、按钮点不中。
            原点必须写在**静息态**，写进 :hover 会因 scale(1)→none 插值途中
            换原点而闪一下。
         ② 驱动盒保持 .mlistcnt:hover 本身（**不**换成外层 .m-mlist）。
            ★ 2026-09-23 三修：首版曾把驱动盒换成外层单元盒 .m-mlist，真机
            反馈「判定范围被扩大，作者头像下方的空白处也能触发放大」。
            无头实测证实（tools/debug-hover-area.js，pad 结构 = 卡外留白挂在
            外层盒上）：外层驱动在下卡盒外 +3/+7px 的空白处仍触发 scale≈1.02，
            而驱动盒取自身时那些点位 scale=1.000（不放大）。原因是外层
            .m-mlist 的盒常比卡盒大（站点把间距/留白挂在这一层），悬停判定
            跟着变大；副作用是该层被 hover 时整单元子树（含评论容器）一起进
            样式重算。既然①已从根上消掉底边反馈环，就不必再引入②这条额外
            风险了。 */
      ${sel} {
        /* ★ 2026-09-23 四修：缓动换 ease-out（时长 0.25 → 0.22s）。
           旧曲线 cubic-bezier(0.4, 0, 0.2, 1) 是 Material 标准曲线，**起步斜率为 0**
           —— 真机观感就是「鼠标进去先愣一下才动」。逐帧实测（tools/debug-hover-motion.js：
           真实生成 CSS + 2764px 长卡 + 逐帧采样 scale）同一口径下：
             旧曲线 启动延迟 33ms、可见动作 183ms，第一帧只走到 5%，到 60ms 才 13%；
             ease-out 启动延迟 14ms、可见动作 117ms，第一帧即 31%，
             之后单帧 25/17/11/6/4/3/1% 一路减速 —— 一次到位的扫动，
             而不是「动一点、顿一下、再动一点」的观感。
           同批实测顺带否掉了两个想当然的改法（**改了没用，别再加**）：
             ✗ 原点回退居中：底边与居中两种原点下，全部指标逐项相同（33ms/183ms/18ms），
               原点与开销无关 —— 想靠回退原点治卡顿，只会把「放大后与下卡重叠、
               卡内『收起』点不到」的老 bug 带回来；
             ✗ will-change: transform（写静息态或仅 hover 都测了）：与不加逐项相同
               （117ms/17ms），白让每张卡长期占一个合成层。
           即真正该动的是**缓动曲线**，不是锚点、也不是提升图层。 */
        transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1) !important;
        transform-origin: 50% 100% !important;
      }
      /* ★ 2026-09-23 二修：去掉「抬起被悬停卡」的 position/z-index。
         层序本来就够：被悬停卡文档序在上一张卡之后，同 z-index 下即画在对方
         上层——用 elementFromPoint 在两张卡的几何重叠带取命中归属实测，
         不加 z-index 归属仍是本卡（见 tools/debug-hover-perf.js 的「重叠带层序」列）。
         反过来，把 position:relative 写进 :hover 会改掉卡内绝对定位后代的
         包含块 → **每次悬停移入/移出都强制整卡子树重排一次**（无头实测：4 轮
         悬停布局次数 12 → 8，悬停起手多掉一帧）。同理**不要**加
         will-change:transform：把 800×2945 的整卡提升为合成层要重光栅化整张卡，
         磨砂档实测反而更贵（4 轮主线程 203 → 219ms）。 */
      ${sel}:hover {
        transform: scale(1.02) !important;
      }`
        : ""}
      /* 左侧尖角：宽度=箭头区宽度，比其多伸 1px 进卡片补尖端亚像素缝
         （与卡片同色不可见）。用 clip-path 三角而非 border 三角：
         磨砂开启时卡面有 backdrop-filter，border 三角画不了模糊、
         背景直接透上来，观感比卡面「透」一截（20260926 用户截图实锤）；
         clip-path 元素可以带同款磨砂，与卡面材质一致 */
      ${sel}::after {
        ${noArrow ? "display: none !important;" : ""}
        content: "" !important;
        position: absolute !important;
        top: 12px !important;
        left: 0 !important;
        width: calc(var(--lc-bubble-left, 21px) + 1px) !important;
        height: calc(var(--lc-bubble-left, 21px)) !important;
        background: ${color} !important;
        ${frostCSS}
        clip-path: polygon(0 50%, 100% 0, 100% 100%) !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      /* 无头像（同一作者第二条 / 审核中心空状态）→ 不画箭头（JS 判定后加 .lc-no-arrow） */
      ${sel}.lc-no-arrow::after {
        display: none !important;
      }
      /* ===== 长文章卡片（.m-long-post-icnt）===== */
      ${sel} .m-icnt.m-long-post-icnt {
        overflow: hidden !important;
        border-radius: ${radius} !important;
      }
      ${sel} .m-icnt.m-long-post-icnt,
      ${sel} .m-icnt.m-long-post-icnt .cnt,
      ${sel} .m-icnt.m-long-post-icnt .desc,
      ${sel} .m-icnt.m-long-post-icnt .more {
        background: transparent !important;
      }
      /* .banner 受插件暗色系统旧规则 html body .g-bd .banner 影响
         （底色 rgba(28,28,34,.98) + padding 24px 画外框，图片只能填在内侧），
         这里用带 #main 的更高特异性整体覆盖：去底色/边距/阴影，
         让封面图顶格铺满 banner，不留外框 */
      ${sel} .m-icnt.m-long-post-icnt .banner {
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
        background-color: transparent !important;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        border-radius: ${radius} !important;
        overflow: hidden !important;
      }
      ${sel} .m-icnt.m-long-post-icnt .banner .pic {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        object-fit: cover !important;
      }
    `,
      )
      .join("\n") +
    pubCss;
    /* 先拼字符串再落 DOM：模板抛错时旧样式表原样保留（此前元素先建、
       内容后填，抛错就留下一张空表 → 卡片整体回落通用 #fff 白实底，
       且因为写入点永远到不了，旧表残留表现为「再开启无任何变化」） */
    let sheet = el;
    if (!sheet) {
      sheet = document.createElement("style");
      sheet.id = "lc-bubble-cards";
      (document.head || document.documentElement).appendChild(sheet);
    }
    if (sheet.textContent !== css) sheet.textContent = css;
    /* 卡面自适应材质：重建样式表后立即强制重采样。不能指望 observer——
       第二次开启时 applyAll 各函数幂等直通，常常不产生任何 #main 变动，
       observer 不触发，类名停留在「关闭时清理过的空状态」，表现为
       「再开启没反应」。gate 自会处理关闭/暗色分支的清理；force 绕过
       400ms 节流（本函数只在设置变更/首次注入时跑一次，不是热路径） */
    lcSafe(() => lcUpdateFaceMaterial(true));
    /* 首跑不依赖 observer：fixDraftBubble 原本只挂在 MutationObserver
       回调与 resize 上，静态首屏（如收起态发布栏钉图、切片量测）要等
       第一次 #main 变动才生效。函数幂等（dataset 标记），直跑零风险 */
    lcSafe(fixDraftBubble);
  }

  /* 草稿页/审核中心气泡 JS 侧处理（浅暗通用）：
     1) 清站点内联背景（内联 !important 压过样式表，只能 JS 移除）
     2) 量切片横向偏移 → --lc-bubble-left（卡片矩形左缘位置）
     3) 几何法判定有无头像 → .lc-no-arrow（无头像不画箭头） */
  function fixDraftBubble() {
    if (!settings.enabled) return;
    const bases = [
      "#main > .m-mlist:has(> .mlistcnt .isay) > .mlistcnt" +
        ":not(:has(.tag-header-w)):not(:has(.m-tabbar)):not(:has(.isaym3))" +
        ":not(:has(.publishlayer))",
      "#main .post-history-item .m-mlist > .mlistcnt",
      /* 自动发布页队列文章卡片（与 ensureBubbleCards 第三作用域一致） */
      "#main:has(.m-zdfb) #mainbox .m-mlist > .mlistcnt:has(> .isay .isayt)",
    ];
    bases.forEach((base) => {
      document
        .querySelectorAll(
          base + ", " +
          base + " .isay, " +
          base + " .isay > div, " +
          base + " .isaym2, " +
          base + " .isayc",
        )
        .forEach((el) => {
          ["background", "background-image", "background-color"].forEach((k) => {
            if (el.style.getPropertyValue(k)) el.style.removeProperty(k);
          });
        });
      document.querySelectorAll(base).forEach((cnt) => {
        /* 已量过就跳过：首页卡片多且无限滚动，避免每批变异都强制布局
           （窗口尺寸变化时会清标记重量，见 startBubbleObserver） */
        if (cnt.dataset.lcBubbleDone === "1") return;
        const cntLeft = cnt.getBoundingClientRect().left;
        let d = 0;
        cnt
          .querySelectorAll('.isayt3, .isaym, .isaym3, .isayt, .isayb')
          .forEach((s) => {
            const off = s.getBoundingClientRect().left - cntLeft;
            if (off > d) d = off;
          });
        if (d > 0) cnt.style.setProperty('--lc-bubble-left', d.toFixed(1) + 'px');

        /* 几何法判定：.m-mlist 里除 .mlistcnt 外，若存在位于卡片左外侧的
           可见实体元素（宽高≥15px 且右缘不越过卡片左缘），即头像 */
        const wrap = cnt.parentElement;
        let hasAvatar = false;
        for (const child of wrap.children) {
          if (child === cnt) continue;
          const r = child.getBoundingClientRect();
          if (r.width < 15 || r.height < 15) continue;
          if (r.right <= cntLeft + 5) {
            hasAvatar = true;
            break;
          }
          for (const sub of child.querySelectorAll('*')) {
            const sr = sub.getBoundingClientRect();
            if (sr.width >= 15 && sr.height >= 15 && sr.right <= cntLeft + 5) {
              hasAvatar = true;
              break;
            }
          }
          if (hasAvatar) break;
        }
        cnt.classList.toggle('lc-no-arrow', !hasAvatar);
        cnt.dataset.lcBubbleDone = "1";
      });
    });

    /* 首页发布栏：量头像（.mlistimg，.m-mlist 里 .mlistcnt 的兄弟节点）
       右缘 → --lc-pub-left，卡片矩形左缘让出头像、尖角指向头像。
       与通用 bases 不同：发布栏头像叠在卡片左上（不在卡片左外侧），
       通用切片偏移量测全为 0，必须单独量头像 */
    document
      .querySelectorAll(
        ".m-mlist:has(> .mlistcnt .publishlayer) > .mlistcnt",
      )
      .forEach((cnt) => {
        const cntLeft = cnt.getBoundingClientRect().left;
        const img =
          cnt.parentElement && cnt.parentElement.querySelector(".mlistimg");
        let left = 96;
        if (img) {
          const r = img.getBoundingClientRect();
          if (r.width >= 15) left = Math.max(r.right - cntLeft + 14, 60);
        }
        cnt.style.setProperty("--lc-pub-left", left.toFixed(1) + "px");
      });

    /* 键位白砖消除的滤镜宿主：活动 PNG 白底按亮度扣透明
       （alpha = 1 − 亮度，sRGB 插值；推导与取舍见 pubCss 段注释）。
       幂等注入；SVG 不能 display:none（部分浏览器拒绝渲染被引用的
       滤镜），0×0 绝对定位零占位。
       第二个滤镜 lc-knockout-accent 供暗色悬停染色：扣白后 feFlood
       灌预反色主题色（computeDarkAccent）+ feComposite in 按扣白
       alpha 合成 → 悬停图标变主题色。
       第三个 lc-knockout-accent-l 供浅色悬停染色，灌原始主题色
       （浅色无祖先反相）。
       主题色/亮度可变 → data-lc-accent / data-lc-accent-l 记录当前
       值，变更时重建 */
    const NS_SVG = "http://www.w3.org/2000/svg";
    const KNOCKOUT_MATRIX =
      "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -0.2126 -0.7152 -0.0722 1 0";
    const pubAccentRaw = (settings.theme && settings.theme.accent) || "#667eea";
    /* 暗色祖先滤镜是 invert+hue-rotate+brightness(b)（buildCSS 的 #main
       反色规则，b = 暗色亮度设置，默认 90%）。computeDarkAccent 只逆了
       invert + hue-rotate：T(x) = 1 − HR(x) 与自身互逆，但祖先还会整体
       乘 b → 直接灌 T(accent) 显示出来是 0.9×accent（真机 2026-09-30
       作者反馈「悬停色比主题色暗一点」）。把目标色先除以 b 再走 T：
       b·T(T(accent/b)) = accent，显示即精确主题色（超出色域的上限夹取，
       仅极饱和蓝紫略有 1~2% 出入） */
    const lcDarkB = Math.min(
      1,
      Math.max(
        0.3,
        ((settings.darkMode && settings.darkMode.brightness) || 90) / 100,
      ),
    );
    const lcBoostHex = (hex) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex) || lcDarkB >= 0.999) return hex;
      const cl = (v) =>
        Math.max(0, Math.min(255, Math.round(v / lcDarkB)))
          .toString(16)
          .padStart(2, "0");
      return (
        "#" +
        cl(parseInt(hex.slice(1, 3), 16)) +
        cl(parseInt(hex.slice(3, 5), 16)) +
        cl(parseInt(hex.slice(5, 7), 16))
      );
    };
    const pubAccentHover = computeDarkAccent(lcBoostHex(pubAccentRaw));
    const pubAccentLight = pubAccentRaw;
    /* ⚠️ 宿主 id 必须与滤镜 id 不同：getElementById 找宿主时若用滤镜 id，
       第二轮 fixDraftBubble（observer 高频触发）会找到滤镜元素本身 →
       清空它的 feColorMatrix 并往滤镜里嵌套滤镜，常驻扣白变空壳
       （真机 2026-09-30 实锤：暗色悬停 accent 正常、其余全回白砖） */
    let koSvg = document.getElementById("lc-knockout-host");
    if (!koSvg) {
      koSvg = document.createElementNS(NS_SVG, "svg");
      koSvg.setAttribute("id", "lc-knockout-host");
      koSvg.setAttribute("width", "0");
      koSvg.setAttribute("height", "0");
      koSvg.style.position = "absolute";
      (document.body || document.documentElement).appendChild(koSvg);
    }
    if (
      koSvg.dataset.lcAccent !== pubAccentHover ||
      koSvg.dataset.lcAccentL !== pubAccentLight
    ) {
      koSvg.dataset.lcAccent = pubAccentHover;
      koSvg.dataset.lcAccentL = pubAccentLight;
      /* 逐节点构建（createElementNS）：innerHTML 写 SVG 在浏览器没问题，
         但 jsdom 的 HTML 解析器会把 <filter> 包装层吃掉，回归测不了 */
      while (koSvg.firstChild) koSvg.removeChild(koSvg.firstChild);
      const mkFilter = (id, flood) => {
        const f = document.createElementNS(NS_SVG, "filter");
        f.setAttribute("id", id);
        f.setAttribute("color-interpolation-filters", "sRGB");
        const cm = document.createElementNS(NS_SVG, "feColorMatrix");
        cm.setAttribute("type", "matrix");
        cm.setAttribute("values", KNOCKOUT_MATRIX);
        f.appendChild(cm);
        if (flood) {
          cm.setAttribute("result", "ko");
          const fl = document.createElementNS(NS_SVG, "feFlood");
          fl.setAttribute("flood-color", flood);
          fl.setAttribute("result", "fl");
          const comp = document.createElementNS(NS_SVG, "feComposite");
          comp.setAttribute("in", "fl");
          comp.setAttribute("in2", "ko");
          comp.setAttribute("operator", "in");
          f.appendChild(fl);
          f.appendChild(comp);
          /* 字形 alpha 增益：活动图最暗像素只有 #585E62（luma 0.36，
             2026-09-30 下载原件实测：92.1% 纯白 + 最暗 0.36），扣白后
             alpha 上限 = 1−0.36 = 0.64 → 灌进去的主题色最多 64% 不透明，
             观感发灰发闷（叠深色磨砂上即「比主题色暗一点」）。slope 1.6
             把 0.64 提到 1.0，抗锯齿边缘按比例增强，白底 alpha 0 仍是 0。
             RGB 不动——只提不透明度，不改色相 */
          const tr = document.createElementNS(NS_SVG, "feComponentTransfer");
          const fa = document.createElementNS(NS_SVG, "feFuncA");
          fa.setAttribute("type", "linear");
          fa.setAttribute("slope", "1.6");
          fa.setAttribute("intercept", "0");
          tr.appendChild(fa);
          f.appendChild(tr);
        }
        koSvg.appendChild(f);
      };
      mkFilter("lc-knockout-white", null);
      mkFilter("lc-knockout-accent", pubAccentHover);
      mkFilter("lc-knockout-accent-l", pubAccentLight);
    }

    /* 收起态发布栏：把每个按键的 base 背景图 URL 写进 --lc-pub-img，
       供暗色 :hover 钉回原图（站点 hover 换绿色活动 PNG，反相后观感
       差；URL 带活动时间戳会轮换，不能写死在 CSS——2026-09-30 探针
       实锤 Frame%20…-1.png）。全部取到后在栏上打 data-lc-pub-imgs
       标记，CSS 侧据此才输出钉图规则（防 var 未设时悬停变空白键）。
       悬停中的键 computed background-image 会读到悬停图 → 跳过本轮
       （observer 会带下一轮，标记未打不影响其它键）。发布栏在 #main
       内，observer 覆盖得到；标记幂等，重复跑零成本 */
    document.querySelectorAll("#publishPostBar").forEach((bar) => {
      if (bar.dataset.lcPubImgs) return;
      const links = bar.querySelectorAll(".publishlink");
      if (!links.length) return;
      let ok = true;
      links.forEach((a) => {
        if (a.matches(":hover")) { ok = false; return; }
        const img = getComputedStyle(a).backgroundImage;
        if (!img || img === "none") { ok = false; return; }
        a.style.setProperty("--lc-pub-img", img);
      });
      if (ok) bar.dataset.lcPubImgs = "1";
    });

    /* 自动发布页大卡（m-zdfb）与空状态卡（m-end）：量切片左偏移写入
       --lc-zdfb-left，卡片矩形左缘与下方队列卡的气泡对齐
       （CSS 侧 margin-left/width 引用该变量，回退 21px） */
    document
      .querySelectorAll(
        '#main .mlistcnt .isay:has(.m-zdfb), #main .mlistcnt .isay:has(.m-end)',
      )
      .forEach((isay) => {
        const cnt = isay.closest('.mlistcnt');
        if (!cnt) return;
        const cntLeft = cnt.getBoundingClientRect().left;
        let d = 0;
        isay.querySelectorAll('.isayt3, .isaym3, .isayb').forEach((s) => {
          const off = s.getBoundingClientRect().left - cntLeft;
          if (off > d) d = off;
        });
        if (d > 0) isay.style.setProperty('--lc-zdfb-left', d.toFixed(1) + 'px');
      });
  }

  /* 气泡卡片观察器（全局只启动一次，浅暗共用） */
  let _bubbleRaf = 0;
  let _bubbleObserver = null;
  function startBubbleObserver() {
    if (_bubbleObserver) return;
    _bubbleObserver = new MutationObserver(() => {
      if (_bubbleRaf) return;
      _bubbleRaf = requestAnimationFrame(() => {
        _bubbleRaf = 0;
        fixDraftBubble();
        lcSafe(lcUpdateFaceMaterial); /* 新卡片进场后补采样（内部 400ms 节流） */
      });
    });
    _bubbleObserver.observe(document.querySelector('#main') || document.body, { childList: true, subtree: true });

    /* 窗口尺寸变化 → 卡片宽度/切片偏移变化，清标记重量一次 */
    let _bubbleResizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(_bubbleResizeTimer);
      _bubbleResizeTimer = setTimeout(() => {
        document
          .querySelectorAll('[data-lc-bubble-done]')
          .forEach((el) => delete el.dataset.lcBubbleDone);
        fixDraftBubble();
      }, 200);
    });
  }

  /* ---------- 右侧栏滚动跟随守卫（仅暗色） ----------
     站点 JS 滚动时给 slide-bar 内的混淆类名 DIV 加 position:fixed 实现
     跟随，但暗色下其祖先带 filter 会把 fixed 改为相对该祖先定位而错位。
     跟随改由暗色 CSS 的 #rside sticky 实现（sticky 不受 filter 影响）；
     这里只负责把站点加的 fixed 钉回 static（站点每次滚动可能重新设置，
     内联赋值会覆盖我们的 important，所以每次 scroll 都要重新钉一遍）。
     浅色模式不干预。 */
  let _rsideGuardBound = false;
  let _rsideGuardRaf = 0;
  function neutralizeRsideFixed() {
    const rside = document.getElementById("rside");
    if (!rside) return;
    rside.querySelectorAll("*").forEach((el) => {
      if (getComputedStyle(el).position !== "fixed") return;
      el.dataset.lcNoFix = "1";
      el.style.setProperty("position", "static", "important");
    });
  }
  function clearRsideFixedGuard() {
    /* 切回浅色时撤掉我们钉的 static，把控制权还给站点 JS */
    document.querySelectorAll("#rside [data-lc-nofix]").forEach((el) => {
      el.style.removeProperty("position");
      delete el.dataset.lcNoFix;
    });
  }
  function bindRsideFixedGuard() {
    if (_rsideGuardBound) return;
    _rsideGuardBound = true;
    const onScroll = () => {
      if (_rsideGuardRaf) return;
      _rsideGuardRaf = requestAnimationFrame(() => {
        _rsideGuardRaf = 0;
        if (isDarkMode()) neutralizeRsideFixed();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* ---------- 暗色蒙版 ---------- */
  function isDarkMode() {
    const mode = settings.darkMode.mode || "off";
    if (mode === "auto")
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    return mode === "manual";
  }

  function applyDarkOverlay() {
    const existing = document.getElementById("lc-dark-overlay");
    if (existing) existing.remove();
  // 非暗色时清除卡片样式
  if (!settings.enabled || !isDarkMode()) {
    const darkCards = document.getElementById('lc-dark-cards');
    if (darkCards) darkCards.remove();
  //清除右侧栏内联样式
  document.querySelectorAll('#rside [class*="box-web"]').forEach(el => {
    el.style.removeProperty('background-color');
  });
  //撤掉暗色期间钉的 position:static，跟随交还站点 JS
  clearRsideFixedGuard();
    return;
  }
    if (!settings.enabled || !isDarkMode()) return;

    const overlay = document.createElement("div");
    overlay.id = "lc-dark-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:-1;background:rgba(0,0,0,0.55);";
    (document.body || document.documentElement).appendChild(overlay);

    /* 右侧栏 fixed 守卫：暗色下站点 JS 滚动时给 slide-bar 内元素加
       position:fixed，会被祖先 filter 劫持错位——每次滚动钉回 static
       （跟随由暗色 CSS #rside sticky 实现；tag 页已被 body:has 排除）。
       注意：这里原先调用的 startRsideFollowObserver/fixRsideFollow
       是没有定义的死引用，会让本函数在创建 #lc-dark-cards 之前抛
       ReferenceError 中断，导致全部暗色卡片预反色规则静默失效 */
    bindRsideFixedGuard();
    neutralizeRsideFixed();

    /* ---------- 暗色模式下链接悬停修复 ---------- */
    const fixHoverLinks = () => {
      document.querySelectorAll('.postwrapper .day a, .postwrapper .text h2 a, .postwrapper .link a, .selfinfo h1 a').forEach(el => {
        if (el.dataset.hoverFixed) return;
        el.dataset.hoverFixed = '1';
        el.addEventListener('mouseenter', () => {
  // 暗色：postwrapper 在反色滤镜区内，写预反色变体（终显正常主题色）；
  // 浅色：无滤镜，直接用原始主题色（此前不判断模式，浅色悬停被写成暗紫）
  const accent = isDarkMode()
    ? (computeDarkAccent(settings.theme.accent) || '#dfc7e6')
    : (settings.theme.accent || '#667eea');
  setStyleIfChanged(el, 'color', accent, 'important');
});
        el.addEventListener('mouseleave', () => {
          el.style.removeProperty('color');
        });
      });
    };
    fixHoverLinks();

    /* rAF 节流：避免 #main 每批变异都同步全量扫描链接 */
    let _fhlRaf = 0;
    const hoverObserver = new MutationObserver(() => {
      if (_fhlRaf) return;
      _fhlRaf = requestAnimationFrame(() => {
        _fhlRaf = 0;
        fixHoverLinks();
      });
    });
    hoverObserver.observe(document.querySelector('#main') || document.body, { childList: true, subtree: true });

    /* ---------- 暗色模式下卡片背景色修复 ---------- */
    // 右侧栏 box-web
    // ⚠️ 侧栏玻璃开启时必须跳过：这是预反色值，反色让位后原样显示成
    //    米白底（2026-09-21 探针实证：inline 样式优先级压住玻璃膜规则）。
    //    且要回收旧 inline——关玻璃→开玻璃切换后残留值不会自己消失。
    if (!lcSideGlassOn()) {
      document.querySelectorAll('#rside [class*="box-web"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 50) {
          el.style.setProperty('background-color', 'rgb(225, 225, 219)', 'important');
        }
      });
    } else {
      document.querySelectorAll('#rside [class*="box-web"]').forEach(el => {
        if (el.style.backgroundColor === 'rgb(225, 225, 219)')
          el.style.removeProperty('background-color');
      });
    }

    /* ---------- 暗色模式下卡片背景色统一注入 ---------- */
    let darkCardStyle = document.getElementById('lc-dark-cards');
    if (!darkCardStyle) {
      darkCardStyle = document.createElement('style');
      darkCardStyle.id = 'lc-dark-cards';
      document.head.appendChild(darkCardStyle);
    }
    darkCardStyle.textContent = `
      /* 首页 + 草稿页/合集内部页卡片（放宽 #main > 前缀，无 #main 包裹的页面也能命中）。
         :not 排除容器型气泡（通知 slide isaym3.mtag / tag 页台头 / 最新最热栏，
         与 buildCSS 常驻区排除一致——它们由 .isaym3 自绘卡片，::before 叠上去
         就是"多出一块底"） */
      .m-mlist > .mlistcnt:not(:has(.isaym3)):not(:has(.tag-header-w)):not(:has(.m-tabbar)):not(:has(.publishlayer)) {
        position: relative !important;
      }
      .m-mlist > .mlistcnt:not(:has(.isaym3)):not(:has(.tag-header-w)):not(:has(.m-tabbar)):not(:has(.publishlayer))::before {
        content: "" !important;
        position: absolute !important;
        inset: 0 !important;
        background: ${lcFeedCardBg()} !important;
        /* 2026-09-24 修：原硬编码 12px，暗色调不了圆角；改随卡片圆角设置 */
        border-radius: ${((settings.card && settings.card.radius) || 16)}px !important;
        box-shadow: ${lcFeedFaceShadow()} !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      /* 合集内部页"暂无文章"空状态卡片：固定 12px 圆角（不跟随卡片圆角设置），
         颜色 #1F1F19（写 rgb(225,225,219)，经 invert+hue-rotate 后显示为 #1F1F19；
         rgb(224,224,230) 会因 hue-rotate 矩阵偏移显示成 #1E1E24，勿用） */
      #listEmptyItem > .mlistcnt::before {
        background: rgb(225, 225, 219) !important;
        border-radius: 12px !important;
      }
      /* 草稿页/审核中心卡片的气泡自绘已迁移到 #lc-bubble-cards（浅暗两用），
         见 ensureBubbleCards() */
      /* 自动发布页两张卡片（m-zdfb/m-end）的暗色适配已并入 buildCSS
         「定时发布页时间卡片修复（所有模式）」块（浅暗统一处理） */
      /* 个人主页卡片 */
      .postwrapper .block {
        background-color: rgb(225, 225, 219) !important;
      }
      /* tag页卡片 */
      #main .m-itag {
        background-color: rgb(225, 225, 219) !important;
      }
      /* tag页最新最热 */
      #main .m-tabbar {
        background-color: rgb(225, 225, 219) !important;
      }
      /* tag页台头/最新最热：透明化站点白色气泡切片（.isayt3/.isaym3，
         自绘卡片管线刻意排除 tag-header 导致切片露出，白图经反相成
         纯黑的元凶）；卡片底色由上方 .m-itag/.m-tabbar 预反色规则提供。
         html 前缀抬特异性，防站点样式反压 */
      html .isay:has(> .isaym3.tag-header-w) > .isayt3,
      html .isay > .isaym3.tag-header-w,
      html .isay:has(> .isaym3.tag-header-w) > .isayt3::before,
      html .isay:has(> .isaym3.tag-header-w) > .isayt3::after,
      html .isay > .isaym3.tag-header-w::before,
      html .isay > .isaym3.tag-header-w::after {
        background: transparent !important;
        background-image: none !important;
      }
      html #main .m-itag,
      html #main .m-tabbar {
        background-color: rgb(225, 225, 219) !important;
      }
      /* tag页最热榜单下拉面板：面板处于全局反相滤镜区内，浅色管线的
         白底被反相成纯黑、popupText 的白字反相成黑字（2026-09-25 实锤：
         纯黑面板看不到文字）。预反色写法：底 rgb(225,225,219) 反相后
         ≈ #1F1F19 与其他卡片一致；文字预反深灰反相后浅白。组件根只在
         悬停（展开态）画，收起态不画（防收起阴影露出横线，与浅色同理，
         且阴影经反相成白晕更明显） */
      html .tag-header-w .a-w-sel .selc,
      html .tag-header-w .a-w-sel .selcc {
        background-color: rgb(225, 225, 219) !important;
      }
      html .tag-header-w .a-w-sel:hover {
        background-color: rgb(225, 225, 219) !important;
        box-shadow: none !important;
      }
      html .tag-header-w .a-w-sel span,
      html .tag-header-w .a-w-sel li,
      html .tag-header-w .a-w-sel a,
      html .tag-header-w .a-w-sel div,
      html .tag-header-w .a-w-sel em {
        color: rgb(28, 28, 32) !important;
      }
      html .tag-header-w .a-w-sel a:hover,
      html .tag-header-w .a-w-sel a:hover span {
        color: rgb(8, 8, 10) !important;
      }
      /* 选中勾：浅色管线写的主题色在反相区会变色（用户截图里的紫色勾），
         换预反色变体（computeDarkAccent 同暗色悬停链接口径） */
      html .tag-header-w .selected-icon::after {
        border-left-color: ${computeDarkAccent(settings.theme.accent) || "#dfc7e6"} !important;
        border-bottom-color: ${computeDarkAccent(settings.theme.accent) || "#dfc7e6"} !important;
      }
      /* tag页右侧参与用户 */
#rside .m-menu:has(.participate-user-title-w) {
  background-color: rgb(225, 225, 219) !important;
  background: rgb(225, 225, 219) !important;
}
#rside .m-menu:has(.participate-user-title-w) .participate-user-title {
  background-color: rgb(225, 225, 219) !important;
}
#rside .m-menu:has(.participate-user-title-w) .mtag li {
  background-color: rgb(225, 225, 219) !important;
}
/* 参与用户内层：站点白底画在 .menum/ul/li 上，反相成纯黑盖住灰色
   父层——统一预反色 + 杀雪碧图（html 前缀抬特异性） */
html #rside .m-menu:has(.participate-user-title-w) .menum,
html #rside .m-menu:has(.participate-user-title-w) .menum ul,
html #rside .m-menu:has(.participate-user-title-w) .menum ul li {
  background: rgb(225, 225, 219) !important;
  background-image: none !important;
}
      /* tag页右侧参与用户（真实挂载点，2026-09-23 用户 DOM 实证）：卡片挂在
         #tageditor .g-box .m-menu，**不在 #rside、不在任何反色区内**——上方
         #rside 前缀的预反色规则全部脱靶，而浅色管线的 .g-box:has(...) 无前缀、
         暗色下照常写 #fff 白底（白卡成因）。处理与 #rside > * 同构：对卡片
         本地挂反相滤镜（站点配色/雪碧图随之反转，免猜色），img 双重反相还原
         头像；各层底色统一写预反色 rgb(225,225,219)，终显 #1F1F19 与其他卡片
         一致（内层站点白底若不先压成预反色，会经滤镜反成纯黑盖住父层） */
      html #tageditor .g-box:has(.participate-user-title-w),
      html #tageditor .g-box:has(.participate-user-title-w) .m-menu,
      html #tageditor .g-box:has(.participate-user-title-w) .menum,
      html #tageditor .g-box:has(.participate-user-title-w) .menum ul,
      html #tageditor .g-box:has(.participate-user-title-w) .menum ul li {
        background: rgb(225, 225, 219) !important;
        background-image: none !important;
      }
      html #tageditor .g-box:has(.participate-user-title-w) .menut,
      html #tageditor .g-box:has(.participate-user-title-w) .menub {
        display: none !important;
      }
      /* 浅色管线给 .g-box 写的投影在滤镜内会被一起反相（黑影→白晕），
         显成卡片下缘的灰带（2026-09-23 用户截图实证），暗色下一并清掉 */
      html #tageditor .g-box:has(.participate-user-title-w),
      html #tageditor .g-box:has(.participate-user-title-w) .m-menu {
        box-shadow: none !important;
      }
      html #tageditor .g-box:has(.participate-user-title-w) img {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
      html #tageditor .g-box:has(.participate-user-title-w) {
        filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
      }
      /* 2026-09-29 真机实锤（probe-mat3）：站点改版后 #tageditor 挂进了
         #rside（#rside > #tageditor > .g-box）——上方 2026-09-23 方案预设
         「卡不在任何反色区」，而现在 #rside > * 的整栏反相已覆盖
         #tageditor，再叠 .g-box 本地反相 = 双重反相：预反色底显回原色
         （白底）、头像净反相一次（负片感）。卡在 #rside 内时撤 .g-box
         本地反相只留外层一层：预反色底经一层反相终显 #1F1F19 与其他卡
         一致；img 单次补偿（上条规则，与 #rside img 补偿同值）+ 外层
         反相净零，头像正常。豁免前置的旧布局（#tageditor 不在 #rside）
         仍由上方本地反相完整覆盖，两版布局兼容 */
      html #rside #tageditor .g-box:has(.participate-user-title-w) {
        filter: none !important;
      }
      /* 他人喜欢页右栏（#rside > .g-box > .m-menu，内含 #likesidelist）：
         浅色管线「推荐页右侧栏」规则写 #fff，在 #rside 反色区会反成纯黑；
         站点白底还烙在 menu24.png 雪碧图上（.menum/.menut/.menub 各一片，
         2026-09-29 探针实证 .m-menu 白底 rgb(255,255,255) + .menum 雪碧图）。
         与上方参与用户卡同口径：预反色 + 杀雪碧图，经反相显示 #1F1F19
         卡片、文字随反相变浅色；头像由下方 #rside img 补偿滤镜还原。
         html 前缀 + 同构选择器压过浅色 #fff 规则 */
      html #rside .g-box .m-menu:has(#likesidelist),
      html #rside .g-box .m-menu:has(#likesidelist) .menum,
      html #rside .g-box .m-menu:has(#likesidelist) .menum ul,
      html #rside .g-box .m-menu:has(#likesidelist) .menum ul li {
        background: rgb(225, 225, 219) !important;
        background-image: none !important;
      }
      /* 个人主页台头 */
.box.wid700:not(.postwrapper) {
  background-color: rgb(225, 225, 219) !important;
}
      /* 首页发布栏 */
#publishBarArea {
  background-color: rgb(225, 225, 219) !important;
}
    `;
  }

  /* ---------- 背景应用 ---------- */
  function applyBackground() {
    const b = settings.background;
    removeLayer(BG_ID);
    const existingDark = document.getElementById("lc-bg-dark");
    if (existingDark) existingDark.remove();

    if (!settings.enabled || b.mode === "off") return;

    const base = layer(BG_ID, -3);
    let css = "";
    if (b.mode === "color") css = `background:${b.color};`;
    else if (b.mode === "gradient")
      css = `background:linear-gradient(${b.gradient.angle}deg,${b.gradient.from},${b.gradient.to});`;
    else if (b.mode === "pattern")
      css = patternCSS(
        b.pattern.type,
        b.pattern.fg,
        b.pattern.bg,
        b.pattern.size,
      );
    else if (b.mode === "image" && b.image.dataUrl)
      css =
        `background:url("${b.image.dataUrl}") center/cover no-repeat;` +
        (b.image.blur
          ? `filter:blur(${b.image.blur}px);transform:scale(1.06);`
          : "");
    base.style.cssText += css;

    if (b.contentAlpha < 100) {
      const overlay = document.createElement("div");
      overlay.id = "lc-bg-dark";
      overlay.style.cssText =
        `position:fixed;inset:0;pointer-events:none;z-index:-2;` +
        `background:rgba(0,0,0,${((100 - b.contentAlpha) / 100) * 0.85});`;
      (document.body || document.documentElement).appendChild(overlay);
    }
  }

  /* ---------- 装饰物 ---------- */
  const DEC_CONTAINER_ID = "lc-decorations";
  function applyDecorations() {
    // 注入互动效果 CSS
    injectInteractiveCSS();

    // 编辑模式下不重新渲染，避免覆盖拖拽状态
    // 但这里需要处理新增/删除，所以不能完全跳过

    const arr = settings.decorations || [];

    // 分成两组：在卡片下的 和 覆盖卡片的
    const belowCards = arr.filter(
      (d) => d.enabled && d.dataUrl && !d.aboveCards,
    );
    const aboveCards = arr.filter(
      (d) => d.enabled && d.dataUrl && d.aboveCards,
    );

    // 更新低层级容器（卡片下方）：z-index -1，确保在几乎所有 Lofter 元素下面
    updateDecContainer("lc-decorations-below", belowCards, -1);
    // 更新高层级容器（卡片上方）：z-index 99999，确保覆盖所有 Lofter 元素
    updateDecContainer("lc-decorations-above", aboveCards, 99999);

    // 编辑模式下，确保 below 容器的 z-index 足够高以接收鼠标事件
    if (decEditMode) {
      const belowContainer = document.getElementById("lc-decorations-below");
      if (belowContainer) {
        belowContainer.style.zIndex = "99998";
      }
    }
  }

  function updateDecContainer(containerId, decorations, containerZIndex) {
    let container = document.getElementById(containerId);

    if (!decorations.length) {
      if (container) container.remove();
      return;
    }

    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.className = "lc-decorations-container";
      container.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${containerZIndex};transition:opacity 0.3s ease;`;
      (document.body || document.documentElement).appendChild(container);
    }

    // 应用全局显示/隐藏状态
    if (window.settings && window.settings.decorationsVisible === false) {
      window.decorationsGloballyHidden = true;
      container.style.opacity = "0";
    } else {
      container.style.opacity = "1";
    }

    // 容器永远不设为可点击，让事件穿透
    container.style.pointerEvents = "none";

    const existing = new Map();
    container.querySelectorAll("img[data-dec-id]").forEach((img) => {
      existing.set(img.dataset.decId, img);
    });

    decorations.forEach((dec, idx) => {
      let img = existing.get(dec.id);
      if (!img) {
        img = document.createElement("img");
        img.dataset.decId = dec.id;
        img.style.position = "fixed";
        img.style.pointerEvents = "none";
        img.style.objectFit = "contain";
        container.appendChild(img);
      } else if (decEditMode) {
        // 编辑模式下：已有图片只更新 zIndex/src/透明度，不动位置/大小
        // 但要确保编辑样式（pointerEvents、outline、手柄）正确
        img.style.zIndex = String(decorations.length - idx);
        img.src = dec.dataUrl;
        img.style.opacity = String((dec.opacity ?? 100) / 100);
        img.style.pointerEvents = "auto";
        img.style.cursor = "move";
        img.style.outline = "2px dashed #667eea";
        img.style.outlineOffset = "4px";
        addResizeHandles(img);
        existing.delete(dec.id);
        return;
      }
      img.src = dec.dataUrl;
      img.style.left = (dec.x ?? 50) + "%";
      img.style.top = (dec.y ?? 50) + "%";
      img.style.width = (dec.width ?? 20) + "%";
      img.style.maxWidth = "900px";
      img.style.zIndex = String(decorations.length - idx);
      img.style.opacity = String((dec.opacity ?? 100) / 100);
      img.style.transform = "translate(-50%, -50%)";

      if (!decEditMode) {
        img.style.pointerEvents = "none";
        img.classList.remove("lc-dec-breathe", "lc-dec-breathe-squish");

        // 互动效果开启时提升合成层：挤压/呼吸动画只在合成器跑，不拖累主页面重绘
        img.style.willChange =
          dec.interactive && dec.interactive.enabled ? "transform" : "";

        if (
          dec.interactive &&
          dec.interactive.enabled &&
          dec.interactive.breathe !== false
        ) {
          const ia = dec.interactive;
          const breatheMode = ia.breatheMode || "float";
          const amplitude =
            typeof ia.breatheAmplitude === "number" ? ia.breatheAmplitude : 30;
          const speed = ia.breatheSpeed || "normal";

          const durationMap = { slow: "5s", normal: "3.5s", fast: "2s" };
          img.style.setProperty("--lc-breathe-duration", durationMap[speed]);

          if (breatheMode === "squish") {
            // 幅度 0~100 映射到 scale 1.0 ~ 0.85
            const scaleVal = 1 - (amplitude / 100) * 0.15;
            img.style.setProperty("--lc-breathe-scale", scaleVal.toFixed(3));
            img.classList.add("lc-dec-breathe-squish");
          } else {
            // 幅度 0~100 映射到偏移 0px ~ -20px
            const offsetPx = -(amplitude / 100) * 20;
            img.style.setProperty(
              "--lc-breathe-offset",
              offsetPx.toFixed(1) + "px",
            );
            img.classList.add("lc-dec-breathe");
          }
        }
      }

      existing.delete(dec.id);
    });

    existing.forEach((img) => img.remove());
  }

  /* ---------- 装饰物编辑模式 ---------- */
  window.decEditMode = false;
  let decDragTarget = null;
  let decResizeTarget = null;
  let decDragStart = { x: 0, y: 0, decX: 0, decY: 0 };
  let decResizeStart = { x: 0, y: 0, decW: 0, decH: 0, ratio: 1 };

  function toggleDecEditMode(editing) {
    // 如果全局隐藏，禁止进入编辑模式
    if (editing && window.decorationsGloballyHidden) {
      return;
    }
    window.decEditMode = editing;

    // 添加/移除编辑模式标记类
    ["lc-decorations-below", "lc-decorations-above"].forEach((id) => {
      const container = document.getElementById(id);
      if (container) {
        if (editing) {
          container.classList.add("lc-dec-edit-mode");
        } else {
          container.classList.remove("lc-dec-edit-mode");
        }
      }
    });

    ["lc-decorations-below", "lc-decorations-above"].forEach((id) => {
      const container = document.getElementById(id);
      if (!container) return;

      if (editing) {
        // 编辑模式下，临时提高 below 容器的 z-index，让图片可以接收鼠标事件
        if (id === "lc-decorations-below") {
          container.dataset.origZ = container.style.zIndex;
          container.style.zIndex = "99998";
        }
        // 进入编辑模式时，按当前 DOM 顺序重新分配 zIndex
        const imgs = Array.from(container.querySelectorAll("img[data-dec-id]"));
        const total = imgs.length;
        imgs.forEach((img, i) => {
          img.style.zIndex = String(total - i);
          const dec = (settings.decorations || []).find(
            (d) => d.id === img.dataset.decId,
          );
          if (dec) dec.zIndex = total - i;
        });
      } else {
        // 退出编辑模式，恢复 below 容器的原始 z-index
        if (id === "lc-decorations-below" && container.dataset.origZ) {
          container.style.zIndex = container.dataset.origZ;
          delete container.dataset.origZ;
        }
        removeResizeHandles();
      }

      container.querySelectorAll("img[data-dec-id]").forEach((img) => {
        if (editing) {
          img.style.pointerEvents = "auto";
          img.style.cursor = "move";
          img.style.outline = "2px dashed #667eea";
          img.style.outlineOffset = "4px";
          addResizeHandles(img);
        } else {
          img.style.pointerEvents = "none";
          img.style.cursor = "";
          img.style.outline = "";
          img.style.outlineOffset = "";
        }
      });
    });

    if (!editing) {
      applyDecorations();
    }
  }

  function addResizeHandles(img) {
    // 先移除该图片已有的旧手柄，防止重复
    const old = document.querySelector(
      `.dec-handle[data-dec-id="${img.dataset.decId}"]`,
    );
    if (old) old.remove();
    const handle = document.createElement("div");
    handle.className = "dec-handle";
    handle.dataset.decId = img.dataset.decId;
    handle.style.cssText =
      "position:fixed;width:14px;height:14px;" +
      "background:#667eea;border:2px solid white;border-radius:50%;" +
      "cursor:nwse-resize;z-index:9999;box-shadow:0 1px 4px rgba(0,0,0,0.3);";
    // 把手柄放在图片右下角
    const rect = img.getBoundingClientRect();
    handle.style.left = rect.right - 7 + "px";
    handle.style.top = rect.bottom - 7 + "px";
    document.body.appendChild(handle);

    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      decResizeTarget = img;
      const r = img.getBoundingClientRect();
      decResizeStart = {
        x: e.clientX,
        y: e.clientY,
        decW: r.width,
        decH: r.height,
        ratio: r.width / r.height,
      };
    });
  }

  function removeResizeHandles(img) {
    document.querySelectorAll(".dec-handle").forEach((h) => h.remove());
  }

  function updateResizeHandle(img) {
    let handle = document.querySelector(
      `.dec-handle[data-dec-id="${img.dataset.decId}"]`,
    );
    if (!handle) {
      // 手柄丢失时重新创建
      addResizeHandles(img);
      handle = document.querySelector(
        `.dec-handle[data-dec-id="${img.dataset.decId}"]`,
      );
      if (!handle) return;
    }
    const rect = img.getBoundingClientRect();
    handle.style.left = rect.right - 7 + "px";
    handle.style.top = rect.bottom - 7 + "px";
  }

  // 全局鼠标事件（拖拽移动）
  document.addEventListener("mousedown", (e) => {
    if (!decEditMode) return;
    // 新增：如果点的是手柄，不要进入移动模式
    if (e.target.classList.contains("dec-handle")) return;
    // 如果点击的是缩放手柄，找到对应的手柄所属的 img
    let img = e.target.closest("img[data-dec-id]");
    if (!img && e.target.classList.contains("dec-handle")) {
      const decId = e.target.dataset.decId;
      img = document.querySelector(`img[data-dec-id="${decId}"]`);
    }
    if (!img) return;
    decDragTarget = img;
    decDragStart = {
      x: e.clientX,
      y: e.clientY,
      decX: parseFloat(img.style.left) || 50,
      decY: parseFloat(img.style.top) || 50,
    };
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!decEditMode) return;

    // 拖拽移动
    if (decDragTarget) {
      const dx = e.clientX - decDragStart.x;
      const dy = e.clientY - decDragStart.y;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 转换为百分比
      let newX = decDragStart.decX + (dx / vw) * 100;
      let newY = decDragStart.decY + (dy / vh) * 100;
      // 限制在屏幕内
      newX = Math.max(0, Math.min(100, newX));
      newY = Math.max(0, Math.min(100, newY));
      decDragTarget.style.left = newX + "%";
      decDragTarget.style.top = newY + "%";
      // 实时更新缩放手柄位置
      updateResizeHandle(decDragTarget);
    }

    // 缩放
    if (decResizeTarget) {
      const dx = e.clientX - decResizeStart.x;
      const dy = e.clientY - decResizeStart.y;
      const newW = Math.max(20, decResizeStart.decW + dx);
      const newH = newW / decResizeStart.ratio; // 保持比例
      const vw = window.innerWidth;
      const newPct = Math.max(1, Math.min(60, (newW / vw) * 100));
      decResizeTarget.style.width = newPct + "%";
      updateResizeHandle(decResizeTarget); // 新增：手柄跟着图片走
    }
  });

  document.addEventListener("mouseup", () => {
    if (!decEditMode) return;

    // 保存拖拽结果
    if (decDragTarget) {
      saveDecFromElement(decDragTarget);
      decDragTarget = null;
    }

    // 保存缩放结果
    if (decResizeTarget) {
      saveDecFromElement(decResizeTarget);
      decResizeTarget = null;
    }
  });

  function saveDecFromElement(img) {
    const decId = img.dataset.decId;
    const dec = (settings.decorations || []).find((d) => d.id === decId);
    if (!dec) return;
    dec.x = Math.round((parseFloat(img.style.left) || 50) * 100) / 100;
    dec.y = Math.round((parseFloat(img.style.top) || 50) * 100) / 100;
    dec.width = Math.round((parseFloat(img.style.width) || 20) * 100) / 100;
    dec.zIndex = parseInt(img.style.zIndex) || 0;
    chrome.storage.local.set({ [LC_STORAGE_KEY]: settings });
  }

  function initDraftManager() {
    if (!location.href.includes("draft")) return;
    if (!settings.enabled) return;

    const accent = (settings.theme && settings.theme.accent) || "#666";
    const fr = ((settings.card && settings.card.radius) || 16) + "px";
    const isDark = isDarkMode();

    // 主题切换时：移除旧样式，准备重新注入
    document.getElementById("lc-draft-style")?.remove();

    const existingToolbar = document.getElementById("lc-draft-inline");
    const header = document.querySelector(".header.clear");
    if (!header) return;

    /* ---------- 样式 ---------- */
    const st = document.createElement("style");
    st.id = "lc-draft-style";
    st.textContent = `
      .lc-draft-inline {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 100;
        white-space: nowrap;
      }
      .lc-draft-search-sm {
        width: 140px;
        height: 32px;
        padding: 0 10px;
        border: 1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)"};
        border-radius: calc(${fr} * 0.5);
        background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)"};
        color: ${isDark ? "rgba(255,255,255,0.9)" : "#333"};
        font-size: 13px;
        outline: none;
        transition: all .2s;
        font-family: inherit;
      }
      .lc-draft-search-sm::placeholder { color: ${isDark ? "rgba(255,255,255,0.4)" : "#999"}; }
      .lc-draft-search-sm:focus {
        width: 170px;
        border-color: ${accent};
        box-shadow: 0 0 0 3px color-mix(in srgb, ${accent} 20%, transparent);
      }
      .lc-draft-btn-sm {
        height: 32px;
        padding: 0 12px;
        border-radius: calc(${fr} * 0.5);
        border: none;
        background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"};
        color: ${isDark ? "rgba(255,255,255,0.85)" : "#555"};
        font-size: 13px;
        cursor: pointer;
        transition: all .15s;
        white-space: nowrap;
        font-family: inherit;
      }
      .lc-draft-btn-sm:hover { transform: translateY(-1px); }
      .lc-draft-btn-sm.primary { background: ${accent}; color: #fff; }
      .lc-draft-btn-sm.danger { background: #e74c3c; color: #fff; }
      .lc-draft-btn-sm:disabled { opacity: .4; cursor: not-allowed; transform: none; }
      .lc-batch-actions {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        animation: lcFadeIn .2s ease;
      }
      .lc-batch-count-sm {
        font-size: 12px;
        color: ${isDark ? "rgba(255,255,255,0.5)" : "#888"};
        min-width: 18px;
        text-align: center;
      }
      /* 静默删除：弹窗和遮罩完全透明，但保留点击能力 */
      .lc-silent-delete .m-layer,
      .lc-silent-delete .lycover,
      .lc-silent-delete .zcvr,
      .lc-silent-delete .g-popup,
      .lc-silent-delete #j-pop,
      .lc-silent-delete [class*="dialog"],
      .lc-silent-delete [class*="modal"] {
        opacity: 0 !important;
        transition: none !important;
        pointer-events: auto !important;
      }
      .lc-draft-checkbox {
        position: absolute;
        top:25px;
        right: 50px;
        width: 18px;
        height: 18px;
        z-index: 10;
        cursor: pointer;
        accent-color: ${accent};
        opacity: 0;
        transition: opacity .2s;
      }

      /* 批量模式下：卡片整体变成手型，提示可点击 */
      .lc-batch-mode .content-block { cursor: pointer !important; }
      .lc-batch-mode .content-block .pic-area a,
      .lc-batch-mode .content-block .words-title { cursor: pointer !important; }

      .lc-batch-mode .content-block:hover .lc-draft-checkbox,
      .lc-batch-mode .lc-draft-checkbox,
      .lc-batch-mode .lc-draft-checkbox:checked { opacity: 1; }
      .content-block { position: relative; }
      .content-block.lc-hidden { display: none !important; }
      .content-block.lc-selected {
        box-shadow: 0 0 0 2px ${accent} !important;
      }
      .lc-highlight {
        background: color-mix(in srgb, ${accent} 30%, transparent);
        border-radius: 2px;
        padding: 0 1px;
        font-weight: 600;
      }
      .lc-empty-tip {
        text-align: center;
        padding: 50px;
        color: ${isDark ? "rgba(255,255,255,0.4)" : "#aaa"};
        font-size: 15px;
      }
      @keyframes lcFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 900px) {
        .lc-draft-inline { left: 45%; }
        .lc-draft-search-sm { width: 90px; }
        .lc-draft-search-sm:focus { width: 120px; }
      }
    `;
    (document.head || document.documentElement).appendChild(st);

    // 如果工具栏已存在，只更新样式，不重建 DOM（避免事件重复绑定）
    if (existingToolbar) {
      (document.head || document.documentElement).appendChild(st);
      return;
    }

    /* ---------- DOM ---------- */
    const bar = document.createElement("div");
    bar.id = "lc-draft-inline";
    bar.className = "lc-draft-inline";
    bar.innerHTML = `
      <input type="text" class="lc-draft-search-sm" placeholder="搜索草稿…" id="lc-draft-search">
      <button class="lc-draft-btn-sm" id="lc-batch-toggle">批量管理</button>
      <span class="lc-batch-actions" id="lc-batch-actions" style="display:none">
        <button class="lc-draft-btn-sm" id="lc-select-all">全选</button>
        <button class="lc-draft-btn-sm" id="lc-select-none">取消</button>
        <button class="lc-draft-btn-sm danger" id="lc-batch-delete" disabled>删除</button>
        <span class="lc-batch-count-sm" id="lc-batch-count">0</span>
      </span>
    `;

    const headerStyle = getComputedStyle(header);
    if (headerStyle.position === "static") {
      header.style.setProperty("position", "relative", "important");
    }
    header.appendChild(bar);

    let batchMode = false;
    const selected = new Set();

    const $ = (sel) => bar.querySelector(sel);
    const searchInput = $("#lc-draft-search");
    const batchToggle = $("#lc-batch-toggle");
    const batchActions = $("#lc-batch-actions");
    const selAllBtn = $("#lc-select-all");
    const selNoneBtn = $("#lc-select-none");
    const delBtn = $("#lc-batch-delete");
    const countSpan = $("#lc-batch-count");

    /* ---------- 搜索 ---------- */
    searchInput.addEventListener("input", () => {
      const kw = searchInput.value.trim().toLowerCase();
      const blocks = document.querySelectorAll(".content-block");
      if (!kw) {
        blocks.forEach((b) => {
          b.classList.remove("lc-hidden");
          unhighlight(b);
        });
        hideEmpty();
        return;
      }
      let has = false;
      blocks.forEach((block) => {
        if ((block.textContent || "").toLowerCase().includes(kw)) {
          block.classList.remove("lc-hidden");
          highlight(block, kw);
          has = true;
        } else {
          block.classList.add("lc-hidden");
          unhighlight(block);
        }
      });
      showEmpty(!has);
    });

    /* ---------- 批量模式 ---------- */
    batchToggle.addEventListener("click", () => {
      batchMode = !batchMode;
      batchToggle.textContent = batchMode ? "退出" : "批量管理";
      batchActions.style.display = batchMode ? "inline-flex" : "none";
      document.body.classList.toggle("lc-batch-mode", batchMode);
      if (!batchMode) {
        selected.clear();
        document
          .querySelectorAll(".lc-draft-checkbox")
          .forEach((cb) => (cb.checked = false));
        document
          .querySelectorAll(".content-block")
          .forEach((b) => b.classList.remove("lc-selected"));
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
      }
      updateUI();
      ensureCheckboxes();
    });

    selAllBtn.addEventListener("click", () => {
      document
        .querySelectorAll(".content-block:not(.lc-hidden)")
        .forEach((block) => {
          const cb = block.querySelector(".lc-draft-checkbox");
          if (cb && !cb.checked) {
            cb.checked = true;
            selected.add(block);
            block.classList.add("lc-selected");
          }
        });
      updateUI();
    });
    selNoneBtn.addEventListener("click", () => {
      selected.clear();
      document
        .querySelectorAll(".lc-draft-checkbox")
        .forEach((cb) => (cb.checked = false));
      document
        .querySelectorAll(".content-block")
        .forEach((b) => b.classList.remove("lc-selected"));
      updateUI();
    });

    /* ---------- 批量删除（最终优化版） ---------- */
    delBtn.addEventListener("click", async () => {
      if (selected.size === 0) return;
      if (!confirm(`(ㆀ˘･з･˘)确定删除选中的 ${selected.size} 篇草稿？`)) return;

      document.body.classList.add("lc-silent-delete");
      delBtn.disabled = true;

      const blocks = Array.from(selected).filter((b) => b.isConnected);
      const total = blocks.length;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block.isConnected) continue;

        const del = block.querySelector(".oimg-del");
        if (!del) continue;

        delBtn.textContent = `删除中(${i + 1}/${total})`;

        simulateRealClick(del);

        const confirmed = await waitConfirm();
        if (!confirmed) {
          continue;
        }

        // 关键优化：最后一篇不等弹窗消失，直接结束
        if (i < blocks.length - 1) {
          await waitForLayerGone(); // 中间篇正常等，但最多2秒
          await sleep(200); // 篇间缓冲从600降到400
        } else {
          // 最后一篇：最多等500ms，不等也行，直接收尾
          await Promise.race([waitForLayerGone(), sleep(500)]);
        }
      }

      document.body.classList.remove("lc-silent-delete");
      delBtn.disabled = false;
      selected.clear();
      updateUI();
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
    });

    function updateUI() {
      countSpan.textContent = selected.size;
      delBtn.disabled = selected.size === 0;
      delBtn.textContent =
        selected.size > 0 ? `删除(${selected.size})` : "删除";
    }

    function ensureCheckboxes() {
      document
        .querySelectorAll(".content-block:not(:has(.lc-draft-checkbox))")
        .forEach((block) => {
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.className = "lc-draft-checkbox";
          cb.addEventListener("change", () => {
            if (cb.checked) {
              selected.add(block);
              block.classList.add("lc-selected");
            } else {
              selected.delete(block);
              block.classList.remove("lc-selected");
            }
            updateUI();
          });
          block.appendChild(cb);
        });
    }

    function highlight(block, kw) {
      const areas = block.querySelectorAll(".words-area, .dotbox, .timerp");
      const re = new RegExp(
        `(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      areas.forEach((area) => {
        if (area.dataset.lcHl) return;
        const walker = document.createTreeWalker(
          area,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach((node) => {
          if (!re.test(node.textContent)) return;
          const span = document.createElement("span");
          span.innerHTML = node.textContent.replace(
            re,
            '<mark class="lc-highlight">$1</mark>',
          );
          const frag = document.createDocumentFragment();
          while (span.firstChild) frag.appendChild(span.firstChild);
          node.parentNode.replaceChild(frag, node);
        });
        area.dataset.lcHl = "1";
      });
    }
    function unhighlight(block) {
      block
        .querySelectorAll(".words-area, .dotbox, .timerp")
        .forEach((area) => {
          if (!area.dataset.lcHl) return;
          area.querySelectorAll("mark.lc-highlight").forEach((m) => {
            m.parentNode.replaceChild(
              document.createTextNode(m.textContent),
              m,
            );
          });
          area.normalize();
          delete area.dataset.lcHl;
        });
    }
    function showEmpty(show) {
      let tip = document.querySelector(".lc-empty-tip");
      if (show) {
        if (!tip) {
          tip = document.createElement("div");
          tip.className = "lc-empty-tip";
          tip.textContent = "没有找到匹配的草稿";
          (
            document.querySelector(".main-content") || document.body
          ).appendChild(tip);
        }
        tip.style.display = "block";
      } else if (tip) {
        tip.style.display = "none";
      }
    }
    function hideEmpty() {
      const tip = document.querySelector(".lc-empty-tip");
      if (tip) tip.style.display = "none";
    }

    /* 模拟真实用户点击 */
    function simulateRealClick(el) {
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
    }

    /* 等待弹窗出现并自动点击确认（MutationObserver 零延迟 + 150ms 兜底） */
    function waitConfirm(timeout = 15000) {
      return new Promise((resolve) => {
        const start = Date.now();
        let resolved = false;

        const tryClick = () => {
          const selectors = [
            ".m-layer .w-sbtn.w-sbtn-0",
            ".m-layer .w-sbtn",
            ".m-layer button",
            ".w-sbtn.w-sbtn-0",
            ".g-popup .w-sbtn",
            "#j-pop .w-sbtn",
            '[class*="layer"] .w-sbtn',
            ".m-layer .btn",
          ];
          for (const sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn) {
              btn.click();
              return true;
            }
          }
          return false;
        };

        if (tryClick()) {
          resolve(true);
          return;
        }

        const observer = new MutationObserver(() => {
          if (resolved) return;
          if (tryClick()) {
            resolved = true;
            observer.disconnect();
            resolve(true);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const iv = setInterval(() => {
          if (resolved) {
            clearInterval(iv);
            return;
          }
          if (tryClick()) {
            resolved = true;
            observer.disconnect();
            clearInterval(iv);
            resolve(true);
            return;
          }
          if (Date.now() - start > timeout) {
            resolved = true;
            observer.disconnect();
            clearInterval(iv);
            resolve(false);
          }
        }, 150);
      });
    }

    /* 等待弹窗从 DOM 移除（最多 2 秒） */
    function waitForLayerGone(timeout = 2000) {
      return new Promise((resolve) => {
        const start = Date.now();
        let resolved = false;
        const isGone = () =>
          !document.querySelector(
            ".m-layer, .g-popup, #j-pop, .lycover, .zcvr",
          );

        if (isGone()) {
          resolve();
          return;
        }

        const observer = new MutationObserver(() => {
          if (resolved) return;
          if (isGone()) {
            resolved = true;
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const iv = setInterval(() => {
          if (resolved) {
            clearInterval(iv);
            return;
          }
          if (isGone()) {
            resolved = true;
            observer.disconnect();
            clearInterval(iv);
            resolve();
            return;
          }
          if (Date.now() - start > timeout) {
            resolved = true;
            observer.disconnect();
            clearInterval(iv);
            resolve();
          }
        }, 100);
      });
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /* ---------- 批量模式点击行为拦截 ---------- */
    const clickContainer =
      document.querySelector(".main-content") || document.body;
    clickContainer.addEventListener(
      "click",
      (e) => {
        // 非批量模式：完全不管，让 Lofter 自己处理
        if (!document.body.classList.contains("lc-batch-mode")) return;
        // 关键修复：排除 Lofter 功能按钮和我们的工具栏，不拦截
        if (e.target.closest(".oimg-del, .lc-draft-inline, .lc-draft-checkbox"))
          return;

        const block = e.target.closest(".content-block");
        if (!block) return;

        const cb = block.querySelector(".lc-draft-checkbox");
        if (!cb) return;

        // 1. 精确点击 checkbox 本身 → 不拦截，让它自己的 change 事件处理
        if (e.target.closest(".lc-draft-checkbox")) return;

        // 2. 点击封面图或标题 → 阻止默认跳转，改为新开标签页
        if (e.target.closest(".pic-area a, .words-title")) {
          e.preventDefault();
          e.stopPropagation();
          const link = block.querySelector(".pic-area a");
          if (link?.href) window.open(link.href, "_blank");
          return;
        }

        // 3. 点击导语/空白区域 → 阻止跳转，切换勾选状态
        e.preventDefault();
        e.stopPropagation();
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      },
      true,
    ); // ← 捕获阶段拦截，比 Lofter 的监听器更早执行

    const container = document.querySelector(".main-content") || document.body;
    new MutationObserver(() => {
      if (batchMode) ensureCheckboxes();
      const kw = searchInput.value.trim().toLowerCase();
      if (kw)
        setTimeout(() => searchInput.dispatchEvent(new Event("input")), 100);
    }).observe(container, { childList: true, subtree: true });
  }

  /* ---------- 隐藏推广帖 ---------- */
  function removeStubbornAds() {
    if (!settings.enabled) return;

    // 隐藏 "东华" 推广帖
    document.querySelectorAll("#main > .m-mlist").forEach((el) => {
      const author = el.querySelector(".publishernick, .w-who a");
      if (author && author.textContent.trim() === "东华") {
        el.style.setProperty("display", "none", "important");
      }
    });

    // 隐藏达人扶持计划
    document.querySelectorAll('a[href="/darenapply"]').forEach((el) => {
      const banner = el.closest('[class*="-banner-web"]');
      if (banner) {
        banner.style.setProperty("display", "none", "important");
      }
    });
  }

  /* ---------- 卡片滚动出现动画（Intersection Observer） ---------- */
  let _cardObserver = null;
  function applyCardAnimations() {
    // 如果动画关闭或插件未启用，清除所有动画类与观察标记
    if (!settings.enabled || (settings.card.animation || "none") === "none") {
      if (_cardObserver) {
        _cardObserver.disconnect();
        _cardObserver = null;
      }
      document.querySelectorAll(".m-mlist.lc-card-visible").forEach((el) => {
        el.classList.remove("lc-card-visible");
        el.style.animationDelay = "";
        el.style.removeProperty("--lc-face-delay");
        delete el.dataset.lcCardObserved;
      });
      return;
    }

    const stagger = settings.card.stagger !== false;
    const staggerDelay = (settings.card.staggerDelay || 80) / 1000; // 秒

    if (!_cardObserver) {
      _cardObserver = new IntersectionObserver(
        (entries) => {
          // 按出现顺序收集本次进入视口的卡片
          const visibleEntries = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => {
              // 按 DOM 位置排序，确保从上到下依次出现
              const pos = a.target.compareDocumentPosition(b.target);
              return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });

          visibleEntries.forEach((entry, idx) => {
            const el = entry.target;
            // 如果已经动画过了，跳过
            if (el.classList.contains("lc-card-visible")) return;

            // 设置交错延迟（--lc-face-delay 同步给卡面 ::before 的模糊渐入动画错峰）
            if (stagger && idx > 0) {
              el.style.animationDelay = idx * staggerDelay + "s";
              el.style.setProperty("--lc-face-delay", idx * staggerDelay + "s");
            } else {
              el.style.animationDelay = "";
              el.style.setProperty("--lc-face-delay", "0s");
            }

            // 触发动画
            el.classList.add("lc-card-visible");

            // 动画播放完后，取消观察（避免重复触发）
            _cardObserver.unobserve(el);
          });
        },
        {
          root: null, // 视口
          rootMargin: "0px 0px -20px 0px", // 提前 40px 触发，更自然
          threshold: 0.2, // 卡片出现 5% 就触发
        },
      );
    }

    /* 增量观察：只处理未标记的新卡片，没有新卡片时整段直通。
       原实现每批变异都 disconnect + 全量 observe + rAF 里对
       所有帖子 getBoundingClientRect（强制布局）——初始加载期
       变异风暴下是主要的主线程消耗之一 */
    const fresh = [];
    document.querySelectorAll(".m-mlist").forEach((el) => {
      if (!el.dataset.lcCardObserved) {
        el.dataset.lcCardObserved = "1";
        fresh.push(el);
      }
    });
    if (!fresh.length) return;

    fresh.forEach((el) => _cardObserver.observe(el));

    // 新卡片中已在视口的直接播放动画，视口外的等 Intersection Observer
    requestAnimationFrame(() => {
      fresh.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (isVisible && !el.classList.contains("lc-card-visible")) {
          // 设置交错延迟（--lc-face-delay 同步给卡面 ::before 的模糊渐入动画错峰）
          if (stagger && idx > 0) {
            el.style.animationDelay = idx * staggerDelay + "s";
            el.style.setProperty("--lc-face-delay", idx * staggerDelay + "s");
          }
          el.classList.add("lc-card-visible");
        }
      });
    });
  }

  /* ---------- 容错调度 ----------
     链上任一适配函数抛错原本会中断整条链——曾导致创作者中心页上
     lcFixCreatorCenter 永不执行（前置函数抛错），JS 内联样式
     （侧栏毛玻璃、缩略图透明化）全部落空而 CSS 效果正常。
     每个调用独立 try/catch，异常只打日志不扩散 */
  function lcSafe(fn) {
    try {
      fn();
    } catch (e) {
      console.warn("[lc] " + (fn.name || "anonymous") + "() 执行异常:", e);
    }
  }

  /* ---------- 应用全部 ---------- */
  /* ---------- 账号设置页（/front/homesite/user-setting）主题色 ----------
   * 站点暗色皮肤用高特异性规则把主色按钮/勾选框盖回"暗色主题色"
   * （实测 computed bg rgb(74,62,94)），CSS !important 缠斗不可靠 →
   * inline style + !important（作者样式无法覆盖 inline important）。 */
  function lcApplySettingPageTheme() {
    if (!/\/(setting|front\/homesite\/user-setting)\b/.test(location.pathname))
      return;
    const A =
      sanitizeColor(settings.theme && settings.theme.accent) || "#667eea";
    const set = (el, prop, val) => {
      if (el.style.getPropertyValue(prop) !== val)
        el.style.setProperty(prop, val, "important");
    };
    /* 保存/主页设置/黑名单/标签屏蔽/注销账号或主页 */
    document
      .querySelectorAll(
        'button[class*="buttonColorPrimary"], a[href*="type=setting"]',
      )
      .forEach((el) => {
        set(el, "background", A);
        set(el, "border-color", A);
        set(el, "color", "#fff");
        set(el, "border-radius", "999px");
        /* 黑名单/标签屏蔽/注销的文字包在内部 <a> 里，白字要钉到 a 上，
           否则被站点样式压成近似背景色（暗色下看似空白、浅色下黑字） */
        if (el.querySelectorAll) {
          el.querySelectorAll("a").forEach((a) => set(a, "color", "#fff"));
        }
      });
    /* 勾选框：按当前状态上色/清理（取消勾选后 inline 不能残留） */
    document.querySelectorAll(".rc-checkbox-inner").forEach((inner) => {
      const box = inner.parentElement;
      const input =
        box && box.querySelector
          ? box.querySelector("input.rc-checkbox-input")
          : null;
      if (input && input.checked) {
        set(inner, "background-color", A);
        set(inner, "border-color", A);
      } else {
        if (inner.style.getPropertyValue("background-color"))
          inner.style.removeProperty("background-color");
        if (inner.style.getPropertyValue("border-color"))
          inner.style.removeProperty("border-color");
      }
    });
    /* 「绑定邮箱账号/查看说明/修改兴趣」旁箭头：站点把 #4EB7BA 硬编码在
       path 的 stroke 属性上；改色后打标记，换主题色也能跟随更新 */
    document
      .querySelectorAll('svg path[data-lc-accent], svg path[stroke="#4EB7BA"]')
      .forEach((p) => {
        if (p.getAttribute("stroke") !== A) p.setAttribute("stroke", A);
        p.setAttribute("data-lc-accent", "1");
      });
    /* 暗色下卡片底部"半圈白边"：站点给卡片自带 border-bottom: 1px solid
       #F5F5F5（近白，DevTools 实证），沿圆角拐弯形成半圈。类名是构建
       hash 不可依赖 → 按计算值扫：亮色下边框压成暗色细线。
       受信任等卡片要等接口数据才渲染，扫描时可能还不存在 → 延迟重扫 */
    if (isDarkMode()) {
      const lcDimLightBorders = () => {
        document
          .querySelectorAll('#application [class*="page-web"] div')
          .forEach((el) => {
            if (el.style.getPropertyValue("border-bottom-color")) return;
            const cs = getComputedStyle(el);
            if (
              cs.borderBottomStyle !== "none" &&
              parseFloat(cs.borderBottomWidth) > 0
            ) {
              const m = cs.borderBottomColor.match(
                /rgba?\((\d+),\s*(\d+),\s*(\d+)/,
              );
              if (m && (+m[1] + +m[2] + +m[3]) / 3 > 180) {
                set(el, "border-bottom-color", "rgba(255, 255, 255, 0.08)");
              }
            }
          });
      };
      lcDimLightBorders();
      [500, 1500, 3000, 6000].forEach((d) => setTimeout(lcDimLightBorders, d));
    }
    /* 卡片居中：站点外层容器固定宽溢出视口 + 内容层 margin 右 -44px
       不对称。hash 前缀（style-14_8622 等）随构建变化不可依赖 →
       用 box-web/page-web 后缀宽匹配，且只处理宽度异常的大容器 */
    document.querySelectorAll('#application [class*="box-web"]').forEach((el) => {
      /* 只治页面级大容器（原版固定 1100px）；小组件不碰。
         不能用「溢出才治」判断：视口 ≥1100 时容器不溢出但近乎铺满 */
      if (el.getBoundingClientRect().width < 600) return;
      set(el, "width", "auto");
      set(el, "min-width", "0");
      /* 比内容卡大一圈的适度宽度；窄视口收窄到 100%，始终居中 */
      set(el, "max-width", "min(1000px, 100%)");
      set(el, "margin-left", "auto");
      set(el, "margin-right", "auto");
    });
    document
      .querySelectorAll('#application [class*="page-web"]')
      .forEach((pw) => {
        if (pw.getBoundingClientRect().width < innerWidth * 0.5) return;
        set(pw, "margin-left", "auto");
        set(pw, "margin-right", "auto");
        set(pw, "max-width", "100%");
        set(pw, "box-sizing", "border-box");
        /* 只清负的右边距（内容层 -44px），不动正常间距；
           内容层还写死 width:944px，一并改流式否则照样溢出 */
        for (const child of pw.children) {
          if (
            child.nodeType === 1 &&
            parseFloat(getComputedStyle(child).marginRight) < 0
          ) {
            set(child, "margin-right", "0");
            set(child, "width", "auto");
            set(child, "max-width", "100%");
            set(child, "box-sizing", "border-box");
          }
        }
      });
  }

  /* ---------- 模板预览页（/theme/xxx?type=setting）主题色 ----------
   * 右上角「保存/保存并关闭」是 .btnbar 里的 a.w-sbtn，背景被暗色引擎
   * 盖成 rgb(74,62,94)（探针实证：无 filter 祖先，非反转）→
   * 同设置页套路：inline + !important 钉回主题色。 */
  function lcApplyThemePageTheme() {
    if (!/^\/theme\//.test(location.pathname)) return;
    const A =
      sanitizeColor(settings.theme && settings.theme.accent) || "#667eea";
    const set = (el, prop, val) => {
      if (el.style.getPropertyValue(prop) !== val)
        el.style.setProperty(prop, val, "important");
    };
    document.querySelectorAll(".btnbar a.w-sbtn").forEach((el) => {
      set(el, "background", A);
      set(el, "border-color", A);
      set(el, "color", "#fff");
      set(el, "border-radius", "999px");
    });
  }

  function applyAll() {
    if (!settings.enabled) {
      let styleEl = document.getElementById(STYLE_ID);
      if (styleEl) styleEl.textContent = "";
      removeLayer(BG_ID);
      let fontEl = document.getElementById(FONT_ID);
      if (fontEl) fontEl.remove();
      const darkEl = document.getElementById("lc-dark-overlay");
      if (darkEl) darkEl.remove();
      ["lc-decorations-below", "lc-decorations-above"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      window.decEditMode = false;
      decDragTarget = null;
      decResizeTarget = null;
      clearFouc();
      lcSafe(applyWordCounter); /* 总开关关闭 → 收掉字数角标与轮询 */
      lcSafe(applyFilter); /* 总开关关闭 → 摘掉过滤标记与提示 */
      lcSafe(applyDmSearch); /* 总开关关闭 → 收掉私信搜索框与标记 */
      lcSafe(applySidebarGlass); /* 总开关关闭 → 摘掉侧栏玻璃（lcSideGlassOn 自会 false） */
      return;
    }
    lcSafe(applyFontFace);
    lcSafe(applyStyle);
    lcSafe(applyBackground);
    lcSafe(removeStubbornAds);
    lcSafe(applyDecorations);
    lcSafe(applyNavbar);
    lcSafe(applySidebarGlass);
    lcSafe(clearFouc);
    lcSafe(applyDarkOverlay);
    lcSafe(injectPostTitles);
    lcSafe(applyClickBounce);
    lcSafe(applyCardAnimations);
    lcSafe(removeTitles);
    lcSafe(forceTagPageStyles);
    lcSafe(() => protectEmojis(true));
    lcSafe(applyAllDialogsDark);
    lcSafe(lcStyleDarenApplyGlass);
    lcSafe(lcFixCreatorCenter);
    lcSafe(applyLongpostEditorDark);
    lcSafe(applyWordCounter);
    lcSafe(applyFilter);
    lcSafe(applyDmSearch);
    lcSafe(initDraftManager);
    lcSafe(applyCustomPlaceholder);
    lcSafe(lcApplySettingPageTheme);
    lcSafe(lcApplyThemePageTheme);
  }

  /* ---------- MutationObserver（适配无限滚动） ---------- */
  /* 变异风暴合并：初始加载期每秒十几个批次，逐批跑链条会把主线程
     占满（打开初期挤压动画卡顿的残留来源）。尾随防抖 120ms 把
     连续批次合并，暗色样式主体走静态 CSS 不受延迟影响 */
  const CHAIN_DEBOUNCE = 120;
  let chainTimer = 0;
  /* 增量扫描队列：observer 只收集"外部新增节点"，protectEmojis
     按需扫描。全页 TreeWalker 单次 100-300ms（长任务探针实证），
     曾把词卡气泡 appendChild 触发的每次变异都变成一次全页扫描，
     暗色下挤压动画的过渡帧被整段挤掉。自家元素不入队：
     气泡在 body 反色区外、颜色自绘，本来就不需要 emoji 保护 */
  const lcPendingNodes = [];
  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.id && String(node.id).startsWith("lc-")) return;
          const ds = node.dataset || {};
          if (ds.lcDialogue || ds.decId !== undefined) return;
          if (
            node.closest &&
            node.closest(
              "[data-lc-dialogue],.lc-decorations-container,.lc-emoji-wrap",
            )
          )
            return;
          lcPendingNodes.push(node);
        } else if (node.nodeType === 3 && node.parentElement) {
          if (
            node.parentElement.closest(
              "[data-lc-dialogue],.lc-decorations-container,.lc-emoji-wrap",
            )
          )
            return;
          lcPendingNodes.push(node.parentElement);
        }
      });
    }
    if (!chainTimer)
      chainTimer = setTimeout(() => {
        chainTimer = 0;
        lcSafe(applyStyle);
        lcSafe(removeStubbornAds);
        lcSafe(forceTagPageStyles);
        lcSafe(protectEmojis);
        lcSafe(applyAllDialogsDark);
        lcSafe(lcStyleDarenApplyGlass);
        lcSafe(lcFixCreatorCenter);
        lcSafe(applyLongpostEditorDark);
        lcSafe(applyWordCounter);
        lcSafe(applyFilter);
        lcSafe(applyDmSearch);
        lcSafe(applyCardAnimations);
        lcSafe(applyCustomPlaceholder);
        lcSafe(applySidebarGlass); /* 侧栏卡片可能由 React 晚渲染 → 补挂玻璃 */
      }, CHAIN_DEBOUNCE);
  });

  // 在你现有的 observer 回调里（applyStyle 附近）加上：
  document.querySelectorAll("body.body .content-block").forEach((el) => {
    if (!el.querySelector(".dotbox") || el.innerText.trim().length === 0) {
      el.style.display = "none";
    }
    // 观察新版 React 页面容器
    const appContainer = document.querySelector("#application");
    if (appContainer) {
      observer.observe(appContainer, { childList: true, subtree: true });
    }
  });

  /* ========== 查看更多页搜索下拉栏 tag 胶囊包裹 ========== */
  function wrapViewMoreTags() {
    if (!isDarkMode()) return;
    
    document.querySelectorAll('div[class*="Orp2pg4PJFzX9iEz-4ZAWg=="] a[class*="AV8Mt74pTEHQXrEBEKFaUg=="]').forEach(el => {
      // 跳过已处理的
      if (el.querySelector(".lc-tag-wrapper")) return;
      
      // 找到所有直接子 span
      const spans = Array.from(el.children).filter(c => c.tagName === "SPAN");
      
      if (spans.length >= 2) {
        // 创建 wrapper
        const wrapper = document.createElement("span");
        wrapper.className = "lc-tag-wrapper";
        
        // 把前两个 span 移入 wrapper
        el.insertBefore(wrapper, spans[0]);
        wrapper.appendChild(spans[0]);
        wrapper.appendChild(spans[1]);
      }
    });
  }
  
  // 初始化时执行
  wrapViewMoreTags();
  
  // 在 observer 回调中也执行（通过轮询检查新元素）
  setInterval(wrapViewMoreTags, 1000);

  /* ========== 自定义搜索框占位符 ========== */
  function applyCustomPlaceholder() {
    const text = (settings && settings.searchPlaceholder) || "搜索用户、标签";

    // 用 class 特征定位搜索框（不依赖 placeholder 内容，因为可能已被修改过）
    // 你的搜索框 class 是 jaFV6X-bRw9s-zmoUaqzHg==
    const input = document.querySelector("input.jaFV6X-bRw9s-zmoUaqzHg\\=\\=");

    if (input) {
      input.placeholder = text;
      return;
    }

    // 如果没找到，轮询等待（针对动态加载）
    let attempts = 0;
    const timer = setInterval(() => {
      const el = document.querySelector("input.jaFV6X-bRw9s-zmoUaqzHg\\=\\=");
      if (el) {
        el.placeholder = text;
        clearInterval(timer);
      }
      attempts++;
      if (attempts >= 20) clearInterval(timer);
    }, 500);
  }

  /* ---------- 长篇编辑器：字体 + 暗色适配 ---------- */
  function applyLongpostEditorDark() {
    const selectors = [
      'iframe[id^="baidu_editor"]',
      'iframe[id^="ueditor"]',
      ".edui-editor-iframeholder iframe",
      ".m-main iframe",
    ];

    const iframes = [];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((f) => {
        if (!iframes.includes(f)) iframes.push(f);
      });
    });

    const isDark = settings.enabled && isDarkMode();

    /* ── A. 主页面的 placeholder label：初始化 + 暴力轮询 ── */
    const mainLabel = document.querySelector(
      "body#longpost-publish-page label.textIntroLabel",
    );
    if (mainLabel) {
      // 初始化颜色
      if (isDark) {
        mainLabel.style.setProperty(
          "color",
          "rgba(255,255,255,0.35)",
          "important",
        );
      } else {
        mainLabel.style.setProperty("color", "#888888", "important");
      }
      mainLabel.style.setProperty("top", "50px", "important");
      mainLabel.style.setProperty("left", "22px", "important");
      mainLabel.style.setProperty("pointer-events", "none", "important");
      mainLabel.style.setProperty(
        "transition",
        "opacity 0.15s ease",
        "important",
      );

      // 暴力轮询：每 100ms 检查 iframe 焦点/内容，直接覆盖 UEditor 的 placeholder 逻辑
      if (!window._lcPhPoll) {
        window._lcPhPoll = setInterval(() => {
          const iframe = document.querySelector(
            '#baidu_editor_0, iframe[id^="baidu_editor"], iframe[id^="ueditor"]',
          );
          let shouldHide = false;
          try {
            const idoc = iframe?.contentDocument;
            // iframe 有焦点，或者已经有文字内容，就强制隐藏
            shouldHide =
              idoc?.hasFocus() || idoc?.body?.textContent?.trim().length > 0;
          } catch (e) {}

          if (shouldHide) {
            mainLabel.style.setProperty("display", "none", "important");
          } else {
            // 只有确实没焦点且没内容时才恢复
            mainLabel.style.removeProperty("display");
          }
        }, 100);
      }
    }

    iframes.forEach((iframe) => {
      const tryApply = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc || !doc.head || !doc.body) return false;

          // ① 字体样式
          let fontStyle = doc.getElementById("lc-editor-font");
          if (!fontStyle) {
            fontStyle = doc.createElement("style");
            fontStyle.id = "lc-editor-font";
            doc.head.appendChild(fontStyle);
          }
          const fam = activeFontFamily();
          const fontRule = fam ? `font-family: ${fam} !important;` : "";
          fontStyle.textContent = `
            html, body, p, div, span, font, li, td, th, 
            h1, h2, h3, h4, h5, h6, pre, code,
            .view, .edui-editor-holder { 
              ${fontRule}
            }
            body {
              padding: 20px 24px 40px 24px !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              ${isDark ? "background: transparent !important;" : "background: rgba(255,255,255,0.45) !important;"}
            }
          `;

          // ② 暗色样式
          if (isDark) {
            let darkStyle = doc.getElementById("lc-editor-dark");
            if (!darkStyle) {
              darkStyle = doc.createElement("style");
              darkStyle.id = "lc-editor-dark";
              doc.head.appendChild(darkStyle);
            }
            /* 反色区判定：旧管线把 invert 滤镜挂在 #main 上，滤镜会连
               iframe 的渲染内容一起反相——注入的浅色文字被反成近黑
               （实测文字/输入区同为 #020203）。处于反色区时改写预反色值：
               rgb(38,38,38) 反色后显示 #d9d9d9 浅灰；
               body 底 rgb(225,225,219) 显示 #1F1F19 深灰卡 */
            const inverted =
              typeof iframe.closest === "function" && !!iframe.closest("#main");
            const ink = inverted
              ? "rgb(38, 38, 38)"
              : "rgba(255,255,255,0.85)";
            const accentRaw = settings.theme.accent || "#7eb8ff";
            const accentInk =
              inverted && typeof computeDarkAccent === "function"
                ? computeDarkAccent(accentRaw)
                : accentRaw;
            darkStyle.textContent = `
              html, body {
                background: ${inverted ? "rgb(225, 225, 219)" : "#1F1F19"} !important;
                color: ${ink} !important;
              }
              p, div, span, font, li, td, th,
              h1, h2, h3, h4, h5, h6, pre, code,
              .view, .edui-editor-holder {
                color: ${ink} !important;
              }
              a {
                color: ${accentInk} !important;
              }
              ::selection {
                background: ${accentInk} !important;
                color: ${inverted ? "rgb(225, 225, 219)" : "#fff"} !important;
              }
            `;
            iframe.dataset.lcDarkInjected = "1";
          } else {
            const darkStyle = doc.getElementById("lc-editor-dark");
            if (darkStyle) darkStyle.remove();
            iframe.dataset.lcDarkInjected = "";
          }

          return true;
        } catch (e) {
          console.error("tryApply error:", e);
          return false;
        }
      };

      if (!tryApply()) {
        iframe.addEventListener("load", tryApply, { once: true });
        let attempts = 0;
        const timer = setInterval(() => {
          if (tryApply() || ++attempts > 20) clearInterval(timer);
        }, 500);
      }
    });
  }

  /* ---------- 长文章实时字数统计（功能栏 · 默认关闭） ----------
   * 口径（docs 定稿）：汉字按字、连续英文/数字按词，标点计入总字符。
   * 编辑器正文在 UEditor iframe 里，可能跨域（lf127.net，主帧读不到
   * contentDocument）：同源时直接计数；跨域时由 wc-frame.js（manifest
   * 单独注入子帧）计数后 postMessage 上报，主帧只认来自编辑器 iframe
   * contentWindow 的消息。角标位置：长文章写作页顶栏图标组（音乐图标
   * 左侧）内联；找不到锚点（如编辑弹窗）回退 fixed 挂 documentElement。
   * 不参与编辑器布局（编辑器 wrapper 一旦改 position 会挪走站点自带的
   * placeholder label，绝不能碰）。 */
  const WC_ID = "lc-word-count";
  const WC_MSG_UPDATE = "lc-wc-update";
  const WC_MSG_PING = "lc-wc-ping";
  const WC_IFRAME_SELECTORS = [
    'iframe[id^="baidu_editor"]',
    'iframe[id^="ueditor"]',
    ".edui-editor-iframeholder iframe",
    ".m-main iframe",
  ];
  let wcTimer = null;
  let wcBoundDoc = null;
  let wcLastText = null;
  let wcDebounce = 0;
  let wcMsgCounts = null; /* 跨域桥接上报的最新计数 {han, words, chars} */

  /* 字数统计已去开关、默认启用：只受总开关控制（写长文章的人属刚需，
   * 不写的人进不了长文章编辑器、完全无感）。忽略旧存储里的 wordCount:false */
  const wcOn = () => !!settings.enabled;

  /* 统计口径：汉字按字、连续英文/数字按词（内部连接符不断词），标点计入总字符 */
  function wcCount(text) {
    const t = String(text || "");
    const han = (t.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
    const words = (t.match(/[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g) || []).length;
    return { han, words, chars: t.replace(/\s/g, "").length, total: han + words };
  }
  const wcFmt = (n) => n.toLocaleString("en-US");

  function wcEditorDoc() {
    for (const sel of WC_IFRAME_SELECTORS) {
      const f = document.querySelector(sel);
      if (!f) continue;
      try {
        const d = f.contentDocument || (f.contentWindow && f.contentWindow.document);
        if (d && d.body) return d;
      } catch (e) {
        /* 跨域或尚未就绪：换下一个候选 */
      }
    }
    return null;
  }

  /* 只找 iframe 元素本身（跨域也能拿），用于「编辑器在不在」与消息源校验 */
  function wcIframeEl() {
    for (const sel of WC_IFRAME_SELECTORS) {
      const f = document.querySelector(sel);
      if (f) return f;
    }
    return null;
  }

  /* 跨域桥接：只认编辑器 iframe contentWindow 发来的计数 */
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== WC_MSG_UPDATE) return;
    const f = wcIframeEl();
    if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
    wcMsgCounts = {
      han: e.data.han | 0,
      words: e.data.words | 0,
      chars: e.data.chars | 0,
    };
    const el = document.getElementById(WC_ID);
    if (el) {
      const c = wcMsgCounts;
      wcRender(el, c.han, c.words, c.chars);
    }
  });

  function wcRemove() {
    if (wcTimer) {
      clearInterval(wcTimer);
      wcTimer = null;
    }
    if (wcDebounce) {
      clearTimeout(wcDebounce);
      wcDebounce = 0;
    }
    wcBoundDoc = null;
    wcLastText = null;
    wcMsgCounts = null;
    const el = document.getElementById(WC_ID);
    if (el) el.remove();
  }

  /* 顶栏锚点：长文章写作页头部右栏的白噪音（♪）/音乐按钮。2026-09-18
   * 线上 DOM：触发按钮是 #btn-music（class btn-icon btn-music，.right 第
   * 一个子元素）；#btm-music 是另一版本的写法；#menu-music 在旧版里是
   * 触发按钮、新版里则是藏在 header 下的白噪音下拉菜单（折叠态实测
   * 161x1px，能骗过「有盒子即可见」判定——靠 wcVisible 的最小高度挡掉，
   * 否则角标会被锚到菜单上、掉出顶栏左下角）。找不到就回退 fixed。 */
  function wcVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    /* 宽度不能设固定阈值——顶栏图标按钮可能只有一个窄字形（实测 8px 宽）；
       高度设 8px 下限，滤掉折叠成 1px 的下拉菜单 */
    return r.width > 0 && r.height >= 8 && r.bottom > 0 && r.top < vh0();
  }
  const WC_NOT_ANCHOR =
    /(btn|btm)-(publish|arrow|preview|klass|music)|author-ava|\bava\b|\blogo\b|u-select-menu/;
  function wcAnchorEl() {
    const hd = document.querySelector(".m-hd-longpost");
    if (!hd) return null;
    /* 按新旧版本顺序找触发按钮；直接在头部范围内找，不假定它所在的
     * 容器（.right 在部分版本里 float: left，不可靠）。 */
    for (const sel of ["#btn-music", "#btm-music", ".btn-music", "#menu-music"]) {
      const el = hd.querySelector(sel);
      if (wcVisible(el)) return el;
    }
    /* 回退：头部里第一个可见图标。发布/预览/箭头/头像/logo/下拉菜单都
     * 不是锚点——className 和 id 都过一遍名单，防止换前缀绕过。 */
    for (const el of hd.querySelectorAll("a, button, span, i")) {
      if (WC_NOT_ANCHOR.test(el.className || "") || WC_NOT_ANCHOR.test(el.id || ""))
        continue;
      if (wcVisible(el)) return el;
    }
    return null;
  }
  /* wcAnchorEl 用视口高判定可见性；FAB 段的 vh() 在这里还不可用，独立兜底 */
  const vh0 = () =>
    document.documentElement.clientHeight || window.innerHeight || 800;

  /* wcPlaceInline：把角标放到锚点（音乐图标）的「视觉左侧」。
   * 顶栏右栏在部分版本里是 flex-direction: row-reverse（实测 v1.1.1 角标被
   * 塞到了最右侧），此时 DOM 上「放在锚点之后」才是视觉上的左侧。所以先按
   * flex 方向选边，再用实测矩形校正一次（每元素只校正一次，避免来回抖动）。
   * 无布局信息时（jsdom 等）以 DOM 判定为准。 */
  function wcPlaceInline(el, anchor) {
    const parent = anchor.parentNode;
    if (!parent) return;
    if (el.__lcWcAnchor !== anchor) {
      el.__lcWcAnchor = anchor;
      el.dataset.wcFlip = "";
    }
    const rev =
      parent.nodeType === 1 &&
      getComputedStyle(parent).flexDirection === "row-reverse";
    const wantAfter = rev;
    const placed =
      el.parentNode === parent &&
      (wantAfter
        ? el.previousElementSibling === anchor
        : el.nextElementSibling === anchor);
    if (!placed) {
      parent.insertBefore(el, wantAfter ? anchor.nextSibling : anchor);
    }
    const a = anchor.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!a.width || !r.width) return; /* 无布局信息 → 认 DOM 判定 */
    if (el.dataset.wcFlip !== "1" && r.left >= a.right) {
      /* 实测仍在锚点右侧：换到另一侧 */
      el.dataset.wcFlip = "1";
      parent.insertBefore(el, wantAfter ? anchor : anchor.nextSibling);
    }
    /* 垂直对齐：float 行是顶对齐，角标会贴到容器顶、比图标高一截
     * （2026-09-18 实测差 ~17px）。按锚点中心差补偿 marginTop；flex
     * 垂直居中布局下差值≈0 不写，写了也会随重测收敛，不会抖。 */
    const a2 = anchor.getBoundingClientRect();
    const r2 = el.getBoundingClientRect();
    if (a2.height && r2.height) {
      const dy = a2.top + a2.height / 2 - (r2.top + r2.height / 2);
      if (Math.abs(dy) > 2) {
        el.style.marginTop =
          (parseFloat(el.style.marginTop) || 0) + Math.round(dy) + "px";
      }
    }
  }

  function wcPaint(el, inline) {
    const dark = isDarkMode();
    const st = el.style;
    if (inline) {
      /* 顶栏行内：占位随布局，配色贴合顶栏深浅 */
      st.cssText = "";
      st.display = "inline-flex";
      /* 线上 .right 是 position:absolute 的块容器，图标 a 全靠 float:left
       * 排成一行；角标若不跟着浮动，会作为普通 inline 内容被 float 挤到
       * 行尾右上角（2026-09-18 实测 rect [940,-1]）。float 在 flex 容器里
       * 会被忽略，对 row / row-reverse 版本无影响。 */
      st.cssFloat = "left";
      st.alignItems = "center";
      st.marginRight = "12px";
      st.padding = "3px 10px";
      st.borderRadius = "999px";
      st.font =
        "12px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif";
      st.fontVariantNumeric = "tabular-nums";
      st.pointerEvents = "none";
      st.userSelect = "none";
      st.whiteSpace = "nowrap";
      st.verticalAlign = "middle";
      st.background = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";
      st.color = dark ? "rgba(255,255,255,0.75)" : "rgba(40,40,48,0.65)";
      st.border = "1px solid " + (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)");
      return;
    }
    st.cssText = "";
    st.position = "fixed";
    st.right = "22px";
    st.bottom = "18px";
    st.zIndex = "2147482000"; /* 低于悬浮按钮宿主 2147483000，面板永远盖在角标上 */
    st.padding = "5px 11px";
    st.borderRadius = "999px";
    st.font =
      "12px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif";
    st.fontVariantNumeric = "tabular-nums";
    st.pointerEvents = "none"; /* 纯展示，不挡站点点击 */
    st.userSelect = "none";
    st.whiteSpace = "nowrap";
    st.background = dark ? "rgba(32,32,40,0.82)" : "rgba(255,255,255,0.86)";
    st.color = dark ? "rgba(255,255,255,0.82)" : "rgba(40,40,48,0.82)";
    st.border = "1px solid " + (dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)");
    st.boxShadow = dark ? "0 2px 10px rgba(0,0,0,0.4)" : "0 2px 10px rgba(0,0,0,0.1)";
    st.backdropFilter = "blur(6px)";
    st.webkitBackdropFilter = "blur(6px)";
  }

  function wcRender(el, han, words, chars) {
    el.textContent = "字数 " + wcFmt(han + words);
    el.title =
      "汉字 " + wcFmt(han) +
      " · 英文/数字词 " + wcFmt(words) +
      " · 总字符 " + wcFmt(chars) + "（含标点，不含空白）";
  }

  function wcUpdate() {
    const el = document.getElementById(WC_ID);
    if (!el) return;
    /* 同源编辑器：本地直读计数 */
    if (wcBoundDoc && wcBoundDoc.body) {
      const text = wcBoundDoc.body.innerText || wcBoundDoc.body.textContent || "";
      if (text === wcLastText) return; /* 文本没变就不重算、不写 DOM */
      wcLastText = text;
      const c = wcCount(text);
      wcRender(el, c.han, c.words, c.chars);
      return;
    }
    /* 跨域编辑器：用桥接脚本（wc-frame.js）上报的计数 */
    const c = wcMsgCounts;
    if (c) wcRender(el, c.han, c.words, c.chars);
  }

  function wcSchedule() {
    if (wcDebounce) clearTimeout(wcDebounce);
    wcDebounce = setTimeout(() => {
      wcDebounce = 0;
      wcUpdate();
    }, 160);
  }

  function applyWordCounter() {
    if (!wcOn()) {
      wcRemove();
      return;
    }

    const doc = wcEditorDoc();
    const frame = doc ? null : wcIframeEl();
    if (!doc && !frame) {
      wcRemove(); /* 页面上没有编辑器 → 角标一起收掉 */
      return;
    }

    /* 编辑器 iframe 会被反复重建，doc 变了就重新绑监听（旧 doc 已随 iframe 销毁） */
    if (doc !== wcBoundDoc) {
      wcBoundDoc = doc;
      wcLastText = null;
      wcMsgCounts = null;
      if (doc) {
        ["input", "keyup", "paste", "cut"].forEach((ev) =>
          doc.addEventListener(ev, wcSchedule, true),
        );
      }
    }

    /* 挂角标：顶栏行内优先，找不到锚点回退 fixed（两种模式切换时重挂） */
    const anchor = wcAnchorEl();
    const mode = anchor ? "inline" : "fixed";
    let el = document.getElementById(WC_ID);
    if (el && el.getAttribute("data-mode") !== mode) {
      el.remove();
      el = null;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = WC_ID;
      el.setAttribute("role", "status");
      el.setAttribute("data-mode", mode);
    }
    /* 先 wcPaint 再落位：wcPaint 开头 st.cssText="" 会清掉全部内联样式，
     * 若先落位（wcPlaceInline 里会按实测写 marginTop 做垂直对齐）再上漆，
     * 对齐补偿就被抹掉了——线上曾因此角标始终贴着页面顶部。 */
    wcPaint(el, mode === "inline");
    if (mode === "inline") {
      wcPlaceInline(el, anchor);
    } else if (!el.isConnected) {
      (document.documentElement || document.body).appendChild(el);
    }

    wcUpdate();

    /* 兜底轮询：UEditor 的 setContent/撤销/模板插入等路径不发 input 事件，
       iframe 重建后需要重新发现；跨域时顺带 ping 桥接脚本要最新计数。
       文本未变时 wcUpdate 直接返回，开销可忽略。 */
    if (!wcTimer) {
      wcTimer = setInterval(() => {
        if (!wcOn()) {
          wcRemove();
          return;
        }
        if (document.hidden) return;
        const d = wcEditorDoc();
        if (d && d !== wcBoundDoc) {
          lcSafe(applyWordCounter); /* iframe 重建：重新发现并绑监听 */
          return;
        }
        if (!d) {
          const f = wcIframeEl();
          if (!f) {
            lcSafe(applyWordCounter); /* 编辑器消失（滚出页面等）→ 收角标 */
            return;
          }
          /* 跨域：ping 桥接脚本要最新计数 */
          if (f.contentWindow) {
            try {
              f.contentWindow.postMessage({ type: WC_MSG_PING }, "*");
            } catch (e) {}
          }
        }
        wcUpdate();
      }, 1200);
    }
  }

  /* ---------- 私信列表：会话搜索（功能栏 · 默认开）----------
   * 位置 = 列表卡 header（`.g-box3 h2.w-fttl`）右端（作者拍板「卡片右上角」）。
   * 口径 = 纯 DOM 过滤当前页已加载会话：`.m-xlist li` 的昵称 `.xtit` +
   * 摘要 `.xcnt` 文本，lowercase 子串匹配。认账官方分页（约 19 条/页），
   * 翻页后需重新搜索——写进面板 hint 与空态文案。
   * 幂等重算：命中摘除 data-lc-dm-filtered、未命中打上，显隐由单条 CSS
   * 驱动；关键词变动 / 列表重渲染（翻页、新消息）都只是重算，绝不残留。
   * 暗色：搜索框在 #msgcontainer 反色子树内，按浅色值写、自动反成暗色。 */
  const DM_SEARCH_STYLE_ID = "lc-dm-search-style";
  const DM_SEARCH_WRAP_ID = "lc-dm-search-wrap";
  const DM_SEARCH_EMPTY_ID = "lc-dm-search-empty";
  const DM_SEARCH_CSS = `
    [data-lc-dm-filtered] { display: none !important; }
    .lc-dm-search-wrap {
      float: right; display: inline-flex; align-items: center; gap: 6px;
      margin-top: -2px;
    }
    .lc-dm-search-wrap input {
      width: 150px; padding: 3px 10px;
      border: 1px solid rgba(0,0,0,0.12); border-radius: 999px;
      background: rgba(255,255,255,0.9);
      font-size: 12px; line-height: 1.6; outline: none;
    }
    .lc-dm-search-wrap input:focus { border-color: #9b8fd0; }
    .lc-dm-search-hint { font-size: 11px; color: #999; white-space: nowrap; }
    .lc-dm-search-empty { display: none; margin: 10px 2px; font-size: 12px; }
    .lc-dm-search-empty.on { display: block; }
  `;
  let dmSearchKw = "";

  function applyDmSearch() {
    const list = document.querySelector("#msgcontainer .m-xlist");
    const on = !!(settings.enabled && settings.msg && settings.msg.search !== false);
    /* 清理：总开关关 / 功能关 / 不在私信页（.m-xlist 不存在） */
    if (!on || !list) {
      const st = document.getElementById(DM_SEARCH_STYLE_ID);
      if (st) st.remove();
      const wrap = document.getElementById(DM_SEARCH_WRAP_ID);
      if (wrap) wrap.remove();
      const empty = document.getElementById(DM_SEARCH_EMPTY_ID);
      if (empty) empty.remove();
      document
        .querySelectorAll("#msgcontainer .m-xlist li[data-lc-dm-filtered]")
        .forEach((li) => li.removeAttribute("data-lc-dm-filtered"));
      dmSearchKw = "";
      return;
    }
    /* 样式表只插一次 */
    if (!document.getElementById(DM_SEARCH_STYLE_ID)) {
      const st = document.createElement("style");
      st.id = DM_SEARCH_STYLE_ID;
      st.textContent = DM_SEARCH_CSS;
      document.head.appendChild(st);
    }
    /* UI：列表卡 header 右端。React/官方重渲染把 header 换掉时重建 */
    const box = list.closest(".g-box3") || list.parentElement;
    const header = (box && box.querySelector("h2.w-fttl")) || box;
    let wrap = document.getElementById(DM_SEARCH_WRAP_ID);
    if (header && (!wrap || wrap.parentElement !== header)) {
      if (wrap) wrap.remove();
      wrap = document.createElement("span");
      wrap.id = DM_SEARCH_WRAP_ID;
      wrap.className = "lc-dm-search-wrap";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "搜索会话（昵称 / 摘要）";
      input.value = dmSearchKw;
      input.addEventListener("input", () => {
        dmSearchKw = input.value;
        lcSafe(() => runDmFilter(list));
      });
      const hint = document.createElement("span");
      hint.className = "lc-dm-search-hint";
      hint.textContent = "仅本页";
      wrap.appendChild(input);
      wrap.appendChild(hint);
      header.appendChild(wrap);
    }
    /* 空态块（跟列表后面） */
    if (!document.getElementById(DM_SEARCH_EMPTY_ID)) {
      const empty = document.createElement("div");
      empty.id = DM_SEARCH_EMPTY_ID;
      empty.className = "lc-dm-search-empty s-fc2";
      list.insertAdjacentElement("afterend", empty);
    }
    runDmFilter(list);
  }

  function runDmFilter(list) {
    const kw = dmSearchKw.trim().toLowerCase();
    let hit = 0;
    let total = 0;
    list.querySelectorAll("li").forEach((li) => {
      const nick = li.querySelector(".xtit");
      const cnt = li.querySelector(".xcnt");
      if (!nick && !cnt) return; /* 空占位行不参与统计与过滤 */
      total++;
      const text = `${nick ? nick.textContent : ""} ${cnt ? cnt.textContent : ""}`
        .toLowerCase();
      if (!kw || text.includes(kw)) {
        li.removeAttribute("data-lc-dm-filtered");
        hit++;
      } else {
        li.setAttribute("data-lc-dm-filtered", "1");
      }
    });
    const empty = document.getElementById(DM_SEARCH_EMPTY_ID);
    if (empty) {
      const show = !!kw && total > 0 && hit === 0;
      const txt = show
        ? `没有匹配的会话（只搜索本页已加载的 ${total} 条）`
        : "";
      /* 等值不写：无条件重写文本节点会触发 MutationObserver → 链条重跑 →
         再写 → 自激死循环（同 1108 行注释的教训） */
      if (empty.textContent !== txt) empty.textContent = txt;
      if (empty.classList.contains("on") !== show) {
        empty.classList.toggle("on", show);
      }
    }
  }

  /* ---------- 关键词/用户过滤（功能栏 · 默认关闭） ----------
   * 范围（分期）：Phase 1 = 首页时间线 + 标签页的博文卡片；
   * 评论区过滤（Phase 2）与发现页暂不启用。
   * 设计要点（相对参考实现 Greasyfork「Lofter 增强插件」的修正）：
   * - 幂等全量重算：每次扫描范围内所有卡片，命中打 data-lc-filtered、
   *   未命中摘除，显隐由一条独立 CSS 驱动。规则增删/开关切换都只是
   *   重算，绝不残留（参考实现用内联 style + dataset 双份状态，删
   *   规则时要反向遍历恢复，易漏）；
   * - 用户按 id 精确等值匹配（主页链接 hostname 首段或路径首段），
   *   不用 href*="id" 子串包含——id "abc" 不能误杀 "abcxx"；
   * - 关键词统一 lowercase 子串匹配，口径固定：标题+正文+标签
   *   （参考实现过滤时不查标签、恢复时才查，口径不一致）；
   * - 挂主 MutationObserver 的 120ms 防抖链，不新开全页观察器。 */
  const FILTER_STYLE_ID = "lc-filter-style";
  const FILTER_COUNTER_ID = "lc-filter-counter";
  const FILTER_CARD_SELECTOR = ".m-mlist";
  const FILTER_CSS = `
    [data-lc-filtered] { display: none !important; }
    a.lc-mute-btn, a.lc-blk-btn {
      /* 跟着 float：作者行是全 float 排版（同字数角标那次教训），
       * 不浮动的 inline 元素会被后续浮动头像盖住 → 看似"缩到头像
       * 后面"且点不到。float 后按 DOM 序排在昵称/头像右侧同行 */
      float: left; position: relative; z-index: 5;
      display: inline-block; margin: 2px 0 0 6px; padding: 1px 7px;
      font-size: 11px; line-height: 1.6; border-radius: 999px;
      color: inherit; text-decoration: none;
      border: 1px solid currentColor; vertical-align: middle;
      cursor: default; user-select: none;
      /* 隐藏态：opacity+visibility 双保险（visibility 使其不可点/不挡操作）。
       * 淡出延迟 0.3s：「拉黑」可能换行落到作者行盒子外，鼠标离开行后
       * 需要时间挪过去；挪到按钮上后由下方按钮自身 :hover 接管保活。 */
      opacity: 0; visibility: hidden;
      transition: opacity 0.15s ease 0.3s, visibility 0s linear 0.3s;
    }
    /* 触发区 = 按钮的直接父容器（作者行），:has() 选父、不用猜行类名；
     * 键盘聚焦同样唤出；悬停按钮自身（无论在不在行盒内）都保活 */
    .m-mlist :has(> a.lc-mute-btn):hover a.lc-mute-btn,
    .m-mlist :has(> a.lc-mute-btn):focus-within a.lc-mute-btn,
    .m-mlist :has(> a.lc-blk-btn):hover a.lc-blk-btn,
    .m-mlist :has(> a.lc-blk-btn):focus-within a.lc-blk-btn,
    .m-mlist a.lc-mute-btn:hover,
    .m-mlist a.lc-blk-btn:hover,
    .m-mlist a.lc-mute-btn:focus-visible,
    .m-mlist a.lc-blk-btn:focus-visible {
      opacity: 0.55; visibility: visible; cursor: pointer;
      transition-delay: 0s;
    }
    .m-mlist :has(> a.lc-mute-btn):hover a.lc-mute-btn:hover,
    .m-mlist :has(> a.lc-blk-btn):hover a.lc-blk-btn:hover {
      opacity: 1;
    }
    /* tag chip 上的「屏蔽」小按钮：跟在 chip 后面（nextSibling），悬停
     * chip 唤出。tap 不做两段确认——本地可逆，面板/这里都可即时移除 */
    /* tag 页头「屏蔽」钮：仿原生 w-vsbtn-3（订阅同款）——高 23px、
     * 灰底白字、3px 圆角、hover 整体淡到 0.35。对齐实测（20260925o）：
     * 容器行盒 ~29px 高于按钮 23px，top 对齐把按钮钉在行盒顶（比订阅
     * 高 6px）；原生键是 baseline 对齐，改回 baseline 让文字基线对齐、
     * 盒子自然齐平。白字必须内联 !important（样式表输给站点的
     * a:hover{color:主题色!important} 长链） */
    a.lc-tag-page-blk {
      display: inline-block; margin: 0 0 0 6px;
      height: 23px; line-height: 23px; padding: 0 10px;
      font-size: 12px; border-radius: 3px;
      background: #9b9b9b; color: #fff !important;
      text-decoration: none; vertical-align: baseline;
      border: 0; cursor: pointer; user-select: none;
      opacity: 1; transition: opacity 0.3s;
    }
    a.lc-tag-page-blk:hover { opacity: 0.35; color: #fff !important; }
    a.lc-tag-page-blk[data-lc-blked="1"] {
      opacity: 0.55; text-decoration: line-through;
    }
    a.lc-tag-page-blk[data-lc-blked="1"]:hover {
      opacity: 0.85; color: #fff !important;
    }
    a.lc-tag-block-btn {
      display: inline-block; margin: 0 0 0 4px; padding: 0 6px;
      font-size: 11px; line-height: 1.6; border-radius: 999px;
      color: inherit; text-decoration: none;
      border: 1px solid currentColor; vertical-align: middle;
      cursor: default; user-select: none;
      opacity: 0; visibility: hidden;
      transition: opacity 0.15s ease 0.2s, visibility 0s linear 0.2s;
    }
    .m-mlist a:hover + a.lc-tag-block-btn,
    .m-mlist a.lc-tag-block-btn:hover,
    .m-mlist a.lc-tag-block-btn:focus-visible {
      opacity: 0.55; visibility: visible; cursor: pointer;
      transition-delay: 0s;
    }
    .m-mlist a:hover + a.lc-tag-block-btn:hover {
      opacity: 1;
    }
    #lc-filter-counter {
      position: fixed; left: 18px; bottom: 18px; z-index: 2147482000;
      padding: 4px 10px; border-radius: 999px; font-size: 12px; line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      background: rgba(255,255,255,0.86); color: rgba(40,40,48,0.7);
      border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      pointer-events: none; user-select: none; white-space: nowrap;
    }
  `;

  /* 生效范围：Phase 1 只认 www.lofter.com 的首页时间线与标签页。
   * 帖子永久页/发现页/个人主页一律不生效——个人主页模板各异且
   * 用户点进去本来就是要看 TA 的博文（产品决策，见 todo）。 */
  function filterScope() {
    const h = location.hostname;
    if (h !== "www.lofter.com" && h !== "lofter.com") return null;
    const p = location.pathname;
    if (p === "/" || p === "") return "home";
    if (p.startsWith("/tag/")) return "tag";
    return null;
  }

  /* 从作者主页链接提取稳定 id：xxx.lofter.com → "xxx"；
   * www.lofter.com/<seg>/… → 首段。非 lofter.com 域名一律不要。 */
  function filterUserIdFromLink(a) {
    try {
      const u = new URL(a.href, location.href);
      if (!/(^|\.)lofter\.com$/i.test(u.hostname)) return "";
      if (u.hostname !== "www.lofter.com" && u.hostname !== "lofter.com") {
        return u.hostname.split(".")[0] || "";
      }
      return u.pathname.split("/").filter(Boolean)[0] || "";
    } catch (e) {
      return "";
    }
  }

  function filterCardText(card) {
    let t = "";
    const tit = card.querySelector("h2.tit");
    if (tit) t += tit.textContent + "\n";
    const cnt = card.querySelector("div.cnt");
    if (cnt) t += cnt.textContent + "\n";
    card.querySelectorAll(".opta span").forEach((s) => {
      t += s.textContent + "\n";
    });
    return t.toLowerCase();
  }

  /* 作者链接：参考实现的两个锚点 + w-who 内兜底，取第一个能提取出 id 的 */
  function filterCardAuthor(card) {
    const links = card.querySelectorAll(
      "a.publishernick, div.mlistimg a[href], .w-who a[href]",
    );
    for (const a of links) {
      const id = filterUserIdFromLink(a);
      if (id) return { id, name: (a.textContent || "").trim(), link: a };
    }
    return null;
  }

  /* ---------- tag 屏蔽（2026-09-25 新增）----------
   * tag 名一律从链接 href 解码（/tag/<名>[/new|/total]），不用卡片
   * 文本：href 是站点生成的稳定原名（大小写/改写都不影响），且天然
   * 区别于正文里碰巧出现的同名词。候选锚点先认 .opta（卡片 meta 区，
   * 关键词过滤同款锚点），没有再全卡兜底（网格/瀑布流布局差异兜底），
   * 但正文区（.cnt/.txt/标题）一律排除——正文里提到某 tag 的链接
   * 不代表帖子被打了这个 tag。 */
  function filterTagFromLink(a) {
    try {
      const u = new URL(a.href, location.href);
      if (!/(^|\.)lofter\.com$/i.test(u.hostname)) return "";
      const m = u.pathname.match(/^\/tag\/([^\/?#]+)/);
      if (!m) return "";
      return decodeURIComponent(m[1]).trim();
    } catch (e) {
      return "";
    }
  }

  function filterCardTagLinks(card) {
    let as = card.querySelectorAll(".opta a[href]");
    if (!as.length) as = card.querySelectorAll("a[href]");
    const out = [];
    for (const a of as) {
      if (a.closest(".cnt, .txt, h2.tit")) continue;
      if (
        a.classList.contains("lc-tag-block-btn") ||
        a.classList.contains("lc-mute-btn") ||
        a.classList.contains("lc-blk-btn")
      ) {
        continue;
      }
      if (filterTagFromLink(a)) {
        /* tag 页头部的「分享到」图标和瀑布流/网格切换的 href 也指向
         * /tag/<名>（分享的是本页链接、切换的是本 tag 的另一视图），
         * 2026-09-25 实测被误挂「屏蔽」键。真 chip 有可见文字且与
         * tag 名一致；图标链接 textContent 为空，一条判据全排除 */
        const txt = (a.textContent || "").trim();
        if (!txt) continue;
        out.push(a);
      }
    }
    return out;
  }

  /* chip 悬停「屏蔽」小按钮：跟着 chip（insertAdjacentElement afterend，
   * 悬停 chip 由 CSS 兄弟选择器唤出）。点击写入 filter.tags → persist
   * → applyFilter 重算（本卡即时隐藏）。等值守卫防自激 */
  function filterEnsureTagBtns(card) {
    for (const a of filterCardTagLinks(card)) {
      const next = a.nextElementSibling;
      if (next && next.classList && next.classList.contains("lc-tag-block-btn")) {
        continue;
      }
      const btn = document.createElement("a");
      btn.className = "lc-tag-block-btn";
      btn.textContent = "屏蔽";
      btn.title = "屏蔽该 tag 的所有帖子（可在扩展面板移除）";
      const name = filterTagFromLink(a);
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!name) return;
          if (!settings.filter) settings.filter = LC_clone(LC_DEFAULTS.filter);
          if (!Array.isArray(settings.filter.tags)) settings.filter.tags = [];
          if (
            settings.filter.tags.some(
              (t) => String(t).toLowerCase() === name.toLowerCase(),
            )
          ) {
            return;
          }
          settings.filter.tags.push(name);
          filterPersist();
          applyFilter();
        },
        true,
      );
      a.insertAdjacentElement("afterend", btn);
    }
  }

  /* tag 页头部「屏蔽」按钮：插在「订阅」右侧，一键屏蔽当前 tag（再点
   * 取消）。2026-09-25 用户拍板：不放卡片 chip 悬停里，放页头常驻。
   * 教训两条（20260925k/l 真机实锤）：
   * ①锚点列表区 React 每轮重渲染都换节点 → 无唯一约束时孤儿铺一屏；
   * ②「前邻不是订阅键就拆了重建」的自愈 = 每轮都是 DOM 变异 → 触发
   *   下一轮扫描 → 再重建……1~2 秒一次自激振荡，台头被 LOFTER 的连
   *   锁重渲染一点点撑高。所以现在：模块级引用 + 已连接就绝不动 DOM
   *   （稳定态零写入，振荡无从谈起），只有按钮真被摘掉才重建一次。 */
  let lcTagPageBtn = null;
  function filterEnsureTagPageBtn() {
    if (!/^\/tag\/[^\/?#]+/.test(location.pathname)) return;
    const m = location.pathname.match(/^\/tag\/([^\/?#]+)/);
    let tagName = "";
    try {
      tagName = decodeURIComponent(m[1]).trim();
    } catch (e) {
      return;
    }
    if (!tagName) return;
    if (!(lcTagPageBtn && lcTagPageBtn.isConnected)) {
      lcTagPageBtn = document.getElementById("lc-tag-page-blk");
    }
    if (!(lcTagPageBtn && lcTagPageBtn.isConnected)) {
      document
        .querySelectorAll("a.lc-tag-page-blk")
        .forEach((el) => el.remove());
      const sub = [...document.querySelectorAll("a,button,span,div")].find(
        (el) => {
          const t = (el.textContent || "").trim();
          return (
            t.length > 0 &&
            t.length <= 6 &&
            t.endsWith("订阅") &&
            el.offsetParent !== null
          );
        },
      );
      if (!sub) return;
      const anchor = sub.closest("a,button") || sub;
      const btn = document.createElement("a");
      btn.id = "lc-tag-page-blk";
      btn.className = "lc-tag-page-blk";
      /* 站点的 a:hover{color:主题色!important} 规则链里有一串
       * :not(#id)，特异性在 !important 层面仍可能压过我们的样式表
       * 规则（20260925n 真机实证 hover 依旧变色）——内联 !important
       * 高于一切样式表规则，只有这条路稳赢 */
      btn.style.setProperty("color", "#fff", "important");
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!settings.filter) settings.filter = LC_clone(LC_DEFAULTS.filter);
          if (!Array.isArray(settings.filter.tags)) settings.filter.tags = [];
          const i = settings.filter.tags.findIndex(
            (t) => String(t).toLowerCase() === tagName.toLowerCase(),
          );
          const blocked = i >= 0;
          if (blocked) settings.filter.tags.splice(i, 1);
          else settings.filter.tags.push(tagName);
          filterPersist();
          applyFilter();
        },
        true,
      );
      anchor.insertAdjacentElement("afterend", btn);
      /* 对齐自校准（20260925q 控制台实证 before=6/after=0）：容器行盒
       * 高于按钮、原生键是精灵图基线不规则，静态 vertical-align 三换
       * 都没对准。插完后实测两键顶差，position:relative 平移归零——
       * relative 不参与布局流（不挤兄弟、不引发重排循环），且只在
       * 创建时写一次，稳定态零写入原则不破坏 */
      try {
        const dx =
          anchor.getBoundingClientRect().top -
          btn.getBoundingClientRect().top;
        if (Math.abs(dx) > 0.5) {
          btn.style.position = "relative";
          btn.style.top = dx.toFixed(1) + "px";
        }
      } catch (e2) {}
      lcTagPageBtn = btn;
    }
    const want = (settings.filter.tags || []).some(
      (t) => String(t).toLowerCase() === tagName.toLowerCase(),
    )
      ? "1"
      : "0";
    if (lcTagPageBtn.getAttribute("data-lc-blked") !== want) {
      lcTagPageBtn.textContent = want === "1" ? "已屏蔽" : "屏蔽";
      lcTagPageBtn.title =
        want === "1"
          ? "当前 tag 已隐藏，点击取消隐藏"
          : "隐藏带「" + tagName + "」tag 的所有帖子（面板可移除）";
      lcTagPageBtn.setAttribute("data-lc-blked", want);
    }
  }

  /* ---------- 官方拉黑：复刻 LOFTER 设置页的 DWR 调用 ----------
   * 2026-09-19 抓包确认（详见 lc-dwr.js 顶部注释）。
   * 注意：仅 www.lofter.com（首页/标签页）同源可调；其它子域会跨域，
   * Phase 2 评论区若在别的域用到，需改走 background 转发。
   * 回复解析在 lc-dwr.js：手写解析器，绝不 eval 远端字符串。 */
  let lcOfficialBlNames = new Set(); /* 官方黑名单里的 blogName 集合 */
  let lcOfficialBlPromise = null; /* 防并发重复拉取 */

  const lcOfficialDwr = LC_dwrCall;

  /* 惰性拉一次官方黑名单（每页至多一次），用于「拉黑」按钮的初始状态 */
  function lcOfficialBlReady() {
    if (lcOfficialBlPromise) return lcOfficialBlPromise;
    lcOfficialBlPromise = lcOfficialDwr("getBlacklistUserList", [
      "number:200",
      "number:0",
    ])
      .then((raw) => {
        const names = [];
        (Array.isArray(raw) ? raw : []).forEach((e) => {
          if (e.blogInfo && e.blogInfo.blogName) {
            const n = String(e.blogInfo.blogName).toLowerCase();
            lcOfficialBlNames.add(n);
            names.push(n);
          }
        });
        /* 顺手写镜像：评论区过滤在任意帧读 storage，不依赖本帧能否调 DWR */
        if (names.length) {
          try {
            chrome.storage.local.set(
              {
                lc_official_bl_v1: {
                  names: Array.from(new Set(names)),
                  ts: Date.now(),
                },
              },
              () => {},
            );
          } catch (e2) {}
        }
      })
      .catch(() => {
        /* 读取失败不阻塞过滤功能，只是按钮初始态未知 */
      });
    return lcOfficialBlPromise;
  }

  /* 卡片作者旁的双动作按钮：「隐藏」= 插件本地屏蔽（无感）；
   * 「拉黑」= 官方黑名单（服务端强隔离、对方可感知，两段确认） */
  function filterEnsureMuteBtn(card, author) {
    if (!card.querySelector("a.lc-mute-btn")) {
      const btn = document.createElement("a");
      btn.className = "lc-mute-btn";
      btn.textContent = "隐藏";
      /* 故意不设 href：设了 javascript:void(0) 会在浏览器状态栏常驻显示 */
      btn.title = "屏蔽该用户的帖子（可在扩展面板撤销）";
      btn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!settings.filter) settings.filter = LC_clone(LC_DEFAULTS.filter);
          if (!Array.isArray(settings.filter.users)) settings.filter.users = [];
          if (settings.filter.users.some((u) => u.id === author.id)) return;
          settings.filter.users.push({
            id: author.id,
            name: author.name || author.id,
          });
          filterPersist();
          applyFilter();
        },
        true,
      );
      author.link.insertAdjacentElement("afterend", btn);
    }
    if (!card.querySelector("a.lc-blk-btn")) {
      const blk = document.createElement("a");
      blk.className = "lc-blk-btn";
      blk.title = "加入 LOFTER 官方黑名单：TA 无法评论/私信你，动态与标签页不再显示 TA（对方可能感知）";
      blk.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          /* 两段式确认：官方拉黑是对方可感知的重操作，防误触 */
          if (blk.dataset.confirm !== "1") {
            blk.dataset.confirm = "1";
            blk.textContent = "确认拉黑？";
            setTimeout(() => {
              if (blk.dataset.confirm === "1") {
                blk.dataset.confirm = "";
                blk.textContent = "拉黑";
              }
            }, 3000);
            return;
          }
          blk.dataset.confirm = "";
          blk.textContent = "…";
          /* 先落本地隐藏，再异步补官方拉黑——顺序不能反：
           * 子域页面（*.lofter.com 的博文页）跨域调不通 DWR，此前失败
           * 分支里什么都不写，表现为「点了拉黑，帖子与评论照旧可见」
           * （2026-09-21 实测：屏蔽名单为空）。本地先写入后，无论官方
           * 是否成功，帖子与评论都立刻不再显示；官方失败也不回滚。 */
          if (!settings.filter) settings.filter = LC_clone(LC_DEFAULTS.filter);
          if (!Array.isArray(settings.filter.users)) settings.filter.users = [];
          if (!settings.filter.users.some((u) => u.id === author.id)) {
            settings.filter.users.push({
              id: author.id,
              name: author.name || author.id,
            });
            filterPersist();
          }
          applyFilter();
          lcOfficialDwr("addBlacklist", ["string:" + author.id, "number:0"])
            .then(() => {
              lcOfficialBlNames.add(author.id.toLowerCase());
              blk.textContent = "已拉黑";
            })
            .catch((err) => {
              blk.textContent = "已本地隐藏";
              blk.title =
                "官方拉黑失败（" +
                String((err && err.message) || err) +
                "）：已改为本地隐藏，帖子与评论都不再显示";
              setTimeout(() => {
                blk.textContent = "拉黑";
              }, 2500);
            });
        },
        true,
      );
      /* 初始态：官方黑名单加载完后，已在名单里的直接显示「已拉黑」 */
      lcOfficialBlReady().then(() => {
        if (lcOfficialBlNames.has(author.id.toLowerCase())) {
          blk.textContent = "已拉黑";
          blk.dataset.confirm = "";
        } else if (!blk.textContent || blk.textContent === "拉黑") {
          blk.textContent = "拉黑";
        }
      });
      blk.textContent = "拉黑";
      const muteBtn = card.querySelector("a.lc-mute-btn");
      if (muteBtn) muteBtn.insertAdjacentElement("afterend", blk);
      else author.link.insertAdjacentElement("afterend", blk);
    }
  }

  /* 卡片上点「隐藏」后把 users 写回 storage；走 get→merge→set，
   * 避免覆盖 popup 同时写入的其它字段。onChanged 会再触发 applyAll。 */
  function filterPersist() {
    try {
      chrome.storage.local.get(LC_STORAGE_KEY, (res) => {
        const cur = res[LC_STORAGE_KEY] || {};
        cur.filter = LC_clone(settings.filter);
        chrome.storage.local.set({ [LC_STORAGE_KEY]: cur }, () => {});
      });
    } catch (e) {}
  }

  /* 内联 display 的备份/还原——备份存模块级 WeakMap，不写进卡片 DOM。
   * 血泪史：上一版备份存 data-* 属性，LOFTER 的 React 重渲染/水合会把
   * 不认识的 data-* 属性洗掉、style 却原样保留 → 所有权标记丢失 →
   * 恢复函数提前返回 → 我们写的 display:none!important 成孤儿，卡片
   * 永久隐藏只能刷新（2026-09-19 线上实证：计数器归零＝扫描在跑且
   * 未命中、标记也摘了，卡片却仍隐藏——恢复败在标记没了）。
   * WeakMap 键为节点、外部洗不到；弱引用不阻碍节点回收。
   * Set 仅用于关闭过滤时枚举兜底（WeakMap 不可枚举）。 */
  const lcDispBackup = new WeakMap();
  const lcDispBacked = new Set();
  function filterHideCard(card) {
    const cur = card.style.getPropertyValue("display");
    const curPrio = card.style.getPropertyPriority("display");
    const b = lcDispBackup.get(card);
    if (!b) {
      lcDispBackup.set(card, { prev: cur, prio: curPrio });
      lcDispBacked.add(card);
    } else if (!(cur === "none" && curPrio === "important")) {
      /* 我们的隐藏被外部洗掉、LOFTER 又写了新内联值 → 刷新备份 */
      b.prev = cur;
      b.prio = curPrio;
    }
    try {
      card.style.setProperty("display", "none", "important");
    } catch (e) {}
  }
  function filterRestoreDisplay(card) {
    const b = lcDispBackup.get(card);
    if (!b) return;
    lcDispBackup.delete(card);
    lcDispBacked.delete(card);
    try {
      if (b.prev) {
        card.style.setProperty("display", b.prev, b.prio || "");
      } else {
        card.style.removeProperty("display");
      }
    } catch (e) {}
  }

  function filterClearAll() {
    document
      .querySelectorAll("[data-lc-filtered]")
      .forEach((el) => {
        el.removeAttribute("data-lc-filtered");
        filterRestoreDisplay(el);
      });
    /* 孤儿兜底：标记被外部洗掉、但内联隐藏还在的卡（备份在 WeakMap 里），
     * 关闭过滤时一并还原——否则这些卡在过滤关闭后仍永久隐藏 */
    lcDispBacked.forEach((el) => {
      try {
        el.removeAttribute("data-lc-filtered");
      } catch (e) {}
      filterRestoreDisplay(el);
    });
    /* 「隐藏/拉黑」按钮一并收掉：CSS 已清空，残留按钮会退化成无样式
     * 裸文字（2026-09-21 实测：只删 mute 漏了 blk，「拉黑」常驻叠在头像上） */
    document
      .querySelectorAll(
        "a.lc-mute-btn, a.lc-blk-btn, a.lc-tag-block-btn, a.lc-tag-page-blk",
      )
      .forEach((el) => el.remove());
    const c = document.getElementById(FILTER_COUNTER_ID);
    if (c) c.remove();
  }

  let filterSig = "";
  function applyFilter() {
    const f = settings.filter;
    const scope = filterScope();
    /* scopeOk = 功能在当前页生效（决定「隐藏/拉黑」按钮与扫描是否运行）；
     * 旧写法 active 还要求"至少一条关键词或一个用户"——列表为空时整个
     * 模块直接进 off 分支，按钮也被 filterClearAll 收掉：开着过滤却
     * 找不到「隐藏」按钮（2026-09-21 用户实测）。按钮与规则解耦后，
     * 空规则时扫描照跑（命中为零、只挂按钮），语义才是"过滤已启用"。 */
    const active = !!(
      settings.enabled &&
      f &&
      f.enabled &&
      scope &&
      f.scope &&
      f.scope[scope]
    );

    let st = document.getElementById(FILTER_STYLE_ID);
    if (active) {
      if (!st) {
        st = document.createElement("style");
        st.id = FILTER_STYLE_ID;
        (document.head || document.documentElement).appendChild(st);
      }
      /* 每次激活都回填 CSS：关闭分支只清空 textContent 不删元素，
       * 若仅在创建时写入一次，重开过滤后 CSS 永远缺失——标记照打、
       * 计数照显，但一条也藏不掉（2026-09-18 线上实测踩坑） */
      st.textContent = FILTER_CSS;
    }

    if (!active) {
      /* 签名兜底：只在状态可能残留时清一次，避免每批变异都全页扫 */
      if (filterSig !== "off") {
        filterSig = "off";
        const st2 = st;
        if (st2) st2.textContent = "";
        filterClearAll();
      }
      return;
    }

    const kws = (f.keywords || [])
      .map((k) => String(k).toLowerCase().trim())
      .filter(Boolean);
    const userIds = new Set((f.users || []).map((u) => u.id));
    const tagSet = new Set(
      (f.tags || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean),
    );
    /* 全量幂等重算，不做签名早退。签名优化（规则+卡片数+标记数做指纹跳过
     * 重扫）连修三轮仍有竞态：标记数落盘时序、React 重渲染洗标记、"移除
     * 规则后不恢复/计数卡死"全是它卡住重扫的症状。而扫描本身只是几十张
     * 卡片的文本匹配（微秒级），每批防抖变异跑一次毫无压力——可靠性 >
     * 微优化。off 态保留一次性清理去重（filterSig="off"）。 */

    let hidden = 0;
    try {
      filterEnsureTagPageBtn();
    } catch (e) {}
    document.querySelectorAll(FILTER_CARD_SELECTOR).forEach((card) => {
      try {
        /* 嵌套列表只算外层：只查祖先、绝不含自身。closest() 会匹配元素
         * 自己——已标记的卡从第二轮扫描起全被误跳过：hidden 永远数 0
         * （计数器闪现即逝的元凶），规则移除后也永远走不到还原分支
         * （此前恢复全靠 React 洗标记后的孤儿自愈兜底，页面安静时不恢复） */
        const anc =
          card.parentElement &&
          card.parentElement.closest("[data-lc-filtered]");
        if (anc) return;
        /* tag 页头卡整卡豁免：台头里藏着指向本 tag 的链接（分享/视图切
         * 换），当前 tag 被屏蔽时 tagHit 会把整个台头藏掉；隐藏型小按钮
         * （mute/chip，visibility:hidden 仍占位）在台头里累积也会把它
         * 一点点撑高（20260925k/l 真机实锤） */
        if (card.querySelector("#lc-tag-page-blk")) return;
        const author = filterCardAuthor(card);
        const tagLinks = filterCardTagLinks(card);
        const textHit =
          kws.length && kws.some((kw) => filterCardText(card).includes(kw));
        const userHit = author && userIds.has(author.id);
        const tagHit =
          tagSet.size &&
          tagLinks.some((a) => {
            const n = filterTagFromLink(a);
            return n && tagSet.has(n.toLowerCase());
          });
        if (textHit || userHit || tagHit) {
          card.setAttribute("data-lc-filtered", "");
          /* 双保险：光靠样式表规则藏不住（2026-09-19 线上实证：标记在、
           * CSS 在、帖子却可见——LOFTER 自有规则的级联权重更高）。内联
           * !important 在作者样式里优先级最高，必赢；React 重渲染会连
           * 内联样式一起洗掉，下次重扫会补回 */
          filterHideCard(card);
          hidden++;
        } else {
          card.removeAttribute("data-lc-filtered");
          filterRestoreDisplay(card);
          if (author && settings.enabled) {
            try {
              filterEnsureMuteBtn(card, author);
            } catch (e) {}
          }
          try {
            filterEnsureTagBtns(card);
          } catch (e) {}
        }
      } catch (e) {
        /* 单张卡片异常不拖垮整轮扫描（下一批变异会重试） */
      }
    });
    filterSig = "active";

    /* 「已过滤 N 条」提示：防误杀无感——至少让用户知道过滤在工作 */
    const counter = document.getElementById(FILTER_COUNTER_ID);
    if (f.showCounter !== false && hidden > 0) {
      if (counter) {
        counter.textContent = "已过滤 " + hidden + " 条";
      } else {
        const el = document.createElement("div");
        el.id = FILTER_COUNTER_ID;
        el.textContent = "已过滤 " + hidden + " 条";
        el.setAttribute("role", "status");
        (document.body || document.documentElement).appendChild(el);
      }
    } else if (counter) {
      counter.remove();
    }
  }

  /* ---------- 导航栏两档玻璃（低透毛玻璃 / 高透液态玻璃，对抗Lofter的JS内联覆盖）---------- */
  let navbarTimer = null;

  /* ========== 导航栏液态玻璃（hyalite）+ 自适应材质 ==========
   * 仅 Chromium 生效（Hyalite.supported() 门禁）；矮条带必须用小参数组
   * settings.navbar.glass（bevel 会被钳到短边一半，大厚度会把整面背景拧花）。
   * 材质切换只动 .lc-glass-dark 类，对应样式由 buildCSS 生成，避免整表重建。 */
  const lcHyAttached = new Set(); // 已 attach 的导航栏元素（SPA 换新节点后重新 attach）

  /* 新版管线定位真实导航条：[class*="box-web"] 是子串匹配，
     不同页面会命中页壳（含全页内容）、页脚（box-web-15 等）等大容器
     （查看更多页实证：类挂壳上 → 全页超链接被刷白）。
     因此遍历所有匹配，取「第3层 div 存在且高度像导航条（28~140px）」的第一个 */
  function lcFindNavBox() {
    const boxes = document.querySelectorAll(
      '#application.lofter-root-container [class*="box-web"]',
    );
    for (const box of boxes) {
      const inner = box.querySelector(
        ":scope > div:first-child > div:first-child",
      );
      if (!inner) continue;
      const h = inner.getBoundingClientRect().height;
      if (h >= 28 && h <= 140) return inner;
    }
    return null;
  }

  function lcNavHyEls() {
    const els = [];
    const bar = document.getElementById("lofter-top-bar");
    if (bar) els.push(bar);
    /* 新版管线：外层 box-web 的第 3 层 div 才是玻璃容器（与 buildCSS 选择器同构） */
    const inner = lcFindNavBox();
    if (inner) els.push(inner);
    return els;
  }

  function lcHyDetachAll() {
    if (!(window.Hyalite && Hyalite.detach)) return;
    lcHyAttached.forEach((el) => {
      try {
        Hyalite.detach(el);
      } catch (e) {
        /* 忽略 */
      }
    });
    lcHyAttached.clear();
    /* 深材质类一并收掉，避免残留白字 */
    document
      .querySelectorAll(".lc-glass-dark")
      .forEach((el) => el.classList.remove("lc-glass-dark"));
  }

  function lcHyAttachNav() {
    if (!(window.Hyalite && Hyalite.supported && Hyalite.supported())) return;
    const g = settings.navbar.glass || {};
    const num = (v, d) => (typeof v === "number" && !isNaN(v) ? v : d);
    const opts = {
      bevel: num(g.bevel, 14),
      thickness: num(g.thickness, 16),
      slope: num(g.slope, 2.4),
      shape: ["circle", "squircle", "lip"].includes(g.shape)
        ? g.shape
        : "squircle",
      blur: num(g.blur, 0),
      dispersion: num(g.dispersion, 1.2),
      shade: num(g.shade, 0.4),
      rim: num(g.rim, 1.6),
      edgeW: num(g.edgeW, 5),
      sat: num(g.sat, 0.9),
      light: num(g.light, -140),
    };
    lcNavHyEls().forEach((el) => {
      if (lcHyAttached.has(el)) return;
      try {
        Hyalite.attach(el, opts);
      } catch (e) {
        return;
      }
      lcHyAttached.add(el);
      /* React 看门：重渲染重写 style 会抹掉 --hyalite，缺了就 refresh。
         先比较再写，避免「观察→写→再触发」死循环 */
      if (!el.dataset.lcHyGuard) {
        el.dataset.lcHyGuard = "1";
        new MutationObserver(() => {
          if (!lcHyAttached.has(el)) return;
          if (!el.style.getPropertyValue("--hyalite")) {
            try {
              Hyalite.refresh(el);
            } catch (e) {
              /* 忽略 */
            }
          }
        }).observe(el, { attributes: true, attributeFilter: ["style"] });
      }
    });
    /* SPA 换掉的旧节点出集合，防止无限膨胀 */
    lcHyAttached.forEach((el) => {
      if (!el.isConnected) lcHyAttached.delete(el);
    });
  }

  /* ---- 亮度采样：优先用户背景图（cover 铺图复现），纯色/渐变解析，其余视作亮底 ---- */
  const lcLumaCv = document.createElement("canvas");
  lcLumaCv.width = 64;
  lcLumaCv.height = 24;
  let lcLumaImg = null;
  let lcLumaImgKey = "";
  const lcLin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lcRelLuma = (rgb) =>
    0.2126 * lcLin(rgb[0]) + 0.7152 * lcLin(rgb[1]) + 0.0722 * lcLin(rgb[2]);
  function lcHexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lcNavLuma(el) {
    const b = settings.background || {};
    if (b.mode === "image" && b.image && b.image.dataUrl) {
      if (lcLumaImgKey !== b.image.dataUrl || !lcLumaImg) {
        lcLumaImgKey = b.image.dataUrl;
        lcLumaImg = new Image();
        lcLumaImg.src = b.image.dataUrl;
      }
      if (!lcLumaImg.complete || !lcLumaImg.naturalWidth) return null; // 图未就绪：保持现状
      const ctx = lcLumaCv.getContext("2d", { willReadFrequently: true });
      const W = lcLumaCv.width,
        H = lcLumaCv.height;
      const ir = lcLumaImg.naturalWidth / lcLumaImg.naturalHeight;
      const vr = innerWidth / innerHeight;
      let dw, dh;
      if (ir > vr) {
        dh = innerHeight;
        dw = dh * ir;
      } else {
        dw = innerWidth;
        dh = dw / ir;
      }
      ctx.drawImage(
        lcLumaImg,
        (innerWidth - dw) / 2,
        (innerHeight - dh) / 2,
        dw,
        dh,
        0,
        0,
        W,
        H,
      );
      const r = el.getBoundingClientRect();
      const sx = Math.max(0, (r.left / innerWidth) * W);
      const sy = Math.max(0, (r.top / innerHeight) * H);
      const sw = Math.max(1, Math.min(W - sx, (r.width / innerWidth) * W) | 0);
      const sh = Math.max(1, Math.min(H - sy, (r.height / innerHeight) * H) | 0);
      const d = ctx.getImageData(sx | 0, sy | 0, sw, sh).data;
      let sum = 0,
        n = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum +=
          0.2126 * lcLin(d[i]) +
          0.7152 * lcLin(d[i + 1]) +
          0.0722 * lcLin(d[i + 2]);
        n++;
      }
      return n ? sum / n : 0.5;
    }
    if (b.mode === "color") {
      const rgb = lcHexToRgb(b.color);
      if (rgb) return lcRelLuma(rgb);
    }
    if (b.mode === "gradient" && b.gradient) {
      const a = lcHexToRgb(b.gradient.from);
      const c = lcHexToRgb(b.gradient.to);
      if (a && c)
        return lcRelLuma([
          (a[0] + c[0]) / 2,
          (a[1] + c[1]) / 2,
          (a[2] + c[2]) / 2,
        ]);
    }
    /* pattern/off 等其它模式：视作亮底（LOFTER 默认白） */
    return 0.9;
  }

  function lcUpdateNavMaterial() {
    const mode = settings.navbar.matMode || "auto";
    const threshold =
      typeof settings.navbar.matThreshold === "number"
        ? settings.navbar.matThreshold
        : 0.5;
    /* 类一律挂玻璃条自身：老管线 = #lofter-top-bar，新管线 = box-web 第3层 div
       （与 buildCSS 的 .lc-glass-dark 选择器同构，也避免挂到大容器上刷白全页） */
    const targets = [];
    const bar = document.getElementById("lofter-top-bar");
    if (bar) targets.push(bar);
    const inner = lcFindNavBox();
    if (inner) targets.push(inner);
    targets.forEach((el) => {
      let dark;
      if (mode === "dark" || (mode === "auto" && isDarkMode())) dark = true;
      else if (mode === "light") dark = false;
      else {
        const L = lcNavLuma(el);
        dark =
          L === null ? el.classList.contains("lc-glass-dark") : L < threshold;
      }
      if (el.classList.contains("lc-glass-dark") !== dark)
        el.classList.toggle("lc-glass-dark", dark);
    });
  }

  /* ========== 右侧栏液态玻璃（hyalite）：首页 #rside > #slide-bar 内的卡片 ==========
   * 与导航栏同一套引擎，差别有三：
   *   1) 目标是竖长卡片，参数用 settings.sidebar.glass（bevel 22 而非 14）；
   *   2) 玻璃元素必须落在「无 filter 祖先」的子树里——首页侧栏靠
   *      `#rside > * { filter: invert }` 反色，filter 一存在就成了 backdrop
   *      root，玻璃只能采到祖先内部的空白，折射全丢。故开关打开时该反色
   *      由 CSS 让位（见 buildCSS 右侧栏玻璃块），改为深色玻璃 + 白字；
   *   3) 卡片会被 React 重建，故同样挂「--hyalite 丢了就 refresh」看门。 */
  const lcSideHyAttached = new Set();

  function lcSideGlassOn() {
    if (!(settings.enabled && settings.sidebar && settings.sidebar.hyalite))
      return false;
    /* 纯磨砂档不依赖 hyalite 库；只有折射档才要求 Hyalite.supported() */
    if (!settings.sidebar.refract) return true;
    return !!(window.Hyalite && Hyalite.supported && Hyalite.supported());
  }

  /* 卡片级元素：slide-bar 下的 *-box-web，且祖先里没有别的 *-box-web
     （排除卡片内部的嵌套块）；尺寸过小的组件（图标、按钮）跳过。
     2026-09-29 扩：他人喜欢页右栏（#rside .g-box .m-menu，内含
     #likesidelist）纳入同一套玻璃——同一开关控制、同一 CSS 锚
     （.lc-side-glass）。2026-09-30 再扩：tag 页参与用户卡
     （#rside #tageditor .m-menu，内含 .participate-user-title-w）。
     分源收集（真机实锤教训）：首页 slide-bar 卡的
     嵌套排除**只看同类**（[class*="-box-web"]）——首轮把 .m-menu 塞进
     同一张 closest 排除表，首页侧栏卡的祖先链若经过 .m-menu 容器就整卡
     被跳过，玻璃与暗色双双失效；favblog 来源只在无 #slide-bar 的页面
     收集（判页口径与 buildCSS 的 favblogSide 一致），排除嵌套在另一个
     .m-menu 里的候选（closest 不含自己，不会误杀） */
  function lcSideGlassEls() {
    const els = [];
    document.querySelectorAll('#slide-bar [class*="-box-web"]').forEach((el) => {
      const p = el.parentElement;
      if (p && p.closest && p.closest('[class*="-box-web"]')) return;
      const r = el.getBoundingClientRect();
      if (r.width < 160 || r.height < 44) return;
      els.push(el);
    });
    if (!document.getElementById("slide-bar")) {
      /* 无 #slide-bar 页面上的玻璃卡来源（判页口径与 buildCSS 的
         `:not(:has(#slide-bar))` 守卫一致）：
         - favblog：喜欢列表卡 .m-menu:has(#likesidelist)
         - tag 页：参与用户卡 .m-menu:has(.participate-user-title-w)
             （2026-09-30 扩；挂在 #tageditor 下，锚与其他形态互不命中） */
      [
        "#rside .g-box .m-menu:has(#likesidelist)",
        "#rside #tageditor .m-menu:has(.participate-user-title-w)",
      ].forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const p = el.parentElement;
          if (p && p.closest && p.closest("#rside .g-box .m-menu")) return;
          const r = el.getBoundingClientRect();
          if (r.width < 160 || r.height < 44) return;
          els.push(el);
        });
      });
    }
    return els;
  }

  function lcSideHyDetachAll() {
    if (!(window.Hyalite && Hyalite.detach)) {
      lcSideHyAttached.clear();
      return;
    }
    lcSideHyAttached.forEach((el) => {
      try {
        Hyalite.detach(el);
      } catch (e) {
        /* 忽略 */
      }
      el.classList.remove("lc-side-glass");
      el.classList.remove("lc-glass-dark");
    });
    lcSideHyAttached.clear();
  }

  function lcSideHyAttach() {
    /* 纯磨砂档（默认）：只打标记类给 CSS 用，不挂 hyalite ——
       backdrop-filter: url() 在 Chromium 走软件光栅化，卡片常驻视口
       会持续占用并拖慢全页动效；blur() 走 GPU，开销低一个量级 */
    const refract = !!(settings.sidebar && settings.sidebar.refract);
    if (!refract) {
      if (lcSideHyAttached.size) lcSideHyDetachAll();
      lcSideGlassEls().forEach((el) => el.classList.add("lc-side-glass"));
      return;
    }
    if (!(window.Hyalite && Hyalite.supported && Hyalite.supported())) return;
    const g = (settings.sidebar && settings.sidebar.glass) || {};
    const num = (v, d) => (typeof v === "number" && !isNaN(v) ? v : d);
    const opts = {
      bevel: num(g.bevel, 22),
      thickness: num(g.thickness, 30),
      slope: num(g.slope, 2.6),
      shape: ["circle", "squircle", "lip"].includes(g.shape)
        ? g.shape
        : "squircle",
      blur: num(g.blur, 0.6),
      dispersion: num(g.dispersion, 1.4),
      shade: num(g.shade, 0.44),
      rim: num(g.rim, 1.7),
      edgeW: num(g.edgeW, 6),
      sat: num(g.sat, 0.9),
      light: num(g.light, -140),
    };
    lcSideGlassEls().forEach((el) => {
      /* 标记类先挂：CSS 里的玻璃规则以它为锚，attach 前挂上避免闪白 */
      el.classList.add("lc-side-glass");
      if (lcSideHyAttached.has(el)) return;
      try {
        Hyalite.attach(el, opts);
      } catch (e) {
        return;
      }
      lcSideHyAttached.add(el);
      if (!el.dataset.lcSideHyGuard) {
        el.dataset.lcSideHyGuard = "1";
        new MutationObserver(() => {
          if (!lcSideHyAttached.has(el)) return;
          if (!el.style.getPropertyValue("--hyalite")) {
            try {
              Hyalite.refresh(el);
            } catch (e) {
              /* 忽略 */
            }
          }
        }).observe(el, { attributes: true, attributeFilter: ["style"] });
      }
    });
    /* SPA 换掉的旧节点出集合，防无限膨胀 */
    lcSideHyAttached.forEach((el) => {
      if (!el.isConnected) lcSideHyAttached.delete(el);
    });
  }

  /* 材质：默认 auto = 采样卡片背后亮度。与导航栏一致的取值规则——
     暗色模式直接给深材质（此时背景多半是暗图/暗色，免采样抖动） */
  function lcUpdateSideMaterial() {
    const cfg = settings.sidebar || {};
    const mode = cfg.matMode || "auto";
    const threshold =
      typeof cfg.matThreshold === "number" ? cfg.matThreshold : 0.5;
    lcSideGlassEls().forEach((el) => {
      let dark;
      if (mode === "dark" || (mode === "auto" && isDarkMode())) dark = true;
      else if (mode === "light") dark = false;
      else {
        const L = lcNavLuma(el);
        dark =
          L === null ? el.classList.contains("lc-glass-dark") : L < threshold;
      }
      if (el.classList.contains("lc-glass-dark") !== dark)
        el.classList.toggle("lc-glass-dark", dark);
    });
  }

  /* ---- 信息流卡面自适应材质（背景暗 → 深膜白字）---- */
  /* 专用小画布：整图按 cover 铺满后按卡片视口矩形取样。
     与 lcNavLuma 的区别是「每批只画一次图」——信息流卡片多，
     逐卡 drawImage 全图太浪费；画布 64×64，getImageData 极廉价 */
  let lcFaceCv = null;
  let lcFaceCvKey = "";
  /* 背景图版本号：图被重建（换图/导航侧重建共享 Image）后画布缓存必须
     作废——旧 key 只含视口尺寸，换图后仍复用旧画布 → 采样亮度全错 */
  let lcFaceCvVer = 0;
  function lcFaceLuma(el) {
    const b = settings.background || {};
    if (b.mode === "color") {
      const rgb = lcHexToRgb(b.color);
      return rgb ? lcRelLuma(rgb) : 0.9;
    }
    if (b.mode === "gradient" && b.gradient) {
      const a = lcHexToRgb(b.gradient.from);
      const c = lcHexToRgb(b.gradient.to);
      if (a && c)
        return lcRelLuma([
          (a[0] + c[0]) / 2,
          (a[1] + c[1]) / 2,
          (a[2] + c[2]) / 2,
        ]);
    }
    if (!(b.mode === "image" && b.image && b.image.dataUrl)) return 0.9;
    if (lcLumaImgKey !== b.image.dataUrl || !lcLumaImg) {
      lcLumaImgKey = b.image.dataUrl;
      lcLumaImg = new Image();
      lcLumaImg.src = b.image.dataUrl;
      lcFaceCvVer++;
    }
    /* 图刚换/刚加载完成时画布还是旧的：挂一次性 load 钩子补采样
       （addEventListener 幂等，不与 lcNavLuma 的使用冲突） */
    if (!lcLumaImg.__lcFaceLoadHook) {
      lcLumaImg.__lcFaceLoadHook = true;
      lcLumaImg.addEventListener("load", () =>
        lcSafe(() => lcUpdateFaceMaterial(true)),
      );
    }
    if (!lcLumaImg.complete || !lcLumaImg.naturalWidth) return null;
    if (!lcFaceCv) {
      lcFaceCv = document.createElement("canvas");
      lcFaceCv.width = 64;
      lcFaceCv.height = 64;
    }
    const key = lcFaceCvVer + "@" + innerWidth + "x" + innerHeight;
    const ctx = lcFaceCv.getContext("2d", { willReadFrequently: true });
    if (lcFaceCvKey !== key) {
      const W = lcFaceCv.width,
        H = lcFaceCv.height;
      /* cover 可见区域裁切（图像自然像素坐标，与 CSS center/cover 同款）。
         旧实现把视口尺寸直接当 drawImage 源矩形：大图只采到左上角区域、
         sy 还会算出负值（顶部一条透明带），采样亮度系统性偏差 →
         卡片该变深膜的不变、不该变的乱变 */
      const nw = lcLumaImg.naturalWidth,
        nh = lcLumaImg.naturalHeight;
      const ir = nw / nh,
        vr = innerWidth / innerHeight;
      let cw, ch;
      if (ir > vr) {
        ch = nh;
        cw = nh * vr;
      } else {
        cw = nw;
        ch = nw / vr;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(
        lcLumaImg,
        (nw - cw) / 2,
        (nh - ch) / 2,
        cw,
        ch,
        0,
        0,
        W,
        H,
      );
      lcFaceCvKey = key;
    }
    const r = el.getBoundingClientRect();
    const sx = Math.max(0, Math.min(63, (r.left / innerWidth) * 64));
    const sy = Math.max(0, Math.min(63, (r.top / innerHeight) * 64));
    const sw = Math.max(1, Math.min(64 - sx, (r.width / innerWidth) * 64) | 0);
    const sh = Math.max(1, Math.min(64 - sy, (r.height / innerHeight) * 64) | 0);
    if (sw < 1 || sh < 1 || r.width < 10) return null;
    const d = ctx.getImageData(sx | 0, sy | 0, sw, sh).data;
    let sum = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue; /* 画布未被图片覆盖的区域（cover 铺不满时） */
      sum +=
        0.2126 * lcLin(d[i]) +
        0.7152 * lcLin(d[i + 1]) +
        0.0722 * lcLin(d[i + 2]);
      n++;
    }
    return n ? sum / n : null;
  }

  let lcFaceMatLast = 0;
  function lcFaceMatCleanup() {
    document
      .querySelectorAll(".lc-face-dark, .lc-face-ctl, .lc-pub-dark")
      .forEach((el) =>
        el.classList.remove("lc-face-dark", "lc-face-ctl", "lc-pub-dark"),
      );
  }
  /* 深膜卡内的「自带浅底控件」贴签：评论输入框/发布按钮这类站点白底
     控件，深膜白字会落在它们自带的白底上（白底白字）。按 computed
     background 实测亮度贴 .lc-face-ctl，CSS 侧统一切半透明深膜样式；
     透明底（无自绘背景）的控件不贴，跟随深膜白字即可 */
  function lcTagFaceControls(cnt, dark) {
    let els;
    try {
      els = cnt.querySelectorAll(
        'button, input, textarea, [contenteditable="true"], .w-bbtn, .bcmtipt, .editdiv, .m-cbtn',
      );
    } catch (e) {
      return;
    }
    const accent = settings.theme && settings.theme.accent;
    els.forEach((el) => {
      if (!dark) {
        if (el.classList.contains("lc-face-ctl"))
          el.classList.remove("lc-face-ctl");
        return;
      }
      /* 粘性：已贴签的元素不再重判。我们自己的换肤 CSS 会把已贴签
       * 元素的计算背景改成半透明膜（alpha 0.1 < 0.3 门槛）——重判必然
       * 得出「非浅底」撕签 → 白底回来 → 再判再贴……无限振荡（真机
       * 2026-09-24 实锤：看门上线后不输入也持续闪白）。而未贴签时
       * 计算背景就是站点真实背景，判定时机天然正确 */
      if (el.classList.contains("lc-face-ctl")) return;
      let light = false;
      try {
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg.match(
          /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/,
        );
        if (m) {
          const a = m[4] === undefined ? 1 : parseFloat(m[4]);
          if (a > 0.3) {
            const l =
              0.2126 * lcLin(+m[1]) +
              0.7152 * lcLin(+m[2]) +
              0.0722 * lcLin(+m[3]);
            light = l > 0.55;
          }
        }
      } catch (e) {}
      /* 主题色按钮（accent 彩底自带白字）不贴签：贴了会把彩底洗成半透明膜 */
      if (light && accent && el.closest && el.closest(".w-bbtn")) light = false;
      el.classList.toggle("lc-face-ctl", light);
    });
  }
  function lcUpdateFaceMaterial(force) {
    if (
      !settings.enabled ||
      isDarkMode() ||
      !(settings.card && settings.card.material && settings.card.faceAdapt)
    ) {
      lcFaceMatCleanup();
      return;
    }
    const now = Date.now();
    if (!force && now - lcFaceMatLast < 400) return;
    lcFaceMatLast = now;
    document.querySelectorAll("#main .m-mlist > .mlistcnt").forEach((cnt) => {
      /* 只处理画了卡面的卡片（按 computed ::before 识别） */
      const cs = getComputedStyle(cnt, "::before");
      if (cs.content === "none" || cs.backgroundColor === "rgba(0, 0, 0, 0)")
        return;
      const L = lcFaceLuma(cnt);
      if (L === null) return; /* 背景图未就绪：保持现状 */
      const darkFace = L < 0.45;
      cnt.classList.toggle("lc-face-dark", darkFace);
      /* 深膜卡内的浅底控件（评论输入框/发布按钮）同步贴签换肤 */
      lcTagFaceControls(cnt, darkFace);
    });
    /* 收起态发布栏搭同一班采样车：背后区域偏暗 → 贴 lc-pub-dark 深膜
       （同阈值；CSS 侧深膜 + 图标反相/悬停染色见 pubCss 段） */
    const pubArea = document.getElementById("publishBarArea");
    if (pubArea) {
      const L = lcFaceLuma(pubArea);
      if (L !== null) pubArea.classList.toggle("lc-pub-dark", L < 0.45);
    }
  }
  /* 背景是 fixed 铺法：滚动会改变卡片背后的区域，需要滚动驱动重采样 */
  if (!window.__lcFaceMatScroll) {
    window.__lcFaceMatScroll = true;
    window.addEventListener(
      "scroll",
      () => lcSafe(lcUpdateFaceMaterial),
      { passive: true },
    );
  }

  /* 控件贴签的专职看门：React 重渲染（输入框空↔非空切换，实测每击
   * 键都可能触发）会重建节点、洗掉 lc-face-ctl，且重渲染提交时机在
   * rAF/宏任务兜底之后——输入事件监听兜不住（真机 2026-09-24 实锤
   * 每击键闪白）。观察器在微任务时机感知「变更已提交」，rAF 节流到
   * 本帧 paint 前补挂，任何提交顺序都赶在绘制前。回调只做 rAF 排程，
   * 重活全在 rAF；classList.toggle 同值无 DOM 变更，不会自激 */
  if (!window.__lcFaceCtlWatch) {
    window.__lcFaceCtlWatch = true;
    let watchRaf = 0;
    const watchRetag = () => {
      watchRaf = 0;
      if (
        !settings.enabled ||
        isDarkMode() ||
        !(settings.card &&
          settings.card.material &&
          settings.card.faceAdapt)
      )
        return;
      document.querySelectorAll(".lc-face-dark").forEach((cnt) => {
        lcSafe(() => lcTagFaceControls(cnt, true));
      });
    };
    new MutationObserver(() => {
      if (watchRaf) return;
      watchRaf = requestAnimationFrame(watchRetag);
    }).observe(
      /* content script 在 document_start 注入时 body 尚未创建，
       * observe(body) 会抛 TypeError 并炸断整个主初始化链路（真机
       * 2026-09-24 实锤：页面空白、悬浮按钮消失）。html 根节点此时
       * 必已存在，body 出现后其变更同样落在根节点的观察范围内 */
      document.documentElement,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      },
    );
  }

  /* 快速看门：LOFTER 侧栏从「随流」切「粘滞跟随」时会重渲染卡片，
     React 把 className 重置 → lc-side-glass/--hyalite 被洗掉，
     防抖链补挂前的那段延迟就是「闪一下变回实底」。
     专职 observer 只盯 #rside 的 class/子树变动，rAF 节流（同一帧
     paint 前补回），现场即修；attach 幂等，重复触发无副作用 */
  let lcSideWatchObs = null;
  let lcSideWatchRaf = 0;
  function lcSideWatchStart() {
    /* 快速看门只盯 #rside：LOFTER 侧栏从「随流」切「粘滞」时 React 会
       重渲染卡片、把 className 重置洗掉 lc-side-glass/--hyalite */
    const root = document.getElementById("rside");
    if (!root || lcSideWatchObs) return;
    lcSideWatchObs = new MutationObserver(() => {
      if (lcSideWatchRaf) return;
      lcSideWatchRaf = requestAnimationFrame(() => {
        lcSideWatchRaf = 0;
        if (!lcSideGlassOn()) return;
        lcSafe(lcSideHyAttach);
        lcSafe(lcUpdateSideMaterial);
      });
    });
    lcSideWatchObs.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  function lcSideWatchStop() {
    if (lcSideWatchObs) {
      lcSideWatchObs.disconnect();
      lcSideWatchObs = null;
    }
    if (lcSideWatchRaf) {
      cancelAnimationFrame(lcSideWatchRaf);
      lcSideWatchRaf = 0;
    }
  }

  let lcSideGlassLastMat = 0;
  function applySidebarGlass() {
    if (!lcSideGlassOn()) {
      /* 关闭：收起玻璃与标记类，反色由 CSS 恢复（buildCSS 不再输出该块） */
      lcSideWatchStop();
      if (lcSideHyAttached.size) lcSideHyDetachAll();
      document
        .querySelectorAll(".lc-side-glass")
        .forEach((el) => el.classList.remove("lc-side-glass"));
      return;
    }
    lcSideHyAttach();
    lcSideWatchStart();
    /* 材质采样节流：400ms 一次足够跟上滚动/换图（与导航栏同频） */
    const now = Date.now();
    if (now - lcSideGlassLastMat >= 400) {
      lcSideGlassLastMat = now;
      lcSafe(lcUpdateSideMaterial);
    }
  }

  function applyNavbar() {
    if (navbarTimer) {
      clearInterval(navbarTimer);
      navbarTimer = null;
    }

    let bar = document.getElementById("lofter-top-bar");
    const hyOn =
      settings.enabled &&
      settings.navbar.hyalite &&
      window.Hyalite &&
      Hyalite.supported &&
      Hyalite.supported();

    /* 关闭时：清掉我们写的 style，让 Lofter 自己的 JS 恢复黑色 */
    if (
      !settings.enabled ||
      (!settings.navbar.blur && !settings.navbar.hyalite)
    ) {
      lcHyDetachAll();
      if (bar) {
        bar.style.removeProperty("background");
        bar.style.removeProperty("background-image");
        bar.style.removeProperty("backdrop-filter");
        bar.style.removeProperty("-webkit-backdrop-filter");
        bar.style.removeProperty("border-radius");
        bar.querySelectorAll("*").forEach((el) => {
          el.style.removeProperty("background");
          el.style.removeProperty("background-color");
        });
      }
      return;
    }

    function setNavStyle() {
      /* ---- hyalite 模式：外观交给 buildCSS 的 var(--hyalite) 规则，
         这里只做结构保证（置顶/子层透明）、attach 与材质采样 ---- */
      if (hyOn) {
        if (bar) {
          bar.style.setProperty("position", "fixed", "important");
          bar.style.setProperty("top", "0", "important");
          bar.style.setProperty("left", "0", "important");
          bar.style.setProperty("width", "100%", "important");
          bar.style.setProperty("z-index", "9999", "important");
          /* 内联背景/模糊会污染玻璃外观，确保清干净。
             必须连 background 一起清：毛玻璃档在本元素写过内联
             `background: rgba(255,255,255,0.35) !important`，
             内联 important 会压过样式表里的白膜/深膜规则（含 .lc-glass-dark），
             表现为「从毛玻璃切到液态玻璃后仍是浅色白膜、材质自适应失效」。 */
          bar.style.removeProperty("background");
          bar.style.removeProperty("background-image");
          bar.style.removeProperty("backdrop-filter");
          bar.style.removeProperty("-webkit-backdrop-filter");
          bar.style.removeProperty("border-bottom");
          bar.style.removeProperty("border-radius");
          bar.querySelectorAll("*").forEach((el) => {
            if (getComputedStyle(el).backgroundColor === "rgb(31, 31, 31)") {
              el.style.setProperty("background", "transparent", "important");
              el.style.setProperty(
                "background-color",
                "transparent",
                "important",
              );
            }
          });
        }
        lcHyAttachNav();
        /* 材质采样节流：400ms 一次足够跟上滚动/换图 */
        const now = Date.now();
        if (!setNavStyle._lastMat || now - setNavStyle._lastMat >= 400) {
          setNavStyle._lastMat = now;
          lcSafe(lcUpdateNavMaterial);
        }
        return;
      }
      /* 从 hyalite 切回普通模式：收掉玻璃与材质类 */
      if (lcHyAttached.size) lcHyDetachAll();

      bar = bar || document.getElementById("lofter-top-bar");
      if (!bar) return;

      /* 结果签名：状态与导航结构都没变时直接跳过，
         避免每 200ms 的 querySelectorAll("*") + getComputedStyle 全量扫描 */
      const navKey = [
        isDarkMode(),
        settings.navbar.blur,
        bar.childElementCount,
      ].join("|");
      if (navKey === setNavStyle._lastKey) return;
      setNavStyle._lastKey = navKey;

      /* 强制置顶（所有模式都需要） */
      bar.style.setProperty("position", "fixed", "important");
      bar.style.setProperty("top", "0", "important");
      bar.style.setProperty("left", "0", "important");
      bar.style.setProperty("width", "100%", "important");
      bar.style.setProperty("z-index", "9999", "important");

      if (isDarkMode()) {
        /* ===== 深色模式：暗色半透明底 ===== */
        bar.style.setProperty(
          "background",
          "rgba(25, 25, 30, 0.72)",
          "important",
        );
        bar.style.setProperty("background-image", "none", "important");
        bar.style.setProperty(
          "border-bottom",
          "1px solid rgba(255,255,255,0.06)",
          "important",
        );

        /* 毛玻璃（低透档；hyalite 不可用时也走到这里做兜底） */
        bar.style.setProperty(
          "backdrop-filter",
          "blur(16px) saturate(120%)",
          "important",
        );
        bar.style.setProperty(
          "-webkit-backdrop-filter",
          "blur(16px) saturate(120%)",
          "important",
        );

        /* 清除 Lofter 默认黑色背景子元素 */
        bar.querySelectorAll("*").forEach((el) => {
          if (getComputedStyle(el).backgroundColor === "rgb(31, 31, 31)") {
            el.style.setProperty("background", "transparent", "important");
            el.style.setProperty(
              "background-color",
              "transparent",
              "important",
            );
          }
        });
      } else {
        /* ===== 浅色模式：毛玻璃（低透档，唯一非 hyalite 档）===== */
        bar.style.setProperty(
          "background",
          "rgba(255,255,255,0.35)",
          "important",
        );
        bar.style.setProperty("background-image", "none", "important");
        bar.style.setProperty("backdrop-filter", "blur(16px)", "important");
        bar.style.setProperty(
          "-webkit-backdrop-filter",
          "blur(16px)",
          "important",
        );
        /* 清除 Lofter 默认黑色背景子元素 */
        bar.querySelectorAll("*").forEach((el) => {
          if (getComputedStyle(el).backgroundColor === "rgb(31, 31, 31)") {
            el.style.setProperty("background", "transparent", "important");
            el.style.setProperty(
              "background-color",
              "transparent",
              "important",
            );
          }
        });
      }
    }

    setNavStyle();
    navbarTimer = setInterval(setNavStyle, 200);
  }

  function startObserver() {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /* ---------- 加载配置 ---------- */
  function load() {
    chrome.storage.local.get(LC_STORAGE_KEY, (res) => {
      /* LC_migrateNav：老配置的 navbar.transparent 迁移为 blur（本批两档化） */
      window.settings = LC_migrateNav(
        LC_merge(LC_DEFAULTS, res[LC_STORAGE_KEY] || {}),
      );
      // 同步全局隐藏标志
      window.decorationsGloballyHidden =
        window.settings.decorationsVisible === false;
      invalidateCSS();
      applyAll();
    });
  }

  chrome.storage.onChanged.addListener((c, area) => {
    if (area === "local" && c[LC_STORAGE_KEY]) {
      const newSettings = c[LC_STORAGE_KEY].newValue || {};
      window.settings = LC_migrateNav(LC_merge(LC_DEFAULTS, newSettings));
      // 同步全局隐藏标志
      window.decorationsGloballyHidden =
        window.settings.decorationsVisible === false;
      invalidateCSS();
      applyAll();
    }
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (settings.darkMode.auto) {
        /* auto 模式下系统主题切换会改变 isDarkMode() 相关 CSS 分支，
           需使缓存失效并主动重建（此前依赖 DOM 变动隐式刷新） */
        invalidateCSS();
        applyStyle();
        applyDarkOverlay();
      }
    });

  /* ---------- 控制台调试桥 ----------
   * content script 跑在隔离世界：页面控制台直接读 settings 会报
   * ReferenceError（2026-09-21 实测 VM302）。约定：控制台 dispatch
   * 'lc-probe' 事件 → 这里把状态快照写进 <html data-lc-probe> →
   * 控制台 JSON.parse 读回。DOM 事件跨世界可达，常驻开销可忽略。 */
  document.documentElement.addEventListener("lc-probe", () => {
    try {
      const els = {};
      [
        "lc-style",
        "lc-dark-cards",
        "lc-dark-overlay",
        "lc-filter-style",
        "lc-filter-counter",
        "lc-cmt-filter-style",
      ].forEach((id) => {
        const e = document.getElementById(id);
        els[id] = e ? "有 len=" + e.textContent.length : "无";
      });
      const main = document.getElementById("main");
      const f = settings.filter || {};
      document.documentElement.dataset.lcProbe = JSON.stringify({
        t: Date.now(),
        enabled: settings.enabled,
        darkMode: settings.darkMode,
        filter: {
          enabled: !!f.enabled,
          scope: f.scope || null,
          keywords: (f.keywords || []).length,
          users: (f.users || []).length,
        },
        /* 评论区过滤诊断：ran=模块是否跑起来；cmti/bodies=DOM 命中数；
         * links=解析出 lofter 用户 id 的链接数；matched=命中黑名单的
         * id；items/marked=实际隐藏的条目数。对照即可判断是
         * 选择器没命中、id 没匹配上，还是标记被 React 洗掉 */
        cmt: cmtDiag,
        els,
        mainFilter: main ? getComputedStyle(main).filter : "(无#main)",
      });
    } catch (e) {
      document.documentElement.dataset.lcProbe = JSON.stringify({
        err: String(e),
      });
    }
  });

  /* ---------- 清除注入的标题 ---------- */
  function removeTitles() {
    document.querySelectorAll(".lc-post-title").forEach((el) => el.remove());
    document.querySelectorAll("[data-lc-title]").forEach((el) => {
      el.removeAttribute("data-lc-title");
    });
  }

  async function injectPostTitles() {
    if (!settings.enabled || !settings.tidy.injectTitles) {
      removeTitles();
      return;
    }

    // 安全检查：只允许向 lofter.com 发送请求
    const isLofterUrl = (url) => {
      try {
        return new URL(url).hostname.endsWith("lofter.com");
      } catch {
        return false;
      }
    };

    // 只处理图片和视频类型、且还没有注入过的
    const blocks = document.querySelectorAll(
      ".postwrapper .block.photo:not([data-lc-title])," +
        ".postwrapper .block.video:not([data-lc-title])",
    );
    if (!blocks.length) return;

    // 限流：最多同时3个请求
    const queue = Array.from(blocks);
    async function processOne(block) {
      const link = block.querySelector(".side .day a");
      if (!link) {
        block.dataset.lcTitle = "skip";
        return;
      }

      // 安全检查：不请求非 Lofter 域名
      if (!isLofterUrl(link.href)) {
        block.dataset.lcTitle = "skip";
        return;
      }

      block.dataset.lcTitle = "loading";
      // 最多只处理前 10 个，避免请求过多
      if (queue.length > 10) queue.length = 10;

      try {
        const res = await fetch(link.href);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // <title> 格式："博文标题 - BlogName - LOFTER"
        const raw = doc.title || "";
        const title = raw.substring(0, raw.lastIndexOf("-")).trim();

        if (title && title.length > 0) {
          const el = document.createElement("a");
          el.className = "lc-post-title";
          el.textContent = title;
          el.href = link.href;
          const main = block.querySelector(".main");
          if (main) main.insertBefore(el, main.firstChild);
        }
        block.dataset.lcTitle = "done";
      } catch (e) {
        block.dataset.lcTitle = "error";
      }
    }

    // 逐个发，每次间隔300ms，避免触发rate limit
    for (const block of queue) {
      await processOne(block);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  /* ---------- 启动 ---------- */
  function boot() {
    load();
    startObserver();
    startPortalPolling();
    startSwitchPolling();
    startDialogStyleObserver();
    bindGlobalDecListener();

    // 长文章编辑器：延迟检查 iframe（它加载比较慢）
    if (document.body?.id === "longpost-publish-page") {
      setTimeout(() => {
        applyLongpostEditorDark();
        applyWordCounter();
        // 每隔 2 秒再检查一次，持续 30 秒（编辑器可能反复重建）
        let count = 0;
        const iv = setInterval(() => {
          applyLongpostEditorDark();
          applyWordCounter();
          if (++count > 15) clearInterval(iv);
        }, 2000);
      }, 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  /* ---------- 全局点击弹性效果 ---------- */
  let bounceAttached = false;
  function applyClickBounce() {
    if (bounceAttached) return;
    bounceAttached = true;

    document.addEventListener(
      "mousedown",
      (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const el = target.closest("a, button, [onclick]");
        if (!el) return;

        const inNavbar = !!el.closest("#lofter-top-bar");
        if (inNavbar) {
          el.style.setProperty(
            "transition",
            "box-shadow 0.1s ease",
            "important",
          );
          el.style.setProperty("transition", "opacity 0.1s ease", "important");
          el.style.setProperty("opacity", "0.6", "important");
          const reset = () => {
            el.style.removeProperty("opacity");
            setTimeout(() => el.style.removeProperty("transition"), 150);
            document.removeEventListener("mouseup", reset, true);
          };
          document.addEventListener("mouseup", reset, true);
          return;
        }

        el.style.setProperty(
          "transition",
          "transform 0.1s cubic-bezier(0.4,0,0.2,1)",
          "important",
        );
        el.style.setProperty("transform", "scale(0.94)", "important");
        const reset = () => {
          el.style.removeProperty("transform");
          setTimeout(() => el.style.removeProperty("transition"), 150);
          document.removeEventListener("mouseup", reset, true);
        };
        document.addEventListener("mouseup", reset, true);
      },
      true,
    );
  }
  /* ============================================================
   * 装饰图互动效果
   * ============================================================ */
  // 预加载的自定义音频缓存
  const customAudioCache = new Map();
  /* ---------- 音效生成（Web Audio API） ---------- */
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // 通用音效合成函数
  function tone(ctx, { type = "sine", freq = [], gain = [], dur }) {
    const osc = ctx.createOscillator();
    const gn = ctx.createGain();
    const t = ctx.currentTime;

    osc.type = type;

    freq.forEach(([time, val, isRamp]) => {
      if (isRamp) {
        osc.frequency.exponentialRampToValueAtTime(val, t + time);
      } else {
        osc.frequency.setValueAtTime(val, t + time);
      }
    });

    gain.forEach(([time, val, isRamp]) => {
      if (isRamp) {
        gn.gain.exponentialRampToValueAtTime(val, t + time);
      } else {
        gn.gain.setValueAtTime(val, t + time);
      }
    });

    osc.connect(gn).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function playPopSound(preset, customDataUrl) {
    try {
      if (customDataUrl) {
        let audio = customAudioCache.get(customDataUrl);
        if (!audio) {
          audio = new Audio(customDataUrl);
          customAudioCache.set(customDataUrl, audio);
        }
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }

      const ctx = getAudioCtx();
      /* 兜底：AudioContext 被浏览器自动挂起时尝试恢复，避免音效无声/延迟 */
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t = ctx.currentTime;

      switch (preset) {
        case "ding": {
          tone(ctx, {
            type: "sine",
            freq: [
              [0, 1200],
              [0.05, 1800, 1],
            ],
            gain: [
              [0, 0.25],
              [0.3, 0.01, 1],
            ],
            dur: 0.3,
          });
          break;
        }
        case "dong": {
          tone(ctx, {
            type: "sine",
            freq: [
              [0, 200],
              [0.3, 80, 1],
            ],
            gain: [
              [0, 0.4],
              [0.4, 0.01, 1],
            ],
            dur: 0.4,
          });
          break;
        }
        case "wobble": {
          const osc = ctx.createOscillator();
          const gn = ctx.createGain();
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.value = 230;
          lfo.frequency.value = 9;
          lg.gain.value = 60;

          lfo.connect(lg).connect(osc.frequency);
          gn.gain.setValueAtTime(0.001, t);
          gn.gain.exponentialRampToValueAtTime(0.32, t + 0.04);
          gn.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

          osc.connect(gn).connect(ctx.destination);
          osc.start(t);
          lfo.start(t);
          osc.stop(t + 0.58);
          lfo.stop(t + 0.58);
          break;
        }
        case "swoosh": {
          tone(ctx, {
            type: "sine",
            freq: [
              [0, 250],
              [0.12, 900, 1],
              [0.25, 600, 1],
            ],
            gain: [
              [0, 0.001],
              [0.02, 0.35, 1],
              [0.28, 0.001, 1],
            ],
            dur: 0.3,
          });
          break;
        }
        case "boing": {
          tone(ctx, {
            freq: [
              [0, 500],
              [0.05, 900, 1],
              [0.15, 450, 1],
            ],
            gain: [
              [0, 0.001],
              [0.02, 0.4, 1],
              [0.16, 0.001, 1],
            ],
            dur: 0.18,
          });
          setTimeout(() => {
            tone(ctx, {
              freq: [
                [0, 650],
                [0.04, 1050, 1],
                [0.14, 500, 1],
              ],
              gain: [
                [0, 0.001],
                [0.02, 0.28, 1],
                [0.15, 0.001, 1],
              ],
              dur: 0.17,
            });
          }, 150);
          break;
        }
        case "beep": {
          tone(ctx, {
            type: "square",
            freq: [
              [0, 1400],
              [0.05, 1750, 1],
              [0.1, 1300, 1],
            ],
            gain: [
              [0, 0.001],
              [0.01, 0.12, 1],
              [0.12, 0.001, 1],
            ],
            dur: 0.13,
          });
          setTimeout(() => {
            tone(ctx, {
              type: "square",
              freq: [
                [0, 1100],
                [0.06, 850, 1],
              ],
              gain: [
                [0, 0.001],
                [0.01, 0.1, 1],
                [0.1, 0.001, 1],
              ],
              dur: 0.11,
            });
          }, 120);
          break;
        }
        case "stretch": {
          tone(ctx, {
            type: "triangle",
            freq: [
              [0, 320],
              [0.35, 110, 1],
            ],
            gain: [
              [0, 0.001],
              [0.04, 0.3, 1],
              [0.38, 0.001, 1],
            ],
            dur: 0.4,
          });
          setTimeout(() => {
            tone(ctx, {
              type: "sine",
              freq: [
                [0, 180],
                [0.08, 420, 1],
                [0.2, 240, 1],
              ],
              gain: [
                [0, 0.001],
                [0.02, 0.35, 1],
                [0.22, 0.001, 1],
              ],
              dur: 0.24,
            });
          }, 370);
          break;
        }
        case "bubbles": {
          [0, 90, 190, 300].forEach((d) => {
            setTimeout(() => {
              const base = 300 + Math.random() * 250;
              tone(ctx, {
                freq: [
                  [0, base],
                  [0.06, base * 2.2, 1],
                ],
                gain: [
                  [0, 0.001],
                  [0.01, 0.25, 1],
                  [0.08, 0.001, 1],
                ],
                dur: 0.09,
              });
            }, d);
          });
          break;
        }
        case "pop":
        default: {
          tone(ctx, {
            freq: [
              [0, 600],
              [0.1, 300, 1],
            ],
            gain: [
              [0, 0.3],
              [0.1, 0.01, 1],
            ],
            dur: 0.1,
          });
          break;
        }
      }
    } catch (e) {}
  }
  window.playPopSound = playPopSound;

  /* ---------- Emoji 粒子效果 ---------- */
  function spawnEmojiParticles(img, emojis, clickX, clickY) {
    if (!emojis || emojis.length === 0) return;

    const rect = img.getBoundingClientRect();
    // 如果有传入点击坐标，从点击位置发射；否则回退到图片中心
    const originX =
      typeof clickX === "number" ? clickX : rect.left + rect.width / 2;
    const originY =
      typeof clickY === "number" ? clickY : rect.top + rect.height / 2;

    // 生成 3~5 个粒子
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      particle.textContent = emoji;
      particle.style.cssText = `
      position: fixed;
      left: ${originX}px;
      top: ${originY}px;
        font-size: ${16 + Math.random() * 12}px;
        pointer-events: none;
        z-index: 999999;
        user-select: none;
        opacity: 1;
        transform: translate(-50%, -50%) scale(0.5);
        transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      `;
      document.body.appendChild(particle);

      // 随机方向飘散
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 40 + Math.random() * 60;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 30; // 稍微向上飘

      requestAnimationFrame(() => {
        particle.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.2) rotate(${Math.random() * 30 - 15}deg)`;
        particle.style.opacity = "0";
      });

      // 动画结束后移除
      setTimeout(() => particle.remove(), 800);
    }
  }
  window.spawnEmojiParticles = spawnEmojiParticles;

  // 气泡管理：按装饰图 ID 记录当前存在的气泡
  const dialogueBubbles = new Map();

  function spawnDialogueBubble(img, dialogues, clickX, clickY) {
    if (!dialogues || dialogues.length === 0) return;

    const decId = img.dataset.decId;
    const dec = (window.settings.decorations || []).find((d) => d.id === decId);
    const ia = dec?.interactive || {};

    const duration =
      typeof ia.dialogueDuration === "number" &&
      ia.dialogueDuration >= 1 &&
      ia.dialogueDuration <= 10
        ? ia.dialogueDuration
        : 3;
    const maxStack =
      typeof ia.dialogueStack === "number" &&
      ia.dialogueStack >= 1 &&
      ia.dialogueStack <= 5
        ? ia.dialogueStack
        : 1;

    // 获取或初始化该装饰图的气泡数组
    if (!dialogueBubbles.has(decId)) {
      dialogueBubbles.set(decId, []);
    }
    const bubbles = dialogueBubbles.get(decId);

    // 如果超过堆叠上限，移除最早的
    while (bubbles.length >= maxStack) {
      const old = bubbles.shift();
      if (old && old.parentNode) {
        old.style.opacity = "0";
        old.style.transform = old.dataset.transform + " scale(0.85)";
        setTimeout(() => old.remove(), 350);
      }
    }

    const rect = img.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const text = dialogues[Math.floor(Math.random() * dialogues.length)];

    const dx = clickX - centerX;
    const dy = clickY - centerY;
    let direction =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "bottom"
          : "top";

    const gap = 10;
    let bubbleLeft, bubbleTop, transform, arrowStyle;

    const isDark = typeof isDarkMode === "function" ? isDarkMode() : false;
    const colors = isDark
      ? {
          bg: "#2d2d32",
          text: "#e5e5e5",
          shadow: "rgba(0,0,0,0.4)",
          arrow: "#2d2d32",
        }
      : {
          bg: "#ffffff",
          text: "#555",
          shadow: "rgba(0,0,0,0.12)",
          arrow: "#ffffff",
        };

    switch (direction) {
      case "top":
        bubbleLeft = clickX;
        bubbleTop = clickY - gap;
        transform = "translate(-50%, -100%)";
        arrowStyle = `position:absolute;left:50%;bottom:-5px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid ${colors.arrow};`;
        break;
      case "bottom":
        bubbleLeft = clickX;
        bubbleTop = clickY + gap;
        transform = "translate(-50%, 0)";
        arrowStyle = `position:absolute;left:50%;top:-5px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:5px solid ${colors.arrow};`;
        break;
      case "left":
        bubbleLeft = clickX - gap;
        bubbleTop = clickY;
        transform = "translate(-100%, -50%)";
        arrowStyle = `position:absolute;right:-5px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:5px solid ${colors.arrow};`;
        break;
      case "right":
        bubbleLeft = clickX + gap;
        bubbleTop = clickY;
        transform = "translate(0, -50%)";
        arrowStyle = `position:absolute;left:-5px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:5px solid ${colors.arrow};`;
        break;
    }

    // 堆叠时加微小随机偏移，防重叠
    if (maxStack > 1) {
      bubbleLeft += (Math.random() - 0.5) * 30;
      bubbleTop += (Math.random() - 0.5) * 20;
    }

    const bubble = document.createElement("div");
    bubble.dataset.lcDialogue = decId;
    bubble.dataset.transform = transform;

    bubble.style.cssText = `
    position: fixed;
    left: ${bubbleLeft}px;
    top: ${bubbleTop}px;
    transform: ${transform};
    background: ${colors.bg} !important;
    color: ${colors.text};
    padding: 10px 16px;
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.5;
    max-width: 200px;
    text-align: center;
    pointer-events: none;
    z-index: 999999;
    opacity: 0;
    box-shadow: 0 4px 16px ${colors.shadow};
    word-break: break-word;
    user-select: none;
  `;
    bubble.textContent = text;

    const arrow = document.createElement("div");
    arrow.style.cssText = arrowStyle;
    bubble.appendChild(arrow);

    document.body.appendChild(bubble);
    bubbles.push(bubble);

    // 边界修正
    const bRect = bubble.getBoundingClientRect();
    const pad = 10;

    if (direction === "top" || direction === "bottom") {
      const halfW = bRect.width / 2;
      if (bubbleLeft - halfW < pad) bubbleLeft = pad + halfW;
      if (bubbleLeft + halfW > window.innerWidth - pad)
        bubbleLeft = window.innerWidth - pad - halfW;
      if (direction === "top") {
        if (bubbleTop - bRect.height < pad) bubbleTop = pad + bRect.height;
      } else {
        if (bubbleTop + bRect.height > window.innerHeight - pad)
          bubbleTop = window.innerHeight - pad - bRect.height;
      }
    } else {
      const halfH = bRect.height / 2;
      if (bubbleTop - halfH < pad) bubbleTop = pad + halfH;
      if (bubbleTop + halfH > window.innerHeight - pad)
        bubbleTop = window.innerHeight - pad - halfH;
      if (direction === "left") {
        if (bubbleLeft - bRect.width < pad) bubbleLeft = pad + bRect.width;
      } else {
        if (bubbleLeft + bRect.width > window.innerWidth - pad)
          bubbleLeft = window.innerWidth - pad - bRect.width;
      }
    }

    bubble.style.left = bubbleLeft + "px";
    bubble.style.top = bubbleTop + "px";
    bubble.style.transition = "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)";

    requestAnimationFrame(() => {
      bubble.style.opacity = "1";
      bubble.style.transform = `${transform} scale(1)`;
    });

    // 独立计时消失
    setTimeout(() => {
      bubble.style.opacity = "0";
      bubble.style.transform = `${transform} scale(0.85)`;
      setTimeout(() => {
        if (bubble.parentNode) bubble.remove();
        // 从数组中移除
        const arr = dialogueBubbles.get(decId);
        if (arr) {
          const i = arr.indexOf(bubble);
          if (i > -1) arr.splice(i, 1);
        }
      }, 350);
    }, duration * 1000);
  }
  window.spawnDialogueBubble = spawnDialogueBubble;

  /* ---------- 挤压形变动画 ---------- */
  function applySqueezeEffect(img) {
    const decId = img.dataset.decId;

    // 先彻底停止呼吸动画
    img.classList.remove("lc-dec-breathe", "lc-dec-breathe-squish");
    void img.offsetHeight;

    // 读取当前配置（挤压阶段）
    const dec = (window.settings.decorations || []).find((d) => d.id === decId);
    const ia = dec?.interactive || {};

    // 挤压强度：0~50，默认15。越大压得越扁。
    const strength =
      typeof ia.squeezeStrength === "number" &&
      ia.squeezeStrength >= 0 &&
      ia.squeezeStrength <= 50
        ? ia.squeezeStrength
        : 15;

    // 底部不动压扁：纵向压缩，横向轻微膨胀（像果冻/史莱姆）
    const scaleY = 1 - strength / 100;
    const scaleX = 1 + (strength / 100) * 0.5;

    // 关键：计算底部补偿偏移量
    // scaleY 压缩后，元素中心会向上偏移 (原始高 - 压缩后高)/2
    // 我们要把整个元素向下推同样的距离，让底部回到原位
    const rect = img.getBoundingClientRect();
    const offsetY = (rect.height * (1 - scaleY)) / 2;

    // 回弹风格：时间和曲线都不同，让差异更明显
    const bounceMap = {
      soft: { curve: "cubic-bezier(0.25, 0.1, 0.25, 1)", duration: 0.6 }, // 慢吞吞，像棉花糖
      elastic: { curve: "cubic-bezier(0.34, 1.6, 0.64, 1)", duration: 0.45 }, // 会晃，像果冻
      crisp: { curve: "cubic-bezier(0.4, 0, 0.2, 1)", duration: 0.2 }, // 快闪回，像按键
    };
    const bounce = bounceMap[ia.bounceStyle] || bounceMap.elastic;

    // 令牌：连续快速点击时让旧动画的回调全部失效
    const token = (img._lcSqueezeToken = (img._lcSqueezeToken || 0) + 1);

    // 下压：快速且干脆（所有风格下压阶段都一样）
    img.style.transition = "transform 0.1s cubic-bezier(0.4, 0, 0.2, 1)";
    img.style.transform = `translate(-50%, calc(-50% + ${offsetY}px)) scale(${scaleX}, ${scaleY})`;

    // 恢复呼吸动画（重新读取最新配置，避免闭包过时）
    const restoreBreathe = () => {
      img.style.transition = "";
      img.style.transform = "translate(-50%, -50%)";
      void img.offsetHeight;

      const currentDec = (window.settings.decorations || []).find(
        (d) => d.id === decId,
      );
      const currentIa = currentDec?.interactive || {};

      if (currentIa.enabled && currentIa.breathe !== false) {
        const breatheMode = currentIa.breatheMode || "float";
        img.classList.add(
          breatheMode === "squish"
            ? "lc-dec-breathe-squish"
            : "lc-dec-breathe",
        );
      }
    };

    // 回弹：用 transitionend 驱动（比嵌套 setTimeout 更精准，不受定时器排队延迟影响）
    const startBounce = () => {
      if (img._lcSqueezeToken !== token) return;
      img.removeEventListener("transitionend", startBounce);
      img.style.transition = `transform ${bounce.duration}s ${bounce.curve}`;
      img.style.transform = `translate(-50%, -50%) scale(1)`;

      let bounceDone = false;
      const onBounceEnd = (e) => {
        if (
          e.propertyName !== "transform" ||
          img._lcSqueezeToken !== token ||
          bounceDone
        )
          return;
        bounceDone = true;
        img.removeEventListener("transitionend", onBounceEnd);
        restoreBreathe();
      };
      img.addEventListener("transitionend", onBounceEnd);
      // 兜底：transition 未触发（元素被隐藏等）时也能恢复
      setTimeout(() => {
        if (img._lcSqueezeToken === token && !bounceDone) restoreBreathe();
      }, bounce.duration * 1000 + 150);
    };
    img.addEventListener("transitionend", startBounce);
    // 兜底：transitionend 未触发时仍能进入回弹
    setTimeout(() => {
      if (img._lcSqueezeToken === token) startBounce();
    }, 250);
  }
  window.applySqueezeEffect = applySqueezeEffect;

  /* ---------- 注入互动效果 CSS ---------- */
  function injectInteractiveCSS() {
    if (document.getElementById("lc-dec-interactive-style")) return;
    const style = document.createElement("style");
    style.id = "lc-dec-interactive-style";
    style.textContent = `
      @keyframes lcDecBreatheFloat {
        0%, 100% { transform: translate(-50%, -50%); }
        50% { transform: translate(-50%, calc(-50% + var(--lc-breathe-offset, -8px))); }
      }
      @keyframes lcDecBreatheSquish {
        0%, 100% { transform: translate(-50%, -50%) scale(1, 1); }
        50% { transform: translate(-50%, -50%) scale(1, var(--lc-breathe-scale, 0.96)); }
      }
      .lc-dec-breathe {
        animation: lcDecBreatheFloat var(--lc-breathe-duration, 3.5s) ease-in-out infinite;
      }
      .lc-dec-breathe-squish {
        animation: lcDecBreatheSquish var(--lc-breathe-duration, 3.5s) ease-in-out infinite;
        transform-origin: bottom center;
      }
      /* 点击时暂停呼吸，让挤压动画优先 */
      .lc-dec-breathe:active,
      .lc-dec-breathe-squish:active {
        animation-play-state: paused;
      }
      /* 装饰图显示/隐藏过渡 */
      .lc-decorations-container {
        transition: opacity 0.3s ease;
      }
      .lc-decorations-container.hidden {
        opacity: 0;
        pointer-events: none;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------- 接收 popup 消息 ---------- */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "editDecoration") {
      toggleDecEditMode(true);
      sendResponse({ ok: true });
      return true;
    }
    if (msg.action === "exitDecEditMode") {
      toggleDecEditMode(false);
      sendResponse({ ok: true });
      return true;
    }
    if (msg.action === "checkDecEditMode") {
      sendResponse({ editing: decEditMode });
      return true;
    }
    if (msg.action === "toggleDecorationsVisibility") {
      const containers = document.querySelectorAll(".lc-decorations-container");
      containers.forEach((container) => {
        if (msg.visible) {
          container.classList.remove("hidden");
        } else {
          container.classList.add("hidden");
        }
      });
      window.decorationsGloballyHidden = !msg.visible;
      sendResponse({ ok: true });
      return true;
    }
    if (msg.action === "shortcutToggleDecorations") {
      const containers = document.querySelectorAll(".lc-decorations-container");
      const isHidden =
        containers.length > 0 && containers[0].style.opacity === "0";

      window.decorationsGloballyHidden = !isHidden;

      containers.forEach((container) => {
        container.style.opacity = isHidden ? "1" : "0";
      });

      if (window.settings) {
        window.settings.decorationsVisible = isHidden;
        chrome.storage.local.set({ lc_settings_v1: window.settings });
      }

      sendResponse({ ok: true, visible: isHidden });
      return true;
    }
    if (msg.action === "shortcutToggleEditMode") {
      // 如果全局隐藏，不响应编辑模式切换
      if (window.decorationsGloballyHidden) {
        sendResponse({ ok: false, reason: "globally-hidden" });
        return true;
      }
      const isEditing = document.querySelector(".lc-dec-edit-mode") !== null;
      toggleDecEditMode(!isEditing);
      sendResponse({ ok: true, editing: !isEditing });
      return true;
    }

    if (msg.action === "shortcutToggleDarkMode") {
      // 深色模式切换逻辑
      // settings.darkMode 是对象：{ mode: 'off'|'manual'|'auto', brightness: 90 }
      const currentMode = settings.darkMode?.mode || "off";
      let newMode;

      if (currentMode === "off") {
        newMode = "manual"; // 关闭 → 手动开启
      } else if (currentMode === "manual") {
        newMode = "off"; // 手动开启 → 关闭
      } else {
        // auto（跟随系统）→ 手动开启
        newMode = "manual";
      }

      settings.darkMode.mode = newMode;
      chrome.storage.local.set({ lc_settings_v1: settings }, () => {
        applyAll(); // 重新应用所有样式
      });
      sendResponse({ ok: true, mode: newMode });
      return true;
    }
    if (window.decorationsGloballyHidden) {
      return;
    }
  });

  /* ---------- DWR 中继（popup 直连 LOFTER DWR 会拿空响应） ----------
   * popup 发来 {type:"lc-dwr", method, params}，这里同源代为执行。
   * 只在顶层页面响应：lofter 顶层是 www.lofter.com，与 DWR 接口同源；
   * 子域 iframe 向 www.lofter.com 属跨域（MV3 content script 无 CORS
   * 豁免），且多 frame 同时响应会互相抢 sendResponse。 */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "lc-dwr") return;
    if (window.top !== window) return;
    if (typeof LC_dwrCall !== "function") {
      sendResponse({ ok: false, error: "lc-dwr.js 未加载" });
      return true;
    }
    LC_dwrCall(msg.method, msg.params, { scriptName: msg.scriptName, base: msg.base })
      .then((data) =>
        sendResponse({
          ok: true,
          data: data,
          raw: String(LC_dwrCall.lastRaw || ""),
        }),
      )
      .catch((e) =>
        sendResponse({ ok: false, error: (e && e.message) || String(e) }),
      );
    return true; /* 异步 sendResponse */
  });
})();

/* ---------- 全局装饰图点击安检门（捕获阶段） ---------- */
let globalDecListenerBound = false;

function bindGlobalDecListener() {
  if (globalDecListenerBound) return;
  globalDecListenerBound = true;

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (typeof decEditMode !== "undefined" && decEditMode) {
        return;
      }
      /* 点击来自插件自身（悬浮按钮/面板）：Shadow DOM 只隔离样式不隔离
       * 冒泡到 document 的事件，事件重定向后 e.target 就是 FAB host 本身。
       * 按钮压在装饰图上方时，若不拦截，按坐标判定会误触发装饰图互动。 */
      if (e.target && e.target.id === "lc-fab-host") {
        return;
      }
      if (window.decorationsGloballyHidden) {
        return;
      }
      const imgs = Array.from(document.querySelectorAll("img[data-dec-id]"));

      if (imgs.length === 0) return;

      const decOf = (img) =>
        (window.settings.decorations || []).find(
          (d) => d.id === img.dataset.decId,
        );

      /* 命中顺序：卡片上层的贴图优先（视觉层级高者先接点击），同层内按 z-index 降序。
         不能只按 img 的 z-index——上下两个容器的图各自从「容器内序号」取值，会撞号。 */
      imgs.sort((a, b) => {
        const aa = decOf(a)?.aboveCards ? 1 : 0;
        const ab = decOf(b)?.aboveCards ? 1 : 0;
        if (aa !== ab) return ab - aa;
        const za = parseInt(getComputedStyle(a).zIndex) || 0;
        const zb = parseInt(getComputedStyle(b).zIndex) || 0;
        return zb - za;
      });

      const x = e.clientX;
      const y = e.clientY;

      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        const inRect =
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom;

        if (inRect) {
          const dec = decOf(img);

          /* 卡片下层的贴图（未勾「覆盖卡片」）：只保留待机浮动，不响应点击，
             也不 stopPropagation——它本来就被页面内容盖住，偷走这一下点击会让
             它下面的页面按钮/链接点不动。想让它能点，勾上「覆盖卡片」即可。 */
          if (!dec || !dec.aboveCards) break;

          if (dec.interactive && dec.interactive.enabled) {
            const ia = dec.interactive;
            const hitScale = (dec.hitScale ?? 100) / 100;

            let inHotZone = true;
            if (hitScale < 1) {
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const hitW = rect.width * hitScale;
              const hitH = rect.height * hitScale;
              const dx = Math.abs(x - centerX);
              const dy = Math.abs(y - centerY);
              inHotZone = !(dx > hitW / 2 || dy > hitH / 2);
            }
            // 如果全局隐藏，不执行任何互动效果
            if (window.decorationsGloballyHidden) {
              return;
            }
            if (inHotZone) {
              e.stopPropagation();

              if (ia.squeeze !== false) {
                window.applySqueezeEffect(img);
              }
              if (ia.sound) {
                const preset = ia.soundPreset || "pop";
                const customFile =
                  preset === "custom" ? ia.soundFile || "" : "";
                window.playPopSound(preset, customFile);
              }
              if (ia.particles && ia.emojis && ia.emojis.length > 0) {
                window.spawnEmojiParticles(img, ia.emojis, x, y);
              }

              if (ia.dialogue && ia.dialogues && ia.dialogues.length > 0) {
                window.spawnDialogueBubble(img, ia.dialogues, x, y);
              }
            }
          }

          break;
        }
      }
    },
    true,
  );
}
/* ============================================================
 * 归档页本地搜索过滤 v5（支持图片/视频标题索引）
 * ============================================================ */
(function () {
  const STORAGE_KEY = "lc_arch_search_v4";
  const TITLE_CACHE_KEY = "lc_arch_titles_" + location.hostname;
  let pluginMode = false;
  let searchInput = null;
  let resultHint = null;
  let loadedCountHint = null;
  let indexHint = null;
  let uiReady = false;
  let lastSearchKw = "";

  // 标题缓存：fpost -> title
  let titleCache = {};
  let indexTotal = 0;
  let indexDone = 0;
  let indexing = false;

  function loadTitleCache() {
    try {
      const raw = sessionStorage.getItem(TITLE_CACHE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        titleCache = { ...stored, ...titleCache }; // 内存优先，合并不覆盖
      }
    } catch (e) {}
  }
  function saveTitleCache() {
    try {
      sessionStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(titleCache));
    } catch (e) {}
  }

  function getOriginalBox() {
    return document.querySelector(".g-bdc .m-fsch");
  }
  function getFbar() {
    return document.querySelector(".g-bdc .m-fbar");
  }
  function getMonthBlocks() {
    return document.querySelectorAll(".m-filecnt");
  }
  function getAllItems() {
    return document.querySelectorAll(
      ".m-filecnt li.img, .m-filecnt li.text, .m-filecnt li.movie",
    );
  }

  function saveMode(on) {
    try {
      sessionStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch (e) {}
  }
  function loadMode() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  // 从 li 元素提取 fpost 参数
  function getFpost(item) {
    const a = item.querySelector("a[href]");
    if (!a) return null;
    try {
      const url = new URL(a.href);
      return url.searchParams.get("fpost");
    } catch (e) {
      return null;
    }
  }

  function getItemText(item) {
    let text = item.textContent || "";
    item.querySelectorAll("*[alt], *[title]").forEach((el) => {
      text += " " + (el.alt || "") + " " + (el.title || "");
    });
    // 补入缓存的标题
    const fpost = getFpost(item);
    if (fpost && titleCache[fpost]) {
      text += " " + titleCache[fpost];
    }
    return text.toLowerCase();
  }

  function countLoadedItems() {
    return getAllItems().length;
  }

  function updateLoadedHint() {
    if (loadedCountHint) {
      loadedCountHint.textContent = "已加载 " + countLoadedItems() + " 篇";
    }
  }

  function updateIndexHint() {
    if (!indexHint) return;
    if (indexTotal === 0) {
      indexHint.textContent = "";
      return;
    }
    if (indexDone >= indexTotal) {
      indexHint.textContent = "图片/视频标题索引完成 ✓";
      indexHint.style.color = "#52c41a";
    } else {
      indexHint.textContent =
        "索引图片/视频标题 " + indexDone + "/" + indexTotal + "…";
      indexHint.style.color = "#999";
    }
  }

  // 限速 fetch 标题
  async function fetchTitle(blogName, fpost) {
    if (titleCache[fpost]) return titleCache[fpost];
    try {
      const url = "https://" + blogName + ".lofter.com/post/" + fpost;
      const res = await fetch(url);
      const html = await res.text();
      const match = html.match(/<title>([\s\S]*?)<\/title>/i);
      if (match) {
        const raw = match[1];
        // 格式："标题 - 博客名 - LOFTER"
        const title = raw.split(" - ")[0].trim();
        return title;
      }
    } catch (e) {}
    return "";
  }

  async function startIndexing() {
    loadTitleCache(); // 无论如何先合并缓存
    if (indexing) return;
    indexing = true;
    loadTitleCache();

    const blogName = location.hostname.split(".")[0];
    const mediaItems = Array.from(
      document.querySelectorAll(".m-filecnt li.img, .m-filecnt li.movie"),
    );
    const toFetch = mediaItems.filter((li) => {
      const fpost = getFpost(li);
      return fpost && !titleCache[fpost];
    });

    indexTotal = toFetch.length;
    indexDone = 0;
    updateIndexHint();

    for (const li of toFetch) {
      const fpost = getFpost(li);
      if (!fpost) {
        indexDone++;
        continue;
      }
      const title = await fetchTitle(blogName, fpost);
      if (title) {
        titleCache[fpost] = title;
        saveTitleCache();
      }
      indexDone++;
      updateIndexHint();
      // 如果正在搜索，实时更新结果
      if (lastSearchKw && pluginMode) doSearch(lastSearchKw);
      // 限速：每个请求间隔 350ms
      await new Promise((r) => setTimeout(r, 350));
    }

    // 已缓存的不算进 total，显示全部完成
    indexTotal = mediaItems.length;
    indexDone = mediaItems.length;
    updateIndexHint();
    indexing = false;
  }

  function buildUI() {
    if (uiReady) return true;
    const fbar = getFbar();
    const originalBox = getOriginalBox();
    if (!fbar || !originalBox) return false;
    uiReady = true;
    // 把 window._lcDebug 那行改成
    const _toggleBtn = document.getElementById("lc-arch-toggle");
    if (_toggleBtn) {
      Object.defineProperty(_toggleBtn, "_lcDebug", {
        get() {
          return { titleCache, lastSearchKw };
        },
        configurable: true,
      });
    }

    loadTitleCache();

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "lc-arch-toggle";
    toggleBtn.textContent = "🔍 插件搜索";
    toggleBtn.style.cssText =
      "margin-left:8px;padding:4px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:20px;background:rgba(255,255,255,0.7);font-size:12px;color:#555;cursor:pointer;transition:all .2s;white-space:nowrap;";
    toggleBtn.addEventListener("mouseenter", () => {
      toggleBtn.style.background = "rgba(255,255,255,0.95)";
      toggleBtn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
    });
    toggleBtn.addEventListener("mouseleave", () => {
      toggleBtn.style.background = "rgba(255,255,255,0.7)";
      toggleBtn.style.boxShadow = "none";
    });
    const schbtn = fbar.querySelector(".schbtn");
    schbtn.appendChild(toggleBtn);

    const box = document.createElement("div");
    box.id = "lc-arch-box";
    box.style.cssText = "display:none;float:right;align-items:center;gap:8px;";

    const row1 = document.createElement("div");
    row1.style.cssText = "display:flex;align-items:center;gap:8px;";

    searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "搜索标题、正文、标签…";
    searchInput.style.cssText =
      "flex:1;min-width:180px;max-width:320px;padding:6px 14px;border:1px solid rgba(0,0,0,0.1);border-radius:20px;background:rgba(255,255,255,0.85);font-size:13px;outline:none;";
    searchInput.addEventListener("focus", () => {
      searchInput.style.borderColor = "#667eea";
      searchInput.style.boxShadow = "0 0 0 3px rgba(102,126,234,0.12)";
    });
    searchInput.addEventListener("blur", () => {
      searchInput.style.borderColor = "rgba(0,0,0,0.1)";
      searchInput.style.boxShadow = "none";
    });

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "清空";
    clearBtn.style.cssText =
      "padding:4px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:20px;background:rgba(255,255,255,0.7);font-size:12px;color:#666;cursor:pointer;white-space:nowrap;";

    resultHint = document.createElement("span");
    resultHint.style.cssText =
      "font-size:12px;color:#667eea;font-weight:500;white-space:nowrap;";

    row1.appendChild(searchInput);
    row1.appendChild(clearBtn);
    row1.appendChild(resultHint);
    box.appendChild(row1);

    const row2 = document.createElement("div");
    row2.style.cssText =
      "display:flex;align-items:center;gap:8px;margin-top:2px;";

    loadedCountHint = document.createElement("span");
    loadedCountHint.style.cssText = "font-size:11px;color:#999;";

    indexHint = document.createElement("span");
    indexHint.style.cssText = "font-size:11px;color:#999;";

    row2.appendChild(loadedCountHint);
    row2.appendChild(indexHint);
    box.appendChild(row2);

    originalBox.parentNode.insertBefore(box, originalBox.nextSibling);

    let timer;
    searchInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => doSearch(searchInput.value), 180);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        clearTimeout(timer);
        doSearch(searchInput.value);
      }
    });
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      searchInput.focus();
      restoreAll();
      resultHint.textContent = "";
      lastSearchKw = "";
    });

    toggleBtn.addEventListener("click", () => {
      pluginMode = !pluginMode;
      saveMode(pluginMode);
      updateView();
      // 切换到插件搜索时开始建索引
      if (pluginMode) startIndexing();
    });

    const origInput = originalBox.querySelector("input");
    if (origInput) {
      origInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && pluginMode) {
          e.preventDefault();
          e.stopPropagation();
          searchInput.value = origInput.value;
          doSearch(origInput.value);
        }
      });
    }

    pluginMode = loadMode();
    updateView();
    updateLoadedHint();
    if (pluginMode) startIndexing();

    watchForLazyLoad();
    return true;
  }

  function watchForLazyLoad() {
    const container = document.querySelector(".g-bdc") || document.body;
    const obs = new MutationObserver((mutations) => {
      let hasNewItems = false;
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const isItem =
            (node.matches("li.img") ||
              node.matches("li.text") ||
              node.matches("li.movie")) &&
            node.closest(".m-filecnt");
          const hasItem = node.querySelector(
            ".m-filecnt li.img, .m-filecnt li.text, .m-filecnt li.movie",
          );
          if (isItem || hasItem) hasNewItems = true;
        });
      });
      if (hasNewItems) {
        updateLoadedHint();
        if (lastSearchKw && pluginMode) doSearch(lastSearchKw);
        // 新加载的图片/视频也加入索引
        if (pluginMode && !indexing) startIndexing();
      }
    });
    obs.observe(container, { childList: true, subtree: true });
  }

  function updateView() {
    const toggleBtn = document.getElementById("lc-arch-toggle");
    const box = document.getElementById("lc-arch-box");
    const originalBox = getOriginalBox();
    if (!toggleBtn || !box || !originalBox) return;

    if (pluginMode) {
      toggleBtn.textContent = "↩ 原版搜索";
      toggleBtn.style.color = "#667eea";
      toggleBtn.style.borderColor = "rgba(102,126,234,0.3)";
      box.style.display = "flex";
      originalBox.style.display = "none";
      updateLoadedHint();
      updateIndexHint();
    } else {
      toggleBtn.textContent = "🔍 插件搜索";
      toggleBtn.style.color = "#555";
      toggleBtn.style.borderColor = "rgba(0,0,0,0.08)";
      box.style.display = "none";
      originalBox.style.display = "";
      restoreAll();
      if (resultHint) resultHint.textContent = "";
      lastSearchKw = "";
    }
  }

  function doSearch(raw) {
    loadTitleCache();
    const kw = raw.trim().toLowerCase();
    lastSearchKw = kw;
    if (!kw) {
      restoreAll();
      resultHint.textContent = "";
      updateLoadedHint();
      return;
    }

    const keywords = kw.split(/\s+/).filter((k) => k.length > 0);
    const blocks = getMonthBlocks();
    let total = 0;

    blocks.forEach((block) => {
      const items = block.querySelectorAll("li.img, li.text, li.movie");
      let matched = 0;
      items.forEach((item) => {
        const text = getItemText(item);
        const ok = keywords.some((k) => text.includes(k));
        item.style.display = ok ? "" : "none";
        if (ok) matched++;
      });

      const h2 = block.querySelector("h2");
      if (h2) {
        if (!h2.dataset.orig) h2.dataset.orig = h2.textContent;
        if (matched > 0) {
          h2.textContent = h2.dataset.orig + " · 找到 " + matched + " 篇";
          h2.style.color = "#667eea";
          block.style.display = "";
        } else {
          block.style.display = "none";
        }
      }
      total += matched;
    });

    resultHint.textContent =
      total > 0 ? "共找到 " + total + " 篇" : "未找到匹配文章";
    updateLoadedHint();
  }

  function restoreAll() {
    getMonthBlocks().forEach((block) => {
      block.style.display = "";
      block.querySelectorAll("li.img, li.text, li.movie").forEach((item) => {
        item.style.display = "";
      });
      const h2 = block.querySelector("h2");
      if (h2 && h2.dataset.orig) {
        h2.textContent = h2.dataset.orig;
        h2.style.color = "";
      }
    });
    updateLoadedHint();
  }

  function tryInit() {
    if (!document.body || !document.body.classList.contains("p-body10"))
      return false;
    if (!getFbar() || !getOriginalBox()) return false;
    return buildUI();
  }

  if (tryInit()) return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (tryInit()) return;
      watchForReady();
    });
  } else {
    watchForReady();
  }

  function watchForReady() {
    const obs = new MutationObserver(() => {
      if (tryInit()) obs.disconnect();
    });
    obs.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
    setTimeout(() => obs.disconnect(), 10000);
  }
})();

/* ============================================================
 * 悬浮设置面板（UI 批第一步）
 * Shadow DOM 宿主 + 悬浮按钮（可拖动/记忆位置）+ popup.html iframe
 * 说明：本文件头部对 iframe（编辑器/评论区）已 throw 提前退出，
 * 因此执行到这里的一定是主帧。面板数据流与 UI 宿主无关——
 * popup.js 全量写 lc_settings_v1，主 IIFE 的 storage.onChanged
 * 监听负责重绘，此处只管 UI 壳。
 * ============================================================ */
(function () {
  const HOST_ID = "lc-fab-host";
  const FAB = 44;            // 悬浮按钮直径
  const PANEL_W = 340;       // 与 popup.html body 定宽一致
  const PANEL_H = 600;       // 面板默认高度（视口不够时收缩；嵌入页比工具栏弹窗宽裕，600 减少滚动）
  const MIN_PANEL_H = 200;   // 面板压缩下限，低于此值宁可允许覆盖按钮
  /* 面板垫底色（暗色档）：必须与 popup.html body.dark 的 --lc-bg 同值，
   * 否则 iframe 首帧前后会有一道色差。改一处要同步改另一处。 */
  const PANEL_DARK_BG = "#1b1b22";
  const EDGE = 12;           // 左/上/下：距视口边缘最小间距
  const RIGHT_EDGE = 18;     // 右侧边界加大：避免压进滚动条区域
  const FAB_MARGIN_BOTTOM = 96; // 默认位抬高，避开站点右下角 50x50 回顶按钮
  const MORPH_MS = 260;        // 结构变化（翻边/换展开方向）后位置过渡的保持窗口
  /* 面板位置过渡：只在「结构变化」时启用。拖动中的连续跟随必须逐帧瞬跟，
   * 否则面板会滞后按钮约 0.2s，拖起来发黏。 */
  const PANEL_T =
    "opacity .18s ease, transform .18s ease, " +
    "left .2s cubic-bezier(.22,.61,.36,1), " +
    "top .2s cubic-bezier(.22,.61,.36,1), " +
    "height .2s cubic-bezier(.22,.61,.36,1)";

  /* 视口宽高必须用 clientWidth/Height（不含滚动条）。
   * innerWidth 含滚动条（约 15-17px），按它 clamp 会让按钮压进
   * 滚动条区域，表现为"按钮超出网页右缘一部分"，开 DevTools 时尤甚。 */
  const vw = () => document.documentElement.clientWidth || window.innerWidth;
  const vh = () => document.documentElement.clientHeight || window.innerHeight;

  let host = null;
  let fab = null;
  let panel = null;
  let panelIframe = null; // 首次打开才创建，之后复用（保留面板内状态）
  let isOpen = false;
  let fabPos = null;      // FAB 停靠信息 {side, y}；null = 默认位
  let dragMoved = false;
  let followRaf = null;   // 拖动跟随的 rAF 句柄（节流）
  let lastPanelSig = "";       // 上次的面板档位签名「停靠侧|展开档」
  let panelMorphUntil = 0;     // 结构变化过渡的保持截止时间戳
  let panelMotionOn = false;   // 面板当前是否带位置过渡

  /* ---------- 主题读取（与主 IIFE 的 window.settings 解耦兜底） ---------- */
  const isDark = () => {
    const m = window.settings?.darkMode?.mode || "off";
    return (
      m === "manual" ||
      (m === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  };
  const getAccent = () => window.settings?.theme?.accent || "#667eea";

  /* ---------- 注入点 helper：幂等挂载 Shadow DOM 宿主 ----------
   * 挂在 documentElement（body 之外）：React 重渲染/站点脚本不清洗，
   * SPA 路由切换不影响。closed shadow root + adoptedStyleSheets，
   * 站点样式（含本插件自己的 #lc-style / 暗色滤镜）完全隔离。 */
  function ensureHost() {
    host = document.getElementById(HOST_ID);
    if (host) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;";
    (document.documentElement || document.body).appendChild(host);

    const shadow = host.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      #fab {
        position: fixed; width: ${FAB}px; height: ${FAB}px;
        border-radius: 50%; display: flex; align-items: center;
        justify-content: center; cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,.28);
        /* left/top 过渡专供「松手归岸」时平滑滑回边缘；拖动中 .dragging
         * 会把 transition 覆盖为 none，保证逐帧跟手不滞后。 */
        transition: transform .15s ease, box-shadow .15s ease,
          left .18s ease, top .18s ease;
        touch-action: none; user-select: none; -webkit-user-select: none;
      }
      #fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,.34); }
      #fab.dragging { cursor: grabbing; transform: scale(1.05);
        box-shadow: 0 8px 24px rgba(0,0,0,.4); transition: none; }
      /* 拖近 logo 图标时的磁吸提示：轻微放大 + 一圈淡紫描边 */
      #fab.magnet { transform: scale(1.18);
        box-shadow: 0 0 0 3px rgba(196,181,253,.35), 0 8px 24px rgba(0,0,0,.4); }
      /* FAB 图标：全 CSS 分层绘制（星球 → 星环 → L → 星星）。矢量形状 + CSS 发光：
       * 星环是完整椭圆，两端伸出按钮圆外（#fab 因此不能设 overflow:hidden）；
       * L 用矢量 mask 定形状、linear-gradient 供材质，发光交给 CSS drop-shadow——
       * 它按 CSS 像素作用在 mask 后的轮廓上，可多层叠加，也没有 SVG 滤镜区域的
       * 裁切问题（feGaussianBlur 在 44px 下既糊不开又被硬切，是之前脏边的根因）。 */
      #fab {
        /* FAB 星球配色（固定，不随主题色）：边缘光 / 球心 / 主体 / 暗部 / 光强。
         * 当前为「泡泡」方案——球心比主体更暗，明度渐变反转后呈透明玻璃球感
         * （径向渐变中心暗 = 模拟透明球「中心透背景、边缘全反射亮环」）。
         * 配套 icon-lab.html 调色台可实时预览并复制新的变量值。 */
        --f-edge: #c2b8ff; --f-core: #040615; --f-mid: #7479b9; --f-deep: #83479e;
        --f-glow: .8;
        --f-lmask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cpath d='M37 25V51C37 61 43 66 51 66H62' fill='none' stroke='%23fff' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        --f-hmask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cpath d='M34.5 27V51C34.5 59.5 40 63 48 63H58' fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round'/%3E%3C/svg%3E");
      }
      /* 各图层不参与命中测试：热区仍是 44px 圆，伸出的星环不会扩大可点击范围 */
      #fab > i { position: absolute; display: block; pointer-events: none; }
      #fab .p {
        inset: 0; border-radius: 50%;
        background: radial-gradient(circle at 40% 32%,
          var(--f-core), var(--f-mid) 58%, var(--f-deep) 85%);
      }
      /* 边缘光：环形渐变（透明 → edge → 透明，closest-side 对齐圆周），
       * 光晕向内外晕开、无硬边；强度由 --f-glow 控制 */
      #fab .p::before {
        content: ""; position: absolute; inset: 0; border-radius: 50%;
        opacity: var(--f-glow);
        background: radial-gradient(circle closest-side,
          transparent 68%,
          color-mix(in srgb, var(--f-edge) 55%, transparent) 87%,
          transparent 100%);
      }
      #fab .r {
        left: -15%; top: 37%; width: 130%; height: 26%; border-radius: 50%;
        border: 2px solid rgba(232,225,255,.78); transform: rotate(-18deg);
      }
      #fab .l {
        inset: 0;
        background: linear-gradient(155deg,
          #fff, #eef1ff 30%, #d8ddff 58%, #c4b5fd 82%, #e8c7ee);
        -webkit-mask: var(--f-lmask) center/100% 100% no-repeat;
        mask: var(--f-lmask) center/100% 100% no-repeat;
        filter: drop-shadow(0 0 1px rgba(255,255,255,.6))
                drop-shadow(0 0 4px rgba(165,155,255,.5));
      }
      #fab .lh {
        inset: 0; background: #fff; opacity: .72; filter: blur(.4px);
        -webkit-mask: var(--f-hmask) center/100% 100% no-repeat;
        mask: var(--f-hmask) center/100% 100% no-repeat;
      }
      #fab .s1, #fab .s2 {
        clip-path: polygon(50% 0, 59% 41%, 100% 50%, 59% 59%, 50% 100%,
                           41% 59%, 0 50%, 41% 41%);
      }
      #fab .s1 { left: 62%; top: 9%; width: 21%; height: 21%;
        background: linear-gradient(160deg, #fff, #f3a6e0); }
      #fab .s2 { left: 18%; top: 56%; width: 11%; height: 11%; background: #fff; }
      #fab .d1, #fab .d2 { border-radius: 50%; background: #fff; }
      #fab .d1 { left: 30%; top: 28%; width: 3%; height: 3%; opacity: .55; }
      #fab .d2 { left: 78%; top: 76%; width: 3%; height: 3%; opacity: .45; }
      #panel {
        position: fixed; width: ${PANEL_W}px;
        /* 底色只是「iframe 首帧还没画出来」那一下的垫底（about:blank 是透明的），
         * 由 applyFabTheme 按当前深浅实时写内联值——这里写死 #fff 会让暗色下
         * 首开先闪一帧白板（真机必现）。 */
        background: #fff;
        border-radius: 16px; overflow: hidden;
        box-shadow: 0 12px 40px rgba(0,0,0,.28);
        opacity: 0; pointer-events: none;
        transform: translateY(8px) scale(.97);
        transition: opacity .18s ease, transform .18s ease;
      }
      #panel.open { opacity: 1; pointer-events: auto; transform: none; }
      #panel iframe { width: 100%; height: 100%; border: 0; display: block; background: transparent; }
    `);
    shadow.adoptedStyleSheets = [sheet];

    fab = document.createElement("div");
    fab.id = "fab";
    fab.title = "Lofter Customizer 设置";
    /* FAB 图标结构（样式见上方 shadow sheet）：
     * p 星球 / r 星环 / l L 主体 / lh 高光带 / s1,s2 四角星 / d1,d2 微尘 */
    fab.innerHTML =
      '<i class="p"></i><i class="r"></i><i class="l"></i><i class="lh"></i>' +
      '<i class="s1"></i><i class="s2"></i><i class="d1"></i><i class="d2"></i>';
    shadow.appendChild(fab);

    panel = document.createElement("div");
    panel.id = "panel";
    shadow.appendChild(panel);

    applyFabTheme();
    bindFabEvents();
  }


  /* ---------- FAB 主题：图标为 CSS 图层自带配色（固定蓝紫），只随深浅模式调投影 ---------- */
  function applyFabTheme() {
    fab.style.background = "transparent";
    fab.style.boxShadow = isDark()
      ? "0 4px 16px rgba(0,0,0,.5)"
      : "0 4px 16px rgba(0,0,0,.28)";
    /* 面板容器底色同步主题——它是 iframe 首帧（透明 about:blank）底下的那层垫色，
     * 见 #panel 注释。 */
    if (panel) panel.style.background = isDark() ? PANEL_DARK_BG : "#fff";
  }

  /* ---------- 定位（停靠式） ----------
   * 按钮只停靠页面左/右边缘（fabPos = { side, y }），永远悬不到页面中间。
   * 这样 DevTools 开合等视口变化只会让按钮贴着新边缘，不会出现
   * "缩窄时被 clamp 进来、拉宽后留在中间"的棘轮效应。 */
  function clampY(y) {
    const maxY = Math.max(EDGE, vh() - FAB - EDGE);
    return Math.min(Math.max(EDGE, y), maxY);
  }

  /* ---------- 回顶按钮探测：默认位与它对齐 ----------
   * 站点回顶按钮类名混淆且可能改版，不用选择器，按几何特征找：
   * 右下角 140px 范围内、36~90px 见方的 fixed/absolute 元素、几乎无文字。
   * 量出它的右边距与顶边后，FAB 默认位与其同列、悬于其上方 10px，
   * 右缘不再参差。量不到（页面没有该按钮）时回退 RIGHT_EDGE 常规值。 */
  let dockMarginR = RIGHT_EDGE; // 右侧停靠边距：默认值，量到回顶按钮后对齐
  let bttInfo = null;           // { margin, top }
  function probeBtt() {
    try {
      const vwv = vw(), vhv = vh();
      let best = null;
      for (const el of document.body.getElementsByTagName("*")) {
        const r = el.getBoundingClientRect();
        if (r.width < 36 || r.width > 90 || r.height < 36 || r.height > 90) continue;
        if (r.right < vwv - 140 || r.bottom < vhv - 140) continue;
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "absolute") continue;
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
        if (el.textContent.trim().length > 4) continue;
        if (!best || r.bottom > best.bottom) {
          best = { bottom: r.bottom, right: r.right, top: r.top };
        }
      }
      if (best) {
        bttInfo = {
          margin: Math.max(EDGE, Math.round(vwv - best.right)),
          top: Math.round(best.top),
        };
        dockMarginR = bttInfo.margin;
      }
    } catch (err) { /* body 未就绪等，静默跳过，下次再试 */ }
    return bttInfo;
  }

  /* fabIsDefault：当前是否仍处于"从未被用户/存档指定过位置"的默认态。
   * 只有默认态才会跟随回顶按钮探测结果重摆；一旦有记忆位置即固定。 */
  let fabIsDefault = true;

  /* 启动静默期：logo 吸附与回顶按钮对齐都靠异步探测（400ms~8s 多拍），
   * 首次探测命中前按钮先落在默认位，之后 placeFab(带过渡) 会呈现
   * "从右下角飞到 logo"的轨迹。期内（用户首次 pointerdown 前）一律免过渡。 */
  let fabTouched = false;
  const FAB_BOOT_QUIET_MS = 15000;
  const fabBootAt = performance.now();

  const sideX = (side) =>
    side === "left" ? EDGE : vw() - FAB - dockMarginR;

  /* 归一化存档：兼容旧版 {x,y} 自由坐标（按 x 落在哪半边判定停靠侧），
   * 也接受新版 {side,y}；无效或缺省返回 null（用默认位）。 */
  function normPos(raw) {
    if (!raw) return null;
    if (typeof raw.x === "number") {
      return {
        side: raw.x >= vw() / 2 ? "right" : "left",
        y: typeof raw.y === "number" ? raw.y : null,
      };
    }
    if (raw.side === "left" || raw.side === "right") {
      return {
        side: raw.side,
        y: typeof raw.y === "number" ? raw.y : null,
      };
    }
    return null;
  }

  function setFabPos(left, top, animate) {
    if (animate === false) {
      /* 挂载首帧 / 恢复记忆位置：不能带过渡——left/top 从空值过渡到目标值
       * 会出现"从左上角滑过来"的启动动画。强制结算一次再恢复。 */
      fab.style.transition = "none";
      fab.style.left = left + "px";
      fab.style.top = top + "px";
      void fab.offsetWidth;
      fab.style.transition = "";
    } else {
      fab.style.left = left + "px";
      fab.style.top = top + "px";
    }
  }

  /* ---------- 彩蛋：吸附站点 logo 图标 ----------
   * logo（图标 + LOFTER 文字）是一个链接，点文字也能回首页，所以只盖图标、
   * 文字留在外面，导航不丢。个人主页/归档页/长文章写作页/批量管理没有 logo，
   * 此时回退普通停靠位，等回到有 logo 的页面自动再吸上（存的是 snap 标记，
   * 不是坐标——位置每页实时读，天然自适应）。 */
  /* 探测实现（实证修正 v3）：
   *  - 根链接判定收紧：解析后 host 必须是 www.lofter.com 且 pathname 为
   *    "/"。个人头像链接（https://<user>.lofter.com）pathname 同样是 "/"，
   *    按根路径打分会和 logo 平分且锚点更靠左反胜——刷新/进个人主页就吸到
   *    头像上，滚动后头像移出探测窗才"归位"（实测踩坑）；
   *  - 锚点内 img/svg 可能不止一个：首页 logo 锚点同时含圆形图标与
   *    LOFTER 字标，querySelector 取 DOM 第一个会命中字标（曾致吸到
   *    logo 正中间）。改为收集全部可见图标元素，优先左上方的方形者
   *    （图标近正方，字标宽扁 aspect>1.8），兜底取最左；
   *  - 命中结果缓存元素引用，滚动跟随等高频调用只重读坐标，不做全树扫描。 */
  let logoCache = null; // { a, ic }——a 必须保持 isConnected 才算有效

  /* 吸附中心相对 logo 图标圆心的水平微调：FAB(44px) 比图标(约36px)宽，
   * 居中时右侧多出约 4px，悬停放大 1.18 倍后光环会蹭到 LOFTER 字标，
   * 整体左移一点让出余量（负值=向左）。 */
  const LOGO_SNAP_DX = -6;

  /* 由图标元素求吸附中心。宽扁图形（aspect>1.8）按"图标+字标合一"处理：
   * LOFTER 实测是单个 svg（viewBox 132x32，一条 path，圆形图标占左侧
   * 32x32 见方、右侧是 LOFTER 字母）——没有第二个元素可选，取左端一个
   * 见方即图标区。方/近方图形则整块即图标。 */
  function logoSnapRect(el) {
    const r = el.getBoundingClientRect();
    if (r.width > r.height * 1.8) {
      return { x: r.left + r.height / 2, y: r.top + r.height / 2, w: r.height, h: r.height };
    }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  function probeLogo() {
    try {
      /* 缓存快路径：元素还在、图标仍够大且大致在顶栏，直接重读坐标 */
      if (logoCache && logoCache.a.isConnected) {
        const s = logoSnapRect(logoCache.ic || logoCache.a);
        if (s.w >= 20 && s.h >= 20 && s.y - s.h / 2 <= 160 && s.y + s.h / 2 >= -20) {
          return { x: s.x + LOGO_SNAP_DX, y: s.y };
        }
        logoCache = null; // 换页/重构了，走全量探测
      }
      const vwv = vw();
      let best = null; // { a, ic, score }
      for (const a of document.querySelectorAll("a[href]")) {
        const r0 = a.getBoundingClientRect();
        if (r0.width < 30 || r0.height < 24 || r0.top > 120 || r0.bottom < 0) continue;
        if (r0.left > vwv / 2) continue; // logo 固定在左上区
        const cs = getComputedStyle(a);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        let root = false;
        try {
          const u = new URL(a.href, location.href);
          root = u.hostname === "www.lofter.com" && u.pathname === "/";
        } catch (err) {}
        if (!root) continue; // 只认指向 www 首页的链接，子域名头像等一律排除
        /* 收集锚点内全部可见图标元素（img/svg），方形的优先 */
        const rects = [];
        for (const el of a.querySelectorAll("img, svg")) {
          const er = el.getBoundingClientRect();
          if (er.width >= 20 && er.height >= 20)
            rects.push({ el, er });
        }
        rects.sort((p, q) => {
          const pw = p.er.width / p.er.height > 1.8 ? 1 : 0; // 宽扁=字标
          const qw = q.er.width / q.er.height > 1.8 ? 1 : 0;
          return pw - qw || p.er.left - q.er.left; // 方形优先，再按最左
        });
        let ic = null, r = null;
        if (rects.length) { ic = rects[0].el; r = rects[0].er; }
        if (!ic) {
          /* 退路：图标是 CSS 背景图——找链内第一个带背景图的可见元素 */
          for (const el of a.querySelectorAll("*")) {
            const bgi = getComputedStyle(el).backgroundImage;
            if (!bgi || bgi === "none" || bgi.indexOf("url(") === -1) continue;
            const er = el.getBoundingClientRect();
            if (er.width >= 20 && er.height >= 20) { ic = el; r = er; break; }
          }
        }
        if (!ic && a.textContent.trim() === "") {
          ic = a; r = r0; // 整链无文字（图标是链接自身背景）：链接即图标
        }
        if (!ic) continue; // 纯文字链接（如导航"首页"），不是 logo
        const score = (/^(img|svg)$/i.test(ic.tagName) ? 1 : 0) - r0.left / 10000;
        if (!best || score > best.score) best = { a, ic, score };
      }
      if (best) {
        logoCache = { a: best.a, ic: best.ic };
        const s = logoSnapRect(best.ic || best.a);
        return { x: s.x + LOGO_SNAP_DX, y: s.y };
      }
    } catch (err) { /* DOM 未就绪等，静默忽略 */ }
    return null;
  }

  const MAGNET_R = 34; // 拖动松手时距图标中心小于该值即吸附

  function placeFab(animate) {
    /* 启动静默期内的重摆（吸附命中、btt 对齐）免过渡，直接落到目标位 */
    if (
      animate !== false &&
      !fabTouched &&
      performance.now() - fabBootAt < FAB_BOOT_QUIET_MS
    ) {
      animate = false;
    }
    /* 吸附态：每次摆放实时读 logo 位置（header 若随页滚动由 scroll 监听跟上） */
    if (fabPos && fabPos.snap === "logo") {
      const L = probeLogo();
      if (L) {
        const left = L.x - FAB / 2, top = L.y - FAB / 2;
        fabPos = { snap: "logo", side: "left", y: top };
        setFabPos(left, top, animate);
      } else {
        /* 本页没有 logo：先回右侧停靠位（边距用回顶按钮对齐值） */
        const y = clampY(bttInfo ? bttInfo.top - FAB - 10 : vh() - FAB - FAB_MARGIN_BOTTOM);
        fabPos = { snap: "logo", side: "right", y };
        setFabPos(sideX("right"), y, animate);
      }
      return;
    }
    const p = normPos(fabIsDefault ? null : fabPos);
    fabPos = {
      side: p ? p.side : "right",
      y: clampY(
        p && p.y !== null
          ? p.y
          : bttInfo
          ? bttInfo.top - FAB - 10
          : vh() - FAB - FAB_MARGIN_BOTTOM
      ),
    };
    setFabPos(sideX(fabPos.side), fabPos.y, animate);
  }

  /* 位置写入 storage（整对象取出、局部更新、整体写回，
   * 不经主 IIFE 的 merge 回路，避免覆盖用户其他字段） */
  function saveFabPos() {
    chrome.storage.local.get(LC_STORAGE_KEY, (res) => {
      const s = res[LC_STORAGE_KEY] || {};
      s.panel = Object.assign({}, s.panel, {
        fabPos: fabPos.snap === "logo"
          ? { snap: "logo" } // 吸附态只存标记，坐标每页实时读
          : { side: fabPos.side, y: Math.round(fabPos.y) },
      });
      chrome.storage.local.set({ [LC_STORAGE_KEY]: s });
    });
  }

  /* ---------- 展开/收起 ----------
   * 展开方向由 positionPanel 按三档判定（上下 / 侧向 / 压缩），
   * 详见该函数注释。面板打开后会随按钮拖动实时跟随。 */
  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    if (!panelIframe) {
      panelIframe = document.createElement("iframe");
      /* lcDark=1：把「当前是暗色」提前写进 URL，让 popup.html 在第一帧就套上
       * 暗色变量。面板自己的暗色判断要等 chrome.storage 回调（异步、晚于首帧），
       * 只靠它的话暗色下首开必然先画一帧浅色再翻暗（真机白闪，2026-09-23 报）。
       * iframe 只在此处建一次、之后复用，所以这个预判只在首开生效——与真机
       * 表现（再次打开正常）一致。 */
      panelIframe.src =
        chrome.runtime.getURL("popup.html") + (isDark() ? "?lcDark=1" : "");
      panel.appendChild(panelIframe);
    }
    positionPanel(true); // 首次展开/重开：位置变化走平滑过渡
    panel.classList.add("open");
    isOpen = true;
  }

  /* 面板位置过渡的开关：
   *   structural=true → 打开位置过渡，并保持 MORPH_MS。保持窗口是必须的：
   *   过渡进行中若立刻把 transition 关掉，浏览器会直接跳到终值，动画等于白做。
   *   structural=false → 恢复"只淡入淡出"，拖动跟随时逐帧瞬跟不滞后。 */
  function applyPanelMotion(structural) {
    const now = performance.now();
    if (structural) panelMorphUntil = now + MORPH_MS;
    const on = now < panelMorphUntil;
    if (on === panelMotionOn) return;
    panelMotionOn = on;
    panel.style.transition = on ? PANEL_T : "";
  }

  /* 面板定位（与开关解耦：拖动按钮时需要实时重定位，不能重建 iframe） */
  function positionPanel(force) {
    /* 展开方向 + 高度（保证面板永不覆盖按钮——按钮是唯一开关键，被压住就点不到）：
     * ① 按钮靠上/下部（某一侧装得下整高，含四个角）→ 向该侧上下展开；
     * ② 按钮在垂直中部（两侧都装不下整高）→ 侧向展开：靠右缘时面板在按钮
     *    左侧、靠左缘时面板在按钮右侧，整高、与按钮垂直居中；
     * ③ 窗口太窄侧向也放不下 → 退回压缩垂直（高度下限 MIN_PANEL_H）；
     * ④ 窗口极矮连下限都放不下 → 允许覆盖，退回视口 clamp（无更优解）。 */
    const GAP = 16;
    const fr = fab.getBoundingClientRect();
    const maxH = Math.min(PANEL_H, vh() - EDGE * 2);
    const spaceAbove = fr.top - GAP - EDGE;
    const spaceBelow = vh() - fr.bottom - GAP - EDGE;
    let left, top, ph, mode;
    if (spaceBelow >= maxH || spaceAbove >= maxH) {
      /* ① 角部/靠边场景：上下展开，整高 */
      const below = spaceBelow >= maxH;
      mode = below ? "below" : "above";
      ph = maxH;
      top = below ? fr.bottom + GAP : fr.top - GAP - ph;
      left = Math.min(Math.max(EDGE, fr.left), vw() - PANEL_W - RIGHT_EDGE);
    } else {
      /* ② 垂直中部：侧向展开（x 方向与按钮区间不相交，天然不覆盖） */
      const sideSpace =
        fabPos.side === "right"
          ? fr.left - GAP - EDGE
          : vw() - fr.right - GAP - EDGE;
      if (sideSpace >= PANEL_W) {
        mode = "side";
        ph = maxH;
        left =
          fabPos.side === "right"
            ? fr.left - GAP - PANEL_W
            : fr.right + GAP;
        top = Math.min(
          Math.max(EDGE, fr.top + FAB / 2 - ph / 2),
          Math.max(EDGE, vh() - ph - EDGE),
        );
      } else {
        /* ③ 窗口太窄：压缩垂直 */
        const below = spaceBelow >= spaceAbove;
        mode = below ? "squash-below" : "squash-above";
        ph = Math.max(
          MIN_PANEL_H,
          Math.min(maxH, below ? spaceBelow : spaceAbove),
        );
        top = below ? fr.bottom + GAP : fr.top - GAP - ph;
        top = Math.min(Math.max(EDGE, top), Math.max(EDGE, vh() - ph - EDGE));
        left = Math.min(Math.max(EDGE, fr.left), vw() - PANEL_W - RIGHT_EDGE);
      }
    }
    /* 档位签名 = 停靠侧 + 展开档。只有签名变化（翻边 / 换展开方向 / 换档）
     * 才走平滑过渡；同档位下的连续跟随瞬跟，否则拖起来面板会滞后。 */
    const sig = fabPos.side + "|" + mode;
    applyPanelMotion(!!force || sig !== lastPanelSig);
    lastPanelSig = sig;
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.height = ph + "px";
  }

  function closePanel() {
    panel.classList.remove("open");
    isOpen = false;
  }

  /* ---------- 交互绑定：拖动 / 点击切换 / 外部点击收起 / Esc / resize ---------- */
  function bindFabEvents() {
    placeFab(false); // 首帧免过渡，避免从空值位置滑过来

    let pid = null;
    let sx = 0, sy = 0, ox = 0, oy = 0;
    let dragX = 0, dragY = 0; // 拖动中的自由坐标（松手才按半边归岸）
    let dragLogo = null;      // 本次拖动开始时缓存的 logo 图标位置（磁吸判定用）

    fab.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      fabTouched = true; // 用户碰过按钮，此后的重摆恢复过渡动画
      dragMoved = false;
      sx = e.clientX; sy = e.clientY;
      // 拖动起点取当前实际渲染位置（吸附态的 left/top 不是停靠坐标）
      ox = parseFloat(fab.style.left) || sideX(fabPos.side);
      oy = parseFloat(fab.style.top) || fabPos.y || 0;
      dragX = ox; dragY = oy;
      dragLogo = probeLogo(); // 一次拖动只查一次，move 里只做距离计算
      pid = e.pointerId;
      try { fab.setPointerCapture(pid); } catch (err) {}
    });

    fab.addEventListener("pointermove", (e) => {
      if (pid === null || e.pointerId !== pid) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!dragMoved && Math.hypot(dx, dy) < 4) return; // 位移阈值，区分点击/拖动
      dragMoved = true;
      fab.classList.add("dragging");
      // 拖动中允许在视口内自由移动（可跨越中线），垂直方向 clamp
      dragX = Math.min(Math.max(EDGE, ox + dx), vw() - FAB - RIGHT_EDGE);
      dragY = clampY(oy + dy);
      fab.style.left = dragX + "px";
      fab.style.top = dragY + "px";
      // 同步拖动态的停靠侧：侧向展开时面板要跟着翻边，而不是等松手才翻
      fabPos.side = dragX + FAB / 2 >= vw() / 2 ? "right" : "left";
      // 磁吸提示：靠近 logo 图标时给视觉反馈（位置用 pointerdown 时的缓存）
      if (dragLogo) {
        const near = Math.hypot(
          dragX + FAB / 2 - dragLogo.x,
          dragY + FAB / 2 - dragLogo.y
        ) < MAGNET_R;
        fab.classList.toggle("magnet", near);
      }
      // 面板保持展开并实时跟随（rAF 节流：避免每帧多次 getBoundingClientRect 触发布局抖动；
      // 同档位瞬跟保手感，翻边/换档由 positionPanel 内部自动走过渡）
      if (isOpen && followRaf === null) {
        followRaf = requestAnimationFrame(() => {
          followRaf = null;
          positionPanel();
        });
      }
    });

    const finish = (e) => {
      if (pid === null || e.pointerId !== pid) return;
      pid = null; // capture 在 pointerup 后由浏览器自动释放
      fab.classList.remove("dragging");
      if (dragMoved) {
        fabIsDefault = false; // 用户亲手定过位，此后不再跟随默认位重摆
        if (dragLogo && Math.hypot(
              dragX + FAB / 2 - dragLogo.x,
              dragY + FAB / 2 - dragLogo.y
            ) < MAGNET_R) {
          // 磁吸命中：吸附 logo 图标（彩蛋位）。再拖走即解除，回到普通停靠。
          fabPos = { snap: "logo", side: "left", y: dragY };
          saveFabPos();
          placeFab(); // 带过渡滑到图标上
          if (isOpen) positionPanel(true);
        } else {
          // 停靠定盘：按钮中心落在哪半边就归哪侧边缘，垂直高度保留
          fabPos = { side: fabPos.side, y: dragY };
          fab.style.left = sideX(fabPos.side) + "px";
          fab.style.top = fabPos.y + "px";
          if (isOpen) positionPanel(true); // 归岸后面板随之平滑校正
          saveFabPos();
        }
        fab.classList.remove("magnet");
      } else {
        togglePanel();
      }
      dragMoved = false;
    };
    fab.addEventListener("pointerup", finish);
    fab.addEventListener("pointercancel", finish);

    /* 交互模型（用户确认）：
     *   单击按钮 → 开/关面板；
     *   点页面空白 → 面板不收起（调样式时需要边点页面看效果、边继续改设置，
     *     否则每次预览都要重新开面板）；
     *   拖动按钮 → 面板保持展开并实时跟随（仅横向吸附归岸）。
     * 逃生口：Esc 关闭；按钮始终可见可点，随时可关。 */
    document.addEventListener("keydown", (e) => {
      if (isOpen && e.key === "Escape") closePanel();
    });
    /* 焦点在面板 iframe 里时（用户在面板内点过任意位置），键盘事件只派发给
     * iframe 文档，宿主页这条 Esc 监听收不到——表现为「面板内点过就关不掉」
     * （2026-09-24 报）。popup.js 在 iframe 里捕获 Esc 后写 storage 中继键
     * 喊话（跨帧通信走 chrome.storage，不走 postMessage，见「跨帧汇总 v2」
     * 注释：postMessage 会撞进页面自己的 message 处理器），这里收到就收面板。
     * 值用时间戳，同名键每次变更都能触发 onChanged。 */
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === "local" && c.lc_panel_esc && isOpen) closePanel();
    });

    /* 探测回顶按钮并对齐：基准（边距/顶边）变化时才重摆，避免多余动画。
     * 对记忆位置的用户同样生效——x 是停靠边距、跟着基准走，y 保留用户选择；
     * 吸附态则重读 logo 位置。拖动中跳过，避免和跟手逻辑打架。 */
    function probeAndAlign() {
      if (pid !== null) return;
      const prev = bttInfo && bttInfo.margin + "|" + bttInfo.top;
      const found = probeBtt();
      const cur = found && found.margin + "|" + found.top;
      if (found && cur !== prev) placeFab();
      else if (fabPos && fabPos.snap === "logo") placeFab(); // 吸附态顺便试试本页有没有 logo
    }

    let lastProbe = 0;
    window.addEventListener("resize", () => {
      placeFab(); // 带过渡：视口变化时按钮平滑贴到新边缘（吸附态重读 logo 位置）
      if (isOpen) positionPanel(true); // 只重定位，不重建
      const now = Date.now();
      if (now - lastProbe > 800) {
        lastProbe = now;
        probeAndAlign();
      }
    });

    /* 吸附态跟随滚动：logo 若随页面滚走，按钮跟着走（rAF 节流；固定顶栏时无感知） */
    let scrollRaf = null;
    window.addEventListener("scroll", () => {
      if (!fabPos || fabPos.snap !== "logo" || scrollRaf !== null) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        placeFab(false);
      });
    }, { passive: true });

    /* 站点元素往往在脚本执行后才渲染（SPA 渐进挂载），load 后多探几拍 */
    for (const t of [400, 1000, 2400, 4500, 8000]) {
      setTimeout(probeAndAlign, t);
    }

    // 主题联动：settings 或系统深浅变化时刷新按钮配色
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === "local" && c[LC_STORAGE_KEY]) applyFabTheme();
    });
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", applyFabTheme);
  }

  /* ---------- 启动：立即挂载（documentElement 已就绪），设置异步补主题与位置 ---------- */
  ensureHost();
  chrome.storage.local.get(LC_STORAGE_KEY, (res) => {
    /* 注意不能判 `if (!window.settings)` 跳过：主 IIFE 在脚本开头就同步
     * 设了 window.settings = LC_clone(LC_DEFAULTS)（纯默认值，accent 空），
     * 判空永远为 false，按钮会一直显示兜底蓝色直到首次设置变更。
     * 这里无条件按存储值 merge（与主 IIFE load() 同一套逻辑），
     * 顺便让全局 settings 在 DOMContentLoaded 前就提前就绪。 */
    window.settings = LC_merge(LC_DEFAULTS, res[LC_STORAGE_KEY] || {});
    // 恢复记忆位置（normPos 兼容旧版 {x,y} 存档）
    const saved = res[LC_STORAGE_KEY]?.panel?.fabPos;
    if (saved) {
      fabIsDefault = false; // 有记忆位置：固定不动，不再跟随默认位重摆
      fabPos = saved;
      placeFab(false); // 恢复记忆位置同样免过渡
    }
    applyFabTheme();
  });
  })();
})();