---
name: 样式失效反馈
about: 某个页面/元素的美化效果失效、错位或颜色异常
title: "[失效] "
labels: ["selector-broken", "needs-triage"]
---

## 失效页面

- 页面 URL：
- 页面名称（如：创作者中心、批量管理日志页）：
- 页面属于：旧版页面 / 新版 React 页面 / 不确定

## 问题描述

<!-- 期望效果 vs 实际效果，一句话说明 -->

## 复现步骤

1.
2.

## 必要信息（缺一不可）

**1. 截图**

<!-- 拖入图片，建议同时给「正常页面」和「出错页面」两张；暗色/浅色模式问题请注明当前模式 -->

**2. 控制台输出**

在失效页面按 F12 → Console，粘贴并运行下面的探针，把输出贴回来：

```js
(function () {
  console.log("1 URL:", location.href);
  console.log("2 宿主管线: 在 #main 内 =", !!document.querySelector("#main"),
    "| 新版根容器 =", !!document.querySelector("#application.lofter-root-container"));
  console.log("3 我们的样式表存在:", !!document.getElementById("lc-style"));
  const h = document.querySelector("header, .m-filetop, [class*='page-web']");
  if (h) console.log("4 页面根容器类名:", JSON.stringify(h.className));
})();
```

如果问题与具体元素有关（某处颜色不对、某个块没暗色），再补一段针对该元素的信息：

```js
// 把下面的选择器替换成你在 DevTools 中选中该元素后得到的选择器
const el = document.querySelector("把这里换成你的选择器");
if (!el) console.log("未命中：选择器不对");
const cs = getComputedStyle(el);
const r = el.getBoundingClientRect();
console.log("类名:", JSON.stringify(el.className));
console.log("计算色:", cs.color, "| 背景:", cs.backgroundColor);
console.log("内联:", el.getAttribute("style"));
console.log("定位:", cs.position, "| 坐标:", Math.round(r.left) + "," + Math.round(r.top), Math.round(r.width) + "x" + Math.round(r.height));
```

**3. 环境**

- 浏览器与版本：
- 扩展版本（面板底部或 `manifest.json`）：
- 暗色模式档位：关闭 / 手动 / 跟随系统

## 补充说明

<!-- 是否为新版页面适配缺失（即该页面从未被适配过）？
     其他可能相关的线索（是否刚切换过主题、是否刷新后恢复等） -->
