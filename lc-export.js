/* ============================================================
 * lc-export.js — #10 文章导出（正式版）
 * ============================================================
 * 结构（与 docs/todo-priorities.md「#10 方案定稿」一致）：
 *   1. 转换器：自 tools/demo-export.js 收编（真机已验收 29/29），
 *      支持经典 /post（SSR 老模板）与 /lpost（长文章）两形态。
 *   2. postmanage 列表解析：li.ptag 自带 postId / permalink / 标题 /
 *      选中态；真实年份从月份分组 ul#YYYY_M_list 取（demo 年份近似的
 *      已知限制在此正式修正）。
 *   3. 批量队列：跨域详情页 fetch 走 background 中继（host_permissions
 *      已覆盖 *.lofter.com，content script 直 fetch 会撞 CORS），
 *      每篇间隔 EXPORT_DELAY_MS，进度条可取消。
 *   4. UI：批量管理页顶栏「全选（已加载）」+「导出」（克隆「删除」按钮
 *      的类名融入工具栏）；详情页单篇入口（.link / .copyright 旁小链接）。
 *   5. 配置：export.enabled 总开关（默认关）+ scope.manage/detail +
 *      scope.merged；popup.js LC_MODULES 已登记（导入白名单防丢）。
 * 明确不做（定稿）：他人文章、草稿、图片转存、自动连页（DWR 翻页）。
 * ============================================================ */
(function (global) {
  'use strict';

  var EXPORT_DELAY_MS = 400;   // 逐篇间隔：同一登录态连抓详情页的礼貌限速
  var PROGRESS_Z = 2147483647;

  /* ---------- 工具 ---------- */

  function absUrl(u, base) {
    if (!u) return '';
    u = u.trim();
    if (u.indexOf('//') === 0) return 'https:' + u;
    try { return new URL(u, base).href; } catch (e) { return u; }
  }

  function sanitizeFilename(name) {
    return (name || 'untitled')
      .replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'untitled';
  }

  function squash(s) {
    return (s || '').replace(/[\t ]+/g, ' ').trim();
  }

  function pad2(n) {
    return ('0' + n).slice(-2);
  }

  /* ---------- 行内级：p/引用 内部的文本、链接、图片 ---------- */

  function inlineMd(node, base) {
    var out = '';
    for (var n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        out += n.nodeValue;
      } else if (n.nodeType === 1) {
        var tag = n.tagName.toLowerCase();
        if (tag === 'br') {
          out += '\n';
        } else if (tag === 'img') {
          var src = n.getAttribute('src') || n.getAttribute('smallsrc') || '';
          if (src) out += '\n\n![](' + absUrl(src, base) + ')\n\n';
        } else if (tag === 'a') {
          var txt = squash(n.textContent);
          var href = absUrl(n.getAttribute('href') || '', base);
          if (href && txt) out += '[' + txt + '](' + href + ')';
          else if (txt) out += txt;
        } else {
          out += inlineMd(n, base);
        }
      }
    }
    return out;
  }

  /* ---------- 块级：正文容器 → Markdown 块数组 ---------- */

  function quoteWrap(quote, s) {
    if (!quote) return s;
    return s.split('\n').map(function (l) { return '> ' + l; }).join('\n');
  }

  function blocksToMd(container, skipEl, quote, base) {
    var blocks = [];
    for (var n = container.firstChild; n; n = n.nextSibling) {
      if (n === skipEl) continue;
      if (n.nodeType === 3) {
        var t = squash(n.nodeValue);
        if (t) blocks.push(quoteWrap(quote, t));
        continue;
      }
      if (n.nodeType !== 1) continue;
      var tag = n.tagName.toLowerCase();
      if (tag === 'br') continue;
      if (tag === 'blockquote') {
        var inner = blocksToMd(n, null, true, base);
        if (inner) blocks.push(inner);
      } else if (/^h[1-6]$/.test(tag)) {
        var level = +tag.charAt(1);
        var htxt = squash(n.textContent);
        if (htxt) blocks.push(quoteWrap(quote, '######'.slice(0, level) + ' ' + htxt));
      } else if (tag === 'img') {
        var src = n.getAttribute('src') || n.getAttribute('smallsrc') || '';
        if (src) blocks.push(quoteWrap(quote, '![](' + absUrl(src, base) + ')'));
      } else {
        /* p / div / span / 其他未识别块：按行内内容处理 */
        var md = inlineMd(n, base)
          .replace(/[ \t]+/g, ' ')
          .replace(/ *\n */g, '\n')
          .replace(/^\n+/, '')
          .replace(/\n+$/, '')
          .trim();
        if (md) blocks.push(quoteWrap(quote, md));
      }
    }
    return blocks.join('\n\n');
  }

  /* ---------- 形态一：经典 /post 详情页（老模板，SSR） ---------- */

  function extractClassic(doc) {
    var article = doc.querySelector('.postwrapper .block.article');
    if (!article) return null;
    var textEl = article.querySelector('.content .text');
    if (!textEl) return null;

    var h2 = textEl.querySelector('h2');
    var title = h2 ? squash(h2.textContent) : '';
    var a = h2 && h2.querySelector('a[href]');
    var permalink = a ? a.href : '';

    var dayEl = article.querySelector('.side .day');
    var monthEl = article.querySelector('.side .month');
    var day = dayEl ? dayEl.textContent.trim() : '';
    var month = monthEl ? monthEl.textContent.trim() : '';
    /* 经典页 DOM 无年份 → dateISO 留空；批量路径由 postmanage 月份分组补真实年份，
       单篇路径由 buildMarkdown 的 overrides 决定是否当年近似 */
    var dateISO = '';
    if (month && day) {
      var mm = parseInt(month, 10), dd = parseInt(day, 10);
      if (mm > 0 && mm <= 12 && dd > 0 && dd <= 31) {
        dateISO = '----' + pad2(mm) + '-' + pad2(dd);   // 年份占位，由调用方填充
      }
    }

    var source = null, license = null;
    var links = article.querySelectorAll('.link a');
    for (var i = 0; i < links.length; i++) {
      var el = links[i];
      var txt = squash(el.textContent);
      var m = txt.match(/^转载自[:：]?\s*(.*)$/);
      if (m && !source) source = { name: m[1] || txt, url: el.href };
      if (!license && /(^|\s)cc_\d/.test(el.className || '')) {
        license = el.getAttribute('title') || txt || null;
      }
    }
    if (!source) {
      var rf = article.querySelector('p[reblogfrom] a[href]');
      if (rf) source = { name: squash(rf.textContent).replace(/[:：]\s*$/, ''), url: rf.href };
    }

    return {
      meta: {
        kind: 'post', title: title, permalink: permalink,
        dateISO: dateISO, source: source, license: license
      },
      md: blocksToMd(textEl, h2, false, doc)
    };
  }

  /* ---------- 形态二：长文章 /lpost 页 ---------- */

  function extractLpost(doc) {
    var cnt = doc.querySelector('#m-cnt.m-cnt') || doc.querySelector('.m-cnt');
    if (!cnt) return null;
    var body = cnt.querySelector('.long-text');
    if (!body) return null;

    var titleEl = cnt.querySelector('#title') || cnt.querySelector('.title');
    var title = titleEl ? squash(titleEl.textContent) : '';
    var timeEl = cnt.querySelector('.info .time');
    var descEl = cnt.querySelector('.nav-desc');
    /* 封面图：真机实证为 .m-cnt 之前的 <img id="banner" data-imgurl>（SSR 直出）；
       og:image 仅作兜底。 */
    var banner = doc.querySelector('#banner[data-imgurl], #banner[src]');
    var cover = banner
      ? absUrl(banner.getAttribute('data-imgurl') || banner.getAttribute('src') || '', doc)
      : '';
    if (!cover) {
      var coverEl = doc.querySelector('meta[property="og:image"], meta[property="og:image:secure_url"]');
      cover = coverEl ? absUrl(coverEl.getAttribute('content') || '', doc) : '';
    }
    var tags = [];
    var tagAs = cnt.querySelectorAll('#tag-wrapper a');
    for (var i = 0; i < tagAs.length; i++) {
      var tt = squash(tagAs[i].textContent);
      if (tt) tags.push(tt);
    }

    return {
      meta: {
        kind: 'lpost', title: title,
        permalink: '',
        dateISO: timeEl ? squash(timeEl.textContent) : '',
        subtitle: descEl ? squash(descEl.textContent) : '',
        cover: cover,
        tags: tags
      },
      md: blocksToMd(body, null, false, doc)
    };
  }

  /* ---------- 入口与输出 ---------- */

  function extractArticle(doc) {
    return extractClassic(doc) || extractLpost(doc);
  }

  function frontMatter(meta) {
    var L = ['---'];
    L.push('title: "' + (meta.title || '').replace(/"/g, '\\"') + '"');
    if (meta.dateISO) {
      L.push('date: ' + meta.dateISO + (meta.dateApproxYear ? ' # 年份近似：详情页 DOM 无年份' : ''));
    }
    if (meta.permalink) L.push('url: ' + meta.permalink);
    if (meta.subtitle) L.push('subtitle: "' + meta.subtitle.replace(/"/g, '\\"') + '"');
    if (meta.source) L.push('source: "' + (meta.source.name || '').replace(/"/g, '\\"') + ' (' + (meta.source.url || '') + ')"');
    if (meta.license) L.push('license: "' + meta.license.replace(/"/g, '\\"') + '"');
    if (meta.cover) L.push('cover: ' + meta.cover);
    if (meta.tags && meta.tags.length) L.push('tags: [' + meta.tags.join(', ') + ']');
    L.push('---');
    return L.join('\n');
  }

  /* buildMarkdown(doc, overrides)
   * overrides.permalink  — 批量路径从列表页卡片取到的绝对地址（DOMParser 文档无 location）
   * overrides.dateISO    — 批量路径的「年-月-日」（月份分组真实年份）；
   *                        单篇路径传 'auto' = 经典页用当年近似（front matter 注明）
   * 返回 { meta, markdown } 或 null（不支持的页面） */
  function buildMarkdown(doc, overrides) {
    var res = extractArticle(doc);
    if (!res) return null;
    var ov = overrides || {};
    if (ov.permalink) res.meta.permalink = ov.permalink;
    if (ov.dateISO === 'auto') {
      if (res.meta.dateISO) {
        res.meta.dateISO = new Date().getFullYear() + '-' + res.meta.dateISO.slice(4);
        res.meta.dateApproxYear = true;
      }
    } else if (ov.dateISO) {
      res.meta.dateISO = ov.dateISO;
      res.meta.dateApproxYear = false;
    }
    /* dateISO 若仍带年份占位（无年份来源），去掉 date 行而非输出 '----MM-DD' */
    if (res.meta.dateISO && res.meta.dateISO.indexOf('----') === 0) res.meta.dateISO = '';
    var fm = frontMatter(res.meta);
    var body = res.md;
    if (res.meta.cover) body = '![' + (res.meta.title || '封面') + '](' + res.meta.cover + ')\n\n' + body;
    return { meta: res.meta, markdown: fm + '\n\n' + body + '\n' };
  }

  function filenameOf(meta) {
    var date = meta.dateISO || '';
    var name = (date ? date + '-' : '') + (meta.title || 'untitled');
    return sanitizeFilename(name) + '.md';
  }

  /* ---------- postmanage 列表解析 ----------
   * 结构（真机实证，2026-09-27）：
   *   div.m-filecnt > h2 > em「9月」
   *                > ul.list#2026_8_list > li#<postId>.ptag.text[.selected]
   *                                          > a[href="/post/xxx"] > h3 标题
   *                                          > span.info > em「9月12日」
   * 年份在 ul id 里（YYYY_M_list），月日在 em 里——两者拼出真实 dateISO。 */

  function parseManageList(doc) {
    var out = [];
    var groups = doc.querySelectorAll('ul.list[id]');
    for (var g = 0; g < groups.length; g++) {
      var ul = groups[g];
      var m = /^(\d{4})_(\d{1,2})_list$/.exec(ul.id || '');
      if (!m) continue;
      var year = +m[1], month = +m[2];
      if (!(year > 2000 && year < 3000 && month >= 1 && month <= 12)) continue;
      var lis = ul.querySelectorAll('li.ptag');
      for (var i = 0; i < lis.length; i++) {
        var li = lis[i];
        var a = li.querySelector('a[href*="/post/"]');
        var h3 = li.querySelector('h3');
        var em = li.querySelector('.info em');
        var dateISO = '';
        if (em) {
          var dm = /(\d{1,2})月(\d{1,2})日/.exec(em.textContent || '');
          if (dm) dateISO = year + '-' + pad2(month) + '-' + pad2(+dm[2]);
        }
        out.push({
          id: li.id || '',
          selected: li.classList.contains('selected'),
          type: (li.getAttribute('class').match(/ptag\s+(\S+)/) || [])[1] || '',
          title: h3 ? squash(h3.textContent) : '',
          permalink: a ? absUrl(a.getAttribute('href'), 'https://www.lofter.com') : '',
          dateISO: dateISO,
          monthGroup: ul.id
        });
      }
    }
    return out;
  }

  /* ================= 浏览器侧（content script 主帧） ================= */

  function initBrowser() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    if (window !== window.top) return;   // 只在主帧跑（postmanage / 详情页都是顶帧）

    var settings = null;
    var manageBar = null;    // { selectBtn, exportBtn }
    var detailLinks = [];    // 注入的单篇入口
    var queueRunning = false;
    var queueCancel = false;

    function cfg() {
      return (settings && settings.export) || {};
    }
    function exportOn() {
      return !!(settings && settings.enabled !== false &&
        settings.export && settings.export.enabled === true);
    }
    function isDark() {
      var mode = settings && settings.darkMode && settings.darkMode.mode || 'off';
      if (mode === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches;
      return mode === 'manual';
    }
    function isDetailPage() {
      return !!(document.querySelector('.postwrapper .block.article') ||
                document.querySelector('#m-cnt.m-cnt .long-text'));
    }
    function onReady(fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
      } else {
        fn();
      }
    }
    function waitFor(fn, cb, tries) {
      var n = tries || 40;   // ~10s
      var t = setInterval(function () {
        var el = fn();
        if (el || n-- <= 0) { clearInterval(t); if (el) cb(el); }
      }, 250);
    }

    /* ---------- toast / 进度条（样式带 !important，防站点规则透明化） ---------- */

    function toast(msg, ms) {
      var old = document.querySelector('.lc-export-toast');
      if (old) old.remove();
      var d = document.createElement('div');
      d.className = 'lc-export-toast';
      d.style.cssText = 'position:fixed !important;left:50% !important;bottom:70px !important;' +
        'transform:translateX(-50%) !important;z-index:' + PROGRESS_Z + ' !important;' +
        'padding:8px 16px !important;border-radius:8px !important;font-size:13px !important;' +
        'background:#333 !important;color:#fff !important;box-shadow:0 4px 14px rgba(0,0,0,.3) !important;';
      d.textContent = msg;
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, ms || 4000);
    }

    function ensureProgress() {
      var old = document.querySelector('.lc-export-bar');
      if (old) old.remove();
      var dark = isDark();
      var bar = document.createElement('div');
      bar.className = 'lc-export-bar';
      bar.style.cssText = 'position:fixed !important;left:50% !important;bottom:24px !important;' +
        'transform:translateX(-50%) !important;z-index:' + PROGRESS_Z + ' !important;' +
        'display:flex !important;align-items:center !important;gap:10px !important;' +
        'padding:8px 14px !important;border-radius:10px !important;max-width:80vw !important;' +
        'background:' + (dark ? 'rgba(30,30,36,.95)' : 'rgba(255,255,255,.97)') + ' !important;' +
        'color:' + (dark ? '#eee' : '#333') + ' !important;' +
        'border:1px solid ' + (dark ? '#3a3a44' : '#d9d9e3') + ' !important;' +
        'box-shadow:0 6px 18px rgba(0,0,0,.25) !important;font-size:13px !important;';
      var txt = document.createElement('span');
      txt.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      var cancel = document.createElement('a');
      cancel.href = 'javascript:void(0)';
      cancel.textContent = '取消';
      cancel.style.cssText = 'color:#8ea1ff !important;cursor:pointer !important;flex-shrink:0 !important;';
      cancel.addEventListener('click', function () { queueCancel = true; });
      bar.appendChild(txt);
      bar.appendChild(cancel);
      document.body.appendChild(bar);
      return {
        set: function (s) { txt.textContent = s; },
        done: function (s, ok) {
          txt.textContent = s;
          txt.style.color = ok ? '#52c41a' : '#e5544b';
          cancel.remove();
          setTimeout(function () { bar.remove(); }, 5000);
        }
      };
    }

    /* ---------- 下载与抓取 ---------- */

    function downloadText(fname, text) {
      var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    /* content script 直 fetch 跨域详情页会撞 CORS（重定向到博客子域），
     * 走 background 中继：host_permissions 已覆盖 *.lofter.com */
    function fetchViaBg(url) {
      return new Promise(function (resolve, reject) {
        try {
          chrome.runtime.sendMessage({ action: 'lcExportFetch', url: url }, function (res) {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!res) return reject(new Error('后台无响应'));
            if (!res.ok) return reject(new Error('HTTP ' + res.status));
            resolve(res.text);
          });
        } catch (e) { reject(e); }
      });
    }

    /* ---------- 批量队列 ---------- */

    function startQueue(items) {
      if (queueRunning) { toast('已有导出任务在进行中'); return; }
      queueRunning = true; queueCancel = false;
      var merged = cfg().merged === true;
      var bar = ensureProgress();
      var seen = {};
      var okCount = 0, failCount = 0;
      var mergedParts = [];
      var mergedName = sanitizeFilename('lofter-export-' +
        new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')) + '.md';

      var chain = Promise.resolve();
      items.forEach(function (it, i) {
        chain = chain.then(function () {
          if (queueCancel) return;
          bar.set('导出中 ' + (i + 1) + '/' + items.length + '：' + (it.title || it.id));
          return fetchViaBg(it.permalink).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var out = buildMarkdown(doc, { permalink: it.permalink, dateISO: it.dateISO });
            if (!out) throw new Error('未识别的详情页结构');
            /* 图片类作品列表卡与详情页都可能无标题 → 文件名退化为 post-id */
            if (!out.meta.title) out.meta.title = it.title || ('post-' + it.id);
            var fname = filenameOf(out.meta);
            if (seen[fname]) fname = fname.replace(/\.md$/, '-' + it.id + '.md');
            seen[fname] = 1;
            if (merged) mergedParts.push(out.markdown);
            else downloadText(fname, out.markdown);
            okCount++;
          }).catch(function (e) {
            failCount++;
            console.warn('[lc-export] 失败：', it.title || it.id, e);
          }).then(function () {
            return new Promise(function (r) { setTimeout(r, EXPORT_DELAY_MS); });
          });
        });
      });

      chain.then(function () {
        queueRunning = false;
        if (queueCancel) {
          bar.done('已取消：完成 ' + okCount + ' 篇，剩余未导出', okCount > 0);
        } else {
          if (merged && okCount) {
            var head = '# LOFTER 文章导出\n\n- 导出时间：' + new Date().toLocaleString() +
              '\n- 共 ' + okCount + ' 篇\n\n各篇之间以 --- 分隔。\n\n';
            downloadText(mergedName, head + mergedParts.join('\n\n---\n\n'));
          }
          bar.done('导出完成：成功 ' + okCount + ' 篇' + (failCount ? '，失败 ' + failCount + ' 篇（详见控制台）' : ''), !failCount);
        }
        if (failCount) console.warn('[lc-export] 失败清单：', items.filter(function (it, i) { return i >= okCount && i < okCount + failCount; }));
      });
    }

    /* ---------- 批量管理页 UI ---------- */

    /* 博客子域发现（真机实证 2026-09-27）：管理页 URL 本身就带博客 id
     * （/postmanage/<blogId>），左上角 h1.w-bttl 的 /blog/<id> 链接可作兜底；
     * 页面 DOM 里没有任何博客子域链接，卡片相对链接拼 www 是 404。 */
    function findBlogHost() {
      var m = /^\/postmanage\/([A-Za-z0-9_-]+)/.exec(location.pathname);
      if (m) return 'https://' + m[1].toLowerCase() + '.lofter.com';
      var a = document.querySelector('h1.w-bttl a[href*="/blog/"]');
      var b = a && /\/blog\/([A-Za-z0-9_-]+)/.exec(a.getAttribute('href') || '');
      if (b) return 'https://' + b[1].toLowerCase() + '.lofter.com';
      return '';
    }

    function findToolbarAction(text) {
      var els = document.querySelectorAll('a, button');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        /* 站点按钮文字可能带装饰空格（真机：「删  除」），比对前压掉全部空白 */
        if (el.offsetParent && (el.textContent || '').replace(/\s+/g, '') === text &&
            !el.closest('.lc-export-bar, .lc-export-toast')) return el;
      }
      return null;
    }

    function makeToolbarAction(srcEl, text, onClick) {
      var el = document.createElement(srcEl.tagName || 'a');
      if (srcEl.className) el.className = srcEl.className;
      /* 剥掉克隆来源可能携带的禁用态类：注入时若无选中，「删除」带 w-tbtn-dis
         （color:#666 发暗——真机踩过 2026-09-27）；我们的禁用感用 opacity 表达 */
      el.className = el.className.replace(/\bw-tbtn-dis\b/g, '').replace(/\s+/g, ' ').trim();
      el.removeAttribute && el.removeAttribute('id');
      el.textContent = text;
      el.style.cursor = 'pointer';
      /* 站点按钮是固定宽度，长文案会换行溢出工具栏（真机踩过） */
      el.style.whiteSpace = 'nowrap';
      el.addEventListener('click', onClick);
      return el;
    }

    function refreshExportBtn() {
      if (!manageBar) return;
      var sel = document.querySelectorAll('li.ptag.selected');
      manageBar.exportBtn.style.opacity = sel.length ? '1' : '.45';
      manageBar.exportBtn.title = sel.length ? ('导出选中的 ' + sel.length + ' 篇') : '先点选文章（或用「全选」）';
    }

    function looksLikeManage() {
      /* 管理页判定：URL 特征 或 列表 DOM 特征（li.ptag 自带 /post/ 链接，真机实证）。
         不猜 body 类名。 */
      return /postmanage/i.test(location.href) ||
        !!document.querySelector('li.ptag a[href*="/post/"]');
    }

    function initManage() {
      /* 按钮落位（2026-09-27 二次定案）：工具栏最左——「导出、全选、取消选择、
         编辑授权、删除…」，作者拍板（顺手且离删除最远，误触删文风险最低）；
         样式整颗沿用原生 li/a。waitFor 兜住 DWR 异步渲染列表的时序 */
      waitFor(function () {
        var styleSrc = findToolbarAction('删除');
        var anchor = findToolbarAction('按标签查询') || styleSrc;
        return (styleSrc && anchor && looksLikeManage()) ? { styleSrc: styleSrc, anchor: anchor } : null;
      }, function (hit) {
        var del = hit.styleSrc, anchor = hit.anchor;
        if (manageBar) return;   // 已注入
        /* 全选为单向按钮：清空交给页面原生「取消选择」（同一行内，零冗余） */
        var selectBtn = makeToolbarAction(del, '全选', function () {
          var lis = document.querySelectorAll('li.ptag:not(.selected)');
          if (!lis.length) {
            toast('已全部选中，用页面「取消选择」可清空');
            return;
          }
          var usedNative = false;
          try {
            if (window.loft && loft.m && loft.m.g && typeof loft.m.g.selectItem === 'function') {
              lis.forEach(function (li) {
                loft.m.g.selectItem(/^\d+$/.test(li.id) ? +li.id : li.id, new Event('click'));
              });
              usedNative = true;
            }
          } catch (e) { usedNative = false; }
          if (!usedNative) lis.forEach(function (li) { li.classList.add('selected'); });
          refreshExportBtn();
        });
        var exportBtn = makeToolbarAction(del, '导出', function () {
          var bh = findBlogHost();
          var items = parseManageList(document).filter(function (it) {
            return it.selected && it.permalink;
          });
          /* permalink 重写到博客子域：www 上的 /post/ 路径是 404 */
          if (bh) {
            items.forEach(function (it) {
              it.permalink = bh + it.permalink.replace(/^https?:\/\/[^/]+/, '');
            });
          } else {
            console.warn('[lc-export] 未能在管理页找到博客子域链接，permalink 维持原样（可能 404）');
          }
          if (!items.length) {
            toast('先点选要导出的文章，或用「全选」');
            return;
          }
          startQueue(items);
        });
        /* 插入：原生按钮是 ul.tntlist 里的 li（.w-tbtn 是 display:block 定宽块，
           裸插 a 会竖着堆——真机踩过 2026-09-27）。包 li 并入同一列表，且 li 沿用
           原生 li 的类名——裸 li 的继承样式与原生不一致，按钮文字发暗（真机踩过）。
           落位：原生「取消选择」之前 → 导出、全选、取消选择、…（作者定案） */
        function rowInsert(btn, refLi, before) {
          var ul = (del.closest && del.closest('ul')) ||
                   (anchor.closest && anchor.closest('ul'));
          var li = document.createElement('li');
          if (refLi && refLi.className) li.className = refLi.className;
          li.appendChild(btn);
          if (ul) {
            if (refLi && refLi.parentElement === ul) {
              if (before) ul.insertBefore(li, refLi);
              else if (refLi.nextSibling) ul.insertBefore(li, refLi.nextSibling);
              else ul.appendChild(li);
            } else {
              ul.insertBefore(li, ul.firstChild);
            }
          } else if (anchor.parentElement) {
            anchor.parentElement.insertBefore(li, anchor);
          } else {
            document.body.appendChild(li);
          }
          return li;
        }
        var cancelBtn = findToolbarAction('取消选择');
        var cancelLi = cancelBtn && cancelBtn.closest ? cancelBtn.closest('li') : null;
        var li1 = rowInsert(exportBtn, cancelLi, true);   /* 导出在最左 */
        var li2 = rowInsert(selectBtn, li1, false);       /* 全选随后 */
        manageBar = { selectBtn: selectBtn, exportBtn: exportBtn, shells: [li1, li2] };
        /* 选择态变化由点击驱动（页面自身的选中逻辑挂在 click 上） */
        document.addEventListener('click', function () {
          setTimeout(refreshExportBtn, 0);
        }, true);
        refreshExportBtn();
      }, 120);   /* 30s：DWR 列表慢加载时仍能等到 */
    }

    /* ---------- 详情页单篇入口 ---------- */

    function exportSingle() {
      var out = buildMarkdown(document, { dateISO: 'auto' });
      if (!out) { toast('本页不是已支持的详情页形态'); return; }
      var fname = filenameOf(out.meta);
      downloadText(fname, out.markdown);
      toast('已导出：' + fname);
    }

    function makeDetailLink() {
      var a = document.createElement('a');
      a.className = 'lc-export-link';
      a.href = 'javascript:void(0)';
      a.textContent = '导出 .md';
      a.style.cursor = 'pointer';
      a.addEventListener('click', exportSingle);
      return a;
    }

    function initDetail() {
      /* 锚点理论上 SSR 首屏就在；waitFor 只兜极端时序 */
      waitFor(function () {
        return document.querySelector('.postwrapper .block.article .link, #m-cnt.m-cnt .post .copyright, #m-cnt.m-cnt .long-text');
      }, function (hit) {
        if (detailLinks.length) return;
        var linkBox = hit.closest ? hit.closest('.link') : null;
        if (linkBox) {
          var a1 = makeDetailLink();
          a1.style.marginLeft = '10px';
          linkBox.appendChild(a1);
          detailLinks.push(a1);
          return;
        }
        if (hit.classList && hit.classList.contains('copyright')) {
          var a2 = makeDetailLink();
          a2.style.marginLeft = '8px';
          hit.appendChild(a2);
          detailLinks.push(a2);
          return;
        }
        /* 兜底：两个正经锚点都没命中 → 固定位置小按钮 */
        if (!document.getElementById('lc-export-fab')) {
          var fab = document.createElement('a');
          fab.id = 'lc-export-fab';
          fab.href = 'javascript:void(0)';
          fab.textContent = '导出 .md';
          fab.style.cssText = 'position:fixed !important;right:16px !important;bottom:16px !important;' +
            'z-index:' + PROGRESS_Z + ' !important;padding:5px 12px !important;border-radius:16px !important;' +
            'background:#fff !important;color:#333 !important;border:1px solid #d9d9e3 !important;' +
            'box-shadow:0 4px 12px rgba(0,0,0,.18) !important;font-size:12px !important;cursor:pointer !important;';
          fab.addEventListener('click', exportSingle);
          document.body.appendChild(fab);
          detailLinks.push(fab);
        }
      }, 40);
    }

    /* ---------- 开关/卸载 ---------- */

    function teardownManage() {
      if (manageBar) {
        /* li 壳一起移除，避免关开关后留下空 li 占位 */
        (manageBar.shells || []).forEach(function (s) { s.remove(); });
        manageBar = null;
      }
    }
    function teardownDetail() {
      detailLinks.forEach(function (el) { el.remove(); });
      detailLinks = [];
    }

    function boot() {
      onReady(function () {
        var c = cfg();
        console.debug('[lc-export] boot', {
          on: exportOn(),
          scopeManage: c.scope && c.scope.manage,
          scopeDetail: c.scope && c.scope.detail,
          href: location.href
        });
        if (exportOn() && c.scope && c.scope.manage !== false) {
          initManage();
        } else {
          teardownManage();
        }
        if (exportOn() && isDetailPage() && c.scope && c.scope.detail === true) {
          initDetail();
        } else {
          teardownDetail();
        }
      });
    }

    chrome.storage.local.get([LC_STORAGE_KEY], function (res) {
      settings = Object.assign({}, (typeof LC_DEFAULTS !== 'undefined' ? LC_DEFAULTS : {}), res[LC_STORAGE_KEY] || {});
      boot();
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes[LC_STORAGE_KEY]) {
        settings = Object.assign({}, (typeof LC_DEFAULTS !== 'undefined' ? LC_DEFAULTS : {}), changes[LC_STORAGE_KEY].newValue || {});
        boot();
      }
    });
  }

  /* ---------- 导出 API（Node 测试 / 控制台共用） ---------- */

  var api = {
    parseManageList: parseManageList,
    extractArticle: extractArticle,
    buildMarkdown: buildMarkdown,
    filenameOf: filenameOf,
    sanitizeFilename: sanitizeFilename,
    /* 以下暴露给回归测试 */
    _blocksToMd: blocksToMd
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.LC_Export = api;
    try { initBrowser(); } catch (e) { console.warn('[lc-export] init 失败', e); }
  }
})(typeof window !== 'undefined' ? window : globalThis);
