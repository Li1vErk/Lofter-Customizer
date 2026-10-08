/* lc-css-pages.js —— S1 从 content.js 抽出的内嵌 CSS 资产（2026-10-08）
 *
 * 纯搬运：选择器、值、注释一字未改；模板串里的 ${...} 自由变量改成函数的显式参数。
 * 本文件在 manifest 里排在 content.js **之前**，与其共享同一隔离世界作用域。
 * 函数名 s<数字> = 搬运前在 content.js 里的起始行（便于回溯对照）。
 * 内容：逐页适配（与前两类并列的零散页面规则）
 */
window.LC_CSS = window.LC_CSS || {};
LC_CSS.pages = LC_CSS.pages || {};

/* 原 content.js L7038-7075（38 行）｜合集页"管理"下拉气泡（删除合集）：高优先级恢复白底深字 */
LC_CSS.pages.s7038 = function () {
  return `
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
    `;
};

/* 原 content.js L7086-7121（36 行）｜强制所有元素继承 */
LC_CSS.pages.s7086 = function ({ s }) {
  return `
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
      `;
};

/* 原 content.js L8094-8136（43 行）｜横线 */
LC_CSS.pages.s8094 = function ({ s }) {
  return `
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
`;
};

/* 原 content.js L13829-13911（83 行）｜========== 登录页主题色（浅色/深色通用）========== */
LC_CSS.pages.s13829 = function ({ s, isDarkMode }) {
  return `
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
      `;
};

/* 原 content.js L14023-14146（124 行）｜rc-dialog switch：主题色（浅色模式，高特异性） */
LC_CSS.pages.s14023 = function ({ s, computeDarkAccent, fr, isDarkMode }) {
  return `
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
    `;
};

