window.decorationsGloballyHidden = false;

if (window !== window.top) {
  const href = location.href;

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
        if (isDark) {
          st.textContent = `
            html, body, .pc-publish-container, [class*="editor"], [contenteditable] {
              background: rgb(30, 30, 36) !important;
              color: rgba(255, 255, 255, 0.85) !important;
            }
            img { filter: none !important; }
            /* 滚动条 */
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: rgb(30, 30, 36); }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
          `;
        } else {
          st.textContent = '';
        }
      };
      checkAndApply(s);
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes['lc_settings_v1']) {
          checkAndApply(changes['lc_settings_v1'].newValue || {});
        }
      });
    });
    throw new Error('lc-iframe-exit');
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
  img {
    filter: ${isLpost ? 'invert(100%) hue-rotate(180deg)' : 'none'} !important;
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

  throw new Error('lc-iframe-exit');
}
/* ============================================================
 * content.js — Lofter 美化注入
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
    const stack = [];
    if (f.embedName && f.embedDataUrl) stack.push(`"${f.embedName}"`);
    if (f.family) stack.push(f.family);
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
              to   { opacity: 1; transform: translateY(0); }
            }`;
          break;
        case "fadeIn":
          keyframes = `
            @keyframes lc-card-appear {
              from { opacity: 0; }
              to   { opacity: 1; }
            }`;
          break;
        case "scaleIn":
          keyframes = `
            @keyframes lc-card-appear {
              from { opacity: 0; transform: scale(0.92); }
              to   { opacity: 1; transform: scale(1); }
            }`;
          break;
        case "slideIn":
          keyframes = `
            @keyframes lc-card-appear {
              from { opacity: 0; transform: translateX(-30px); }
              to   { opacity: 1; transform: translateX(0); }
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
        /* 动画播放后的状态 */
        .m-mlist.lc-card-visible {
          animation: lc-card-appear ${duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `);
    }

    /* ========== 全局弹窗（保存确认等）圆角 + 浅色毛玻璃 ========== */
    out.push(`
      .m-layer {
        border-radius: ${fr} !important;
        overflow: hidden !important;
        box-shadow: 0 16px 48px rgba(0,0,0,0.15) !important;
        background: rgba(255, 255, 255, 0.82) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        border: 1px solid rgba(0,0,0,0.06) !important;
      }
      .m-layer .layert,
      .m-layer .layerm,
      .m-layer .layerb,
      .m-layer .zflg {
        background: transparent !important;
      }
      .m-layer .warmt,
      .m-layer .warmc,
      .m-layer h3,
      .m-layer h4 {
        color: #333 !important;
      }
      .m-layer .w-close2 {
        color: #999 !important;
        transition: color 0.2s ease !important;
      }
      .m-layer .w-close2:hover {
        color: ${s.theme.accent || "#666"} !important;
      }

      /* 确认按钮：主题色（.m-layer 挂在 body 下，不在 #main 反色区，
          直接写原始主题色；computeDarkAccent 会显示成暗紫） */
      .m-layer .w-sbtn.w-sbtn-0 {
        background: ${s.theme.accent || "#667eea"} !important;
        background-image: none !important;
        color: #fff !important;
        border-color: ${s.theme.accent || "#667eea"} !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .m-layer .w-sbtn.w-sbtn-0:hover {
        filter: brightness(1.1) !important;
      }

      /* 取消按钮 */
      .m-layer .w-sbtn.w-sbtn-3 {
        background: rgba(0,0,0,0.06) !important;
        color: #555 !important;
        border-color: transparent !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .m-layer .w-sbtn.w-sbtn-3:hover {
        background: rgba(0,0,0,0.1) !important;
        color: #333 !important;
      }
      /* ── 个人主页设置：所有标签页内容卡片圆角 ── */
      .info_menu.menu.ztag,
      .theme_menu.menu.ztag,
      .appearance_menu.menu.ztag,
      .page_menu.menu.ztag,
      .interactive_menu.menu.ztag,
      .sync_menu.menu.ztag,
      .archive_menu.menu.ztag,
      .copyright_menu.menu.ztag,
      .phonetheme_menu.menu.ztag {
        border-radius: ${fr} !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important;
      }
      /* ── 已发布长文章页：圆角（浅色+暗色通用）── */
html body .g-bd .banner {
  border-radius: 16px 16px 0 0 !important;
  margin-bottom: 0 !important;
  display: block !important;
  vertical-align: bottom !important;
  padding: 24px 24px 0 !important;
  border: none !important;
  outline: none !important;
  box-shadow: ${longpostShadow} !important;
}
html body .g-bd .m-cnt {
  border-radius: 0 0 16px 16px !important;
  overflow: hidden !important;
  box-shadow: ${longpostShadow} !important;
  margin-top: -2px !important;
  border: none !important;
  outline: none !important;
}
html body .g-bd .m-recom {
  border-radius: 16px !important;
  padding: 16px !important;
  margin-top: 16px !important;
  border: none !important;
  outline: none !important;
}

/* ── 专栏文章评论区居中── */
#comment_frame {
  display: block !important;
  margin: 0 auto !important;
}
.show-comment-num {
  padding-left: 122px !important;
}


      /* ── 长文章草稿页删除弹窗：浅色模式 ── */
      .AddTagWin {
        border-radius: ${fr} !important;
        overflow: hidden !important;
        box-shadow: 0 16px 48px rgba(0,0,0,0.15) !important;
        background: rgba(255, 255, 255, 0.82) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        border: 1px solid rgba(0,0,0,0.06) !important;
      }
      .AddTagWin .tip {
        color: #333 !important;
      }
      .AddTagWin .close.winbtn {
        color: #999 !important;
        transition: color 0.2s ease !important;
        cursor: pointer !important;
      }
      .AddTagWin .close.winbtn:hover {
        color: ${s.theme.accent || "#666"} !important;
      }
      /* 确认按钮：主题色 */
      .AddTagWin .btn-block .btn.winbtn.f-left {
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        background-image: none !important;
        color: #fff !important;
        border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .AddTagWin .btn-block .btn.winbtn.f-left:hover {
        filter: brightness(1.1) !important;
      }
      /* 取消按钮：比主题色略深 */
      .AddTagWin .btn-block .btn.winbtn.f-right {
        background: color-mix(in srgb, ${s.theme.accent} 70%, #000) !important;
        color: #fff !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .AddTagWin .btn-block .btn.winbtn.f-right:hover {
        filter: brightness(1.15) !important;
      }
    `);

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
      out.push(`
        /* 新版页面：背景透明，让插件背景层透上来 */
        #application.lofter-root-container,
        #application.lofter-root-container > [class*="box-web"],
        #application.lofter-root-container [class*="boxGray-web"] {
          background: transparent !important;
        }
        
        /* 登录页：恢复背景图容器链，让原版背景正常显示 */
        #application.lofter-root-container > [class*="box-web"] > [class*="IiOL8wMgNi6Lv9LPtNvjMQ"] {
          background: transparent !important;
        }
        #application.lofter-root-container > [class*="box-web"] > [class*="IiOL8wMgNi6Lv9LPtNvjMQ"] > [class*="rp2Too2wX46bs0iA6tkUoA"] {
          background-image: initial !important;
          background-size: cover !important;
          background-position: center !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: -1 !important;
        }
        
        /* 新版页面：内容区卡片化 — 设置页/合集页/创建连载等 */
        #application.lofter-root-container [class*="boxGray-web"] > div:nth-child(2) {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(12px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(12px) saturate(140%) !important;
          border-radius: ${fr} !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08) !important;
          margin: 20px auto !important;
          max-width: 900px !important;
          padding: 24px !important;
        }

        /* 合集页"创建合集"按钮：浅色跟随主题色，去掉原版绿底绿框 */
        #application.lofter-root-container button.collection-create-btn {
          background: ${s.theme.accent || "#667eea"} !important;
          border-color: transparent !important;
          color: #fff !important;
        }
        
        /* 新版页面：搜索查看更多页 — 内容区不设置白色大容器底，保持透明 */
        #application.lofter-root-container [class*="box-web"] [class*="page-web"] > div:first-child > div:first-child {
          background: transparent !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: none !important;
          border: none !important;
        }

        /* 文章发布弹窗：编辑区 iframe 圆角（浅色/暗色通用） */
        iframe[title="editor"] {
          border-radius: 8px !important;
        }
      `);
    }

    /* 精品连载页：浅色模式主题色细节（写在暗色块之前，暗色规则靠后覆盖）。
       站点 create.f32c 样式表用 #application.lofter-root-container 前缀 +
       !important，特异性 (1,1,x)，所以这里必须带 id 前缀才能压住 */
    {
      const A = s.theme.accent || "#667eea";
      const SCOPE = "#application.lofter-root-container";
      out.push(`
        /* 左侧筛选栏选中项：主题色文字 + 浅主题色底（原绿色系）。
           绿色 !important 写在按钮内层 span 上，span 需一并覆盖 */
        ${SCOPE} aside[aria-label="连载作品筛选"] button[aria-pressed="true"],
        ${SCOPE} aside[aria-label="连载作品筛选"] button[aria-pressed="true"] span {
          color: ${A} !important;
        }
        ${SCOPE} aside[aria-label="连载作品筛选"] button[aria-pressed="true"] {
          background: ${A}26 !important;
          border-color: transparent !important;
        }
        /* "了解什么是精品连载"按钮跟随主题色 */
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) button[aria-label="了解什么是精品连载"] {
          color: ${A} !important;
          background: ${A}1A !important;
        }
        /* 连载封面选中态：外框 + 勾选标记（原 #14C4BC 青绿）跟随主题色。
           上一版用 div:has(> div > svg:has(ellipse...)) 嵌套 :has 定位，
           实测未命中（用户 DevTools 面板无此规则），改用封面组件的构建
           哈希类（属性子串选择器，无需转义 ==）：
           bTRD0Wz 为选中态修饰类，OK0wB90 为缩略图内层（绿框画在它身上，
           站点规则 .bTRD0Wz... .OK0wB90... { border: .5px solid #14c4bc }） */
        ${SCOPE} [class*="bTRD0WzP9XFEoZJOLvnD0Q"] > [class*="OK0wB90PycynwzeBRzgtuw"] {
          border-color: ${A} !important;
        }
        ${SCOPE} [class*="OK0wB90PycynwzeBRzgtuw"] svg ellipse {
          fill: ${A} !important;
        }
        /* 勾选路径改深色，浅紫底上保持对比度 */
        ${SCOPE} [class*="OK0wB90PycynwzeBRzgtuw"] svg path {
          stroke: #333 !important;
        }
        /* 作品状态/作品类型：单选选中圈（fill=currentColor）跟随主题色 */
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) label:has(input[type="radio"]) svg {
          color: ${A} !important;
        }
        /* 连载名称/连载简介/相关标签：悬停与聚焦边框跟随主题色
           （站点 hover/focus 的绿框 + 绿色内阴影画在外层包裹 div 上） */
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) div:has(> input[type="text"]):hover,
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) div:has(> input[type="text"]):focus-within,
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) div:has(> textarea):hover,
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) div:has(> textarea):focus-within {
          border-color: ${A} !important;
          box-shadow: inset 0 0 0 30px ${A}08 !important;
        }
        /* 相关标签：站点把绿框/绿色内阴影画在标签区外层包裹 div 上
           （input 非其直接子级，上面的 div:has(> input) 定位不到），
           用该包裹层的构建哈希类直取（站点 :hover/:focus-within
           border #16ad1f + inset rgba(22,218,209,.2)） */
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) [class*="_1ZZXFWOZzldLQBGPHXkBzQ"]:hover,
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) [class*="_1ZZXFWOZzldLQBGPHXkBzQ"]:focus-within {
          border-color: ${A} !important;
          box-shadow: inset 0 0 0 3px ${A}33 !important;
        }
        /* ===== 连载作品管理页（manage.e028）浅色按钮 =====
           站点按钮是 #14c4bc 青绿系，统一跟随主题色 */
        /* 空状态"创建连载"键：实心绿底 → 主题色底 */
        ${SCOPE} main[class*="IHdchkcjQ8s8u7rxAPOb4w"] button[class*="l8wGBlACyy3nd3eBHk6WiQ"] {
          background: ${A} !important;
          background-image: none !important;
          color: #333 !important;
          border: none !important;
        }
        /* 右上角"创建连载"（描边键）：边框+文字主题色、浅主题色底 */
        ${SCOPE} main[class*="IHdchkcjQ8s8u7rxAPOb4w"] button[class*="v2+OSY8pxUSIqCP9qRUVUw"] {
          background: ${A}1A !important;
          color: ${A} !important;
          border: 1px solid ${A} !important;
        }
        /* "编辑连载"（eurwS 修饰的实心键）：主题色底 */
        ${SCOPE} main[class*="IHdchkcjQ8s8u7rxAPOb4w"] button[class*="_7JA6leoHltWgSxKG3maq4w"][class*="eurwS-3Ul-a4VcnLVRUNCQ"] {
          background: ${A} !important;
          background-image: none !important;
          color: #333 !important;
          border: 1px solid ${A} !important;
        }
        /* 章节管理页（chapters.fc_a09b2，2026-09 新哈希）浅色：
           下拉筛选键选中态文字（站点 #14c4bc 青绿）、"发布章节"
           （EMefqeRw，站点 #14c4bc）→ 跟随主题色。
           不加卡片祖先锚点：下拉列表可能是 portal 渲染，不在卡片内 */
        ${SCOPE} button[class*="qfI0GDy6JppnRoNYjHHIfQ"] {
          color: ${A} !important;
        }
        ${SCOPE} button[class*="EMefqeRwQYlaafYncwXIew"] {
          color: ${A} !important;
        }
        /* 章节编辑页（发布文字页）：浅色半透明卡片底（原为透明）；
            内容原先贴着卡片边缘，加内边距让整体放大一圈。
            ⚠️ 此卡片绝不能加 backdrop-filter/filter/transform 毛玻璃：
            展开编辑器是卡片内部的 position:fixed 层（站点 top:0;bottom:0
            贴满视口），这类属性会把卡片变成 fixed 的 containing block，
            展开层被关进卡片（高度塌成卡片高、盖不住页面、iframe 缩回）。
            没有模糊后底图透得更明显，透明度提到 0.92 保证可读 */
        ${SCOPE} [class*="KrL5Oe6b4NCGc0rWTW54QQ"] {
          background: rgba(255, 255, 255, 0.92) !important;
          border-radius: 16px !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06) !important;
          box-sizing: border-box !important;
          padding: 12px 28px 20px !important;
        }
        /* 展开编辑器（Ub0N956L，卡片内 position:fixed 贴满视口）：
            浅色跟随站点原版的整块白底思路，这里半透明白提亮一档，
            保证展开后完全盖住后面页面、只剩标题 + 输入框的专注视图 */
        ${SCOPE} [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="Ub0N956L-f4qc9aVSghnZA"] {
          background: rgba(255, 255, 255, 0.98) !important;
        }
        /* 展开/收起输入区按键（右上角 Ea66w 图标，站点 #999/#14c4bc）：
            常态即主题色，两模式通用 */
        ${SCOPE} [class*="KrL5Oe6b4NCGc0rWTW54QQ"] svg[class*="Ea66w-pusaVoA3BJnxdUdg"] {
          color: ${A} !important;
        }
        /* 工具栏各按键悬停：站点写死 #14c4bc 青绿 → 跟随主题色。
            按键是 LBgBjQp 包裹 div + svg 图标（currentColor 跟随），
            悬停层直接命中 div/svg */
        ${SCOPE} [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="EloVc4T0IWvY9gSQCQ88cA"] div:hover,
        ${SCOPE} [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="EloVc4T0IWvY9gSQCQ88cA"] svg:hover {
          color: ${A} !important;
        }
        /* 卡内超链接（@提及 caret-node 等）：跟随主题色 */
        ${SCOPE} [class*="KrL5Oe6b4NCGc0rWTW54QQ"] a {
          color: ${A} !important;
        }
        /* ===== 帮助与反馈页（customer-service）===== */
        /* 圆角毛玻璃大容器底（两模式）：页面背景图太花时保证内容可读。
            此页无内部 fixed 弹层，可安全使用 backdrop-filter（模糊的
            正是页面背景图本身，即"毛玻璃压花底"效果）。
            ⚠️ 双属性选择器抬特异性：通用 box-web 透明链规则
            （[class*="box-web"] > div > div，特异性同为 (1,2,1) 且
            在样式表更靠后）会把这里的 background 清掉——已实证 */
        ${SCOPE} div[class*="iYtrszmUYaccvUMmBbXQiw"][class*="iYtrszm"] {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 16px !important;
        }
        /* 容器横向收窄（用户实证侧边距 400px 刚好，居中；
            两模式通用，几何规则放浅色区始终生效） */
        ${SCOPE} div[class*="iYtrszmUYaccvUMmBbXQiw"][class*="iYtrszm"] {
          max-width: calc(100% - 400px) !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        /* 容器内可跳转超链接：悬停轻微放大（transform 只影响视觉
            不影响布局；display:inline-block 让行内链接也能吃到缩放；
            transform-origin 取左侧——热门问题等列表链接贴着容器左缘，
            默认中心缩放会让左边界裁掉"1."序号） */
        ${SCOPE} div[class*="iYtrszmUYaccvUMmBbXQiw"] a {
          display: inline-block !important;
          transition: transform 0.2s ease !important;
          transform-origin: left center !important;
        }
        ${SCOPE} div[class*="iYtrszmUYaccvUMmBbXQiw"] a:hover {
          transform: scale(1.05) !important;
          /* 浅色双保险：白毛玻璃卡上悬停不变主题色（全局悬停变色
              规则已在 :not 链排除本容器，这里显式继承原色防漏网） */
          color: inherit !important;
        }
        /* 快捷入口行的 box-web 小块被"导航栏毛玻璃"通用规则误伤：
            [class*="box-web"] > div:first-child > div:first-child
            （(1,4,0)，rgba白纱+blur）——账号换绑 style-15_3497
           （lofter:// 链接独立构建）恰在 first-child 链上，扫出一块
            白底（用户实证）。属性三写抬到 (1,5,0) 反压，仅限帮助
            容器内部的 box-web 层（不碰真导航栏），透明放行 */
        ${SCOPE} div[class*="iYtrszmUYaccvUMmBbXQiw"] div[class*="-box-web"][class*="box-web"][class*="-box-web"] {
          background: transparent !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        /* ===== 政策文档老页（privacyPolicy / ServiceAgreement 等
            CMS 页，无 #application，内容在 body>.box）===== */
        /* 浅色圆角毛玻璃卡底（原版白底直角矩形直怼背景图）；站点
            自带 .box 有 border:1px #ddd + box-shadow，一并软化。
            暗色的深卡规则在暗色块 */
        /* :not 排除个人主页两容器（.postwrapper / .box.wid700 同为
            body>.box，且在反色滤镜区内，直接终色会被二次反相） */
        body > .box:not(.postwrapper):not(.wid700) {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 16px !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06) !important;
        }
        /* ===== 帮助与反馈入口的功能页 ===== */
        /* 网络诊断页（tool.lofter.com，weui 结构）：设备信息/
            服务器列表两组卡片改圆角毛玻璃（原版白底）。
            首版 .react-weui-page .weui-cells 实测未命中（诊断：插件
            已注入但卡片仍纯白直角）——react-weui 的页面根类名各构建
            不一，去掉前缀直接命中 .weui-cells（weui 组件类名跨版本
            稳定，仅 weui 页面使用，无碰撞风险） */
        .weui-cells {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 16px !important;
        }
        /* 违规查询页结果卡（站点已给 16px 圆角白底）：补毛玻璃质感 */
        #application.lofter-root-container div[class*="-violation-web"] li[class*="-item-web"] {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
        }
        /* 更新APP页提示行（"您的版本不支持自动跳转…"）：圆角毛玻璃底。
            .info 类名较通用，若其他页面出现异常毛玻璃块需收窄范围。
            宽度按内容收缩（原 div 通栏太长）+ 提高透明度 */
        .info {
          background: rgba(255, 255, 255, 0.55) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 16px !important;
          box-sizing: border-box !important;
          padding: 16px 24px !important;
          width: fit-content !important;
          max-width: 92% !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        /* 达人认证页浅色（镜像暗色已验证的结构盲打）：遮住背景图的是
           无 id 无 class 裸 DIV（白底/#e6e6e6 直角），透明化放行。
           暗色同款规则用户已实测透出背景图。
           :not 排除装饰图词卡气泡（同为 body 直属裸 DIV，曾把实底
           误杀成透明——!important 压过内联样式的实证案例） */
        body > div:not([class]):not([id]):not([data-lc-dialogue]),
        #application > div:not([class]):not([id]) {
          background: transparent !important;
        }
        /* ===== 客服中心子路由（question-answer / feedback /
            sub-categories 等共用 SPA）===== */
        /* 内容页容器一锅端：各路由 box-web/page-web 哈希不同（实测
            style-14_248 / 7758 / 5405 等），用通配模式匹配。站点原版
            只垫一层 rgba(255,255,255,0.35) 白纱，内容直接怼背景图；
            这里给内容根容器（page-web > div > div，dump 实证）画
            毛玻璃卡底。:not 排除帮助主页（主页 page-web 内含
            iYtrszm 根容器，已有专属毛玻璃卡，避免叠双层+多余 padding） */
        ${SCOPE} > div[class*="-box-web"][class*="box-web"] div[class*="page-web"][class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])):not(:has([class*="countBox-web"])) > div > div {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 16px !important;
          box-sizing: border-box !important;
          padding: 20px 28px 24px !important;
        }
        /* ===== 帮助中心旧页（specialrepair / 服务协议 / 社区规范 等
            老架构，无 #application）===== */
        /* 老三栏：g-mn 主栏（g-box3 内容 / g-box2 搜索列表）+
            g-sd 侧栏（g-box2），原版全透明、#444 深字直接怼背景图
            → 画毛玻璃卡底（两模式）。限定 .helpCenterArea 前缀，
            g-box2/g-box3 是站点通用旧类，不能裸匹配 */
        .helpCenterArea .g-mn .g-box3,
        .helpCenterArea .g-mn .g-box2,
        .helpCenterArea .g-sd .g-box2 {
          background: rgba(255, 255, 255, 0.82) !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 12px !important;
        }
        /* ===== 拍摄设置弹窗（post-text 系样式表，浅暗通用）===== */
        /* 已选中的单选/勾选圆圈（白勾 + currentColor 圆底，站点写死
           青绿 #14c4bc）：跟随主题色。该 svg 类是"选中态"专用
           （未选中是灰色描边圆，不用这个类）。
           （首版把哈希 OCR 错成 wHG4DNtW...vt5j，未命中，已按用户
           贴出的真实类名修正） */
        svg[class*="wHG4DNtVWiq8VR+vtSj"] {
          color: ${A} !important;
        }
        /* "选择拍摄地点"下拉框：
            悬停 → 站点 border #16ad1f 绿 → 主题色 */
        div[class*="jlUi+e-AdGwdG0RfaFATVQ"]:hover {
          border-color: ${A} !important;
        }
        /* 点击/选中态：站点用 qJtmS 修饰类画绿边框 + 绿内阴影
           （border #16ad1f + inset rgba(22,218,209,.2)）→ 主题色；
           另加 :focus-within 兜底（点击后 input 获焦的场景） */
        div[class*="qJtmSKRGIPh779TF5S6C7Q"] {
          border-color: ${A} !important;
          box-shadow: inset 0 0 0 3px ${A}33 !important;
        }
        div[class*="jlUi+e-AdGwdG0RfaFATVQ"]:focus-within {
          border-color: ${A} !important;
          box-shadow: inset 0 0 0 3px ${A}33 !important;
        }
        /* 首页发布弹窗工具栏按键悬停：按键结构为
           div.T4XRspykozUsIyroDAQzaA（格子）> svg.Lr9CsLeWlJx0GGF9OLV6yw
           （图标，path=currentColor），最右侧"清除格式"键是独立的
           svg.kGuiz8D1mIRm8lXmo+ejnw。站点 hover 写死 #14c4bc，
           具体挂在格子还是 svg 上不确定 → 两者都覆盖成主题色
           （浅暗通用；此前的 _IrSCslew/_3Ji7n 均为截图误读，
           实际不存在，已删） */
        .rc-dialog-content [class*="T4XRspykozUsIyroDAQzaA"]:hover,
        .rc-dialog-content [class*="T4XRspykozUsIyroDAQzaA"]:hover svg,
        .rc-dialog-content svg[class*="kGuiz8D1mIRm8lXmo+ejnw"]:hover {
          color: ${A} !important;
        }
        /* 创作声明勾选键（选中圈 + 白勾）：部分页面站点直接给
           path 写 fill，color 继承失效 → 直接覆盖 currentColor
           路径填充为主题色（白勾保留，与拍摄设置弹窗观感一致） */
        svg[class*="wHG4DNtVWiq8VR+vtSj"] path[fill="currentColor"] {
          fill: ${A} !important;
        }
        /* "选择拍摄地点"另一构建哈希实例（rc-dialog 版，站点
           hover border #16AD8F / 选中 inset 绿阴影）→ 主题色，
           浅暗通用 */
        div[class*="oLusJxhjzwVCm4l9cChvSA"]:hover {
          border-color: ${A} !important;
        }
        div[class*="oLusJxhjzwVCm4l9cChvSA"]:focus-within {
          border-color: ${A} !important;
          box-shadow: inset 0 0 0 3px ${A}33 !important;
        }
        /* 选中态（点击后元素才挂上的 _0C-8BYQ 修饰类）：主题色边框
           + 内阴影。（GPuMp2t 是尺寸变体基类、常态就在类名里，
           不能染主题色——否则未悬停也带主题色边框） */
        div[class*="_0C-8BYQwb+hPqE-Vkvpfkw"] {
          border-color: ${A} !important;
          box-shadow: inset 0 0 0 3px ${A}33 !important;
        }
        /* 首页发布弹窗工具栏按键悬停（真实命中：站点共用基类
           _3Ji7n + 各键哈希组成复合类，:hover 写死 color #14c4bc，
           特异性 (0,3,0)）→ 主题色；带 .rc-dialog-content 前缀
           提到 (0,3,1) 压过站点 */
        .rc-dialog-content svg[class*="_3Ji7n-CDp7jB0uKaKDPmRh"]:hover {
          color: ${A} !important;
        }
        /* 创作声明勾选键（声明弹窗构建哈希 Peu0Wssf，checked 态
           站点写死 color #14c4bc）→ 主题色；path[fill=currentColor]
           兜底直接覆盖填充。另加一条不依赖哈希的保险：选中圈的
           圆底 path（d 属性以 M20 40c11.046 开头，全站唯一）
           直接钉死主题色——哈希截图辨识易错（此前已两次翻车） */
        svg[class*="Peu0WssfZzKJWKeaWnbsJpg"] {
          color: ${A} !important;
        }
        svg[class*="Peu0WssfZzKJWKeaWnbsJpg"] path[fill="currentColor"] {
          fill: ${A} !important;
        }
        svg[viewBox="0 0 40 40"]:has(path[d^="M20 40c11.046"]) {
          color: ${A} !important;
        }
        svg[viewBox="0 0 40 40"] path[d^="M20 40c11.046"] {
          fill: ${A} !important;
        }
        /* 章节管理页"更新章节"键（头部 + 空状态）：主题色底白字 */
        ${SCOPE} button[class*="rTJCL2feQxu8OAlsa5nUCw"],
        ${SCOPE} button[class*="gaMFcFLrz8MzQMjWztEkNg"] {
          background: ${A} !important;
          background-image: none !important;
          color: #fff !important;
          border: none !important;
        }
        /* 右上角"存为草稿"键：往左下移，不贴卡片边缘（浅暗通用） */
        ${SCOPE} [class*="KrL5Oe6b4NCGc0rWTW54QQ"] button[class*="w0QlRuNB1+cwpNnUhw"] {
          margin: 10px 10px 0 0 !important;
        }
        /* 底部按钮：登录页规则 button[class*="AaRSlfX5..."]（共享基类）
           把本页取消/确认键误伤成紫色，这里以更高特异性夺回。
           取消键：恢复原版灰底黑字 */
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) button[class*="_1mrgXFoxS9cWLEWPvB1KCw"] {
          background: #f2f2f2 !important;
          background-image: none !important;
          color: #1f1f1f !important;
          border: none !important;
          filter: none !important;
        }
        /* 确认键可用态：主题色底 + 白字 */
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) button[class*="IWKkWSqHHfy16K39b0EUJQ"]:not([disabled]) {
          background: ${A} !important;
          background-image: none !important;
          color: #fff !important;
          border: none !important;
          filter: none !important;
        }
        /* 确认键禁用态：灰底浅灰字 */
        ${SCOPE} main:has(button[aria-label="了解什么是精品连载"]) button[class*="IWKkWSqHHfy16K39b0EUJQ"][disabled] {
          background: #f2f2f2 !important;
          background-image: none !important;
          color: #c8c8c8 !important;
          border: none !important;
          filter: none !important;
        }
      `);
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
      out.push(`
        /* 挡板透明化：放行背景图（两模式） */
        ${SCOPE} [class*="GCOIK05hlYp7Wi3T9sYtdA"] {
          background: transparent !important;
        }
        /* 三块内容 → 圆角毛玻璃卡：立即创作 / 数据行 / 近期创作 */
        ${SCOPE} [class*="kNmdPLt9xoCrWkFM6hyi-w"],
        ${SCOPE} [class*="hVIgRAZ1M7KZMk9s24Uugg"],
        ${SCOPE} [class*="_0ER5qM3uiStAQyESanSf+Q"] {
          background: ${dark ? "rgba(31, 31, 25, 0.7)" : "rgba(255, 255, 255, 0.62)"} !important;
          backdrop-filter: blur(16px) saturate(${dark ? "140" : "160"}%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(${dark ? "140" : "160"}%) !important;
          border-radius: ${fr} !important;
          box-sizing: border-box !important;
        }
        /* 侧栏整列 → 圆角毛玻璃（两模式，含"创作者中心"标题和菜单）。
           特异性必须压过 buildCSS 780 行"搜索查看更多页"透明化规则
           （box-web/page-web 框架类名相同会误命中侧栏，(1,5,2)）和
           8611 行导航栏玻璃 (1,4,2)——故用同构选择器 + 尾部哈希类，
           (1,6,2) 稳赢 */
        ${SCOPE} [class*="box-web"] [class*="page-web"] > div:first-child > div:first-child[class*="Pa+-GkpdlzH-TTBCea3AMQ"] {
          background: ${dark ? "rgba(31, 31, 25, 0.7)" : "rgba(255, 255, 255, 0.62)"} !important;
          backdrop-filter: blur(16px) saturate(${dark ? "140" : "160"}%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(${dark ? "140" : "160"}%) !important;
          border-radius: ${fr} !important;
          box-sizing: border-box !important;
        }
        /* 侧栏选中项：半透明主题色胶囊底 + 图标跟随主题色
           （清掉站点 rgba(73,183,186,0.05) 底和写死的青绿图标色） */
        ${SCOPE} li[class*="_6xk+YMROSlYK2P366Q8kOw"] [class*="lgj+mQbgoNKOlQuhg7dh4w"] {
          background: ${A}1F !important;
          border-radius: 8px !important;
        }
        ${SCOPE} li[class*="_6xk+YMROSlYK2P366Q8kOw"] [class*="lgj+mQbgoNKOlQuhg7dh4w"] svg {
          color: ${A} !important;
        }
        /* 作品情况子卡（近期创作列表项）：圆角两模式，暗色加浅玻璃底 */
        ${SCOPE} [class*="n4gBOgNweqbzcqWlJgENCg"] {
          border-radius: calc(${fr} * 0.6) !important;
        }
        ${dark ? `
        /* 暗色：作品子卡浅玻璃底 + 封面缩略块 */
        ${SCOPE} [class*="n4gBOgNweqbzcqWlJgENCg"] {
          background: rgba(255, 255, 255, 0.07) !important;
        }
        ${SCOPE} [class*="smHVlQVYcgVNRAQErfDmnA"] {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        /* 暗色：作品缩略图外层 <a>——白底 rgb(245,245,245) 画在这一层
           （探针实证，内层暗玻璃已生效）。站点规则无 !important，
           这条必赢；JS 内联透明化在该页时序不可靠，CSS 兜底 */
        ${SCOPE} [class*="_9cZmEJaV-ySSFD4tbawePA"] {
          background: transparent !important;
        }
        /* 暗色：选中项文字、侧栏标题提亮（其余页面文字由
           lcFixCreatorCenter 按计算色 JS 提亮，CSS 无法按颜色选择） */
        ${SCOPE} li[class*="_6xk+YMROSlYK2P366Q8kOw"] [class*="lgj+mQbgoNKOlQuhg7dh4w"] a {
          color: #d9d9d9 !important;
        }
        ${SCOPE} [class*="YGW+Dr7SHXmAXuI8R4OSSA"] {
          color: #d9d9d9 !important;
        }
        /* 暗色：两个栏目的标签文字提亮（栏目标题/类型名/数据项/日期） */
        ${SCOPE} [class*="_1hNR9Zab73Rouu5HRyC+iQ"],
        ${SCOPE} [class*="b1eOFKWl1mXWjc0CmFo4xg"],
        ${SCOPE} [class*="iDKZyik0n6b66C3mEeastQ"],
        ${SCOPE} [class*="gRdfcFoEGDkZ6UEOWJyStw"] {
          color: #d9d9d9 !important;
        }
        ${SCOPE} [class*="YIKCQsLT7aldM0het09U3A"],
        ${SCOPE} [class*="Dod9xpDz29jdJf9cJEfPxw"] {
          color: #a5a5a5 !important;
        }
        /* 暗色：作品子卡内文字（指标 li/数值/日期/封面标题） */
        ${SCOPE} [class*="wpUpQpOumMqULz4Evl9PpQ"] li,
        ${SCOPE} [class*="r7TF-ya+vklNpO6LVct-0g"],
        ${SCOPE} [class*="R1QrisWIzZGBKm2HC-iRIw"],
        ${SCOPE} [class*="jQtG6lzt2nc24hrQWKsi0g"] {
          color: #d9d9d9 !important;
        }
        /* 暗色：总数据/昨日数据卡片深玻璃 + 标题/标签提亮 */
        ${SCOPE} [class*="k2e1nknIR7kmu-vX+WSu2g"] {
          background: rgba(31, 31, 25, 0.7) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          border-radius: ${fr} !important;
        }
        ${SCOPE} [class*="XiOD9NuU8-c5gdMEAv50AA"] {
          color: #d9d9d9 !important;
        }
        ${SCOPE} [class*="_56R-5wo7GOLpW4ldOEDMQw"] {
          color: #a5a5a5 !important;
        }
        /* 暗色：文章数据块标题/副标题/表头标签/行内文字（块容器毛玻璃
           由 JS 内联写——该块带有 inline transparent !important，CSS
           压不过 inline）；数值保持站点原色（青绿在暗底可读） */
        ${SCOPE} [class*="dqlZZDikle08k2iCiEYB9g"],
        ${SCOPE} [class*="riAx1cV-4FDM4HQwCGJFlA"],
        ${SCOPE} [class*="wE5QAriTuBj4pH7Z2GckgQ"] {
          color: #d9d9d9 !important;
        }
        ${SCOPE} [class*="N1PA8zTGPBt0yJ4bDLxJPQ"],
        ${SCOPE} [class*="LrBlpZw7ywA5VpoNPaLb9Q"],
        ${SCOPE} [class*="_6qxCA6rcBE28BRLUTazvhA"] {
          color: #a5a5a5 !important;
        }
        /* 暗色：文章数据表头条白底 → 暗色底；单篇文章行悬停 #fafafa → 浅玻璃 */
        ${SCOPE} [class*="z6HqZ2igTyT5UtMdSV1VvA"] {
          background: rgba(255, 255, 255, 0.05) !important;
          border-radius: ${fr} ${fr} 0 0 !important;
        }
        ${SCOPE} li[class*="_24pRaY5tJlQ9PgTMSz2zcA"] :hover {
          background: transparent !important;
        }
        ${SCOPE} li[class*="_24pRaY5tJlQ9PgTMSz2zcA"]:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }
        /* 暗色：侧栏悬停白底 → 半透明浅玻璃（排除选中项胶囊及其后代，
           避免盖掉主题色选中底） */
        ${SCOPE} li[class*="_6xk+YMROSlYK2P366Q8kOw"] :not([class*="lgj+mQbgoNKOlQuhg7dh4w"]):not([class*="lgj+mQbgoNKOlQuhg7dh4w"] *):hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
        }
        /* 暗色：活动中心卡片（li 本体 #fff 白卡，creator-cen 实证）
           → 深色玻璃 + fr 圆角 + 悬停轻微放大 */
        ${SCOPE} li[class*="PdfC3wCQbp2WSs9sweR6Pg=="] {
          background: rgba(255, 255, 255, 0.07) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          border-radius: ${fr} !important;
          transition: transform 0.25s ease !important;
        }
        ${SCOPE} li[class*="PdfC3wCQbp2WSs9sweR6Pg=="]:hover {
          transform: scale(1.02) !important;
        }` : ""}
      `);
    }
    if (isDarkMode()) {
      out.push(`
        /* 文章发布弹窗：编辑区 iframe 内边距归零 + 暗色背景（作用于主页面的 iframe 元素）。
           章节编辑页（连载发布文字页）的 iframe 站点自带垂直 padding（浅色 266px 高的来源），
           归零会导致暗色比浅色矮 66px，用 body:not(:has(...)) 排除该页；背景两页都要 */
        body:not(:has([class*="KrL5Oe6b4NCGc0rWTW54QQ"])) iframe[title="editor"] {
          padding: 0 !important;
        }
        iframe[title="editor"] {
          background: rgb(30, 30, 36) !important;
        }

        /* 工具栏图标：浅灰底+深色图标 → 反色为深灰底+浅色图标。
           章节编辑页的工具有专属暗色规则（直接改 fill/color），
           再反色会双重处理，排除 */
        svg:has(rect[fill="#EDEDED"]) {
          filter: invert(100%) hue-rotate(180deg) !important;
        }
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] svg:has(rect[fill="#EDEDED"]) {
          filter: none !important;
        }
        /* 首页发布弹窗（rc-dialog）工具栏图标也不参与反色：
           invert 会把悬停主题色 path 一起反成暗紫（"暗色主题色"
           的来源，浅色正常/暗色发暗即此因）。改直接覆盖：
           底方块 fill 变暗，图标 path 走 color 继承保持浅色，
           悬停即纯主题色 */
        .rc-dialog-content svg:has(rect[fill="#EDEDED"]) {
          filter: none !important;
        }
        .rc-dialog-content svg rect[fill="#EDEDED"] {
          fill: #2B2B25 !important;
        }

        /* "草稿已保存"：恢复原版青绿色 #14C4BC */
        div[class*="dl+rqIrnR1qGO7K68aqRXQ"] {
          color: #14C4BC !important;
          position: relative !important;
        }
        div[class*="dl+rqIrnR1qGO7K68aqRXQ"] span {
          color: #14C4BC !important;
        }
        div[class*="dl+rqIrnR1qGO7K68aqRXQ"] svg {
          color: #14C4BC !important;
          fill: #14C4BC !important;
        }

        /* 自定义 tooltip：悬停"草稿已保存"时显示黑底白字提示 */
        div[class*="dl+rqIrnR1qGO7K68aqRXQ"]:hover::after {
          content: "自动保存编辑中的内容";
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #1a1a1a;
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          white-space: nowrap;
          z-index: 99999;
          pointer-events: none;
        }
        /* tooltip 箭头 */
        div[class*="dl+rqIrnR1qGO7K68aqRXQ"]:hover::before {
          content: "";
          position: absolute;
          bottom: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: #1a1a1a;
          z-index: 99999;
          pointer-events: none;
        }

        /* ── 精品连载创建页（新版页面，不在反色区，直接写最终色）──
           类名全混淆，用稳定锚点：aside 的 aria-label + main 内
           "了解什么是精品连载"按钮的 aria-label */
        /* 左侧筛选栏 → 深灰卡片 */
        aside[aria-label="连载作品筛选"] {
          background: #1F1F19 !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35) !important;
        }
        /* 未选中筛选键：深灰（比卡片 #1F1F19 浅一档）。
           通用暗色按钮规则 #application.lofter-root-container button
           (#412948, 特异性 (1,0,1)) 会压过无 id 前缀的写法，必须带前缀 */
        #application.lofter-root-container aside[aria-label="连载作品筛选"] button {
          background: #2B2B25 !important;
          color: rgba(255, 255, 255, 0.75) !important;
          border-radius: 10px !important;
          transition: background 0.2s ease !important;
        }
        #application.lofter-root-container aside[aria-label="连载作品筛选"] button:hover {
          background: #36362F !important;
        }
        aside[aria-label="连载作品筛选"] button[aria-pressed="true"] {
          background: ${s.theme.accent || "#667eea"} !important;
          color: #fff !important;
        }
        #application.lofter-root-container aside[aria-label="连载作品筛选"] button[aria-pressed="true"],
        #application.lofter-root-container aside[aria-label="连载作品筛选"] button[aria-pressed="true"] span {
          color: #fff !important;
        }
        #application.lofter-root-container aside[aria-label="连载作品筛选"] button[aria-pressed="true"] {
          background: ${s.theme.accent || "#667eea"} !important;
          border-color: transparent !important;
        }

        /* 右侧创建面板 → 深灰卡片 + 浅色文字 */
        main:has(button[aria-label="了解什么是精品连载"]) {
          background: #1F1F19 !important;
          color: rgba(255, 255, 255, 0.9) !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35) !important;
        }
        /* 标签/标题/说明文字统一浅色。
           星号（必填标记 oI6L8ZzA）除外：它由站点自己的红色规则着色，
           排除后原色保留，避免被刷白 */
        main:has(button[aria-label="了解什么是精品连载"]) span:not([class*="oI6L8ZzA3hhGJbZsEK"]),
        main:has(button[aria-label="了解什么是精品连载"]) h2,
        main:has(button[aria-label="了解什么是精品连载"]) label {
          color: rgba(255, 255, 255, 0.88) !important;
        }
        /* 封面选择区：站点自带 nw-dark-preserve 保留区，缩略图是浅色底，
           文字恢复深色（覆盖上面的浅色规则） */
        main:has(button[aria-label="了解什么是精品连载"]) .nw-dark-preserve span {
          color: rgb(46, 46, 46) !important;
        }
        /* 顶部"了解什么是精品连载"小按钮：暗底浅字胶囊 */
        main:has(button[aria-label="了解什么是精品连载"]) button[aria-label="了解什么是精品连载"] {
          background: rgba(255, 255, 255, 0.10) !important;
          color: rgba(255, 255, 255, 0.8) !important;
        }
        /* 顶部返回箭头：通用暗色按钮规则给它画了 #412948 底，去除；
           箭头 stroke=currentColor 跟随 color 改浅色 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) button[aria-label="返回"] {
          background: transparent !important;
          color: rgba(255, 255, 255, 0.8) !important;
        }
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) button[aria-label="返回"]:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        /* 连载名称清除叉号：同样被通用按钮规则画了 #412948 底，去除；
           叉号 path fill="#2E2E2E"（深灰近黑）改白色；
           注意登录页规则 [class*="SQQNd..."] * 的 color 不影响 path fill */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) button[class*="MFSROmD3aZLZzWgQZekZyQ"] {
          background: transparent !important;
        }
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) button[class*="MFSROmD3aZLZzWgQZekZyQ"] svg path {
          fill: #fff !important;
        }
        /* 封面缩略图内文字（"书本名称"）：封面默认都是浅色底，站点用内联
           样式写了深色 rgb(46,46,46)，但被上方 boxGray 兜底白字规则
           ((1,0,1)) 刷白 —— 这里以更高特异性还原深色 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="OK0wB90PycynwzeBRzgtuw"] div,
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="OK0wB90PycynwzeBRzgtuw"] span {
          color: rgb(46, 46, 46) !important;
        }
        /* 输入框 / 文本域：暗底浅字。
           登录页"浅色/深色通用"块给 [class*="jlUi+e..."]:focus-within input
           写了 border-color: accent(#dfc7e6 亮紫≈白) + 3px 外发光
           ((1,0,2)，压过无前缀写法) —— 连载名称输入框恰好共用该哈希，
           这里带 id 前缀 (1,2,3) 夺回：边框调暗、去外发光 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) input[type="text"],
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) input:not([type]),
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) textarea {
          background: rgba(255, 255, 255, 0.08) !important;
          color: rgba(255, 255, 255, 0.92) !important;
          border: 1px solid rgba(255, 255, 255, 0.22) !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        /* 包裹 div 默认边框：站点写死 border: 1px solid #ededed（偏亮），
           压暗为与输入框一致的灰。连载名称(jlUi+e)/连载简介(_4AGL)/
           相关标签(_1ZZX) 三个包裹层一起处理 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="jlUi+e-AdGwdG0RfaFATVQ"],
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="_4AGLvCJ5EVKS6uvf5zL2Jw"],
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="_1ZZXFWOZzldLQBGPHXkBzQ"] {
          border-color: rgba(255, 255, 255, 0.22) !important;
        }
        /* 连载简介/相关标签包裹层：站点写死 background #fff（暗色下是刺眼
           白块），透明化让内层输入框/文本域的暗底透出 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="_4AGLvCJ5EVKS6uvf5zL2Jw"],
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="_1ZZXFWOZzldLQBGPHXkBzQ"] {
          background: transparent !important;
        }
        /* 相关标签的占位提示（label 模拟 placeholder）：压暗到 placeholder
           级灰度，否则会像已输入的文字；站点还给这个 label 画了自带背景
           （浅色下与白底融合看不出，暗色下是一个约 280px 的短灰块，
           而 input 本体已是通宽）——背景透明化，灰底由 input 自己提供 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) label[class*="poigpEhIX6C0q91RrReEAw"] {
          color: rgba(255, 255, 255, 0.38) !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        /* 相关标签灰底统一方案：elementsFromPoint 逐层排查确认短灰块
           没有对应的实体元素（input 本体已通宽），放弃继续追凶——
           改为把整个标签容器刷成与输入框相同的暗灰，input 自身透明：
           无论 tag 怎么排、input 多宽，整个框永远是均匀的通宽灰底 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) [class*="_0sxoVX2N6l6R2AmaHZ2GeA"] {
          background: rgba(255, 255, 255, 0.08) !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          padding: 4px !important;
        }
        /* input 退为纯文字层：透明底无边框，灰底由上面的容器统一提供 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) input[class*="eZRKWbI-FqEUuXT2kBglMA"] {
          flex: 0 0 100% !important;
          width: 100% !important;
          min-width: 0 !important;
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
        }
        /* 已添加的 tag 徽章：站点写死白底，暗色下白底白字看不清，
           改深灰底浅字（与筛选栏未选中键同色） */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) span[class*="c8hkdTP5qAhv6Dhtu3ruYA"] {
          background: #2B2B25 !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        /* ===== 连载作品管理页（manage.e028）暗色 ===== */
        /* 右侧管理面板主卡片：站点写死 #fff → #1F1F19 深灰卡 */
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] {
          background: rgb(31, 31, 25) !important;
        }
        /* 面板文字统一浅色（标题/说明/连载名/标签行/日期） */
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] h1,
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] p,
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] span,
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] div {
          color: rgba(255, 255, 255, 0.88) !important;
        }
        /* 空状态"创建连载"键：主题色底（通用暗色按钮规则会染成 #412948，夺回） */
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] button[class*="l8wGBlACyy3nd3eBHk6WiQ"] {
          background: ${s.theme.accent || "#667eea"} !important;
          background-image: none !important;
          color: #fff !important;
          border: none !important;
        }
        /* 右上角"创建连载"：透明底 + 主题色边框和文字 */
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] button[class*="v2+OSY8pxUSIqCP9qRUVUw"] {
          background: transparent !important;
          background-image: none !important;
          color: ${s.theme.accent || "#667eea"} !important;
          border: 1px solid ${s.theme.accent || "#667eea"} !important;
        }
        /* "章节管理"（无 eurwS 修饰）：比卡片 #2B2B25 深一档的灰底白字
           （同色会融进卡片看不出是按键） */
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] button[class*="_7JA6leoHltWgSxKG3maq4w"]:not([class*="eurwS-3Ul"]) {
          background: #22221D !important;
          background-image: none !important;
          color: rgba(255, 255, 255, 0.9) !important;
          border: none !important;
        }
        /* "编辑连载"（eurwS 修饰）：主题色底 + 纯白文字（深灰 217 在彩底上不清晰） */
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] button[class*="_7JA6leoHltWgSxKG3maq4w"][class*="eurwS-3Ul-a4VcnLVRUNCQ"] {
          background: ${s.theme.accent || "#667eea"} !important;
          background-image: none !important;
          color: #fff !important;
          border: 1px solid ${s.theme.accent || "#667eea"} !important;
        }
        /* 管理页连载作品卡片（站点 #fafafa）：深灰卡（比面板 #1F1F19
           浅一档区分层级）；卡内文字已被上面的统一浅色规则覆盖 */
        #application.lofter-root-container main[class*="IHdchkcjQ8s8u7rxAPOb4w"] [class*="qspuMjOfeWU56XgmAIPvjQ"] {
          background: #2B2B25 !important;
        }
        /* ===== 章节管理页（chapters.fc）卡片 ===== */
        /* 主卡片：站点写死 #fff → #1F1F19 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] {
          background: rgb(31, 31, 25) !important;
        }
        /* 标题/说明等文字浅色（h2/p 不在 boxGray 兜底的 span/div/label 范围内） */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] h2,
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] p {
          color: rgba(255, 255, 255, 0.88) !important;
        }
        /* 卡片头部（返回键/标题/标签行所在）：站点自带白底，透明化透出 #1F1F19 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] header[class*="_3OY4kxVWUAjq-2Auh3kJTw"] {
          background: transparent !important;
        }
        /* 章节类型/文章状态筛选下拉键：暗底浅字 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] button[class*="E2Dmsr0Y7AYWr1Z3r7Onyw"] {
          background: #2B2B25 !important;
          background-image: none !important;
          color: rgba(255, 255, 255, 0.85) !important;
          border: none !important;
        }
        /* 下拉筛选键（chapters.fc_a09b2，2026-09 新哈希 mYE4Q6…，
            上面 E2Dmsr 旧规则已因站点更新哈希落空）：白底 → 暗底浅字。
            展开的选项列表（待审核/审核中…）同用该类，一并覆盖 */
        #application.lofter-root-container button[class*="mYE4Q6nEKlrZElDM0nX3WQ"] {
          background: #2B2B25 !important;
          background-image: none !important;
          color: rgba(255, 255, 255, 0.85) !important;
          border: none !important;
        }
        /* 下拉容器（KyMHhQ…，站点写死 #fff + padding:4px 0）：
            按钮压暗后四周露出白边，容器一并压暗（阴影同步改暗色投影） */
        #application.lofter-root-container div[class*="KyMHhQGb7xN80Xn0GFvQjA"] {
          background: #2B2B25 !important;
          background-image: none !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
        }
        #application.lofter-root-container button[class*="mYE4Q6nEKlrZElDM0nX3WQ"]:hover {
          background: #35352d !important;
        }
        /* 选中态（qfI0G…，站点青绿加粗字）：暗底上不用主题色。
            必须写不透明色——半透明白会透出容器的白底变成白胶囊 */
        #application.lofter-root-container button[class*="qfI0GDy6JppnRoNYjHHIfQ"] {
          background: #3d3d34 !important;
          background-image: none !important;
          color: rgba(255, 255, 255, 0.95) !important;
          border: none !important;
        }
        /* 表头行（章节序号/章节名称…）：压暗一档与正文区分 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] [class*="dlX8Vg8BUlSbc6AuP8-l8w"],
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] [class*="dlX8Vg8BUlSbc6AuP8-l8w"] > div {
          color: rgba(255, 255, 255, 0.55) !important;
        }
        /* 返回按钮：透明底 + 浅色箭头（stroke=currentColor 跟随 color） */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] button[class*="ycgHPgtczsD0EwyJVEh3Fg"] {
          background: transparent !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        /* 空状态"更新章节"键：主题色底（与创建/编辑键同款） */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] button[class*="gaMFcFLrz8MzQMjWztEkNg"] {
          background: ${s.theme.accent || "#667eea"} !important;
          background-image: none !important;
          color: #fff !important;
          border: none !important;
        }
        /* "审核中/仅自己可见"状态徽章：站点本身是橙字浅橙底（#ff7614/#fff1e5），
           被 boxGray 白字规则刷掉，原样保留橙系。⚠️ boxGray 的 span 规则
           与本规则特异性同为 (1,3,1) 且声明更晚而险胜，追加第二个哈希类
           抬到 (1,4,1) 稳赢 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] span[class*="iMYLV+r7dp1r4frbfD"][class*="tctZLM5qRWtZJh4OX1pa"] {
          background: #fff1e5 !important;
          color: #ff7614 !important;
        }
        /* "推荐操作-更多"触发键：与"发布章节"同款——暗色主题色底 + 主题色文字 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] button[class*="GF95OWvkh+6f26hQB49HSA"] {
          background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
          background-image: none !important;
          color: ${s.theme.accent || "#667eea"} !important;
          border: none !important;
        }
        /* "更多"下拉面板（站点 #fff + 投影）：深灰卡 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] [class*="TF5x4v8+cZB-I9nPqocLXA"] {
          background: #2B2B25 !important;
        }
        /* 面板内"编辑修改/删除本章"：透明底浅字（通用按钮规则染了 #412948） */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] button[class*="OycMUiw6b4CnrxWpeGSYeg"] {
          background: transparent !important;
          background-image: none !important;
          color: rgba(255, 255, 255, 0.88) !important;
          border: none !important;
        }
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] button[class*="OycMUiw6b4CnrxWpeGSYeg"]:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        /* 右上角"更新章节"键（rTJCL2fe，站点 #14c4bc）：主题色底 + 纯白文字 */
        #application.lofter-root-container [class*="IMB19qOdgHJHb5wAvQfSRw"] button[class*="rTJCL2feQxu8OAlsa5nUCw"] {
          background: ${s.theme.accent || "#667eea"} !important;
          background-image: none !important;
          color: #fff !important;
          border: none !important;
        }
        /* ===== 章节编辑页（发布文字页）===== */
        /* 暗色半透明卡片底（原为透明）：与写作页 #alert-tip 弹窗同款色调；
            内容贴边，加内边距放大一圈（与浅色一致）。
            ⚠️ 同浅色：不能加 backdrop-filter，否则展开编辑器这个卡片内
            的 position:fixed 层会被关进卡片（见浅色块注释）；
            透明度提到 0.94 补偿没有模糊后的透底 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] {
          background: rgba(31, 31, 25, 0.94) !important;
          border-radius: 16px !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35) !important;
          box-sizing: border-box !important;
          padding: 12px 28px 20px !important;
        }
        /* 展开编辑器（Ub0N956L，卡片内 position:fixed 贴满视口）：
            暗色整块不透明 #1F1F19 盖底——对齐浅色"完全遮住页面、
            只剩标题 + 输入框"的专注视图（原来只靠卡片 0.94 半透明底，
            展开时后面页面会透出来）。未展开时该元素是编辑器包裹层，
            同为深色不突兀 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="Ub0N956L-f4qc9aVSghnZA"] {
          background: #1F1F19 !important;
        }
        /* 展开层内的标题输入框：站点深字在暗底上看不清，改浅色 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="Ub0N956L-f4qc9aVSghnZA"] input,
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="Ub0N956L-f4qc9aVSghnZA"] textarea {
          color: rgba(255, 255, 255, 0.9) !important;
        }
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="Ub0N956L-f4qc9aVSghnZA"] input::placeholder,
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="Ub0N956L-f4qc9aVSghnZA"] textarea::placeholder {
          color: rgba(255, 255, 255, 0.38) !important;
        }
        /* 展开/收起输入区按键（右上角 Ea66w 图标）：主题色 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] svg[class*="Ea66w-pusaVoA3BJnxdUdg"] {
          color: ${s.theme.accent || "#667eea"} !important;
        }
        /* 工具栏各按键悬停：站点写死 #14c4bc 青绿 → 跟随主题色 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="EloVc4T0IWvY9gSQCQ88cA"] div:hover,
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] [class*="EloVc4T0IWvY9gSQCQ88cA"] svg:hover {
          color: ${s.theme.accent || "#667eea"} !important;
        }
        /* 卡内超链接（@提及 caret-node 等）：跟随主题色 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] a {
          color: ${s.theme.accent || "#667eea"} !important;
        }
        /* ===== 帮助与反馈页（customer-service）暗色 ===== */
        /* 圆角毛玻璃大容器底：深色半透明 + 模糊（压住花背景图）。
            双属性选择器同浅色侧：特异性 (1,3,1) 压过 box-web 透明链 */
        #application.lofter-root-container div[class*="iYtrszmUYaccvUMmBbXQiw"][class*="iYtrszm"] {
          background: rgba(31, 31, 25, 0.82) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          border-radius: 16px !important;
        }
        /* 右侧快捷入口栏（账号换绑/达人认证/网络诊断/违规查询/更新APP，
           站点写死白底）→ 深灰底，标题浅字 */
        #application.lofter-root-container div[class*="style-16_8002-box-web"],
        #application.lofter-root-container div[class*="style-15_8942-box-web"] {
          background: #2B2B25 !important;
          border-radius: 10px !important;
        }
        #application.lofter-root-container div[class*="style-15_8942-title-web"] {
          color: rgba(255, 255, 255, 0.85) !important;
        }
        /* 页头"帮助与反馈"标题：站点深字 → 浅字 */
        #application.lofter-root-container header[class*="VagZScZIvyjDvGl7I8ODnA"] {
          color: rgba(255, 255, 255, 0.92) !important;
        }
        /* 底部法律条款区（网络敲诈承诺书/服务协议/隐私政策/客服电话…）：
           站点写死 #f3f3f3 浅灰底（暗色下即"白底"块）→ 半透明深底压暗，
           文字/链接浅色（p/header 不在通用暗色兜底范围内） */
        #application.lofter-root-container section[class*="+LBiH6zDGCnDTqQNlWYQgw"] {
          background: rgba(31, 31, 25, 0.6) !important;
          border-radius: 12px !important;
        }
        #application.lofter-root-container section[class*="+LBiH6zDGCnDTqQNlWYQgw"] p,
        #application.lofter-root-container section[class*="+LBiH6zDGCnDTqQNlWYQgw"] a {
          color: rgba(255, 255, 255, 0.75) !important;
        }
        /* 底部"建议提交"键：通用暗色按钮规则染了 #412948 底，
           夺回为主题色（与更新章节键同款观感：主题色底 + 深色字） */
        #application.lofter-root-container button[class*="wLAfZYIIIoOFnXjUNT-LnA"] {
          background: ${s.theme.accent || "#667eea"} !important;
          background-image: none !important;
          color: #333 !important;
          border: none !important;
        }
        /* ===== 客服中心子路由暗色 ===== */
        /* 站点垫底白纱（fixed 层 rgba(255,255,255,0.35)）→ 深色纱
           （dump 实证该层哈希 DugzYOgBruT7A5P0，fixed 定位垫在内容下） */
        #application.lofter-root-container div[class*="DugzYOgBruT7A5P0zeEdlQ"] {
          background: rgba(18, 18, 14, 0.55) !important;
        }
        /* 内容页容器：暗色毛玻璃卡底 + 正文浅字（选择器与浅色侧一致，
           暗色块在后靠位置覆盖底色；:not 排除帮助主页同浅色侧；
           :not(:has(countBox-web)) 排除查看更多页——该路由右侧栏
           有自己的玻璃卡（style-16_435 内联），再包一层卡=多出一块
           底（用户实证），排除后由 779/5438 行的"查看更多页保持
           透明"旧规则接管 */
        #application.lofter-root-container > div[class*="-box-web"][class*="box-web"] div[class*="page-web"][class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])):not(:has([class*="countBox-web"])) > div > div {
          background: rgba(31, 31, 25, 0.86) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        /* 卡内文字统一提亮：仅 h1-h6/p/li/td/th/label 不够——表单标签、
           说明文字多为 span/div 装载（用户实测 feedback/question 页
           文字偏暗）。扩充到全部文本载体；a 不在列表内（链接走下方
           主题色规则）。⚠️ 站点红色必填星号若也被扫白，把星号元素
           的 class 贴来加 :not() 排除 */
        #application.lofter-root-container > div[class*="-box-web"] div[class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])) > div > div :is(div, span, p, li, td, th, label, dt, dd, h1, h2, h3, h4, h5, h6, strong, b, em, i, small):not([class*="_0FmxpBgs44j-eALsY"]):not([class*="-count-web"]):not([class*="-listItemHot-web"]) {
          color: rgba(255, 255, 255, 0.88) !important;
        }
        /* 必填星号恢复红色（浅字规则排除 + 显式红保底） */
        #application.lofter-root-container span[class*="_0FmxpBgs44j-eALsY"] {
          color: #e64545 !important;
        }
        /* 卡内链接：跟随主题色 */
        #application.lofter-root-container > div[class*="-box-web"] div[class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])) > div > div a {
          color: ${s.theme.accent || "#667eea"} !important;
        }
        /* 卡内输入框/文本域：暗色补边框（style-21_4005 等路由哈希
           不同，直接按元素类型通配）+ 深底浅字 */
        #application.lofter-root-container > div[class*="-box-web"] div[class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])) > div > div input,
        #application.lofter-root-container > div[class*="-box-web"] div[class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])) > div > div textarea {
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.18) !important;
          border-radius: 8px !important;
          color: rgba(255, 255, 255, 0.9) !important;
        }
        #application.lofter-root-container > div[class*="-box-web"] div[class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])) > div > div input::placeholder,
        #application.lofter-root-container > div[class*="-box-web"] div[class*="page-web"]:not(:has([class*="iYtrszmUYaccvUMmBbXQiw"])) > div > div textarea::placeholder {
          color: rgba(255, 255, 255, 0.4) !important;
        }
        /* 下拉选项面板：站点 hover #eeeeee 白底 + 我方浅字 → 白底白字。
           面板整体改暗色。⚠️ 只碰 optionsBox/optionsFullBox（弹层盒子），
           optionsFullOverlay 是全屏透明点击捕获层，不能上底色 */
        #application.lofter-root-container div[class*="optionsBox-web"],
        #application.lofter-root-container div[class*="optionsFullBox-web"] {
          background: #2B2B25 !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 10px !important;
        }
        #application.lofter-root-container div[class*="optionItem-web"] {
          background: transparent !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        #application.lofter-root-container div[class*="optionItem-web"]:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        /* 政策文档老页（privacyPolicy / ServiceAgreement 等 CMS 页，
           无 #application，内容在 body>.box）：老页无反色管线，
           暗色直接画深毛玻璃卡 + 全文浅字 + 链接主题色 */
        body > .box:not(.postwrapper):not(.wid700) {
          background: rgba(31, 31, 25, 0.86) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          border-radius: 16px !important;
          color: rgba(255, 255, 255, 0.78) !important;
        }
        body > .box:not(.postwrapper):not(.wid700) :is(h1, h2, h3, h4, h5, h6, p, li, td, th, dt, dd, span, div, em, i, small) {
          color: rgba(255, 255, 255, 0.78) !important;
        }
        /* 标题和加粗正文略亮一档，保持层级感 */
        body > .box:not(.postwrapper):not(.wid700) :is(h1, h2, h3, h4, h5, h6, strong, b) {
          color: rgba(255, 255, 255, 0.88) !important;
        }
        /* 白色边框和分割线压暗（政策页 hr/表格线等） */
        body > .box:not(.postwrapper):not(.wid700) :is(hr, div, p, li, td, th, tr, table, span) {
          border-color: rgba(255, 255, 255, 0.14) !important;
        }
        body > .box:not(.postwrapper):not(.wid700) hr {
          background: rgba(255, 255, 255, 0.14) !important;
          border: none !important;
        }
        /* ===== 帮助与反馈入口的功能页暗色 ===== */
        /* 网络诊断页：两组 weui 卡片深毛玻璃 + 标题/分组名/条目浅字
           （选择器去 .react-weui-page 前缀，同浅色块） */
        .weui-cells {
          background: rgba(31, 31, 25, 0.86) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          border-radius: 16px !important;
        }
        /* h1 用 styled-jsx 哈希类（用户复制文本 jsx-747282405），
           react-weui-page 根类在该页不存在所以旧规则落空 */
        h1[class*="747282405"],
        .weui-cells__title,
        .weui-cell {
          color: rgba(255, 255, 255, 0.88) !important;
        }
        /* 违规查询页：结果卡深毛玻璃 + 文字浅色 + 分割线压暗 +
           复制/社区规范链接主题色（申请解屏键保持站点原色） */
        #application.lofter-root-container div[class*="-violation-web"] li[class*="-item-web"] {
          background: rgba(31, 31, 25, 0.86) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        #application.lofter-root-container div[class*="-violation-web"] li[class*="-item-web"] :is(p, label, span) {
          color: rgba(255, 255, 255, 0.82) !important;
        }
        #application.lofter-root-container div[class*="-violation-web"] li[class*="-item-web"] div[class*="-horizontal-web"] {
          background: rgba(255, 255, 255, 0.12) !important;
        }
        #application.lofter-root-container div[class*="-violation-web"] li[class*="-item-web"] a[class*="-copy-web"],
        #application.lofter-root-container div[class*="-violation-web"] li[class*="-item-web"] a[class*="-link-web"] {
          color: ${s.theme.accent || "#667eea"} !important;
        }
        /* 诊断实证：结果区还有个 absolute 定位的 #e6e6e6 灰底
           span（类 pX+HZHBTcxezWpzTXTL34Q==，挂 style-14_7889 子路由
           内、固定白纱层之下），暗色透明化露出深卡与背景 */
        #application.lofter-root-container span[class*="pX+HZHBTcxezWpzTXTL34Q"] {
          background: transparent !important;
        }
        /* 更新APP页提示行：深卡（更透）+ 浅字 + 宽度按内容收缩 */
        .info {
          background: rgba(31, 31, 25, 0.7) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          border-radius: 16px !important;
          color: rgba(255, 255, 255, 0.85) !important;
          width: fit-content !important;
          max-width: 92% !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        /* 达人认证页：暗色下 #application 容器若被站点画了浅色实底
           （遮住自定义背景图的"整块遮罩"嫌疑层），先透明化放行；
           部分页面 #application 可能不带 lofter-root-container 类，
           补无类名兜底（暗色下 #application 透明全站安全：
           内容均有各自底色，透明只会露出插件背景层）。
           若遮罩在更内层/祖先层，需用户跑诊断脚本取真实类名再补 */
        #application.lofter-root-container,
        #application {
          background: transparent !important;
        }
        /* 诊断实证：遮住背景图的是个无 id 无 class 的裸 DIV
          （bg #e6e6e6 直角，不在 #application 祖先链上）——只能按
           "body / #application 直子层的裸 div"结构盲打透明化。
           暗色下裸 div 本就不该有自绘浅底，透明化全站安全；
           若仍未命中（如挂在 portal/更深层），需父链诊断再补 */
        body > div:not([class]):not([id]):not([data-lc-dialogue]),
        #application > div:not([class]):not([id]) {
          background: transparent !important;
        }
        body > .box:not(.postwrapper):not(.wid700) a {
          color: ${s.theme.accent || "#667eea"} !important;
        }
        /* 页脚链接区（style-1_1582，服务协议/隐私政策/客服中心等横排链接）：
           暗色下提浅 */
        #application.lofter-root-container div[class*="style-1_1582"] a,
        #application.lofter-root-container div[class*="style-1_1582"] span {
          color: rgba(255, 255, 255, 0.7) !important;
        }
        /* ===== 帮助中心旧页暗色 ===== */
        /* 卡底改深色毛玻璃 + 正文/标题浅字（老页无反色管线兜底，
           #444 深字在暗卡上看不清）；链接给主题色 */
        .helpCenterArea .g-mn .g-box3,
        .helpCenterArea .g-mn .g-box2,
        .helpCenterArea .g-sd .g-box2 {
          background: rgba(31, 31, 25, 0.86) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        .helpCenterArea :is(h1, h2, h3, h4, p, li, td, th) {
          color: rgba(255, 255, 255, 0.88) !important;
        }
        .helpCenterArea a {
          color: ${s.theme.accent || "#667eea"} !important;
        }
        /* 页内标题/章节信息/连载名：站点深字在暗卡上看不清，改浅色 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] h3[class*="Dd2iZnss5gotQlglk0"],
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] div[class*="zm0YT3emMFas"],
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] div[class*="b4MjvEt3MZe27ipr31"] {
          color: rgba(255, 255, 255, 0.9) !important;
        }
        /* 个人昵称胶囊（站点 #f2f2f2 底深字）：暗底白字 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] div[class*="QM1qOYuPyI9kDaA6BMaBWg"] {
          background: #2B2B25 !important;
        }
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] h5[class*="QgWzOk4LtEzrlsd"] {
          color: rgba(255, 255, 255, 0.92) !important;
        }
        /* 工具栏：深色底；图标 svg 内写死的浅色方块（rect fill="#EDEDED"）
           用 CSS 覆盖为暗色，图标路径是 currentColor 跟随 color 变浅 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] div[class*="EloVc4T0IWvY9gSQCQ88cA"] {
          background: #2B2B25 !important;
          border-radius: 10px !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] div[class*="EloVc4T0IWvY9gSQCQ88cA"] svg rect[fill="#EDEDED"] {
          fill: #2B2B25 !important;
        }
        /* 右上角"存为草稿"键：往左下移，不贴卡片边缘 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] button[class*="w0QlRuNB1+cwpNnUhw"] {
          margin: 10px 10px 0 0 !important;
        }
        /* "草稿已保存"胶囊（站点浅绿底）：暗色下改深灰底浅字 */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] div[class*="GaAFASioYmN-a5Rn6LZpVg"] {
          background: #2B2B25 !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] svg[class*="RjFsrAd0qHoFSmRGvVi0uA"] {
          color: rgba(255, 255, 255, 0.85) !important;
        }
        /* "添加相关标签"展开的推荐标签面板：站点 JS 给根节点
           (oBRUDBRx) 写了内联 background:transparent !important，
           CSS 压不过内联 !important，所以底色画在面板内层
           (iw-dGhwl) 上。tag 条目 (fpZ2fR9E) 原为白底灰字，
           改暗色底 + 浅字。不带 #application 前缀（面板可能
           portal 挂载），靠页面专属哈希类 + !important 命中 */
        div[class*="iw-dGhwldkzcJWksV4WM5g"] {
          background: #2B2B25 !important;
          border-radius: 10px !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35) !important;
        }
        div[class*="fpZ2fR9EeEMqagn5fU4eaA"] {
          background: rgba(255, 255, 255, 0.08) !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        /* "添加相关标签"输入框容器 (kPRRu) 与"创作声明"按键
           (ShAqHqk)：站点写死 border #ededed 亮边框，暗色下压暗 */
        div[class*="kPRRu+fPejROH-ghTS7Pkw"],
        div[class*="ShAqHqkmTMGJs-nx92pVuQ"] {
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        /* "调试/本章为试读章节"区块容器 (vThrRzR0)：站点 #ededed
           亮边框压暗到与相邻条目同档；容器底色清透明——避免区块
           底比卡片底更暗、整行像一块突兀的暗色补丁 */
        div[class*="vThrRzR0hZC9M+i0ZpwVIQ"] {
          border-color: rgba(255, 255, 255, 0.12) !important;
          background: transparent !important;
        }
        main:has(button[aria-label="了解什么是精品连载"]) input::placeholder,
        main:has(button[aria-label="了解什么是精品连载"]) textarea::placeholder {
          color: rgba(255, 255, 255, 0.38) !important;
        }
        /* 底部按钮：登录页共享基类规则 (1,1,1)!important 会误伤本页，
           这里带 id 前缀 + 类名区分取消/确认（特异性 (1,3,x) 压回） */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) button[class*="_1mrgXFoxS9cWLEWPvB1KCw"] {
          background: rgba(255, 255, 255, 0.08) !important;
          background-image: none !important;
          color: rgba(255, 255, 255, 0.85) !important;
          border: none !important;
          border-radius: 999px !important;
          filter: none !important;
        }
        /* 可用态确认键：跟随主题色 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) button[class*="IWKkWSqHHfy16K39b0EUJQ"]:not([disabled]) {
          background: ${s.theme.accent || "#667eea"} !important;
          background-image: none !important;
          color: #333 !important;
          border: none !important;
          border-radius: 999px !important;
          filter: none !important;
        }
        /* 禁用态确认键：压暗 */
        #application.lofter-root-container main:has(button[aria-label="了解什么是精品连载"]) button[class*="IWKkWSqHHfy16K39b0EUJQ"][disabled] {
          background: rgba(255, 255, 255, 0.06) !important;
          background-image: none !important;
          color: rgba(255, 255, 255, 0.3) !important;
          border: none !important;
          border-radius: 999px !important;
          filter: none !important;
        }
      `);
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

    /* 新版页面：导航栏 — 强制清除所有层级背景 */
    if (
      (s.navbar.transparent || s.navbar.blur) &&
      s.background.mode !== "off"
    ) {
      out.push(`
        /* 清除导航栏外层所有层级的背景 */
        #application.lofter-root-container [class*="box-web"],
        #application.lofter-root-container [class*="box-web"] > div,
        #application.lofter-root-container [class*="box-web"] > div > div {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
        }
        
        /* 导航栏实际容器（第3层 div）— 毛玻璃效果，与首页统一 */
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child {
          background: rgba(255, 255, 255, 0.35) !important;
          background-image: none !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border-bottom: none !important;
          box-shadow: none !important;
        }
        
        /* 导航栏内部包裹层也透明 */
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child > div,
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child > div > div {
          background: transparent !important;
          background-color: transparent !important;
        }
        
        /* 导航栏文字 */
        #application.lofter-root-container [class*="box-web"] a {
          color: rgba(0, 0, 0, 0.75) !important;
          transition: color 0.2s ease !important;
        }
        
/* 导航栏搜索框 — 用伪元素画白色胶囊 */
#application.lofter-root-container [class*="box-web"] [role="button"] {
  position: relative !important;
}
#application.lofter-root-container [class*="box-web"] [role="button"]::before {
  content: "" !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(255, 255, 255, 0.9) !important;
  border-radius: 20px !important;
  z-index: -1 !important;
  pointer-events: none !important;
}

/* 导航栏搜索框外层容器 — 去灰框 */
#application.lofter-root-container [class*="box-web"] [role="button"] {
  background: transparent !important;                /* 外层透明 */
  border: none !important;                           /* 去掉灰色边框 */
  outline: none !important;
  box-shadow: none !important;
}
        
        /* 导航栏图标 — 只影响导航栏内的图标，不影响页面内容 */
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg path[fill="currentColor"],
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg path {
          fill: rgba(0, 0, 0, 0.6) !important;
          transition: fill 0.2s ease !important;
        }
        
        /* 导航栏图标悬停变主题色 */
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child a:hover svg path[fill="currentColor"],
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child a:hover svg path,
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg:hover path[fill="currentColor"],
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg:hover path,
        #application.lofter-root-container [class*="box-web"] a[class*="hOr4"] svg[class*="aZSNj"]:hover path,
        #application.lofter-root-container [class*="box-web"] a[class*="hOr4"]:hover svg[class*="aZSNj"] path {
          fill: ${s.theme.accent || "#667eea"} !important;
        }
      `);
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
    out.push(`
      #application.lofter-root-container [class*="boxVisible-web"] > [class*="content-web"] {
        background-color: rgba(255, 255, 255, 0.95) !important;
        border-radius: 12px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
      }
      #application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] a {
        display: block !important;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease !important;
      }
      #application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] a:hover {
        transform: scale(1.02) !important;
        background-color: transparent !important;
      }
      /* 合集页"管理"下拉气泡（删除合集）：高优先级恢复白底深字
         （L1232 的透明化规则 (1,2,2) 会杀掉站点自带的白底） */
      #application.lofter-root-container [class*="boxVisible-web"] [class*="content-web"] [class*="body-web"] {
        background: #fff !important;
        color: #333 !important;
        border-radius: 8px !important;
      }
      #application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] span[role="button"] {
        color: #333 !important;
      }
      /* 合集页/设置页下拉气泡（如"删除合集"）：抬高整条祖先链，避免被右侧栏遮挡。
         站点类名是混淆哈希（style-NNNN-xxx-web，每次构建都可能变），不能依赖具体类名，
         故用 :has() 通配"内部含下拉容器的所有祖先"，把气泡路径上每一级都抬到同一层级，
         保证不被任何中间层叠上下文困住。
         只作用于新版页面根容器内部；顶栏(9999)与装饰图层(99999)仍在其上。 */
      #application.lofter-root-container:has([class*="boxVisible-web"]),
      #application.lofter-root-container *:has([class*="boxVisible-web"]) {
        position: relative !important;
        z-index: 999 !important;
      }
      #application.lofter-root-container [class*="boxVisible-web"] > [class*="content-web"] {
        z-index: 99999 !important;
      }
    `);

    /* ── 字体 ── */
    const fam = activeFontFamily();
    if (fam) {
      out.push(`
        /* 全局字体 */
        * { font-family: ${fam} !important; }
      `);
    }
    if (s.font.scale !== 100) {
      out.push(`
  html { font-size: ${s.font.scale}% !important; }
        
      /* 强制所有元素继承 */
        body, div, span, p, a, h1, h2, h3, h4, h5, h6,
        input, textarea, button, select, label,
        .isaym, .isayt, .isaym3, .w-who, .publishernick,
        .itagname, .tag-count, .update-time,
        .m-tabbar, .tab-w, .tab-li,
        .g-box, .g-boxv2, .m-menu, .menum,
        .opti, .opta, .optb, .cnt, .txt,
        #lofter-top-bar, #rside {
          font-size: inherit !important;
        }
        
        /* Tag 大标题固定大小 */
        .itagname {
          font-size: 24px !important;
        }

/* ── 固定大标题，完全不参与缩放 ── */
  .itagname { font-size: 24px !important; }
  .selfinfo h1 a { font-size: 26px !important; } 
  .text h2 a { font-size: 26px !important; }
  h2.tit { font-size: 18px !important; }

  /* 日期固定 */
  .side .day a  { font-size: 40px !important; }
  .side .month a{ font-size: 24px !important; }

  /* ── 私信图标固定大小 ── */
[class*="-box-web"] svg {
  width: 28px !important;
  height: 24px !important;
}
      `);
    }

    /* ── 导航栏
   注意：#lofter-top-bar 带有内联 style="background:#1F1F1F"
    必须用 !important 才能覆盖内联样式
       ── */
    if (s.navbar.transparent || s.navbar.blur) {
      out.push(`
        #lofter-top-bar {
          ${
            s.navbar.transparent
              ? "background: rgba(255,255,255,0.75) !important; background-image: none !important;"
              : ""
          }
          ${
            s.navbar.blur
              ? "backdrop-filter: blur(16px) !important; -webkit-backdrop-filter: blur(16px) !important;"
              : ""
          }
          border-bottom: none !important;
          transition: background 0.3s !important;
        }
      `);
    }

    /* ── 主题色 ── */
    if (s.theme.accent) {
      const a = s.theme.accent;
      const aHover = `color-mix(in srgb, ${a} 80%, #000)`;
      out.push(`

/* ========== 草稿页 ========== */

/* ── 草稿页"我的长文章"下拉：圆角毛玻璃 ── */
body.body .header.clear {
  position: relative !important;
  z-index: 10001 !important;
}

/* 容器：高度随内容自然撑开，彻底清掉固定高度/内边距 */
body.body .header.clear .select-content.show {
  height: auto !important;
  min-height: auto !important;
  padding: 0 !important;
  background: rgba(255, 255, 255, 0.82) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
  overflow: hidden !important;
}

/* 去掉箭头 */
body.body .header.clear .select-content.show .hnipple {
  display: none !important;
}

/* a 强制填满，flex 垂直居中 */
body.body .header.clear .select-content.show a {
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
  min-height: 48px !important;
  margin: 0 !important;
  padding: 0 !important;
  color: #333 !important;
  text-decoration: none !important;
  transition: background 0.15s ease, color 0.15s ease !important;
}

/* 悬停背景真正铺满整栏 */
body.body .header.clear .select-content.show a:hover {
  background: rgba(0,0,0,0.05) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* 文字层：清掉内联 height:50px，用 padding 自然撑开并垂直居中 */
body.body .header.clear .select-content.show .select-word {
  display: block !important;
  width: 100% !important;
  background: transparent !important;
  color: inherit !important;
  height: auto !important;           /* ← 干掉内联 50px */
  min-height: auto !important;
  line-height: 1.4 !important;       /* ← 正常行高 */
  padding: 14px 16px !important;     /* ← 上下 14px 让条目饱满居中 */
  box-sizing: border-box !important;
}

/* 菜单项 */
body.body .header.clear .select-content.show a {
  display: block !important;
  color: #333 !important;
  transition: background 0.15s ease, color 0.15s ease !important;
  text-decoration: none !important;
}
body.body .header.clear .select-content.show a:hover {
  background: rgba(0,0,0,0.04) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* 文字层 */
body.body .header.clear .select-content.show .select-word {
  background: transparent !important;
  color: inherit !important;
  height: auto !important;
  line-height: 1.5 !important;
  padding: 10px 16px !important;
}

/* 顶部导航栏毛玻璃 */
body.body .header.clear {
  background: rgba(255,255,255,0.75) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-bottom: 1px solid rgba(0,0,0,0.06) !important;
}
/* 直接命中 span.head-edit，覆盖原版绿色背景 */
body.body .header.clear .head-edit {
  background-color: ${s.theme.accent || "#667eea"} !important;
  background-image: none !important;
  color: #fff !important;
  border: none !important;
  border-radius: 20px !important;
  transition: filter 0.2s ease !important;
}
body.body .header.clear .head-edit:hover {
  filter: brightness(1.1) !important;
}

/* ── 草稿列表：圆角毛玻璃卡片 ── */
body.body .content-block {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: ${fr} !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04) !important;
  margin-bottom: 14px !important;
  padding: 18px 20px !important;
  overflow: hidden !important;
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s ease !important;
}
body.body .content-block:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06) !important;
}

/* 缩略图圆角 */
body.body .pic-area img {
  border-radius: calc(${fr} * 0.5) !important;
  display: block !important;
}

/* 时间区：加大加粗 + 深色 + 白色描边阴影，确保任何背景都清晰 */
body.body .timerp {
  color: #666 !important;                    /* 从 #888 加深到 #444 */
  font-size: 18px !important;                /* 从 13px 放大到 15px */
  font-weight: 600 !important;               /* 半粗体，增强辨识度 */
  text-shadow: 0 1px 0 rgba(255,255,255,0.7),  /* 白色描边，压暗背景 */
               0 0 8px rgba(255,255,255,0.6) !important;  /* 白色外发光 */
  letter-spacing: 0.3px !important;            /* 微字间距，更舒展 */
}

/* "分钟前/小时前" 小字同步调整 */
body.body .timerp span {
  color: #666 !important;                    /* 从 #aaa 加深到 #666 */
  font-size: 14px !important;                /* 从 12px 放大到 14px */
  font-weight: 500 !important;
  text-shadow: 0 1px 0 rgba(255,255,255,0.9),
               0 0 6px rgba(255,255,255,0.5) !important;
}

/* 加在 .oimg-del 上，让 before/after 绘制的图形都带上描边 */
body.body .oimg-del::before,
body.body .oimg-del::after {
  filter: drop-shadow(0 1px 1.5px rgba(0,0,0,0.35)) !important;
}

/* 垃圾箱图标：增加圆形悬停底，提高辨识度 */
body.body .oimg-del {
  padding: 8px !important;
  margin: -4px -4px 0 0 !important;
  border-radius: 50% !important;
  background: rgba(0,0,0,0.04) !important;
  transition: background 0.2s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease !important;
}
body.body .oimg-del:hover {
  background: rgba(0,0,0,0.09) !important;
  opacity: 1 !important;
}

/* 主容器增加呼吸边距，让卡片不贴边 */
body.body .main-content {
  padding: 16px 20px !important;
}

/* ── 草稿页翻页：毛玻璃胶囊卡片 ── */
body.body div[class^="ui-"].noselect,
body.body #lpager {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  width: fit-content !important;
  margin: 24px auto !important;
  padding: 10px 18px !important;
  height: auto !important;
  line-height: 1 !important;
  text-align: center !important;
  background: rgba(255, 255, 255, 0.78) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: ${fr} !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04) !important;
  border: none !important;
}

/* 所有翻页项：暴力去边框 */
body.body div[class^="ui-"].noselect span.pgi,
body.body div[class^="ui-"].noselect span.frg,
body.body #lpager span.pgi,
body.body #lpager span.frg {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 36px !important;
  height: 36px !important;
  padding: 0 8px !important;
  border-radius: calc(${fr} * 0.5) !important;
  color: #555 !important;
  font-size: 14px !important;
  background: transparent !important;
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  user-select: none !important;
}
/* 关键修复：Lofter 隐藏的 -1 占位符保持隐藏，不被 inline-flex 顶出来（浅色+暗色通用） */
body.body div[class^="ui-"].noselect span.pgi[style*="display: none"],
body.body div[class^="ui-"].noselect span.pgi[style*="display:none"],
body.body #lpager span.pgi[style*="display: none"],
body.body #lpager span.pgi[style*="display:none"] {
  display: none !important;
}

/* 上下页增加内边距 */
body.body div[class^="ui-"].noselect span.pgb,
body.body #lpager span.pgb {
  padding: 0 14px !important;
}

/* 当前页：主题色实心圆（唯一有底的） */
body.body div[class^="ui-"].noselect span.pgi[class*="js-zslt"],
body.body #lpager span.pgi[class*="js-zslt"] {
  background: ${s.theme.accent || "#667eea"} !important;
  color: #fff !important;
  border: none !important;
  border-radius: 50% !important;
  min-width: 36px !important;
  height: 36px !important;
  box-shadow: 0 2px 8px color-mix(in srgb, ${s.theme.accent} 35%, transparent) !important;
  cursor: default !important;
}

/* 可点击项悬停：放大 + 主题色 + 发光阴影 */
body.body div[class^="ui-"].noselect span.pgi:not([class*="js-zslt"]):hover,
body.body #lpager span.pgi:not([class*="js-zslt"]):hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  transform: scale(1.08) !important;
  text-shadow: 0 0 12px color-mix(in srgb, ${s.theme.accent} 40%, transparent) !important;
  background: rgba(0,0,0,0.03) !important;
  cursor: pointer !important;
}

/* 省略号弱化 */
body.body div[class^="ui-"].noselect span.frg,
body.body #lpager span.frg {
  color: #aaa !important;
  min-width: auto !important;
  padding: 0 4px !important;
  cursor: default !important;
}

/* 省略号弱化 */
body.body #lpager span.frg {
  color: #bbb !important;
  min-width: auto !important;
  padding: 0 4px !important;
  cursor: default !important;
}

/* ── 长文章下拉菜单：圆角毛玻璃基础 ── */
body#longpost-publish-page .u-select-menu,
body#longpost-publish-page #menu-post,
body#longpost-publish-page #menu-music {
  background: rgba(255, 255, 255, 0.75) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
  overflow: hidden !important;
}
/* 菜单列表透明 */
body#longpost-publish-page .u-select-menu .menu,
body#longpost-publish-page .u-select-menu ul {
  background: transparent !important;
  border: none !important;
}
/* 菜单项 */
body#longpost-publish-page .u-select-menu .item {
  color: #333 !important;
  background: transparent !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important;
  transition: all 0.15s ease !important;
}
body#longpost-publish-page .u-select-menu .item:last-child {
  border-bottom: none !important;
}
body#longpost-publish-page .u-select-menu .item:hover {
  background: rgba(0, 0, 0, 0.04) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
/* 小箭头（CSS border 三角）染成毛玻璃底色 */
body#longpost-publish-page .u-select-menu .arrow,
body#longpost-publish-page .u-select-menu .arrow2 {
  border-bottom-color: rgba(255, 255, 255, 0.82) !important;
}
/* 隐藏原版阴影 div（我们用 box-shadow 替代） */
body#longpost-publish-page .u-select-menu .fixedshadow {
  display: none !important;
}

/* 浅色模式：发布按钮文字保险 */
body#longpost-publish-page .m-hd-longpost .right > a.btn-publish {
  color: #fff !important;
}

/* ── 上传封面失败提示弹窗（#alert-tip）：浅色毛玻璃 ──
   浅色卡片暗色文字 + 圆角 + 确定键跟随主题色 */
body#longpost-publish-page #alert-tip {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}
body#longpost-publish-page #alert-tip .txt {
  color: #333 !important;
}
body#longpost-publish-page #alert-tip .btn-sure {
  background: ${s.theme.accent || "#667eea"} !important;
  color: #333 !important;
  border: none !important;
  border-radius: 999px !important;
  transition: filter 0.15s ease !important;
}
body#longpost-publish-page #alert-tip .btn-sure:hover {
  filter: brightness(1.05) !important;
}
body#longpost-publish-page #alert-tip .icon-close {
  opacity: 0.55 !important;
}

/* 长文章浅色模式：顶部导航文字强制深色（覆盖 Lofter 内联白色） */
body#longpost-publish-page .m-hd-longpost .txt-long,
body#longpost-publish-page .m-hd-longpost .txt-save-auto {
  color: #333 !important;
}

/* 封面图/标题/导语居中 */
body#longpost-publish-page .m-main .content {
  max-width: 720px !important;
  margin: 0 auto !important;
  padding: 0 24px !important;
  box-sizing: border-box !important;
}
body#longpost-publish-page .m-main .banner {
  display: block !important;
  margin: 0 auto 16px !important;
  max-width: 720px !important;
}
body#longpost-publish-page .textareawrap {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
/* 导航栏撑满窗口宽度，不再固定 1024px */
body#longpost-publish-page .m-hd-longpost {
  width: 100% !important;
  background: rgba(255,255,255,0.75) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-bottom: 1px solid rgba(0,0,0,0.06) !important;
  box-sizing: border-box !important;
}

/* ── 长文章编辑页：编辑主体 ── */
body#longpost-publish-page .m-main {
  background: rgba(255,255,255,0.82) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: ${fr} !important;
  box-shadow: ${shadow} !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
}

/* ── 长文章 placeholder（在主页面，不在 iframe 内）── */
body#longpost-publish-page label.textIntroLabel {
  color: rgba(255,255,255,0.35) !important;
  left: 24px !important;
  top: 20px !important;
  pointer-events: none !important;
  transition: opacity 0.15s ease !important;
}

/* 点击/聚焦 iframe 区域时隐藏 placeholder */
body#longpost-publish-page .editorWrap:focus-within label.textIntroLabel,
body#longpost-publish-page .editorWrap:has(.edui-editor-iframeholder:focus-within) label.textIntroLabel {
  opacity: 0 !important;
  visibility: hidden !important;
}

/* 内层透明 */
body#longpost-publish-page .m-main .content,
body#longpost-publish-page .m-main .textareawrap {
  background: transparent !important;
}

/* 封面图下移 */
body#longpost-publish-page .m-main {
  padding: 20px 0 32px 0 !important;   /* 上20 下32，左右交给 .content */
  box-sizing: border-box !important;
}
/* 隐藏编辑栏右侧多出的块 */
body#longpost-publish-page .edui-editor-toolbarboxouter,
body#longpost-publish-page .edui-editor-toolbarboxinner,
body#longpost-publish-page .edui-toolbar {
  width: 100% !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}
body#longpost-publish-page .edui-editor {
  width: 100% !important;
}
/* 标题/导语占位符内边距 */
body#longpost-publish-page .textareawrap {
  padding-left: 24px !important;
  padding-right: 24px !important;
}

/* 写作区域加宽 */
body#longpost-publish-page .m-main {
  width: 100% !important;
  max-width: 800px !important;
  margin: 0 auto !important;
  box-sizing: border-box !important;
}
/* 封面图圆角 */
body#longpost-publish-page .banner {
  border-radius: ${fr} !important;
  overflow: hidden !important;
}
body#longpost-publish-page .banner-pic {
  border-radius: ${fr} !important;
}

/* 标题输入框：去白底，字体加大 */
body#longpost-publish-page textarea#title {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid rgba(0,0,0,0.08) !important;
  font-size: 28px !important;
  font-weight: bold !important;
  padding: 12px 0 !important;
  width: 100% !important;
  outline: none !important;
  resize: none !important;
}

/* 导语输入框：去白底，斜体淡色 */
body#longpost-publish-page textarea#pre {
  background: transparent !important;
  border: none !important;
  font-size: 15px !important;
  color: #888 !important;
  padding: 8px 0 !important;
  width: 100% !important;
  outline: none !important;
  resize: none !important;
}

/* 封面图和正文之间间距收紧 */
body#longpost-publish-page .content {
  padding-top: 16px !important;
}
/* 导语和正文之间间距收紧 */
body#longpost-publish-page textarea#pre {
  margin-bottom: -42px !important;
}
body#longpost-publish-page .editorWrap {
  margin-top: 8px !important;
}

/* 导语下方白线去除（浅色+深色通用） */
body#longpost-publish-page textarea#pre {
  border: none !important;
  border-bottom: none !important;
  border-top: none !important;
  outline: none !important;
  box-shadow: none !important;
}
/* 父容器可能带的下边框 */
body#longpost-publish-page .textareawrap {
  border: none !important;
  border-bottom: none !important;
  box-shadow: none !important;
}
/* 导语和正文之间可能存在的 hr / 分隔线 */
body#longpost-publish-page .textareawrap + hr,
body#longpost-publish-page .textareawrap::after,
body#longpost-publish-page #pre + * {
  display: none !important;
}

/* 发布按钮主题色 */
${
  s.theme.accent
    ? `
body#longpost-publish-page #btn-publish {
  background: ${a} !important;
  background-image: none !important;
  color: #fff !important;
  border: none !important;
  border-radius: calc(${fr} * 0.6) !important;
  transition: filter 0.2s ease !important;
}
body#longpost-publish-page #btn-publish:hover {
  filter: brightness(1.1) !important;
}
`
    : ""
}

/* iframe 编辑区域：圆角 + 略实毛玻璃（浅色模式） */
body#longpost-publish-page .edui-editor-iframeholder {
  border-radius: calc(${fr} * 0.6) !important;
  overflow: hidden !important;
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(10px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(140%) !important;
}

/* UEditor placeholder 强制隐藏兜底 */
body#longpost-publish-page .editorWrap:focus-within label.textIntroLabel,
body#longpost-publish-page .editorWrap:has(iframe:focus) label.textIntroLabel {
  display: none !important;
}

/* 新建回礼方案按钮：浅色主题色 */
main.lc-gift-processed > div > button {
  color: ${aHover} !important;
  border-color: ${aHover} !important;
  background: transparent !important;
  transition: background 0.2s ease, color 0.2s ease !important;
}
main.lc-gift-processed > div > button:hover {
  background: color-mix(in srgb, ${a} 12%, transparent) !important;
  color: ${aHover} !important;
}

 /* 选择礼物弹窗：确定按钮浅色主题色 */
.lc-dialog-btn-ok {
  background: ${a} !important;
  background-color: ${a} !important;
  border-color: ${a} !important;
  color: #fff !important;
  transition: filter 0.2s ease !important;
}
.lc-dialog-btn-ok:hover {
  filter: brightness(1.1) !important;
}

/* 选择礼物弹窗：checkbox 勾选浅色主题色 */
.lc-gift-checkbox.rc-checkbox-checked .rc-checkbox-inner {
  background: ${a} !important;
  border-color: ${a} !important;
}

 /* ── 弹窗确定按钮：浅色模式主题色 ── */
.lfc-modal-btn.lfc-modal-btn-primary,
button.lfc-modal-btn-primary {
  background: ${a} !important;
  background-color: ${a} !important;
  border-color: ${a} !important;
  color: #fff !important;
  transition: filter 0.2s ease !important;
}
.lfc-modal-btn.lfc-modal-btn-primary:hover,
button.lfc-modal-btn-primary:hover {
  filter: brightness(1.1) !important;
}

/* 礼物设置确定按钮：浅色模式主题色 */
.lc-gift-btn-ok {
  background: ${a} !important;
  background-color: ${a} !important;
  border-color: ${a} !important;
  color: #fff !important;
  transition: filter 0.2s ease !important;
}
.lc-gift-btn-ok:hover {
  filter: brightness(1.1) !important;
}

/* radio 勾选：浅色模式主题色 */
.lc-gift-label[data-checked="true"] svg circle {
  fill: ${a} !important;
}

/* 礼物设置"查看规范"：主题色 */
div[class*="N0sIIBWs50EJo7u6JA9HaA"] {
  color: ${a} !important;
}

/* 礼物设置"确定"按钮：主题色（实际是 lc-gift-btn-cancel 类） */
.lc-gift-btn-cancel,
button.lc-gift-btn-cancel {
  background: ${a} !important;
  background-color: ${a} !important;
  color: #fff !important;
  border-color: ${a} !important;
}

/* 礼物设置弹窗：毛玻璃效果 */
.lc-gift-processed {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
}
/* 暗色模式毛玻璃 */
.lc-dialog-dark .lc-gift-processed,
[data-theme="dark"] .lc-gift-processed {
  background: rgba(26, 26, 26, 0.85) !important;
}

/* ── 趋势页 Lightbox +关注按钮主题色 ── */
/* 该按钮位于 .g-bdc 内且自身有反向 filter（5036-5038行），共被反 2 次=原色，
   因此直接用正常主题色，不能用 computeDarkAccent 暗色变体 */
.w-pagelayer-postlayer .m-focuson .btn.xtag,
.g-popup .m-focuson .btn.xtag,
#j-pop .m-focuson .btn.xtag {
  background-color: ${s.theme.accent || "#667eea"} !important;
  background-image: none !important;
  border-color: ${s.theme.accent || "#667eea"} !important;
  color: #fff !important;
  transition: all 0.2s ease !important;
}
.w-pagelayer-postlayer .m-focuson .btn.xtag:hover,
.g-popup .m-focuson .btn.xtag:hover {
  filter: brightness(1.1) !important;
  transform: scale(1.04) !important;
}

/* ── 发布按钮 + 下拉箭头主题色（仅图片发布弹窗）── */
.publishlayerwrap .publishBtn {
  background-color: ${a} !important;
  background-image: none !important;
  border: none !important;
  color: #fff !important;
  transition: filter 0.2s ease !important;
}
.publishlayerwrap .publishBtn:hover {
  filter: brightness(1.1) !important;
}

/* 下拉箭头键：比发布按钮深一点，视觉上区分 */
.publishlayerwrap .publishArea a.zdwn {
  background-color: color-mix(in srgb, ${a} 80%, #000) !important;
  background-image: none !important;
  color: transparent !important;
  border: none !important;
  text-indent: -9999px !important;
  overflow: hidden !important;
  position: relative !important;
  transition: filter 0.2s ease !important;
}
.publishlayerwrap .publishArea a.zdwn::after {
  content: '' !important;
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: 0 !important;
  height: 0 !important;
  border-left: 5px solid transparent !important;
  border-right: 5px solid transparent !important;
  border-top: 7px solid rgba(255,255,255,0.9) !important;
}

/* ── 达人页：昵称 / tag / 不喜欢 / 侧边栏悬停主题色（浅色模式）── */
.m-goodblog1 h3 a.ttl:hover {
  color: ${aHover} !important;
}
.m-goodblog1 .tags a.tag:hover {
  color: ${aHover}!important;
}
.m-goodblog1 .other a.f2:hover {
  color: ${aHover} !important;
}
.m-goodtag1 ul li a:hover {
  color: ${aHover} !important;
}

/* ── 关注/认证/签约按钮悬停放大 ── */
        .apply-btn,
        .sign-btn,
        a[class^="btn js-"] {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .apply-btn:hover,
        .sign-btn:hover,
        a[class^="btn js-"]:hover {
          transform: scale(1.06) !important;
        }

/* ── 发现页按钮主题色（高权重版）── */
a.apply-btn,
a.sign-btn,
.m-info .btn {
  background: ${a} !important;
  background-color: ${a} !important;
  background-image: none !important;
  border-color: ${a} !important;
  color: #fff !important;
}

a.apply-btn:hover,
a.sign-btn:hover,
.m-info .btn:hover {
  background: ${a} !important;
  background-color: ${a} !important;
  border-color: ${a} !important;
  color: #fff !important;
  filter: brightness(1.1) !important;
}

/* ── 全局链接悬停变色 ── */
/* 注意：.lc-post-title（自绘标题）与 .month a（月份链接）位于 .postwrapper
   反色区内，这里直接写主题色经反色会显示为暗色，故排除，由暗色区块单独处理。
   帮助与反馈主页容器（iYtrszm）内链接也排除——白毛玻璃卡上悬停变浅
   主题色不清晰（用户实证），该容器悬停只保留放大效果（941 行附近） */
a:hover:not(.w-sbtn):not(.cashbtn):not(#j-participate-act):not(.cnt):not(.isaym):not(.isayt):not(.isay):not(.apply-btn):not(.sign-btn):not(.m-info .btn):not(.apply-btn):not(.sign-btn):not(.m-templist .name):not(.m-nav3 a):not(.m-temp .w-ftt3 a):not(.m-goodblog1 .ttl):not(.m-goodtag1 a):not(.m-goodblog1 .tag):not(.m-goodblog1 .f2):not(.ztag):not(.xtag):not(.linkinvite):not(.lc-post-title):not(.month a):not(.tit):not([class*="iYtrszmUYaccvUMmBbXQiw"] a) {
  color: ${a} !important;
}
/* 浅色模式兜底：被排除的两类元素悬停仍保持主题色 */
.lc-post-title:hover,
.month a:hover {
  color: ${a} !important;
}

        /* 发布栏按键悬停下沉 */
        #publishPostBar .publishlink {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          display: inline-block !important;
        }
        #publishPostBar .publishlink:hover {
          transform: translateY(3px) !important;
        }

        /* 导航栏文字链接悬停 */
#lofter-top-bar a:hover,
#lofter-top-bar button:hover {
  color: ${a} !important;
}

/* 导航栏图标悬停变色 —— 直接命中 SVG，不传染兄弟 */
#lofter-top-bar svg:hover path[fill="currentColor"],
#lofter-top-bar svg:hover *[fill="currentColor"] {
  fill:${a} !important;
}

        /* 右侧栏 */
        #rside a:hover { color: ${a} !important; }

        /* 昵称放大（已确认安全）*/
        .publishernick {
          display: inline-block !important;
          transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .publishernick:hover {
          color: ${aHover} !important;
          transform: scale(1.05) !important;
        }
          /* 互动按钮（热度/评论/查看全文/分享/推荐）*/
        .m-mlist .opti > a {
          display: inline-block !important;
          transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .m-mlist .opti > a:hover {
          color: ${aHover} !important;
          transform: scale(1.05) !important;
        }
        /* 导航栏链接放大
           排除搜索下拉 tag 锚点（AV8Mt）：该 a 是整行宽 flex 容器，
           绕行中心 scale 会把贴左的胶囊推向左边（悬停"左偏移"实证），
           放大交给胶囊 .lc-tag-wrapper:hover 自己的 scale */
        #lofter-top-bar a {
          transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        #lofter-top-bar a:hover:not([class*="AV8Mt74pTEHQXrEBEKFaUg=="]) {
          transform: scale(1.05) !important;
        }
        /* tag 锚点本体：钉死 transform + 收窄 transition，
           站点自身的 hover 位移/缩放彻底失效，胶囊由 wrapper 原地放大 */
        #lofter-top-bar a[class*="AV8Mt74pTEHQXrEBEKFaUg=="] {
          transform: none !important;
          transition: background-color 0.2s ease !important;
        }

        /* 评论区昵称放大 */
        a.s-fc4.xtag {
          display: inline-block !important;
          transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        a.s-fc4.xtag:hover {
          color: ${aHover} !important;
          transform: scale(1.05) !important;
        }

        /* 推荐者昵称放大 */
        .whosep a {
          display: inline-block !important;
          transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .whosep a:hover {
          color: ${aHover} !important;
          transform: scale(1.05) !important;
        }
        /* 右侧栏链接放大 */
        #rside a {
          transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        #rside a:hover {
          color: ${aHover} !important;
          transform: scale(1.05) !important;
        }
        
        /* "参与话题"按钮背景 */
        .w-sbtn.w-sbtn-0,
        #j-participate-act {
          background-color: ${a} !important;
          background-image: none !important;
          color: #fff !important;
          /* 原版立体感：底部内阴影 */
          box-shadow: inset 0 -4px 6px rgba(0,0,0,0.12);
/* 偏移 -4px，模糊 6px，透明度 12% */
          transition: all 0.2s ease !important;
        }

        /* "参与话题"按钮悬停：轻微放大，保持立体感 */
        .w-sbtn.w-sbtn-0:hover,
        #j-participate-act:hover {
          background-color: ${a} !important;
          color: #fff !important;
          transform: scale(1.03) !important;
          /* 悬停时加深内阴影，增强按压感 */
          box-shadow: inset 0 -4px 6px rgba(0,0,0,0.18);
        }
        
       /* ── 评论区发布按钮主题色 ── */
.w-bbtn.w-bbtn-0 {
  background-color: ${a} !important;
  background-image: none !important;
  color: #fff !important;
  border-color: ${a} !important;
  transition: all 0.2s ease !important;
}
.w-bbtn.w-bbtn-0:hover {
  background-color: ${a} !important;
  color: #fff !important;
  filter: brightness(1.1) !important;
} 
        
        /* "最新/最热"选中下划线 */
        /* 深色模式：.j-crt 自身有反向 filter（5269行），且 tag 页 .j-crt 不在 #main 内只被反1次，
           因此需用 computeDarkAccent 暗色变体，反色后显示正常主题色 */
        .m-tabbar .j-crt,
        .m-tabbar .tab-li .j-crt,
        .tab-w .j-crt,
        .tab-li.j-crt,
        .tab-li:has(.j-crt) {
          border-bottom-color: ${isDarkMode() ? computeDarkAccent(a) : a} !important;
        }
        .m-tabbar .j-crt::after,
        .tab-w .j-crt::after {
          background-color: ${isDarkMode() ? computeDarkAccent(a) : a} !important;
        }

        /* 回到顶部按钮 */
        #gtotop {
          background-color: ${a} !important;
          border-radius: ${fr} !important;
          border: none !important;
          color: #fff !important;
          opacity: 0.55 !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s !important;
        }
        #gtotop:hover {
          opacity: 1 !important;
          transform: scale(${s.gtotop && s.gtotop.imageDataUrl ? ((s.gtotop.imageSize || 100) / 100) * 1.08 : 1.08}) !important;
        }
        ${
          s.gtotop && s.gtotop.imageDataUrl
            ? `
        #gtotop {
          background-image: url("${s.gtotop.imageDataUrl}") !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
          background-color: transparent !important;
          transform: scale(${(s.gtotop.imageSize || 100) / 100}) !important;
          transform-origin: bottom right !important;
        }`
            : `
        #gtotop {
          background-blend-mode: luminosity !important;
        }`
        }
      `);

      /* ── 创建合集「+」：圆形主题色底 + 白色加号 ──
      暗色下由暗色段的本地反向 filter 抵消 #main 反色（浅色无 filter），
      所以这里必须写原始主题色——computeDarkAccent 会双重补偿变暗紫 */
      out.push(`
  #collection-create-but button div:first-child,
  #collection-create-but div[class*="xw-"] {
    background-image: none !important;
    position: relative !important;
    width: 20px !important;
    height: 20px !important;
    background: ${s.theme.accent || "#667eea"} !important;
    border-radius: 50% !important;
    flex-shrink: 0 !important;
  }

  #collection-create-but button div:first-child::before,
  #collection-create-but button div:first-child::after,
  #collection-create-but div[class*="xw-"]::before,
  #collection-create-but div[class*="xw-"]::after {
    content: "" !important;
    position: absolute !important;
    background: #fff !important;
    border-radius: 1px !important;
    pointer-events: none !important;
  }

  /* 横线 */
  #collection-create-but button div:first-child::before,
  #collection-create-but div[class*="xw-"]::before {
    width: 10px !important;
    height: 2px !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
  }

  /* 竖线 */
  #collection-create-but button div:first-child::after,
  #collection-create-but div[class*="xw-"]::after {
    width: 2px !important;
    height: 10px !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
  }
`);
    }

    /* ── 圆角卡片 ── */
    if (s.card.enabled) {
      out.push(`

/* ── 私信页：圆角毛玻璃 ── */
#msgcontainer {
  background: rgba(255,255,255,0.82) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: ${fr} !important;
  box-shadow: ${shadow} !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
  flex: 1 !important;
  float: none !important;
  width: auto !important;
}
.g-bdc:has(#msgcontainer) {
  display: grid !important;
  grid-template-columns: 1fr 290px !important;
  gap: 20px !important;
  background: transparent !important;
}
.g-bd3:has(#msgcontainer) {
  background: transparent !important;
}
.g-bdc:has(#msgcontainer) #rside {
  float: none !important;
  width: auto !important;
}
#msgcontainer .xtxt {
  width: auto !important;
  overflow: hidden !important;
  flex: 1 !important;
}
#msgcontainer .xlist {
  display: flex !important;
  align-items: flex-start !important;
  gap: 8px !important;
}
#msgcontainer .ximg {
  flex-shrink: 0 !important;
  float: none !important;
}
#msgcontainer .xtxt {
  float: none !important;
}

/* 通知栏浅色模式卡片 */
.g-bdc:has(#blognotice) {
  display: grid !important;
  grid-template-columns: 1fr 290px !important;
  gap: 20px !important;
  background: transparent !important;
  align-items: stretch !important;
}
.g-bdc:has(#blognotice) #rside {
  float: none !important;
  width: auto !important;
}
.g-mn:has(#blognotice) {
  float: none !important;
  width: auto !important;
  background: rgba(255,255,255,0.82) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border-radius: ${fr} !important;
  box-shadow: ${shadow} !important;
  border: 1px solid rgba(0,0,0,0.06) !important;
  overflow: hidden !important;
}
.g-mn:has(#blognotice) #blognotice,
.g-mn:has(#blognotice) #blognotice > *,
#pager {
  background: transparent !important;
}
.g-bd3:has(#blognotice) {
  background: transparent !important;
}

/* ── 垃圾箱：32px 圆形底 + 图标精确居中 ── */
body.body .oimg-del {
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  margin: 0 !important;
  position: relative !important;
  display: inline-block !important;
  border-radius: 50% !important;
  background: rgba(0,0,0,0.04) !important;
  transition: background 0.2s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease !important;
  vertical-align: middle !important;
}
body.body .oimg-del:hover {
  background: rgba(0,0,0,0.09) !important;
  transform: scale(1.1) !important;
  opacity: 1 !important;
}

/* 盖子：水平居中，垂直整体下移 6px 以在 32px 底内居中 */
body.body .oimg-del::before {
  content: '' !important;
  position: absolute !important;
  top: 7px !important;        /* 原 1px + 6px 偏移 */
  left: 50% !important;
  transform: translateX(-50%) !important;
  width: 14px !important;
  height: 4px !important;
  background: transparent !important;
  background-image: 
    linear-gradient(${s.theme.accent}, ${s.theme.accent}),
    linear-gradient(${s.theme.accent}, ${s.theme.accent}) !important;
  background-size: 4px 2px, 14px 2px !important;
  background-position: 5px 0, 0 2px !important;
  background-repeat: no-repeat !important;
  ${s.background.image && s.background.image.dataUrl ? `filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)) !important;` : ""}
}

/* 桶身：同步居中 */
body.body .oimg-del::after {
  content: '' !important;
  position: absolute !important;
  top: 12px !important;       /* 原 6px + 6px 偏移 */
  left: 50% !important;
  transform: translateX(-50%) !important;
  width: 11px !important;
  height: 13px !important;
  border: 1.5px solid ${s.theme.accent} !important;
  border-top: none !important;
  border-radius: 0 0 3px 3px !important;
  background: transparent !important;
  background-image: 
    linear-gradient(${s.theme.accent}, ${s.theme.accent}),
    linear-gradient(${s.theme.accent}, ${s.theme.accent}) !important;
  background-size: 1.5px 6px, 1.5px 6px !important;
  background-position: 2.5px 2px, 7.5px 2px !important;
  background-repeat: no-repeat !important;
  ${s.background.image && s.background.image.dataUrl ? `filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)) !important;` : ""}
}


/* ── 修改图标：与垃圾箱并排，同风格圆底 + 主题色 ── */
/* 图标区域：右对齐，横向排列不换行，高度足够 */
body.body .img-area.clear {
  text-align: right !important;
  white-space: nowrap !important;
  min-height: 36px !important;
  line-height: 36px !important;
  overflow: visible !important;
  padding: 10px 14px 0px 0 !important;   /* 新增：往下10px，右边留24px */
}
body.body .img-area.clear .oimg-edit,
body.body .img-area.clear .oimg-del {
  display: inline-block !important;
  vertical-align: middle !important;
  margin-left: 12px !important;
  float: none !important;
}

/* 修改图标：32px 圆底，隐藏原有内容 */
body.body .oimg-edit {
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  min-height: 32px !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 50% !important;
  background: rgba(0,0,0,0.04) !important;
  transition: background 0.2s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1) !important;
  cursor: pointer !important;
  position: relative !important;
  font-size: 0 !important;
  color: transparent !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}
body.body .oimg-edit:hover {
  background: rgba(0,0,0,0.09) !important;
  transform: scale(1.1) !important;
}

/* 修改图标：直接用 ✍︎ */
body.body .oimg-edit::before {
  content: '✍︎' !important;
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  font-size: 30px !important;
  line-height: 1 !important;
  color: ${s.theme.accent || "#667eea"} !important;
  background: none !important;
  border: none !important;
  width: auto !important;
  height: auto !important;
  ${s.background.image && s.background.image.dataUrl ? `text-shadow: 0 1px 3px rgba(0,0,0,0.25) !important;` : ""}
}
body.body .oimg-edit::after {
  display: none !important;
}

/* 调整 img-area 与卡片边缘的呼吸距离 */
body.body .img-area {
  margin: 4px 8px 10px 0 !important;
}

/* ========== 草稿页：屏蔽无内容空卡片 ========== */

/* 核心修复：没有 .dotbox（即没有实际草稿内容）的块直接隐藏 */
body.body .content-block:not(:has(.dotbox)),
body.body .content-block:empty {
  display: none !important;
}

/* 备用：如果空块里有不可见节点导致 :empty 不生效，
   清除其所有视觉效果，让它“透明消失” */
body.body .content-block:not(:has(.words-area)) {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  height: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
}


/* ── "丢失内容已保存"提示条：毛玻璃 ── */
.m-tmsg .tmsg {
  background: rgba(255,255,255,0.75) !important;
  backdrop-filter: blur(16px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
  border: 1px solid rgba(0,0,0,0.08) !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important;
  color: #333 !important;
}
.m-tmsg .tmsg .tmsgc {
  background: transparent !important;
}
.m-tmsg .tmsg {
  text-align: center !important;
  margin: 0 auto !important;
}
.m-tmsg .tmsg .tmsgc {
  background: transparent !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  text-align: center !important;
}

        /* 外层透明，只负责间距和清除浮动 */
        #main > .m-mlist {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          border-bottom: none !important;
          overflow: visible !important;
          display: flow-root !important;
          margin-bottom: ${gap} !important;
          position: relative !important;
          z-index: 1 !important;
        }

        /* 内容区相对定位，为伪元素提供锚点 */
        #main > .m-mlist > .mlistcnt {
          position: relative !important;
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          margin-bottom: 0 !important;
        }

        /* 默认：所有 m-mlist 都加伪元素白色圆角卡片 */
        #main > .m-mlist > .mlistcnt::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background:  #fff  !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          z-index: -1 !important;
          pointer-events: none !important;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease !important;
        }

       /* 博文卡片悬停放大 */
        #main > .m-mlist > .mlistcnt:hover::before {
          transform: scale(1.02) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.13) !important;
        }

        /* ===== 排除不需要卡片的模块 ===== */
        #main > .m-mlist:not(:has(> .mlistimg)):not(:has(> .mlistcnt .isay)):not(:has(> .mlistcnt .isayt)):not(:has(> .mlistcnt .isaym)) > .mlistcnt::before,
        #main > .m-mlist:has(> .mlistcnt .tag-header-w) > .mlistcnt::before,
        #main > .m-mlist:has(> .mlistcnt .m-tabbar) > .mlistcnt::before,
        #main > .m-mlist:has(> .mlistcnt .isaym3) > .mlistcnt::before,
        #main > .m-mlist:has(> .mlistcnt .publishlayer) > .mlistcnt::before {
          display: none !important;
        }

        /* 排除模块不要下边距 */
        #main > .m-mlist:has(> .mlistcnt .tag-header-w),
        #main > .m-mlist:has(> .mlistcnt .m-tabbar),
        #main > .m-mlist:has(> .mlistcnt .isaym3),
        #main > .m-mlist:not(:has(> .mlistimg)):not(:has(> .mlistcnt .isay)):not(:has(> .mlistcnt .isayt)):not(:has(> .mlistcnt .isaym)) {
          margin-bottom: 0 !important;
        }

        /* .m-tabbar 所在的 .m-mlist 提高层级 */
        #main > .m-mlist:has(> .mlistcnt .m-tabbar) {
          position: relative !important;
          z-index: 10 !important;
        }

        /* 导航栏直接给 .mlistcnt 加背景 */
        #main > .m-mlist:has(> .mlistcnt .m-tabbar) > .mlistcnt {
          background-color: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          border: none !important;
          overflow: visible !important;
          margin-bottom: 0 !important;
        }

        /* tag 页头部保持透明 */
        #main > .m-mlist:has(> .mlistcnt .tag-header-w) > .mlistcnt {
          background-color: transparent !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
        }

        /* 内容元素浮在伪元素上方 */
        #main > .m-mlist > .mlistcnt > * {
          position: relative !important;
          z-index: 1 !important;
          background: transparent !important;
          border-radius: 0 !important;
        }
        #main > .m-mlist > .mlistcnt .isay,
        #main > .m-mlist > .mlistcnt .isayt,
        #main > .m-mlist > .mlistcnt .isaym {
          background: transparent !important;
        }

        /* 原版装饰元素隐藏 */
        #main > .m-mlist .isaym2 { background-image: none !important; }
        #main > .m-mlist .isayc {
          background: none !important;
          width: auto !important;
          height: auto !important;
        }
        #main > .m-mlist .isayb { display: none !important; }

        /* 首页发布栏（图片/视频发布）：卡片+尖角由 ensureBubbleCards 的
            自绘气泡卡管线接管（#lc-bubble-cards 内 pubBase/pubCss 段，
            注意发布栏 .m-mlist 不是 #main 直接子级，选择器不能带 #main >）。
            这里保留下拉条透明化。addPhotoBar 深灰已按用户要求退回：
            自绘卡片底（rgb(225,225,219)→#1F1F19）直接透过 */
        ${isDarkMode() ? `
        html .m-mlist:has(.publishlayer) .selpublishto,
        html .m-mlist:has(.publishlayer) .selccommons {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
        }
        ` : ""}

        /* 授权方式/发布方式等下拉面板（.zlst 绝对定位向下展开）：
            容器链上任一 overflow:hidden 都会把面板截断在弹窗内，
            整条链全部放开（浅暗通用） */
        #publishArea:has(.publishlayer),
        #publishArea:has(.publishlayer) .publishcommon,
        .m-mlist:has(.publishlayer) .publishlayerwrap,
        .m-mlist:has(.publishlayer) .publishlayer,
        .m-mlist:has(.publishlayer) .publishMain,
        .m-mlist:has(.publishlayer) .pmanagerwrap,
        .m-mlist:has(.publishlayer) .isay,
        .m-mlist:has(.publishlayer) .isaym,
        .m-mlist:has(.publishlayer) .mlistcnt {
          overflow: visible !important;
        }


        /* 展开的评论/热度区域：融入博文卡片，不再叠加独立白底 */
#main > .m-mlist .isaymin {
  background: transparent !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  border: none !important;
  overflow: visible !important;
  margin-top: 6px !important;
}
#main > .m-mlist .isaymin > * {
  background: transparent !important;
}

        /* 通知 slide — 不用伪元素，让 .isaym3.mtag 自己画卡片 */
        
        #noticetip.a-slide {
          overflow: visible !important;
        }
        #noticetip .m-mlist.slide {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        #noticetip .m-mlist {
          background: transparent !important;
          box-shadow: none !important;
        }

        #noticetip .isayb {
          display: none !important;
        }
          
        /* 首页通知栏圆角卡片 */
        /* 暗色模式用 rgb(225,225,219)：经 invert 后为 #1F1F19 深灰，与其他卡片统一；
           浅色模式保持白色 */
        .isaym3.mtag {
          background: ${isDarkMode() ? "rgb(225, 225, 219)" : "#fff"} !important;
          border-radius: ${fr} !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
          overflow: visible !important;
          margin-bottom: ${gap} !important;
        }
        .isaym3.mtag > * {
          background: transparent !important;
          border-radius: ${fr} !important;
          overflow: hidden !important;
        }

        /* 发布栏 */
        #publishBarArea {
          background: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          border: none !important;
          overflow: hidden !important;
          margin-bottom: ${gap} !important;
        }
        #publishBarArea > * { background-color: transparent !important; }
        /* 展开态（站点类名大小写不定：js-showpublishLayer / js-showpublishlayer，
            用属性选择器 i 标志兼容）：
            ① 上面的 overflow:hidden 会裁掉定位在发布栏边缘外的退出键 → 放开裁剪；
            ② 展开层在 #main 内是 static 元素，被固定顶栏（z-index:9999）整行压住，
               暗色下顶栏不透明 → 工具栏整行看不见。展开时隐藏插件顶栏，
               对齐站点原版"全屏专注视图"（原版展开时也没有导航栏） */
        #publishBarArea[class*="js-showpublish" i] {
          overflow: visible !important;
        }
        body.js-bodyCoverShow:has(#publishBarArea) #lofter-top-bar {
          display: none !important;
        }
        /* ③ 展开态唯一处理：暗色下首页右侧栏（#rside 是插件 sticky 跟随的
               独立列，展开了也照样浮着）会盖在图片发布输入框上方 → 展开时
               隐藏它。背景图/背景图层不做任何遮挡，展开层宽度仍=主列。 */
        body.js-bodyCoverShow:has(#publishBarArea) #rside {
          display: none !important;
        }

        /* ── 已发布长文章编辑弹窗暗色适配 ──
           body 直挂的 layerContainer 层（不在 #main 反色区），写直接终色。
           实测弹窗哈希类 alert-publish-ui-XXX 用属性子串选择器命中失败
           （console 探针：.layerContainer 描边生效、[class*=…] 未命中），
           改用层容器 .layerContainer 结构锚定 */
        ${isDarkMode() ? `
        /* 只涂 .cnt 卡片本身；layerContainer 容器比卡片大，涂了会溢出弹窗范围 */
        html .layerContainer .cnt {
          background: #2B2B25 !important;
        }
        /* 文章卡：标题/摘要提亮 */
        html .layerContainer .long .title { color: #d9d9d9 !important; }
        html .layerContainer .long .pre { color: #a5a5a5 !important; }
        /* 顶部"发布到"行（selpublishto 站点白底 → 透明融入卡片） */
        html .layerContainer .selpublishto,
        html .layerContainer .selpublishtype {
          background: transparent !important;
        }
        html .layerContainer .hdinfo-bar .ztxt,
        html .layerContainer .hdinfo-bar .zdwn,
        html .layerContainer .publishType .ztxt,
        html .layerContainer .publishType .zdwn {
          color: #c9c9c9 !important;
        }
        /* UEditor 编辑器：工具栏透明化（图标为雪碧图，深底可见）+ 细边框 */
        html .layerContainer .edui-editor {
          background: transparent !important;
          box-shadow: inset 0 0 0 1px rgb(80, 80, 74) !important;
          border-radius: 8px !important;
        }
        html .layerContainer .edui-editor-toolbarboxouter {
          background: transparent !important;
          background-image: none !important;
          border-bottom: 1px solid rgb(80, 80, 74) !important;
        }
        /* 正文 iframe 区域：iframe 元素/holder 加暗底（iframe 文档内的站点白底
           样式可能压过注入样式，先在外层兜底） */
        html .layerContainer .edui-editor-iframeholder,
        html .layerContainer .edui-editor-iframeholder iframe {
          background: #1F1F19 !important;
        }
        html .layerContainer .edui-toolbar .edui-button:hover .edui-button-body,
        html .layerContainer .edui-toolbar .edui-menubutton:hover .edui-button-body,
        html .layerContainer .edui-toolbar .edui-state-hover .edui-button-body {
          background-color: ${s.theme.accent || "#667eea"} !important;
        }
        /* 标签区：底色统一卡片色 + 边框统一暗色（对齐创作声明行） */
        html .layerContainer .tag-area .tageditor {
          background: #2B2B25 !important;
          border-color: rgb(80, 80, 74) !important;
        }
        html .layerContainer .tag-area .taginput {
          background: transparent !important;
          color: #d9d9d9 !important;
        }
        html .layerContainer .tag-area .tageditor label {
          color: rgba(255, 255, 255, 0.35) !important;
        }
        html .layerContainer .usedtagarea .token2 {
          background: rgba(255, 255, 255, 0.12) !important;
          color: #d9d9d9 !important;
        }
        html .layerContainer .tag-area .taguseful {
          color: #8a8a84 !important;
        }
        /* 合集区：底色统一卡片色 + 边框统一暗色。
           实测只改 .w-collection-selection 不够——白边画在 .collectionArea
           或其 ui-XXXX 包裹层上（该层包住 display:none 的创建合集/提示，
           视觉上只剩选择框一圈），三处一起覆盖 */
        html .layerContainer .collectionArea,
        html .layerContainer .collectionArea > div,
        html .layerContainer .collectionArea .w-collection-selection {
          background: #2B2B25 !important;
          border-color: rgb(80, 80, 74) !important;
          outline-color: rgb(80, 80, 74) !important;
        }
        html .layerContainer .collectionArea .w-collection-selection .ztxt,
        html .layerContainer .collectionArea .zdwn {
          color: #c9c9c9 !important;
        }
        html .layerContainer .collectionArea .new-tip .line-1 {
          color: #c9c9c9 !important;
        }
        html .layerContainer .collectionArea .new-tip a {
          color: #8a8a84 !important;
        }
        /* 通用下拉面板（发布到/发布方式/合集三处共用 zlst 结构）。
           站点给每个 .zitm 自画 #fff/#F5F5F5 底 + #333 文字，必须逐项覆盖；
           面板边框站点 #CCC → 统一暗色 */
        html .layerContainer .zlst {
          background: #2B2B25 !important;
          border-color: rgb(80, 80, 74) !important;
        }
        html .layerContainer .zlst .zitm {
          background: #2B2B25 !important;
          color: #d9d9d9 !important;
        }
        html .layerContainer .zlst .zitm span,
        html .layerContainer .zlst .zitm .name {
          color: #d9d9d9 !important;
        }
        html .layerContainer .zlst .zitm:hover,
        html .layerContainer .zlst .js_selected_option,
        html .layerContainer .zlst .js-zselected,
        html .layerContainer .zlst .zitm[class*="js-zhvr"] {
          background: #3d3d34 !important;
        }
        /* 下拉面板/弹窗主滚动条暗色（站点默认浅色滚动条） */
        html .layerContainer .zlst::-webkit-scrollbar,
        html .layerContainer .lyscroll::-webkit-scrollbar {
          width: 8px !important;
        }
        html .layerContainer .zlst::-webkit-scrollbar-thumb,
        html .layerContainer .lyscroll::-webkit-scrollbar-thumb {
          background: rgb(90, 90, 84) !important;
          border-radius: 4px !important;
        }
        html .layerContainer .zlst::-webkit-scrollbar-track,
        html .layerContainer .lyscroll::-webkit-scrollbar-track {
          background: transparent !important;
        }
        /* 创建合集行+按钮：站点白底改暗、文字提亮（加号保持主题色圆形） */
        html .layerContainer #collection-create-but {
          background: #2B2B25 !important;
        }
        html .layerContainer #collection-create-but button {
          background: #2B2B25 !important;
          border-color: rgb(80, 80, 74) !important;
        }
        html .layerContainer #collection-create-but button div {
          color: #d9d9d9 !important;
        }
        html .layerContainer #collection-create-but button div:first-child,
        html .layerContainer #collection-create-but div[class*="xw-"] {
          filter: none !important;
        }
        /* 下拉勾：清雪碧图 + 自绘对勾（主题色，与首页发布栏同款） */
        html .layerContainer .zlst .selected-icon {
          background: none !important;
        }
        html .layerContainer .zlst .selected-icon::after {
          content: "" !important;
          display: block !important;
          width: 9px !important;
          height: 5px !important;
          border-left: 2px solid ${s.theme.accent || "#667eea"} !important;
          border-bottom: 2px solid ${s.theme.accent || "#667eea"} !important;
          transform: rotate(-45deg) !important;
          margin-top: -2px !important;
        }
        /* 创作声明行：内联浅色边框/文字改暗（CSS !important 可盖内联样式） */
        html .layerContainer .pcGiftArea [role="button"] {
          border-color: rgb(80, 80, 74) !important;
        }
        html .layerContainer .pcGiftArea span {
          color: #c9c9c9 !important;
        }
        /* 转载勾选行 */
        html .layerContainer .checkArea label {
          color: #c9c9c9 !important;
        }
        /* 底部按钮：发布/取消恢复站点原版（用户不需要主题色块） */
        html .layerContainer .actionBar .cancelBtn {
          background: #26262C !important;
          border: 1px solid rgb(80, 80, 74) !important;
          color: #c9c9c9 !important;
        }
        ` : ""}
        /* ── 弹窗浅色模式：下拉勾选标记跟随主题色 ──
           与暗色同款做法：清掉站点雪碧图勾，自绘主题色对勾。
           放在暗色条件块外，两种模式都生效（暗色分支里的同款规则不冲突） */
        html .layerContainer .zlst .selected-icon {
          background: none !important;
        }
        html .layerContainer .zlst .selected-icon::after {
          content: "" !important;
          display: block !important;
          width: 9px !important;
          height: 5px !important;
          border-left: 2px solid ${s.theme.accent || "#667eea"} !important;
          border-bottom: 2px solid ${s.theme.accent || "#667eea"} !important;
          transform: rotate(-45deg) !important;
          margin-top: -2px !important;
        }
        /* ── 弹窗圆角适配（浅色/暗色通用）──
           卡片 .cnt 用用户设置的圆角 fr；不加 overflow:hidden（下拉面板
           .zlst 是 .cnt 子元素，hidden 会把展开的面板裁掉）。
           改为顶部行/底部栏各补对应角，内部块用 0.6fr 保持层次 */
        html .layerContainer .cnt {
          border-radius: ${fr} !important;
        }
        html .layerContainer .cnt .hdinfo-bar {
          border-radius: ${fr} ${fr} 0 0 !important;
        }
        html .layerContainer .cnt .actionBar {
          border-radius: 0 0 ${fr} ${fr} !important;
        }
        html .layerContainer .cnt .long,
        html .layerContainer .cnt .edui-editor {
          border-radius: calc(${fr} * 0.6) !important;
        }
        html .layerContainer .cnt .edui-editor-toolbarboxouter {
          border-radius: calc(${fr} * 0.6) calc(${fr} * 0.6) 0 0 !important;
        }
        html .layerContainer .cnt .tag-area .tageditor,
        html .layerContainer .cnt .collectionArea .w-collection-selection {
          border-radius: calc(${fr} * 0.6) !important;
        }
        /* 下拉面板及各项跟随圆角 */
        html .layerContainer .zlst {
          border-radius: calc(${fr} * 0.6) !important;
        }
        html .layerContainer .zlst .zitm:first-child {
          border-radius: calc(${fr} * 0.6) calc(${fr} * 0.6) 0 0 !important;
        }
        html .layerContainer .zlst .zitm:last-child {
          border-radius: 0 0 calc(${fr} * 0.6) calc(${fr} * 0.6) !important;
        }
        #publishPostBar,
        #publishPostBar.m-nav2,
        #publishPostBar li,
        #publishPostBar::before,
        #publishPostBar::after {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 发布栏个人头像圆角+悬停放大 */
#publishPostBar li.user img {
  border-radius: ${fr} !important;
  overflow: hidden !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
#publishPostBar li.user a:hover img {
  transform: scale(1.08) !important;
}
/* 头像容器：负责圆角裁切 */
#publishPostBar li.user a {
  display: block !important;
  overflow: hidden !important;
  border-radius: ${fr} !important;
}

/* 头像初始缩小 10%，看起来更小一圈 */
#publishPostBar li.user img {
  display: block !important;
  transform: scale(0.9) !important;
  transform-origin: center !important;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 悬停放大到 108%，超出圆角的部分被容器裁掉，视觉上刚好贴边 */
#publishPostBar li.user a:hover img {
  transform: scale(1.08) !important;
}

/* 消除头像底部间隙，让发布栏紧贴头像下缘 */
#publishPostBar li.user {
  padding: 0 !important;
  margin: 0 !important;
}
#publishPostBar li.user img {
  display: block !important;        /* 把 inline 图片变成 block，彻底消除基线间隙 */
  vertical-align: bottom !important; /* 双保险 */
}

/* 如果发布栏 ul 本身有下内边距，也清掉 */
#publishPostBar {
  padding-bottom: 0 !important;
  margin-bottom: 0 !important;
}

        /* Tag 页标题栏 */
        .tag-header-w {
          display: flex !important;
          flex-direction: column !important;
          gap: 1px !important;
          background-color: transparent !important;
          margin-bottom: ${gap} !important;
        }
        .m-itag {
          background-color: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          border: none !important;
          overflow: hidden !important;
        }
        .m-itag > * { background-color: transparent !important; }
        /* 台头不做悬停上浮（用户要求，原 translateY(-3px) 效果已移除） */

        /* 导航栏圆角卡片 */
        .m-tabbar {
          background-color: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          border: none !important;
          overflow: visible !important;
        }
        .m-tabbar > * { background-color: transparent !important; }

        /* 下拉菜单层级 */
        .w-sel, .w-sel-4, .a-w-sel, .a-w-sel-4, #j-recomm-type {
          z-index: 9999 !important;
        }
        .w-sel .selc, .a-w-sel .selc { overflow: visible !important; }

        /* ============================================
         * 右侧边栏
         * ============================================ */
        #rside .g-box,
        #rside .g-boxv2 {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          overflow: visible !important;
        }

        /* 参与用户卡片（tag 页）*/
        .g-box:has(.participate-user-title-w) {
          background-color: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          border: none !important;
          overflow: hidden !important;
          margin-bottom: ${gap} !important;
        }
        #rside .m-menu:has(.participate-user-title-w) {
          border-radius: ${fr} !important;
          overflow: hidden !important;
          box-shadow: ${shadow} !important;
          background: #fff !important;
        }
        #rside .m-menu:has(.participate-user-title-w) .menut,
        #rside .m-menu:has(.participate-user-title-w) .menub { display: none !important; }

        /* slide-bar 区域 */
        #slide-bar, #slide-bar > * { background: transparent !important; }
        #slide-bar [class*="-box-web"] {
          background-color: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          border: none !important;
          overflow: hidden !important;
          margin-bottom: ${gap} !important;
        }
        #slide-bar [class*="-box-web"]:last-child { margin-bottom: 0 !important; }
        #slide-bar [class*="-box-web"] > * { background-color: transparent !important; }
        #slide-bar [class*="-box-web"] a {
          display: block !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        #slide-bar [class*="-box-web"] a:hover { transform: scale(1.04) !important; }
        /* 查看更多页昵称区悬停：深灰底色（覆盖默认白底） */
        #slide-bar [class*="-box-web"] > a:hover > div,
        #slide-bar [class*="-box-web"] > a > div:hover {
          background: rgba(0,0,0,0.15) !important;
        }

        /* 推荐页右侧栏 */
        #rside .g-box .m-menu:has(#likesidelist) {
          background: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          overflow: hidden !important;
          margin-bottom: ${gap} !important;
        }
        #rside .g-box .m-menu:has(#likesidelist) .menut,
        #rside .g-box .m-menu:has(#likesidelist) .menub { display: none !important; }

        /* 推荐卡片 */
        .isaym3:has(.m-ilike) {
          background: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          overflow: hidden !important;
          margin-bottom: ${gap} !important;
        }
        .isaym3:has(.m-ilike) > * { background: transparent !important; }

        /* 个人主页标题卡片 */
        .box.wid700:not(.postwrapper) {
          background: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          overflow: hidden !important;
          margin-bottom: ${gap} !important;
        }
        .box.wid700:not(.postwrapper) > * { background: transparent !important; }

        /* 发现页下划线主题色 */
        ${
          s.theme.accent
            ? `
        .m-vw-nav .j-crt a,
        .m-vw-nav a:hover {
          border-bottom-color: ${s.theme.accent || "#667eea"} !important;
          color: ${s.theme.accent || "#667eea"} !important;
        }
        `
            : ""
        }

/* 通知栏链接悬停主题色 */
${
  s.theme.accent
    ? `
#blognotice a:hover:not(.w-sbtn):not(#j-participate-act):not(.cnt):not(.isaym):not(.isayt):not(.isay):not(.apply-btn):not(.sign-btn),
.g-mn:has(#blognotice) .g-box3 a:hover:not(.w-sbtn):not(#j-participate-act),
#msgcontainer a:hover:not(.w-sbtn):not(#j-participate-act):not(.cnt):not(.isaym):not(.isayt):not(.isay):not(.apply-btn):not(.sign-btn) {
  color: ${computeDarkAccent(s.theme.accent)} !important;
}
`
    : ""
}
        
/* ============================================
 * 模板页卡片
 * ============================================ */

/* 顶部推荐模板（大图那个） */
.m-temp {
  background: #fff !important;
  border-radius: ${fr} !important;
  box-shadow: ${shadow} !important;
  overflow: hidden !important;
  margin-bottom: ${gap} !important;
}
.m-temp table,
.m-temp td {
  background: transparent !important;
}
.m-temp .pic img {
  border-radius: calc(${fr} - 4px) !important;
  display: block !important;
}

/* 模板列表网格卡片 */
.m-templist li {
  background: #fff !important;
  border-radius: ${fr} !important;
  box-shadow: ${shadow} !important;
  overflow: hidden !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease !important;
  margin-bottom: ${gap} !important;
}
.m-templist li:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.13) !important;
}
.m-templist li .pic {
  border-radius: calc(${fr} - 4px) !important;
  overflow: hidden !important;
  display: block !important;
}
.m-templist li .pic img {
  display: block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.m-templist li:hover .pic img {
  transform: scale(1.05) !important;
}
.m-templist li .name {
  display: block !important;
  padding: 10px !important;
  text-align: center !important;
  transition: color 0.2s ease !important;
}
${s.theme.accent ? `.m-templist li .name:hover { color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important; }` : ""}

/* 去掉原版蓝色悬停遮罩 */
.m-templist .icover {
  background: transparent !important;
}
        /* 发现页卡片悬停上浮 */
        .m-post {
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease !important;
        }
        .m-post:hover {
          transform: translateY(-4px) !important;
          box-shadow: ${shadow} !important;
        }
/* ── 模板页文字悬停轻微放大 ── */
.g-bdc:has(.m-templist) .m-temp .w-ftt3 a,
.g-bdc:has(.m-templist) .m-nav3 li a,
.g-bdc:has(.m-templist) .m-templist li .name {
  display: inline-block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s ease !important;
}

.g-bdc:has(.m-templist) .m-temp .w-ftt3 a:hover,
.g-bdc:has(.m-templist) .m-nav3 li a:hover,
.g-bdc:has(.m-templist) .m-templist li .name:hover {
  transform: scale(1.05) !important;
}

        /* tag 页网格视图（body.m-tagArchiveModule 实测锚点，只命中网格页）：
           ⚠ 此页主列不在 #main 反色区内（面包屑 body>.g-bds-1>.g-bdc
           无 #main，台头一直原生白底可证），必须写直接终色，
           不能用 #main 区的预反色写法（rgb(225,225,219) 在此显示浅灰）。
           ① 大容器毛玻璃底 + 负外边距左右外扩 + 等量内边距
              = 容器比卡片宽一圈、卡片不贴边且位置不动 */
        body.m-tagArchiveModule .g-mn {
          background: ${isDarkMode() ? "rgba(30, 30, 36, 0.7)" : "rgba(255, 255, 255, 0.7)"} !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 16px !important;
          padding: 12px 14px !important;
          margin-left: -14px !important;
          margin-right: -14px !important;
        }

        /* ② 去掉站点给各内容块画的白色细线（台头上下、最新最热上方，
              截图证据：.g-bds-1 .g-bdc { border-top-color:#e6e6e6 } 等），
              否则圆角容器成型后这些 1px 线会凸出圆角外 */
        body.m-tagArchiveModule .g-bdc {
          border: none !important;
        }

        /* ③ 最新/最热 tab 栏（截图实测 .m-opbar > .tabwrap > a.j-crt，
              早期诊断另有 .m-tabbar > .tab-w 结构，两锚点都覆盖）：
              同款圆角毛玻璃卡片底；margin 同步 -14px 与大容器对齐
              （此前只扩了 .g-mn，tab 栏显得偏右） */
        body.m-tagArchiveModule .m-opbar,
        body.m-tagArchiveModule .m-tabbar {
          background: ${isDarkMode() ? "rgba(30, 30, 36, 0.7)" : "rgba(255, 255, 255, 0.7)"} !important;
          backdrop-filter: blur(16px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(16px) saturate(160%) !important;
          border-radius: 12px !important;
          padding: 4px 16px !important;
          margin-left: -14px !important;
          margin-right: -14px !important;
          border: none !important;
        }
        /* tab 文字暗色浅字（用户实测：暗底上站点原深灰字不可读） */
        ${
          isDarkMode()
            ? `body.m-tagArchiveModule .m-opbar a,
        body.m-tagArchiveModule .m-tabbar a {
          color: #c9c9c9 !important;
        }`
            : ""
        }

        /* ④ 台头「官方活动」（.m-itag > .itagt > h2.f-thide + .itagfav 订阅
              + .itagbtn，用户实测 DOM）：暗色玻璃卡片底 + 浅色标题。
              background-image 一并清掉防站点白色气泡切片露出 */
        body.m-tagArchiveModule .m-itag {
          background: ${isDarkMode() ? "rgba(30, 30, 36, 0.7)" : "#fff"} !important;
          background-image: none !important;
          ${isDarkMode() ? "backdrop-filter: blur(16px) saturate(160%) !important; -webkit-backdrop-filter: blur(16px) saturate(160%) !important;" : ""}
          border-radius: 16px !important;
          border: none !important;
        }
        ${
          isDarkMode()
            ? `body.m-tagArchiveModule .m-itag h2.f-thide {
          color: #dddddd !important;
        }
        body.m-tagArchiveModule .m-itag .itagfav a {
          color: #c9c9c9 !important;
        }`
            : ""
        }

        /* ⑤ 浏览/参与计数胶囊：去掉黑底（暗色区通用 .info 胶囊规则
              rgba(31,31,25,.7) 在此非反色页显示为实心黑底）。
              只清底色，保留暗色浅字规则保证可读 */
        body.m-tagArchiveModule .m-activity .info {
          background: transparent !important;
          background-image: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: none !important;
          border: none !important;
        }

        /* ⑥ 参与话题按钮：主题色底 + 白字。暗色区给 .w-sbtn-0 加了
              反向 filter（7230 行，为 #main 反色区补偿主题色），
              此页不在反色区，双重反色把按钮变深黑——页面内关掉
              filter 直接写终色。
              ⚠ 此块在 if(s.card.enabled) 模板内，a 不在作用域，
              必须用 s.theme.accent（带兜底），否则 buildCSS 整体
              ReferenceError 中断（背景图/模式切换全挂） */
        body.m-tagArchiveModule .m-activity .w-sbtn.w-sbtn-0 {
          background: ${s.theme.accent || "#667eea"} !important;
          background-image: none !important;
          color: #fff !important;
          filter: none !important;
        }
        body.m-tagArchiveModule .m-activity .w-sbtn.w-sbtn-0:hover {
          background: ${s.theme.accent || "#667eea"} !important;
          color: #fff !important;
          filter: none !important;
          transform: scale(1.03) !important;
        }

        /* ⑦ 最新/最热选中态：加粗 + em 下划线跟随主题色（浅暗同值，
              此页非反色区直接写终色）。暗色区同样给 .j-crt 挂了
              反向 filter，页面内一并关掉，否则下划线颜色被双重反色 */
        body.m-tagArchiveModule .m-opbar a.j-crt,
        body.m-tagArchiveModule .m-tabbar a.j-crt {
          font-weight: 700 !important;
          filter: none !important;
        }
        body.m-tagArchiveModule .m-opbar a.j-crt em,
        body.m-tagArchiveModule .m-tabbar a.j-crt em {
          background: ${s.theme.accent || "#667eea"} !important;
        }

        /* ⑧ 订阅按钮：暗色下站点底图丢失只剩文字，
              补比卡片稍浅一点的胶囊底 */
        ${
          isDarkMode()
            ? `body.m-tagArchiveModule .m-itag .itagfav a {
          background: rgba(255, 255, 255, 0.14) !important;
          background-image: none !important;
          border-radius: 999px !important;
        }`
            : ""
        }

        /* ⑨ 活动行垂直对齐：参与话题按钮与浏览/参与计数居中
              （.info 原本 float:left，基线比按钮低一截）。
              改 flex 后浮动失效，share 用 margin-left:auto 保持靠右 */
        body.m-tagArchiveModule .m-activity .btm {
          display: flex !important;
          align-items: center !important;
        }
        body.m-tagArchiveModule .m-activity .btm .btns,
        body.m-tagArchiveModule .m-activity .btm .info,
        body.m-tagArchiveModule .m-activity .btm .share {
          float: none !important;
        }
        body.m-tagArchiveModule .m-activity .btm .info {
          margin-left: 20px !important;
        }
        body.m-tagArchiveModule .m-activity .btm .share {
          margin-left: auto !important;
        }

        /* ⑩ 网格博文卡片（.archiveitm > .fullnk(.txt/.txtshadow/.layer)
              + .info(a.img+a.name)，用户实测 DOM）：圆角 + 暗色适配。
              底部暗色胶囊 = 通用 .info 玻璃规则误伤作者行，清除 */
        body.m-tagArchiveModule .archiveitm,
        body.m-tagArchiveModule .archiveitm .fullnk {
          border-radius: 12px !important;
          overflow: hidden !important;
        }
        body.m-tagArchiveModule .archiveitm {
          background: ${isDarkMode() ? "rgba(30, 30, 36, 0.7)" : "#fff"} !important;
        }
        ${
          isDarkMode()
            ? `body.m-tagArchiveModule .archiveitm .fullnk {
          background: transparent !important;
        }`
            : ""
        }
        /* 卡片内图片不反色 */
        body.m-tagArchiveModule .archiveitm img {
          filter: none !important;
        }
        /* 悬停遮罩：站点默认浅蓝 #5a8dcd → 跟随主题色（透明度/
              过渡仍走站点原逻辑） */
        body.m-tagArchiveModule .archiveitm .layer {
          background: ${s.theme.accent || "#667eea"} !important;
        }
        /* 作者行：去掉胶囊底，只留头像+昵称；flex 一行排布——
              昵称站点定宽 146px 在窄卡里会挤到头像下方，
              改 flex 后头像左、昵称占满剩余宽度（站点自带
              nowrap+ellipsis 省略号仍然生效） */
        body.m-tagArchiveModule .archiveitm .info {
          display: flex !important;
          align-items: center !important;
          /* 整行下移，不贴着上方作品内容 */
          margin-top: 10px !important;
          background: transparent !important;
          background-image: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
        }
        body.m-tagArchiveModule .archiveitm .info a.img {
          float: none !important;
          flex: 0 0 auto !important;
          margin-right: 8px !important;
        }
        body.m-tagArchiveModule .archiveitm .info a.name {
          float: none !important;
          flex: 1 1 auto !important;
          width: auto !important;
        }

        /* ⑪ 分享区 + 瀑布流/网格切换键暗色适配：
              图标都是为浅底设计的雪碧图，非反色页直接反向 filter
              变浅色；"分享到 :" 文字补浅色。
              切换键 DOM 未实测，先用 .m-itag 内空锚点兜底命中 */
        ${
          isDarkMode()
            ? `body.m-tagArchiveModule .m-activity .share a.icn1,
        body.m-tagArchiveModule .m-activity .share a.icn3,
        body.m-tagArchiveModule .m-activity .share a.icn4,
        body.m-tagArchiveModule .m-itag a:empty {
          filter: invert(1) hue-rotate(180deg) brightness(1.15) !important;
        }
        body.m-tagArchiveModule .m-activity .share span {
          color: #c9c9c9 !important;
        }`
            : ""
        }
        ${
          isDarkMode()
            ? `body.m-tagArchiveModule .archiveitm .txt {
          color: #c9c9c9 !important;
        }
        body.m-tagArchiveModule .archiveitm .title {
          color: #dddddd !important;
        }
        body.m-tagArchiveModule .archiveitm .desc,
        body.m-tagArchiveModule .archiveitm .desc p {
          color: #b5b5b5 !important;
        }
        body.m-tagArchiveModule .archiveitm .info a.name {
          color: #c9c9c9 !important;
        }
        body.m-tagArchiveModule .archiveitm .txtshadow {
          background: transparent !important;
          background-image: none !important;
        }`
            : ""
        }

        /* ============================================
         * 达人页头像、昵称、侧边栏悬停放大
         * ============================================ */
        .m-goodblog1 a.img img {
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .m-goodblog1 a.img:hover img {
          transform: scale(1.08) !important;
        }

        .m-goodblog1 a.ttl {
          display: inline-block !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .m-goodblog1 a.ttl:hover {
          transform: scale(1.08) !important;
        }

        .m-goodtag1 li a {
          display: block !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .m-goodtag1 li a:hover {
          transform: scale(1.04) !important;
        }
       /* 达人页头像圆角 */
        .m-goodblog1 a.img img {
          border-radius: ${fr} !important;
        }

        /* 达人页作品悬停遮罩：蓝色 → 主题色半透明 */
        .m-goodblog1 .layer {
          background-color: color-mix(in srgb, ${s.theme.accent} 55%, transparent) !important;
        }

        /* ── 领域达人/标签达人/我关注的人导航悬停放大 ── */
        body:has(.m-goodblog1) .m-nav3.m-nav3-2 > ul > li > a,
        body:has(.m-glist) .m-nav3.m-nav3-2 > ul > li > a {
          display: inline-block !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        body:has(.m-goodblog1) .m-nav3.m-nav3-2 > ul > li > a:hover,
        body:has(.m-glist) .m-nav3.m-nav3-2 > ul > li > a:hover {
          transform: scale(1.05) !important;
        }

        /* ── 我关注的人页：最近互动/最新关注悬停放大 ── */
        .g-bdc:has(.m-glist) .m-tabbar a.ztag {
          display: inline-block !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .g-bdc:has(.m-glist) .m-tabbar a.ztag:hover {
          transform: scale(1.05) !important;
        }

        /* ── 我关注的人页：整行悬停深色毛玻璃（修复闪烁+按钮消失） ── */
        .g-bdc:has(.m-glist) .m-glist > ul > li {
          position: relative !important;
          border-radius: ${fr} !important;
        }
        .g-bdc:has(.m-glist) .m-glist > ul > li::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          border-radius: ${fr} !important;
          background: rgba(0, 0, 0, 0.1) !important;
          opacity: 0 !important;
          transition: opacity 0.3s ease !important;
          pointer-events: none !important;
          z-index: 0 !important;
        }
        .g-bdc:has(.m-glist) .m-glist > ul > li:hover::before {
          opacity: 1 !important;
        }

/* ── 批量管理页：月份标题 + 文章数胶囊底（上移定位）── */
body.p-body7 .m-filecnt {
  position: relative !important;
  padding-top: 24px !important;    /* 减少顶部留白 */
}
body.p-body7 .m-filecnt h2 {
  background: transparent !important;
}
body.p-body7 .m-filecnt h2 em {
  position: absolute !important;
  top: 0 !important;               /* 贴顶，不超出 */
  left: 0 !important;
  padding: 5px 12px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(16px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
  color: #333 !important;
  font-weight: 600 !important;
  text-shadow: none !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  z-index: 10 !important;
}
body.p-body7 .m-filecnt h2 small {
  position: absolute !important;
  top: 0 !important;               /* 贴顶，不超出 */
  right: 0 !important;
  padding: 5px 12px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(16px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
  color: #333 !important;
  font-weight: 600 !important;
  text-shadow: none !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  z-index: 10 !important;
}

/* ── 批量管理页：卡片悬停主题色遮罩 ── */
body.p-body7 .m-filecnt li.ptag {
  position: relative !important;
}
body.p-body7 .m-filecnt li.ptag::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: ${s.theme.accent ? s.theme.accent : "#667eea"} !important;
  opacity: 0 !important;
  transition: opacity 0.2s ease !important;
  pointer-events: none !important;
  z-index: 200 !important;  /* 比 .sel 的 105 高 */
}
body.p-body7 .m-filecnt li.ptag:hover::after {
  opacity: 0.32 !important;
}

/* ── 批量管理页：选中态主题色 ── */
/* 恢复 .sel 的 border，只改颜色 */
body.p-body7 .m-filecnt li.ptag.selected .sel {
  border: 4px solid ${s.theme.accent || "#667eea"} !important;
}
/* 去掉 outline 和 box-shadow（如果有的话） */
body.p-body7 .m-filecnt li.ptag.selected {
  outline: none !important;
  box-shadow: none !important;
}
/* 蒙版 */
body.p-body7 .m-filecnt li.ptag.selected .selcover {
  background: ${s.theme.accent ? s.theme.accent : "#667eea"} !important;
  opacity: 0.25 !important;
}
/* 授权图标、标签数 */
body.p-body7 .m-filecnt li.ptag.selected .w-cc,
body.p-body7 .m-filecnt li.ptag.selected .seltag {
  background-color: ${s.theme.accent ? s.theme.accent : "#667eea"} !important;
}
/* 勾选标记 */
body.p-body7 .m-filecnt li.ptag.selected .selsel {
  background-color: transparent !important;
  border: none !important;
}
/* 位置调整 */
body.p-body7 .m-filecnt li.ptag.selected .selsel {
  left: auto !important;
  right: 7px !important;
  top: 10px !important;
}
body.p-body7 .m-filecnt li.ptag.selected .w-cc {
  left: 0px !important;
  top: 78px !important;
}

/* ── 批量管理页：编辑授权弹层主题色 ── */
/* 悬停态：整行主题色背景 */
body.p-body7 .m-layer .cclist li:hover {
  background-color: ${s.theme.accent || "#667eea"} !important;
  color: #fff !important;
}
/* 选中态：整行背景恢复默认，不改颜色 */
body.p-body7 .m-layer .cclist li.checked,
body.p-body7 .m-layer .cclist li:has(.cctag:checked) {
  background-color: transparent !important;
  color: inherit !important;
}
/* radio 按钮选中态：主题色 */
body.p-body7 .m-layer .cclist .cctag[type="radio"]:checked {
  accent-color: ${s.theme.accent || "#667eea"} !important;
}

 /* ========== 话题页外层容器毛玻璃========== */
/* 1. 父级底盘透明，防止圆角外侧漏白 */
.g-bdc {
  background: transparent !important;
}

/* 2. 内容区大容器：唯一毛玻璃层 */
.g-mn:has(.m-actlist),
.g-mn:has(#container) {
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(16px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
  border-radius: ${fr} !important;
  padding: 20px !important;
  overflow: hidden !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
}
.g-bd5 .g-bdc,
.g-bdc {
  background: transparent !important;
  background-image: none !important;
  background-color: transparent !important;
}

/* 3. 导航行保持原样，不受影响 */
.g-mn:has(.m-vw-nav) {
  background: rgba(255, 255, 255, 0.95) !important;
}

/* 4. 大容器内部 .g-box1 全部透明，不准挡毛玻璃 */
.g-mn:has(.m-actlist) .g-box1,
.g-mn:has(#container) .g-box1 {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

/* ========== 发现页各子页面大容器毛玻璃（含专题页） ========== */
.g-bdc:has(.m-goodblog1),
.g-bdc:has(#inviteearea),
.g-bdc:has(.m-glist),
.g-bdc:has(.m-vw-actlist2),
.g-bdc:has(#g-selectionlist-box),
.g-bdc:has(.m-templist),
.g-bdc:has(.m-goodcnt) {
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(16px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
  border-radius: ${fr} !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.08) !important;
  outline: 1px solid rgba(255, 255, 255, 0.35) !important;
}

/* 内部通用透明 */
.g-bdc:has(.m-goodblog1) .g-box12,
.g-bdc:has(.m-goodblog1) .m-goodblog1,
.g-bdc:has(.m-goodblog1) .m-goodtag1,
.g-bdc:has(#inviteearea) .g-box2,
.g-bdc:has(#inviteearea) .g-inviteside,
.g-bdc:has(#inviteearea) .g-invitemain,
.g-bdc:has(.m-glist) .g-box2,
.g-bdc:has(.m-glist) .g-mn2,
.g-bdc:has(.m-glist) .g-sd,
.g-bdc:has(.m-glist) .m-glist,
.g-bdc:has(.m-vw-actlist2) .mid,
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2,
.g-bdc:has(.m-goodblog1) .m-nav3,
.g-bdc:has(#inviteearea) .m-nav3,
.g-bdc:has(.m-glist) .m-nav3,
.g-bdc:has(.m-vw-actlist2) .m-nav3 {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

/* 去掉搜索区域所有层级的背景框 */
.g-bdc:has(.m-glist) .g-sd .g-box,
.g-bdc:has(.m-glist) .m-ssch,
.g-bdc:has(.m-glist) .m-ssch .ssch {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* form 撑满宽度，横向排列 */
.g-bdc:has(.m-glist) .m-ssch .ssch form {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  width: 100% !important;
}

/* ========== 我关注的人页面：搜索框去线 + 左对齐 ========== */

/* 直接命中 form.xtag 本身（border/padding 不继承，必须命中自身） */
.g-bdc:has(.m-glist) .m-ssch form.xtag,
.g-bdc:has(.m-glist) .m-ssch .ssch form.xtag {
  border-top: none !important;
  border-bottom: none !important;
  /* 左对齐：清掉左侧 16px 内边距 */
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

/* 输入框和按钮在 form 内保持合适边距，避免贴边 */
.g-bdc:has(.m-glist) .m-ssch form.xtag input {
  margin-left: 0 !important;
}
.g-bdc:has(.m-glist) .m-ssch form.xtag button {
  margin-right: 0 !important;
}

/* 如果清掉 padding 后你觉得输入框贴边太紧，
   可以改成和下方推荐关注卡片统一的内边距（常见是 12px 或 16px）：
   padding: 9px 12px !important; */

/* 输入框自动占满 */
.g-bdc:has(.m-glist) .m-ssch input {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  border-radius: ${fr} !important;
  border: 1px solid rgba(0, 0, 0, 0.15) !important;
  background: rgba(255, 255, 255, 0.85) !important;
  padding: 8px 14px !important;
  outline: none !important;
}

/* 按钮固定大小 */
.g-bdc:has(.m-glist) .m-ssch button {
  flex: 0 0 auto !important;
  border-radius: calc(${fr} * 0.6) !important;
  padding: 8px 14px !important;
}

/* 我关注的人页：去掉最近互动/最新关注 的灰色底 */
.g-bdc:has(.m-glist) .m-tabbar {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  border-bottom: none !important;
}

/* 发现页各子页面导航选中项圆角 */
.g-bdc .m-nav3 .j-curr,
.g-bdc .m-nav3 .j-crt {
  border-radius: ${fr} !important;
}

/* 中型话题卡片白色圆角 */
.m-actlist .cont {
  background: #fff !important;
  border-radius: ${fr} !important;
  box-shadow: ${shadow} !important;
  overflow: hidden !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease !important;
  margin-bottom: ${gap} !important;
}
.m-actlist .cont:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.13) !important;
}
.m-actlist .cont .txt {
  background: transparent !important;
}
/* 缩略图圆角 */
.m-actlist .item {
  border-radius: calc(${fr} - 4px) !important;
  overflow: hidden !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.m-actlist .item:hover {
  transform: scale(1.05) !important;
}
/* 去掉原版蓝色蒙版 */
.m-actlist .icover {
  background: transparent !important;
}

/* 专题页卡片圆角 + 悬停上浮 */
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont {
  border-radius: ${fr} !important;
  overflow: hidden !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease !important;
  box-shadow: ${shadow} !important;
}

.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.13) !important;
}

/* 专题页：cover 加渐变遮罩和悬停毛玻璃 */
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont a.xtag span.cover {
  background: linear-gradient(
    to top,
    rgba(0,0,0,0.55) 0%,
    rgba(0,0,0,0.1) 50%,
    transparent 100%
  ) !important;
  transition: background 0.3s ease, backdrop-filter 0.3s ease !important;
}
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont a.xtag:hover span.cover {
  background: rgba(0,0,0,0.3) !important;
}
/* 悬停时直接模糊图片 */
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont a.xtag:hover img {
  filter: invert(100%) hue-rotate(180deg) blur(3px) brightness(0.88) !important;
  transition: filter 0.3s ease !important;
}
/* 非悬停时也给 transition，让退出时平滑 */
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont a.xtag img {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease !important;
}

/* text-shadow 只加阴影，绝不动 position */
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont a.xtag span.tit {
  text-shadow:
    0 1px 4px rgba(0,0,0,0.9),
    0 2px 12px rgba(0,0,0,0.7) !important;
}

/* 专题页图片悬停放大 */
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont img {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont:hover img {
  transform: scale(1.05) !important;
}

/* 确保链接层不溢出圆角 */
.g-bdc:has(.m-vw-actlist2) .m-vw-actlist2 .cont a {
  display: block !important;
  border-radius: ${fr} !important;
  overflow: hidden !important;
}

/* 导航行半透明 */
.g-mn:has(.m-vw-nav) {
  background: rgba(255, 255, 255, 0.92) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* ── 趋势页 Lightbox 大卡片圆角 ── */
/* 真正包住图片+评论区的大卡片是 .g-bdc / .g-bd5 */
.w-pagelayer-postlayer .g-bd5,
.w-pagelayer-postlayer .g-bdc,
.g-popup .g-bd5,
.g-popup .g-bdc,
#j-pop .g-bd5,
#j-pop .g-bdc {
  border-radius: ${fr} !important;
  overflow: hidden !important;
}

/* 顶部作者栏融入圆角，防止直角顶穿 */
.w-pagelayer-postlayer .m-focuson,
.g-popup .m-focuson {
  border-top-left-radius: ${fr} !important;
  border-top-right-radius: ${fr} !important;
}

/* 底部评论区和工具栏也融入 */
.w-pagelayer-postlayer .a-isaym2:last-child,
.g-popup .a-isaym2:last-child {
  border-bottom-left-radius: ${fr} !important;
  border-bottom-right-radius: ${fr} !important;
  overflow: hidden !important;
}

/* ============================================
 * 发现-标签页卡片
 * ============================================ */

/* 标签项圆角卡片 */
.g-bdc:has(.m-goodcnt) .itm {
  border-radius: ${fr} !important;
  overflow: hidden !important;
  position: relative !important;
  box-shadow: ${shadow} !important;
  transition: box-shadow 0.25s ease !important;
}
.g-bdc:has(.m-goodcnt) .itm:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.13) !important;
}

/* 链接层负责裁切，确保图片放大不溢出 */
.g-bdc:has(.m-goodcnt) .itm a.ztag {
  display: block !important;
  overflow: hidden !important;
  border-radius: ${fr} !important;
}

/* 图片仅在容器内放大，不撑破卡片 */
.g-bdc:has(.m-goodcnt) .itm img {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.g-bdc:has(.m-goodcnt) .itm:hover img {
  transform: scale(1.05) !important;
}

/* 去除蓝色半透明蒙版 */
.g-bdc:has(.m-goodcnt) .itm .icover {
  background: transparent !important;
  opacity: 0 !important;
  display: none !important;
}

/* 底部标签文字：暗色渐变底+白字，确保可读 */
.g-bdc:has(.m-goodcnt) .itm .tag {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  padding: 10px 4px 6px !important;
  background: linear-gradient(to top, rgba(0,0,0,0.55), transparent) !important;
  color: #fff !important;
  text-align: center !important;
  border-radius: 0 !important;
  z-index: 2 !important;
}

        /* ============================================
         * 个人主页博文卡片（.postwrapper）
         * ============================================ */
        .postwrapper.box.wid700 {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          width: 700px !important;
          max-width: 1000px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .postwrapper .block {
          background: #fff !important;
          border-radius: ${fr} !important;
          box-shadow: ${shadow} !important;
          border: none !important;
          margin-bottom: calc(${gap} + 14px) !important;
          overflow: hidden !important;
          padding: 32px 16px 0px 16px !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease !important;
        }
        .postwrapper .block:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.13) !important;
        }

        .postwrapper .block .img img {
          border-radius: calc(${fr} - 6px) !important;
          display: block !important;
        }
        .postwrapper .block .main { background-image: none !important; }
        .postwrapper .block ol.notes { padding-right: 56px !important; }

        .postwrapper .block:not(:has(.side)) { padding-left: 90px !important; }
        .postwrapper .block:not(:has(.side)) .main {
          margin-left: 0 !important;
          width: 100% !important;
        }
        .postwrapper .block .img,
        .postwrapper .block .text { padding-right: 45px !important; }

        /* 翻页按钮 */
        .postwrapper .page {
          margin-left: 0 !important;
          width: 100% !important;
          display: flex !important;
          justify-content: space-between !important;
        }
        .postwrapper .page .cap,
        .postwrapper .page .arrow { opacity: 0 !important; }
        .postwrapper .page,
        .postwrapper .page .next,
        .postwrapper .page .prev {
          overflow: visible !important;
          position: relative !important;
        }
        .postwrapper .page .next,
        .postwrapper .page .prev { background: transparent !important; }
        .postwrapper .page a { overflow: visible !important; }

        .postwrapper .page .next.active::after {
          content: '' !important;
          position: absolute !important;
          width: 44px !important;
          height: 44px !important;
          border-radius: 50% !important;
          background: ${s.theme.accent || "rgba(0,0,0,0.35)"}
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolygon points='8,4 18,12 8,20' fill='white'/%3E%3C/svg%3E")
            center/45% no-repeat !important;
          top: 50% !important;
          right: 0 !important;
          transform: translateY(-50%) !important;
          pointer-events: none !important;
          z-index: 10 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
        }
        .postwrapper .page .prev.active::after {
          content: '' !important;
          position: absolute !important;
          width: 44px !important;
          height: 44px !important;
          border-radius: 50% !important;
          background: ${s.theme.accent || "rgba(0,0,0,0.35)"}
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolygon points='16,4 6,12 16,20' fill='white'/%3E%3C/svg%3E")
            center/45% no-repeat !important;
          top: 50% !important;
          left: 0 !important;
          transform: translateY(-50%) !important;
          pointer-events: none !important;
          z-index: 10 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25) !important;
        }

        .postwrapper .page .title {
          display: block !important;
          position: absolute !important;
          top: 50% !important;
          white-space: nowrap !important;
          color: #fff !important;
          text-shadow: 0 1px 4px rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.4) !important;
          z-index: 11 !important;
          font-size: 18px !important;
          opacity: 0 !important;
          pointer-events: none !important;
          transition: opacity 0.25s ease, transform 0.25s ease !important;
        }
        .postwrapper .page .next .title {
          right: 14px !important;
          left: auto !important;
          transform: translateY(-65%) translateX(8px) !important;
        }
        .postwrapper .page .next:hover .title {
          opacity: 1 !important;
          transform: translateY(-65%) translateX(0) !important;
        }
        .postwrapper .page .prev .title {
          left: 14px !important;
          right: auto !important;
          transform: translateY(-65%) translateX(-8px) !important;
        }
        .postwrapper .page .prev:hover .title {
          opacity: 1 !important;
          transform: translateY(-65%) translateX(0) !important;
        }

        /* ── 头像圆角 + 悬停放大（合并版）── */
        .mlistimg {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15)) !important;
          transition: filter 0.25s ease !important;
        }
        .mlistimg:hover {
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.18)) !important;
        }
        .mlistimg .w-img {
          overflow: visible !important;
          border-radius: 0 !important;
          line-height: 0 !important;
          background: transparent !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .mlistimg .w-img img {
          display: block !important;
          border-radius: ${fr} !important;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .mlistimg .w-img:hover img {
          transform: scale(1.08) !important;
        }
        .mlistimg .w-img a {
          border-radius: 0 !important;
          overflow: visible !important;
          box-shadow: none !important;
          border: none !important;
        }
        .mlistimg .w-img a:not(.vicon) {
          display: block !important;
          background: transparent !important;
        }
        .mlistimg .w-img .vicon {
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* 通知栏/评论区头像圆角（容器不裁切） */
        .cmti .w-img2,
        div.w-img2 {
          overflow: visible !important;
          border-radius: 0 !important;
          background: transparent !important;
          line-height: 0 !important;
        }
        .cmti .w-img2 img,
        div.w-img2 img {
          display: block !important;
          border-radius: 6px !important;
        }
        .cmti .w-icn3,
        div.w-img2 .w-icn3 {
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }


        /* 注入的博文标题 */
        .lc-post-title {
          display: block !important;
          font-size: 25px !important;
          font-weight: bold !important;
          color: #333 !important;
          margin-bottom: 10px !important;
          line-height: 1.4 !important;
          text-decoration: none !important;
          transition: color 0.2s ease !important;
        }
        ${
          s.theme.accent
            ? `
        .lc-post-title:hover { color: ${s.theme.accent || "#667eea"} !important; }
        `
            : ""
        }
      `);
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

    out.push(`
  /* 外层容器：毛玻璃+圆角 */
  .a-w-sel.usercard,
  .a-w-sel[class*="-7"] {
    background: ${popupBg} !important;
    backdrop-filter: blur(20px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(20px) saturate(150%) !important;
    border: 1px solid ${popupBorder} !important;
    border-radius: 12px !important;
    box-shadow: ${popupShadow} !important;

  }
  ${
    isDark
      ? `
  .a-w-sel.usercard,
  .a-w-sel[class*="-7"] {
    filter: none !important;
  }
  `
      : ""
  }

  /* 隐藏原版的内部实心 border 箭头 */
  .a-w-sel .arrow,
  .a-w-sel .arrow-up-right,
  .a-w-sel .arrow-up-left,
  .a-w-sel #ucarrow {
    display: none !important;
  }

  /* 所有内层透明 */
  .a-w-sel .w-sel,
  .a-w-sel .selc,
  .a-w-sel .selcc,
  .a-w-sel .seli,
  .a-w-sel .m-glist2,
  .a-w-sel .bloginfo,
  .a-w-sel .blogmenu,
  .a-w-sel .m-goodcnt,
  .a-w-sel .m-daren {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    border: none !important;
    box-shadow: none !important;
  }

  /* 文字颜色 */
  .a-w-sel,
  .a-w-sel span,
  .a-w-sel .moredr {
    color: ${popupText} !important;
  }
  .a-w-sel a,
  .a-w-sel .name,
  .a-w-sel .subinfo a {
    color: ${popupText} !important;
  }
  .a-w-sel a:hover,
  .a-w-sel a.name:hover {
    color: ${popupAccent} !important;
  }

  /* 关注按钮：主题色 */
.a-w-sel .u-btn,
.a-w-sel .u-btn-1 {
  background: ${s.theme.accent || "#888"} !important;
  color: #fff !important;
  border-color: ${s.theme.accent || "#888"} !important;
}

/* 已关注按钮：深灰底+白字，清晰可读 */
.a-w-sel .u-btn2 {
  background: rgba(0, 0, 0, 0.5) !important;
  color: #fff !important;
  border: 1px solid rgba(255,255,255,0.2) !important;
}

/* ── 私信/加黑下拉菜单：圆角毛玻璃 ── */
.a-w-sel .menulist {
  background: ${popupBg} !important;
  backdrop-filter: blur(16px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(150%) !important;
  border: 1px solid ${popupBorder} !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
  overflow: hidden !important;
}

/* 菜单内层透明 */
.a-w-sel .menulist ul,
.a-w-sel .menulist li {
  background: transparent !important;
  border: none !important;
}

/* 菜单项文字 */
.a-w-sel .menulist a {
  color: ${popupText} !important;
  transition: background 0.15s ease !important;
}
.a-w-sel .menulist a:hover {
  color: ${popupAccent} !important;
  background: rgba(255,255,255,0.08) !important;
}

/* 原版小三角同步背景色 */
.a-w-sel .menulist .arrow {
  border-bottom-color: ${popupBg} !important;
}

  /* 缩略图hover遮罩 */
  .a-w-sel .icover {
    background: rgba(0, 0, 0, 0.35) !important;
  }

/* ── 弹窗内元素悬停轻微放大 ── */

/* 头像 */
.a-w-sel .w-img2 img {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.a-w-sel .w-img2:hover img {
  transform: scale(1.06) !important;
}

/* 用户名 */
.a-w-sel a.name {
  display: inline-block !important;
  transition: color 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.a-w-sel a.name:hover {
  transform: scale(1.03) !important;
}

/* ── 所有缩略图项悬停放大（图片+文字类型都覆盖）── */
.a-w-sel .m-goodcnt .itm {
  overflow: hidden !important;
  border-radius: 4px !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.a-w-sel .m-goodcnt .itm:hover {
  transform: scale(1.05) !important;
}
/* 内部元素同步放大，防止文字类型漏掉 */
.a-w-sel .m-goodcnt .itm img,
.a-w-sel .m-goodcnt .itm .txt,
.a-w-sel .m-goodcnt .itm a {
  display: block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.a-w-sel .m-goodcnt .itm:hover img,
.a-w-sel .m-goodcnt .itm:hover .txt,
.a-w-sel .m-goodcnt .itm:hover a {
  transform: scale(1.05) !important;
}

/* ── 缩略图遮罩：默认隐藏（去蓝），悬停主题色 ── */

/* 默认状态：强制透明，彻底干掉 Lofter 的蓝色 */
.a-w-sel .m-goodcnt .itm .icover,
.a-w-sel .m-goodcnt .itm a .icover {
  background: transparent !important;
  opacity: 0 !important;
  transition: background 0.2s ease, opacity 0.2s ease !important;
  pointer-events: none !important;
}

/* 悬停状态：主题色半透明遮罩 */
.a-w-sel .m-goodcnt .itm:hover .icover,
.a-w-sel .m-goodcnt .itm a:hover .icover {
  background: ${s.theme.accent || "#888"} !important;
  opacity: 0.3 !important;
}

/* "更多相似达人"链接 */
.a-w-sel .m-daren a {
  display: inline-block !important;
  transition: color 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.a-w-sel .m-daren a:hover {
  transform: scale(1.04) !important;
}

/* 私信/加黑菜单项 */
.a-w-sel .menulist a {
  display: block !important;
  transition: color 0.15s ease, background 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.a-w-sel .menulist a:hover {
  transform: scale(1.02) !important;
}

/* 关注/已关注按钮 */
.a-w-sel .u-btn,
.a-w-sel .u-btn-1,
.a-w-sel .u-btn2 {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s ease !important;
}
.a-w-sel .u-btn:hover,
.a-w-sel .u-btn-1:hover,
.a-w-sel .u-btn2:hover {
  transform: scale(1.04) !important;
  filter: brightness(1.1) !important;
}
`);

    /* 导航栏层级，确保搜索下拉不被遮住 */
    out.push(`
      #lofter-top-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        z-index: 9999 !important;
      }

      /* 归档页台头 — 浅色毛玻璃 */
      body.p-body10 .g-hdfull {
        background: rgba(255, 255, 255, 0.65) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
      }
      body.p-body10 .g-hdfull .g-hd {
        background: transparent !important;
        position: relative !important;
      }
      body.p-body10 .g-hdfull a,
      body.p-body10 .g-hdfull span {
        color: #333 !important;
      }

      /* 只有新版navbar（#lofter-top-bar）才需要撑开body */
body:has(#lofter-top-bar) {
  margin-top: 84px !important;
}
/* 旧式归档页用 .g-hdfull 自然占位，不加margin */
body:has(.g-hdfull) {
  margin-top: 0 !important;
}
  body.p-body10 .g-hdfull a {
        text-shadow: none !important;
      }
      /* 筛选栏无背景，只提高层级让下拉不被遮 */
      body.p-body10 .g-bdc .m-fbar {
        position: relative !important;
        z-index: 200 !important;
        background: transparent !important;
      }

      /* 归档页筛选按钮：毛玻璃胶囊背景 */
      body.p-body10 .g-bdc .m-fbar .w-schbtn2 {
        background: rgba(255,255,255,0.75) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        border-radius: 20px !important;
        padding: 4px 14px !important;
        border: 1px solid rgba(0,0,0,0.06) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
        transition: all 0.2s ease !important;
      }
      body.p-body10 .g-bdc .m-fbar .w-schbtn2:hover {
        background: rgba(255,255,255,0.9) !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important;
      }
/* 归档页月份标题：标签样式，右侧箭头 */
body.p-body10 .m-filecnt h2 {
  display: inline-block !important;
  position: relative !important;
  background: rgba(255,255,255,0.75) !important;
  backdrop-filter: blur(8px) !important;
  border-radius: 10px 0 0 10px !important;   /* 只有左侧圆角 */
  padding: 1px 8px 1px 12px !important;       /* 更窄 */
}
/* 右侧三角形箭头 */
body.p-body10 .m-filecnt h2::after {
  content: '' !important;
  position: absolute !important;
  left: 100% !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  border-top: 21px solid transparent !important;
  border-bottom: 21px solid transparent !important;
  border-left: 16px solid rgba(255,255,255,0.75) !important;
}
      /* 文章/日期下拉圆角 */
      body.p-body10 .m-calendar,
      body.p-body10 .m-txtsch {
        position: absolute !important;
        border-radius: ${fr} !important;
        overflow: visible !important;
        box-shadow: ${shadow} !important;
      }

      /* 标签下拉圆角 */
      body.p-body10 .m-tagsch {
        position: absolute !important;
        border-radius: ${fr} !important;
        overflow: hidden !important;
        box-shadow: ${shadow} !important;
        z-index: 200 !important;
      }

      /* 归档页搜索框圆角 */
      body.p-body10 .g-bdc .m-fsch {
        background: rgba(255,255,255,0.75) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        border-radius: ${fr} !important;
        overflow: hidden !important;
        padding: 4px 8px !important;
      }
      body.p-body10 .g-bdc .m-fsch input {
        background: transparent !important;
        border: none !important;
        outline: none !important;
      }
      body.p-body10 .g-bdc .m-fsch button {
        background: transparent !important;
        border: none !important;
      }

      /* 归档页缩略图圆角 */
      body.p-body10 .m-filecnt li.img,
      body.p-body10 .m-filecnt li.text,
      body.p-body10 .m-filecnt li.movie {
        border-radius: ${fr} !important;
        overflow: hidden !important;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease !important;
      }
      body.p-body10 .m-filecnt li.img a {
        display: block !important;
      }
      body.p-body10 .m-filecnt li.img .imgwrap {
        overflow: hidden !important;
      }
      /* 悬停整个框上浮 */
      body.p-body10 .m-filecnt li.img:hover,
      body.p-body10 .m-filecnt li.text:hover,
      body.p-body10 .m-filecnt li.movie:hover {
        transform: translateY(-4px) !important;
        box-shadow: ${shadow} !important;
      }
      /* 悬停遮罩：毛玻璃暗色 — 挂在 li 自身的 ::after 上。
         站点 .info 蒙版锚定在内部 <a>（实测 115px 宽）而非 li（125px），
         width:100% 永远盖不满且偏移缺角；li::after inset:0 从根上铺满。
         .info 只保留文字层（底色透明化、垫到遮罩之上） */
      body.p-body10 .m-filecnt li.img,
      body.p-body10 .m-filecnt li.text,
      body.p-body10 .m-filecnt li.movie {
        position: relative !important;
      }
      body.p-body10 .m-filecnt li.img::after,
      body.p-body10 .m-filecnt li.text::after,
      body.p-body10 .m-filecnt li.movie::after {
        content: "" !important;
        position: absolute !important;
        inset: 0 !important;
        background: rgba(0,0,0,0.45) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
        opacity: 0 !important;
        transition: opacity .25s !important;
        pointer-events: none !important;
        z-index: 3 !important;
      }
      body.p-body10 .m-filecnt li.img:hover::after,
      body.p-body10 .m-filecnt li.text:hover::after,
      body.p-body10 .m-filecnt li.movie:hover::after {
        opacity: 1 !important;
      }
      /* 原 .info：去自身底色避免与 ::after 叠加，文字垫到遮罩之上 */
      body.p-body10 .m-filecnt li.img .info,
      body.p-body10 .m-filecnt li.text .info,
      body.p-body10 .m-filecnt li.movie .info {
        background: transparent !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        z-index: 4 !important;
      }
      /* 遮罩文字白色 + 日期不换行（"日"掉到第二行） */
      body.p-body10 .m-filecnt li.img .info em,
      body.p-body10 .m-filecnt li.img .info small,
      body.p-body10 .m-filecnt li.text .info em,
      body.p-body10 .m-filecnt li.text .info small,
      body.p-body10 .m-filecnt li.movie .info em,
      body.p-body10 .m-filecnt li.movie .info small {
        color: #fff !important;
      }
      body.p-body10 .m-filecnt li.img .info em,
      body.p-body10 .m-filecnt li.text .info em,
      body.p-body10 .m-filecnt li.movie .info em {
        white-space: nowrap !important;
      }
    `);

    /* ---------- 导航栏下拉菜单：浅色模式强制白底 ---------- */
    out.push(`
  #lofter-top-bar [class*="-content-web"] {
    background: rgba(255,255,255,0.6) !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
    border: 1px solid rgba(0,0,0,0.06) !important;
    overflow: hidden !important;
    backdrop-filter: blur(12px) !important;
  }
  #lofter-top-bar [class*="-body-web"] {
    background: rgba(255,255,255,0.6) !important;
  }
  #lofter-top-bar [class*="-boxArrow-web"] path[fill="currentColor"] {
    fill: #fff !important;
  }
  #lofter-top-bar [class*="-body-web"] a {
    color: #333 !important;
    transition: background 0.15s ease !important;
  }
  #lofter-top-bar [class*="-body-web"] a:hover {
    color: ${s.theme.accent || "#666"} !important;
    background: rgba(0,0,0,0.04) !important;
  }

    /* ---------- 定时发布页时间卡片修复（所有模式） ---------- */
    /* 自动发布卡（m-zdfb）+ 空状态卡（m-end）：底色直接画在 .isay 上，
       宽度沿用站点原生 585px，上下两卡同宽对齐、同圆角；
       内部气泡切片透明化（原气泡图/箭头不再显示）。
       暗色 rgb(225,225,219) 经反相显示 #1F1F19，浅色白卡灰边。
       特异性：需压过 buildCSS「#main > .m-mlist > .mlistcnt .isay」
       的透明规则（1,3,0），故用 html #main .mlistcnt 前缀（1,3,1） */
    html #main .mlistcnt .isay:has(.m-zdfb),
    html #main .mlistcnt .isay:has(.m-end) {
      background: ${isDarkMode() ? "rgb(225, 225, 219)" : "#fff"} !important;
      background-image: none !important;
      border: ${isDarkMode() ? "none" : "1px solid #e0e0e0"} !important;
      border-radius: ${isDarkMode() ? "12px" : (settings.card.radius || 16) + "px"} !important;
      overflow: hidden !important;
      /* 左缘与下方队列卡的气泡矩形对齐：JS 量切片左偏移写入
         --lc-zdfb-left（量不出回退 21px），宽度同步收窄保持右缘不变 */
      margin-left: var(--lc-zdfb-left, 21px) !important;
      width: calc(585px - var(--lc-zdfb-left, 21px)) !important;
      /* 与下方队列卡留出间距（跟随卡片间距设置） */
      margin-bottom: ${settings.card.gap || 15}px !important;
    }
    /* 通知栏（#noticetip 下拉面板里的 .isay）：站点同样给 585px 全宽，
       左缘突出于下方博文卡片。左缘对齐处理与队列卡一致：
       左移 21px、宽度 564px（585-21，与博文卡片 ::before 矩形同宽）。
       不依赖中间层类名，直接 #noticetip 下取 .isay */
    #noticetip .isay {
      margin-left: var(--lc-zdfb-left, 21px) !important;
      width: calc(585px - var(--lc-zdfb-left, 21px)) !important;
    }
    /* 通知条目一行布局修复：卡片收窄后原版的头像绕排关系断裂
       （文字/图标掉到头像下方）。用 flex 明确钉死 头像+内容 同排，
       不再依赖站点原始的 float 绕排，宽度变化不再影响 */
    #noticetip .cmti {
      display: flex !important;
      align-items: flex-start !important;
    }
    #noticetip .cmti > .w-img2 {
      float: none !important;
      flex: 0 0 auto !important;
      margin-right: 10px !important;
    }
    #noticetip .cmti > .cmtcnt {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      margin-left: 0 !important;
    }
    /* 内部切片全部透明化，卡片底色统一由 .isay 提供 */
    html #main .mlistcnt .isay:has(.m-zdfb) > div,
    html #main .mlistcnt .isay:has(.m-end) > div,
    html #main .mlistcnt .isay:has(.m-zdfb) .isayt3,
    html #main .mlistcnt .isay:has(.m-zdfb) .isaym3,
    html #main .mlistcnt .isay:has(.m-zdfb) .isayb,
    html #main .mlistcnt .isay:has(.m-zdfb) .isayc,
    html #main .mlistcnt .isay:has(.m-end) .isayt3,
    html #main .mlistcnt .isay:has(.m-end) .isaym3,
    html #main .mlistcnt .isay:has(.m-end) .isayb,
    html #main .mlistcnt .isay:has(.m-end) .isayc {
      background: transparent !important;
      background-image: none !important;
    }
    /* 切片伪元素装饰（原箭头/角标）隐藏，避免重影 */
    html #main .mlistcnt .isay:has(.m-zdfb) .isayt3::before,
    html #main .mlistcnt .isay:has(.m-zdfb) .isayt3::after,
    html #main .mlistcnt .isay:has(.m-zdfb) .isaym3::before,
    html #main .mlistcnt .isay:has(.m-zdfb) .isaym3::after,
    html #main .mlistcnt .isay:has(.m-end) .isayt3::before,
    html #main .mlistcnt .isay:has(.m-end) .isayt3::after,
    html #main .mlistcnt .isay:has(.m-end) .isaym3::before,
    html #main .mlistcnt .isay:has(.m-end) .isaym3::after {
      display: none !important;
    }
    /* 外层 mlistcnt 残留的卡片底矩形隐藏（长度曾被它撑长） */
    html #main .mlistcnt:has(.m-zdfb)::before,
    html #main .mlistcnt:has(.m-end)::before {
      display: none !important;
    }
    
    /* 时间文字布局：上下排列，不重叠 */
    #main .mlistimg .time {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1.3 !important;
      text-align: center !important;
    }
    #main .mlistimg .time strong {
      display: block !important;
      font-weight: 600 !important;
    }
    /* 浅色模式：灰底黑字（只针对定时发布页的时间卡片） */
    #main .mlistimg .w-img-2 {
      background: #b0b0b0 !important;
      border-radius: ${Math.round((settings.card.radius || 16) / 3)}px !important;
    }
    #main .mlistimg {
      background: transparent !important;
    }
    #main .mlistimg .w-img:not(.w-img-2) {
      background: transparent !important;
    }
    #main .mlistimg .time,
    #main .mlistimg .time strong {
      color: #222 !important;
      text-shadow: none !important;
    }
      
    /* ---------- 充值界面圆角卡片 ---------- */
    #j-recharge,
    .recharge-list-module {
      border-radius: ${settings.card.radius || 16}px !important;
      overflow: hidden !important;
    }
    .recharge-list-module {
      background: #fff !important;
      border: 1px solid #e0e0e0 !important;
      padding: 20px !important;
    }
    .pay-type-item,
    .pay-amount-item {
      border-radius: ${Math.round((settings.card.radius || 16) / 2)}px !important;
    }
    .pay-amount-item.selected {
      border: 1px solid var(--lc-accent, #667eea) !important;
    }
    .btn-recharge {
      border-radius: ${settings.card.radius || 16}px !important;
    }

/* ---------- 草稿页卡片圆角 ---------- */
/* 导航标签选中状态 */
.tab-bar-nav .tab-nav-item.selected {
  color: ${s.theme.accent || "#667eea"} !important;
  font-weight: 600 !important;
  border-radius: ${settings.card.radius || 16}px !important;
  overflow: hidden !important;
}
/* 分隔线 */
.tab-nav-sq {
  background: ${s.theme.accent || "#667eea"} !important;
  border-radius: ${settings.card.radius || 16}px !important;
}
/* 草稿/审核中心导航栏整体圆角 */
.tab-bar-nav {
  border-radius: ${settings.card.radius || 16}px !important;
  overflow: hidden !important;
}
/* 导航项 */
.tab-nav-item {
  border-radius: ${settings.card.radius || 16}px !important;
}

    /* 内容卡片 */
    .content-block {
      border-radius: ${settings.card.radius || 16}px !important;
      overflow: hidden !important;
    }
    /* 翻页区域 */
    div[class^="ui-"].noselect,
    #lpager {
      border-radius: ${settings.card.radius || 16}px !important;
      overflow: hidden !important;
    }
    
    /* ---------- 提现/钱包卡片圆角 ---------- */
    .walletarea,
    .walletarea .hdwrap,
    .walletarea .info {
      border-radius: ${settings.card.radius || 16}px !important;
      overflow: hidden !important;
    }
    .walletarea {
      background: #fff !important;
      border: 1px solid #e0e0e0 !important;
    }
    .walletarea .hdwrap {
      background: #f5f5f5 !important;
      padding: 16px 20px !important;
    }
    .walletarea .info {
      padding: 20px !important;
    }
    .cashBox {
      border-radius: ${Math.round((settings.card.radius || 16) / 2)}px !important;
    }
    .cashbtn {
      border-radius: ${settings.card.radius || 16}px !important;
    }
`);

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
      out.push(`

/* 话题页/模板页/趋势页卡片底色统一 #1F1F19（预反色值 rgb(225,225,219)）。
   白色底（插件通用规则 #fff 或站点 #fdfdfd）经反色滤镜变纯黑，这里覆盖 */
.m-temp,
.m-templist li,
.m-actlist .cont,
.m-post {
  background: rgb(225, 225, 219) !important;
}

/* 查看更多页侧边栏用户名、创作者中心文字 */
#application.lofter-root-container [class*="box-web"] p:not([class*="count-web"]) {
  color: rgba(255, 255, 255, 0.85) !important;
}
/* 创作者中心标题 */
#application.lofter-root-container [class*="box-web"] h5 {
  color: rgba(255, 255, 255, 0.85) !important;
}
/* 列表项文字（排除有自己颜色的span） */
#application.lofter-root-container [class*="box-web"] li span:first-child {
  color: rgba(255, 255, 255, 0.85) !important;
}
/* 分割线 */
#application.lofter-root-container [class*="horizontalDividingLine"] {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}
/* ===== 查看更多页右侧栏：昵称+关注数合并为整体圆角矩形 ===== */
/* 外层容器：统一毛玻璃圆角背景 */
#application.lofter-root-container [class*="box-web"]:has(> [class*="horizontalDividingLine"]) {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  overflow: hidden !important;
}
/* 昵称区内部 div 去独立背景，融入整体 */
#application.lofter-root-container [class*="box-web"] > a > div {
  background: transparent !important;
  border-radius: 0 !important;
}
/* 昵称链接悬停：深灰底色（不是白色） */
#application.lofter-root-container [class*="box-web"] > a:hover > div,
#application.lofter-root-container [class*="box-web"] > a > div:hover {
  background: rgba(255,255,255,0.06) !important;
}

/* 新版页面：下拉栏暗色毛玻璃圆角+链接悬停轻微放大 */
#application.lofter-root-container [class*="boxVisible-web"] > [class*="content-web"] {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important;
}
#application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] a {
  display: block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease !important;
}
#application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] a:hover {
  transform: scale(1.02) !important;
  background-color: transparent !important;
}
/* 合集页"管理"下拉气泡（删除合集）：暗色毛玻璃 + 白字，盖过浅色区白底规则 */
#application.lofter-root-container [class*="boxVisible-web"] [class*="content-web"] [class*="body-web"] {
  background: ${draftCard} !important;
  color: rgba(255, 255, 255, 0.9) !important;
  border-radius: 8px !important;
}
#application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] span[role="button"] {
  color: rgba(255, 255, 255, 0.9) !important;
}

/* 分割线融入整体（变细、变淡） */
#application.lofter-root-container [class*="horizontalDividingLine"] {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.06) !important;
  height: 1px !important;
  margin: 0 12px !important;
}

/* ===== 创作者中心：白底改暗色毛玻璃圆角 ===== */
#application.lofter-root-container [class*="banner-web"] {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  overflow: hidden !important;
}
/* 创作者中心内部所有子元素去白底 */
#application.lofter-root-container [class*="banner-web"] > * {
  background: transparent !important;
}
/* 创作者中心标题 */
#application.lofter-root-container [class*="banner-web"] h5,
#application.lofter-root-container [class*="banner-web"] [class*="title"] {
  color: rgba(255, 255, 255, 0.9) !important;
}
/* 创作者中心箭头图标 */
#application.lofter-root-container [class*="banner-web"] svg path {
  stroke: rgba(255, 255, 255, 0.6) !important;
}

/* 创作者中心（在 box-web 内的版本） */
#application.lofter-root-container [class*="box-web"] a[href*="creator-center"] > div,
#application.lofter-root-container [class*="box-web"] a[href*="creator-center"] > div > div {
  background: transparent !important;
}
#application.lofter-root-container [class*="box-web"] a[href*="creator-center"] h5,
#application.lofter-root-container [class*="box-web"] a[href*="creator-center"] [class*="title"] {
  color: rgba(255, 255, 255, 0.9) !important;
  background: transparent !important;
}
#application.lofter-root-container [class*="box-web"] a[href*="creator-center"] svg path {
  stroke: rgba(255, 255, 255, 0.6) !important;
}

/* ===== 新版页面：右侧栏模块暗色毛玻璃圆角 ===== */
#application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"] {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border-radius: ${fr} !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important;
  overflow: hidden !important;
  margin-bottom: 12px !important;
}
#application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"]:last-child {
  margin-bottom: 0 !important;
}

/* 新版页面：右侧栏链接悬停轻微放大 */
#application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"] a {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s ease !important;
}
#application.lofter-root-container [class*="page-web"] > div > div > div > [class*="box-web"] a:hover {
  transform: scale(1.04) !important;
}

/* ===== 查看更多页：内容区不设置暗色大容器底，保持透明 ===== */
#application.lofter-root-container [class*="box-web"] [class*="page-web"] > div:first-child > div:first-child {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
  border: none !important;
}

/* 查看更多页：文章标题 */
#application.lofter-root-container [class*="page-web"] > div:first-child > div:first-child [class*="title-web"] {
  color: rgba(255, 255, 255, 0.9) !important;
}
/* 查看更多页：摘要/描述文字 */
#application.lofter-root-container [class*="page-web"] > div:first-child > div:first-child [class*="desc-web"],
#application.lofter-root-container [class*="page-web"] > div:first-child > div:first-child [class*="content-web"] {
  color: rgba(255, 255, 255, 0.65) !important;
}
/* 查看更多页：作者昵称 */
#application.lofter-root-container [class*="page-web"] a > span:first-of-type {
  color: rgba(255, 255, 255, 0.75) !important;
  display: inline-block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
#application.lofter-root-container [class*="page-web"] a > span:first-of-type:hover {
  transform: scale(1.04) !important;
}
/* 查看更多页：时间/统计数字（:not 排除 HOT 角标——
   listItemHot 有站点自带红色，此规则会把它扫成半透明白） */
#application.lofter-root-container [class*="page-web"] a > span:last-of-type:not([class*="-listItemHot-web"]) {
  color: rgba(255, 255, 255, 0.5) !important;
}
/* 查看更多页：标签 */
#application.lofter-root-container [class*="page-web"] a[href*="/tag/"] {
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.7) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  display: inline-block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
#application.lofter-root-container [class*="page-web"] a[href*="/tag/"]:hover {
  transform: scale(1.04) !important;
}

/* ===== 关注数：保留原版黄绿色 + 悬停效果 ===== */
#application.lofter-root-container [class*="count-web"] {
  color: #8EB902 !important;
}
/* 关注数链接悬停：背景微亮 + 保持黄绿色 */
#application.lofter-root-container [class*="countItem"] a:hover,
#application.lofter-root-container [class*="countBox"] a:hover {
  background: rgba(255,255,255,0.05) !important;
}
#application.lofter-root-container [class*="countItem"] a:hover [class*="count-web"],
#application.lofter-root-container [class*="countBox"] a:hover [class*="count-web"] {
  color: #8EB902 !important;
}
/* 关注数标题（"关注"文字） */
#application.lofter-root-container [class*="countTitle"] {
  color: rgba(255, 255, 255, 0.7) !important;
}
        
/* ── 草稿页：暗色适配 ── */

/* 暗色模式：草稿页占位图反色 */
/* 只反色占位图 defimg.png，正常封面图不受影响 */
body.body .pic-area img[src*="defimg.png"] {
  filter: invert(1) brightness(0.85) !important;
}

/* 暗色：我的长文章下拉 */
body.body .header.clear .select-content.show {
  height: auto !important;
  min-height: auto !important;
  padding: 0 !important;
  background: ${draftDrop} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 12px 32px rgba(0,0,0,0.45) !important;
}

body.body .header.clear .select-content.show .hnipple {
  display: none !important;
}

body.body .header.clear .select-content.show a {
  color: rgba(255,255,255,0.9) !important;
}

body.body .header.clear .select-content.show a:hover {
  background: rgba(255,255,255,0.08) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

body.body .header.clear .select-content.show .select-word {
  color: inherit !important;
  height: auto !important;
  min-height: auto !important;
  line-height: 1.4 !important;
  padding: 14px 16px !important;
}

/* 暗色模式：Lofter Logo 反色变白 */
body.body .header.clear .lLogo,
body.body .header.clear .lofterLogos {
  filter: invert(1) brightness(1.2) !important;
}

/* 暗色模式："草稿"文字强制白色 */
body.body .header.clear .header-content {
  color: rgba(255,255,255,0.9) !important;
  text-shadow: none !important;
}
/* 导航栏暗色毛玻璃 */
body.body .header.clear {
  background: ${draftNav} !important;
  border-bottom-color: rgba(255,255,255,0.08) !important;
}
/* 暗色模式：草稿页所有文字变白，包括链接和子元素 */
body.body .words-area,
body.body .words-area *,
body.body .words-area a,
body.body .words-area a:link,
body.body .words-area a:visited,
body.body .words-area span,
body.body .dotbox a,
body.body .dotbox a:link,
body.body .dotbox a:visited,
body.body .dotbox span {
  color: rgba(255,255,255,0.9) !important;
}
/* 时间小字稍淡 */
body.body .timer,
body.body .timer span,
body.body .timer em {
  color: rgba(255,255,255,0.7) !important;
}

/* 列表项分隔线调暗 */
body.body .content-block {
  border-bottom-color: rgba(255,255,255,0.08) !important;
}
/* 写文章按钮：背景正常主题色，文字白色，不受反色影响 */
body.body .header.clear a[href*="new/long"] {
  background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  border-radius: 20px !important;
  filter: none !important; /* 关键：清除继承的反色 */
}
body.body .header.clear .head-edit {
  color: #fff !important;
  filter: none !important;
}

/* 暗色草稿卡片 */
body.body .content-block {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
}
body.body .content-block:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.35) !important;
}

/* 草稿页内容亮度同步 */
body.body .content-block .timerp,
body.body .content-block .words-area,
body.body .content-block .words-area * {
  filter: brightness(${b}) !important;
}
body.body .content-block .pic-area img:not([src*="defimg.png"]) {
  filter: brightness(${b}) !important;
}
/* 占位图：invert + 同步亮度 */
body.body .pic-area img[src*="defimg.png"] {
  filter: invert(1) brightness(${Math.max(0.3, 0.85 * b)}) !important;
}

/* 时间区暗色弱化 */
body.body .timerp,
body.body .timerp span {
  color: rgba(255,255,255,0.55) !important;
}

/* 垃圾箱暗色悬停底 */
body.body .oimg-del {
  background: rgba(255,255,255,0.06) !important;
}
body.body .oimg-del:hover {
  background: rgba(255,255,255,0.14) !important;
}

/* 暗色翻页卡片 */
body.body div[class^="ui-"].noselect,
body.body #lpager {
background: ${draftCard} !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
}

/* 暗色：所有项去边框 */
body.body div[class^="ui-"].noselect span.pgi,
body.body div[class^="ui-"].noselect span.frg,
body.body #lpager span.pgi,
body.body #lpager span.frg {
  color: rgba(255,255,255,0.75) !important;
  border: none !important;
  border-width: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
}

/* 暗色悬停：用正常（亮色）主题色，在深色底上才明显 */
body.body div[class^="ui-"].noselect span.pgi:not([class*="js-zslt"]):hover,
body.body #lpager span.pgi:not([class*="js-zslt"]):hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;        /* ← 直接用原始亮色 */
  transform: scale(1.08) !important;
  text-shadow: 0 0 12px color-mix(in srgb, ${s.theme.accent} 50%, transparent) !important;
  background: rgba(255,255,255,0.06) !important;
}

/* 暗色省略号 */
body.body div[class^="ui-"].noselect span.frg,
body.body #lpager span.frg {
  color: rgba(255,255,255,0.35) !important;
}

/* 翻页按钮文字亮度同步 */
body.body div[class^="ui-"].noselect span.pgi,
body.body #lpager span.pgi,
body.body div[class^="ui-"].noselect span.frg,
body.body #lpager span.frg {
  filter: brightness(${b}) !important;
}

/* ── 下拉菜单：暗色毛玻璃 + 白字 ── */
body#longpost-publish-page .m-hd-longpost .u-select-menu,
body#longpost-publish-page .m-hd-longpost #menu-post,
body#longpost-publish-page .m-hd-longpost #menu-music {
  background: ${draftDrop} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45) !important;
}
/* 菜单项：白色文字 */
body#longpost-publish-page .m-hd-longpost .u-select-menu .item {
  color: rgba(255, 255, 255, 0.9) !important;
  border-bottom-color: rgba(255, 255, 255, 0.06) !important;
}
body#longpost-publish-page .m-hd-longpost .u-select-menu .item:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  /* 该页面不在反色区（暗色文字均直接写亮色），悬停直接用主题色 */
  color: ${s.theme.accent || "#667eea"} !important;
}
/* 暗色箭头 */
body#longpost-publish-page .m-hd-longpost .u-select-menu .arrow,
body#longpost-publish-page .m-hd-longpost .u-select-menu .arrow2 {
  border-bottom-color: rgba(25, 25, 30, 0.88) !important;
}

/* 暗色模式：图标反色成白色，确保可见 */
body#longpost-publish-page .m-hd-longpost .right > a.btn-icon,
body#longpost-publish-page .m-hd-longpost .right > a.btn-arrow {
  filter: invert(1) brightness(1.2) !important;
}

/* 发布按钮文字保持白色，不受反色影响 */
body#longpost-publish-page .m-hd-longpost .right > a.btn-publish {
  color: #fff !important;
  filter: none !important;
}

/* 封面图去白框 */
body#longpost-publish-page .m-main .banner {
  border: none !important;
}

/* 编辑器 iframe 区域暗色底 */
body#longpost-publish-page .edui-editor-iframeholder {
  background: rgba(255,255,255,0.06) !important;
  border-radius: calc(${fr} * 0.6) !important;
}

/* 工具栏暗色 */
body#longpost-publish-page .edui-editor-toolbarboxouter {
  background: rgba(255,255,255,0.05) !important;
  border-bottom: 1px solid rgba(255,255,255,0.08) !important;
}
body#longpost-publish-page .edui-toolbar .edui-box {
  color: rgba(255,255,255,0.7) !important;
}

/* 长文章页导航栏暗色 */
body#longpost-publish-page .m-hd-longpost {
background: ${draftNav} !important;
  backdrop-filter: blur(16px) saturate(120%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(120%) !important;
  border-bottom: 1px solid rgba(255,255,255,0.08) !important;
}
body#longpost-publish-page .m-hd-longpost * {
  color: rgba(255,255,255,0.9) !important;
}

body#longpost-publish-page .m-main {
  background: ${draftMain} !important;
  border-color: rgba(255,255,255,0.08) !important;
  filter: none !important;
}
/* 文字改白色 */
body#longpost-publish-page .m-main textarea,
body#longpost-publish-page .m-main .edui-editor,
body#longpost-publish-page .m-main label {
  color: rgba(255,255,255,0.85) !important;
  background: transparent !important;
}
/* 暗色模式：顶部文字恢复白色 */
body#longpost-publish-page .m-hd-longpost .txt-long,
body#longpost-publish-page .m-hd-longpost .txt-save-auto {
  color: rgba(255,255,255,0.9) !important;
}
/* 标题/导语分割线调暗 */
body#longpost-publish-page .m-main textarea#title {
  border-bottom-color: rgba(255,255,255,0.12) !important;
}
body#longpost-publish-page .m-main textarea#pre {
  border: none !important;
  border-bottom: none !important;
}
/* 图片不反色 */
body#longpost-publish-page .m-main img {
  filter: none !important;
}

/* Logo 反色变白 */
body#longpost-publish-page .m-hd-longpost .logo,
body#longpost-publish-page .m-hd-longpost #main-logo {
  filter: invert(100%) brightness(1.2) !important;
}
/* 封面图占位区域：暗色底+虚线框 */
body#longpost-publish-page .banner {
  background: rgba(255,255,255,0.06) !important;
  border: 1px dashed rgba(255,255,255,0.2) !important;
}
/* 占位提示文字调亮 */
body#longpost-publish-page .dragContainer,
body#longpost-publish-page #dragContainer {
  color: rgba(255,255,255,0.55) !important;
}
/* 中间的加号图标也反色 */
body#longpost-publish-page #icon-add,
body#longpost-publish-page .icon-add {
  filter: invert(100%) brightness(1.2) !important;
}

/* ── 上传封面失败提示弹窗（#alert-tip）：暗色毛玻璃 ──
   该页不在反色区，直接写暗色：#1F1F19 半透明卡片 + 浅色文字 + 圆角，
   确定键跟随主题色 */
body#longpost-publish-page #alert-tip {
  background: rgba(31, 31, 25, 0.88) !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border-radius: 12px !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45) !important;
}
body#longpost-publish-page #alert-tip .txt {
  color: rgba(255, 255, 255, 0.9) !important;
}
body#longpost-publish-page #alert-tip .btn-sure {
  background: ${s.theme.accent || "#667eea"} !important;
  color: #333 !important;
  border: none !important;
  border-radius: 999px !important;
  transition: filter 0.15s ease !important;
}
body#longpost-publish-page #alert-tip .btn-sure:hover {
  filter: brightness(1.1) !important;
}
body#longpost-publish-page #alert-tip .icon-close {
  filter: invert(1) brightness(1.2) !important;
  opacity: 0.7 !important;
}


/* 私信页暗色 */
#msgcontainer {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
}
#msgcontainer img {
  filter: invert(100%) hue-rotate(180deg) !important;
}

      /* 通知卡片：暗色毛玻璃 */
.g-mn:has(#blognotice) {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
}
.g-mn:has(#blognotice) img {
  filter: invert(100%) hue-rotate(180deg) !important;
}
  /* 通知页翻页区域也反色 */
.g-bdc:has(#blognotice) #pager {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
  background: transparent !important;
}
/* .g-bdc 本身透明，防止漏白 */
.g-bdc:has(#blognotice) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
.g-mn:has(#blognotice) {
  border: none !important;
  box-shadow: none !important;
}
.g-bd3:has(#blognotice) {
  background: transparent !important;
}

/* 丢失内容已保存到文章发布器中弹窗：暗色毛玻璃 */
.m-tmsg .tmsg {
  background: rgba(25,25,30,0.82) !important;
  border-color: rgba(255,255,255,0.1) !important;
  color: rgba(255,255,255,0.9) !important;
}

/* 新建回礼方案按钮：暗色主题色 */
main.lc-gift-dark > div > button {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  background: transparent !important;
}
main.lc-gift-dark > div > button:hover {
  background: color-mix(in srgb, ${s.theme.accent} 15%, transparent) !important;
}

/* 拍摄地点：只让内层灰底 div 高度跟内容，不动外层 */
.lc-dialog-dark [role="button"] > div {
  height: auto !important;
  align-self: center !important;
  padding-top: 2px !important;
  padding-bottom: 2px !important;
}

      /* 选择礼物弹窗：全选文字白色 */
      .lc-dialog-dark.lc-dialog-gift-picker p {
        color: rgba(255,255,255,0.85) !important;
      }

      /* 创作声明弹窗：暗色专属。
         ① 文字（添加创作声明/各开关标签/声明项，站点自带深色 span）→ 浅字；
            div 文字已由上面 .rc-dialog-body div 通用规则覆盖 */
      .lc-dialog-dark.lc-dialog-declaration span {
        color: rgba(255, 255, 255, 0.85) !important;
      }
      /* ② 内层面板（来源已自主标注/授权转载/自行拍摄一组，站点
         #f5f5f5 浅灰底）：通用规则只把它刷成透明，这里给一档
         深灰面板保持分组感。特异性和顺序都要压过通用透明规则 */
      .lc-dialog-dark .lc-dialog-declaration .rc-dialog-body div[class*="_1hIzZGYs7lyIH2Jz7mDL6g"] {
        background: #2B2B25 !important;
        border-radius: 12px !important;
      }

            /* switch 按钮：主题色覆盖 */
      .lc-dialog-dark .rc-switch.rc-switch-checked {
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
      }
      .lc-dialog-dark .rc-switch:not(.rc-switch-checked) {
        background: rgba(255,255,255,0.15) !important;
        border-color: rgba(255,255,255,0.2) !important;
      }
      .lc-dialog-dark .rc-switch:hover {
        border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
      }

      /* ============================================================
       * 统一弹窗暗色基础（rc-dialog 体系）
       * 覆盖：选择礼物、确认关闭、以及未来所有 rc-dialog
       * ============================================================ */
      .lc-dialog-dark {
        background: ${draftModal} !important;
        border-radius: ${fr} !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        box-shadow: 0 16px 48px rgba(0,0,0,0.45) !important;
        color: rgba(255,255,255,0.9) !important;
      }
      /* ⚠️ 毛玻璃只给不含编辑器的弹窗：展开写作区是弹窗内部的
         position:fixed 层，backdrop-filter 会把弹窗卡片变成 fixed
         后代的 containing block（同章节编辑页 KrL5Oe6b 教训），
         暗色下展开层被关进卡片、无法像浅色一样铺满视口。
         含编辑器 iframe 的弹窗（首页发布文字等）禁用模糊，
         卡片底色由 JS 内联 #1a1a1a 保底（不透明，无透底问题） */
      .lc-dialog-dark:not(:has(iframe[title="editor"])) {
        backdrop-filter: blur(20px) saturate(160%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
      }
      /* 首页发布文字弹窗：展开写作区暗色实底——通用暗色规则
         （.rc-dialog-body div:not(:empty) 清透明背景）把展开层
         （_3J7ln+v8TbCPnT，position:fixed 贴满视口、站点写
         background:#fff）的底色也清掉了，展开后盖不住后面页面。
         这里以更高特异性写回不透明 #1a1a1a（与卡片内联底同色），
         展开后只剩标题 + 输入框（对齐浅色专注视图）。
         （首版把基类误读成 _3Ji7n——截图 i/7 之差，未命中） */
      .lc-dialog-dark
        div[class*="_3J7ln-Cqb7p8UKaKPbmhRw"][class*="v8TbCPnT0AbKm5+DAKo1NQ"]:not(:empty) {
        background: #1a1a1a !important;
      }

      /* 关闭按钮 */
      .lc-dialog-dark .rc-dialog-close {
        background: transparent !important;
      }
      .lc-dialog-dark .rc-dialog-close svg path[fill="#2E2E2E"] {
        fill: rgba(255,255,255,0.7) !important;
      }
      .lc-dialog-dark .rc-dialog-close:hover svg path {
        fill: ${s.theme.accent} !important;
      }

      /* header / 标题 */
      .lc-dialog-dark .rc-dialog-header,
      .lc-dialog-dark header {
        background: transparent !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
      }
      .lc-dialog-dark .rc-dialog-title,
      .lc-dialog-dark .rc-dialog-title div,
      .lc-dialog-dark header {
        color: rgba(255,255,255,0.9) !important;
      }

      /* body / 正文 */
      .lc-dialog-dark .rc-dialog-body,
      .lc-dialog-dark .rc-dialog-body div {
        color: rgba(255,255,255,0.85) !important;
      }
      /* 去白底只作用于"有内容"的 div：空 div 常靠 background 显示插图/图标/装饰，
         若一并置为 transparent 会把图片清掉（如"合集创建成功"弹窗的插图 div） */
      .lc-dialog-dark .rc-dialog-body,
      .lc-dialog-dark .rc-dialog-body div:not(:empty) {
        background: transparent !important;
      }

      /* footer */
      .lc-dialog-dark .rc-dialog-footer,
      .lc-dialog-dark footer {
        background: transparent !important;
        border-top: 1px solid rgba(255,255,255,0.08) !important;
      }

      /* 按钮统一 */
      .lc-dialog-dark .lc-dialog-btn-ok {
        background: ${s.theme.accent || "#667eea"} !important;
        color: #fff !important;
        border: 1px solid ${s.theme.accent || "#667eea"} !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .lc-dialog-dark .lc-dialog-btn-ok:hover {
        filter: brightness(0.85) !important;
      }

      .lc-dialog-dark .lc-dialog-btn-cancel {
        background: rgba(255,255,255,0.1) !important;
        color: rgba(255,255,255,0.8) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .lc-dialog-dark .lc-dialog-btn-cancel:hover {
        background: rgba(255,255,255,0.15) !important;
        color: #fff !important;
      }

      /* 合集“添加文章”弹窗 */
      /* 未悬停时文章卡片的白边调暗一点（纯白偏亮）——边框在内层混淆 div 上 */
      .lc-dialog-dark .post-item > div {
        border-color: rgba(255, 255, 255, 0.35) !important;
      }
      /* 悬停/勾选边框主题色（写在调暗规则之后，悬停时覆盖上面的暗边） */
      .lc-dialog-dark .post-item:hover > div,
      .lc-dialog-dark .post-item:has(.rc-checkbox-checked) > div {
        border-color: ${s.theme.accent || "#667eea"} !important;
      }
      /* 勾选框选中态主题色 */
      .lc-dialog-dark span.rc-checkbox.post-check.rc-checkbox-checked .rc-checkbox-inner {
        background-color: ${s.theme.accent || "#667eea"} !important;
        border-color: ${s.theme.accent || "#667eea"} !important;
      }
      /* emoji：弹窗不在 #main 反色区内，全局的“抵消反色”filter 在这里
         反而会把 emoji 真正反色（浅变深、深变浅）→ 弹窗内还原不滤镜 */
      .lc-dialog-dark .lc-emoji-wrap {
        filter: none !important;
      }
      /* 月份标题 / 文章数亮度（“3篇文章”原色偏深看不清） */
      .lc-dialog-dark .rc-dialog-body h2,
      .lc-dialog-dark .rc-dialog-body h2 em {
        color: rgba(255, 255, 255, 0.9) !important;
      }
      .lc-dialog-dark .rc-dialog-body h2 small {
        color: rgba(255, 255, 255, 0.75) !important;
      }

            /* ── Portal 挂载组件暗色适配（日期选择器 + 级联选择器）── */
      /* 所有层级强制实底 */
      html body .lofter-common-date-picker-dropdown,
      html body .lofter-common-date-picker-panel-container,
      html body .lofter-common-date-picker-panel,
      html body .lofter-common-date-picker-date-panel,
      html body .lofter-common-cascader-menus,
      html body .lofter-common-cascader-menu {
        background-color: rgba(35, 35, 42, 0.98) !important;
        background: rgba(35, 35, 42, 0.98) !important;
        background-image: none !important;
      }

      /* 级联菜单项 */
      html body .lofter-common-cascader-menu-item {
        color: rgba(255,255,255,0.85) !important;
        background: transparent !important;
        transition: all 0.15s ease !important;
      }
      html body .lofter-common-cascader-menu-item:hover {
        background: rgba(255,255,255,0.08) !important;
        color: #fff !important;
      }

      /* 日期头部 */
      html body .lofter-common-date-picker-header {
        background: transparent !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
      }
      html body .lofter-common-date-picker-header button {
        color: rgba(255,255,255,0.9) !important;
        background: transparent !important;
      }
      html body .lofter-common-date-picker-header svg path {
        stroke: rgba(255,255,255,0.7) !important;
      }

      /* 星期 */
      html body .lofter-common-date-picker-content th {
        color: rgba(255,255,255,0.5) !important;
      }

      /* 日期数字 */
      html body .lofter-common-date-picker-cell-inner {
        color: rgba(255,255,255,0.85) !important;
        background: transparent !important;
        border-radius: 50% !important;
        transition: all 0.15s ease !important;
      }
      html body .lofter-common-date-picker-cell:not(.lofter-common-date-picker-cell-in-view) .lofter-common-date-picker-cell-inner {
        color: rgba(255,255,255,0.3) !important;
      }

      /* 悬停：主题色圆底 + 白字 */
      html body .lofter-common-date-picker-cell:hover .lofter-common-date-picker-cell-inner {
        background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        color: #fff !important;
      }

      /* 今天 */
      html body .lofter-common-date-picker-cell-today .lofter-common-date-picker-cell-inner {
        border: 1.5px solid ${s.theme.accent} !important;
        color: ${s.theme.accent || "#667eea"} !important;
      }
      html body .lofter-common-date-picker-cell-today:hover .lofter-common-date-picker-cell-inner {
        background-color: ${s.theme.accent || "#667eea"} !important;
        background: ${s.theme.accent || "#667eea"} !important;
        color: #fff !important;
      }

      /* 选中 */
      html body .lofter-common-date-picker-cell-selected .lofter-common-date-picker-cell-inner,
      html body .lofter-common-date-picker-cell-active .lofter-common-date-picker-cell-inner {
        background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        color: #fff !important;
      }

      /* ============================================================
       * 特殊弹窗微调（只写差异部分）
       * ============================================================ */

      /* ── 选择礼物：checkbox ── */
      .lc-dialog-gift-picker .lc-gift-checkbox .rc-checkbox-inner {
        background: transparent !important;
        border-color: rgba(255,255,255,0.25) !important;
      }
      .lc-dialog-gift-picker .lc-gift-checkbox.rc-checkbox-checked .rc-checkbox-inner {
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
      }
      .lc-dialog-gift-picker .lc-gift-checkbox.rc-checkbox-checked .rc-checkbox-inner svg path {
        stroke: #fff !important;
      }
      .lc-dialog-gift-picker .lc-gift-checkbox:hover .rc-checkbox-inner {
        border-color: rgba(255,255,255,0.4) !important;
      }

      /* 选择礼物：列表项 */
      .lc-dialog-gift-picker .lc-gift-item {
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        background: transparent !important;
      }
      .lc-dialog-gift-picker .lc-gift-item:last-child {
        border-bottom: none !important;
      }
      .lc-dialog-gift-picker .lc-gift-item p {
        color: rgba(255,255,255,0.9) !important;
      }
      .lc-dialog-gift-picker .lc-gift-item p:last-of-type {
        color: rgba(255,255,255,0.5) !important;
      }
      .lc-dialog-gift-picker img {
        filter: none !important;
      }
      /* ========== 礼物设置弹窗暗色适配 ========== */
      .lc-gift-dark {
        background: ${draftModal} !important;
        backdrop-filter: blur(20px) saturate(160%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
        border-radius: ${fr} !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        box-shadow: 0 16px 48px rgba(0,0,0,0.45) !important;
        color: rgba(255,255,255,0.9) !important;
      }

            /* 内容区底部那条亮线 */
      .lc-gift-dark ul > li {
        border-bottom-color: rgba(255,255,255,0.08) !important;
      }

            /* 上下分隔线调暗 */
      .lc-gift-dark header,
      .lc-gift-dark header::after,
      .lc-gift-dark header::before {
        border-bottom-color: rgba(255,255,255,0.08) !important;
      }
      .lc-gift-dark footer::before,
      .lc-gift-dark footer::after {
        background: rgba(255,255,255,0.08) !important;
      }
      .lc-gift-dark hr,
      .lc-gift-dark [class*="divider"],
      .lc-gift-dark [class*="separator"] {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.08) !important;
      }

      /* 标题、正文、label、span 统一浅色 */
      .lc-gift-dark header,
      .lc-gift-dark p,
      .lc-gift-dark span,
      .lc-gift-dark label {
        color: rgba(255,255,255,0.9) !important;
      }

      /* 关闭按钮 X 改浅色 */
      .lc-gift-dark svg path[fill="#2E2E2E"] {
        fill: rgba(255,255,255,0.7) !important;
      }

      /* 输入框 / textarea */
      .lc-gift-dark .lc-gift-input {
        background: rgba(255,255,255,0.08) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.9) !important;
        border-radius: calc(${fr} * 0.6) !important;
      }
      .lc-gift-dark .lc-gift-input::placeholder {
        color: rgba(255,255,255,0.45) !important;
      }

      /* 字数统计 */
      .lc-gift-dark input[type="text"] + span {
        color: rgba(255,255,255,0.5) !important;
      }

      /* radio 未选中 */
      .lc-gift-dark .lc-gift-label:not([data-checked="true"]) svg circle {
        fill: rgba(255,255,255,0.2) !important;
      }
      /* radio 选中：主题色 */
      .lc-gift-dark .lc-gift-label[data-checked="true"] svg circle {
        fill: ${s.theme.accent} !important;
      }

      /* 上传区域图标 */
      .lc-gift-dark svg path[fill="#CCC"] {
        fill: rgba(255,255,255,0.4) !important;
      }

      /* 胶囊标签（反虐、背景前因、if线 等） */
      .lc-gift-dark .lc-gift-tag {
        background: rgba(255,255,255,0.08) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.85) !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .lc-gift-dark .lc-gift-tag:hover {
        background: rgba(255,255,255,0.15) !important;
        border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        color: #fff !important;
      }

      /* 底部按钮区 */
      .lc-gift-dark footer {
        border-top: 1px solid rgba(255,255,255,0.08) !important;
      }

      /* 确定按钮 */
      .lc-gift-dark .lc-gift-btn-ok {
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        color: #fff !important;
        border: 1px solid ${s.theme.accent} !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .lc-gift-dark .lc-gift-btn-ok:hover {
        filter: brightness(1.1) !important;
      }

      /* 取消按钮 */
      .lc-gift-dark .lc-gift-btn-cancel {
        background: rgba(255,255,255,0.1) !important;
        color: rgba(255,255,255,0.8) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .lc-gift-dark .lc-gift-btn-cancel:hover {
        background: rgba(255,255,255,0.15) !important;
        color: #fff !important;
      }

      /* 粮票图片不反色 */
      .lc-gift-dark img {
        filter: none !important;
      }

      /* 箭头图标 */
      .lc-gift-dark svg path[stroke="currentColor"] {
        stroke: rgba(255,255,255,0.6) !important;
      }

      /* 发布按钮暗色模式（仅图片发布弹窗）：抵消父层 filter，保持主题色 */
${
  s.theme.accent
    ? `
.publishlayerwrap .publishBtn, .publishlayerwrap .publishArea a.zdwn {
  filter: invert(100%) hue-rotate(180deg) !important;
}
.publishlayerwrap .publishBtn:hover, .publishlayerwrap .publishArea a.zdwn:hover {
  filter: invert(100%) hue-rotate(180deg) brightness(1.1) !important;
}
.publishlayerwrap .publishArea a.zdwn {
  background-image: none !important;
}
`
    : ""
}

/* 创建合集图标：抵消父层反色，保持原始主题色 + 白加号 */
#collection-create-but button div:first-child,
#collection-create-but div[class*="xw-"] {
  filter: invert(100%) hue-rotate(180deg) !important;
}

           /* ========== 弹窗暗色毛玻璃覆盖 ========== */
      .a-scale-layer,
      .a-scale {
        background: transparent !important;
        box-shadow: none !important;
      }
      .m-layer {
        background: ${draftDrop} !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        /* 关键：阴影改淡，避免在暗色背景上形成大黑块 */
        box-shadow: 0 4px 24px rgba(0,0,0,0.35) !important;
        border-radius: ${fr} !important;
        overflow: hidden !important;
      }
      .m-layer .warmt,
      .m-layer .warmc,
      .m-layer h3,
      .m-layer h4 {
        color: rgba(255,255,255,0.9) !important;
      }
      .m-layer .w-close2 {
        color: rgba(255,255,255,0.5) !important;
      }
      .m-layer .w-close2:hover {
        color: ${s.theme.accent || "#ccc"} !important;
      }

      /* 确认按钮：直接用正常主题色，不加反向 filter */
      .m-layer .w-sbtn.w-sbtn-0 {
        background: ${s.theme.accent || "#667eea"} !important;
        background-image: none !important;
        color: #fff !important;
        border-color: ${s.theme.accent || "#667eea"} !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
        filter: none !important;   /* ← 关键：去掉反向 filter */
      }
      .m-layer .w-sbtn.w-sbtn-0:hover {
        filter: brightness(1.1) !important;
      }

      /* 取消按钮暗色适配 */
      .m-layer .w-sbtn.w-sbtn-3 {
        background: rgba(255,255,255,0.1) !important;
        color: rgba(255,255,255,0.8) !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .m-layer .w-sbtn.w-sbtn-3:hover {
        background: rgba(255,255,255,0.15) !important;
        color: #fff !important;
      }

      /* ── 手机预览 / 电脑预览：暗色适配 ── */
      .w-pagelayer.mobilePreviewLayer .lycover,
      .w-pagelayer.pcPreviewLayer .lycover {
        background-color: rgba(18, 18, 22, 0.92) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
      }
      .w-pagelayer.mobilePreviewLayer .lyscroll,
      .w-pagelayer.pcPreviewLayer .lyscroll,
      .w-pagelayer.mobilePreviewLayer .lybody,
      .w-pagelayer.pcPreviewLayer .lybody,
      .w-pagelayer.mobilePreviewLayer .lycont,
      .w-pagelayer.pcPreviewLayer .lycont,
      .w-pagelayer.pcPreviewLayer .pcPreview,
      .w-pagelayer.mobilePreviewLayer .mobilePreview {
        background-color: rgba(28, 28, 34, 0.98) !important;
      }
      .w-pagelayer.mobilePreviewLayer .lyscroll,
      .w-pagelayer.pcPreviewLayer .lyscroll,
      .w-pagelayer.mobilePreviewLayer .lybody,
      .w-pagelayer.pcPreviewLayer .lybody,
      .w-pagelayer.mobilePreviewLayer .lycont,
      .w-pagelayer.pcPreviewLayer .lycont,
      .w-pagelayer.pcPreviewLayer .pcPreview,
.w-pagelayer.mobilePreviewLayer .mobilePreview,
.w-pagelayer.pcPreviewLayer .pcPreview *,
.w-pagelayer.mobilePreviewLayer .mobilePreview * {
  color: rgba(255,255,255,0.8) !important;
}
.w-pagelayer.pcPreviewLayer .pcPreview .lead,
.w-pagelayer.mobilePreviewLayer .mobilePreview .lead {
  color: rgba(255,255,255,0.7) !important;
}
      /* 大标题：纯白 */
      .w-pagelayer.mobilePreviewLayer .title,
      .w-pagelayer.pcPreviewLayer .title {
        color: #fff !important;
      }
      /* 导语：去白底 + 略灰文字 */
      .w-pagelayer.mobilePreviewLayer .lead,
      .w-pagelayer.pcPreviewLayer .lead {
        background-color: transparent !important;
        color: rgba(255,255,255,0.7) !important;
      }
      .w-pagelayer.mobilePreviewLayer .lyscroll h1,
      .w-pagelayer.mobilePreviewLayer .lyscroll h2,
      .w-pagelayer.mobilePreviewLayer .lyscroll h3,
      .w-pagelayer.pcPreviewLayer .lyscroll h1,
      .w-pagelayer.pcPreviewLayer .lyscroll h2,
      .w-pagelayer.pcPreviewLayer .lyscroll h3,
      .w-pagelayer.mobilePreviewLayer .lybody h1,
      .w-pagelayer.mobilePreviewLayer .lybody h2,
      .w-pagelayer.mobilePreviewLayer .lybody h3,
      .w-pagelayer.pcPreviewLayer .lybody h1,
      .w-pagelayer.pcPreviewLayer .lybody h2,
      .w-pagelayer.pcPreviewLayer .lybody h3,
      .w-pagelayer.pcPreviewLayer .pcPreview h1,
      .w-pagelayer.pcPreviewLayer .pcPreview h2,
      .w-pagelayer.pcPreviewLayer .pcPreview h3,
      .w-pagelayer.mobilePreviewLayer .mobilePreview h1,
      .w-pagelayer.mobilePreviewLayer .mobilePreview h2,
      .w-pagelayer.mobilePreviewLayer .mobilePreview h3 {
        color: #fff !important;
      }
      .w-pagelayer.mobilePreviewLayer .lyscroll a,
      .w-pagelayer.pcPreviewLayer .lyscroll a,
      .w-pagelayer.mobilePreviewLayer .lybody a,
      .w-pagelayer.pcPreviewLayer .lybody a,
      .w-pagelayer.pcPreviewLayer .pcPreview a,
      .w-pagelayer.mobilePreviewLayer .mobilePreview a {
        color: ${s.theme.accent || "#8ab4f8"} !important;
      }
      .w-pagelayer.mobilePreviewLayer .lyscroll a:hover,
      .w-pagelayer.pcPreviewLayer .lyscroll a:hover,
      .w-pagelayer.mobilePreviewLayer .lybody a:hover,
      .w-pagelayer.pcPreviewLayer .lybody a:hover,
      .w-pagelayer.pcPreviewLayer .pcPreview a:hover,
      .w-pagelayer.mobilePreviewLayer .mobilePreview a:hover {
        color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#aecbfa"} !important;
      }
      .w-pagelayer.mobilePreviewLayer .lyscroll img[src*="defimg"],
      .w-pagelayer.pcPreviewLayer .lyscroll img[src*="defimg"],
      .w-pagelayer.mobilePreviewLayer .lybody img[src*="defimg"],
      .w-pagelayer.pcPreviewLayer .lybody img[src*="defimg"],
      .w-pagelayer.pcPreviewLayer .pcPreview img[src*="defimg"],
      .w-pagelayer.mobilePreviewLayer .mobilePreview img[src*="defimg"] {
        filter: invert(1) brightness(0.85) !important;
      }

      /* ── 已发布长文章页：暗色适配 ── */
      html body .g-bd .m-cnt {
        background-color: rgba(28, 28, 34, 0.98) !important;
      }
      html body .g-bd .m-cnt .title {
        color: #fff !important;
      }
      html body .g-bd .m-cnt .info .name,
      html body .g-bd .m-cnt .info .time {
        color: rgba(255,255,255,0.7) !important;
      }
      html body .g-bd .m-cnt .nav-desc {
        background: transparent !important;
        color: rgba(255,255,255,0.6) !important;
      }
      html body .g-bd .m-cnt .long-text,
      html body .g-bd .m-cnt .long-text p {
        color: rgba(255,255,255,0.9) !important;
      }
      html body .g-bd .m-cnt .post {
        background: transparent !important;
      }
      html body .g-bd .m-cnt .post .copyright,
      html body .g-bd .m-cnt .post .copyright .txt {
        color: rgba(255,255,255,0.5) !important;
      }
      html body .g-bd .m-cnt .post .author .name {
        color: rgba(255,255,255,0.8) !important;
      }
      html body .g-bd .m-cnt .post .act-area .txt {
        color: rgba(255,255,255,0.7) !important;
      }
      /* 长文章卡片暗色背景 */
      html body .g-bd .banner {
        background-color: rgba(28, 28, 34, 0.98) !important;
      }
      html body .g-bd .m-cnt {
        background-color: rgba(28, 28, 34, 0.98) !important;
      }
      html body .g-bd .m-recom {
        background: rgba(40, 40, 48, 0.95) !important;
        padding: 16px !important;
      }
      html body .g-bd .m-recom .intro {
        color: rgba(255,255,255,0.8) !important;
      }
      html body .g-bd .m-recom .u-post-list .item {
        border-bottom-color: rgba(255,255,255,0.1) !important;
      }
      html body .g-bd .m-recom .u-post-list .tit {
        color: #fff !important;
      }
      html body .g-bd .m-recom .u-post-list .desc {
        color: rgba(255,255,255,0.6) !important;
      }
      html body .g-bd .m-recom .u-post-list .author .name {
        color: rgba(255,255,255,0.7) !important;
      }
      /* ── .m-recom 内评论区：暗色模式文字变白 ── */
      /* "评论(n)" 标题 */
      html body .g-bd .m-recom .show-comment-num span,
      /* 评论用户名 - 暴力覆盖 Lofter 原始绿色 s-fc2 */
      html body .g-bd .m-recom .bcmtlstj a,
      html body .g-bd .m-recom .bcmtlstj a.s-fc2,
      html body .g-bd .m-recom .bcmtlstj a.bcmtlstk,
      html body .g-bd .m-recom .bcmtlstj a.itag,
      html body .g-bd .m-recom .bcmtlstj a.s-fc2.itag.bcmtlstk,
      /* 冒号 + 评论内容 */
      html body .g-bd .m-recom .bcmtlstj span,
      html body .g-bd .m-recom .bcmtlstj span.s-fc4,
      html body .g-bd .m-recom .bcmtlstj span.bcmtlstf,
      html body .g-bd .m-recom .bcmtlstj span.itag,
      html body .g-bd .m-recom .bcmtlstj span.bcmtlstf.s-fc4.itag,
      /* 回复提示文字 */
      html body .g-bd .m-recom .bcmtlstj span.s-fc3,
      html body .g-bd .m-recom .bcmtlstj .s-fc3,
      /* 时间/来源小字 */
      html body .g-bd .m-recom .bcmtlstj .s-fc1,
      html body .g-bd .m-recom .bcmtlstj .s-fc2 {
        color: rgba(255,255,255,0.9) !important;
      }
      /* 评论内容文字单独加亮 */
      html body .g-bd .m-recom .bcmtlstj span.bcmtlstf.s-fc4.itag,
      html body .g-bd .m-recom .bcmtlstj .bcmtlstf.itag {
        color: rgba(255,255,255,0.95) !important;
      }
      /* 评论输入框：暗色背景 + 白字 + 覆盖 s-bg0 白底 */
      html body .g-bd .m-recom .bcmtipt,
      html body .g-bd .m-recom .bcmtiptc,
      html body .g-bd .m-recom .editdiv,
      html body .g-bd .m-recom [contenteditable="true"],
      html body .g-bd .m-recom .editdiv.s-fc0,
      html body .g-bd .m-recom .editdiv.ztag {
        background-color: rgba(255,255,255,0.08) !important;
        background: rgba(255,255,255,0.08) !important;
        color: rgba(255,255,255,0.9) !important;
        border-color: rgba(255,255,255,0.15) !important;
      }
      /* 输入框 placeholder 颜色 */
      html body .g-bd .m-recom .editdiv:empty:before,
      html body .g-bd .m-recom [contenteditable="true"]:empty:before,
      html body .g-bd .m-recom .editdiv::placeholder {
        color: rgba(255,255,255,0.5) !important;
      }
      /* 评论输入框居中 */
      html body .g-bd .m-recom .bcmtipt {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: 90% !important;
      }
      html body .g-bd .m-recom .bcmtiptc {
        text-align: center !important;
      }
      html body .g-bd .m-recom .editdiv,
      html body .g-bd .m-recom [contenteditable="true"] {
        margin-left: auto !important;
        margin-right: auto !important;
      }
      html body .g-bd:has(.banner) {
        background-color: transparent !important;
      }
      .AddTagWin .tip {
        color: rgba(255,255,255,0.9) !important;
      }
      .AddTagWin .close.winbtn {
        color: rgba(255,255,255,0.5) !important;
        cursor: pointer !important;
      }
      .AddTagWin .close.winbtn:hover {
        color: ${s.theme.accent || "#ccc"} !important;
      }
      /* 确认按钮：主题色 */
      .AddTagWin .btn-block .btn.winbtn.f-left {
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        color: #fff !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .AddTagWin .btn-block .btn.winbtn.f-left:hover {
        filter: brightness(1.1) !important;
      }
      /* 取消按钮：半透明底 */
      .AddTagWin .btn-block .btn.winbtn.f-right {
        background: rgba(255,255,255,0.1) !important;
        color: rgba(255,255,255,0.8) !important;
        border-radius: calc(${fr} * 0.6) !important;
        transition: all 0.2s ease !important;
      }
      .AddTagWin .btn-block .btn.winbtn.f-right:hover {
        background: rgba(255,255,255,0.15) !important;
        color: #fff !important;
      }

      /* ---------- Emoji 抵消反色 ---------- */
/* 旧版页面：抵消 filter 反色 */
.lc-emoji-wrap {
  display: inline-block !important;
  filter: invert(100%) hue-rotate(180deg) !important;
}

/* 新版页面：没有 filter 反色，不需要抵消，保持原样 */
#application.lofter-root-container .lc-emoji-wrap {
  filter: none !important;
}

/* 搜索下拉栏：强制清除 emoji 反向 filter */
[class*="box-web"] [class*="sql-"] .lc-emoji-wrap {
  filter: none !important;
}

/* 写文章弹窗下拉栏：强制清除 emoji 反向 filter */
[data-selector-options-box="true"] .lc-emoji-wrap {
  filter: none !important;
}

/* 首页右侧栏(#rside 反色区)：关注/粉丝数、HOT、emoji 颜色补偿。
   #rside 整体 filter: invert+hue-rotate+brightness，站点原色显示会变深；
   用 computeDarkAccent 预置反色值 + element brightness 抵消父层调暗，
   显示效果与合集页（无反色区）一致 */
#rside p[class*="count-web"] {
  color: ${computeDarkAccent("#8EB902")} !important;
  filter: brightness(${(100 / (settings.darkMode.brightness || 90)).toFixed(3)}) !important;
}
#rside span[class*="listItemHot-web"] {
  color: ${computeDarkAccent("#FF6C93")} !important;
  filter: brightness(${(100 / (settings.darkMode.brightness || 90)).toFixed(3)}) !important;
}
#rside .lc-emoji-wrap {
  filter: invert(100%) hue-rotate(180deg) brightness(${(100 / (settings.darkMode.brightness || 90)).toFixed(3)}) !important;
}

/* ── 暗色模式：#main / #rside 内链接悬停保持主题色 ── */
${
  s.theme.accent
    ? `
#main a:hover:not(.w-sbtn):not(#j-participate-act):not(.cnt):not(.isaym):not(.isayt):not(.isay):not(.apply-btn):not(.sign-btn),
#main .publishernick:hover,
#main .m-mlist .opti > a:hover,
#main .whosep a:hover,
#main a.s-fc4.xtag:hover,
#rside a:hover {
  color: ${computeDarkAccent(s.theme.accent)} !important;
}`
    : ""
}

/* ── 趋势页 Lightbox 按钮：反向 filter 恢复正常主题色 ── */
body:has(.m-vw-nav) .w-pagelayer-postlayer .m-focuson .btn.xtag,
body:has(.m-vw-nav) .g-popup .m-focuson .btn.xtag,
body:has(.m-vw-nav) #j-pop .m-focuson .btn.xtag {
  filter: invert(100%) hue-rotate(180deg) !important;
}
/* 悬停时保持反向 filter，再叠加亮度 */
body:has(.m-vw-nav) .w-pagelayer-postlayer .m-focuson .btn.xtag:hover,
body:has(.m-vw-nav) .g-popup .m-focuson .btn.xtag:hover {
  filter: invert(100%) hue-rotate(180deg) brightness(1.1) !important;
}

/* 暗色模式：始终加反向 filter，避免移开时闪烁 */
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .cola > a,
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .colb > a.name {
  filter: invert(100%) hue-rotate(180deg) !important;
}
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .cola > a:hover,
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .colb > a.name:hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  transform: scale(1.05) !important;
}
/* ── 批量管理页暗色：查询下拉 ── */
html body.p-body7 .m-calendar,
html body.p-body7 .m-calendar.ztag,
html body.p-body7 .m-tagsch,
html body.p-body7 .m-tagsch.m-tagsch-1,
html body.p-body7 .m-tagsch.ztag {
  background: rgba(28, 28, 34, 0.95) !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
  border-radius: 12px !important;
  overflow: hidden !important;
}
html body.p-body7 .m-calendar table td,
html body.p-body7 .m-calendar table th {
  border-color: rgba(255, 255, 255, 0.08) !important;
}
html body.p-body7 .m-calendar .year,
html body.p-body7 .m-calendar .month {
  color: rgba(255, 255, 255, 0.9) !important;
}
/* 有作品的月份：白色文字 */
html body.p-body7 .m-calendar .count {
  color: rgba(255, 255, 255, 0.9) !important;
}
/* 有作品的月份格子 */
html body.p-body7 .m-calendar li:not(.empty) a,
html body.p-body7 .m-calendar li:not(.empty) em {
  color: rgba(255, 255, 255, 0.9) !important;
}
/* 空月份：浅灰色文字 */
html body.p-body7 .m-calendar li.empty,
html body.p-body7 .m-calendar li.empty a,
html body.p-body7 .m-calendar li.empty em {
  background: transparent !important;
  color: rgba(255, 255, 255, 0.55) !important;   /* ← 提高到 0.55 */
}
/* 暗色模式：标签项文字 */
html body.p-body7 .m-tagsch a.ttag,
html body.p-body7 .m-tagsch a.ttag i {
  color: rgba(255, 255, 255, 0.85) !important;
}
html body.p-body7 .m-tagsch a.ttag:hover,
html body.p-body7 .m-tagsch a.ttag:hover i {
  background: rgba(255, 255, 255, 0.08) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* ── 批量管理页暗色：月份标题 + 文章数胶囊底（上移定位）── */
body.p-body7 .m-filecnt h2 em {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
}
body.p-body7 .m-filecnt h2 small {
  background: rgba(0, 0, 0, 0.35) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
}

/* ── 批量管理页暗色：帖子卡片（li.ptag 站点 #ddd 灰卡）→ 暗卡 + 浅字 ── */
body.p-body7 .m-filecnt li.ptag {
  background: rgba(255, 255, 255, 0.07) !important;
  border-radius: 8px !important;
}
body.p-body7 .m-filecnt li.ptag,
body.p-body7 .m-filecnt li.ptag * {
  color: #d9d9d9 !important;
}
body.p-body7 .m-filecnt li.ptag .info {
  color: #a5a5a5 !important;
}

/* ── 批量管理页暗色：卡片悬停主题色遮罩 ── */
body.p-body7 .m-filecnt li.ptag::after {
  background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
body.p-body7 .m-filecnt li.ptag:hover::after {
  opacity: 0.18 !important;
}
/* ── 批量管理页暗色：选中态主题色 ── */
body.p-body7 .m-filecnt li.ptag.selected .sel {
  border: 4px solid ${s.theme.accent || "#667eea"} !important;
}
body.p-body7 .m-filecnt li.ptag.selected {
  outline: none !important;
  box-shadow: none !important;
}
body.p-body7 .m-filecnt li.ptag.selected .selcover {
  background: ${s.theme.accent ? s.theme.accent : "#667eea"} !important;
  opacity: 0.3 !important;
}
body.p-body7 .m-filecnt li.ptag.selected .w-cc,
body.p-body7 .m-filecnt li.ptag.selected .seltag {
  background-color: ${s.theme.accent ? s.theme.accent : "#667eea"} !important;
}
body.p-body7 .m-filecnt li.ptag.selected .selsel {
  background-color: transparent !important;
  border: none !important;
  left: auto !important;
  right: 7px !important;
  top: 10px !important;
}
body.p-body7 .m-filecnt li.ptag.selected .w-cc {
  left: 0px !important;
  top: 78px !important;
}

/* ── 批量管理页暗色：编辑授权弹层主题色 ── */
body.p-body7 .m-layer .cclist li:hover {
  background-color: ${s.theme.accent || "#667eea"} !important;
  color: #fff !important;
}
body.p-body7 .m-layer .cclist li.checked,
body.p-body7 .m-layer .cclist li:has(.cctag:checked) {
  background-color: transparent !important;
  color: inherit !important;
}
body.p-body7 .m-layer .cclist .cctag[type="radio"]:checked {
  accent-color: ${s.theme.accent || "#667eea"} !important;
}

/* ── 批量管理页暗色：编辑授权弹层文字提亮 ── */
body.p-body7 .m-layer .cclist li,
body.p-body7 .m-layer .cclist li label {
  color: rgba(255, 255, 255, 0.7) !important;
}
body.p-body7 .m-layer .cclist li:hover,
body.p-body7 .m-layer .cclist li:hover label {
  color: #fff !important;
}

/* 热度数字、评论者昵称、翻页按钮悬停：用正常亮色主题色 */
.day a:hover,
.bcmtlstb a:hover,
.page .prev.active a:hover,
.page .next.active a:hover {
  color: ${s.theme.accent || "#667eea"} !important;
}

/* 个人主页：自绘标题（.lc-post-title，图片/视频/提问箱共用）与月份链接
   位于 .postwrapper 反色区内，悬停需写暗色变体（正常主题色经反色显示
   为暗色，用户看到的"暗色主题色"即此），覆盖上方面向浅色的兜底规则 */
.lc-post-title:hover,
.month a:hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

${
  s.theme.accent
    ? `
/* 发现页+达人页 .g-bdc 内 hover（覆盖所有有 .g-bdc 的页面）*/
.g-bdc a:hover {
  color: ${computeDarkAccent(s.theme.accent)} !important;
}

/* 发现-话题页：卡片内标题（真实类名 a.tit，控制台证实）。
   此页在反色滤镜区内，全局悬停规则已排除 .tit（写亮色会被反相成暗紫），
   这里显式写暗色变体，经页面滤镜显示为正常主题色 */
body:has(.m-vw-nav) .g-bdc a.tit:hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* 趋势页 */
body:has(#masonryWrap) #masonryWrap a:hover {
  color: ${computeDarkAccent(s.theme.accent)} !important;
}

/* 归档页（去掉 > 直接子选择器）*/
body.p-body10 .g-bdc a:hover,
body.p-body10 .g-sd a:hover {
  color: ${computeDarkAccent(s.theme.accent)} !important;
}

/* 归档页悬停夺回：全局 a:hover 巨型 :not 链（3418 行，特异性约
   (1,26,7)）会压过上面的预反色规则，把原始主题色写进反色区，
   经反相显示成脏紫色。这里复制同一条 :not 链并加 body.p-body10
   前缀抬高特异性（约 (1,28,8)）稳赢；经页面反色滤镜后显示为
   正常主题色（与浅色模式悬停观感一致） */
body.p-body10 .g-bdc a:hover:not(.w-sbtn):not(.cashbtn):not(#j-participate-act):not(.cnt):not(.isaym):not(.isayt):not(.isay):not(.apply-btn):not(.sign-btn):not(.m-info .btn):not(.apply-btn):not(.sign-btn):not(.m-templist .name):not(.m-nav3 a):not(.m-temp .w-ftt3 a):not(.m-goodblog1 .ttl):not(.m-goodtag1 a):not(.m-goodblog1 .tag):not(.m-goodblog1 .f2):not(.ztag):not(.xtag):not(.linkinvite):not(.lc-post-title):not(.month a):not(.tit):not([class*="iYtrszmUYaccvUMmBbXQiw"] a),
body.p-body10 .g-sd a:hover:not(.w-sbtn):not(.cashbtn):not(#j-participate-act):not(.cnt):not(.isaym):not(.isayt):not(.isay):not(.apply-btn):not(.sign-btn):not(.m-info .btn):not(.apply-btn):not(.sign-btn):not(.m-templist .name):not(.m-nav3 a):not(.m-temp .w-ftt3 a):not(.m-goodblog1 .ttl):not(.m-goodtag1 a):not(.m-goodblog1 .tag):not(.m-goodblog1 .f2):not(.ztag):not(.xtag):not(.linkinvite):not(.lc-post-title):not(.month a):not(.tit):not([class*="iYtrszmUYaccvUMmBbXQiw"] a) {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
`
    : ""
}


      #rside .m-menu:has(.participate-user-title-w),
.g-box:has(.participate-user-title-w) {
  background-color: rgb(225, 225, 219) !important;
  background: rgb(225, 225, 219) !important;
}

       /* 回到顶层 */
      #main,
.postwrapper,
.box.wid700:not(.postwrapper) {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
}

/* #rside 不能整体加 filter：filter 会让内部 position:fixed 的后代
   （站点 JS 滚动时给 slide-bar 内混淆类名 DIV 加的跟随定位）改为相对
   #rside 定位，滚动跟随失效。改为对直接子元素逐个反色。
   跟随改用 sticky 自行实现（sticky 不受祖先 filter 影响），站点运行时
   加的 fixed 由 JS（neutralizeRsideFixed）钉回 static 防错位 */
#rside > * {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
}

/* 右侧栏滚动跟随（暗色）：#rside 自身 sticky，滚过顶栏后整栏跟随，
   到达父容器底部自然停住；90px 与浅色模式跟随位置对齐 */
#rside {
  position: sticky !important;
  top: 90px !important;
  align-self: flex-start !important;
}

/* tag 页右侧栏不跟随滚动：tag 页侧栏是参与用户列表（内容短），
   整栏 sticky 跟随反而碍事，钉回 static 随页面自然滚走 */
body:has(.tag-header-w) #rside {
  position: static !important;
  top: auto !important;
}

/* 右侧栏创作者中心卡片：预反色深灰（反相显示 #1F1F19）。
   原靠暗色应用时 JS 注入内联色，站点滚动切换 fixed/重建面板会丢内联
   样式回退白底反相成纯黑——改为 CSS 直接压住全模式规则的 #fff */
#rside #slide-bar [class*="-box-web"] {
  background-color: rgb(225, 225, 219) !important;
}

/* 翻页按钮：反向 filter 恢复正常颜色 */
.postwrapper .page {
  filter: invert(100%) hue-rotate(180deg) !important;
}
/* 翻页按钮悬停：文字变白色 */
.postwrapper .page .prev.active a:hover,
.postwrapper .page .next.active a:hover {
  color: #ffffff !important;
}
/* 卡片背景：浅色（会被 filter 反色成暗灰） */
.postwrapper .block {
  background-color: rgb(225, 225, 219) !important;
}

/* 导航栏单独处理：暗色蒙版 + 强制白字 */
#lofter-top-bar {
  background: rgba(30, 30, 35, 0.85) !important;
  background-image: none !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

#lofter-top-bar a:hover {
  color: ${s.theme.accent || "#ccc"} !important;
}

/* 下拉菜单链接悬停主题色 */
#lofter-top-bar [class*="content-web"] a:hover,
#lofter-top-bar [class*="body-web"] a:hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* 下拉箭头 SVG 颜色 */
#lofter-top-bar [class*="boxArrow-web"] path[fill="currentColor"] {
  fill: rgba(255,255,255,0.9) !important;
}

     /* 图片/视频单独反转回来 */
      #main img, #main video,
      #rside img,
      #publishBarArea img,
      .postwrapper img, .postwrapper video,
      .box.wid700:not(.postwrapper) img {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
     /* 主题色元素排除 filter */
      .w-sbtn.w-sbtn-0,
      #j-participate-act,
      .m-tabbar .j-crt,
      .tab-li .j-crt,
      .tab-li:has(.j-crt) {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
     /* 白色icon反转回来 */
      span.w-icn3,
      a.vicon {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
      /* 深色模式：达人页V标改回白色 */
body:has(.m-vw-nav) .vicon {
  filter: invert(100%) hue-rotate(180deg) !important;
}
      /* 发布栏头像反转回来 */
      #publishBarArea li.user img {
        filter: invert(100%) hue-rotate(180deg) !important;
      }

      /* ── 个人主页设置：保存按钮暗色模式适配 ── */
      .pright.btnbar .w-sbtn.w-sbtn-0 {
        filter: none !important;
        background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        background-image: none !important;
        color: #fff !important;
        border: none !important;
        box-shadow: inset 0 -4px 6px rgba(0,0,0,0.12) !important;
      }
      .pright.btnbar .w-sbtn.w-sbtn-0:hover {
        filter: none !important;
        background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        color: #fff !important;
      }
      /* 取消按钮：只取消反色，其他保持原版 */
      .pright.btnbar .w-sbtn:not(.w-sbtn-0) {
        filter: none !important;
      }

      /* ── 发现页深色（趋势/话题/标签/达人/专题/风格模板）── */
/* 发现页主体反色：通过 .m-vw-nav 识别 */
body:has(.m-vw-nav) .g-bdc,
body:has(.m-vw-nav) .g-hdview,
body:has(.m-vw-nav) .g-hd {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
}

/* 发现页图片/视频反回正常 */
body:has(.m-vw-nav) .g-bdc img,
body:has(.m-vw-nav) .g-bdc video,
body:has(.m-vw-nav) .g-hdview img,
body:has(.m-vw-nav) .m-actlist img,
body:has(.m-vw-nav) .m-actlist video,
body:has(.m-vw-nav) .g-bdc .m-goodblog1 video,
body:has(.m-vw-nav) .g-bdc .m-postlst video {
  filter: invert(100%) hue-rotate(180deg) !important;
}
/* 草稿页导航：使用正常主题色，不用暗色变体 */
/* 深色模式：用 computeDarkAccent 还原 + 反向 filter 抵消 #main 的 invert */
/* 浅色模式：直接用原始主题色，不加 filter */
${
  isDarkMode()
    ? `
body.body .tab-bar-nav .tab-nav-item.selected,
.tab-bar-nav .tab-nav-item.selected {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  filter: invert(100%) hue-rotate(180deg) !important;
}
body.body .tab-nav-sq,
.tab-nav-sq {
  background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  filter: invert(100%) hue-rotate(180deg) !important;
}

/* 草稿页胶囊背景改深灰（经 #main 反色后显示为 rgb(30,30,36)） */
.tab-bar-nav {
  background-color: rgb(225, 225, 219) !important;
}
/* 选中项文字改正确主题色（预置反色值 + filter:none，避免 filter 副作用） */
body.body .tab-bar-nav .tab-nav-item.selected,
.tab-bar-nav .tab-nav-item.selected {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  filter: none !important;
}
`
    : `
body.body .tab-bar-nav .tab-nav-item.selected,
.tab-bar-nav .tab-nav-item.selected {
  color: ${s.theme.accent || "#667eea"} !important;
}
body.body .tab-nav-sq,
.tab-nav-sq {
  background: ${s.theme.accent || "#667eea"} !important;
}
`
}
}

/* 标签页图片反回正常（已在全局 img 中覆盖，这里补文字） */
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .itm .tag {
  filter: invert(100%) hue-rotate(180deg) !important;
}
/* 暗色模式竖条：反向 filter 恢复正常主题色 */
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .w-huoy .js-act b {
  filter: invert(100%) hue-rotate(180deg) !important;
}

/* 发现页选中状态/主题色排除（防止 hue-rotate 后变色） */
${
  s.theme.accent
    ? `
body:has(.m-vw-nav) .m-vw-nav .j-crt::after,
body:has(.m-vw-nav) .m-vw-nav .j-curr::after {
  background-color: ${s.theme.accent} !important;
}`
    : ""
}

/* ── 充值/钱包页面暗色适配 ── */
/* 钱包卡片 */
.walletarea,
.recharge-list-module {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
}
.walletarea .hdwrap {
  background: ${draftNav} !important;
  border-bottom: 1px solid rgba(255,255,255,0.08) !important;
}
/* cashBox 暗色背景 */
.walletarea .cashBox,
#tipBox.cashBox,
#giftBox .cashBox,
#subsidyBox .cashBox,
#liveBox .cashBox {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
}
/* 文字变白 */
.walletarea *,
.recharge-list-module * {
  color: rgba(255,255,255,0.9) !important;
}
/* 金额数字：正常主题色（钱包页为直接适配，非 invert 区域，勿用 computeDarkAccent） */
.walletarea .summoney,
.walletarea .gift-money,
.walletarea .liveMoney {
  color: ${s.theme.accent || "#667eea"} !important;
}
/* 按钮：正常主题色 + 悬停轻微放大，文字保持白色 */
.walletarea .cashbtn,
.recharge-list-module .btn-recharge {
  background: ${s.theme.accent || "#667eea"} !important;
  color: #fff !important;
  border: none !important;
  display: inline-block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  transform-origin: center center !important;
}
.walletarea .cashbtn:hover,
.walletarea .docash .cashbtn:hover,
.recharge-list-module .btn-recharge:hover {
  color: #fff !important;
  transform: scale(1.05) !important;
}
/* 充值选项 */
.pay-type-item,
.pay-amount-item {
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
}
.pay-amount-item.selected {
  border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  background: color-mix(in srgb, ${s.theme.accent} 15%, transparent) !important;
}
/* 图标不反色 */
.walletarea img,
.recharge-list-module img,
.icon-pay,
.icon-alipay,
.icon-wechatpay,
.icon-balance {
  filter: none !important;
}
/* 勾选框 */
.icon-check-box {
  border-color: rgba(255,255,255,0.3) !important;
}
.icon-check-box.checked {
  background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
/* 协议链接：正常主题色 + 悬停轻微放大 */
.agreement-link {
  color: ${s.theme.accent || "#667eea"} !important;
  display: inline-block !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  transform-origin: center center !important;
}
.agreement-link:hover {
  transform: scale(1.05) !important;
}

/* 发现页顶部栏文字强制白色（反色后） */
body:has(.m-vw-nav) .g-hdview a,
body:has(.m-vw-nav) .g-hd a,
body:has(.m-vw-nav) .g-hd span {
  color: #fff !important;
}

/* 发现页头像不反色（如果有） */
body:has(.m-vw-nav) .g-hdview img,
body:has(.m-vw-nav) .g-hd img {
  filter: none !important;
}

      ${
        s.theme.accent
          ? `
        /* 创作者中心侧边栏：抵消 #rside 的 filter 反色 */
        #rside #slide-bar a:hover {
          color: ${computeDarkAccent(s.theme.accent)} !important;
        }
      `
          : ""
      }

      /* 查看更多页昵称区悬停：暗色模式下用白色底，反色后变深灰 */
      #rside #slide-bar [class*="-box-web"] > a:hover > div,
      #rside #slide-bar [class*="-box-web"] > a > div:hover,
      #application [class*="box-web"] > div > a:hover > div,
      #application [class*="box-web"] > div > a > div:hover {
        background: rgba(255,255,255,0.08) !important;
      }

      /* 查看更多页列表项悬停：正常主题色 + 轻微放大 */
      #application.lofter-root-container [class*="box-web"] a[class*="listItemLink-web"] span,
      #application.lofter-root-container [class*="box-web"] a[class*="listItemLink-web"] i,
      #application.lofter-root-container [class*="box-web"] a[class*="listMiniItemLink-web"] span,
      #application.lofter-root-container [class*="box-web"] a[class*="listMiniItemLink-web"] i {
        display: inline-block !important;
        transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        transform-origin: center center !important;
      }
      #application.lofter-root-container [class*="box-web"] a[class*="listItemLink-web"]:hover span,
      #application.lofter-root-container [class*="box-web"] a[class*="listItemLink-web"]:hover i,
      #application.lofter-root-container [class*="box-web"] a[class*="listMiniItemLink-web"]:hover span,
      #application.lofter-root-container [class*="box-web"] a[class*="listMiniItemLink-web"]:hover i {
        color: ${s.theme.accent || "#667eea"} !important;
        transform: scale(1.05) !important;
      }
      /* Lofter logo 悬停：正常主题色 */
      #application.lofter-root-container a[class*="hOr4"] svg[class*="aZSNj"]:hover path,
      #application.lofter-root-container a[class*="hOr4"]:hover svg[class*="aZSNj"] path {
        fill: ${s.theme.accent || "#667eea"} !important;
      }

      /* 卡片 tag 悬停：主题色 + 轻微放大 */
      #application.lofter-root-container a[href*="/tag/"] {
        display: inline-block !important;
        transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        transform-origin: center center !important;
      }
      #application.lofter-root-container a[href*="/tag/"]:hover {
        color: ${s.theme.accent || "#667eea"} !important;
        transform: scale(1.05) !important;
      }

      /* 卡片作者昵称悬停：主题色 + 轻微放大 */
      #application.lofter-root-container span[class*="GAPw"] {
        display: inline-block !important;
        transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        transform-origin: center center !important;
      }
      #application.lofter-root-container span[class*="GAPw"]:hover {
        color: ${s.theme.accent || "#667eea"} !important;
        transform: scale(1.05) !important;
      }

  /* 深色模式下：导航行改为深色半透明 */
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) {
  background: rgba(30, 30, 35, 0.85) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
}

/* 导航行文字变浅色 */
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav a {
  color: #d0d0d0 !important;
}

/* 选中项（话题）高亮 */
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-crt a,
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-curr a {
  color: #fff !important;
}
/* 深色模式：发现页导航选中项用主题色
   .m-vw-nav 位于 .g-hdview > .g-bdc 内，两层 invert 叠加=原色，
   因此直接用正常主题色，不能用 computeDarkAccent 暗色变体 */
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-crt a,
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-curr a {
  color: ${s.theme.accent || "#667eea"} !important;
}

/* 选中项底部指示条/下划线也改主题色 */
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-crt,
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-curr {
  border-bottom-color: ${s.theme.accent || "#667eea"} !important;
}

/* 如果下划线是伪元素实现的，补一条 */
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-crt::after,
body:has(.m-vw-nav) .g-mn:has(.m-vw-nav) .m-vw-nav .j-curr::after {
  background: ${s.theme.accent || "#667eea"} !important;
}

/* ── 发现页-趋势页深色适配 ── */
/* 趋势页主体 #masonryWrap 单独反色（它不在 .g-bdc 里） */
body:has(#masonryWrap) #masonryWrap {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
}

/* 趋势页图片/视频反回正常 */
body:has(#masonryWrap) #masonryWrap img,
body:has(#masonryWrap) #masonryWrap video {
  filter: invert(100%) hue-rotate(180deg) !important;
}

/* 趋势页头像不反色 */
body:has(#masonryWrap) #masonryWrap .ava img,
body:has(#masonryWrap) #masonryWrap .userinfo img {
  filter: none !important;
}

${
  s.theme.accent
    ? `
/* 趋势页关注/喜欢按钮：显式设置正常主题色，让反向filter正确恢复 */
body:has(#masonryWrap) #masonryWrap .followbtn,
body:has(#masonryWrap) #masonryWrap .likebtn {
  filter: invert(100%) hue-rotate(180deg) !important;
}
body:has(#masonryWrap) #masonryWrap .followbtn span,
body:has(#masonryWrap) #masonryWrap .likebtn span {
  color: inherit !important;
}
`
    : `
body:has(#masonryWrap) #masonryWrap .followbtn,
body:has(#masonryWrap) #masonryWrap .likebtn {
  filter: invert(100%) hue-rotate(180deg) !important;
}
`
}
${
  s.theme.accent
    ? `
/* 趋势页关注/喜欢按钮：悬停保持正常主题色
   .followbtn/.likebtn 自身有反向 filter（5582-5585行），与 #masonryWrap 的 invert 叠加=原色，
   因此悬停直接用正常主题色，不能用 computeDarkAccent 暗色变体 */
body:has(#masonryWrap) #masonryWrap .followbtn:hover,
body:has(#masonryWrap) #masonryWrap .likebtn:hover {
  color: ${s.theme.accent || "#667eea"} !important;
  border-color: ${s.theme.accent || "#667eea"} !important;
}
`
    : ""
}

/* ── 趋势页图片查看器：浅蓝蒙版 → 暗色毛玻璃 ── */
body:has(#masonryWrap) .w-pagelayer-postlayer .lycover,
body:has(#masonryWrap) .lycover.a-show {
  background-color: rgba(18, 18, 22, 0.92) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
}

/* 全局弹窗遮罩：降低不透明度，避免发布框等被完全挡住 */
#j-pop .lycover,
.g-popup .lycover {
  background-color: rgba(18, 18, 22, 0.65) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  z-index: 1 !important;
}

/* 强制弹窗内容层浮在遮罩层之上，恢复点击 */
.g-popup,
#j-pop {
  position: relative !important;
}
.g-popup .g-bdc,
.g-popup .g-bd5,
.g-popup .w-pagelayer-postlayer,
#j-pop .g-bdc,
#j-pop .g-bd5,
#j-pop .w-pagelayer-postlayer {
  position: relative !important;
  z-index: 2 !important;
}

/* ========== 发布框遮罩层修复（无模糊版）========== */
/* 1. 遮罩层：极淡暗色、无模糊、不拦截点击、沉底 */
.zcvr.wtag,
.zcvr {
  background: rgba(18, 18, 22, 0.18) !important;
  backdrop-filter: none !important;        /* 关键：去掉模糊 */
  -webkit-backdrop-filter: none !important;
  pointer-events: none !important;
  z-index: 1 !important;
}

/* 2. 建立层叠上下文 */
.uiutil,
[class*="uiutil"] {
  position: relative !important;
}

/* 3. uiutil 内所有非遮罩元素强制浮到遮罩之上 */
.uiutil > *:not(.zcvr),
[class*="uiutil"] > *:not(.zcvr) {
  position: relative !important;
  z-index: 99999 !important;
}


/* ── 达人页作品图反色修复 ── */
/* 图片作品：.pic 是 background-image（无 img 子元素），需要反回；
   视频作品：.pic 内有 <img>，img 已由 .g-bdc img 规则反回，
   若 .pic 再反回会叠加成 3 次 invert（奇数次=反色）。
   因此用 :not(:has(img)) 排除包含 img 的 .pic。 */
body:has(.m-vw-nav) .m-postlist .pic:not(:has(img)),
body:has(.m-vw-nav) .m-post .pic:not(:has(img)),
body:has(.m-vw-nav) .fullnk .pic:not(:has(img)) {
  filter: invert(100%) hue-rotate(180deg) !important;
}

/* 如果 .layer 蒙版也跟着变色了，一起反回来 */
body:has(.m-vw-nav) .m-postlist .layer,
body:has(.m-vw-nav) .m-post .layer {
  filter: invert(100%) hue-rotate(180deg) !important;
}

      /* ── 归档页深色 ── */
      body.p-body10 .g-bdc .m-fbar,
      body.p-body10 .g-bdc > .ztag,
      body.p-body10 .g-sd {
        filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
      }
      /* 归档页图片反转回来 */
      body.p-body10 .g-bdc > .ztag img,
      body.p-body10 .g-bdc > .ztag video,
      body.p-body10 .g-sd img {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
        /* 评论区发布按钮 + 邀请页绑定按钮：反向filter恢复 */
#main .w-bbtn.w-bbtn-0,
.g-bdc:has(#inviteearea) .w-bbtn.w-bbtn-0 {
  filter: invert(100%) hue-rotate(180deg) !important;
}
#main .w-bbtn.w-bbtn-0:hover,
.g-bdc:has(#inviteearea) .w-bbtn.w-bbtn-0:hover {
  filter: invert(100%) hue-rotate(180deg) brightness(0.85) !important;
}

/* 达人-寻找好友页"绑定"键（input.w-bbtn.bindbtn.ztag）：自身带 ztag 被
   区域反色波及，且不在 #main / #inviteearea 两个既有锚点内 →
   按类名直接补偿反相，恢复正常主题色 */
.w-bbtn.w-bbtn-0.bindbtn {
  filter: invert(100%) hue-rotate(180deg) !important;
}
.w-bbtn.w-bbtn-0.bindbtn:hover {
  filter: invert(100%) hue-rotate(180deg) brightness(0.85) !important;
}

/* ── 发现-趋势页评论弹窗（#j-popup 在 .g-bdc 反色区内，不在 #main，
   上面的 #main 补偿规则覆盖不到）── */
/* 发布键：通用规则写亮主题色会被反相成暗色 → 写暗色变体显示正常主题色 */
body:has(.m-vw-nav) .g-bdc .w-bbtn.w-bbtn-0 {
  background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  background-image: none !important;
  border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  color: #fff !important;
}
/* 达人-寻找好友页"绑定"键夺回：bindbtn 带自有反补偿 filter，
   区域反相 + 自身反相抵消 → 显示的就是写入原色。上面的预反色规则
   是给趋势页无补偿发布键的，在此页误伤成暗底，这里写原始主题色。
   同页"复制链接"（input.stag.w-bbtn.w-bbtn-0，在 #inviteearea 内、
   带上方 8368 的补偿 filter）同样被预反色规则误伤成暗紫，
   一并夺回（:has(#inviteearea) 的 id 级特异性稳赢 8389） */
body:has(.m-vw-nav) .g-bdc .w-bbtn.w-bbtn-0.bindbtn,
.g-bdc:has(#inviteearea) .w-bbtn.w-bbtn-0 {
  background-color: ${s.theme.accent || "#667eea"} !important;
  background-image: none !important;
  border-color: ${s.theme.accent || "#667eea"} !important;
  color: #fff !important;
}

/* 达人-邀请页"新浪微博"悬停文字：全局 a:hover 巨型 :not 链（3418 行，
   约 (1,26,7)）把原始主题色写进反色区，经反相显示为暗紫。
   复制同链加 :has(#inviteearea) id 级前缀稳赢，写预反色值，
   显示为正常主题色（与"链接邀请"悬停同款，底色保持站点原样） */
.g-bdc:has(#inviteearea) a.sinawb:hover:not(.w-sbtn):not(.cashbtn):not(#j-participate-act):not(.cnt):not(.isaym):not(.isayt):not(.isay):not(.apply-btn):not(.sign-btn):not(.m-info .btn):not(.apply-btn):not(.sign-btn):not(.m-templist .name):not(.m-nav3 a):not(.m-temp .w-ftt3 a):not(.m-goodblog1 .ttl):not(.m-goodtag1 a):not(.m-goodblog1 .tag):not(.m-goodblog1 .f2):not(.ztag):not(.xtag):not(.linkinvite):not(.lc-post-title):not(.month a):not(.tit):not([class*="iYtrszmUYaccvUMmBbXQiw"] a) {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
/* 评论/热度弹窗卡片：站点原底为白色系，反色后呈纯黑
   → 写预反色值 rgb(225,225,219)，经反色滤镜显示为 #1F1F19。
   白底实际画在内部结构层上（外层写色会被内层白色盖住），
   需一并透明化让底色透出 */
body:has(.m-vw-nav) .g-bdc .isaym2 {
  background: rgb(225, 225, 219) !important;
  background-image: none !important;
  border-radius: 8px !important;
}
body:has(.m-vw-nav) .g-bdc .isaym2 > div,
body:has(.m-vw-nav) .g-bdc .isaym2 .isaymin,
body:has(.m-vw-nav) .g-bdc .isaym2 .m-cmt,
body:has(.m-vw-nav) .g-bdc .isaym2 .a-show,
body:has(.m-vw-nav) .g-bdc .isaym2 .shadow {
  background: transparent !important;
  background-image: none !important;
}

      body.p-body10 .g-hdfull {
        background: rgba(0, 0, 0, 0.55) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
      }
      body.p-body10 .g-hdfull a,
      body.p-body10 .g-hdfull span {
        color: #fff !important;
      }
      /* 台头文字/链接变白 */
      body.p-body10 .g-hdfull a,
      body.p-body10 .g-hdfull span {
        color: #fff !important;
      }
      /* 头像不反色 */
      body.p-body10 .g-hdfull img {
        filter: none !important;
      }
/* 个人主页台头头像：去掉黑色方框底 */
.selfinfo .logo,
.selfinfo .logo a {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 50% !important;    /* 圆形 */
  overflow: hidden !important;      /* 裁剪超出部分 */
}
.selfinfo .logo img {
  border-radius: 50% !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;     /* 填满圆形，不拉伸 */
  display: block !important;
}
/* 搜索下拉栏"X天前"日期：暗色黑底 */
span[class*="WeY35c7R15DuCplrvtXRHg=="] {
  background-color: #1a1a1a !important;
  color: rgba(255, 255, 255, 0.7) !important;
}
/* 搜索下拉栏tag：透明背景+青绿色 */
span[class*="GpLmHKrgQS9DGUHQapUffw=="] {
  background-color: transparent !important;
  color: #3CDFD8 !important;
}
/* 搜索下拉栏文章标题：透明背景+白色 */
span[class*="xzW9SPVRu-YLPnuOOrbVeQ=="] {
  background-color: transparent !important;
  color: rgba(255, 255, 255, 0.85) !important;
}
/* 搜索下拉栏"相关的人"昵称：调亮 */
span[class*="_9aliGZR2CvY0fNeZjUhe8Q=="] {
  color: rgba(255, 255, 255, 0.95) !important;
}
/* 查看更多页搜索下拉栏 tag：半透明灰底+细边框+悬停放大（JS动态包裹） */
div[class*="Orp2pg4PJFzX9iEz-4ZAWg=="] {
  overflow: visible !important;
}
div[class*="Orp2pg4PJFzX9iEz-4ZAWg=="] a[class*="AV8Mt74pTEHQXrEBEKFaUg=="] {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  overflow: visible !important;
}
.lc-tag-wrapper {
  background-color: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  border-radius: 20px !important;
  padding: 6px 14px !important;
  color: rgba(255, 255, 255, 0.85) !important;
  line-height: 1.4 !important;
  display: inline-flex !important;
  align-items: center !important;
  overflow: visible !important;
  transition: transform 0.2s ease, background-color 0.2s ease !important;
}
.lc-tag-wrapper:hover {
  transform: scale(1.05) !important;
  background-color: rgba(255, 255, 255, 0.15) !important;
}
/* 排除下拉栏内已有胶囊样式的链接 */
#application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] a[class*="AV8Mt74pTEHQXrEBEKFaUg=="] {
  display: flex !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  transform: none !important;
}
#application.lofter-root-container [class*="boxVisible-web"] [class*="body-web"] a[class*="AV8Mt74pTEHQXrEBEKFaUg=="]:hover {
  transform: none !important;
  background: transparent !important;
}
/* ── 搜索下拉"相关的文章"卡片暗色化（新版界面）──
   卡片 a 站点原生白底从未被暗色化（悬停前白卡上白字看不见）；
   旧 tag/标题规则 (0,1,1) 被后方通用文字规则盖掉。用卡片容器
   哈希链 + :is() 前缀抬到 (1,3,1)，稳压通用规则且只命中本卡 */
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] {
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 10px !important;
}
/* 标题：白字（原白卡上深字被通用规则反杀） */
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] span[class*="xzW9SPVRu-YLPnuOOrbVeQ=="] {
  color: rgba(255, 255, 255, 0.9) !important;
  background: transparent !important;
}
/* 摘要两行截断区：浅灰字 */
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] div[class*="NaLbVjQKU4txCjiAF1uqAQ"],
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] div[class*="NaLbVjQKU4txCjiAF1uqAQ"] p {
  color: rgba(255, 255, 255, 0.65) !important;
  background: transparent !important;
}
/* tag：恢复原版青绿色 */
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] span[class*="GpLmHKrgQS9DGUHQapUffw=="] {
  color: #3CDFD8 !important;
  background: transparent !important;
}
/* 日期左侧悬停白色渐变过渡 → 暗色渐变（镜像旧 #lofter-top-bar
   下拉渐变手法，透明→暗色向右压暗，保证日期可读） */
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"]::before,
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"]::after,
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] div::before,
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] div::after,
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] span::before,
:is(#application, #lofter-top-bar) div[class*="_6jmdRmxkJxVV4GXozjGUQg"] a[class*="_4tyPAsDLlqtEvrxHZfn06g"] span::after {
  background-image: linear-gradient(to right, rgba(31, 31, 25, 0) 0%, rgba(31, 31, 25, 0.9) 55%, rgba(31, 31, 25, 0.98) 100%) !important;
}
/* ── 搜索结果"相关的人"卡片暗色化 ──
   卡片 a 站点原生白底（426×88 色块），同"相关的文章"手法：
   容器链抬特异性 + 暗色毛玻璃 */
:is(#application, #lofter-top-bar) a[class*="MRJJaxvT5xObH0E5v5mcpQ=="] {
  background: rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 10px !important;
}
:is(#application, #lofter-top-bar) a[class*="MRJJaxvT5xObH0E5v5mcpQ=="]:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}
/* 昵称：白字 */
:is(#application, #lofter-top-bar) a[class*="MRJJaxvT5xObH0E5v5mcpQ=="] div[class*="_5ce8jfIGOfm5Jw7I4exBtw=="] {
  color: rgba(255, 255, 255, 0.9) !important;
}
/* ID 行：次级浅灰 */
:is(#application, #lofter-top-bar) a[class*="MRJJaxvT5xObH0E5v5mcpQ=="] div[class*="kWZNbzaOBXBYqeMR4kKrzg=="] {
  color: rgba(255, 255, 255, 0.55) !important;
}


        
      /* 归档页按键箭头反色，分割线加深 */
      body.p-body10 .m-showsd .w-arrowt2 {
        filter: brightness(0.6) !important;
      }
      body.p-body10 .m-showsd {
        border-color: #444 !important;
      }
      /* 归档页浮动栏置顶 */
      body.p-body10 .g-bdc .m-fbar {
        position: relative !important;
        z-index: 100 !important;
      }
/* ── 发现页按钮排除全局反色，恢复主题色+白字 ── */
body:has(.m-vw-nav) .apply-btn,
body:has(.m-vw-nav) .sign-btn,
body:has(.m-vw-nav) .m-info .btn {
  filter: invert(100%) hue-rotate(180deg) !important;
}
body:has(.m-vw-nav) .apply-btn:hover,
body:has(.m-vw-nav) .sign-btn:hover,
body:has(.m-vw-nav) .m-info .btn:hover {
  filter: invert(100%) hue-rotate(180deg) brightness(1.1) !important;
}
  /* ── 导航栏搜索框 + 下拉 深色适配 ── */

/* 搜索框外层容器 */
#lofter-top-bar [role="button"] {
  background: rgba(255,255,255,0.08) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
}
/* input 本体 */
#lofter-top-bar input {
  background: transparent !important;
  color: rgba(255,255,255,0.9) !important;
  caret-color: #fff !important;
}
/* input placeholder */
#lofter-top-bar input::placeholder {
  color: rgba(255,255,255,0.45) !important;
}
  /* "关注的标签" 标题调亮 */
#lofter-top-bar h5 {
  color: rgba(255,255,255,0.9) !important;
}

/* 下拉框主体：圆角 + 暗色毛玻璃
   用近不透明底（0.97）：主页新版结构下 backdrop-filter 受祖先
   层叠上下文限制不生效，0.88 底会让背后亮色内容透出与内容重叠 */
#lofter-top-bar [class*="-content-web"] {
  background: ${draftDropSolid} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border-radius: 12px !important;          /* ← 圆角 */
  border: 1px solid rgba(255,255,255,0.08) !important;
  border-top: none !important;
  box-shadow: 0 12px 32px rgba(0,0,0,0.45) !important;
  overflow: hidden !important;               /* ← 确保圆角裁切内部 */
}

/* 顶部箭头同步毛玻璃暗色 */
#lofter-top-bar [class*="-boxArrow-web"] path[fill="currentColor"] {
  fill: rgba(25, 25, 30, 0.88) !important;
}

/* 内层 body 透明，让父级背景透上来 */
#lofter-top-bar [class*="-body-web"] {
  background: transparent !important;
}

/* 如果 -box-web 是外层装饰，保持透明或同色系 */
#lofter-top-bar [class*="-box-web"] {
  background: transparent !important;
}
/* 日期前的渐变遮罩：暗色模式下改为黑色渐变，保证长标签重叠时日期可读 */
#lofter-top-bar [class*="-body-web"] span::before,
#lofter-top-bar [class*="-body-web"] span::after {
  color: rgba(255,255,255,0.5) !important;
  background: transparent !important;
  background-image: linear-gradient(to right, rgba(25,25,30,0) 0%, rgba(25,25,30,0.95) 60%, rgba(25,25,30,1) 100%) !important;
}

/* tag 胶囊：白色 → 深色
   排除 AV8Mt tag 锚点：这些锚点已被 JS 包上 .lc-tag-wrapper
   胶囊层，这里再画一层 = 双层胶囊错位重叠（主页下拉实证），
   排除后由 wrapper 单层提供胶囊，与查看更多页一致 */
#lofter-top-bar [class*="-body-web"] a:not([class*="AV8Mt74pTEHQXrEBEKFaUg=="]) {
  background: rgba(255,255,255,0.12) !important;
  color: rgba(255,255,255,0.85) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  display: inline-block !important;
  margin: 2px !important;              /* ← 给放大让出空间 */
  transition: transform 0.2s ease !important;
  transform-origin: center !important;  /* ← 从中心放大 */
}
#lofter-top-bar [class*="-body-web"] a:not([class*="AV8Mt74pTEHQXrEBEKFaUg=="]):hover {
  background: rgba(255,255,255,0.2) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  transform: scale(1.04) !important;   /* ← 稍微收敛一点，1.05 容易切 */
}

/* "其他"下拉：暗色模式覆盖（去掉胶囊样式，改成列表项）*/
#lofter-top-bar [title="其他"] [class*="-box-web"] {
  background: ${draftModal} !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
  /* 防止被默认 min-height / padding 撑长 */
  height: auto !important;
  min-height: unset !important;
  padding: 0 !important;
}
#lofter-top-bar [title="其他"] [class*="-boxArrow-web"] path[fill="currentColor"] {
  fill: rgba(25, 25, 30, 0.92) !important;
}
#lofter-top-bar [title="其他"] [class*="-body-web"] {
  /* 只保留极小的上下内边距，让列表更紧凑 */
  padding: 4px 0 !important;
}
#lofter-top-bar [title="其他"] [class*="-body-web"] a {
  background: transparent !important;
  border: none !important;
  color: rgba(255,255,255,0.85) !important;
  display: block !important;
  padding: 1px 16px !important;  /* 从 10px 减到 8px，视觉上更贴近浅色模式 */
  margin: 0 !important;          /* ← 关键：清除全局 margin: 2px */
}
#lofter-top-bar [title="其他"] [class*="-body-web"] a:hover {
  background: rgba(255,255,255,0.08) !important;
  color: #fff !important;
}

/* 下拉箭头 SVG */
#lofter-top-bar [class*="-box-web"] svg path {
  fill: rgba(255,255,255,0.6) !important;
}

/* 下拉框顶部箭头：保留并染成暗色，与下拉框背景融为一体 */
#lofter-top-bar [class*="-boxArrow-web"] {
  display: block !important;
  color: rgba(22, 22, 28, 0.98) !important;
}
#lofter-top-bar [class*="-boxArrow-web"] path[fill="currentColor"] {
  fill: rgba(22, 22, 28, 0.98) !important;
}
    `);
      /* ── 发布框内标签placeholder、合集、回礼、声明文字及图标调亮 ── */
      out.push(`
  /* 利用反色原理：把原始色设得够暗，invert 后就会变成亮白色 */
  .publishlayerwrap label.ztag,           /* "添加相关标签，用逗号或回车分隔" */
  .collectionArea,                        /* "加入合集" */
  .collectionArea *,
  .pcGiftArea,                            /* "回礼设置" */
  .pcGiftArea *,
  [class*="declare"],                     /* 创作声明（常见class）*/
  [class*="declare"] *,
  [class*="statement"],                   /* 创作声明备选 */
  [class*="statement"] *,
  [class*="copyright"],                   /* 创作声明备选2 */
  [class*="copyright"] * {
    color: #555 !important;
  }

  
/* ============================================================
 * 新版 React 页面暗色覆盖（设置页/合集页/搜索页等）
 * ============================================================ */

/* 新版页面：导航栏暗色毛玻璃 */
#application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child {
  background: ${draftNav} !important;
  border-bottom: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2) !important;
}

/* 新版页面：导航栏文字白色 */
#application.lofter-root-container [class*="box-web"] a {
  color: rgba(255,255,255,0.9) !important;
}

/* 新版页面：导航栏链接悬停主题色 */
#application.lofter-root-container [class*="box-web"] a:hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* 新版页面：导航栏搜索框暗色 */
#application.lofter-root-container [class*="box-web"] input {
  background: transparent !important;
  color: rgba(255,255,255,0.9) !important;
}

/* 新版页面：搜索框 placeholder */
#application.lofter-root-container [class*="box-web"] input::placeholder {
  color: rgba(255,255,255,0.4) !important;
}

/* 新版页面：搜索框白色胶囊（伪元素）暗色变深 */
#application.lofter-root-container [class*="box-web"] [role="button"]::before {
  background: rgba(255,255,255,0.12) !important;
}

/* 新版页面：导航栏图标白色 */
#application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg path[fill="currentColor"],
#application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg path {
  fill: rgba(255,255,255,0.7) !important;
}

/* 新版页面：导航栏图标悬停主题色（排除 logo，用正常主题色） */
#application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child a:not([class*="hOr4"]):hover svg path[fill="currentColor"],
#application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child a:not([class*="hOr4"]):hover svg path,
#application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg:not([class*="aZSNj"]):hover path[fill="currentColor"],
#application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child svg:not([class*="aZSNj"]):hover path {
  fill: ${s.theme.accent || "#667eea"} !important;
}

/* 新版页面：logo 悬停用正常主题色（不在 #rside 下，不受 filter:invert 影响）
   用更高优先级覆盖第5470行的暗色主题色 */
#application.lofter-root-container [class*="box-web"] a[class*="hOr4"] svg[class*="aZSNj"]:hover path,
#application.lofter-root-container [class*="box-web"] a[class*="hOr4"]:hover svg[class*="aZSNj"] path,
#application.lofter-root-container [class*="box-web"] h1 a[class*="hOr4"] svg[class*="aZSNj"]:hover path,
#application.lofter-root-container [class*="box-web"] h1 a[class*="hOr4"]:hover svg[class*="aZSNj"] path {
  fill: ${s.theme.accent || "#667eea"} !important;
}

/* 新版页面：内容区卡片暗色 */
#application.lofter-root-container [class*="boxGray-web"] > div:nth-child(2),
#application.lofter-root-container [class*="boxGray-web"] > div:last-child,
#application.lofter-root-container [class*="boxGray-web"] > div:nth-child(3) {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 4px 24px rgba(0,0,0,0.35) !important;
}

/* 新版页面：设置页文字白色 */
#application.lofter-root-container h2,
#application.lofter-root-container [class*="boxGray-web"] h2 {
  color: rgba(255,255,255,0.9) !important;
}

/* 新版页面：设置页正文文字。
   星号（精品连载页必填标记 oI6L8ZzA，站点跨页可能复用该哈希）除外，
   保留站点自己的红色 */
#application.lofter-root-container [class*="boxGray-web"] span:not([class*="oI6L8ZzA3hhGJbZsEK"]),
#application.lofter-root-container [class*="boxGray-web"] div,
#application.lofter-root-container [class*="boxGray-web"] label {
  color: rgba(255,255,255,0.85) !important;
}

/* 新版页面：设置页小字/说明文字 */
#application.lofter-root-container [class*="boxGray-web"] p,
#application.lofter-root-container [class*="boxGray-web"] small {
  color: rgba(255,255,255,0.55) !important;
}

/* 合集页右侧栏：关注/粉丝数字保持原版黄绿色（高优先级，盖过上方灰色 p 规则，悬停不变色） */
#application.lofter-root-container p[class*="count-web"][class*="style-"] {
  color: #8EB902 !important;
}
/* 侧栏"钱包：充值"右侧 HOT 保持原版红色（含悬停，盖过 span:last-of-type 灰色规则和悬停主题色） */
#application.lofter-root-container span[class*="style-"][class*="listItemHot-web"][class*="-web"] {
  color: #FF6C93 !important;
}

/* 新版页面：分割线 */
#application.lofter-root-container [class*="boxGray-web"] hr,
#application.lofter-root-container [class*="boxGray-web"] [class*="style-"] {
  border-color: rgba(255,255,255,0.08) !important;
}

/* 新版页面：链接文字主题色 */
#application.lofter-root-container a {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* 新版页面：按钮主题色 */
#application.lofter-root-container button {
  background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  color: #fff !important;
}

/* 合集页"创建合集"按钮及站点绿色主按钮类（如"上传合集封面"）：正常主题色（非反色值）+ 去掉原版绿色边框 */
#application.lofter-root-container button.collection-create-btn,
#application.lofter-root-container button[class*="JIADzoAEqbBXHO1IEWn2Qg"] {
  background: ${s.theme.accent || "#667eea"} !important;
  border-color: transparent !important;
  color: #fff !important;
}

/* 合集内部页：台头卡片（#lofter-collection-bar，旧版骨架 g-bdc 下、不在 #main 反色区内）
   原版白底 → 暗色 #1F1F19 + 浅色文字。用 background-color（非 shorthand），
   不清掉封面 div 的内联 background-image。图标（管理/正序/齿轮）是 currentColor 填充，
   随 div 的 color 一起提亮 */
#lofter-collection-bar div {
  background-color: #1F1F19 !important;
  color: rgba(255, 255, 255, 0.9) !important;
}
#lofter-collection-bar span {
  color: rgba(255, 255, 255, 0.9) !important;
}
/* 标签链接跟随主题色；其余链接（如"正序"）提亮 */
#lofter-collection-bar ul a {
  color: ${s.theme.accent || "#667eea"} !important;
}
#lofter-collection-bar a {
  color: rgba(255, 255, 255, 0.85) !important;
}
/* 台头内部分割线（封面信息区 border-bottom #EBEBEB）→ 暗淡但可见 */
#lofter-collection-bar > div > div {
  border-bottom-color: rgba(255, 255, 255, 0.1) !important;
}

/* 合集列表页：标题栏及合集条目之间的分割线（原 #F2F2F2 近白）→ 暗淡但可见。
   5tKx... 为标题栏混淆类（子串匹配），collection-list-item 为语义类（稳定） */
#application.lofter-root-container [class*="5tKxSAIQqBiU5x9QojEng"],
#application.lofter-root-container .collection-list-item {
  border-bottom-color: rgba(255, 255, 255, 0.1) !important;
}

/* 创建合集弹窗（rc-dialog portal 在 body 下）：标题与表单标签文字改浅色，
   暗色卡片上原版 #1F1F1F 深字看不清。"（建议尺寸）"等子 span 随继承变浅 */
.rc-dialog-title h2,
.rc-dialog [class*="fyH7gKOe450T7F3C-byx-A"] {
  color: rgba(255, 255, 255, 0.92) !important;
}

/* "合集创建成功"提示弹窗（rc-dialog-body 内含"知道了"按钮）：
   站点原版深灰字在暗色卡片上看不清 → 提亮。
   用 :has(按钮) 精确定位该弹窗；:not(:empty) 排除靠 background 显示的插图 div，
   避免文字规则波及插图 */
.rc-dialog-body:has(button[class*="bq0ueSJDmrkaSSy5O2gJQA"]) div:not(:empty) {
  color: rgba(255, 255, 255, 0.9) !important;
}
.rc-dialog-body:has(button[class*="bq0ueSJDmrkaSSy5O2gJQA"]) > div > div:first-child {
  color: rgba(255, 255, 255, 0.96) !important;
}

/* 新版页面：输入框暗色 */
#application.lofter-root-container input,
#application.lofter-root-container textarea {
  background: rgba(255,255,255,0.08) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: rgba(255,255,255,0.9) !important;
}

/* 新版页面：下拉菜单暗色毛玻璃 */
#application.lofter-root-container [class*="-box-web"] [class*="-content-web"] {
  background: ${draftDrop} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 12px 32px rgba(0,0,0,0.45) !important;
}

/* 新版页面：下拉菜单项文字 */
#application.lofter-root-container [class*="-box-web"] [class*="-content-web"] a,
#application.lofter-root-container [class*="-box-web"] [class*="-content-web"] span {
  color: rgba(255,255,255,0.9) !important;
}

/* 新版页面：下拉菜单项悬停 */
#application.lofter-root-container [class*="-box-web"] [class*="-content-web"] a:hover {
  background: rgba(255,255,255,0.08) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}


/* ========== 登录页卡片反色 ========== */
/* 登录卡片最外层容器：暗色毛玻璃背景 */
#application.lofter-root-container [class*="y9dOXpaSi55Xm5BOJ-ccbg"] {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: 0 4px 24px rgba(0,0,0,0.35) !important;
}

/* 内部容器：去掉边框 */
#application.lofter-root-container [class*="FUH3DNVjJx+OsE4HIYEG+g"],
#application.lofter-root-container [class*="_3D9SkmOSs4h0SPQj5G2QVQ"] {
  background: ${draftCard} !important;
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
  border: none !important;
  box-shadow: none !important;
}

/* 登录表单区域背景 */
#application.lofter-root-container [class*="Z5mxczJejcgm8tLoNplC5A"],
#application.lofter-root-container [class*="Watc-pOPxpr2jhFC4Z3tfA"],
#application.lofter-root-container [class*="-RMC999X5VCqOBWGKYfQRA"] {
  background: transparent !important;
}

/* 登录卡片内所有文字变白 */
#application.lofter-root-container [class*="FUH3DNVjJx+OsE4HIYEG+g"] * {
  color: rgba(255,255,255,0.9) !important;
}

/* 输入框暗色 */
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"] {
  background: transparent !important;
}
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"] input,
#application.lofter-root-container [class*="k-cHsVunPhu7MdwD+sANIg"] input {
  background: rgba(255,255,255,0.08) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: rgba(255,255,255,0.9) !important;
}
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"] input::placeholder {
  color: rgba(255,255,255,0.45) !important;
}

/* 标签页切换链接 */
#application.lofter-root-container [class*="El6mjq39qwdObY0I4AEluQ"] {
  color: rgba(255,255,255,0.6) !important;
}
#application.lofter-root-container [class*="El6mjq39qwdObY0I4AEluQ"][class*="wuEtzdLzTDyDg1G2lEGqTA"] {
  color: rgba(255,255,255,0.9) !important;
}

/* radio 未选中状态 */
#application.lofter-root-container [class*="WFKbSstWtzl9xJ4DeXod9A"] path[stroke="#EDEDED"] {
  stroke: rgba(255,255,255,0.3) !important;
}
  
/* 底部第三方登录区域 */
#application.lofter-root-container [class*="YJkQ1LXCEoaw9SIKfhyTKQ"] {
  background: transparent !important;
}
#application.lofter-root-container [class*="e2y2eiMDq8qZkopUtwRISw"] a {
  color: rgba(255,255,255,0.8) !important;
}

/* ========== 登录按钮：正常主题色（覆盖全局暗色变体）========== */
#application.lofter-root-container button[class*="AaRSlfX5LcBgEqyHokS0hg"] {
  background: ${s.theme.accent || "#667eea"} !important;
  background-image: none !important;
  color: #fff !important;
  border: none !important;
  filter: none !important;
}
#application.lofter-root-container button[class*="AaRSlfX5LcBgEqyHokS0hg"]:hover {
  filter: brightness(1.1) !important;
}
`);
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
      out.push(`
/* ========== 登录页主题色（浅色/深色通用）========== */

/* 站点绿色主按钮类（创建合集/上传合集封面等，弹窗 portal 在 body 下，
   故不加 #application 前缀）：统一跟随主题色、去掉绿框 */
button[class*="JIADzoAEqbBXHO1IEWn2Qg"] {
  background: ${s.theme.accent} !important;
  background-image: none !important;
  border-color: transparent !important;
  color: #fff !important;
}

/* 邀请共创者"加号"图标（currentColor 填充，mask id 稳定不随构建混淆） */
svg:has(mask[id*="setting-add"]) {
  color: ${s.theme.accent} !important;
}

/* 合集弹窗"共创模式上线"横幅：原版绿色渐变 → 主题色渐变（浅暗通用，
   暗色下原版为透明底白字，统一为主题色渐变）*/
[class*="UglLZSnPpST5S56LNV5wgA"] {
  background: linear-gradient(90deg, ${s.theme.accent}, color-mix(in srgb, ${s.theme.accent} 75%, #fff)) !important;
  color: #fff !important;
}

/* 创建合集弹窗：合集名称 / 合集简介 输入框的 placeholder 颜色随模式
   （站点暗色残留会让 placeholder 在浅色下仍是白色，故用 placeholder 文案做锚点强制覆盖。
   重复类名 .rc-dialog.rc-dialog 抬选择器优先级；同时写 -webkit-text-fill-color 与 opacity，
   防止站点用这两个属性间接染色）*/
.rc-dialog.rc-dialog input[placeholder*="不超过15"]::placeholder,
.rc-dialog.rc-dialog input[placeholder*="不超过15"]::-webkit-input-placeholder,
.rc-dialog.rc-dialog textarea[placeholder*="快速了解合集内容"]::placeholder,
.rc-dialog.rc-dialog textarea[placeholder*="快速了解合集内容"]::-webkit-input-placeholder {
  color: ${isDarkMode() ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)"} !important;
  -webkit-text-fill-color: ${isDarkMode() ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)"} !important;
  opacity: 1 !important;
}

/* 登录按钮：正常主题色 */
#application.lofter-root-container button[class*="AaRSlfX5LcBgEqyHokS0hg"] {
  background: ${s.theme.accent} !important;
  background-image: none !important;
  color: #fff !important;
  border: none !important;
}
#application.lofter-root-container button[class*="AaRSlfX5LcBgEqyHokS0hg"]:hover {
  filter: brightness(1.1) !important;
}


/* 输入框父容器 hover/focus 边框主题色（Lofter 的 hover 效果在父 div 上） */
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"]:hover,
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"]:focus-within {
  border-color: ${s.theme.accent} !important;
}
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"]:hover input,
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"]:focus-within input {
  border-color: ${s.theme.accent} !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, ${s.theme.accent} 20%, transparent) !important;
}

/* 获取验证码按钮：主题色（超高特异性覆盖） */
#application.lofter-root-container [class*="SQQNdEaflUDMx7qF3NbdgQ"] [class*="EuoSRSUNPbbLCCRQmAzIfQ"] {
  color: ${s.theme.accent} !important;
}

/* 获取验证码所有子元素强制主题色 */
#application.lofter-root-container [class*="SQQNdEaflUDMx7qF3NbdgQ"] * {
  color: ${s.theme.accent} !important;
}

/* 获取验证码按钮背景：浅色主题色 */
#application.lofter-root-container [class*="EuoSRSUNPbbLCCRQmAzIfQ"] {
  background: color-mix(in srgb, ${s.theme.accent} 8%, transparent) !important;
}
#application.lofter-root-container [class*="EuoSRSUNPbbLCCRQmAzIfQ"]:hover {
  background: color-mix(in srgb, ${s.theme.accent} 15%, transparent) !important;
}

/* 协议链接 */
#application.lofter-root-container [class*="n+TSjqX-X7XXQT5ILg6csw"] a {
  color: ${s.theme.accent} !important;
}
      `);
    }

    if (settings.enabled && isDarkMode() && s.theme.accent) {
      out.push(`
      /* 达人页及子页面悬停保持正常主题色（抵消 .g-bdc filter） */
      body:has(.m-vw-nav) .g-bdc .m-goodblog1 a.ttl:hover,
      body:has(.m-vw-nav) .g-bdc .m-goodtag1 a:hover,
      body:has(.m-vw-nav) .g-bdc .m-goodblog1 a.tag:hover,
      body:has(.m-vw-nav) .g-bdc .m-goodblog1 a.f2:hover,
      body:has(.m-vw-nav) .g-bdc .m-tabbar a.ztag:hover,
      body:has(.m-vw-nav) .g-bdc .m-glist a.xtag:hover {
        color: ${computeDarkAccent(s.theme.accent)} !important;
      }

/* ── 发现-标签页：推荐标签/用户名悬停主题色+放大 ── */
/* 去掉 :has()，避免选择器被整体丢弃；.m-pushtag 已足够特指标签页 */
html body .g-bdc .m-pushtag ul.tdata li .cola > a,
html body .g-bdc .m-pushtag ul.tdata li .colb > a.name {
  display: inline-block !important;
  transition: color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  transform-origin: center center !important;
}
html body .g-bdc .m-pushtag ul.tdata li .cola > a:hover,
html body .g-bdc .m-pushtag ul.tdata li .colb > a.name:hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  transform: scale(1.05) !important;
}

/* 暗色模式：始终加反向 filter 防止闪烁；未悬停文字强制 #fff */
body:has(.m-vw-nav) .g-bdc .m-pushtag ul.tdata li .cola > a,
body:has(.m-vw-nav) .g-bdc .m-pushtag ul.tdata li .colb > a.name {
  filter: invert(100%) hue-rotate(180deg) !important;
  color: #fff !important;
}
body:has(.m-vw-nav) .g-bdc .m-pushtag ul.tdata li .cola > a:hover,
body:has(.m-vw-nav) .g-bdc .m-pushtag ul.tdata li .colb > a.name:hover {
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  transform: scale(1.05) !important;
}

/* ── 活跃度排序按钮：暗色模式恢复正常主题色 ── */
body:has(.m-vw-nav) .g-bdc .m-pushtag .th .colb > a.order,
body:has(.m-vw-nav) .g-bdc .m-pushtag .th .colb > a#orderby {
  filter: invert(100%) hue-rotate(180deg) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
body:has(.m-vw-nav) .g-bdc .m-pushtag .th .colb > a.order:hover {
  filter: invert(100%) hue-rotate(180deg) brightness(1.1) !important;
}

/* ── 活跃度竖条：暴力覆盖原版绿色 ── */
/* 必须逐个命中 y1~y7，原版可能给不同天数写了不同类 */
html body .g-bdc .m-pushtag .w-huoy span.js-act > b,
html body .g-bdc .m-pushtag .w-huoy span.js-act.y1 > b,
html body .g-bdc .m-pushtag .w-huoy span.js-act.y2 > b,
html body .g-bdc .m-pushtag .w-huoy span.js-act.y3 > b,
html body .g-bdc .m-pushtag .w-huoy span.js-act.y4 > b,
html body .g-bdc .m-pushtag .w-huoy span.js-act.y5 > b,
html body .g-bdc .m-pushtag .w-huoy span.js-act.y6 > b,
html body .g-bdc .m-pushtag .w-huoy span.js-act.y7 > b {
  background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
}

/* 暗色模式竖条：反向 filter 恢复正常主题色 */
body:has(.m-vw-nav) .g-bdc .m-pushtag .w-huoy span.js-act > b {
  filter: invert(100%) hue-rotate(180deg) !important;
}

/* ── 活跃度排序按钮：暗色模式恢复正常主题色 ── */
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .th .colb > a.order,
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .th .colb > a#orderby {
  filter: invert(100%) hue-rotate(180deg) !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .th .colb > a.order:hover {
  filter: invert(100%) hue-rotate(180deg) brightness(1.1) !important;
}

/* ── 活跃度排序按钮：恢复正常主题色（最终覆盖）──
   此页在反色滤镜区内（DevTools 证实：亮主题色胜出但显示为暗紫）→
   正确方案是 filter:none（去掉自身反向 filter，避免双重反相）+ 写暗色
   变体，页面滤镜反相后正好显示为正常主题色 */
body:has(.m-vw-nav) .g-bdc .m-pushtag .th .colb > a.order,
body:has(.m-vw-nav) .g-bdc .m-pushtag .th .colb > a#orderby,
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .th .colb > a.order,
body:has(.m-vw-nav) .g-bdc:has(.m-goodcnt) .m-pushtag .th .colb > a#orderby {
  filter: none !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}
body:has(.m-vw-nav) .g-bdc .m-pushtag .th .colb > a.order:hover,
body:has(.m-vw-nav) .g-bdc .m-pushtag .th .colb > a#orderby:hover {
  filter: none !important;
  color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
}

/* ── 活跃度竖条：暴力覆盖原版绿色 ── */
html body .g-bdc:has(.m-goodcnt) .m-pushtag .w-huoy span.js-act > b,
html body .g-bdc:has(.m-goodcnt) .m-pushtag .w-huoy span[class*="js-act"] > b {
  background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
}
    `);
    }
    if (settings.enabled && s.theme.accent) {
      out.push(`
            /* rc-dialog switch：主题色（浅色模式，高特异性） */
      html body div.rc-dialog-content .rc-switch.rc-switch-checked {
        background-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        background: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
        border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
      }
      html body div.rc-dialog-content .rc-switch:hover {
        border-color: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"} !important;
      }

            /* rc-dialog 内 radio 选中圆点：主题色（深浅通用） */
      .rc-dialog-content svg circle[fill="currentColor"] {
        fill: ${s.theme.accent} !important;
      }
              /* 创作声明 radio 选中圆点：主题色 */
      .lc-dialog-dark svg circle[fill="currentColor"] {
        fill: ${s.theme.accent} !important;
      }

      /* 日期选择器日历：选中日期（站点写死 #14c4bc 绿底）→ 主题色底白字。
         深浅通用：浅色主题色底 + 白字与确认键同款 */
      td.lofter-common-date-picker-cell-selected {
        background: ${s.theme.accent} !important;
        background-color: ${s.theme.accent} !important;
        border-radius: 24px !important;
      }
      td.lofter-common-date-picker-cell-selected .lofter-common-date-picker-cell-inner {
        color: #fff !important;
      }


/* ========== 登录页主题色（浅色/深色通用）========== */

/* 登录按钮：正常主题色 */
#application.lofter-root-container button[class*="AaRSlfX5LcBgEqyHokS0hg"] {
  background: ${s.theme.accent} !important;
  background-image: none !important;
  color: #fff !important;
  border: none !important;
}
#application.lofter-root-container button[class*="AaRSlfX5LcBgEqyHokS0hg"]:hover {
  filter: brightness(1.1) !important;
}

/* 输入框 hover/focus 边框主题色 */
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"] input:hover,
#application.lofter-root-container [class*="jlUi+e-AdGwdG0RfaFATVQ"] input:focus {
  border-color: ${s.theme.accent} !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, ${s.theme.accent} 20%, transparent) !important;
}

/* 获取验证码按钮：主题色 */
#application.lofter-root-container [class*="SQQNdEaflUDMx7qF3NbdgQ"] {
  color: ${s.theme.accent} !important;
}

/* 协议链接：主题色 */
#application.lofter-root-container [class*="n+TSjqX-X7XXQT5ILg6csw"] a {
  color: ${s.theme.accent} !important;
}

/* 标签页选中下划线 */
#application.lofter-root-container [class*="El6mjq39qwdObY0I4AEluQ"][class*="wuEtzdLzTDyDg1G2lEGqTA"]::after {
  background: ${s.theme.accent} !important;
}

      /* rc-dialog 内所有输入框：去白底 + 白字（覆盖拍摄时间、拍摄地点、原作者、链接） */
      .lc-dialog-dark input[type="text"],
      .lc-dialog-dark input:not([type]) {
        background: rgba(255,255,255,0.08) !important;
        color: rgba(255,255,255,0.9) !important;
        border-color: rgba(255,255,255,0.15) !important;
      }
      .lc-dialog-dark input[type="text"]::placeholder,
      .lc-dialog-dark input:not([type])::placeholder {
        color: rgba(255,255,255,0.45) !important;
      }

      /* 日期选择器输入框容器去白底 */
      .lc-dialog-dark .lofter-common-date-picker-input {
        background: rgba(255,255,255,0.08) !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        border-radius: calc(${fr} * 0.6) !important;
      }
      .lc-dialog-dark .lofter-common-date-picker-input input {
        background: transparent !important;
      }
      .lc-dialog-dark .lofter-common-date-picker-suffix svg path {
        fill: rgba(255,255,255,0.6) !important;
      }
      /* 输入框父级容器 CSS 兜底（镜像下方轮询 JS 的内联逻辑）：
         点击勾选键/开关时 React 重渲染会清掉轮询写的内联样式，
         到下一次 300ms 轮询之间父级会露出站点 #EDEDED 白框
         （拍摄时间/原作者/原作链接闪烁的来源）。CSS !important
         即时生效、无空窗；稳态视觉与 JS 内联完全一致 */
      .lc-dialog-dark div:has(> input[readonly]),
      .lc-dialog-dark div:has(> input[disabled]) {
        border: 1px solid rgba(255,255,255,0.15) !important;
        background: rgba(255,255,255,0.08) !important;
        box-shadow: none !important;
      }
      .lc-dialog-dark div:has(> input):not(:has(> input[readonly])):not(:has(> input[disabled])) {
        border: none !important;
      }
      .lc-dialog-dark div[role="button"]:has(input) {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
      /* 输入框/容器禁用过渡动画：MutationObserver 已在绘制前同步写好
         暗色内联样式，但若站点给这些元素写了 transition，"浅色内联
         （插入时）→ 暗色内联（微任务修复）"这次计算样式变化会触发
         过渡动画，从浅色渐变到暗色——肉眼就是闪一下亮色。禁掉过渡
         后样式瞬时切换，无渐变帧 */
      .lc-dialog-dark input,
      .lc-dialog-dark div:has(> input) {
        transition: none !important;
      }
      /* 邀请页链接邀请悬停主题色 */
      .g-bdc:has(#inviteearea) a.linkinvite:hover {
        color: ${isDarkMode() ? computeDarkAccent(s.theme.accent) : s.theme.accent} !important;
      }
    `);

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
            el.className.includes("box-web")
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
  function ensureBubbleCards() {
    let el = document.getElementById("lc-bubble-cards");
    if (!settings.enabled) {
      if (el) el.remove();
      return;
    }
    startBubbleObserver();
    if (!el) {
      el = document.createElement("style");
      el.id = "lc-bubble-cards";
      (document.head || document.documentElement).appendChild(el);
    }
    const dark = isDarkMode();
    const color = dark ? "rgb(225, 225, 219)" : "#fff";
    /* 首页卡片与站内其它卡片同圆角（浅色跟随用户设置，暗色走暗色卡片系统的 12px）；
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
        radius: dark ? "12px" : userRadius,
        hover: true, /* 悬停整体轻微放大（原版效果，幅度 1.02 防止与上下卡片重叠） */
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
    ];
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
        box-shadow: none !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      ${pubBase}:hover::before {
        transform: none !important;
        box-shadow: none !important;
      }
      ${pubBase}::after {
        content: "" !important;
        position: absolute !important;
        top: 18px !important;
        left: var(--lc-pub-left, 96px) !important;
        transform: translateX(-100%) !important;
        width: 0 !important;
        height: 0 !important;
        border-top: 11px solid transparent !important;
        border-bottom: 11px solid transparent !important;
        border-right: 13px solid ${color} !important;
        z-index: -1 !important;
        pointer-events: none !important;
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
      ` : ""}
    `;
    const css =
      (dark
        ? `
      /* 覆盖 buildCSS 里字面量 #fff 的卡片底规则（#main > .m-mlist > .mlistcnt::before）：
         暗色滤镜会把 #fff 反相成纯黑 #000000，统一改为 #1F1F19 预置反色值。
         用 html 前缀抬高特异性，保证不受样式表注入顺序影响。 */
      html #main > .m-mlist > .mlistcnt::before {
        background: rgb(225, 225, 219) !important;
      }
    `
        : "") +
      scopes
        .map(
        ({ name, sel, radius, hover }) => `
      /* ===== ${name} ===== */
      ${sel} {
        position: relative !important;
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
        left: var(--lc-bubble-left, 21px) !important;
        background: ${color} !important;
        border-radius: ${radius} !important;
        box-shadow: none !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }
      ${sel}:hover::before {
        transform: none !important;
        box-shadow: none !important;
      }
      ${hover
        ? `/* 悬停轻微放大：scale 加在卡片整体上，矩形+尖角作为整体等比缩放不错位
         （通用规则只 scale ::before 矩形，会与尖角错位，已在上面禁掉） */
      ${sel} {
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      ${sel}:hover {
        transform: scale(1.02) !important;
      }`
        : ""}
      /* 左侧尖角：宽度=箭头区宽度，比其多伸 1px 进卡片补尖端亚像素缝
         （与卡片同色不可见） */
      ${sel}::after {
        content: "" !important;
        position: absolute !important;
        top: 12px !important;
        left: 0 !important;
        width: 0 !important;
        height: 0 !important;
        border-top: calc(var(--lc-bubble-left, 21px) / 2) solid transparent !important;
        border-bottom: calc(var(--lc-bubble-left, 21px) / 2) solid transparent !important;
        border-right: calc(var(--lc-bubble-left, 21px) + 1px) solid ${color} !important;
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
    if (el.textContent !== css) el.textContent = css;
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
    document.querySelectorAll('#rside [class*="box-web"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 50) {
        el.style.setProperty('background-color', 'rgb(225, 225, 219)', 'important');
      }
    });

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
        background: rgb(225, 225, 219) !important;
        border-radius: 12px !important;
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

            // 设置交错延迟
            if (stagger && idx > 0) {
              el.style.animationDelay = idx * staggerDelay + "s";
            } else {
              el.style.animationDelay = "";
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
          // 设置交错延迟
          if (stagger && idx > 0) {
            el.style.animationDelay = idx * staggerDelay + "s";
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
      return;
    }
    lcSafe(applyFontFace);
    lcSafe(applyStyle);
    lcSafe(applyBackground);
    lcSafe(removeStubbornAds);
    lcSafe(applyDecorations);
    lcSafe(applyNavbar);
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
    lcSafe(initDraftManager);
    lcSafe(applyCustomPlaceholder);
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
        lcSafe(applyCardAnimations);
        lcSafe(applyCustomPlaceholder);
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

  /* ---------- 导航栏透明/毛玻璃（对抗Lofter的JS内联覆盖）---------- */
  let navbarTimer = null;
  function applyNavbar() {
    if (navbarTimer) {
      clearInterval(navbarTimer);
      navbarTimer = null;
    }

    const bar = document.getElementById("lofter-top-bar");

    /* 关闭时：清掉我们写的 style，让 Lofter 自己的 JS 恢复黑色 */
    if (
      !settings.enabled ||
      (!settings.navbar.transparent && !settings.navbar.blur)
    ) {
      if (bar) {
        bar.style.removeProperty("background");
        bar.style.removeProperty("background-image");
        bar.style.removeProperty("backdrop-filter");
        bar.style.removeProperty("-webkit-backdrop-filter");
        bar.querySelectorAll("*").forEach((el) => {
          el.style.removeProperty("background");
          el.style.removeProperty("background-color");
        });
      }
      return;
    }

    function setNavStyle() {
      const bar = document.getElementById("lofter-top-bar");
      if (!bar) return;

      /* 结果签名：状态与导航结构都没变时直接跳过，
         避免每 200ms 的 querySelectorAll("*") + getComputedStyle 全量扫描 */
      const navKey = [
        isDarkMode(),
        settings.navbar.blur,
        settings.navbar.transparent,
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

        /* 毛玻璃（仅在用户开启时） */
        if (settings.navbar.blur) {
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
        } else {
          bar.style.removeProperty("backdrop-filter");
          bar.style.removeProperty("-webkit-backdrop-filter");
        }

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
        /* ===== 浅色模式：保持原有逻辑 ===== */
        if (settings.navbar.transparent) {
          const alpha = settings.navbar.blur ? "0.3" : "0.65";
          bar.style.setProperty(
            "background",
            `rgba(255,255,255,${alpha})`,
            "important",
          );
          bar.style.setProperty("background-image", "none", "important");
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

        if (settings.navbar.blur) {
          bar.style.setProperty("backdrop-filter", "blur(16px)", "important");
          bar.style.setProperty(
            "-webkit-backdrop-filter",
            "blur(16px)",
            "important",
          );
        } else {
          bar.style.removeProperty("backdrop-filter");
          bar.style.removeProperty("-webkit-backdrop-filter");
        }
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
      window.settings = LC_merge(LC_DEFAULTS, res[LC_STORAGE_KEY] || {});
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
      window.settings = LC_merge(LC_DEFAULTS, newSettings);
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
        // 每隔 2 秒再检查一次，持续 30 秒（编辑器可能反复重建）
        let count = 0;
        const iv = setInterval(() => {
          applyLongpostEditorDark();
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

      imgs.sort((a, b) => {
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
          const decId = img.dataset.decId;
          const dec = (window.settings.decorations || []).find(
            (d) => d.id === decId,
          );

          if (dec && dec.interactive && dec.interactive.enabled) {
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
        position: fixed; width: ${PANEL_W}px; background: #fff;
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
      panelIframe.src = chrome.runtime.getURL("popup.html");
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