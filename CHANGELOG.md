# Changelog

本文件记录 Lofter Customizer 的重要变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.2.0] - 2026-09-20

> 本批改动仍在内部迭代中（导航栏玻璃两档化），**版本号待整批完成后再统一更新**。

### 新增

- **卡面自适应材质（背景暗 → 深膜白字）**：新配 `card.faceAdapt`（默认开）。浅色模式下按卡片采样背后背景亮度（专用 64×64 画布：整图 cover 铺底只画一次、逐卡 `getImageData` 取矩形区域算相对亮度，比逐卡重画全图的导航栏采样便宜一个量级），偏暗（<0.45）→ 卡片打 `.lc-face-dark`：卡面/箭头切深膜 `rgba(22,22,26,0.55)`（磨砂模糊保留）、文字通配白 0.88、悬停纯白。与侧栏玻璃深材质同族语言，浅背景上自动回浅膜黑字。驱动源：气泡观察器（新卡进场）+ passive scroll 监听（fixed 背景下滚动改变卡片背后的区域），内部 400ms 节流；暗色模式/开关关闭时统一清理。popup「卡片外观」组新增开关
- **浅色卡片毛玻璃（实验）**：新配 `card.lightFrost`（默认关）/ `card.frostAlpha`（0.4~0.85，默认 0.6）。浅色模式无反色祖先、没有 backdrop root 限制——这是暗色反色区里做不到的——插件自绘卡面改 `rgba(255,255,255,α)` + 真 `backdrop-filter: blur(18px) saturate(140%)`，背景透过卡面被真实模糊。popup「卡片外观」组新增开关与「卡面不透明度」滑杆（仅开启时显示），帮助文案注明掉帧可关。覆盖两套自绘卡面（首页博文卡 `--lc-bubble-left` / 草稿页 `--lc-pub-left`）；左侧尖角为半透明白不带模糊（面积小、观感差异可忽略）。卡隙会露出背景
- **淡透底卡面透明度可调 + inset 高光描边**：新配 `darkMode.feedTransAlpha`（0.35~0.92，默认 0.65）——`invert`/`brightness` 都不改 alpha，滑杆值与显示实度线性直映射，越界夹取防白字吃进亮背景。popup 暗色卡片新增「卡面不透明度」滑杆，仅在「信息流淡透底」开启时显示。卡面新增 `lcFeedFaceShadow()`：淡透底开启时给自绘 `::before` 加 `inset 0 1px 0 rgba(0,0,0,.28), inset 0 0 0 1px rgba(0,0,0,.1)`（反色区内写预反色黑色、显示为白），顶缘亮线+内侧微光圈给透明玻璃「厚度」；关闭淡透底返回 `none` 与旧观感一致。三处卡面绘制点（lc-dark-cards `::before`、ensureBubbleCards 两套 scope `::before`）统一接线
- **导航栏液态玻璃（hyalite 折射）**：vendor 引入 MIT 协议的单文件库 `hyalite.js`（content_scripts 链中排在 content.js 之前），对导航栏做厚玻璃边缘折射 + 焦散变暗 + 菲涅尔边缘光 + 色散，仅 Chromium（`Hyalite.supported()` 门禁，其他环境自动回落普通样式）。新配 `navbar.hyalite`（默认关）与 `navbar.glass` 小参数组（bevel 14 / thickness 16 / slope 2.4…）——**bevel 会被钳到元素短边一半，~56px 高的导航栏绝不能套内容区的大厚度参数**，否则整面背景被拧花。新旧两条管线都接了：老管线挂 `#lofter-top-bar`，新管线挂 `[class*="box-web"]` 第 3 层 div（与 buildCSS 选择器同构）；hyalite 开启时该管线的 blur 规则自动替换为 `var(--hyalite)`，并加底缘 14px 圆角。popup「导航」栏新增开关与「毛玻璃」互斥联动
- **玻璃自适应材质**：`lcNavLuma()` 用 64×24 canvas 按元素 rect 采样导航栏背后的平均相对亮度（WCAG 公式）——背景图为 cover 铺图复现采样、纯色/渐变直接解析、pattern/off 视作亮底、图未加载完保持现状；L < `navbar.matThreshold`(0.5) 时给导航栏挂 `.lc-glass-dark` 切深膜白字，否则白膜黑字。手动三档 `navbar.matMode`（auto/light/dark），深色模式开启时强制深材质。重采样走 applyNavbar 既有 200ms 轮询、节流 400ms；切换只动类名，不触发整表重建
- React 对抗配套：玻璃元素挂 `data-lc-hy-guard` 属性观察器看守 `--hyalite` 变量，被重渲染洗掉时 `Hyalite.refresh()` 补写（先比较再写，防观察循环）；SPA 换节点后由 attach 路径自动重挂，旧节点出集合防膨胀
- **右侧栏液态玻璃（试验）**：新配 `sidebar.hyalite`（默认关）/ `sidebar.glass`（bevel 22 / thickness 30 / slope 2.6…，竖长卡片用大参数组）与 `sidebar.matMode` 材质三档，popup「导航」栏新增「右侧栏」卡片（开关 + 材质下拉仅开启时显示 + 问号说明）。目标元素是首页 `#slide-bar [class*="-box-web"]` 卡片（排除嵌套小块、小于 160×44 的组件）；attach/材质采样/React 看门与导航栏同一套（材质复用 `lcNavLuma`，暗色模式下 auto 强制深材质）。**关键约束：暗色反色必须整个让位**——`#rside > * { filter: invert }` 的 filter 会建立 backdrop root，玻璃只能采到该祖先内部的空白、折射全丢，故开启后由 buildCSS 末尾的同特异性后序规则把反色/图片反转/emoji 反转全部 `filter:none`，改用「深色玻璃 + 白字」直接给色（`--lc-side-ink` / `--lc-side-fill` 变量制，`.lc-glass-dark` 切换）；预反色的强调色（关注/粉丝数 `#8EB902`、HOT `#FF6C93`、悬停主题色）同步还原为站点原色。暗色内联底色注入两处（`applyDarkOverlay` 的 `#rside box-web` 循环、`fixDarkCards` 的 box-web 200~350 分支）加 `lcSideGlassOn()` 守卫——内联 `!important` 会压掉样式表里的玻璃膜。无头自检页（`tools/tmp-side-glass-check.html`）实证：反色祖先在 → 玻璃成死板块；撤掉后 blur/SVG 滤镜链路均正常（headless 对 `backdrop-filter: url()` 引用滤镜不渲染，真机以导航栏液态玻璃为参照）
- **评论区用户过滤（Phase 2）**：生效范围新增「评论区」勾选（默认关，`filter.scope.comment`），**只认 `filter.users`、不做关键词匹配**（评论正文短，关键词误杀率不可控）。实现从 iframe 分支提升为独立模块，**顶层帧与评论子帧都运行**（部分帖详页评论列表 `.cmti` 结构直接渲染在主文档，不在评论 iframe 内，2026-09-21 实证），仅排除编辑器/about/模板预览帧。幂等全量重算（先摘全部标记再按名单重打）+ 120ms 防抖 MutationObserver；条目边界支持两种结构——新式 `.cmti`（只认 `.cmtusr` 作者名与 `.w-img2` 头像位置的链接）与旧式以评论正文锚点 `.bcmtlstf` 向上找「同时包含作者链接与正文」的最小祖先（锚点失配整条跳过，宁漏杀不误杀）；「回复 @xxx」引用/提及链接不是作者：新式路径靠链接位置限定、旧式路径用 `closest('.bcmtlstf')` 排除，防误杀被回复者；id 提取与主帧同口径（hostname 首段 / www 路径首段）。旧式服务端渲染 DOM 无 React 重渲染问题，隐藏走 `data-lc-cmt-filtered` + 样式表，无需主帧那套 WeakMap 内联备份。条目容器查找优先认 `.cmti`/`.bcmti`/`.bcmt-item`，否则走「离散单元边界法」向上收敛（不猜混淆类名、不依赖头像锚点，见下文「修复」条），宁漏杀不误杀。**放弃旧的「正文锚点 `.bcmtlstf` 内链接一律不算作者」一刀切**——评论区 iframe 是「作者名：正文」内联布局，作者链接本就在 `.bcmtlstf` 内部，旧规则会把作者链接全部滤掉（2026-09-21 反馈评论区不生效的成因）。改用 `cmtIsAuthorLink()`：先排除 @提及/引用回链（`loftermentionblogid` 属性 / `f-atbox` 类 / `mentionredirect` 链接），再依次认 `.cmtusr`、`.w-img2` 头像位置，内联布局只认正文内首个非提及链接，避免正文里贴了被屏蔽者主页链接时误杀整条评论（jsdom 12 项断言通过：主文档 `.cmti`、iframe 内联、@提及不误杀、正文普通链接不误杀、关开关恢复且内联样式还原）。隐藏方式升级为 **data 标记 + 样式表 + 内联 `display:none !important` 三保险**，另加 1.2s 看门狗补写——首页/tag 页的评论卡片由 React 渲染，重渲染会洗掉 `data-*`（2026-09-21 实测 tag 页 10 个 `.cmti` 一枚未标记）；扫描阶段逐链接 try/catch，此前标记动作排在扫描之后，任何一个链接异常都会让整批一枚不打。调试桥 `<html data-lc-probe>` 新增 `cmt` 诊断段（ran / cmti / bodies / links / matched / items / marked），用于区分「选择器没命中 / id 没匹配上 / 标记被 React 洗掉」三类问题

### 变更

- **popup「卡片材质」组整合**：暗色信息流半透底（原「信息流淡透底（实验）」，自「显示」栏深色模式组迁出）与浅色毛玻璃（自「卡片外观」组迁出）合并为卡片栏独立的「卡片材质」组，开关更名「暗色 · 半透明底」「浅色 · 毛玻璃（实验）」，两个「卡面不透明度」滑杆与「卡面自适应材质」同组；三条长解释合并为组标题 `?` 折叠说明（复用 help-dot 组件，含出现动画期间的半透明→磨砂过渡提示）。两组调节常驻（跟随系统模式下两种材质都可能生效，不按主题条件显隐）。设置键名不变，配置无损
- **右侧栏浅色磨砂膜与信息流卡面统一**：浅材质膜 alpha 0.44→0.6（与卡面默认一致），修正并排时右栏饱和度明显偏高（透光量不同、背景饱和色显现程度不一）；折射档 0.35 不动
- **浅色卡面磨砂增强**：blur 18px→26px、saturate 140%→160%，抵消白膜对模糊感的掩盖。注：纯色/渐变等干净背景下模糊物理上无从体现，需有细节的背景才能看出磨砂

- **右侧栏玻璃默认改为纯磨砂（`blur(18px) saturate(150%)`），边缘折射降级为实验开关 `sidebar.refract`（默认关）**：`backdrop-filter: url()` 在 Chromium 走软件光栅化，卡片常驻视口即持续占用，实测拖慢全页其他动效（博文卡悬停、插件面板开合）。纯磨砂走 GPU、开销低一个量级，且不依赖 hyalite 库——`lcSideGlassOn()` 与 buildCSS 的 `sideHy` 判定随之解耦（仅折射档要求 `Hyalite.supported()`），非 Chromium 也能用。磨砂档用一层 inset 高光（`inset 0 1px 0 rgba(255,255,255,.45)` + 1px 亮边）冒充玻璃边缘，膜透明度从 0.35 提到 0.44 补偿无折射的对比损失；折射档仍走 `var(--hyalite)` + `var(--hyalite-edge)` 边缘光。popup「右侧栏」卡片的主开关改名为「右侧栏玻璃（磨砂）」，其下新增「边缘折射（实验·开销较高）」勾选（与材质档一样仅在开启时显示）
- **will-change 收敛**：上一版给玻璃卡内**所有 div** 加 `will-change: transform`，卡内几十个 div（含 hyalite 自插节点）一次性常驻几十个合成层，GPU 内存与每帧合成开销上升、拖慢全页动画。现只提升真正会做放大动画的行元素（`li/a/[class*="item"]`）。教训：`will-change` 属逐元素精确施加的优化，写成 `div`/`*` 通配在嵌套 DOM 上代价会外溢到整页
- **导航栏玻璃收敛为两档**：移除独立的「导航栏透明」档（其观感被毛玻璃完全覆盖），popup 只剩两个互斥开关——**导航栏毛玻璃（低透）** `navbar.blur` 与 **导航栏液态玻璃（高透·折射）** `navbar.hyalite`，开一个自动关另一个。此前 blur 需要 transparent 同时开启的隐性依赖一并删除：现在 blur 单独就是 `rgba(255,255,255,0.35)` + `blur(16px)`，老管线（`#lofter-top-bar`）浅色分支的 `0.65→0.3` 双档 alpha 也随之合并
- 配置迁移 `LC_migrateNav()`（defaults.js，content.js 与 popup.js 的读取/导入路径均调用）：老配置若「只开了 transparent」→ 自动转为毛玻璃，避免升级后导航栏突然回到站点默认黑色；已开 blur/hyalite 的配置不受影响。**迁移后删除 `transparent` 字段**——否则用户手动关掉毛玻璃时，下次读取又会被残留的 `true` 迁回开启，表现为「关不掉」
- 深色模式分支不再按 `navbar.blur` 条件写 blur：走到该分支即意味着至少有一档玻璃开启（hyalite 库不可用时这里就是兜底毛玻璃），去掉恒真的 if/else
- **「隐藏/拉黑」按钮改为悬停浮现**（2026-09-21 用户反馈：常驻在作者头像下方观感差）：按钮默认 `opacity: 0; pointer-events: none`，悬停/键盘聚焦其直接父容器（作者行）时浮现到 0.55、按钮自身 hover 到 1。父容器用 `:has(> a.lc-mute-btn)` 选取，不依赖行类名
- **控制台调试桥**：content script 跑在隔离世界，页面控制台直接读 `settings` 报 ReferenceError（2026-09-21 实测）。约定调试协议：控制台 `document.documentElement.dispatchEvent(new CustomEvent("lc-probe"))` → content.js 把状态快照（enabled / darkMode / filter / 关键样式表存在性 / #main filter）写进 `<html data-lc-probe>` → 控制台 `JSON.parse` 读回。DOM 事件跨世界可达，常驻开销可忽略
- **玻璃生效不再要求开启背景**：新管线 buildCSS 原先带 `background.mode !== "off"` 条件（老管线 applyNavbar 从来没有），导致「背景＝关闭」时两条管线表现不一致（老管线生效、新管线失效）。条件已删——两档玻璃在任何背景模式下都接管导航栏，用站点默认白底时同样生效

### 修复

- **卡面自适应材质「开→白实底 / 关→恢复磨砂 / 再开→无变化」的根因：模板 TDZ 抛错 + 空样式表**：`faceAdaptCSS` 模板写在外层作用域，却引用了两处当时不可达的标识符——`pubBase`（在后面才 `const` 声明）与 `sel`（`scopes.map` 的回调参数），所以 `card.faceAdapt` 一开就 `ReferenceError: Cannot access 'pubBase' before initialization`，`ensureBubbleCards` 整段中断。而样式表元素是**先建、内容后填**，于是首次加载时 `#lc-bubble-cards` 被留在**空表**状态：首页卡片失去全部自绘卡面规则，回落 `buildCSS` 的通用 `#fff` 白实底（无磨砂、无 backdrop-filter、左侧尖角消失）。关掉开关时模板不再求值、写入首次成功 → 磨砂与尖角一起恢复；再开启又抛错、空表从未被写入 → 「再开启无任何变化」。探针实证：卡片 `.lc-face-dark` 类在（`dark:true`）、computed `::before` 为 `rgb(255,255,255)` + `backdrop-filter: none`、样式表内无 faceAdapt 规则。修复三处：① faceAdapt 规则改为**按 scope 现算**（`lcFaceAdaptCSS(sel)`，此时 `pubBase` 已初始化）；② **先拼字符串再落 DOM**，模板抛错时旧样式表原样保留，不再留空表；③ 重建样式表后 `lcUpdateFaceMaterial(true)` 强制重采样（此前只靠气泡观察器与 scroll 驱动，幂等化的 applyAll 常常不产生 `#main` 变动，observer 不触发，类名会停在关闭时清理过的空状态）
- **`lcFaceLuma` 采样亮度系统性偏差 + 缓存失效**：画布 cover 复现的 `drawImage` 源矩形错用视口尺寸——大图只采到左上角区域且 `sy` 算出负值（顶部一条透明带被 alpha 过滤跳过），该切深膜的不切；改为按图像自然尺寸算 center/cover 裁切。另两处缓存问题：画布 key 只含视口尺寸，换背景图后仍复用旧画布（加图版本号 `lcFaceCvVer` 作废重画）；背景图恰在开关切换后加载完成时无人补采样（共享 Image 挂一次性 `load` 钩子补跑，`addEventListener` 幂等、不与 `lcNavLuma` 冲突）
- **浅色卡片毛玻璃完全不渲染（"只有半透明没有磨砂"的真正根因）**：`lc-card-appear` 出现动画用 `animation-fill-mode: forwards` 收尾，把 `transform: translateY(0)/scale(1)/translateX(0)`（单位矩阵）永久钉在 `.m-mlist` 上——Chromium 里任何非 `none` 的 transform 祖先都会成为渲染面（render surface），卡面 `::before` 的 `backdrop-filter` 只能采到该渲染面内部（透明空容器），页面背景不在采样范围，磨砂静默失效；而侧栏玻璃不在 `.m-mlist` 内所以正常（探针三连定案：computed bf 在、祖先 filter/opacity/mask/isolation 全干净、`.m-mlist` 残留单位矩阵 transform）。**第一版修复（关键帧终点改 `transform: none`）实测不够**——重载后磨砂仍不渲染：Chrome 对 forwards 填帧状态无论终点值是否为 none 都会保留合成层 transform 节点。最终修法：**去掉 forwards，终态写进基类**——`.lc-card-visible { opacity: 1; animation: ... backwards }`，关键帧只定义 `from`（动画向基态插值，播完自然回落 `transform: none`）；`backwards` 只填交错延迟期（防延迟期间闪终态），播完不保留任何填帧值。已知边界：悬停放大的 transform 仍会在悬停期间短暂建立渲染面，磨砂可能在悬停瞬间消失（膜色不变），待真机确认是否可感
- **浅色磨砂卡片入场时仍有「半透明→磨砂」两段式观感（第二层根因）**：把入场位移从容器搬到卡面子元素后仍不完全——卡面宿主 `.mlistcnt` 自身在入场时 `opacity: 0→1`，**元素自身 opacity ≠1 同样使它成为 backdrop root**，挡住自己 `::before` 的 backdrop 采样，磨砂要到动画结束才出现。修复：磨砂开启时卡面/箭头伪元素的入场动画改为**只含 transform** 的 `lc-face-appear`（全程 opacity=1，磨砂从第一帧渲染），内容层单独用 `lc-face-fade` 做透明度渐入（`from { opacity: 0 }` 关键帧，播完回落基态、无 forwards 残留）；fadeIn 档无位移，卡面不参与动画。至此入场动画三要素各归其位：容器不动、卡面只动 transform、内容只动 opacity
- **右栏玻璃深材质下白色分割线刺眼**：站点边框（创作者中心菜单分隔线、头部下沿线）是配浅色底设计的，反色让位后在深色玻璃上呈实心白线，读作渲染故障而非设计元素。修复：`.lc-glass-dark` 内通配 `border-color → rgba(255,255,255,0.1)`——低透明白细线与 inset 边缘光同族，保留分隔不破玻璃质感；只动 border-color（零布局风险），浅材质不动（站点浅灰线本配浅底）
- **暗色模式下开侧栏玻璃 → 右侧栏卡片变米白底（白字不可读）**：暗色管线里针对右栏的预反色底有**两路**，玻璃开启时都要让位——① buildCSS 的样式表规则 `#rside #slide-bar [class*="-box-web"] { background-color: rgb(225,225,219) }`（`lcSideGlassOn()` 为真时整体不输出）；② **JS 内联注入**（`applyDarkOverlay` 的 `#rside [class*="box-web"]` 循环给元素写 inline `rgb(225,225,219) !important`）——inline 优先级高于一切样式表，哪怕①已让位、②照样把玻璃膜压成米白（2026-09-21 探针实证：`matchedRules` 里预反色规则已消失但 `computedBg` 仍是米白、`inlineStyle` 里躺着注入值）。修复：②同样加 `lcSideGlassOn()` 守卫，且开启时**反向回收**已注入的 inline（`removeProperty`），否则「关玻璃→开玻璃」切换后旧值残留。初版只在②加了守卫但被并行编辑覆盖丢失，导致「修了还在」——两路让位缺一不可
- **信息流淡透底落在容器底上、卡片仍实底**：根因是首页博文卡的卡面**不是元素背景，而是插件自绘管线的 `::before`**（`lc-dark-cards` 与 `ensureBubbleCards` 写死不透明预反色值 `rgb(225,225,219)`，反相后成实底 #1F1F19）——容器透了、卡面自己又画了层不透明的，透底自然「落不到卡上」。修复：新增 `lcFeedCardBg()` 统一取色——`darkMode.feedTranslucent` 开启时卡面改用半透明预反色值 `rgba(230,230,232,0.88)`（invert 只反 RGB、alpha 原样保留，显示为深色淡透，与容器 0.85 叠出「卡面略实、底更透」的层次），关闭时回退 `rgb(225,225,219)`。三处卡面绘制点（lc-dark-cards `::before`、ensureBubbleCards `color` 变量、其暗色 `::before` 覆盖规则）统一走该函数
- **右侧栏深材质下「创作者中心」/昵称/菜单悬停白底撞白字**：暗色反色为玻璃让位后，站点头部与悬停态的浅色底原样露出；这些元素全是构建 hash 类（`li/a/[class*="item"]` 选择器不命中），部分白底还走 background-image/伪元素，逐个识别不现实。改为**暗材质下内层底色一概透明**：卡内常见标签 `background-color: transparent !important` 全部露出深色玻璃膜本身（即用户要的「和暗色模式一样的暗色底」）；结构容器（div/li/a/ul/header）连 `background-image` 一并清掉（渐变白底），i/span 等内联元素保留 bg-image 防误杀雪碧图图标；`::before/::after` 铺底同步清透。行悬停高亮改由插件自给（`:hover:not(:has(:hover))` 只给最内层被悬停元素上 0.09 白膜，容器层不着色）
- **右侧栏玻璃开启后悬停放大动画明显掉帧**：站点对菜单项做 transform 放大，而玻璃卡是 SVG 引用滤镜（Chromium 走软件光栅化），子项动画每帧拖着整张玻璃卡重绘。把会被放大的子项（`li/a/div/[class*="item"]`）`will-change: transform` 提升为独立合成层，动画在自身层完成，不再牵动玻璃层重绘
- **侧栏从顶部滚动到粘滞跟随的瞬间闪一下实底**：LOFTER 切粘滞时重渲染卡片，React 重置 `className` 把 `lc-side-glass` 类洗掉，防抖链补挂前的延迟期露出站点原实底。新增专职快速看门 `lcSideWatchStart/Stop`：MutationObserver 只盯 `#rside` 的 class/子树变动，rAF 节流在**同一帧 paint 之前**补回类与玻璃（attach 幂等），现场即修不再有空档；关闭玻璃时 observer 一并 disconnect
- **隐藏块的分割线比其他分割线粗（第三形态：被隐藏行的「行容器残影」）**：跨帧探针取到真实层级数据 —— 被隐藏元素是 `div.cmti`（其 `prev/next` 均为 `null`，独居于 `li.a-slide.a-slide-do` 内），而**该 `li` 自身带 `border-top: solid 0.571429px`，内层隐藏后它仍然可见、仍高 1px**。每行都画自己的上边框，于是行 A 与行 B 之间同时出现「隐藏行 `li` 的残影边框 + 行 B 的上边框」两条线叠在一起 —— 这就是那条更粗的分割线（前两版方案：一个在 `.cmti` 层找兄弟、一个按边框/分割线个数清点，都碰不到这条残影）。修复：**隐藏时先做行单位提升再整行隐藏** —— `cmtRowUnit()` 用结构性判据「父层只包着当前这一个元素 ⇒ 父层内容就是这一行」，不猜类名、也不看边框，最多 6 层；`UL/OL/表格` 与 `body/html` 一律不抬（那是列表容器/文档根，不是行），因此不会把整张列表误藏。`cmtSeamUnit()` 改为直接委托 `cmtRowUnit()`，避免两处口径分叉。诊断新增 `lifted`（发生提升的条数），`marked` 改用 `cmtHidden.size`（按行单位计数更准）（jsdom 30 项断言通过：真实 `ul > li > div.cmti` 结构整行隐藏、**反证「只藏内层 div 时 A→B 之间有 2 条线」**、UL 只有一个 li 时不抬到 UL、父层有 2 个元素子节点时不抬、分割线元素混合场景每个间隙只剩 1 条线、React 洗掉内联样式后重算幂等、开关关闭全还原）
- **分割线叠加修复在真实结构下完全没生效（`seamHide=0`）**：探针实证 tag 页被隐藏元素是 `div.cmti`，而它的 `prev/next` **都是 null** —— 它是父级 `li` 里唯一的子元素，真正带兄弟关系的「行单位」是父级 `li`（`li.a-slide > div.cmti`）。前两版修复都在 `.cmti` 这一层找兄弟与分割线，因此一条也处理不到。改为两层改造：① **行单位提升** `cmtSeamUnit()` —— 自身没有元素兄弟就向上找（≤6 层，不越过 body），以 `li` 为单位比较；② **统一间隙清点** —— 隐藏行撤掉后逐间隙数「线的条数」= 保留下来的独立分割线元素数 + 上一行 `border-bottom` + 下一行 `border-top`，正常状态每个间隙恰好 1 条，>1 就逐个摘除（**优先摘分割线元素**，摘完仍多才摘下一行的 `border-top`；连续分割线只留最靠上的一条），既避免「只有上/下边框」设计里把唯一分割线删掉，也覆盖分割线与边框混合叠加的情况。诊断新增 `seamBorder`。另修一个测量陷阱：jsdom 对无边框元素返回 `border-bottom-width:16px` 幽灵值（`border-style` 仍是 `none`），`cmtBorderW()` 现在**要求 `border-style` 非 `none`/`hidden` 才算数**，否则会把普通行误判成有边框、连正分割线一起摘掉（jsdom 18 项断言通过：真实 `li > .cmti` 结构、行边框贴合、仅上/下边框不误伤、分割线+边框混合、三条分割线只留一条、名单清空还原、无隐藏行容器不插手）
- **隐藏块的分割线比其他分割线粗（第二形态：分割线是独立元素）**：DevTools 实测 tag 页评论分割线不是边框，而是**独立的空 `li.a-slide` 元素**（高度 ~0.58px、无文本、与评论行同类名）——上一版的边框方案（`cmtSeamSync`）根本碰不到它。排布 `[评论行][分割线li][被隐藏行][分割线li][评论行]`，中间的行隐藏后两条分割线 li 相邻贴在一起 → 双线。新增 `cmtDividerDedup()`：在**含有被隐藏条目的容器**里，把「连续两个可见分割线元素」（判据：无文本 + `0 < offsetHeight ≤ 2px`；已挂修复类的元素视作分割线保证幂等）中的**后一个**藏掉（`display:none`），恰好恢复单线；被隐藏的行在遍历中视作不存在（不重置连线），多条隐藏行夹多条分割线时也只留第一条。标记每次 `cmtApply` 全量重算，隐藏集合变化后自动还原；诊断新增 `seamHide` 字段。只在含隐藏条目的容器内生效，页面其他位置的相邻分割线不碰（jsdom 18 项断言通过：单条/多条隐藏行去重、有内容的行永不误判、无隐藏行的容器不插手、名单清空还原、边框贴合修复共存）
- **隐藏块的分割线比其他分割线粗（第一形态：边框贴合）**：可见行 A — [若干被隐藏行] — 可见行 B 的排布里，A 的 `border-bottom` 与 B 的 `border-top` 原本各隔着隐藏行，隐藏后贴成一条 2px 粗线（2026-09-21 用户截图）。新增 `cmtSeamSync()`：**只在两侧都有对应边框时**给 B 挂 `.lc-cmt-seam`（`border-top-width: 0 !important`），恢复 1px——刻意只摘一侧：两侧都摘会在「每行只有下边框」的设计里把唯一的分割线也删掉；无条件摘 B 的 top 则会在「每行只有上边框」的设计里弄丢本来就不粗的线。边框测量走 computed style（jsdom 等无布局环境回退行内样式）；标记每次 `cmtApply` 全量重算，隐藏集合变化后不再构成贴合的行自动摘掉修复类（jsdom 9 项断言通过：双侧边框摘一行、仅上/仅下边框设计不误伤、连续多条隐藏行、名单清空还原、重算幂等）
- **评论区隐藏后 tag 页残留一大块空白**：隐藏走 `display:none` 不占位，但 LOFTER 的评论容器常按**渲染时**的内容高度把 `height`/`min-height` 定死（展开动画量完即定高的常见做法）——评论被隐藏后内容变矮、容器不跟着缩，就在「查看更多」上方留下大块空白（2026-09-21 用户截图）。新增 `cmtCollapseSync()` 自愈收缩：对每个被隐藏条目的祖先（≤6 层）测量实际空白（`clientHeight − Σ 可见子元素 offsetHeight − 上下 padding`，`display:none` 的子元素不计入），**空白 >48px 才挂 `.lc-cmt-collapse`**（`height:auto!important; min-height:0!important; max-height:none!important`，行内定高也会被压过，摘掉时无需备份恢复行内样式）；「查看更多」加载出新评论、空白消失后自动摘掉（每次 `cmtApply` 重算），看门狗 1.2s 补挂被 React 重渲染洗掉的收缩类。普通无定高容器测得空白 ≤0 永不触发；诊断新增 `collapsed` 字段（jsdom 桩高度 14 项断言通过：定高容器挂类、回填自动摘掉、关开关还原、无定高不受影响）
- **收缩类与 LOFTER 定高/展开脚本拉锯，空白不停「缩回↔展开」抖动**：初版摘类条件是**测量值**（「测得空白 ≤48 就摘」），而 LOFTER 自己的脚本会反复重写容器内联高度 —— 一摘一挂两边互相拉锯，表现为空白抖动不止，直到「查看更多」把内容撑满、双方都测不到空白才停（2026-09-21 用户实测）。改为**状态判据**：挂类后只要容器里还有本插件隐藏的条目就**保持收缩、绝不按测量摘**——带 `!important` 的类永远压得过它的内联样式，挂上后对方写什么都无效，拉锯自然停止；只有容器里不再有隐藏条目（名单清空 / 关闭开关 / 取消屏蔽）才摘类恢复原状。看门狗补挂同样对齐该判据（只补「还藏着隐藏条目」的容器，防止登记过期后永远收缩）（jsdom 11 项断言通过：空白测得 0 也不摘、LOFTER 重写高度后类仍在、5 轮压/撑循环不抖、名单清空/关开关正确还原、无空白容器不挂类）
- **评论区 iframe（`comment.do`）命中名单却一条也不隐藏（items=0）**：跨帧汇总探针拿到那帧真实数据 `style=true bodies=78 matched=["huayuflowerxuan"] items=0`，并顺带拿到逐层 TRACE —— 真实层级是 `div.bcmt > div.bcmtlst > ul.clearfix.ztag{b:78} > li.s-bd2.s-bg2{b:2} > div.bcmtlsta > … > div.bcmtlstj`，两个成因：① v1 的「头像锚点唯一」判据在这套结构里恒等于失效（**整帧 `a:0`，根本没有头像容器**）；② v2 的「取仍只含 1 个正文锚点的最高祖先」被行内第二个 `.bcmtlstf`（作者名后的「：」分隔符，带「回复 @xx：」的楼层会有两个）撞断，第一个祖先就判成「已越级到评论列表」而整条放弃。改为 **`cmtFindItem()` 离散单元边界法**：从作者链接向上爬，跳过尚无正文的包裹层（`.itag`、`.bcmtlstb`），找到第一个满足「父层正文锚点数 > 本层正文锚点数」或「父层是 ul/ol/dl」的层 —— 即整行 `li`；不猜混淆类名、也不依赖头像。安全阀：本层正文数 >4 视为已越级返回 null，上行上限 12 层（宁漏杀不误杀）。同时新增 `cmtIsRowAuthor()`：行内结构里作者链接 = 该条评论**第一个**非提及博客链接（实测一行最多 7 个博客链接：头像、作者名、回复 @xx），其后的都当正文引用 —— 否则正文里贴了被屏蔽者主页链接就会藏掉别人的整行。`trace` 诊断补 `pb`（父层正文数，一眼看出边界在哪层）（jsdom 25 项断言通过：真实层级整行隐藏、单条列表 + 多层包裹、正文引用不误杀、@提及不误杀、无正文锚点的卡片不误藏、关开关还原、官方名单并集）
- **探针控制台抛 `Uncaught TypeError: ceW.indexOf is not a function`（页面 `core.js` / `pt_page_control.js`）**：跨帧汇总 v1 用 `postMessage({lc:'cmt-req'})` 广播、子帧回 `cmt-res`，撞进页面自己的 message 处理器 —— 它把 `e.data` 当字符串做 `indexOf`，收到对象就抛。改为 **`chrome.storage` 中继**（content script 在任意帧共享存储，完全不碰页面消息通道）：顶层帧探测写 `lc_cmt_diag_req_v1 = probeId` → 各子帧在既有的 `storage.onChanged` 里收到就自报 → 写入 `lc_cmt_diag_v1[帧URL]` → 顶层帧监听到即汇总回 `<html data-lc-probe-cmt>`。每条诊断带 `probeId`，只汇总本轮结果；最多保留 8 帧记录避免存储无限增长；子帧控制台直接跑探针时仍写本帧 `data-lc-probe-cmt`（单帧结果立即可见）
- **浅色模式下关闭过滤开关 → 页面突然变暗（探针实证）**：`lc-probe` 两次快照对比坐实——关过滤后 `darkMode.mode` 从 `off` 变 `manual`（`lc-style` 153KB→303KB、`#main` 出现 `invert(1)`、遮罩被建）。根因：popup 是常驻 iframe，`state` 只在面板加载时读一次存储，而其 storage.onChanged 监听器"只重算暗色、不回写 state"——用户在别处把 `darkMode` 从 manual 改回 off 后面板 state 仍是旧值，下一次任意 save() 全量写盘就把 manual 写回。修复：onChanged 改为**字段级和解**——与 state 不同的字段 adopt 进来并重渲染，自己刚写的字段（incoming===state）自然跳过，不打断正在输入的控件
- **悬停浮现「拉黑」点不到 / 按钮常驻不消失**：三个叠加问题——① 隐藏态规则曾漏写 `opacity: 0; visibility: hidden`（浮现逻辑在、隐藏态丢 → 常驻）；② 按钮换行落到作者行盒子外时，`pointer-events:none` 在鼠标离行瞬间生效，永远挪不到按钮上 → 隐藏态改用 `visibility` 过渡延迟（淡出延迟 0.3s，期间仍可交互），加按钮自身 `:hover`/`:focus-visible` 保活；③ `filterClearAll()` 只删 `lc-mute-btn` 漏删 `lc-blk-btn`，关闭过滤后「拉黑」残留叠在头像上 → 两个类一起删
- **「隐藏/拉黑」按钮消失（过滤开着也没有）**：按钮的创建条件此前绑在"过滤规则非空"上——`applyFilter` 的 active 判定要求"至少一条关键词或一个已屏蔽用户"，列表为空时整个模块走 off 分支，`filterClearAll()` 把按钮一并收掉。表现就是：过滤开关开着、但关键词/用户列表是空的 → 全站找不到「隐藏」按钮。修复：按钮与规则解耦，只要"过滤启用 + 当前页在范围内"就挂按钮、跑扫描（空规则时命中为零，只挂按钮不藏卡片）
- **从毛玻璃切到液态玻璃后仍是浅色白膜、材质自适应失效**：毛玻璃档在 `#lofter-top-bar` 上写过内联 `background: rgba(255,255,255,0.35) !important`，而 hyalite 分支只清 `backdrop-filter`。内联 important 压过样式表里的白膜/深膜规则（含 `.lc-glass-dark`），于是深色背景上切到液态玻璃仍残留浅色。修复：hyalite 分支同时清掉内联 `background` / `background-image` / `border-bottom` / `border-radius`
- **深色背景 + 液态玻璃时全页文字变白 / 面板文字不可读**：`.lc-glass-dark` 曾挂在 `[class*="box-web"]`（子串匹配取首个）上，而不同页面首个匹配可能是页壳（含全部内容与右侧栏）或页脚——后代白字规则把全页超链接刷白；老管线 `#lofter-top-bar.lc-glass-dark div` 则把 top-bar 子树里的搜索/其他下拉面板文字一并刷白。修复：材质类一律挂玻璃条自身（新管线新增 `lcFindNavBox()`：遍历所有 `box-web` 匹配、取第 3 层 div 高度在 28~140px 的第一个，避开页壳/页脚）；文字规则只刷 `a`/`span` 不再刷 `div`；下拉面板（`-content-web`/`-body-web`，控制台实测新版为 `style-xx-content-web`/`-body-web`，与老管线同语义）做豁免——老管线用同块靠后的字面色规则，新管线改用 **CSS 变量继承**（`--lc-nav-ink` / `--lc-nav-fill` 定义在玻璃条上、面板容器重定义），面板子树自动回到深色且不参与优先级排序；深色模式下新管线的面板豁免不生成（那里面板是暗底白字）。**两条管线的材质颜色统一改为 CSS 变量制**（`--lc-nav-ink` / `--lc-nav-fill` 定义在玻璃条上、面板容器重定义）——老管线原先是「浅色一套 `:not(.lc-glass-dark)` 黑字 + 深色一套白字 + 面板字面 `#333` 豁免」，现已与新管线同构。面板内的强调色 tag 用 `:not([class*="GpLmHKrgQS9DGUHQapUffw=="]):not([class*="AV8Mt74pTEHQXrEBEKFaUg=="])` 从刷色规则里排除，保留站点自身强调色（前者取自用户实测的搜索下拉「相关的文章」行，后者是站内 tag 锚点；类名变更时优先查这里）

- **评论区隐藏官方黑名单用户（预留开关转正）**：`official.hideInComments`（面板「官方黑名单」区的「评论区也隐藏黑名单用户」，此前标注"预留"、内容脚本从未实现）正式生效——开启后评论过滤把**官方黑名单成员并入隐藏名单**。架构：官方名单镜像存 `chrome.storage.local` 的新键 `lc_official_bl_v1`（`{names: [小写 blogName], ts}`）——popup 能调 DWR（面板读取/添加/移除成功后都写镜像），www 域页面帧的 `lcOfficialBlReady()` 拉取成功也写镜像；评论过滤模块在**任意帧只读存储**（子域博文页跨域调不通 DWR 也能用），onChanged 双键监听实时生效。id 口径与评论作者解析一致（blogName = 子域名首段，统一小写比较）。默认值改为 `true`（拉黑了就该看不到，开关作为退出口）；**老用户若曾保存过设置，存储里可能是显式 `false`，需在面板手动打开一次**。诊断桥 `cmt` 段新增 `official`（镜像成员数）与 `useOfficial`（开关是否生效）
- **「拉黑」在博文页点了没反应（本地隐藏被官方接口绑死）**：拉黑按钮的本地隐藏写入排在 `addBlacklist` 的 `.then` 里——子域博文页（如 `lofguancha.lofter.com/post/xxx`）跨域调不通 DWR，走失败分支，于是「官方没拉黑 + 本地也没隐藏」，表现为点完拉黑帖子与评论照旧可见（2026-09-21 探针实证：屏蔽名单为空，`blocked:0`）。修复：**本地隐藏先行**（无条件写入 `filter.users` + 立即 `applyFilter()`），官方拉黑异步补，失败也不回滚本地隐藏（按钮短暂显示「已本地隐藏」并在 title 里说明原因）
- **探针增加作者 id 采样 / 评论过滤专用帧内桥**：`<html data-lc-probe>` 的 `cmt.sample` 字段在名单为空时也能列出前 5 个抓到的评论作者 id——用于区分「没人被屏蔽」与「选择器/id 解析坏了」；另加**任意帧**可用的 `lc-probe-cmt` 事件桥（主帧那个完整桥进不了子帧，子帧在本文件更早处 `throw` 退出），写回 `<html data-lc-probe-cmt>`（含帧 URL、是否顶层帧、`cmtDiag`）——子域博文页的评论 iframe 若是跨域，需在控制台帧选择器切到该帧再执行
- **博文页（子域）评论 iframe 里评论过滤完全不生效**：`lofguancha.lofter.com/post/…` 的评论区是 `https://www.lofter.com/comment.do?pid=…` 这个 iframe（探针实测帧内 76 个 `.bcmtlstf`，manifest 的 matches 与 `all_frames` 都覆盖它）。该帧探针显示「本帧无桥」、样式表也不存在——该页是旧式服务端渲染页，解析过程中 `document.write()` 触发隐式 `document.open()`，会清空文档并连带抹掉已注入的 `<style>` 与挂在 `document`/`<html>` 上的监听，而 content script 每帧只执行一次，此后无人补挂。修复：评论过滤模块改为**可重入 + 自发现文档重建**——`lcCmtArm()` 记录挂载时的 `documentElement` 引用，前 20 秒每秒比对一次（引用变了或样式表被抹掉就重跑，之后自动停掉，不留常驻定时器）；重挂时先 `disconnect()` 旧观察者（它指向已废弃的旧 `<html>`）、重建样式表、把观察者挂到当前 `documentElement`；调试桥从 `documentElement` 迁到 **`window`**（`document.open()` 清不掉 window 上的监听），并在当前 `documentElement` 上再挂一份，兼容不冒泡的事件派发。诊断段新增 `style`（本帧样式表是否存在 = 「content script 到底跑没跑」）、`docSwaps`（文档被重建过几次）、`chain`（从首个正文锚点向上 5 层的 `tag.class`，换结构时不用猜容器类名）
- **探针升级为跨帧汇总**：`comment.do` 与帖子页不同源，父帧读不到子帧 DOM，此前必须先在 DevTools 帧选择器里切到评论帧才能看到它的状态（2026-09-21 两次跑错帧，白折腾一轮）。现在顶层帧探测时广播 `cmt-req`，各子帧用 `postMessage` 自报 `cmt-res`（隔离世界里 `ev.source` 常为 `null`，回退 `window.parent`），全部汇总进同一个 `<html data-lc-probe-cmt>`（只有自身一帧时仍是单个对象，多帧时为数组）——在顶层帧跑一次即可看到评论 iframe 里插件的真实状态，包括 `style`（该帧的 content script 到底跑没跑）
- **旧式评论条目藏不准（只藏正文行 / 整条不藏）**：`cmtFindItem()` 原按「含 1 个正文锚点的**最小/最高**祖先」收敛，实测两处硬伤——① 评论区 iframe 里 `.bcmtlstf` 是作者名后那个「：」分隔符（样例 `<span class="bcmtlstf s-fc4">：</span>`，并非正文容器），取最小祖先只藏到 `.bcmthot` 正文行、头像与「回复/投诉」留在原地；② 含「回复 @xx：」楼层的行正文锚点 ≥2，第一个祖先就被判「已越级到评论列表」而整条放弃（2026-09-21 探针：`comment.do` 帧 `bodies:78`、`matched:["huayuflowerxuan"]` 却 `items:0`）。现改为**正文锚点 + 头像锚点双判据**向上收敛：取「含正文锚点、且头像唯一」的最高祖先 = 整行（`av > 1` 或「正文 > 1 且 头像 ≠ 1」即判定越级并停止；评论区每行 1 个头像 vs 列表几十个，正好补上正文锚点判据的死角），实测收敛到 `.bcmtbox`。另加**候选必须含正文锚点**的保护——帖子页的帖子卡片（0 正文锚点、1 头像）永不成为候选，避免误藏整张卡片。上行上限 10 层。诊断段新增 `avatars` / `unresolved` 与 `trace`（收敛失败时逐层给出 `tag.class` + 正文锚点/头像/博客链接计数，一次即可定位真实结构）；jsdom 断言通过：双判据规则 8 项（常规行、扁平行、帖子卡片不误伤、@提及不误杀、关开关还原）+ 重挂/`document.write` 重建 14 项

## [1.1.4] - 2026-09-19

### 新增

- **关键词/用户过滤（Phase 1：首页 + 标签页）**：配置挂在「功能」栏——总开关（默认关闭）、生效范围勾选（首页/标签页）、关键词列表（换行或中英文逗号/分号分隔，自动去重，大小写不敏感，匹配标题+正文+标签，命中任一即隐藏整帖）、被屏蔽用户列表（主页 id 精确等值匹配，子串不误杀）、「已过滤 N 条」常驻提示（防误杀无感，可关）。信息流卡片作者旁有一键「隐藏」按钮（float 排版适配），写入走 get→merge→set 不覆盖并发字段。配置随「功能」模块纳入导入导出
- 隐藏实现：`data-lc-filtered` 标记 + 高权重样式表规则，叠加内联 `display:none !important` 双保险（LOFTER 自有规则级联更晚，样式表规则单独会被压过）；内联 display 的所有权备份存模块级 WeakMap，不写进卡片 DOM——LOFTER 的 React 重渲染/水合会洗掉不认识的 data-* 属性、保留 style，写在节点上的备份会丢、隐藏因此变孤儿

### 修复

- 过滤管线在真实页面上的一系列竞态，最终形态为**激活态每个防抖批次全量幂等重算**（签名早退优化连修三轮仍有竞态，已删除；扫描只是几十张卡片文本匹配，开销可忽略）：
  - 关闭分支只清空 style.textContent 不删元素，重开后 `!st` 判定失效，CSS 永不回填——标记照打、计数照显、一条藏不掉；
  - 「已隐藏标记数」进入扫描指纹但落盘用扫描前的值，标记被 React 洗掉后恰好对上旧值 → 永不重扫；
  - 扫描签名在扫描前落盘，中途抛错（被 lcSafe 吞掉）即卡死在旧签名，计数器/按钮从此不刷新；
  - 内联 display 还原直接 `removeProperty`，会误删 LOFTER 写在卡片上的内联 display（表现为移除规则后整排卡片排版失效、滚动才恢复）→ 改为带备份的还原；
  - 备份写在卡片 data-* 属性上被 React 洗掉后恢复函数提前返回 → `display:none !important` 成孤儿、卡片永久隐藏只能刷新（用户观察「计数归零＝扫描在跑且未命中、标记也摘了，卡片却仍隐藏」是关键证据）→ 备份改存 WeakMap；
  - 扫描循环的嵌套跳过用 `card.closest("[data-lc-filtered]")`，而 **`closest()` 会匹配元素自身**——已标记卡片从第二轮扫描起全被跳过：计数器闪现即逝（hidden 永远数 0）、安静页面下规则移除走不到还原分支（此前恢复全靠 React 洗标记后的孤儿自愈兜底）→ 改查 `parentElement.closest` 只看祖先
- popup 增加 `storage.onChanged` 监听：页面上点「隐藏」后，打开着的面板立即同步屏蔽列表

### 开发工具

- `test-filter.js`（工作区，未入库）：jsdom 逻辑回归 9 用例——大小写归一/标签命中/id 精确匹配、范围外零动作、关闭清理、卡片按钮写回、关→开 CSS 回填、标记洗掉自愈、孤儿内联还原（激活态/off 态双路径）、closest 自匹配双轮扫描。调试手段：jsdom 页面内 monkeypatch `setAttribute`/`textContent` 审计，锁定「扫描跑了但早退」

## [1.1.3] - 2026-09-18

### 修复

- **字数角标掉到导航栏下方左上角**：LOFTER 写作页改版，触发按钮 `#btm-music` 不复存在（现为 `#btn-music`，class `btn-icon btn-music`），`#menu-music` 从按钮变成了藏在 header 下的白噪音下拉菜单、折叠态仅 161x1px，骗过了「有盒子即可见」判定被错当锚点。现在锚点候选按 `#btn-music` → `#btm-music` → `.btn-music` → `#menu-music` 顺序查找；锚点可见性增加 8px 高度下限（宽度仍不设阈值，窄字形图标不受影响）；回退排除名单补齐 logo / 头像 / 音乐类，className 与 id 双查
- **字数角标跑到头像右上角**：新版 `.right` 是 `position:absolute` 的块容器，图标 `a` 全靠 `float:left` 排横；不浮动的角标被当作普通行内内容挤到行尾右上（实测 rect `[940,-1]`）。角标现在跟着 `float:left`（flex 容器会忽略 float，row / row-reverse 版本不受影响）
- **字数角标贴着页面顶部**：`applyWordCounter` 原先先落位（按锚点中心差实测写 `marginTop` 做垂直对齐）再上漆，而 `wcPaint` 开头 `cssText=""` 会清掉全部内联样式，垂直补偿每次都被抹掉。改为先 `wcPaint` 再落位；float 行顶对齐的偏差由实测补偿收敛，flex 垂直居中版本差值≈0 不写

### 变更

- `manifest.json` 版本号 1.1.3

### 开发工具

- `tools/wc-place-check.py`：mock 更新为 2026-09-18 傍晚线上真实 DOM（`btn-*` 命名、折叠态 `#menu-music` 陷阱、logo 陷阱），新增线上 `float-items` 布局用例（`.right` absolute + 图标 float + ~17px 顶部偏移），量测增加垂直对齐断言（中心差 ≤3px）；已用「临时回退修复」验证断言能精确复现线上两个 bug，防止虚过

## [1.1.2] - 2026-09-18

### 修复

- **长文章编辑器变白底黑字（1.1.1 引入的回归）**：1.1.1 为字数桥接开启 `match_about_blank` 后，`content.js` 被注入进编辑器自己的 `about:blank` 子帧；该帧 `location.href` 不含 `lf127.net`，于是落进评论区 iframe 分支、又叠了一层 `body{filter:invert}`，与父帧 `#main` 的反色相互抵消——背景 `rgb(225,225,219)` 反回浅色、预反色文字 `rgb(38,38,38)` 反回近黑。现在 `about:` 开头的帧一律直接退出：编辑器暗色由父帧 `applyLongpostEditorDark` 负责，计数由 `wc-frame.js` 负责
- **字数角标位置**：锚点改为顶栏「插入音乐」按钮——线上真实 id 是 `#btm-music`（class `icon icon-btm-music`，2026-09-18 实测 DOM），兼容旧版 `#menu-music`；直接在 `.m-hd-longpost` 范围内查找，不假定所在容器（`.right` 在实测里是 `float: left`）。角标贴其视觉左侧；顶栏右栏是 `flex-direction: row-reverse` 的版本里 DOM 顺序与视觉左右相反，先按 flex 方向选边、再用实测矩形校正一次，不再被塞到顶栏最右侧；回退锚点排除预览/发布/箭头/头像按钮时同时覆盖 `btn-` 与 `btm-` 前缀（旧正则漏掉 `btm-arrow-do` 导致锚错按钮）；锚点可见性不再用固定宽度阈值（顶栏图标按钮可能只有一个窄字形，实测 8px 宽，会被误判不可见）；找不到锚点（如编辑弹窗）仍回退右下角 fixed
- **`about:blank` 子帧不再被主站管线接管**：新增第 4 条 iframe 前置规则（见 `docs/architecture.md`），`about:` 开头的帧一律直接退出

### 变更

- `manifest.json` 版本号 1.1.2

### 开发工具

- `tools/wc-place-check.py`：用无头浏览器渲染与写作页顶栏同构的 mock（DOM id/class 抄自线上实测：`#btm-music`、`btm-preview-*`、`btm-arrow-do` 等；布局覆盖 row / row-reverse / 线上的 `float: left` 三种写法），真实加载 `content.js` 后量测角标与音乐按钮的矩形，验证角标落在音乐按钮左侧

## [1.1.1] - 2026-09-18

### 修复

- **长文章字数统计在真实页面上不显示**：编辑器 UEditor 正文 iframe 可能跨域（lf127.net），主帧读不到 `contentDocument`，角标被直接收回。新增 `wc-frame.js` 桥接脚本注入子帧计数后 `postMessage` 上报（消息只含三个整数，不传正文），主帧只认来自编辑器 iframe 的消息；同源路径保留
- **字数角标位置**：改为内联在长文章写作页顶栏右栏第一个图标（插入音乐按钮，即未来白噪音的预留位）左侧；找不到锚点（如编辑弹窗）时回退右下角 fixed 角标
- **FAB 吸附 logo 时每次打开页面都有"从右下角飞过去"的动画**：启动静默期（用户首次触碰按钮前，至多 15s）内的探测重摆一律免过渡，按钮直接出现在 logo 位置
- **暗色面板下「其他 → 数据」的模块勾选 chip 残留浅色底**：`--lc-accent-weak` 在 `:root` 用 `color-mix(…, var(--lc-card))` 派生，自定义属性在声明元素处即完成替换，`body.dark` 覆盖 `--lc-card` 无法回改；已在 `body.dark` 重声明。hover/聚焦态同步修复；「关于」栏版本号内联 `#555` 改主题变量

### 变更

- `manifest.json`：`host_permissions` 增加 `lf127.net`（编辑器 iframe 所在域，用于注入桥接脚本）；`content_scripts` 增加 `wc-frame.js` 子帧注入条目与 `match_about_blank`

## [1.1.0] - 2026-09-18

### 新增

**悬浮按钮（FAB）**

- 设置面板新增右下角悬浮入口：可拖动、停靠左右边缘并记忆位置，拖动时面板实时跟随
- 展开方向自适应：角部上下展开、中部侧向展开、窄窗口自动压缩，展开时始终不遮挡按钮
- 图标为全 CSS 分层绘制（星球 + 完整星环 + 管状 L + 星光点缀），泡泡透明配色，色值集中在 CSS 变量中便于调整
- 默认位置对齐页面回顶按钮；新增 logo 吸附彩蛋

**设置面板**

- 栏目重构为五栏：显示 / 装饰 / 卡片 / 导航 / 其他，字体并入「显示」，装饰图独立成栏
- 面板固定蓝紫配色，不再跟随页面主题色；台头与一级栏目固定，滚动只发生在卡片主体
- 支持暗色跟随：网页手动开启暗色或系统暗色时面板自动变暗
- 视觉美化：台头星球与手写标识、栏目切换滑动色块、细滚动条、星点微闪

**功能栏（新增第 6 栏）**

- 「功能」栏落地，用于承载往页面注入的功能，每项独立开关、默认关闭
- 长文章实时字数统计：长文章编辑器右下角常驻显示，随输入实时更新，同时覆盖「长文章编辑弹窗」；口径为汉字按字、连续英文/数字按词，标点计入总字符，悬停可看汉字 / 英文数字词 / 总字符明细
- 计数器排在编辑器右下角、定点于视口，不吃点击也不参与编辑器布局（不触碰站点自带的 placeholder 定位）

**配置导入导出（「其他」栏 →「数据」）**

- 导出：一键导出全部设置，或按模块（显示 / 装饰 / 卡片 / 导航 / 功能 / 其他）勾选导出
- 导入：按模块覆盖，文件里没有的模块保持当前值；兼容本扩展导出的包裹格式与手写的裸设置对象
- 安全性：导入前弹确认框、列出被忽略的未知项；非白名单键一律剥离，不写入 storage
- 免权限实现（Blob + `<a download>` + `input[type=file]`），不申请 `downloads` 权限，无任何网络请求
- 面板滑动色块改为按标签数（6 栏）等分计算

### 变更

- 插件图标统一为「星球 L」样式：16 / 32 / 48 / 128 各尺寸独立出图，小尺寸使用简化版保证可辨
- 设置面板迁移至悬浮按钮，工具栏弹窗入口保留

### 修复

- 部分字体（如京華老宋体）系统注册名只有英文，中文名匹配失败而回退默认字体：新增字体别名表，中英文名均可生效，已保存的旧配置自动纠正
- 快捷键行的键位标签误用说明文字样式，导致末字换行：改用独立样式，键位不再换行
- 从工具栏打开面板时窗口高度塌缩成一条：顶层窗口单独定高，iframe 场景不受影响
- 音效设置、词卡编辑两个弹窗未适配暗色（白壳黑卡混搭）

### 开发工具

- `tools/icon-export.html`：无头浏览器渲染导出插件图标 PNG（各尺寸）
- `tools/icon-lab.html`：图标配色实时调试台
- `tools/panel-shot.py`：把 popup.html 在扩展环境外注入 chrome 桩后无头截图，重出 README 面板演示图（`assets/screenshots/panel-*.png`）

## [1.0.0] - 2026-09-15

首个公开版本。

### 新增

**暗色模式**

- 三档模式：关闭 / 手动开启 / 跟随系统，支持快捷键 `Ctrl+Shift+K` 切换
- 新旧两套页面全覆盖：旧版页面走 `filter` 反色管线，新版 React 页面走直绘管线
- 卡片亮度、内容透明度可调，暗色下背景图仍可透出
- 深度适配三十余处页面与弹窗，细节覆盖下拉框、滚动条、勾选框、雪碧图按钮

**背景与装饰**

- 四种背景类型：纯色 / 渐变 / 图案（网格·圆点·条纹）/ 自定义图片（支持 GIF，模糊度可调）
- 页面装饰图：多张贴图自由添加，可视化拖拽与缩放，可设为「覆盖卡片」保证点击响应
- 装饰互动效果：呼吸 / 浮动待机动画、点击热区与挤压回弹、emoji 粒子、自定义音效、词卡弹窗
- 内容透明度独立控制

**卡片**

- 圆角、间距、阴影全局可调
- 四种出现动画（上浮 / 淡入 / 缩放 / 侧滑），支持交错节奏与时长调节

**字体与导航**

- **字体预置**：三款推荐字体一键填入字体名（思源黑体 / 霞鹜文楷 / HarmonyOS Sans），也可手输任意字体名；字体由用户自行安装到系统，扩展不打包字体文件，未安装时自动回退系统默认字体
- 全局字号缩放
- 导航栏透明 / 毛玻璃，自定义回顶按钮图片与搜索框占位文字

**实用工具**

- 长文章搜索框：关键词检索，支持勾选一键批量删除
- 归档页搜索框：结果以网格缩略形式就地展示
- 自动获取图片 / 视频博文标题：在个人主页补显大标题

### 页面适配覆盖

首页发布栏 · 草稿页 · 话题页 · 发现页（含专题页）· 我关注的人 · 查看更多页 · 创作者中心 · 连载作品管理 · 章节管理与章节编辑 · 批量管理日志页 · 标签页 · 长文章编辑弹窗 · 合集 / 系列 · 登录页 · 帮助与客服中心 · 政策文档页 · 各类全局弹窗

### 技术说明

- Manifest V3，纯内容脚本注入，无后台常驻逻辑
- 配置存于 `chrome.storage.local`（键名 `lc_settings_v1`），不收集、不上传任何数据
- 详见 [docs/architecture.md](docs/architecture.md)
