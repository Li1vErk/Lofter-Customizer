# -*- coding: utf-8 -*-
"""字数角标落位检查（真实布局引擎）

jsdom 没有排版，验证不了「角标在音乐图标视觉左侧」。本脚本用无头 Edge/Chrome
渲染一个与长文章写作页顶栏同构的 mock（含 .m-hd-longpost .right + #btn-music，
id/class 抄自 2026-09-18 线上 DOM，并保留折叠态 #menu-music 白噪音菜单陷阱），
真实加载 defaults.js / content.js，再量测角标与音乐按钮的矩形，判定落位。

覆盖两种顶栏写法：
  row          —— DOM 序与视觉序一致（音乐按钮是 .right 第一个子元素）
  row-reverse  —— DOM 序与视觉序相反（音乐按钮是 .right 最后一个子元素，
                  实测线上是这一种，旧代码因此把角标塞到了顶栏最右侧）

用法：python tools/wc-place-check.py
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP_NAME = "tmp-wc-place.html"

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# 顶栏右栏的 DOM 写法（2026-09-18 从线上写作页 DOM 抄来的真实 id / class，
# 新版是 btn-* 前缀；btm-* 是另一版本）。视觉顺序均为：
# 音乐 / 手机预览 / 电脑预览 / 发布 / 下拉箭头。
NODES = {
    "music": '<a class="btn-icon btn-music" id="btn-music"></a>',
    "phone": '<a class="btn-icon btn-preview-mobile" id="btn-preview-mobile"></a>',
    "pc": '<a class="btn-icon btn-preview-pc" id="btn-preview-pc"></a>',
    "publish": '<a class="btn-publish" id="btn-publish">发 布</a>',
    "arrow": '<a class="btn-arrow btn-arrow-down" id="btn-arrow-down"></a>',
}
# 新版 DOM 的陷阱：#menu-music 不再是按钮，而是藏在 header 下的白噪音
# 下拉菜单，折叠态实测 161x1px（线上 rect 637,69,161,1）。旧判定
# 「height > 0 即可见」会把它错当锚点，角标随之掉出顶栏——必须挡掉。
TRAP = ('<div class="u-select-menu f-trans200" id="menu-music">'
        '<ul class="menu"><li class="item">雷雨</li></ul></div>')
ORDER_ROW = ["music", "phone", "pc", "publish", "arrow"]
ORDER_REV = list(reversed(ORDER_ROW))

PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body {{ margin: 0; background: #333; font: 14px/1 -apple-system, "Microsoft YaHei", sans-serif; }}
  .m-hd-longpost {{ display: flex; align-items: center; height: 62px; padding: 0 16px;
                    background: #2b2b33; color: #ddd; position: relative; }}
  .m-hd-longpost .left {{ flex: 1; }}
  .m-hd-longpost .right {{ {flex} }}
  .m-hd-longpost .right a {{ color: #ddd; text-decoration: none; font-size: 16px; }}
  /* 线上实测：.right 是 position:absolute 的块容器，图标 a 全靠 float:left 横排 */
  .m-hd-longpost .right a.btn-icon {{ float: left; display: block; width: 26px; height: 26px;
                                      background: rgba(255,255,255,.2); }}
  .m-hd-longpost .right .btn-publish {{ float: left; background: #c9b6e4; color: #3b2a52;
                                        padding: 8px 22px; border-radius: 8px; font-size: 14px; }}
  /* 线上折叠态白噪音菜单：绝对定位在 header 下缘、高 1px（rect 637,69,161,1） */
  .m-hd-longpost #menu-music {{ position: absolute; top: 66px; left: 637px;
                                width: 161px; height: 1px; overflow: hidden; }}
  /* 线上 .right 高 60px 而图标顶在 y=16：图标自带 ~17px 顶部偏移（.right
     rect top=-1、#btn-music top=16）。float 顶对齐下角标不补偿就会贴顶。 */
  .m-hd-longpost .right.abs a.btn-icon,
  .m-hd-longpost .right.abs .btn-publish {{ margin-top: 17px; }}
  .editorWrap {{ margin: 20px; height: 160px; background: rgba(255,255,255,.45); }}
  iframe {{ width: 100%; height: 120px; border: 0; }}
</style>
<script>
  /* chrome 桩：content.js 需要的最小面 */
  window.chrome = {{
    storage: {{
      local: {{
        get: function (k, cb) {{ cb({{ lc_settings_v1: {{ enabled: true, darkMode: {{ mode: "off" }},
          tools: {{ wordCount: true }}, panel: {{ fabPos: null }} }} }}); }},
        set: function () {{}}
      }},
      onChanged: {{ addListener: function () {{}} }}
    }},
    runtime: {{ getManifest: function () {{ return {{ version: "1.1.2" }}; }},
               getURL: function (p) {{ return p; }}, lastError: null,
               onMessage: {{ addListener: function () {{}} }} }},
    commands: {{ getAll: function (cb) {{ cb([]); }}, onCommand: {{ addListener: function () {{}} }} }},
    tabs: {{ query: function (q, cb) {{ cb([]); }}, sendMessage: function () {{}},
            onUpdated: {{ addListener: function () {{}} }} }},
    i18n: {{ getMessage: function (k) {{ return k; }} }}
  }};
</script>
</head>
<body id="longpost-publish-page">
  <div class="m-hd-longpost">
    <div class="left"><a class="logo logo-s" id="main-logo"></a> 写文章 已实时保存</div>
    <div class="right{rightcls}">{nodes}</div>
    {trap}
  </div>
  <div class="editorWrap">
    <label class="textIntroLabel">正文</label>
    <div class="edui-editor-iframeholder"><iframe id="baidu_editor_0"></iframe></div>
  </div>
<script src="defaults.js"></script>
<script src="content.js"></script>
<script>
  /* 模拟编辑器已有内容 + 量测落位 */
  window.addEventListener("load", function () {{
    var f = document.getElementById("baidu_editor_0");
    try {{ f.contentDocument.body.textContent = "测试内容 hello"; }} catch (e) {{}}
    setTimeout(function () {{
      var el = document.getElementById("lc-word-count");
      var music = document.getElementById("btn-music");
      var out = "WCCHECK";
      if (!el || !music) {{
        out += "|missing el=" + !!el + " music=" + !!music;
      }} else {{
        var r = el.getBoundingClientRect(), m = music.getBoundingClientRect();
        var bc = (r.top + r.bottom) / 2, mc = (m.top + m.bottom) / 2;
        out += "|mode=" + el.getAttribute("data-mode") +
               "|badge.left=" + Math.round(r.left) + "|badge.right=" + Math.round(r.right) +
               "|music.left=" + Math.round(m.left) + "|music.right=" + Math.round(m.right) +
               "|verdict=" + (r.right <= m.left + 1 ? "LEFT_OK" : "WRONG_SIDE") +
               "|vert=" + (Math.abs(bc - mc) <= 3 ? "OK" : "OFF=" + Math.round(bc - mc)) +
               "|text=" + el.textContent;
      }}
      var d = document.createElement("div");
      d.textContent = out;
      document.body.appendChild(d);
    }}, 1800); /* 留够兜底轮询（1200ms）一拍的更新时间 */
  }});
</script>
</body></html>"""


def find_browser():
    for p in BROWSERS:
        if os.path.exists(p):
            return p
    sys.exit("找不到 Edge/Chrome，改一下 BROWSERS 列表即可")


def run_case(browser, layout, flex, order, rightcls=""):
    src = PAGE.format(flex=flex, nodes="".join(NODES[k] for k in order),
                      trap=TRAP, rightcls=rightcls)
    path = os.path.join(ROOT, TMP_NAME)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(src)
    workdir = tempfile.mkdtemp()
    url = "file:///" + path.replace("\\", "/")
    r = subprocess.run(
        [
            browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--no-first-run", "--no-default-browser-check",
            "--user-data-dir=" + workdir,
            "--window-size=900,400", "--virtual-time-budget=3000",
            "--dump-dom", url,
        ],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    m = re.search(r"WCCHECK\|([^<]*)", r.stdout)
    shutil.rmtree(workdir, ignore_errors=True)
    if not m:
        print("  %-12s 量测失败（未拿到 WCCHECK 标记）" % layout)
        return False
    info = dict(kv.split("=", 1) for kv in m.group(1).split("|") if "=" in kv)
    ok = info.get("verdict") == "LEFT_OK" and info.get("vert") == "OK"
    print(
        "  %-12s %s  角标[%s,%s]  音乐按钮[%s,%s]  模式=%s  垂直=%s  %s" % (
            layout,
            "OK  " if ok else "FAIL",
            info.get("badge.left"), info.get("badge.right"),
            info.get("music.left"), info.get("music.right"),
            info.get("mode"), info.get("vert"), info.get("text", ""),
        )
    )
    return ok


def main():
    browser = find_browser()
    print("用 %s 渲染 mock 顶栏并量测角标落位\n" % os.path.basename(browser))
    results = [
        run_case(browser, "row",
                 "display: flex; flex-direction: row; align-items: center; gap: 18px;",
                 ORDER_ROW),
        run_case(browser, "row-reverse",
                 "display: flex; flex-direction: row-reverse; align-items: center; gap: 18px;",
                 ORDER_REV),
        # 线上写作页实测：.right { float: left; width: 358px; margin: 17px 0 16px 17px; }
        run_case(browser, "float-left",
                 "float: left; width: 358px; height: 26px; margin: 17px 0 16px 17px;",
                 ORDER_ROW),
        # 2026-09-18 傍晚线上实测：.right { position:absolute; display:block;
        # width:382px; height:60px }，图标 a 全部 float:left 且自带 ~17px
        # 顶部偏移——角标不跟着 float + 不补偿 margin 就会贴到页面顶部
        run_case(browser, "float-items",
                 "display: block; position: absolute; width: 382px; height: 60px; top: -1px; right: 16px;",
                 ORDER_ROW, rightcls=" abs"),
    ]
    tmp = os.path.join(ROOT, TMP_NAME)
    if os.path.exists(tmp):
        os.remove(tmp)
    print("\n结论：%s" % ("两种顶栏写法角标都落在音乐按钮左侧 ✓" if all(results) else "存在落位错误 ✗"))
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
