/* lc-css-light.js —— S1 从 content.js 抽出的内嵌 CSS 资产（2026-10-08）
 *
 * 纯搬运：选择器、值、注释一字未改；模板串里的 ${...} 自由变量改成函数的显式参数。
 * 本文件在 manifest 里排在 content.js **之前**，与其共享同一隔离世界作用域。
 * 函数名 s<数字> = 搬运前在 content.js 里的起始行（便于回溯对照）。
 * 内容：浅色 / 双模式通用的毛玻璃与材质管线
 */
window.LC_CSS = window.LC_CSS || {};
LC_CSS.light = LC_CSS.light || {};

/* 原 content.js L4715-4977（263 行）｜确认按钮：主题色（.m-layer 挂在 body 下，不在 #main 反色区 */
LC_CSS.light.s4715 = function ({ fr, s, longpostShadow, computeDarkAccent }) {
  return `
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

      /* ── 私信对话：我方消息气泡补底色 ──
         官方我方气泡是透明底 + 0.57px 细边（对方气泡 #f3f3f3 填充），
         观感是「自己发的消息没有对话框」。补上与对方一致的 #f3f3f3：
         浅色模式直接生效；暗色模式该值位于 #msgcontainer 子元素反色区内，
         会被自动反成 ≈#0c0c0c，与对方气泡暗色一致，无需另写暗色规则。
         选择器只命中消息 li 内的气泡；输入框 .txt.w-inputxt 不在 li 里，不受影响。 */
      .m-talk ul.f-cb li:not(.ta) .txt {
        background: #f3f3f3 !important;
      }
      /* ── 私信对话：尖角随气泡同色（v7 连续边框版）──
         官方尖角是 .txt > span.cor 雪碧图贴片（probe-dm-cor 实证：13x12 绝对
         定位、四边 border 全 0、无底色、innerHTML 空——白三角和沿轮廓的
         边框线都烧在图里，且与气泡边框连成一体）。重画方案：
         ① span.cor 本体 = 描边色 border 三角（12x12，45° 直角：竖边贴气泡、
            顶边平齐气泡顶、斜边回到气泡），定位比官方内移 1px，让竖边描边
            与气泡边框重合为一条线；
         ② ::before = clip-path 填充多边形，向气泡方向多伸 1px 盖掉接口处的
            竖边描边 + 气泡边框段（原版的「开口」），与斜边留 ≈0.7px 距离
            形成描边圈（与官方 0.57px 细边观感同级）。
         ⚠ 官方 .cor 自带 overflow:hidden（probe-dm-cor2 实证），会裁掉落在
         0 尺寸 padding box 之外的 ::before——必须钉回 visible。
         box-sizing 钉 content-box，防站点全局 border-box 把 0 宽度压没。 */
      .m-talk ul.f-cb li .txt .cor {
        background: none !important;
        box-sizing: content-box !important;
        /* 官方 .cor 自带 overflow:hidden（probe-dm-cor2 实证），会把
           ::before 填充层（位于 0 尺寸 padding box 之外）整个裁掉，
           只剩描边色实心三角——必须钉回 visible */
        overflow: visible !important;
        width: 0 !important;
        height: 0 !important;
        border-style: solid !important;
        border-color: transparent !important;
      }
      /* 我方：竖边在左（贴气泡右侧），描边=气泡边框色 #e7e7e7。
         官方贴片在 right:-13px，这里钉成 -12px：竖边描边与气泡右边框
         重合成一条线（v7 连续性——原版尖角与气泡边框是连体的） */
      .m-talk ul.f-cb li:not(.ta) .txt .cor {
        left: auto !important;
        right: -12px !important;
        border-left-width: 12px !important;
        border-bottom-width: 12px !important;
        border-top-width: 0 !important;
        border-right-width: 0 !important;
        border-left-color: #e7e7e7 !important;
      }
      /* 对方：竖边在右（贴气泡左侧），镜像 */
      .m-talk ul.f-cb li.ta .txt .cor {
        right: auto !important;
        left: -12px !important;
        border-right-width: 12px !important;
        border-bottom-width: 12px !important;
        border-top-width: 0 !important;
        border-left-width: 0 !important;
        border-right-color: #e7e7e7 !important;
      }
      /* 内层填充（v7）：不再用 border 三角，改 clip-path 多边形——
         填充要向气泡方向多伸 1px，把接口处的竖边描边 + 气泡边框段盖掉
         （= 原版的「开口」），同时与外层斜边保持 ≈0.7px 距离留出描边圈。
         定位基准仍是 span.cor 的 padding box（我方原点在 (12,0)，
         对方在 (0,0)）；clip-path 坐标相对 13x13 盒子：
         我方 polygon(0 1px, 11px 1px, 0 12px)——顶留 1px、斜边内缩 1px、
         左侧伸到盒子外 1px（盖掉气泡边框）；对方为镜像。 */
      .m-talk ul.f-cb li:not(.ta) .txt .cor::before {
        content: "" !important;
        position: absolute !important;
        left: -13px !important;
        top: 0 !important;
        width: 13px !important;
        height: 13px !important;
        background: #f3f3f3 !important;
        clip-path: polygon(0 1px, 11px 1px, 0 12px) !important;
      }
      .m-talk ul.f-cb li.ta .txt .cor::before {
        content: "" !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 13px !important;
        height: 13px !important;
        background: #f3f3f3 !important;
        clip-path: polygon(2px 1px, 13px 1px, 13px 12px) !important;
      }
      /* 输入框旁的同款尖角（官方贴图暗色下同样反成纯黑，一并重画）：
         描边=输入框边框色 #d7d7d7，浅色填充随输入框白底；
         暗色填充走暗色段 preInv。元素不存在时规则空转。 */
      .m-talk .add .txt .cor {
        background: none !important;
        box-sizing: content-box !important;
        overflow: visible !important; /* 同上：防官方 overflow:hidden 裁掉填充层 */
        left: auto !important;
        right: -12px !important; /* 同消息气泡：竖边描边与输入框边框重合 */
        width: 0 !important;
        height: 0 !important;
        border-style: solid !important;
        border-color: transparent !important;
        border-left-width: 12px !important;
        border-bottom-width: 12px !important;
        border-top-width: 0 !important;
        border-right-width: 0 !important;
        border-left-color: #d7d7d7 !important;
      }
      .m-talk .add .txt .cor::before {
        content: "" !important;
        position: absolute !important;
        left: -13px !important;
        top: 0 !important;
        width: 13px !important;
        height: 13px !important;
        background: #ffffff !important;
        clip-path: polygon(0 1px, 11px 1px, 0 12px) !important;
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
    `;
};

/* 原 content.js L5016-5072（57 行）｜新版页面：背景透明，让插件背景层透上来 */
LC_CSS.light.s5016 = function ({ fr, s }) {
  return `
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
      `;
};

/* 原 content.js L5081-5465（385 行）｜左侧筛选栏选中项：主题色文字 + 浅主题色底（原绿色系）。 */
LC_CSS.light.s5081 = function ({ SCOPE, A }) {
  return `
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
           .info 类名较通用——2026-10-06 实证：裸选择器会命中**博客子域归档页**
           （body.p-body10 的卡片悬停浮层 span.info，无 #application 祖先），
           给它加上 16px 内边距 + width:fit-content → em 日期下移 16px、
           容器 125→115px，用户看到「日期/热度偏下」。双保险收窄：
           ① 补 SCOPE 前缀（与同块其他规则一致；博客子域无 #application）
           ② 限定 div.info —— 目标元素本是 div（注释「原 div 通栏太长」），
              归档浮层是 span.info，即便该页也有 #application 也不会误伤。
           宽度按内容收缩（原 div 通栏太长）+ 提高透明度 */
        ${SCOPE} div.info {
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
      `;
};

/* 原 content.js L5477-5611（135 行）｜挡板透明化：放行背景图（两模式） */
LC_CSS.light.s5477 = function ({ SCOPE, dark, fr, A }) {
  return `
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
      `;
};

/* 原 content.js L5615-5695（81 行）｜站点外层 .g-bdc 自带 1px 灰 border-top，毛玻璃容器上方露 */
LC_CSS.light.s5615 = function () {
  return `
      /* 站点外层 .g-bdc 自带 1px 灰 border-top，毛玻璃容器上方露白线，去掉；
         顺手把整块容器加宽（原版约 990px，两列成员卡更舒展） */
      .g-bdc:has(.m-blackset) {
        border-top: 0 !important;
        width: min(1280px, 96%) !important;
        max-width: none !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
      }
      .g-mn:has(.m-blackset) {
        background: rgba(255, 255, 255, 0.55) !important;
        backdrop-filter: blur(16px) saturate(140%) !important;
        -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
        border-radius: 16px !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08) !important;
        padding: 8px 18px 16px !important;
        box-sizing: border-box !important;
      }
      .g-mn:has(.m-blackset) .bsset {
        background: rgba(255, 255, 255, 0.5) !important;
        border: 1px solid rgba(0, 0, 0, 0.06) !important;
        border-radius: 12px !important;
        padding: 12px 14px !important;
      }
      .g-mn:has(.m-blackset) .bslist ul {
        /* 成员两列：站点原生 50% 宽 float/inline-block 排列对卡片化样式
           太脆弱（padding/border 一加就挤成单列），改 grid 硬排 */
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px 12px !important;
        /* 站点 ul 自带定宽/负 margin，加宽容器后溢出毛玻璃两侧 → 钉回内容宽 */
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      .g-mn:has(.m-blackset) .bslist ul li {
        background: rgba(255, 255, 255, 0.6) !important;
        border: 1px solid rgba(0, 0, 0, 0.06) !important;
        border-radius: 12px !important;
        padding: 10px 16px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        float: none !important;
        /* 内部 flex 排版：站点原布局头像/昵称 float left、移出按钮
           float right，加 padding 后按钮挤掉行悬到卡片外——flex 一劳永逸 */
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
      }
      .g-mn:has(.m-blackset) .bslist ul li .w-img2 {
        float: none !important;
        flex-shrink: 0 !important;
      }
      .g-mn:has(.m-blackset) .bslist ul li .bsname {
        float: none !important;
        flex: 1 !important;
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .g-mn:has(.m-blackset) .bslist ul li .w-vsbtn {
        float: none !important;
        flex-shrink: 0 !important;
        margin-left: auto !important;
      }
      .g-mn:has(.m-blackset) .bsin .w-inputxt {
        border-radius: 10px !important;
        border: 1px solid rgba(0, 0, 0, 0.12) !important;
      }
      .g-mn:has(.m-blackset) .w-vsbtn {
        border-radius: 999px !important;
      }
    `;
};

/* 原 content.js L6873-6991（119 行）｜清除导航栏外层所有层级的背景 */
LC_CSS.light.s6873 = function ({ navHy, s, isDarkMode }) {
  return `
        /* 清除导航栏外层所有层级的背景 */
        #application.lofter-root-container [class*="box-web"],
        #application.lofter-root-container [class*="box-web"] > div,
        #application.lofter-root-container [class*="box-web"] > div > div {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
        }
        
        /* 导航栏实际容器（第3层 div）— 毛玻璃效果，与首页统一。
           hyalite 模式：blur 换成 var(--hyalite)（由 hyalite.js 写入），
           并加底缘圆角 + 折射焦散自带的边缘阴影 */
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child {
          background: rgba(255, 255, 255, 0.35) !important;
          background-image: none !important;
          ${
            navHy
              ? `backdrop-filter: var(--hyalite, blur(16px)) !important;
          -webkit-backdrop-filter: var(--hyalite, blur(16px)) !important;
          border-radius: 0 0 14px 14px !important;
          box-shadow: var(--hyalite-edge, none) !important;`
              : `backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          box-shadow: none !important;`
          }
          border-bottom: none !important;
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
        ${
          navHy
            ? `/* 自适应材质：lc-glass-dark 必须挂在玻璃条自身（box-web > div > div）。
         不能挂外层 box-web——它是子串匹配，不同页面会命中页壳/页脚等
         大容器，后代文字规则会把全页超链接刷白（查看更多页实证）。
         文字/图标颜色走 CSS 变量：变量按元素解析、沿继承传递，
         面板只需重定义变量即可让整棵子树回到深色，不参与优先级混战。
         例外：面板内的强调色 tag（GpLmHKrgQS9DGUHQapUffw==，用户实测
         取自搜索下拉「相关的文章」行）用 :not() 排除，保留站点自身强调色 */
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child.lc-glass-dark {
          background: rgba(22, 22, 26, 0.38) !important;
          --lc-nav-ink: rgba(255, 255, 255, 0.92);
          --lc-nav-fill: rgba(255, 255, 255, 0.85);
        }
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child.lc-glass-dark a:not([class*="GpLmHKrgQS9DGUHQapUffw=="]),
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child.lc-glass-dark span:not([class*="GpLmHKrgQS9DGUHQapUffw=="]) {
          color: var(--lc-nav-ink, rgba(255, 255, 255, 0.92)) !important;
        }
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child.lc-glass-dark svg path {
          fill: var(--lc-nav-fill, rgba(255, 255, 255, 0.85)) !important;
        }
        ${
          isDarkMode()
            ? ""
            : `/* 搜索下拉/更多下拉=面板：面板自带白底，深材质下必须保持深字。
           锚点 class 由控制台实测得到（新版 = style-xx-content-web / -body-web，
           与老管线同语义）；深色模式另有面板白字规则，故此处仅浅色模式生效 */
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child.lc-glass-dark [class*="-content-web"],
        #application.lofter-root-container [class*="box-web"] > div:first-child > div:first-child.lc-glass-dark [class*="-body-web"] {
          --lc-nav-ink: rgba(0, 0, 0, 0.75);
          --lc-nav-fill: rgba(0, 0, 0, 0.6);
        }`
        }`
            : ""
        }
      `;
};

/* 原 content.js L7129-7179（51 行）｜自适应材质（hyalite）：浅材质黑字 / 深材质白字。 */
LC_CSS.light.s7129 = function ({ s }) {
  return `
        #lofter-top-bar {
          ${
            s.navbar.hyalite
              ? `background: rgba(255,255,255,0.42) !important;
          background-image: none !important;
          backdrop-filter: var(--hyalite, blur(16px)) !important;
          -webkit-backdrop-filter: var(--hyalite, blur(16px)) !important;
          box-shadow: var(--hyalite-edge, none) !important;
          border-radius: 0 0 14px 14px !important;`
              : `background: rgba(255,255,255,0.35) !important;
          background-image: none !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;`
          }
          border-bottom: none !important;
          transition: background 0.3s !important;
        }
        ${
          s.navbar.hyalite
            ? `/* 自适应材质（hyalite）：浅材质黑字 / 深材质白字。
         不能刷 div——top-bar 子树里包含搜索下拉/其他下拉等白底面板，
         无差别刷白会让面板文字不可读；只刷 a/span，面板单独豁免。
         颜色统一走 CSS 变量（与新版管线同构）：变量沿继承传递，
         面板只需重定义、强调色只需 :not() 排除，不参与优先级混战 */
        #lofter-top-bar {
          --lc-nav-ink: rgba(0, 0, 0, 0.75);
          --lc-nav-fill: rgba(0, 0, 0, 0.6);
        }
        #lofter-top-bar.lc-glass-dark {
          background: rgba(22, 22, 26, 0.38) !important;
          --lc-nav-ink: rgba(255, 255, 255, 0.92);
          --lc-nav-fill: rgba(255, 255, 255, 0.85);
        }
        /* 强调色 tag 放行：不覆盖站点自身强调色（面板是白底，站点色可读）。
           两个哈希分别取自新/旧下拉实测与站内 tag 锚点，类名变更时优先查这里 */
        #lofter-top-bar a:not([class*="GpLmHKrgQS9DGUHQapUffw=="]):not([class*="AV8Mt74pTEHQXrEBEKFaUg=="]),
        #lofter-top-bar span:not([class*="GpLmHKrgQS9DGUHQapUffw=="]):not([class*="AV8Mt74pTEHQXrEBEKFaUg=="]) {
          color: var(--lc-nav-ink, rgba(0, 0, 0, 0.75)) !important;
        }
        #lofter-top-bar svg path {
          fill: var(--lc-nav-fill, rgba(0, 0, 0, 0.6)) !important;
        }
        /* 下拉面板豁免：面板保持白底深字 */
        #lofter-top-bar [class*="-content-web"],
        #lofter-top-bar [class*="-body-web"] {
          --lc-nav-ink: rgba(0, 0, 0, 0.75);
        }`
            : ""
        }
      `;
};

/* 原 content.js L7186-8089（904 行）｜========== 草稿页 ========== */
LC_CSS.light.s7186 = function ({ s, computeDarkAccent, fr, shadow, a, aHover, isDarkMode }) {
  return `

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
      `;
};

/* 原 content.js L8141-8185（45 行）｜── 私信页：圆角毛玻璃（无条件） ── */
LC_CSS.light.s8141 = function ({ fr, shadow }) {
  return `

/* ── 私信页：圆角毛玻璃（无条件） ── */
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
`;
};

/* 原 content.js L8189-10124（1936 行）｜通知栏浅色模式卡片 */
LC_CSS.light.s8189 = function ({ fr, shadow, s, gap, cardHoverZoom, isDarkMode, computeDarkAccent }) {
  return `

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
          /* 悬停放大的原点取底边：卡面向上生长、底边不动 —— 向下生长时
             被文档序在后的下一张卡片压掉一半（观感是「只放大了上半截」），
             也避免压住下方卡片的内容。见 ensureBubbleCards 里同名注释 */
          transform-origin: 50% 100% !important;
          /* 缓动同样换 ease-out（起步斜率不为零）：旧曲线 cubic-bezier(0.4,0,0.2,1)
             起步为 0，观感「先愣一下才放大」。实测口径见 ensureBubbleCards 同批注释 */
          transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease !important;
        }

       /* 博文卡片悬停放大（通用兜底管线；.isay 气泡卡由 ensureBubbleCards
          接管，那里的 :hover::before 已把这条置空。伪元素 pointer-events:none，
          不参与命中判定，故无需换驱动盒）
          面板可关（card.hoverZoom）：关掉时整条 scale 不生成，悬停投影保留 */
        #main > .m-mlist > .mlistcnt:hover::before {
          ${cardHoverZoom ? "transform: scale(1.02) !important;" : ""}
          box-shadow: 0 8px 24px rgba(0,0,0,0.13) !important;
        }

        /* ===== 排除不需要卡片的模块 =====
           台头(.tag-header-w)/最新最热栏(.m-tabbar)已收编进 ensureBubbleCards
           的磨砂+材质管线（2026-09-25），不再在此排除。
           他人喜欢页台头（#favpageheader > .mlistcnt > .isay > .isaym3）：
           宿主 ::before 是一张比台头内容高出一截的大卡，下缘与下方作品卡
           相接（2026-10-02 用户截图实锤「台头叠两层」）。台头卡面改由
           .isaym3 切片自持（材质开 = ensureBubbleCards 直接给切片上磨砂
           材质；关 = buildCSS 推荐卡片实底），宿主卡面两种材质态都藏。
           （2026-09-29 曾在此加 :not(#favpageheader) 豁免，供当时的宿主
           自绘 scope 画卡面；2026-10-02 scope 移除后豁免一并撤掉） */
        #main > .m-mlist:not(:has(> .mlistimg)):not(:has(> .mlistcnt .isay)):not(:has(> .mlistcnt .isayt)):not(:has(> .mlistcnt .isaym)) > .mlistcnt::before,
        #main > .m-mlist:has(> .mlistcnt .isaym3) > .mlistcnt::before,
        #main > .m-mlist:has(> .mlistcnt .publishlayer) > .mlistcnt::before {
          display: none !important;
        }

        /* 排除模块不要下边距（台头/tab 栏已收编，按标准卡距留缝） */
        #main > .m-mlist:has(> .mlistcnt .isaym3),
        #main > .m-mlist:not(:has(> .mlistimg)):not(:has(> .mlistcnt .isay)):not(:has(> .mlistcnt .isayt)):not(:has(> .mlistcnt .isaym)) {
          margin-bottom: 0 !important;
        }

        /* .m-tabbar 所在的 .m-mlist 提高层级 */
        #main > .m-mlist:has(> .mlistcnt .m-tabbar) {
          position: relative !important;
          z-index: 10 !important;
        }

        /* 最新/最热 tab 栏：保留层级抬升（下拉面板/粘性定位用），
           卡面交由 ensureBubbleCards 的磨砂+材质管线（::before 自绘） */
        #main > .m-mlist:has(> .mlistcnt .m-tabbar) > .mlistcnt {
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
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

        /* 最热榜下拉面板（日榜/周榜/月榜/全部）：原底是站点雪碧图，
         * 被台头透明化管线洗掉后整个面板透明、文字浮在下面的博文卡上
         * （真机实锤）。底色画两处：内层面板（.selc/.selcc）无条件画
         * （站点以 display:none 收起时不可见）；组件根只在悬停（展开
         * 态）画——常驻画根的话，收起态根盒子（触发钮大小）的阴影会在
         * 「全部」下方露出一条横线（box-shadow 不被审查工具命中，
         * 2026-09-25 实锤） */
        .tag-header-w .a-w-sel .selc,
        .tag-header-w .a-w-sel .selcc {
          background-color: #fff !important;
          border-radius: ${fr} !important;
        }
        /* 组件根 :hover 底色已删（20260925v）：根盒比内层面板大一圈，
           悬停画底=面板「放大一圈」（真机实锤）。内层 selc/selcc 无条件
           画底后，根盒底完全是多余的 */
        /* 榜单选中勾：清雪碧图 + 自绘对勾（主题色，与发布层下拉同款） */
        .tag-header-w .selected-icon {
          background: none !important;
        }
        .tag-header-w .selected-icon::after {
          content: "" !important;
          display: block !important;
          width: 9px !important;
          height: 5px !important;
          border-left: 2px solid ${s.theme.accent || "#667eea"} !important;
          border-bottom: 2px solid ${s.theme.accent || "#667eea"} !important;
          transform: rotate(-45deg) !important;
          margin-top: -2px !important;
        }

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
        ${isDarkMode() ? `
        /* 暗色：上面两条把 #fff 写进 #main 反色区 → 反相成纯黑。2026-09-29
           真机 DevTools 实锤：他人喜欢页台头 #favpageheader .isaym3（内含
           .m-ilike）正命中「推荐卡片」规则，整块台头纯黑；推荐页推荐卡
           同理。写预反色值（经反相显示 #1F1F19，与信息流卡片一致）+
           杀站点雪碧图 + 去投影（rgba 黑影在反色区反成白晕）。
           html #main 前缀抬特异性，稳压上方同块浅色规则 */
        html #main .isaym3:has(.m-ilike) {
          background: rgb(225, 225, 219) !important;
          background-image: none !important;
          box-shadow: none !important;
        }
        ` : ""}

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
      `;
};

/* 原 content.js L10177-10383（207 行）｜外层容器：毛玻璃+圆角 */
LC_CSS.light.s10177 = function ({ popupBg, popupBorder, popupShadow, isDark, popupText, popupAccent, s }) {
  return `
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
`;
};

/* 原 content.js L10386-10572（187 行）｜归档页台头 — 浅色毛玻璃 */
LC_CSS.light.s10386 = function ({ fr, shadow }) {
  return `
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
    `;
};

/* 原 content.js L10575-10788（214 行）｜---------- 定时发布页时间卡片修复（所有模式） ---------- */
LC_CSS.light.s10575 = function ({ s, isDarkMode, settings }) {
  return `
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
      /* 2026-09-24 修：暗色原硬编码 12px 调不了圆角，两模式统一随设置走 */
      border-radius: ${(settings.card.radius || 16)}px !important;
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
`;
};

/* 原 content.js L13499-13798（300 行）｜利用反色原理：把原始色设得够暗，invert 后就会变成亮白色 */
LC_CSS.light.s13499 = function ({ draftNav, s, computeDarkAccent, draftCard, draftDrop }) {
  return `
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
`;
};

/* 原 content.js L14394-14583（190 行）｜① 反色让位：滤镜祖先会让 backdrop-filter 采不到页面背景 */
LC_CSS.light.s14394 = function ({ yieldSel, sideCardSel, sideRefract, sideCardEl, sideCardDark, sideCardAny, s, sideCardDarkEl }) {
  return `
        /* ① 反色让位：滤镜祖先会让 backdrop-filter 采不到页面背景
           （blur 同样受 backdrop root 限制，故与折射模式一并让位）。
           只让给真的挂玻璃的页面：首页（slide-bar 玻璃卡）与
           他人喜欢页（#likesidelist 卡，仅无 #slide-bar 的页面，
           2026-09-29 扩）。原先无条件全局让位时，玻璃不覆盖的侧栏
           反色没了、玻璃也没来 → 站点原生白板直接暴露在暗色里（真机实锤） */
        ${yieldSel} {
          filter: none !important;
        }

        /* ② 玻璃卡片：半透明膜 + 磨砂/折射。
           折射档用 var(--hyalite)（hyalite.js 写入）+ --hyalite-edge 边缘光；
           纯磨砂档直接 blur(18px) saturate，用一层 inset 高光冒充玻璃边缘。
           box-shadow 单列一层：变量缺失时用透明 inset 占位，
           保证整条 box-shadow 仍是合法值（"X, none" 会整条失效） */
        ${sideCardSel} {
          background: rgba(255, 255, 255, ${sideRefract ? "0.35" : "0.6"}) !important;
          background-color: rgba(255, 255, 255, ${sideRefract ? "0.35" : "0.6"}) !important;
          background-image: none !important;
          backdrop-filter: ${
            sideRefract
              ? "var(--hyalite, blur(16px))"
              : "blur(18px) saturate(150%)"
          } !important;
          -webkit-backdrop-filter: ${
            sideRefract
              ? "var(--hyalite, blur(16px))"
              : "blur(18px) saturate(150%)"
          } !important;
          border: none !important;
          overflow: hidden !important;
          --lc-side-ink: rgba(0, 0, 0, 0.82);
          --lc-side-fill: rgba(0, 0, 0, 0.62);
          --lc-side-rim: 0 2px 10px rgba(0, 0, 0, 0.1);
          box-shadow: var(--lc-side-rim), ${
            sideRefract
              ? "var(--hyalite-edge, inset 0 0 0 0 rgba(0, 0, 0, 0))"
              : "inset 0 1px 0 rgba(255, 255, 255, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.22)"
          } !important;
        }

        /* ②b favblog 卡内层清底：站点把白底烙在 .menum/ul/li 上
           （menu24.png 雪碧图各一片，2026-09-29 探针实证）。暗材质由
           ⑥ 的 .lc-glass-dark * 通配覆盖；浅材质此前无对应规则 →
           浅色模式隔着半透膜露出一层实底白卡（真机「磨砂没生效/
           下面叠了一层」）。挂在玻璃块内随开关走：关玻璃时浅色
           #fff 兜底（8865）原样生效。首页 slide-bar 卡内无 .menum，
           选择器空转无害 */
        ${sideCardEl(".menum")},
        ${sideCardEl(".menum ul")},
        ${sideCardEl(".menum ul li")} {
          background: transparent !important;
          background-image: none !important;
        }

        /* ②c tag 页参与用户卡专属收尾（2026-09-30 浅/暗双探针实证）。
           玻璃膜挂在 .m-menu 上（与 favblog 同构），但两处 tag 页独有：
           ① 父级 .g-box 在暗色管线里也被写了预反色底（16171 段，暗色实测
              rgb(225,225,219)）——反色让位后原样显示成米色包边，膜盖不住
              父层，故在玻璃路径下清掉（浅色下 .g-box 本就透明，空转无害）；
           ② 卡内头像靠 #rside img / 16189 的 invert 补偿抵消外层反相，
              让位后补偿反转成负片，须归零（浅色本就无滤镜，空转无害）。
           两条都用 html + 双 id 前缀压过暗色管线原规则（1 id） */
        html #rside #tageditor .g-box:has(.participate-user-title-w) {
          background: transparent !important;
          background-image: none !important;
        }
        html #rside #tageditor .g-box:has(.participate-user-title-w) img {
          filter: none !important;
        }

        /* ③ 深材质（深色背景 / 暗色模式）：深膜 + 白字。
           ⚠️ 首页部分也必须带 .lc-glass-dark（曾因拼接缺陷裸奔成
           「浅色模式也一直深膜」） */
        ${sideCardDark} {
          background: rgba(22, 22, 26, 0.38) !important;
          background-color: rgba(22, 22, 26, 0.38) !important;
          --lc-side-ink: rgba(255, 255, 255, 0.9);
          --lc-side-fill: rgba(255, 255, 255, 0.85);
          --lc-side-rim: 0 2px 12px rgba(0, 0, 0, 0.35);
        }

        /* ④ 文字/图标跟随材质：走变量（按元素解析、沿继承传递），
           面板无需重定义；比逐条 !important 混战好维护 */
        ${sideCardAny},
        ${[
          "a",
          "span",
          "p",
          "div",
          "li",
          "i",
          "em",
          "strong",
          "b",
          "time",
          "label",
          "h1",
          "h2",
          "h3",
          "h4",
        ]
          .map(sideCardEl)
          .join(",\n        ")} {
          color: var(--lc-side-ink, rgba(0, 0, 0, 0.8)) !important;
        }
        ${sideCardEl('svg path:not([fill="none"])')} {
          fill: var(--lc-side-fill, rgba(0, 0, 0, 0.62)) !important;
        }
        ${sideCardEl('svg path[stroke]:not([stroke="none"])')} {
          stroke: var(--lc-side-fill, rgba(0, 0, 0, 0.62)) !important;
        }

        /* ⑤ 强调色还原：原反色方案写的是预反色值 + brightness 补偿，
           反色撤掉后要改回站点原色（否则显示为"脏色"） */
        ${sideCardEl('p[class*="count-web"]')} {
          color: #8EB902 !important;
          filter: none !important;
        }
        ${sideCardEl('span[class*="listItemHot-web"]')} {
          color: #FF6C93 !important;
          filter: none !important;
        }
        ${
          s.theme.accent
            ? `${sideCardEl("a:hover")} {
          color: ${s.theme.accent} !important;
        }`
            : ""
        }

        /* ⑥ 暗材质下站点内层底色一概透明（创作者中心头部、菜单悬停白底
           都是 hash 类，且标签类型不可枚举——div 清单漏过一次，改用 *）。
           全部露出深色玻璃膜本身，即「和暗色模式一样的暗色底」 */
        ${sideCardDarkEl("*")} {
          background-color: transparent !important;
        }
        /* 结构容器连 background-image 一并清（渐变/图片白底）；
           i/span 等内联元素不动 bg-image，防误杀雪碧图图标 */
        ${["div", "li", "a", "ul", "ol", "dl", "header", "section", "nav", "aside", "article", "footer", "main"]
          .map(sideCardDarkEl)
          .join(",\n        ")} {
          background-image: none !important;
        }
        /* 伪元素铺底（::before 白底头部/行） */
        ${["div", "li", "a", "header", "p", "span"]
          .map((t) => sideCardDarkEl(t + "::before"))
          .concat(["div", "li", "a", "header"].map((t) => sideCardDarkEl(t + "::after")))
          .join(",\n        ")} {
          background-color: transparent !important;
        }
        /* 行悬停高亮自给：只给最内层被悬停元素上白膜（:has 排除容器层） */
        ${["div", "li", "a"]
          .map((t) => sideCardDarkEl(t + ":hover:not(:has(:hover))"))
          .join(",\n        ")} {
          background-color: rgba(255, 255, 255, 0.09) !important;
        }
        /* ⑥b 分割线暗化：站点边框是配浅色底设计的（创作者中心菜单分隔、
           头部下沿线），深材质玻璃上呈刺眼实心白线。改低透明白细线——
           与 inset 边缘光同族，保留分隔功能不破玻璃质感。
           只动 border-color（不改宽度/样式，零布局风险）；浅材质不动，
           站点浅灰线本来就配浅底 */
        ${sideCardDarkEl("")},
        ${sideCardDarkEl("*")} {
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        /* ⑦ 悬停放大性能：站点对菜单项做 transform 放大，而玻璃卡是
           SVG 引用滤镜（软件光栅化），子项动画每帧拖整卡重绘 → 掉帧。
           只提升「真正会做放大动画」的行元素——**不能图省事写 div**：
           卡内几十个 div（含 hyalite 自插节点）会一次性常驻几十个合成层，
           GPU 内存与每帧合成开销上升，全页其他动效一起变慢 */
        ${["li", "a", '[class*="item"]']
          .map(sideCardEl)
          .join(",\n        ")} {
          will-change: transform;
        }

        /* ⑧ 浅色材质悬停仍偏慢的成因：站点悬停除 transform 外还带
           background/box-shadow 过渡，每帧往目标值插值 → 玻璃卡软件
           光栅化下整卡重绘。深材质下底色被钉成透明（两端同值）无绘制
           所以不慢；浅材质保留站点悬停白底就会慢。把内层元素过渡限制
           在 transform/opacity（走合成层），颜色/阴影瞬时切换不动画 */
        ${["li", "a", "div", "span", '[class*="item"]']
          .map(sideCardEl)
          .join(",\n        ")} {
          transition-property: transform, opacity !important;
        }
      `;
};

