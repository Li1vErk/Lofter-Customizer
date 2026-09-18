# 架构与实现说明

本文说明 Lofter Customizer 的整体架构，以及为 LOFTER 做页面美化时会踩到的坑与对应策略。
如果你打算为其他站点开发类似的样式注入扩展，第 3–6 节的经验同样适用。

## 1. 总览

| 项 | 说明 |
|---|---|
| 扩展规范 | Manifest V3 |
| 技术栈 | 原生 JavaScript + CSS，**无框架、无构建步骤**，克隆即改 |
| 注入方式 | 内容脚本（content script），`run_at: document_start`，`all_frames: true` |
| 配置存储 | `chrome.storage.local`，键名 `lc_settings_v1` |
| 网络行为 | 无任何远程请求；不上传数据 |
| 后台逻辑 | 仅 `background.js` 注册快捷键命令，无常驻逻辑 |

### 文件职责

| 文件 | 职责 |
|---|---|
| `manifest.json` | 扩展清单：权限、内容脚本注入范围、快捷键命令 |
| `defaults.js` | 配置结构默认值（`LC_DEFAULTS`）、字体预置表（`LC_FONT_PRESETS`）、深合并与克隆工具；以 `window.LC_*` 暴露给 `content.js` |
| `content.js` | 全部页面逻辑：样式生成、DOM 处理、观察器、装饰交互（单体文件，内部分区注释） |
| `popup.html` / `popup.js` | 设置面板 UI 与读写逻辑 |
| `background.js` | 快捷键命令分发 |
| `icons/` | 扩展图标 |

> 扩展**不打包字体与音频素材**：大二进制文件（CJK 字体、白噪音）一律由用户自备并安装到系统（字体）或后续版本自选本地文件（音频），扩展只写样式/引用路径。这既控制了安装包体积，也把素材授权责任留给用户。

`content.js` 体积较大但**内部按页面分区**，用统一的分区注释标记：

```js
/* ===== 页面名（锚点标识）===== */
```

搜索该模式即可快速定位到某个页面的全部规则。分区数量与页面覆盖范围一一对应，新增页面适配时请沿用同一格式。

## 2. 样式生成流程

```
settings (chrome.storage.local)
        │
        ├─► buildCSS(settings)        → 生成整站样式表文本 → 注入单个 <style id="lc-style">
        ├─► applyStyle()              → 幂等更新该 style 内容
        ├─► applyDarkOverlay()        → 暗色叠加层
        ├─► applyFontFace()           → @font-face 注入（仅用于"字体文件直接嵌入"通道，当前面板未接线）
        ├─► 字体名写入               → 通过 font.family 生成 font-family 规则（预置=一键填入字体名）
        ├─► 各页面专用补丁函数（JS 内联 / 观察器）
        └─► 功能栏注入（tools.*）     → 如 applyWordCounter：同源 iframe 内取文本 + 主文档挂角标
```

要点：

- 全站样式集中在一张样式表中，通过重写 `textContent` 实现更新，避免大量 `<style>` 节点堆积。
- 设置项在 `defaults.js` 中集中定义，`LC_merge` 负责与用户已存配置做深合并，保证新增字段对老用户生效。
- 体积较大的字段（装饰图 dataUrl、互动音效）与样式生成解耦，避免每次重建 CSS 都做无谓拼接。
- **功能栏（`settings.tools`）约定**：每项独立开关、默认关闭；每项自带「页面不存在时自我收回」的清理分支（如 `applyWordCounter()` 找不到编辑器就直接移除角标与轮询），避免开关残留或空转轮询。
- **两条「不碰站点布局」的红线**：
  1. 不给站点自己的外层容器（如长文章编辑器的 `.editorWrap`）加 `position`——站内已有绝对定位的 placeholder label，改变包含块会把它挪走；
  2. 自绘浮层挂在 `document.documentElement` 下（`position: fixed` + `pointer-events: none`），既躲开 `#main` / `#rside` 等容器的反色滤镜，也不参与页面布局、不遮挡站点点击。
- **iframe 注入范围的三条规矩**（`manifest.content_scripts`）：
  1. 主站管线 `content.js` 只跑真实页面帧：`lofter.com` 各页 + `lofter.lf127.net/lofter-admin/*`；
  2. 编辑器正文帧是 UEditor 的 `about:blank`（继承父帧源、**自己没有 URL**）。`content.js` 一旦注入进去，`location.href` 不含 `lf127.net`，会落进评论区 iframe 分支、再叠一层 `body{filter:invert}`，与父帧 `#main` 的反色相互抵消——表现为编辑器白底黑字。所以 `about:` 开头的帧必须**立即退出**：编辑器暗色归父帧 `applyLongpostEditorDark`，计数归 `wc-frame.js`；
  3. 桥接脚本 `wc-frame.js` 只在子帧跑（`window.top !== window`），只上报三个整数、不传正文，主帧用 `e.source === iframe.contentWindow` 校验来源。

## 3. 双渲染管线（核心）

LOFTER 同时存在两代页面，暗色实现方式**完全不同**：

| | 旧版页面 | 新版 React 页面 |
|---|---|---|
| 根容器 | `#main` | `#application.lofter-root-container` |
| 暗色手段 | 对 `#main` 施加 `filter: invert(100%) hue-rotate(180deg)` | 直接绘制深色背景与浅色文字 |
| 写色规则 | 必须写**预反色值**（该值经滤镜后才是目标色） | 直接写**最终色** |
| 图片处理 | 图片被反色 → 需要二次反色还原 | 无此问题 |

判定一个元素属于哪条管线，用「是否位于 `#main` 内」：

```js
const inMain = !!el.closest("#main");
// iframe 内的元素用 iframe.closest("#main") 判断宿主管线，而不是 iframe 自己的文档树
const hostInMain = !!iframe.closest("#main");
```

### 预反色计算

`computeDarkAccent(color)` 预先把颜色做 `invert` + `hue-rotate(180deg)` 的数学变换，使得它在滤镜区域内渲染后呈现出期望的终色。主题色在两条管线中必须走不同路径：

```js
const A = isDarkMode() && inMain ? computeDarkAccent(settings.theme.accent) : settings.theme.accent;
```

### 铁律

1. **写色前先确认元素是否在反色区内**。写错一侧的结果通常是「颜色被翻转成诡异色相」或「黑字变白底」。
2. **非反色区域一律写原始色**，不要做预反色，否则同样错位。
3. **iframe 要单独判定宿主管线**：编辑器（`lf127.net`）与评论区 iframe 的处理逻辑可能完全不同，按 `iframe.src` 分支处理。注意编辑器正文帧可能是 `about:blank`（**没有 src**），这类帧既不走 `lf127.net` 分支、也不能走评论区分支，应直接退出（见第 2 节"iframe 注入范围的三条规矩"）。

## 4. 稳定锚点策略

LOFTER 构建产物使用混淆哈希类名（如 `mYE4Q6nEKlrZElDM0nX3WQ==`、`z6HqZ2igTyT5UtMdSV1VvA==`），样式表版本更迭即失效。选择器优先级如下：

1. **语义 id / 语义类名** —— 如 `#main`、`.layerContainer`、`li.ptag`、`body.p-body7`，最稳定，优先使用
2. **结构性伪类** —— `:has()` 表达「含某结构的容器」，不依赖类名，如 `.g-bdc:has(.m-glist)`
3. **标签选择器** —— 语义实在缺失时的兜底
4. **通配哈希类名** —— 只在无其他锚点时使用，且必须部分匹配

### 哈希类名的正确用法

混淆哈希的**前缀部分通常稳定**，可用部分匹配：

```css
/* 好：前缀匹配，尾部哈希变化也能命中 */
[class*="GKRM8Z3DDLSN8H1UORgzkA"]

/* 差：完整匹配，加个字符就失效 */
[class="GKRM8Z3DDLSN8H1UORgzkA=="]
```

### 切勿硬编码随机数字

部分页面容器类名形如 `style-14_3461-page-web`，其中数字**每次页面加载都会随机轮换**（实测同一页面先后出现 `1965`、`3461`、`248`、`7758`、`5405` 等）。任何门禁、选择器都不可写死数字，一律通配：

```js
// 好
app.querySelector('[class*="-page-web"]');

// 差：匹配不到就直接 return，整个页面的适配全部失效
app.querySelector('[class*="style-14_5731-page-web"]');
```

> 这类 bug 的隐蔽之处在于：函数静默返回，页面上表现为「什么都没发生」，很容易被误判为选择器写错而反复修改无关规则。

## 5. 与 React 的对抗

### 5.1 内联样式会被冲掉

React 在每次 commit 时可能重写元素的 `style` 属性。对这类元素做一次性的内联赋值，会在下一次渲染时被抹掉。

**解法：属性观察器看守**

```js
const guard = new MutationObserver(applyWant);
guard.observe(el, { attributes: true, attributeFilter: ["style"] });
```

注意两点：

- **收敛性**：写回前先比较当前值，值相同则不写，否则「写入 → 触发 mutation → 再写入」会死循环。
- **勿捕获过期闭包**：回调不要直接读取挂载时捕获的 `isDark` 变量——用户在面板切换深浅色后，旧闭包仍按旧模式写回，表现为「浅色模式下却是暗色样式」。期望值应存于模块级共享变量，回调每次读取最新状态。

### 5.2 特异性战争

站点规则常常与我们的规则同优先级，此时级联后序获胜。策略：

- **提高选择器特异性**：叠加语义锚点（如 `body > .box`（1,1,0）→ 我们的 `#application ... [class*="x"] ...`（1,6,2））
- **`!important` 用在对的位置**：`!important` 只在同一优先级层次内比较，双方都带 `!important` 时仍然比特异性
- **inline `!important` 只能由 JS 内联覆盖**：CSS 规则无法压过 `element.style` 上的 `!important`，此时改用 `el.style.setProperty(prop, val, "important")`
- **误伤检查**：抬高特异性前先确认规则不会命中相邻页面（例如为搜索页写的 `body > .box` 透明化，可能误伤个人主页的同名容器）。必要时用 `:not(.postwrapper):not(.wid700)` 一类排除条件收窄。

### 5.3 选择器验证顺序

1. 先用控制台确认元素真实类名（DevTools 里的显示可能被截断或误读）
2. 确认命中的是**可见容器**而非同名包装层
3. 再动手写规则

## 6. 容错、调度与幂等

- **`lcSafe(fn)`**：所有页面补丁函数统一包一层 try/catch。单个函数抛异常不应中断整批补丁——否则一个 `ReferenceError` 会静默带走它之后的所有逻辑（这个坑真实发生过：一个变量作用域错误导致后续暗色文字提亮整段失效）。
- **观察器 + `requestAnimationFrame`**：以 `childList` 监听 DOM 变化，SPA 路由切换后重新应用补丁。
- **幂等**：所有写入前比较现有值；所有 DOM 处理（文本提亮、标题注入、包裹层构建）用 `data-lc-*` 属性或标记类做去重，避免重复处理。
- **SPA 重渲染**：路由切换后节点可能被整体替换，观察器需要在新节点出现时重新绑定（含看守观察器的换绑）。

## 7. 调试方法论

改 CSS 之前先取证，能省掉大量试错：

**第一步：控制台探针**

一次取清四类信息：

```js
const el = document.querySelector("选择器");
if (!el) console.log("未命中");
const cs = getComputedStyle(el);
const r = el.getBoundingClientRect();
console.log("类名:", JSON.stringify(el.className));
console.log("计算色:", cs.color, cs.backgroundColor, "| 内联:", el.style.background || "(空)");
console.log("定位:", cs.position, "| 坐标:", Math.round(r.left) + "," + Math.round(r.top), Math.round(r.width) + "x" + Math.round(r.height));
// 父链背景，用于判断该写在哪一层
let n = el.parentElement, i = 0;
while (n && i < 6) { console.log(i++, n.tagName, n.className.slice(0, 30), getComputedStyle(n).backgroundColor); n = n.parentElement; }
```

**第二步：按症状读证据**

| 症状 | 通常原因 |
|---|---|
| 元素"消失" | 绝对定位失去锚点（父级 `position: relative` 被覆盖），坐标飞到 0,0 被其他元素盖住 |
| 规则写了没效果 | 选择器未命中 / 被同优先级后序规则压掉 / inline `!important` 挡着 / 命中了错误元素 |
| 效果时有时无 | React 重写属性；或门禁函数静默 return |
| 整个页面的适配全失效 | 入口门禁选择器失效（常为硬编码随机数字） |
| 编辑了文件但没生效 | 扩展未重新加载；或编辑未真正落盘（见下） |

**第三步：改动后复核**

- 每次修改后 grep 目标字符串确认真的写入了文件（编辑"幽灵失败"时有发生）
- `node --check <file>` 校验语法
- 样式改动以最小范围提交，一次只改一类问题，便于回退

### 一个典型案例

批量管理页的月份标签"消失"，根因是 CSS 里残留了一条**悬空的声明**（不在任何规则块内的 `background: ...;`）。CSS 解析器的错误恢复把它与其后的定位规则一并丢弃，导致 `position: relative` 锚点消失，绝对定位的标签飞到页面左上角。教训：样式表里出现无法解释的异常时，检查是否有语法残骸破坏了后续规则。

## 8. 新增页面适配 Checklist

1. 确认页面属于哪条管线（是否在 `#main` 内）
2. 用探针取清语义锚点、计算色、内联值、父链背景
3. 找到语义 id 或结构锚点，避免依赖随机哈希
4. 在 `content.js` 的对应分区内添加规则，沿用 `/* ===== 页面名 ===== */` 注释
5. 确认没有误伤相邻页面（尤其是通用容器类名）
6. `node --check` 校验，grep 复核落盘
7. 在浏览器中实测浅色与暗色两种模式，含 SPA 路由往返

## 9. 已知约束

- **仅支持网页版**：`www.lofter.com` 及子域，不含 APP 与客户端
- **站点更新即可能失效**：哈希类名与随机数字是站点构建产物，无法根治，只能靠稳定锚点降低失效概率
- **字体需用户自备**：不打包字体文件，用户自行安装到系统后在面板选择或手输字体名（详见 `docs/install.md`）；字体名做多候选回退，未安装则回落系统默认字体
- **对比度**：暗色模式下若用户使用花哨的背景图，可读性依赖「内容透明度」与「卡片亮度」两项设置配合
