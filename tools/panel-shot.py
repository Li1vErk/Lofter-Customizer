#!/usr/bin/env python3
"""把设置面板（popup.html）在扩展环境之外渲染成 PNG，用于 README 演示图与设计走查。

为什么需要它：popup.html 是扩展页面，直接 file:// 打开时 popup.js 会因
`chrome.storage` 不存在而中断，面板会停在"空值"状态（版本号、字体预置为空）。
本工具在 defaults.js 之前注入一个 chrome 桩 + 一份演示配置，再截图，
所以出图就是真实填充后的面板外观。

用法：
    python tools/panel-shot.py

输出：
    assets/screenshots/panel-light.png   显示栏 · 浅色
    assets/screenshots/panel-dark.png    功能栏 · 暗色跟随

依赖：无第三方库；只要求本机有 Edge 或 Chrome。
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POPUP = os.path.join(ROOT, "popup.html")
MANIFEST = os.path.join(ROOT, "manifest.json")
OUT_DIR = os.path.join(ROOT, "assets", "screenshots")
TMP_NAME = "tmp-panel-shot.html"  # 命中 .gitignore 的 tmp-* 规则

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

W, H = 340, 600  # 与 content.js 的 PANEL_W / content.js PANEL_H 对齐
SCALE = 2

# 演示用配置：让面板里的控件都有真实取值（否则截图里全是空控件）
DEMO = {
    "enabled": True,
    "decorationsVisible": True,
    "shortcutsEnabled": True,
    "background": {
        "mode": "gradient",
        "color": "#e8e8e8",
        "gradient": {"from": "#a1c4fd", "to": "#c2e9fb", "angle": 135},
        "pattern": {"type": "grid", "fg": "#dfe6ee", "bg": "#ffffff", "size": 26},
        "image": {"dataUrl": "", "blur": 4},
        "contentAlpha": 100,
    },
    "decorations": [],
    "theme": {"accent": "#7c80d2", "text": ""},
    "gtotop": {"imageDataUrl": "", "imageSize": 100},
    "font": {"preset": "lxgw-wenkai", "family": "LXGW WenKai, 霞鹜文楷", "scale": 105},
    "card": {
        "enabled": True,
        "radius": 16,
        "gap": 12,
        "shadow": True,
        "animation": "up",
        "stagger": True,
        "staggerDelay": 80,
        "duration": 500,
    },
    "navbar": {"transparent": True, "blur": True},
    "searchPlaceholder": "搜索用户、标签",
    "tidy": {"hideAll": True, "hideHoverCard": False, "injectTitles": True},
    "darkMode": {"mode": "off", "brightness": 90},
    "tools": {"wordCount": True},
    "panel": {"fabPos": None},
}

STUB = """
<script>
window.__lcDemo = %s;
window.chrome = {
  storage: {
    local: {
      get: (k, cb) => cb({ lc_settings_v1: window.__lcDemo }),
      set: () => {},
      remove: () => {},
    },
    onChanged: { addListener: () => {} },
  },
  runtime: { getManifest: () => ({ version: %s }) },
  commands: { getAll: (cb) => cb([]) },
  tabs: { query: (q, cb) => cb([]), sendMessage: () => {} },
};
</script>
"""

AFTER = """
<script>
(function () {
  var p = new URLSearchParams(location.search);
  var tab = p.get("tab") || "bg";
  var btn = document.querySelector('.tabs button[data-tab="' + tab + '"]');
  if (btn) btn.click();
})();
</script>
"""

STYLE = """
<style id="lc-shot-style">
  /* 无头浏览器有 ~492px 的最小窗口宽度（--window-size 压不下去），
     所以把面板钉死在设计宽度 340，截完再从原图左上角裁出 340x600。
     高度对齐 content.js 的 PANEL_H=600，而不是工具栏弹窗的 560。 */
  html, body {
    width: 340px !important;
    min-width: 340px !important;
    max-width: 340px !important;
    margin: 0 !important;
    overflow-x: hidden !important;
  }
  html.lc-standalone { height: 600px !important; }
</style>
"""


def find_browser():
    for b in BROWSERS:
        if os.path.exists(b):
            return b
    sys.exit("找不到 Edge / Chrome，请手动指定浏览器路径")


def build_html(version):
    src = open(POPUP, encoding="utf-8").read()
    stub = STUB % (json.dumps(DEMO, ensure_ascii=False), json.dumps(version))
    tag = '<script src="defaults.js"></script>'
    if tag not in src:
        sys.exit("popup.html 里找不到 defaults.js 的 script 标签，脚本需要同步更新")
    src = src.replace(tag, stub + "  " + tag, 1)
    src = src.replace("</head>", STYLE + "</head>", 1)
    src = src.replace("</body>", AFTER + "</body>", 1)
    path = os.path.join(ROOT, TMP_NAME)
    open(path, "w", encoding="utf-8", newline="").write(src)
    return path


def crop_left(png, w_css, h_css, scale):
    """从原图左上角裁出面板区域（无头最小窗口宽度 > 340，右侧是空的）。"""
    from PIL import Image
    im = Image.open(png)
    box = (0, 0, w_css * scale, h_css * scale)
    if im.size[0] < box[2] or im.size[1] < box[3]:
        sys.exit("截图尺寸 %s 小于预期裁切框 %s" % (im.size, box))
    im.crop(box).save(png)


def shot(browser, url, out, workdir, transparent=False):
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=" + workdir,
        "--force-device-scale-factor=%d" % SCALE,
        "--window-size=%d,%d" % (W, H),
        "--virtual-time-budget=3000",
    ]
    if transparent:
        cmd.append("--default-background-color=00000000")
    cmd += ["--screenshot=" + out, url]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if not os.path.exists(out):
        print(r.stdout, r.stderr)
        sys.exit("截图失败：" + out)


def main():
    version = json.load(open(MANIFEST, encoding="utf-8"))["version"]
    browser = find_browser()
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp_html = build_html(version)
    workdir = tempfile.mkdtemp(prefix="lc-panel-shot-")
    base = "file:///" + tmp_html.replace("\\", "/")
    try:
        light = os.path.join(OUT_DIR, "panel-light.png")
        dark = os.path.join(OUT_DIR, "panel-dark.png")
        shot(browser, base + "?tab=bg", light, workdir)
        crop_left(light, W, H, SCALE)
        print("已生成", light)
        # 暗色版：把演示配置的深色模式改成「手动开启」，面板会跟着变暗
        DEMO["darkMode"]["mode"] = "manual"
        tmp_html = build_html(version)
        shot(browser, "file:///" + tmp_html.replace("\\", "/") + "?tab=func", dark, workdir)
        crop_left(dark, W, H, SCALE)
        print("已生成", dark)
    finally:
        if os.path.exists(tmp_html):
            os.remove(tmp_html)
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
