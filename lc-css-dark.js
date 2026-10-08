/* lc-css-dark.js —— S1 从 content.js 抽出的内嵌 CSS 资产（2026-10-08）
 *
 * 纯搬运：选择器、值、注释一字未改；模板串里的 ${...} 自由变量改成函数的显式参数。
 * 本文件在 manifest 里排在 content.js **之前**，与其共享同一隔离世界作用域。
 * 函数名 s<数字> = 搬运前在 content.js 里的起始行（便于回溯对照）。
 * 内容：暗色管线（isDarkMode() 条件块内）
 */
window.LC_CSS = window.LC_CSS || {};
LC_CSS.dark = LC_CSS.dark || {};

/* 原 content.js L5725-6475（751 行）｜文章发布弹窗：编辑区 iframe 内边距归零 + 暗色背景（作用于主页面的 i */
LC_CSS.dark.s5725 = function ({ s, computeDarkAccent }) {
  return `
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
        /* 站点自带 tooltip：悬停胶囊时官方 React 会在胶囊**内部**渲染一份
           同文案提示（div.N66XIfRYsXc7N7WkbeykcQ，2026-09-29 探针实证：
           parent 链第一环即胶囊、absolute z-index:900、暗色下底色被通用
           清底规则剥掉成白字裸奔），与上面的 ::after 气泡叠加成双份
           （真机两轮反馈）→ **暗色下**隐藏站点那份，提示统一由我们的气泡
           承载；浅色不进本块，站点 tooltip 保持原样（浅色无双份，因我们的
           气泡只在暗色注入）。限定「胶囊直接子元素」，不误伤站内其它 tooltip */
        div[class*="dl+rqIrnR1qGO7K68aqRXQ"] > div[class*="N66XIfRYsXc7N7WkbeykcQ"] {
          display: none !important;
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
        /* 更新APP页提示行：深卡（更透）+ 浅字 + 宽度按内容收缩
           （作用域同浅色版：裸 .info 曾误伤博客子域归档页悬停浮层。
           注意此处必须写字面量 #application.lofter-root-container —— 本块
           作用域内没有 SCOPE 变量，写插值会 ReferenceError 中断整个
           buildCSS；与紧邻的 span[class*=...] 规则写法一致） */
        #application.lofter-root-container div.info {
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
        /* "草稿已保存"胶囊（站点浅绿底）：暗色下改与编辑区同色的不透明
           底（2026-09-28 换哈希：旧 GaAFASioYmN 已过期未命中，现行
           dl+rqIrnR1qGO7K68aqRXQ；同底色主规则另见统一弹窗暗色基础） */
        #application.lofter-root-container [class*="KrL5Oe6b4NCGc0rWTW54QQ"] div[class*="dl+rqIrnR1qGO7K68aqRXQ"] {
          background: rgb(30, 30, 36) !important;
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
      `;
};

/* 原 content.js L10826-13497（2672 行）｜话题页/模板页/趋势页卡片底色统一 #1F1F19（预反色值 rgb(225,2 */
LC_CSS.dark.s10826 = function ({ draftCard, fr, draftDrop, s, computeDarkAccent, draftNav, b, draftMain, settings, preInv, draftModal, lcSideGlassOn, isDarkMode, draftDropSolid }) {
  return `

/* 话题页/模板页/趋势页卡片底色统一 #1F1F19（预反色值 rgb(225,225,219)）。
   白色底（插件通用规则 #fff 或站点 #fdfdfd）经反色滤镜变纯黑，这里覆盖 */
.m-temp,
.m-templist li,
.m-actlist .cont,
.m-post {
  background: rgb(225, 225, 219) !important;
}

/* 无反色宿主的页面（自定义主题博客子域页等）：上面的预反色值依赖
   #main/.postwrapper/.box.wid700 上的 invert 滤镜翻转换成 #1F1F19；
   这类页面三个宿主全不存在（2026-10-08 lofguancha.lofter.com 主页+详情页
   diag 实锤：hosts 全 0、.m-post 计算底色 rgb(225,225,219) 原样显示成
   米色「白卡」），再叠政策页白字规则 = 白底白字。html:has 反向判宿主，
   无宿主时直接写目标本体色；www 各页有宿主，不命中、维持预反色写法 */
html:not(:has(#main, .postwrapper, .box.wid700)) .m-post {
  background: #1f1f19 !important;
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


/* 私信页暗色 —— 拆层反色。
   filter 不能挂在 #msgcontainer 本体：圆角毛玻璃卡开时它带 backdrop-filter，
   backdrop 采样的是反色之前的原始背景，模糊结果随元素一起被 invert，
   磨砂透出的背景明暗反转（暗处变亮、亮处变暗）。
   修法（无头实证 tools/debug-dm-glass-repro.html：本体反色暗侧43/亮侧3 反转，
   拆层后 23/63 方向正确）：卡面预反色直写暗色 + filter 下沉到直接子元素，
   backdrop-filter 留在容器上，采样正常亮度的背景。img 双反还原同前。 */
#msgcontainer {
  background: rgba(25, 25, 30, 0.82) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}
#msgcontainer > * {
  filter: invert(100%) hue-rotate(180deg) brightness(${(settings.darkMode.brightness || 90) / 100}) !important;
}
#msgcontainer img {
  filter: invert(100%) hue-rotate(180deg) !important;
}
/* 私信气泡/输入框暗色配色（2026-10-03 拍板：双灰层次）。
   自动反色会把 #f3f3f3 压成 ≈#0c0c0c 纯黑，观感差；改预反色直写，
   写亮值经上方反色链还原为目标暗色（preInv 定义见本管线顶部）。
   对方 = li.ta / 我方 = li:not(.ta)（probe-dm 实证）；两条特异性同为
   (0,3,2) 且位于全局段我方底色规则之后，暗色下按源序胜出。 */
.m-talk ul.f-cb li.ta .txt {
  background: ${preInv("1d2025")} !important; /* → ≈#1d2025 对方：深灰 */
}
.m-talk ul.f-cb li:not(.ta) .txt {
  background: ${preInv("2a2e35")} !important; /* → ≈#2a2e35 我方：亮一档 */
}
/* 输入框（probe-dm-tail 实证：白底+0.57px #d7d7d7 边挂在 div.txt.w-inputxt，
   自动反色成纯黑）→ 目标 ≈#22252b + ≈#3a3e46 细边 */
.m-talk .add .txt.w-inputxt {
  background: ${preInv("22252b")} !important;
  border-color: ${preInv("3a3e46")} !important;
}
/* 尖角（双层重画，见全局段）：v7 起 ::before 是 clip-path 填充层，
   暗色只覆盖其 background（预反色随双灰气泡/输入框）。外层描边
   #e7e7e7/#d7d7d7 本身是浅灰，经反色链自动变成 ≈#151515/#242424，
   恰为暗色边框色，无需覆盖。 */
.m-talk ul.f-cb li.ta .txt .cor::before {
  background: ${preInv("1d2025")} !important;
}
.m-talk ul.f-cb li:not(.ta) .txt .cor::before {
  background: ${preInv("2a2e35")} !important;
}
.m-talk .add .txt .cor::before {
  background: ${preInv("22252b")} !important;
}

      /* 通知卡片：暗色毛玻璃 —— 同私信页拆层修法（.g-mn 本体在毛玻璃批次
     带 backdrop-filter，本体反色会把磨砂透出的背景一起反转） */
.g-mn:has(#blognotice) {
  background: rgba(25, 25, 30, 0.82) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}
.g-mn:has(#blognotice) > * {
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

/* ── 黑名单设置页暗色 ──
   实测该页不在 #main invert 反色区内（暗色盲区）：颜色直接写
   暗色值（同 #alert-tip 方案），不要用预反色源值 */
.g-mn:has(.m-blackset) {
  background: rgba(31, 31, 25, 0.82) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35) !important;
}
.g-mn:has(.m-blackset) .bsset {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}
.g-mn:has(.m-blackset) .bslist ul li {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}
.g-mn:has(.m-blackset) .w-fttl,
.g-mn:has(.m-blackset) .w-fttl a.back { color: rgba(255, 255, 255, 0.92) !important; }
.g-mn:has(.m-blackset) .bsinfo { color: rgba(255, 255, 255, 0.72) !important; }
.g-mn:has(.m-blackset) .bsset h4 { color: rgba(255, 255, 255, 0.85) !important; }
.g-mn:has(.m-blackset) .bsname a { color: rgba(255, 255, 255, 0.92) !important; }
/* 「黑名单设置」标题下站点分隔线 #ebebeb，暗色调暗 */
.g-mn:has(.m-blackset) .g-box3 { border-bottom-color: rgba(255, 255, 255, 0.12) !important; }
.g-mn:has(.m-blackset) .bsin .w-inputxt {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: rgba(255, 255, 255, 0.92) !important;
}
.g-mn:has(.m-blackset) .bsin .w-inputxt::placeholder {
  color: rgba(255, 255, 255, 0.45) !important;
}
/* emoji：该页没有反色环境，全局 .lc-emoji-wrap 的 invert 抵消规则
   在这里反而把 emoji 反色（亮变暗、暗变亮）→ 直接清零 */
.g-mn:has(.m-blackset) .lc-emoji-wrap { filter: none !important; }

/* ── 账号设置页暗色：主色元素统一用正常主题色（非暗色化）── */
${
  /\/(setting|front\/homesite\/user-setting)\b/.test(location.pathname)
    ? `
  .rc-checkbox-input:checked + .rc-checkbox-inner {
    background-color: ${s.theme.accent || "#667eea"} !important;
    border-color: ${s.theme.accent || "#667eea"} !important;
  }
  svg path[stroke="#4EB7BA"] { stroke: ${s.theme.accent || "#667eea"} !important; }
  /* 保存键 + 主页设置/黑名单/标签屏蔽/注销账号或主页（暗色下统一正常主题色） */
  button[class*="buttonColorPrimary"],
  a[href*="type=setting"] {
    background: ${s.theme.accent || "#667eea"} !important;
    border-color: ${s.theme.accent || "#667eea"} !important;
    color: #fff !important;
    /* 主页设置的 <a> 铺满按钮但没有圆角，会把按钮的胶囊形盖成方形 */
    border-radius: 999px !important;
  }
  button[class*="buttonColorPrimary"] a { color: #fff !important; }
`
    : ""
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
      /* 「草稿已保存」状态行（div._5+z9dJrZIs23YiDIxPMWgw，内含字数与
         提示胶囊 div.dl+rqIrnR1qGO7K68aqRXQ）：lc-draft 给编辑器 iframe
         父容器注入 padding-bottom:44px 后，该行（absolute bottom:12px）
         落进腾出的底部空白带——身后是弹窗背景而非正文，无需再「盖」。
         暗色只需清底 + 去边框融合弹窗底（3b 边框修复已跳过该行） */
      .lc-dialog-dark .rc-dialog-body div[class*="_5+z9dJrZIs23YiDIxPMWgw"]:not(:empty),
      .lc-dialog-dark .rc-dialog-body div[class*="dl+rqIrnR1qGO7K68aqRXQ"]:not(:empty) {
        background: transparent !important;
        border-color: transparent !important;
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

/* 无反色宿主的页面（自定义主题博客子域页等）：三个反色宿主
   #main/.postwrapper/.box.wid700 全不存在（2026-10-08 lofguancha.lofter.com
   主页 + 详情页 diag 实锤：hosts 全 0），正文 emoji 本就不在反色区内，
   这条抵消规则反而把正常 emoji 真正反色（亮变暗、暗变亮）——与账号设置页
   .m-blackset、弹窗 .lc-dialog-dark 同类坑（emoji 是字体 glyph，被包进
   .lc-emoji-wrap 后自身带 invert，祖先链上看不出来，故只能按宿主判）。
   html:has 反向判宿主：有宿主不命中、维持抵消；无宿主清零。 */
html:not(:has(#main, .postwrapper, .box.wid700)) .lc-emoji-wrap {
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

/* .postwrapper 整体反色会把博文照片/视频一起反了（模板预览帧实证），
   img/video 反回正常，头像也随之恢复 */
.postwrapper img,
.postwrapper video,
.box.wid700 img {
  filter: invert(100%) hue-rotate(180deg) !important;
}
${
  s.darkMode.feedTranslucent && s.card && s.card.material
    ? `
/* 信息流淡透底（实验）v2：容器整块透明（站点白底不再参与反色），
   背景图直接铺在信息流底下；半透明深底只由卡片自绘 ::before 提供
   （lcFeedCardBg，rgba(230,230,232,.65)→反相显示深色淡透）。
   v1 给容器写 0.85 淡透会显形为一块磨砂大容器（2026-09-21 反馈），
   卡片的 6% 净透过又被它吃掉——撤销容器层，卡片直接浮在背景图上 */
#main {
  background-color: transparent !important;
}
`
    : ""
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
   样式回退白底反相成纯黑——改为 CSS 直接压住全模式规则的 #fff。
   ⚠️ 侧栏玻璃开启时必须整体让位：这是预反色值，反色让位后原样
   显示成米白底（2026-09-21 截图实证「暗色+玻璃 → 白底卡」的成因） */
${
  lcSideGlassOn()
    ? ""
    : `#rside #slide-bar [class*="-box-web"] {
  background-color: rgb(225, 225, 219) !important;
}`
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
/* hyalite「面板豁免」的暗色翻面：浅色段按「面板=白底」假设把面板内
   --lc-nav-ink 重定义成黑墨（navbar hyalite 段），暗色下面板底已是深色，
   不翻面 = tag 文字/用户昵称等 span 全吃黑墨（2026-09-23 首页下拉实证；
   「相关的文章」列因其哈希链白字规则特异性更高而幸免）。变量沿继承
   传递，这里重定义一次即整面板翻白，与浅色段同构；本规则在浅色段
   之后生成，同特异性后者胜 */
#lofter-top-bar [class*="-content-web"],
#lofter-top-bar [class*="-body-web"] {
  --lc-nav-ink: rgba(255, 255, 255, 0.9);
}
/* 面板 span 墨色兜底（hyalite 关闭时站点自身深字同样漏黑）：
   排除 tag 专色 span（青绿）与日期 span（各自有专规则），别刷白 */
#lofter-top-bar [class*="-body-web"] span:not([class*="GpLmHKrgQS9DGUHQapUffw=="]):not([class*="WeY35c7R15DuCplrvtXRHg=="]) {
  color: rgba(255, 255, 255, 0.9) !important;
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
  /* span 墨色跟随悬停色：hyalite 的 span 规则直命中、不吃继承，翻变量才生效 */
  --lc-nav-ink: ${s.theme.accent ? computeDarkAccent(s.theme.accent) : "#667eea"};
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
    `;
};

/* 原 content.js L13915-14020（106 行）｜达人页及子页面悬停保持正常主题色（抵消 .g-bdc filter） */
LC_CSS.dark.s13915 = function ({ computeDarkAccent, s }) {
  return `
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
    `;
};

