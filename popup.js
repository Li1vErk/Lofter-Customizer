/* popup.js */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let state = LC_clone(LC_DEFAULTS);
  /* 悬浮面板首开防白闪（2026-09-23）：宿主 content.js 建 iframe 时带 lcDark=1，
   * popup.html <head> 的同源外链 theme-boot.js 据此先给 <html> 挂 lc-pre-dark 顶住
   * 第一帧。（最初写在内联 <script> 里，被 MV3 的 script-src 'self' 拦掉、防白闪
   * 等于没做，详见 theme-boot.js 头部。）
   * 真值（storage）到手后才撤这个预判标记、交给 body.dark 接管——撤早了会在
   * 真值到达前露一帧浅色（正是要修的白闪），故用 loaded 门闩把撤销钉在真值之后。
   * 必须声明在这里（IIFE 顶部）：storage 回调里要读写它，而回调注册点在 IIFE 中段，
   * 声明若放在尾部（applyDarkFollow 旁）一旦中途抛错就成 TDZ —— 回调触发时直接
   * ReferenceError（jsdom 里用 AudioContext 桩当场复现）。 */
  let lcStateLoaded = false;

  let t = 0;

  /* 导入前快照（2026-11-02）：导入会整份覆盖设置，覆盖前把 state 深拷一份存这里，
     卡片里给一条「还原」。独立键、不进 settings、不进导出（导出只走 cfgPick 的白名单）。
     体积 ≈ 设置本身（1~2 KB）：大件都是以 lcidb: 引用记的，不复制图片本体。 */
  const LC_PREIMPORT_KEY = "lc_pre_import_v1";

  /* i18n（#16 港澳台繁体）：内核缺失时全部退化为恒等，功能零影响。
   * popup 是插件自己的页面，整页可以安全替换 —— 唯一要防的是「从 LOFTER
   * 抓来的数据」（官方黑名单昵称 / 已隐藏用户 / 屏蔽 tag），那些节点打
   * data-lc-raw 标记跳过。另外 apply 是「整节点等值」语义：文本节点必须
   * 整串等于某条字典键才换，所以昵称几乎不可能被误伤。 */
  const i18n = (typeof LC_I18N !== "undefined") ? LC_I18N : null;
  const T = (s) => (i18n ? i18n.t(s) : s);
  function save() {
    clearTimeout(t);
    t = setTimeout(() => {
      /* ---------- 存前安全检查 ---------- */
      if (state.font && state.font.family) {
        state.font.family = LC_normalizeFontFamily(
          String(state.font.family).replace(/[;{}@<>"`\\]/g, '').trim()
        );
      }
      const isHex6 = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
      if (state.theme) {
        if (!isHex6(state.theme.accent)) state.theme.accent = '#000000';
      }
      if (state.background) {
        if (!isHex6(state.background.color)) state.background.color = '#ffffff';
        if (state.background.gradient) {
          if (!isHex6(state.background.gradient.from)) state.background.gradient.from = '#ffffff';
          if (!isHex6(state.background.gradient.to)) state.background.gradient.to = '#ffffff';
        }
        if (state.background.pattern) {
          if (!isHex6(state.background.pattern.fg)) state.background.pattern.fg = '#000000';
          if (!isHex6(state.background.pattern.bg)) state.background.pattern.bg = '#ffffff';
        }
      }
      /* ---------- 安检结束 ---------- */

      /* 名单桶剪枝：读路径（ensureBucket）会给「打开过面板的账号」留下空壳桶，
       * 写盘前剪掉非当前账号的空桶（见 lc-uid.js 的 prune 注释） */
      try { LCUid.prune(state.filter); } catch (e) {}

      chrome.storage.local.set({ [LC_STORAGE_KEY]: state }, () => {
        /* 写盘失败（最常见 = 10MB 配额满）此前被静默吞掉：界面照样弹
           「已保存 ✓」，但设置其实没落盘，刷新就回去了。这里明确报错，
           并把用户导到「其他 → 数据」的占用面板。lastError 必须在本回调
           里同步读——出了回调就被清掉。 */
        const err = chrome.runtime.lastError;
        if (err) {
          $("saved").classList.remove("show");
          lcSaveFailed(err.message || String(err));
          return;
        }
        const s = $("saved"); s.classList.add("show"); setTimeout(() => s.classList.remove("show"), 900);
      });
    }, 120);
  }
  const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
  const on = (id, ev, fn) => $(id).addEventListener(ev, fn);

  const compressImage = (dataUrl, maxW, maxH, quality) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL('image/png', quality));
    };
    img.src = dataUrl;
  });

  /* ---------- #20 大件素材库（popup 侧） ----------
   * 大件不再塞 chrome.storage.local（整个扩展共用一个 10MB 池，base64 还膨胀 1.33×
   * ⇒ 单文件 6–7MB 就写不进），改存扩展 origin 的 IndexedDB，settings 里只留一条引用
   * "lcidb:<id>"。popup 与 IDB 同 origin ⇒ 直接读写；页面侧拿不到扩展的库，由
   * background 中继回 base64、在页内建 objectURL（blob:chrome-extension:// 在
   * lofter.com 里跨源，取不到）。
   * 内存纪律：一条引用只对应一个 objectURL，换图/删除/清空时必须 revoke。 */
  const _pvUrls = new Map(); /* ref -> objectURL（本页预览用） */
  const LC_ASSETS = (typeof LCAssets !== "undefined") ? LCAssets : null;

  const lcIsRef = (v) => !!(v && typeof v === "string" && v.indexOf("lcidb:") === 0);
  /* 同步取「可用的 src」：老 dataUrl 原样返回；引用给已解析好的 URL；未就绪给 "" */
  const pvOf = (v) => {
    if (!v) return "";
    if (v.indexOf("data:") === 0) return v;
    return _pvUrls.get(v) || "";
  };

  /* 安全：把任意文本安全地塞进 HTML（文本节点与属性值通用）。
   * 2026-10-29 安全自查加：popup 是带 chrome.* 权限的扩展页，而**导入别人分享的主题包
   * JSON** 是唯一能把外部字符串送进来的通道 —— 一旦原样拼进 innerHTML，就是一个可以
   * 读到全部设置、还能调用消息中继的执行面。这里选「编码」而不是「删字符」：删字符会把
   * 用户写的 `3<5` 悄悄变成 `35`，编码后渲染结果与原文一致，只是不再解析成标签。 */
  function lcEscHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;");
  }

  /* 只替 src、不重建 DOM —— 避免打断用户正在调的滑块/输入框 */
  function lcRefreshAssetPreviews() {
    const bp = $("bg-preview");
    if (bp && state.background && state.background.image) {
      const src = pvOf(state.background.image.dataUrl);
      if (src) { bp.src = src; bp.style.display = "block"; }
    }
    const gp = $("gtotop-preview");
    if (gp && state.gtotop) {
      const src = pvOf(state.gtotop.imageDataUrl);
      if (src) { gp.src = src; gp.style.display = "block"; }
    }
    document.querySelectorAll("img[data-lc-pv]").forEach((el) => {
      const src = pvOf(el.getAttribute("data-lc-pv"));
      if (src) el.src = src;
    });
  }

  /* 把 settings 里已有的引用解析成本页 URL（重开面板后预览不能是空的） */
  function warmPreviewAssets(s) {
    if (!LC_ASSETS || !s) return;
    const refs = [];
    const add = (v) => { if (lcIsRef(v)) refs.push(v); };
    try {
      if (s.background && s.background.image) add(s.background.image.dataUrl);
      if (s.gtotop) add(s.gtotop.imageDataUrl);
      (s.decorations || []).forEach((d) => {
        add(d.dataUrl);
        if (d.interactive) add(d.interactive.soundFile);
      });
    } catch (e) { return; }

    const live = new Set(refs);
    _pvUrls.forEach((url, ref) => {
      if (live.has(ref)) return;
      _pvUrls.delete(ref);
      try { URL.revokeObjectURL(url); } catch (e) {}
    });

    refs.forEach((ref) => {
      if (_pvUrls.has(ref)) return;
      const id = LC_ASSETS.idOf(ref);
      if (!id) return;
      LC_ASSETS.getRecord(id).then((rec) => {
        if (!rec || !rec.blob) return;
        const url = URL.createObjectURL(rec.blob);
        _pvUrls.set(ref, url);
        lcRefreshAssetPreviews();
      }).catch(() => {});
    });
  }

  /* 体积超限的统一错误（文案见 lcAssetFail）。上限值一律取 LC_ASSETS.MAX_BYTES，
     不在这里另写数字 —— 写侧与读侧各写一个数就是孤儿记录的起点。 */
  function lcTooLarge(size) {
    const e = new Error("TOO_LARGE");
    e.code = "TOO_LARGE";
    e.size = size;
    e.maxMb = (LC_ASSETS && LC_ASSETS.MAX_MB) || 23;
    return e;
  }

  /* 选中的文件 → 一条 lcidb 引用（compress 不给就原样存：GIF 走这条，不压缩） */
  async function lcIngest(file, kind, compress) {
    if (!LC_ASSETS || !LC_ASSETS.isSupported()) throw new Error(T("浏览器存储不可用"));
    const maxB = (LC_ASSETS && LC_ASSETS.MAX_BYTES) || (24 * 1024 * 1024);
    let blob = file;
    /* 体积守卫必须在**写入前**拦。2026-10-15 真机踩到：只在读侧拦 ⇒ 24.6MB 照样写进 IDB，
       留下一条永远读不出来的孤儿记录（白占磁盘 + 用户看不到任何提示 + 面板也统计不到）。
       压缩型（装饰图/回顶图）允许「先压后判」—— 压完可能已远低于上限，直接按原文件拒是过度拦截。 */
    const willCompress = !!(compress && file.type !== "image/gif");
    if (!willCompress && file.size > maxB) throw lcTooLarge(file.size);
    if (willCompress) {
      const du = await readFile(file);
      const out = await compressImage(du, compress.maxW, compress.maxH, compress.quality);
      blob = LC_ASSETS.dataUrlToBlob(out) || file;
    }
    if (blob.size > maxB) throw lcTooLarge(blob.size);
    const id = LC_ASSETS.newId(kind);
    await LC_ASSETS.putBlob(id, blob, { type: blob.type || file.type, size: blob.size });
    const ref = LC_ASSETS.makeRef(id);
    try { _pvUrls.set(ref, URL.createObjectURL(blob)); } catch (e) {}
    return ref;
  }

  /* 某条引用彻底不用了：revoke 预览 URL + 删 IDB 记录（不留孤儿） */
  function lcDropRef(v) {
    if (!lcIsRef(v)) return;
    const url = _pvUrls.get(v);
    if (url) { try { URL.revokeObjectURL(url); } catch (e) {} _pvUrls.delete(v); }
    if (LC_ASSETS) { const id = LC_ASSETS.idOf(v); if (id) LC_ASSETS.del(id).catch(() => {}); }
  }

  /* 只在「settings 里再没有任何槽位引用它」时才删。
     2026-11-02：音效弹窗的「删除自定义音频」只把 soundFile 置空就保存 —— 引用没了、
     本体留在 IDB，每删一次多一条孤儿（真机实测 2 条）。这类调用点无法保证自己
     一定在「settings 已改」之后执行（弹窗未绑定装饰时 saveSoundConfig 直接 return），
     所以判定权收回这里：state 里还找得到这条引用就什么都不做。 */
  function lcDropRefIfUnused(v) {
    if (!lcIsRef(v)) return false;
    const still = lcAssetRefSlots(state).some((s) => s.ref === v);
    if (still) return false;
    lcDropRef(v);
    return true;
  }

  function lcAssetFail(err) {
    /* 超限要给「多大 / 上限多少 / 该怎么办」三件事。
       此处句中的 23 与 lc-assets.js 的 MAX_MB 保持同步（改上限时同步改这一条词条）。 */
    if (err && err.code === "TOO_LARGE") {
      const cur = (Number(err.size) / 1048576).toFixed(1);
      alert(T("这张图太大了：") + cur +
        T("MB。单张上限 23MB，请先把它压缩到上限以内再上传。"));
      return;
    }
    alert(T("素材保存失败：") + ((err && err.message) || err) + "\n" +
      T("图片未写入本地素材库，请重试或换一张小一点的。"));
  }

  /* ───── #20 B2：老配置增量迁移（popup 打开时自动跑）─────
     把 settings 里仍是 base64 的素材（B1 之前上传的老装饰图 / 老音效等）
     搬进 IDB、字段位换成 lcidb: 引用。设计约束（方案稿 §11.2.4 定稿）：
     · **递归全扫 + 数组逐项** —— 不写死 path 白名单：decorations[i] 每一项
       都覆盖，将来新增素材字段自动纳入（口径与取证探针 scanStrings 一致）。
     · **幂等** —— 再跑一遍没有 data: 大件就是 0 迁移，不会重复写 IDB。
     · **按件事务** —— 单件失败跳过并记录，不拖累其余；失败件保持原样
       （仍是 data:），下次打开面板自动重试。
     · **原样搬，不重新压缩** —— GIF 压了丢动画、别的压了掉画质；
       压缩只发生在新上传（lcIngest）那一刻。 */
  async function lcIdbMigrate(s) {
    const out = { found: 0, migrated: 0, failed: 0, errors: [] };
    if (!LC_ASSETS || !LC_ASSETS.isSupported() || !s || typeof s !== "object") return out;
    const slots = [];
    const walk = (v, depth) => {
      if (!v || typeof v !== "object" || depth > 10) return;
      const keys = Object.keys(v);
      for (const k of keys) {
        const val = v[k];
        if (typeof val === "string" &&
            (val.indexOf("data:image/") === 0 || val.indexOf("data:audio/") === 0)) {
          slots.push({ host: v, key: k, val: val });
        } else if (val && typeof val === "object") {
          walk(val, depth + 1);
        }
      }
    };
    walk(s, 0);
    out.found = slots.length;
    if (!out.found) return out;
    for (const slot of slots) {
      try {
        if (lcIsRef(slot.val)) continue; /* 已是引用（防御，正常扫不到） */
        const blob = LC_ASSETS.dataUrlToBlob(slot.val);
        if (!blob) throw new Error("dataUrl 解析失败");
        const kind = slot.val.indexOf("data:audio/") === 0 ? "aud" : "img";
        const id = LC_ASSETS.newId(kind);
        await LC_ASSETS.putBlob(id, blob, { type: blob.type, size: blob.size });
        slot.host[slot.key] = LC_ASSETS.makeRef(id);
        out.migrated++;
      } catch (e) {
        out.failed++;
        out.errors.push(String((slot.host && slot.host.id) || slot.key) +
          ": " + String((e && e.message) || e));
      }
    }
    return out;
  }

  /* 迁移结果 → 占用块顶上一条一次性提示。
     两条消失路径：① 迁移后再打开面板 found=0，压根不显示（真正的幂等，不重复打扰）；
     ② 本次面板内 8s 后淡出自删（占用块顶部位置宝贵，不留常驻横幅）。 */
  const LC_MIG_FADE_MS = 8000;
  function lcShowMigrateResult(m) {
    if (!m || (!m.migrated && !m.failed)) return;
    const box = $("lc-usage");
    if (!box || box.querySelector("[data-lc-mig]")) return;
    const el = document.createElement("div");
    el.setAttribute("data-lc-mig", "1");
    el.style.cssText = "margin:6px 0 0 0;font-size:12px;color:var(--lc-text);" +
      "transition:opacity .6s ease,height .3s ease;overflow:hidden;";
    el.textContent = m.failed
      ? T("素材迁移：成功 ") + m.migrated + T(" 件，失败 ") + m.failed +
        T(" 件（失败件保持原样，下次打开面板会自动重试）。")
      : T("旧版素材已搬到新位置：") + m.migrated +
        T(" 件（图片照常显示，只是不再占这 10MB）。");
    box.insertBefore(el, box.firstChild);
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
    }, LC_MIG_FADE_MS);
  }

  /* 标签切换（--i 驱动 .tabs::before 滑动色块平移） */
  const tabsBar = $("tabs");
  /* 记住最后停留的栏：切语言等场景 popup 会整页重载，不记就每次弹回第一栏。
     用 localStorage（扩展页同源、FAB iframe 与工具栏弹窗共用），存的是栏 id */
  const PANE_LS = "lc_last_pane";
  /* 每栏各记一份滚动位置。main#panes 是所有栏共用的唯一滚动容器，切栏时那一份
     scrollTop 会被新栏直接继承；旧栏一 display:none，浏览器就把滚动位置清零了，
     于是「滚到装饰第 5 张 → 去卡片栏 → 回来」必然弹回顶部（2026-11-05 作者反馈）。
     只在内存里记：同一次弹窗打开期间往返要回到原位，但重开弹窗仍从栏顶开始
     （跨弹窗记住反而会让人一打开就停在半截，说不清自己在哪）。 */
  const paneScroll = Object.create(null);
  let curPane = null;
  function activateTab(id) {
    const b = tabsBar.querySelector(`button[data-tab="${id}"]`);
    if (!b) return false;
    const main = $("panes");
    /* 顺序要紧：必须先把旧栏的位置存下来，再摘掉它的 .on —— 一旦 display:none，
       scrollTop 立刻被清零，之后就再也读不回原来的值了 */
    if (main && curPane && curPane !== id) paneScroll[curPane] = main.scrollTop;
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".pane").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    const pane = document.querySelector(`.pane[data-pane="${id}"]`);
    if (pane) pane.classList.add("on");
    /* 新栏已经是 display:block，赋 scrollTop 才会被采纳；内容比记忆值短时浏览器
       自己会夹到最大值，不用额外判断 */
    if (main) main.scrollTop = paneScroll[id] || 0;
    curPane = id;
    const btns = [...tabsBar.querySelectorAll("button[data-tab]")];
    tabsBar.style.setProperty("--i", btns.indexOf(b));
    return true;
  }
  tabsBar.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    activateTab(b.dataset.tab);
    try { localStorage.setItem(PANE_LS, b.dataset.tab); } catch (err) {}
    /* 进「其他」栏时刷新一次存储占用（统计有成本，不常驻轮询） */
    if (b.dataset.tab === "misc") {
      lcRenderUsage();
      /* 本机名单：打开面板等于"这个账号今天用过了"，顺手记一笔 */
      lcTouchBuckets();
      lcRenderBuckets();
    }
  });
  /* 载入时恢复上次停留的栏（失败/首次打开则维持 HTML 里的「显示」） */
  try {
    const last = localStorage.getItem(PANE_LS);
    if (last && last !== "bg") activateTab(last);
  } catch (err) {}

  /* 二级子标签切换（栏内 pill，如背景栏的"背景与显示 / 页面装饰"） */
  document.querySelectorAll(".subtabs").forEach((bar) => {
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-subtab]"); if (!b) return;
      bar.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
      const pane = bar.closest(".pane");
      pane.querySelectorAll(".subpane").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      pane.querySelector(`.subpane[data-subpane="${b.dataset.subtab}"]`).classList.add("on");
    });
  });

  /* 「其他 → 关于」版本号（读 manifest） */
  const verEl = $("about-version");
  if (verEl) verEl.textContent = "v" + chrome.runtime.getManifest().version;

  /* 背景组显隐 */
  function syncBgGroups() {
    const mode = state.background.mode;
    document.querySelectorAll("[data-when]").forEach((g) => (g.hidden = g.dataset.when !== mode));
    /* 背景明暗（叠在背景上的黑色遮罩）只对「有背景」的档位有意义：
       关闭档下没有背景可调，整块藏起来（与深色「关闭」档的亮度行同规矩） */
    const alphaWrap = $("bg-alpha-wrap");
    if (alphaWrap) alphaWrap.hidden = !mode || mode === "off";
  }
  /* 亮度 + 按时段：亮度只在暗色档位下有意义；时段输入只在「按时段」档显示 */
  function syncDarkBrightness() {
    const mode = state.darkMode.mode;
    /* 行 + 说明包在 #dark-brightness-wrap 里一起显隐（只藏行会残留说明） */
    $("dark-brightness-wrap").hidden = !mode || mode === 'off';
    const schRow = $("dark-schedule-row");
    if (schRow) schRow.hidden = mode !== 'schedule';
  }
  /* 淡透底卡面透明度：仅开关开启时显示 */
  function syncFeedTrans() {
    const row = $("dark-feed-trans-row");
    if (row) row.style.display = state.darkMode && state.darkMode.feedTranslucent ? "" : "none";
  }

  /* 返回顶层图片大小组显隐 */
  function syncGtotopSize() {
    $("gtotop-size-row").hidden = !state.gtotop || !state.gtotop.imageDataUrl;
  }

  /* 同步装饰图编辑按钮的显示状态。
     2026-09-23 方案A扁平化后工具行 #dec-toolbar 吸顶且常驻（含「添加装饰图」），
     空态只藏编辑类按钮，不再整行收起。 */
  function syncDecEditButtons(isEditing) {
    const hasDecs = (state.decorations || []).length > 0;
    const editBtn = $("dec-enter-edit");
    const exitBtn = $("dec-exit-edit");
    const toggleVisBtn = $("dec-toggle-visibility");
    const editHint = $("dec-edit-hint");
    const emptyTip = $("dec-empty-tip");

    if (!hasDecs) {
      editBtn.style.display = "none";
      exitBtn.style.display = "none";
      if (toggleVisBtn) toggleVisBtn.style.display = "none";
      if (editHint) editHint.style.display = "none";
      if (emptyTip) emptyTip.style.display = "";       // 显示空态引导
    } else {
      if (emptyTip) emptyTip.style.display = "none";
      // 拖拽操作提示只在编辑模式出现（紧挨「退出编辑」）
      if (editHint) editHint.style.display = isEditing ? "" : "none";
      if (isEditing) {
        editBtn.style.display = "none";
        exitBtn.style.display = "";
        if (toggleVisBtn) toggleVisBtn.style.display = "none";
      } else {
        editBtn.style.display = "";
        exitBtn.style.display = "none";
        if (toggleVisBtn) toggleVisBtn.style.display = "";
      }
    }
  }

  /* 互动总开关（2026-09-24 恢复为显式开关，不再随子功能派生）：
     关 = 纯静止贴图，面板不可展开；开 = 默认浮动呼吸 + 点击挤压，
     emoji 粒子 / 音效 / 词卡开不开、开哪种，由用户自己在面板里选。
     content.js 的呼吸动画与点击互动都门控在 interactive.enabled 上。

     已有关闭的图（enabled=false）即便残留 particles/breathe 也不会被动点亮，
     ——这正是"派生"逻辑取消后要保住的一条：总开关说了算。 */
  function syncIaMaster(card, idx) {
    const dec = state.decorations[idx];
    if (!card || !dec || !dec.interactive) return;
    const on = dec.interactive.enabled === true;

    const pill = card.querySelector(`button[data-ia-master="${idx}"]`);
    if (pill) {
      pill.classList.toggle("on", on);
      pill.classList.toggle("off", !on);
      const label = pill.querySelector("span");
      if (label) label.textContent = on ? "已开启" : "未开启";
    }

    const toggle = card.querySelector(`button[data-toggle-ia="${idx}"]`);
    if (toggle) {
      toggle.disabled = !on;
      toggle.style.color = on ? "var(--lc-accent)" : "var(--lc-sub)";
      toggle.style.cursor = on ? "pointer" : "default";
    }

    const offHint = card.querySelector(`span[data-ia-off-hint="${idx}"]`);
    if (offHint) offHint.style.display = on ? "none" : "";

    /* 关掉总开关时顺手收起面板，不留「开着却不可展开」的残留 */
    if (!on) {
      const panel = card.querySelector(`[data-ia-panel="${idx}"]`);
      const arrow = card.querySelector(`[data-arrow="${idx}"]`);
      if (panel) panel.style.display = "none";
      if (arrow) arrow.style.transform = "rotate(0deg)";
      card.dataset.interactiveOpen = "false";
    }
  }

  /* 拖拽排序的落点计算 —— 整块装饰栏都接 drop。
     2026-11-05 作者反馈「只有缩略图那一列能放，拖到别处变 🚫」。实测：卡片内部
     任意一点都能接（dragover 有 preventDefault），真正拒收的是卡片之间那 10px
     缝、列表下方空白和工具栏 —— 那些地方没人 preventDefault，Chromium 就画 🚫。
     所以把 dragover/drop 提到「栏」这一级，落点按 Y 坐标算，缝里也能放。 */
  let decDragSrc = -1;
  let decDragTo = -1;
  /* 让位幅度。8px 太含蓄 —— 作者 2026-11-06「空出的空间再大一点」。
     这里只做视觉位移、不改布局，向下让一整格会盖住下一张，16px 是
     「卡间距 10 + 明显多出 6」的观感，且永远不会把自己叠到别人身上。 */
  const LC_DEC_SHIFT_PX = 16;
  /* 拖到视口边缘的自动滚动参数。Chromium 对 popup 里这种自定义滚动容器
     不触发原生 autoscroll —— 作者 2026-11-06：顶部的装饰图想移到下面，
     只能拖出可视区、手动滚滚动条、再拖回来，非常折磨。
     边缘按「窗口视口」算，不是按列表 rect —— 探针实测 #dec-list 高 998
     就等于内容高、底部在视口外 1186px，拿它的边当触发线永远够不着。 */
  const LC_DEC_EDGE_PX = 36;   // 距视口上/下边多少像素内开始滚
  const LC_DEC_MIN_SPEED = 2;  // 每 tick 至少 2px，刚进带里也能看出来在动
  const LC_DEC_MAX_SPEED = 10; // 每 tick（16ms）最多滚 10px ≈ 600px/s 封顶
  /* 每张卡当前的让位位移。translateY 会污染 getBoundingClientRect，
     不扣掉的话判定点跟着卡片一起漂，形成「越让越早切」的正反馈。 */
  let decShiftY = [];

  function lcDecCards() {
    const list = $("dec-list");
    return list ? Array.from(list.querySelectorAll(":scope > div")) : [];
  }
  /* 越过某张卡的中线就插到它前面；越过最后一张就并到末尾。
     rect 要减去我们自己加的位移，还原成「没让位时的布局位置」再比较。

     关键在返回值：splice 是「先摘掉源卡、再按这个下标插回去」，
     所以下标要换成摘掉之后的口径 —— 源卡后面的卡整体减 1。
     不换算的话，拖回「自己原位和下一张之间」会被当成「插到下一张之后」，
     下一张平白往下让出一格（作者 2026-11-06：「图1 本来就在图2 上面，
     图2 还是往下空出一点」）。源卡自己不必特殊处理：它落在 i===src 时
     `i > src` 不成立，返回的就是 src，正好是原位。 */
  function lcDecIdxAt(clientY) {
    const cards = lcDecCards();
    const src = decDragSrc;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      const dy = decShiftY[i] || 0;
      if (clientY < r.top - dy + r.height / 2) {
        return src >= 0 && i > src ? i - 1 : i;
      }
    }
    return Math.max(0, cards.length - 1);
  }
  /* 让位方向：永远是「插入点及之后的卡整体下移」，空档就出现在 target
     那张卡的上方 —— 也就是手指落点。旧版按 src/target 大小分了两支、
     分别上移/下移，结果拖到卡3前时空档长在卡3下面（作者 2026-11-06 实测
     「移动到 2、3 中间时反而在图3下面空出空间」）。方向只跟 target 有关，
     跟从哪儿拖来无关，一支就够。
     target 是「摘掉源卡之后」的下标，所以比较前也要换算过去（pos）。 */
  function lcDecShift(target) {
    const cards = lcDecCards();
    decShiftY = cards.map((_, i) => {
      if (target === decDragSrc) return 0; // 落回原位：没有空档可让，全部收干净
      if (i === decDragSrc) return 0;      // 正在拖的那张本体不动
      const pos = i < decDragSrc ? i : i - 1;
      return pos >= target ? LC_DEC_SHIFT_PX : 0;
    });
    cards.forEach((c, i) => {
      c.style.transform = decShiftY[i] ? `translateY(${decShiftY[i]}px)` : "";
    });
  }
  function lcDecClearShift() {
    const cards = lcDecCards();
    decShiftY = cards.map(() => 0);
    cards.forEach((c) => {
      c.style.transition = "";
      c.style.transform = "";
    });
  }
  /* 找真正在滚的那个元素。装饰栏自己并不滚 —— 探针实测（2026-11-06）：
     8 张卡时 #dec-list 高度 998 = 内容高、overflow:visible，
     `list.scrollTop = 120` 读回 0，全是空操作；真正滚的是外层容器，
     弹窗里就是文档本身。此前直接给 #dec-list 赋 scrollTop，所以
     「从上往下勉强动一点、从下往上几乎不动」—— 往下那点动是 Chromium
     自己的窗口级 autoscroll 在兜底，向上它基本不管。
     从 list 自己开始往上找：将来布局改成列表内滚，这里也不用改。 */
  function lcDecScroller() {
    const list = $("dec-list");
    if (!list) return null;
    for (let el = list; el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1) {
        const oy = getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll") return el;
      }
    }
    return document.scrollingElement || document.documentElement || null;
  }
  /* 统一入口：算出当前落点，变了就让位。dragover 和自动滚动共用，
     保证滚动把卡片推上来之后空档也跟着重新长位置。 */
  function lcDecUpdateTarget(clientY) {
    const t = lcDecIdxAt(clientY);
    if (t !== decDragTo) {
      decDragTo = t;
      lcDecShift(t);
    }
  }
  /* 边缘自动滚动：鼠标停在视口上/下 LC_DEC_EDGE_PX 内就一直滚，
     速度按「越过边缘的深度」递增（刚碰到 2px/tick，深处封顶 10px/tick）。
     滚完立刻重算让位 —— 否则卡片都滚上来了，空档还钉在原地。 */
  let decAutoTimer = 0;
  let decLastY = 0;
  let decLastX = 0;
  /* 指针还在不在装饰栏里。每帧直接问 elementFromPoint，而不是「多久没收到
     dragover 就认为走了」—— 后者赌的是「鼠标不动时浏览器仍会周期性补发
     dragover」这个实现细节，一旦不补发，滚半秒就自己停了。 */
  function lcDecPointerInPane() {
    const list = $("dec-list");
    const pane = list && (list.closest(".pane") || list);
    if (!pane || (!decLastX && !decLastY)) return false;
    if (typeof document.elementFromPoint !== "function") return true; // 老环境退回「收到过就算在」
    const el = document.elementFromPoint(decLastX, decLastY);
    return !!(el && pane.contains(el));
  }
  function lcDecAutoTick() {
    if (decDragSrc === -1) { lcDecAutoStop(); return; }
    if (!lcDecPointerInPane()) return; // 指针拖出这一栏了，别拿着旧坐标空转
    const sc = lcDecScroller();
    if (!sc) return;
    const de = document.documentElement;
    const isDoc = !de || sc === de || sc === document.body;
    const vh = window.innerHeight || (de && de.clientHeight) || 0;
    /* 触发带要按「容器矩形 ∩ 视口」算：main#panes 高 431、底边可能落到窗口
       可视范围之外（探针实测 600 vs 视口 504），直接用 rect.bottom 又是够不着。 */
    let top = 0;
    let bottom = vh;
    if (!isDoc) {
      const rr = sc.getBoundingClientRect();
      top = Math.max(rr.top, 0);
      bottom = vh ? Math.min(rr.bottom, vh) : rr.bottom;
    }
    let d = 0;
    if (decLastY < top + LC_DEC_EDGE_PX) {
      d = -Math.min(LC_DEC_MAX_SPEED,
                    Math.max(LC_DEC_MIN_SPEED, Math.ceil(top + LC_DEC_EDGE_PX - decLastY)));
    } else if (decLastY > bottom - LC_DEC_EDGE_PX) {
      d = Math.min(LC_DEC_MAX_SPEED,
                   Math.max(LC_DEC_MIN_SPEED, Math.ceil(decLastY - (bottom - LC_DEC_EDGE_PX))));
    }
    if (!d) return;
    const max = sc.scrollHeight - sc.clientHeight;
    const next = Math.max(0, Math.min(max, sc.scrollTop + d));
    if (next === sc.scrollTop) return; // 已经滚到头
    sc.scrollTop = next;
    if (decDragTo !== -1) lcDecUpdateTarget(decLastY);
  }
  function lcDecAutoStart() {
    if (!decAutoTimer) decAutoTimer = setInterval(lcDecAutoTick, 16);
  }
  function lcDecAutoStop() {
    if (decAutoTimer) { clearInterval(decAutoTimer); decAutoTimer = 0; }
  }
  function lcDecOnOver(e) {
    if (decDragSrc === -1) return; // 不是内部拖动（比如拖文件进来）就别接
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    decLastY = e.clientY;
    decLastX = e.clientX;
    lcDecAutoStart();
    lcDecUpdateTarget(e.clientY);
  }
  function lcDecOnLeave(e) {
    if (decDragSrc === -1) return;
    /* 在卡片之间移动也会触发 dragleave，真正离开这一栏才把位移收回去。
       注意这里**不能停表**：滚动会让指针下的元素换手、反复触发 dragleave，
       一停就再也没人重启 —— 那正是「往上几乎一点也动不了」的直接原因。
       指针真离开窗口时靠 lcDecAutoTick 里的 900ms 失联判定兜住。 */
    const pane = e.currentTarget;
    if (e.relatedTarget && pane.contains(e.relatedTarget)) return;
    decDragTo = decDragSrc;
    lcDecShift(decDragSrc);
  }
  function lcDecOnDrop(e) {
    if (decDragSrc === -1) return;
    e.preventDefault();
    lcDecAutoStop();
    const fromIdx = decDragSrc;
    const toIdx = lcDecIdxAt(e.clientY);
    decDragSrc = -1;
    decDragTo = -1;
    const list = $("dec-list");
    if (list) list.classList.remove("lc-dec-dragging");
    lcDecClearShift();
    if (fromIdx === toIdx) return;
    const item = state.decorations.splice(fromIdx, 1)[0];
    state.decorations.splice(toIdx, 0, item);
    state.decorations.forEach((dec, i) => {
      dec.zIndex = state.decorations.length - i;
    });
    renderDecorations();
    save();
  }

  /* 渲染装饰物列表 */
  function renderDecorations() {
    const list = $("dec-list");
    list.innerHTML = "";
    const arr = state.decorations || [];

    // 确保每个装饰图都有完整的 interactive 配置（兼容旧数据 + 修复残缺新数据）
    arr.forEach((dec) => {
      // 如果连档案袋都没有，发一个完整的
      if (!dec.interactive || typeof dec.interactive !== 'object') {
        dec.interactive = {};
      }

      // 档案袋里的每一项都要检查，缺哪个补哪个
      if (typeof dec.interactive.enabled !== 'boolean') {
        dec.interactive.enabled = false;
      }
      if (typeof dec.interactive.particles !== 'boolean') {
        dec.interactive.particles = false;
      }
      if (!Array.isArray(dec.interactive.emojis) || dec.interactive.emojis.length === 0) {
        dec.interactive.emojis = ["\u2728"];
      }
      if (typeof dec.interactive.sound !== 'boolean') {
        dec.interactive.sound = false;
      }
      if (typeof dec.interactive.breathe !== 'boolean') {
        dec.interactive.breathe = true;
      }
      // 呼吸模式
      if (!['float', 'squish'].includes(dec.interactive.breatheMode)) {
        dec.interactive.breatheMode = 'float';
      }

      // 呼吸幅度
      if (typeof dec.interactive.breatheAmplitude !== 'number' || dec.interactive.breatheAmplitude < 0 || dec.interactive.breatheAmplitude > 100) {
        dec.interactive.breatheAmplitude = 30;
      }
      // 呼吸速度
      if (!['slow', 'normal', 'fast'].includes(dec.interactive.breatheSpeed)) {
        dec.interactive.breatheSpeed = 'normal';
      }

      // 新增：点击热区比例（默认 100%，即整张图都可点击）
      if (typeof dec.hitScale !== 'number' || dec.hitScale < 10 || dec.hitScale > 100) {
        dec.hitScale = 100;
      }

      // 挤压效果默认开启（如果舞台上要判断 squeeze !== false）
      if (typeof dec.interactive.squeeze !== 'boolean') {
        dec.interactive.squeeze = true;
      }

      // 挤压效果自定义
      if (typeof dec.interactive.squeezeStrength !== 'number' || dec.interactive.squeezeStrength < 0 || dec.interactive.squeezeStrength > 50) {
        dec.interactive.squeezeStrength = 15;
      }
      if (!['soft', 'elastic', 'crisp'].includes(dec.interactive.bounceStyle)) {
        dec.interactive.bounceStyle = 'elastic';
      }

      // 词卡弹窗
      if (typeof dec.interactive.dialogue !== 'boolean') {
        dec.interactive.dialogue = false;
      }
      if (!Array.isArray(dec.interactive.dialogues)) {
        dec.interactive.dialogues = [];
      }

      // 气泡持续时间（秒）
      if (typeof dec.interactive.dialogueDuration !== 'number' || dec.interactive.dialogueDuration < 1 || dec.interactive.dialogueDuration > 10) {
        dec.interactive.dialogueDuration = 3;
      }

      // 气泡堆叠数量
      if (typeof dec.interactive.dialogueStack !== 'number' || dec.interactive.dialogueStack < 1 || dec.interactive.dialogueStack > 5) {
        dec.interactive.dialogueStack = 1;
      }

      // 总开关不再重算（2026-09-24 起为显式开关）：缺失时上面的补全已兜成 false，
      // 已有 true/false 一律沿用，避免"派生"把用户手动关掉的图重新点亮
    });

    arr.forEach((dec, idx) => {
      const card = document.createElement("div");
      card.className = "lc-dec-card";
      card.style.cssText = "border:1px solid var(--lc-line);border-radius:8px;padding:8px;background:var(--lc-soft);";
      const ia = dec.interactive;
      const isOpen = card.dataset.interactiveOpen === "true";

      card.innerHTML = `
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <span class="lc-dec-thumb"><img data-lc-pv="${lcEscHtml(dec.dataUrl || "")}" src="${lcEscHtml(pvOf(dec.dataUrl))}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;display:block;background:repeating-conic-gradient(rgba(128,128,128,.18) 0 25%,transparent 0 50%) 0 0/12px 12px,rgba(128,128,128,.08);" /></span>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:12px;color:var(--lc-text);font-weight:500;">装饰 #${idx + 1}</span>
              <button class="btn" data-del="${idx}" style="padding:1px 8px;font-size:11px;flex-shrink:0;">删除</button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
              <button type="button" class="lc-pill ${dec.enabled !== false ? 'on' : 'off'}" data-idx="${idx}" data-key="enabled"><i class="lc-dot"></i>显示</button>
              <button type="button" class="lc-pill ${dec.aboveCards ? 'on' : 'off'}" data-idx="${idx}" data-key="aboveCards"><i class="lc-dot"></i>覆盖卡片</button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;">不透明度</span>
              <input type="range" data-idx="${idx}" data-key="opacity" min="10" max="100" value="${dec.opacity ?? 100}" style="flex:1;min-width:0;height:4px;" />
              <span class="value" style="min-width:34px;font-size:11px;">${dec.opacity ?? 100}%</span>
            </div>
          </div>
        </div>
        <!-- 互动效果展开栏：右侧总开关，关着时面板不可展开 -->
        <div style="margin-top:7px;border-top:1px solid var(--lc-line);padding-top:5px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn" data-toggle-ia="${idx}" type="button" ${ia.enabled ? '' : 'disabled'} style="padding:2px 0;font-size:12px;color:${ia.enabled ? 'var(--lc-accent)' : 'var(--lc-sub)'};background:transparent;border:none;text-align:left;display:flex;align-items:center;gap:4px;cursor:${ia.enabled ? 'pointer' : 'default'};flex:1;min-width:0;">
              <span data-arrow="${idx}" style="display:inline-block;transition:transform 0.2s;${isOpen && ia.enabled ? 'transform:rotate(90deg);' : ''}">▶</span>
              <span>互动效果</span>
            </button>
            <span data-ia-off-hint="${idx}" style="font-size:11px;color:var(--lc-sub);${ia.enabled ? 'display:none;' : ''}">开启后可调</span>
            <button type="button" class="lc-pill ${ia.enabled ? 'on' : 'off'}" data-ia-master="${idx}" title="开启后贴图会浮动呼吸、点击会挤压回弹，与非互动的静止贴图区分"><i class="lc-dot"></i><span>${ia.enabled ? '已开启' : '未开启'}</span></button>
          </div>
          <div data-ia-panel="${idx}" style="${isOpen && ia.enabled ? '' : 'display:none;'}padding-top:8px;">

<div style="margin-bottom:8px;display:flex;align-items:center;gap:6px;">
  <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;">呼吸模式</span>
  <select data-idx="${idx}" data-ia-key="breatheMode" style="flex:1;padding:2px 6px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-card);">
    <option value="float" ${ia.breathe !== false && (ia?.breatheMode || 'float') !== 'squish' ? 'selected' : ''}>浮动</option>
    <option value="squish" ${ia.breathe !== false && (ia?.breatheMode || 'float') === 'squish' ? 'selected' : ''}>挤压</option>
    <option value="off" ${ia.breathe === false ? 'selected' : ''}>关闭</option>
  </select>
  <button class="lc-link" data-breathe-more="${idx}" type="button">更多</button>
</div>
<div data-breathe-panel="${idx}" style="display:none;margin-bottom:10px;padding:8px;background:var(--lc-soft);border-radius:6px;">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
    <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;width:48px;">幅度</span>
    <input type="range" data-idx="${idx}" data-ia-key="breatheAmplitude" min="0" max="100" value="${ia.breatheAmplitude ?? 30}" style="flex:1;height:4px;" />
    <span class="value" style="min-width:32px;font-size:11px;">${ia.breatheAmplitude ?? 30}%</span>
  </div>
  <div style="display:flex;align-items:center;gap:6px;">
    <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;width:48px;">速度</span>
    <select data-idx="${idx}" data-ia-key="breatheSpeed" style="flex:1;padding:2px 6px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-card);">
      <option value="slow" ${(ia.breatheSpeed || 'normal') === 'slow' ? 'selected' : ''}>缓慢</option>
      <option value="normal" ${(ia.breatheSpeed || 'normal') === 'normal' ? 'selected' : ''}>正常</option>
      <option value="fast" ${(ia.breatheSpeed || 'normal') === 'fast' ? 'selected' : ''}>轻快</option>
    </select>
  </div>
</div>

            <div style="margin-bottom:10px;display:flex;align-items:center;gap:6px;">
  <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;">点击热区</span>
  <button type="button" class="help-dot" data-hint="dec-hit-help-${idx}" title="点击热区是什么？">?</button>
  <input type="range" data-idx="${idx}" data-ia-key="hitScale" min="20" max="100" value="${dec.hitScale ?? 100}" style="flex:1;min-width:0;height:4px;" />
  <span class="value" style="min-width:32px;font-size:11px;">${dec.hitScale ?? 100}%</span>
</div>
            <p class="hint collapsible plain" id="dec-hit-help-${idx}" style="margin:-6px 0 10px 0;">点击贴图时多大的范围能触发互动效果（挤压回弹、emoji 粒子等）。100%＝整张贴图都响应；调小后只有贴图中心的区域响应，点边缘会像没贴图一样直接点到网页。如果贴图挡住了页面按钮、经常误触发互动，把它调小即可。</p>
            <div data-ia-options="${idx}">
<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed var(--lc-line);">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;">挤压强度</span>
                <input type="range" data-idx="${idx}" data-ia-key="squeezeStrength" min="0" max="50" value="${ia.squeezeStrength ?? 15}" style="flex:1;min-width:0;height:4px;" />
                <span class="value" style="min-width:32px;font-size:11px;">${ia.squeezeStrength ?? 15}%</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;">回弹风格</span>
                <select data-idx="${idx}" data-ia-key="bounceStyle" style="flex:1;padding:2px 6px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-card);">
                  <option value="soft" ${ia.bounceStyle === 'soft' ? 'selected' : ''}>柔和</option>
                  <option value="elastic" ${ia.bounceStyle === 'elastic' ? 'selected' : ''}>弹性</option>
                  <option value="crisp" ${ia.bounceStyle === 'crisp' ? 'selected' : ''}>干脆</option>
                </select>
              </div>
            </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <button type="button" class="lc-pill ${ia.particles ? 'on' : 'off'}" data-idx="${idx}" data-ia-key="particles"><i class="lc-dot"></i>emoji 粒子</button>
                <input type="text" data-idx="${idx}" data-ia-key="emojis" value="${(ia.emojis || []).join('')}" placeholder="可填1~3个" maxlength="12" style="width:78px;padding:3px 6px;border:1px solid var(--lc-line);border-radius:6px;font-size:16px;text-align:center;visibility:${ia.particles ? 'visible' : 'hidden'};" />
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <button type="button" class="lc-pill ${ia.sound ? 'on' : 'off'}" data-idx="${idx}" data-ia-key="sound"><i class="lc-dot"></i>音效</button>
                <button class="lc-link" data-sound-edit="${idx}" type="button" style="display:${ia.sound ? '' : 'none'};">更多</button>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <button type="button" class="lc-pill ${ia.dialogue ? 'on' : 'off'}" data-idx="${idx}" data-ia-key="dialogue"><i class="lc-dot"></i>词卡弹窗</button>
                <button class="lc-link" data-dialogue-edit="${idx}" type="button" style="display:${ia.dialogue ? '' : 'none'};">编辑词卡 (${(ia.dialogues || []).length})</button>
              </div>
            </div>
          </div>
        </div>
      `;
      list.appendChild(card);
    });

    initRanges(); // 动态生成的装饰图滑杆也要上已填充轨道

    // 绑定热区滑块事件
    list.querySelectorAll('input[type="range"][data-ia-key="hitScale"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = +e.target.dataset.idx;
        if (!state.decorations[idx]) return;
        let val = +e.target.value;
        state.decorations[idx].hitScale = val;
        e.target.nextElementSibling.textContent = val + "%";
        save();
      });
    });

    // 绑定透明度滑块（此前遗漏绑定，拖动不生效）
    list.querySelectorAll('input[type="range"][data-key="opacity"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = +e.target.dataset.idx;
        if (!state.decorations[idx]) return;
        let val = +e.target.value;
        state.decorations[idx].opacity = val;
        e.target.nextElementSibling.textContent = val + "%";
        save();
      });
    });

    // 绑定显示/覆盖卡片开关胶囊（undefined 视为开：关->开 写回 true）
    list.querySelectorAll('.lc-pill[data-key]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.idx;
        const key = e.currentTarget.dataset.key;
        if (!state.decorations[idx]) return;
        const cur = key === "enabled" ? state.decorations[idx][key] !== false : !!state.decorations[idx][key];
        state.decorations[idx][key] = !cur;
        btn.classList.toggle("on", !cur);
        btn.classList.toggle("off", cur);
        save();
      });
    });

    // 互动总开关胶囊（右侧「未开启/已开启」）：
    // 开 = 默认浮动呼吸 + 点击挤压（与非互动的静止贴图区分）；关 = 拖回静止、面板收起不可展开
    list.querySelectorAll('button[data-ia-master]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.iaMaster;
        const dec = state.decorations[idx];
        if (!dec) return;
        if (!dec.interactive) {
          dec.interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: false };
        }
        const ia = dec.interactive;
        ia.enabled = ia.enabled !== true;
        if (ia.enabled) {
          /* 开启即给「会动的静态图」：浮动呼吸 + 点击挤压。
             呼吸模式若用户此前选过（浮动/挤压）就尊重，从未选过才补浮动 */
          ia.breathe = true;
          if (!['float', 'squish'].includes(ia.breatheMode)) ia.breatheMode = 'float';
          ia.squeeze = true;
        }
        syncIaMaster(list.children[idx], idx);
        save();
      });
    });

    // 绑定互动子功能开关胶囊（emoji 粒子 / 音效 / 词卡弹窗）
    // 总开关是上面那颗显式胶囊，这里的子功能开关不再反过来改写 enabled
    list.querySelectorAll('.lc-pill[data-ia-key]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.idx;
        const key = e.currentTarget.dataset.iaKey;
        const dec = state.decorations[idx];
        if (!dec) return;
        if (!dec.interactive) {
          dec.interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true };
        }
        const next = !dec.interactive[key];
        dec.interactive[key] = next;
        btn.classList.toggle("on", next);
        btn.classList.toggle("off", !next);
        const card = list.children[idx];
        if (key === "particles") {
          const box = card.querySelector(`input[data-idx="${idx}"][data-ia-key="emojis"]`);
          if (box) box.style.visibility = next ? "visible" : "hidden";
        }
        if (key === "sound") {
          const b = card.querySelector(`button[data-sound-edit="${idx}"]`);
          if (b) b.style.display = next ? "" : "none";
        }
        if (key === "dialogue") {
          const b = card.querySelector(`button[data-dialogue-edit="${idx}"]`);
          if (b) b.style.display = next ? "" : "none";
        }
        // 点击类功能需要贴图能接到点击：覆盖卡片没开就顺手打开
        if (next && (key === "particles" || key === "sound" || key === "dialogue") && !dec.aboveCards) {
          dec.aboveCards = true;
          const ab = card.querySelector('.lc-pill[data-key="aboveCards"]');
          if (ab) { ab.classList.add("on"); ab.classList.remove("off"); }
        }
        save();
      });
    });

    // 绑定 emoji 输入
    list.querySelectorAll('input[data-ia-key="emojis"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = +e.target.dataset.idx;
        if (!state.decorations[idx]) return;
        const raw = e.target.value;

        if (!state.decorations[idx].interactive) {
          state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true };
        }

        // 按"视觉上的完整字符"（grapheme cluster）拆分，避免切断 emoji
        let chars = [];
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
          for (const seg of segmenter.segment(raw)) {
            if (seg.segment.trim()) chars.push(seg.segment);
          }
        } else {
          // 旧浏览器回退
          for (const c of raw) {
            if (c.trim()) chars.push(c);
          }
        }
        // 只保留前 3 个视觉字符
        chars = chars.slice(0, 3);

        state.decorations[idx].interactive.emojis = chars;
        const joined = chars.join('');
        if (e.target.value !== joined) {
          e.target.value = joined;
        }
        save();
      });
    });

    // 绑定挤压强度滑块
    list.querySelectorAll('input[type="range"][data-ia-key="squeezeStrength"]').forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = +e.target.dataset.idx;
        if (!state.decorations[idx]) return;
        const val = +e.target.value;
        if (!state.decorations[idx].interactive) {
          state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic' };
        }
        state.decorations[idx].interactive.squeezeStrength = val;
        e.target.nextElementSibling.textContent = val + "%";
        save();
      });
    });

    // 绑定回弹风格下拉框
    list.querySelectorAll('select[data-ia-key="bounceStyle"]').forEach(select => {
      select.addEventListener("change", (e) => {
        const idx = +e.target.dataset.idx;
        if (!state.decorations[idx]) return;
        if (!state.decorations[idx].interactive) {
          state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic' };
        }
        state.decorations[idx].interactive.bounceStyle = e.target.value;
        save();
      });
    });

    // 绑定展开/收起按钮
    list.querySelectorAll('button[data-toggle-ia]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.toggleIa;
        const card = list.children[idx];
        const panel = card.querySelector(`[data-ia-panel="${idx}"]`);
        const arrow = card.querySelector(`[data-arrow="${idx}"]`);
        const isHidden = panel.style.display === "none";
        panel.style.display = isHidden ? "" : "none";
        if (arrow) {
          arrow.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
        }
        card.dataset.interactiveOpen = isHidden ? "true" : "false";
      });
    });

    // 绑定删除按钮
    list.querySelectorAll('button[data-del]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.target.dataset.del;
        if (confirm(T("( \u02b6> <)\u055e \u055e确定删除这个装饰图吗？"))) {
          const removed = state.decorations[idx];
          state.decorations.splice(idx, 1);
          /* #20：连同它的素材一起清（图 + 自定义音效），不留孤儿记录 */
          if (removed) {
            lcDropRef(removed.dataUrl);
            if (removed.interactive) lcDropRef(removed.interactive.soundFile);
          }
          renderDecorations();
          save();
        }
      });
    });

    // 拖拽排序：起拖只认缩略图；落点整块装饰栏都接（见 lcDecOnOver）
    lcDecCards().forEach((card, idx) => {
      card.dataset.sortIdx = idx;
      const thumb = card.querySelector("img[src]");
      if (!thumb) return;
      thumb.draggable = true;
      thumb.style.cursor = "grab";
      thumb.title = "拖拽调整图层顺序";
      thumb.addEventListener("dragstart", (e) => {
        decDragSrc = idx;
        decDragTo = idx;
        decShiftY = lcDecCards().map(() => 0); // 上一轮若没收干净，先抹平，别把位移带进判定
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", idx);
        /* 虚影用整张卡片，不是那 52px 缩略图：拖起来得能看出「我要把这一整条
           挪到那儿」，只飘一张小图不知道自己在搬什么（2026-11-05 作者提出）。
           抓取点按鼠标在卡片内的相对位置给，虚影不会突然跳到鼠标左上角。 */
        const cr = card.getBoundingClientRect();
        try {
          e.dataTransfer.setDragImage(
            card,
            Math.round(e.clientX - cr.left),
            Math.round(e.clientY - cr.top)
          );
        } catch (_) { /* 不支持自定义拖拽图的环境退回默认 */ }
        /* 源卡变淡要推到下一帧：drag image 是 dragstart 返回之后才截的，
           当场改 opacity 会把「正在拖的这一张」也一起截成半透明。
           复核一次 decDragSrc，万一这一帧里拖拽已经被取消，别留下一张永久半透明的卡 */
        setTimeout(() => {
          if (decDragSrc === idx) card.classList.add("lc-dec-src");
        }, 0);
        thumb.style.cursor = "grabbing";
        list.classList.add("lc-dec-dragging");
        lcDecCards().forEach((c) => {
          if (c !== card) c.style.transition = "transform 0.2s ease";
        });
      });
      thumb.addEventListener("dragend", () => {
        decDragSrc = -1;
        decDragTo = -1;
        lcDecAutoStop(); // 拖出窗口松手只走 dragend 不走 drop，表得在这里停
        card.classList.remove("lc-dec-src");
        thumb.style.cursor = "grab";
        list.classList.remove("lc-dec-dragging");
        lcDecClearShift();
      });
    });

    /* 落点挂在整栏上：卡片之间的缝、列表下方空白、工具栏都接得住，
       不再拖到卡片外就一路 🚫。renderDecorations 会重跑，所以先摘再挂，
       保证只有一个监听器（函数是固定引用，重复 add 不会叠加）。 */
    const decPane = list.closest(".pane") || list;
    decPane.removeEventListener("dragover", lcDecOnOver);
    decPane.removeEventListener("dragleave", lcDecOnLeave);
    decPane.removeEventListener("drop", lcDecOnDrop);
    decPane.addEventListener("dragover", lcDecOnOver);
    decPane.addEventListener("dragleave", lcDecOnLeave);
    decPane.addEventListener("drop", lcDecOnDrop);

    list.querySelectorAll(':scope > div').forEach((card, idx) => {
      card.dataset.sortIdx = idx;

      // 呼吸模式下拉框（off = 关闭浮动呼吸，总开关仍开着，点击挤压照旧）
      list.querySelectorAll('select[data-ia-key="breatheMode"]').forEach(select => {
        select.addEventListener("change", (e) => {
          const idx = +e.target.dataset.idx;
          if (!state.decorations[idx]) return;
          if (!state.decorations[idx].interactive) {
            state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal' };
          }
          if (e.target.value === "off") {
            state.decorations[idx].interactive.breathe = false;
          } else {
            state.decorations[idx].interactive.breathe = true;
            state.decorations[idx].interactive.breatheMode = e.target.value;
          }
          save();
        });
      });

      // 呼吸幅度滑块
      list.querySelectorAll('input[type="range"][data-ia-key="breatheAmplitude"]').forEach(input => {
        input.addEventListener("input", (e) => {
          const idx = +e.target.dataset.idx;
          if (!state.decorations[idx]) return;
          const val = +e.target.value;
          if (!state.decorations[idx].interactive) {
            state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal' };
          }
          state.decorations[idx].interactive.breatheAmplitude = val;
          e.target.nextElementSibling.textContent = val + "%";
          save();
        });
      });

      // 呼吸速度下拉
      list.querySelectorAll('select[data-ia-key="breatheSpeed"]').forEach(select => {
        select.addEventListener("change", (e) => {
          const idx = +e.target.dataset.idx;
          if (!state.decorations[idx]) return;
          if (!state.decorations[idx].interactive) {
            state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal' };
          }
          state.decorations[idx].interactive.breatheSpeed = e.target.value;
          save();
        });
      });

      // 呼吸更多设置展开/收起（事件委托，避免重复绑定）
      if (!list.dataset.lcMoreDelegated) {
        list.dataset.lcMoreDelegated = '1';
        list.addEventListener("click", (e) => {
          const btn = e.target.closest('button[data-breathe-more]');
          if (!btn) return;
          const idx = +btn.dataset.breatheMore;
          const card = list.children[idx];
          const panel = card.querySelector(`[data-breathe-panel="${idx}"]`);
          if (!panel) return;
          const isHidden = panel.style.display === "none";
          panel.style.display = isHidden ? "" : "none";
          btn.textContent = isHidden ? "收起" : "更多";
        });
      }
    });

    // 编辑词卡按钮
    list.querySelectorAll('button[data-dialogue-edit]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.dialogueEdit;
        openDialogueModal(idx);
      });
    });

    // 音效更多设置按钮
    list.querySelectorAll('button[data-sound-edit]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.soundEdit;
        openSoundModal(idx);
      });
    });

    // 控制"编辑位置"和"退出编辑"按钮
    syncDecEditButtons(false);

    // 隐藏/显示装饰图按钮
    const toggleVisBtn = $('dec-toggle-visibility');
    if (state.decorations && state.decorations.length > 0) {
      toggleVisBtn.style.display = '';
      toggleVisBtn.textContent = state.decorationsVisible !== false ? '隐藏装饰图' : '显示装饰图';
    } else {
      toggleVisBtn.style.display = 'none';
    }
  }

  let currentDialogueIdx = -1;

  function openDialogueModal(idx) {
    currentDialogueIdx = idx;
    const dec = state.decorations[idx];
    const dialogues = dec?.interactive?.dialogues || [];

    $('dialogue-modal-title').textContent = `装饰 #${idx + 1} 的词卡`;
    renderDialogueList(dialogues);

    const duration = dec?.interactive?.dialogueDuration ?? 3;
    $('dialogue-modal-duration').value = duration;

    $('dialogue-modal-overlay').style.display = 'flex';
    $('dialogue-modal-input').value = '';
    $('dialogue-modal-input').focus();

    // 同步堆叠数量
    const stack = dec?.interactive?.dialogueStack ?? 1;
    $('dialogue-modal-stack').value = stack;
  }

  function closeDialogueModal() {
    $('dialogue-modal-overlay').style.display = 'none';
    // 关闭时更新卡片上的按钮文字
    if (currentDialogueIdx >= 0 && state.decorations[currentDialogueIdx]) {
      const count = (state.decorations[currentDialogueIdx].interactive?.dialogues || []).length;
      const btn = document.querySelector(`button[data-dialogue-edit="${currentDialogueIdx}"]`);
      if (btn) btn.textContent = `编辑词卡 (${count})`;
    }
    currentDialogueIdx = -1;
  }

  function renderDialogueList(dialogues) {
    const container = $('dialogue-modal-list');
    if (dialogues.length === 0) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:120px;"><p class="hint" style="text-align:center;color:var(--lc-sub);margin:0;">还没有词卡，添加一条吧~</p></div>';
      return;
    }
    container.innerHTML = dialogues.map((text, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--lc-soft);border-radius:8px;margin-bottom:8px;">
      <span data-lc-raw style="flex:1;font-size:13px;color:var(--lc-text);word-break:break-word;">${lcEscHtml(text)}</span>
      <button class="btn dialogue-del-btn" data-didx="${i}" type="button" style="padding:2px 8px;font-size:11px;background:color-mix(in srgb,#ef4444 12%,var(--lc-card));color:#ef4444;border:none;border-radius:4px;cursor:pointer;">删除</button>
    </div>
  `).join('');
  }



  /* 字体选项 */
  function buildFontOptions() {
    const sel = $("font-preset"); sel.innerHTML = "";
    LC_FONT_PRESETS.forEach((p) => { sel.appendChild(Object.assign(document.createElement("option"), { value: p.key, textContent: p.label })); });
  }

  /* 渲染 */
  function render() {
    const s = state;
    $("enabled").checked = s.enabled;
    $("lang-select").value = s.lang || "zh-Hans";
    /* 悬浮按钮开关（「其他 → 面板」）：默认开 */
    const fabCb = $("show-fab");
    if (fabCb) {
      fabCb.checked = !(s.panel && s.panel.showFab === false);
      /* 关着的话说明要摊开（重新打开面板时也得是这个态，不能等用户再点一次） */
      lcFabHelpSync(fabCb.checked);
    }

    // 背景
    $("bg-mode").value = s.background.mode;
    $("bg-color").value = s.background.color;
    $("bg-gfrom").value = s.background.gradient.from;
    $("bg-gto").value = s.background.gradient.to;
    $("bg-gangle").value = s.background.gradient.angle; $("bg-gangle-v").textContent = s.background.gradient.angle + "°";
    $("bg-ptype").value = s.background.pattern.type;
    $("bg-pfg").value = s.background.pattern.fg;
    $("bg-pbg").value = s.background.pattern.bg;
    $("bg-blur").value = s.background.image.blur; $("bg-blur-v").textContent = s.background.image.blur + "px";
    $("bg-alpha").value = s.background.contentAlpha; $("bg-alpha-v").textContent = s.background.contentAlpha + "%";
    const img = $("bg-preview");
    if (s.background.image.dataUrl) { img.src = pvOf(s.background.image.dataUrl); img.style.display = img.getAttribute("src") ? "block" : "none"; } else { img.style.display = "none"; }

    // 卡片
    $("card-enabled").checked = s.card.enabled;
    $("card-radius").value = s.card.radius; $("card-radius-v").textContent = s.card.radius + "px";
    $("card-gap").value = s.card.gap; $("card-gap-v").textContent = s.card.gap + "px";
    $("card-shadow").checked = s.card.shadow;
    $("card-hover-zoom").checked = s.card.hoverZoom !== false;
    $("card-light-frost").checked = !!s.card.lightFrost;
    $("card-face-adapt").checked = s.card.faceAdapt !== false;
    $("card-frost-alpha").value = Math.round((s.card.frostAlpha || 0.6) * 100);
    $("card-frost-alpha-v").textContent = Math.round((s.card.frostAlpha || 0.6) * 100) + "%";
    syncCardFrost();
    /* 迁移（2026-09-26）：卡片材质主开关（总门禁）。老配置无此键 →
       任一子项开着即回填 true，行为与升级前完全一致；新配置默认 false。
       主开关只做门禁，不抹子设置——关了再开，各自调节原样回来 */
    if (s.card.material === undefined) {
      s.card.material = !!(
        s.card.lightFrost ||
        (s.darkMode && s.darkMode.feedTranslucent) ||
        s.card.faceAdapt !== false
      );
    }
    $("card-material").checked = !!s.card.material;
    syncCardMat();
    // 卡片动画
    $("card-animation").value = s.card.animation || 'none';
    $("card-duration").value = s.card.duration || 500; $("card-duration-v").textContent = (s.card.duration || 500) + "ms";
    $("card-stagger").checked = s.card.stagger !== false;
    $("card-stagger-delay").value = s.card.staggerDelay || 80; $("card-stagger-delay-v").textContent = (s.card.staggerDelay || 80) + "ms";

    $("tidy-all").checked = s.tidy.hideAll;
    $("tidy-hovercard").checked = s.tidy.hideHoverCard;
    $("tidy-inject-titles").checked = s.tidy.injectTitles;

    // 字体
    /* 迁移：早期版本由 preset 直接指定字体，现已改为"预置只填入字体名" */
    if (!s.font.family && s.font.preset) {
      const p = LC_FONT_PRESETS.find((x) => x.key === s.font.preset);
      if (p && p.family) s.font.family = p.family;
    }
    $("font-preset").value = s.font.preset;
    $("font-scale").value = s.font.scale; $("font-scale-v").textContent = s.font.scale + "%";
    $("font-family").value = s.font.family;
    fontChipsRender();

    // 暗色
    $("dark-mode").value = s.darkMode.mode || 'off';
    $("dark-brightness").value = s.darkMode.brightness || 90;
    $("dark-brightness-v").textContent = (s.darkMode.brightness || 90) + "%";
    $("dark-feed-translucent").checked = !!s.darkMode.feedTranslucent;
    $("dark-feed-trans-alpha").value = Math.round((s.darkMode.feedTransAlpha || 0.65) * 100);
    $("dark-feed-trans-v").textContent = Math.round((s.darkMode.feedTransAlpha || 0.65) * 100) + "%";
    /* 按时段：两个时间输入回填（缺失时用默认 19:00–07:00 显示，不改存储） */
    const sch = (s.darkMode && s.darkMode.schedule) || LC_DEFAULTS.darkMode.schedule;
    if ($("dark-schedule-from")) $("dark-schedule-from").value = sch.from || "19:00";
    if ($("dark-schedule-to")) $("dark-schedule-to").value = sch.to || "07:00";
    syncFeedTrans();

    // 导航（本批两档化：毛玻璃低透 / 液态玻璃高透，互斥）
    $("nav-blur").checked = s.navbar.blur;
    $("nav-hyalite").checked = !!s.navbar.hyalite;
    $("nav-mat-mode").value = s.navbar.matMode || "auto";
    syncNavMat();
    // 右侧栏液态玻璃（与导航栏同一套引擎，独立开关/材质）
    if (!state.sidebar) state.sidebar = LC_clone(LC_DEFAULTS.sidebar);
    $("sidebar-hyalite").checked = !!state.sidebar.hyalite;
    $("side-mat-mode").value = state.sidebar.matMode || "auto";
    $("sidebar-refract").checked = !!state.sidebar.refract;
    syncSideMat();
    $("th-accent").value = s.theme.accent || "#000000";
    $("search-placeholder").value = s.searchPlaceholder || "搜索用户、标签"; 

    // 返回顶层换图片
    const gp = $("gtotop-preview");
    if (s.gtotop && s.gtotop.imageDataUrl) {
      gp.src = pvOf(s.gtotop.imageDataUrl); gp.style.display = gp.getAttribute("src") ? "block" : "none";
    } else { gp.style.display = "none"; }

    // 返回顶层图片大小调整
    $("gtotop-size").value = s.gtotop.imageSize || 70;
    $("gtotop-size-v").textContent = (s.gtotop.imageSize || 70) + "%";

    syncBgGroups();
    syncDarkBrightness();
    syncGtotopSize();

    // 功能栏（字数统计已去开关、默认启用，无需回填）

    // 关键词过滤
    const f = s.filter || LC_clone(LC_DEFAULTS.filter);
    /* 名单是分账号的，回填前先迁老数据 + 确保当前桶存在 */
    LCUid.migrate(f, LCUid.uid());
    LCUid.ensureBucket(f, LCUid.uid());
    $("filter-enabled").checked = !!f.enabled;
    $("filter-scope-home").checked = !!(f.scope && f.scope.home);
    $("filter-scope-tag").checked = !!(f.scope && f.scope.tag);
    $("filter-scope-comment").checked = !!(f.scope && f.scope.comment);
    $("filter-counter").checked = f.showCounter !== false;
    $("filter-keywords").value = LCUid.list(f, "keywords").join("\n");
    renderFilterUsers();

    // 官方黑名单联动
    $("official-comments").checked = !!(
      s.official && s.official.hideInComments
    );

    // 评论区增强（工具行总开关，默认开；控件本身默认熄灭。
    // 表情快捷输入跟随本开关，不单列）
    $("comment-toolbar").checked = !(s.comment && s.comment.toolbar === false);

    // 文章导出
    const ex = s.export || LC_clone(LC_DEFAULTS.export);
    $("export-enabled").checked = !!ex.enabled;
    $("export-scope-manage").checked = !!(ex.scope && ex.scope.manage !== false);
    $("export-scope-detail").checked = !!(ex.scope && ex.scope.detail);
    $("export-merged").checked = !!(ex.merged);
    renderExportFold();

    // 编辑防丢（#12 B-lite）
    const dr = s.draft || LC_clone(LC_DEFAULTS.draft);
    $("draft-guard").checked = !!dr.guard;

    // 生成分享图（#14）
    const sc = s.shareCard || LC_clone(LC_DEFAULTS.shareCard);
    $("share-card-enabled").checked = sc.enabled !== false;      // 默认开

    // 私信增强：会话搜索（默认开）
    $("msg-search").checked = !(s.msg && s.msg.search === false);

    renderDecorations();

    // 词卡弹窗事件（只绑一次，确保 DOM 已加载）
    if ($('dialogue-modal-overlay') && !$('dialogue-modal-overlay').dataset.lcBound) {
      $('dialogue-modal-overlay').dataset.lcBound = '1';
      $('dialogue-modal-overlay').addEventListener('click', (e) => {
        if (e.target === $('dialogue-modal-overlay')) closeDialogueModal();
      });
      $('dialogue-modal-close').addEventListener('click', closeDialogueModal);
      $('dialogue-modal-done').addEventListener('click', closeDialogueModal);

      // 添加词卡
      $('dialogue-modal-add').addEventListener('click', () => {
        const input = $('dialogue-modal-input');
        const text = input.value.trim();
        if (!text || currentDialogueIdx < 0) return;

        if (!state.decorations[currentDialogueIdx].interactive) {
          state.decorations[currentDialogueIdx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal', dialogue: true, dialogues: [] };
        }
        if (!Array.isArray(state.decorations[currentDialogueIdx].interactive.dialogues)) {
          state.decorations[currentDialogueIdx].interactive.dialogues = [];
        }

        state.decorations[currentDialogueIdx].interactive.dialogues.push(text);
        input.value = '';
        input.focus();
        renderDialogueList(state.decorations[currentDialogueIdx].interactive.dialogues);
        save();
      });

      // 回车快捷添加
      $('dialogue-modal-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          $('dialogue-modal-add').click();
        }
      });

      // 删除词卡（事件委托，因为列表是动态生成的）
      $('dialogue-modal-list').addEventListener('click', (e) => {
        const delBtn = e.target.closest('.dialogue-del-btn');
        if (!delBtn || currentDialogueIdx < 0) return;

        const didx = +delBtn.dataset.didx;
        const dialogues = state.decorations[currentDialogueIdx].interactive?.dialogues;
        if (!dialogues || didx < 0 || didx >= dialogues.length) return;

        dialogues.splice(didx, 1);
        renderDialogueList(dialogues);
        save();
      });

      // 导入词卡
      $('dialogue-modal-import').addEventListener('click', () => {
        if ($('dialogue-import-area')) return; // 防止重复打开

        const importArea = document.createElement('div');
        importArea.id = 'dialogue-import-area';
        importArea.style.cssText = 'margin-bottom:10px;';
        importArea.innerHTML = `
        <textarea id="dialogue-import-text" placeholder="每行一个词卡，空行会自动过滤..." rows="4" style="width:100%;padding:6px 10px;border:1px solid var(--lc-line);border-radius:6px;font-size:13px;resize:vertical;box-sizing:border-box;margin-bottom:8px;"></textarea>
        <div style="display:flex;gap:8px;">
          <button id="dialogue-import-confirm" type="button" class="btn" style="flex:1;padding:6px;font-size:12px;background:var(--lc-accent);color:#fff;border:none;border-radius:6px;cursor:pointer;">确认导入</button>
          <button id="dialogue-import-cancel" type="button" class="btn" style="flex:1;padding:6px;font-size:12px;background:var(--lc-soft);border:none;border-radius:6px;cursor:pointer;">取消</button>
        </div>
      `;

        const inputRow = $('dialogue-modal-input').parentElement;
        inputRow.style.display = 'none';
        inputRow.parentElement.insertBefore(importArea, inputRow);
        $('dialogue-import-text').focus();

        $('dialogue-import-confirm').addEventListener('click', () => {
          const text = $('dialogue-import-text').value;
          const lines = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
          if (lines.length > 0 && currentDialogueIdx >= 0) {
            if (!state.decorations[currentDialogueIdx].interactive) {
              state.decorations[currentDialogueIdx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal', dialogue: true, dialogues: [] };
            }
            if (!Array.isArray(state.decorations[currentDialogueIdx].interactive.dialogues)) {
              state.decorations[currentDialogueIdx].interactive.dialogues = [];
            }
            state.decorations[currentDialogueIdx].interactive.dialogues.push(...lines);
            renderDialogueList(state.decorations[currentDialogueIdx].interactive.dialogues);
            save();
          }
          importArea.remove();
          inputRow.style.display = '';
        });

        $('dialogue-import-cancel').addEventListener('click', () => {
          importArea.remove();
          inputRow.style.display = '';
        });
      });

      // 导出词卡
      $('dialogue-modal-export').addEventListener('click', () => {
        if (currentDialogueIdx < 0) return;
        const dialogues = state.decorations[currentDialogueIdx].interactive?.dialogues || [];
        if (dialogues.length === 0) return;

        const text = dialogues.join('\n');
        navigator.clipboard.writeText(text).then(() => {
          const btn = $('dialogue-modal-export');
          const original = btn.textContent;
          btn.textContent = '已复制';
          btn.style.background = '#dcfce7';
          btn.style.color = '#22c55e';
          setTimeout(() => {
            btn.textContent = original;
            btn.style.background = '';
            btn.style.color = '';
          }, 1500);
        }).catch(() => {
          // 降级：老浏览器用 execCommand
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);

          const btn = $('dialogue-modal-export');
          const original = btn.textContent;
          btn.textContent = '已复制';
          setTimeout(() => { btn.textContent = original; }, 1500);
        });
      });
    }
    // 堆叠数量输入
    $('dialogue-modal-stack').addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 5) val = 5;
      e.target.value = val;
      if (currentDialogueIdx >= 0 && state.decorations[currentDialogueIdx]) {
        if (!state.decorations[currentDialogueIdx].interactive) {
          state.decorations[currentDialogueIdx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal', dialogue: false, dialogues: [], dialogueDuration: 3, dialogueStack: 1 };
        }
        state.decorations[currentDialogueIdx].interactive.dialogueStack = val;
        save();
      }
    });
    // 快捷键开关 + 列表折叠（2026-11-16 作者拍板形态）
    // 规则：关闭 ⇒ 列表与展开键都不出现（快捷键不生效时看它没有意义）；
    //      开启 ⇒ 按存下的展开状态渲染，**没存过就是展开**。
    // 「初次开启自动展开」用默认值表达，不引入一次性标记 —— 多一个状态
    // 就多一条永远测不到的分支。
    // 展开状态存 localStorage 而不是 settings：它是面板视图状态；写
    // storage.local 会让每个内容帧重算一次设置，也不该跟着导出包走。
    const SC_OPEN_KEY = "lc_sc_open_v1";
    const shortcutsEnabled = $("shortcuts-enabled");
    const scFoldBody = $("sc-fold-body");
    const scFold = $("sc-fold");
    const scOffHint = $("sc-off-hint");
    let scOpen = true;
    try {
      scOpen = localStorage.getItem(SC_OPEN_KEY) !== "0"; /* 缺省 = 展开 */
    } catch (e) {}

    function lcScRender() {
      const on = !!state.shortcutsEnabled;
      const open = on && scOpen;
      if (scOffHint) scOffHint.style.display = on ? "none" : "";
      if (scFold) {
        scFold.style.display = on ? "" : "none";
        scFold.textContent = T(open ? "收起" : "查看快捷键");
      }
      if (scFoldBody) {
        scFoldBody.classList.toggle("closed", !open);
        /* 折起来时里面的按钮不能被 Tab 聚焦（同 lcBindFold 的理由） */
        try {
          scFoldBody.inert = !open;
        } catch (e) {}
      }
    }

    shortcutsEnabled.addEventListener("change", (e) => {
      state.shortcutsEnabled = e.target.checked;
      save();
      lcScRender();
    });
    if (scFold) {
      scFold.addEventListener("click", () => {
        scOpen = !scOpen;
        try {
          localStorage.setItem(SC_OPEN_KEY, scOpen ? "1" : "0");
        } catch (e) {}
        lcScRender();
      });
    }

    // 初始化（两向都要写：关掉后重开面板，开关回填与列表显隐都得对。
    // 旧代码只在 true 方向回填，关掉后重开面板会显示成"开着但列表禁用"的矛盾态）
    shortcutsEnabled.checked = !!state.shortcutsEnabled;
    lcScRender();

    // 打开浏览器快捷键设置
    $('shortcuts-settings-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  /* 绑定 */
  on("enabled", "change", (e) => { state.enabled = e.target.checked; save(); });

  on("bg-mode", "change", (e) => { state.background.mode = e.target.value; syncBgGroups(); save(); });
  on("bg-color", "input", (e) => { state.background.color = e.target.value; save(); });
  on("bg-gfrom", "input", (e) => { state.background.gradient.from = e.target.value; save(); });
  on("bg-gto", "input", (e) => { state.background.gradient.to = e.target.value; save(); });
  on("bg-gangle", "input", (e) => { state.background.gradient.angle = +e.target.value; $("bg-gangle-v").textContent = e.target.value + "°"; save(); });
  on("bg-ptype", "change", (e) => { state.background.pattern.type = e.target.value; save(); });
  on("bg-pfg", "input", (e) => { state.background.pattern.fg = e.target.value; save(); });
  on("bg-pbg", "input", (e) => { state.background.pattern.bg = e.target.value; save(); });
  on("bg-blur", "input", (e) => { state.background.image.blur = +e.target.value; $("bg-blur-v").textContent = e.target.value + "px"; save(); });
  on("bg-alpha", "input", (e) => { state.background.contentAlpha = +e.target.value; $("bg-alpha-v").textContent = e.target.value + "%"; save(); });
  on("bg-file-btn", "click", () => $("bg-file").click());
  on("bg-file", "change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const prev = state.background.image.dataUrl;
    try {
      const ref = await lcIngest(f, "img"); /* 背景图不压缩：GIF 原样存（真机实测 23.3MB 可用 ✅ / 24.6MB 超限 ⇒ 上限 23MB，超限在写入前就拒并明确提示） */
      state.background.image.dataUrl = ref;
      if (prev !== ref) lcDropRef(prev);
      $("bg-preview").src = pvOf(ref);
      $("bg-preview").style.display = "block";
      save();
    } catch (err) { lcAssetFail(err); }
  });

  on("card-enabled", "change", (e) => { state.card.enabled = e.target.checked; save(); });
  on("card-radius", "input", (e) => { state.card.radius = +e.target.value; $("card-radius-v").textContent = e.target.value + "px"; save(); });
  on("card-gap", "input", (e) => { state.card.gap = +e.target.value; $("card-gap-v").textContent = e.target.value + "px"; save(); });
  on("card-shadow", "change", (e) => { state.card.shadow = e.target.checked; save(); });
  /* 悬停轻微放大（默认开）：关掉后 content.js 两条渲染路径都不再生成
     悬停缩放规则（气泡卡整卡那条 + 通用兜底管线 ::before 那条） */
  on("card-hover-zoom", "change", (e) => {
    if (!state.card) state.card = LC_clone(LC_DEFAULTS.card);
    state.card.hoverZoom = e.target.checked;
    save();
  });
  /* 浅色毛玻璃：滑杆仅开关开启时显示 */
  function syncCardFrost() {
    const row = $("card-frost-alpha-row");
    if (row) row.style.display = state.card && state.card.lightFrost ? "" : "none";
  }
  /* 卡片材质主开关联动：只更新进阶调节入口的可用态（主开关开着→
   * 主题色可点；关着→灰字禁用+「开启后可调」提示并收起面板）。
   * 开主开关不自动展开——展开与否由用户自己决定 */
  function syncCardMat() {
    const on = !!(state.card && state.card.material);
    const btn = $("card-mat-more");
    const arrow = $("card-mat-arrow");
    const hint = $("card-mat-off-hint");
    if (btn) {
      btn.disabled = !on;
      btn.style.color = on ? "var(--lc-accent)" : "var(--lc-sub)";
      btn.style.cursor = on ? "pointer" : "default";
    }
    if (hint) hint.style.display = on ? "none" : "";
    if (!on) {
      const detail = $("card-mat-detail");
      if (detail) detail.style.display = "none";
      if (arrow) arrow.style.transform = "";
    }
  }
  on("card-material", "change", (e) => {
    if (!state.card) state.card = LC_clone(LC_DEFAULTS.card);
    state.card.material = e.target.checked;
    /* 首次开启且毛玻璃/半透明底都没定制过 → 按默认组合一次全亮
       （自适应材质+毛玻璃+半透明底；faceAdapt 默认即真，不作为信号） */
    if (
      e.target.checked &&
      !state.card.lightFrost &&
      !(state.darkMode && state.darkMode.feedTranslucent)
    ) {
      state.card.lightFrost = true;
      state.card.faceAdapt = true;
      if (!state.darkMode) state.darkMode = LC_clone(LC_DEFAULTS.darkMode);
      state.darkMode.feedTranslucent = true;
      $("card-light-frost").checked = true;
      $("card-face-adapt").checked = true;
      $("dark-feed-translucent").checked = true;
      syncFeedTrans();
      syncCardFrost();
    }
    syncCardMat();
    save();
  });
  on("card-mat-more", "click", () => {
    if (!(state.card && state.card.material)) return;
    const detail = $("card-mat-detail");
    const arrow = $("card-mat-arrow");
    if (!detail) return;
    const open = detail.style.display !== "none";
    detail.style.display = open ? "none" : "";
    if (arrow) arrow.style.transform = open ? "" : "rotate(90deg)";
  });
  on("card-light-frost", "change", (e) => {
    if (!state.card) state.card = LC_clone(LC_DEFAULTS.card);
    state.card.lightFrost = e.target.checked;
    syncCardFrost();
    save();
  });
  on("card-face-adapt", "change", (e) => {
    if (!state.card) state.card = LC_clone(LC_DEFAULTS.card);
    state.card.faceAdapt = e.target.checked;
    save();
  });
  on("card-frost-alpha", "input", (e) => {
    if (!state.card) state.card = LC_clone(LC_DEFAULTS.card);
    state.card.frostAlpha = +e.target.value / 100;
    $("card-frost-alpha-v").textContent = e.target.value + "%";
    save();
  });

  // 卡片动画
  on("card-animation", "change", (e) => { state.card.animation = e.target.value; save(); });
  on("card-duration", "input", (e) => { state.card.duration = +e.target.value; $("card-duration-v").textContent = e.target.value + "ms"; save(); });
  on("card-stagger", "change", (e) => { state.card.stagger = e.target.checked; save(); });
  on("card-stagger-delay", "input", (e) => { state.card.staggerDelay = +e.target.value; $("card-stagger-delay-v").textContent = e.target.value + "ms"; save(); });

  on("tidy-all", "change", (e) => { state.tidy.hideAll = e.target.checked; save(); });
  on("tidy-hovercard", "change", (e) => { state.tidy.hideHoverCard = e.target.checked; save(); });
  on("tidy-inject-titles", "change", (e) => { state.tidy.injectTitles = e.target.checked; save(); });

  on("font-preset", "change", (e) => {
    const key = e.target.value;
    const p = LC_FONT_PRESETS.find((x) => x.key === key);
    const fam = (p && p.family) || "";
    state.font.preset = key;
    /* 预置只是"一键填入字体名"，真正的字体来源始终是输入框里的名字 */
    state.font.family = fam;
    const inp = $("font-family");
    if (inp) inp.value = fam;
    save();
    fontChipsRender();
  });
  on("font-scale", "input", (e) => { state.font.scale = +e.target.value; $("font-scale-v").textContent = e.target.value + "%"; save(); });
  on("font-family", "input", (e) => { state.font.family = e.target.value.trim(); save(); fontChipsRender(); });

  /* ---------- 字体名状态条：解析输入框的字体列表 → 逐个探测本机可用性。
     生效中 = 列表里第一个可用的（和 CSS font-family 的逐个回退一致）；
     点已装的 chip 把它置顶换为主字体。popup 与 LOFTER 页面看到的是
     同一套系统字体，所以这里的结果就是网页上的实际结果 ---------- */
  let fontChipsExpanded = false;

  function fontChipsNames() {
    return ($("font-family").value || "").split(/[，,]/).map((s) => s.trim()).filter(Boolean);
  }

  /* 单个字体名是否本机可用：量宽法（名称不存在时两基线同宽 ⇒ 判不可用）。
     不能用 document.fonts.check 快筛——它只查网页字体集（FontFaceSet），
     对系统字体会把不存在的 family 名误判成已装（DFMing-UB-HKP-BF 实测误报） */
  function fontNameAvailable(name) {
    const probe = document.createElement("span");
    probe.textContent = "測試测试Abc123, ";
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:32px;";
    document.body.appendChild(probe);
    let ok = false;
    for (const base of ["monospace", "serif"]) {
      probe.style.fontFamily = base;
      const w0 = probe.offsetWidth;
      probe.style.fontFamily = JSON.stringify(name) + ", " + base;
      if (probe.offsetWidth !== w0) { ok = true; break; }
    }
    probe.remove();
    return ok;
  }

  function fontChipsRender() {
    const bar = $("font-chips-bar"), chips = $("font-chips");
    if (!bar || !chips) return;
    const names = fontChipsNames();
    if (!names.length) { bar.style.display = "none"; chips.style.display = "none"; return; }
    bar.style.display = "flex";
    const states = names.map((name) => ({ name, ok: fontNameAvailable(name) }));
    const active = states.find((s) => s.ok);
    const off = !!(state.font && state.font.off);
    $("font-chips-summary").textContent = off
      ? "已停用自定义字体（正文用系统默认），点任意已装字体恢复"
      : active
        ? "生效中：" + active.name
        : "本机一个都没识别到，正文用系统默认字体";
    chips.innerHTML = "";
    /* 生效中独占第一行，其余按输入顺序排在后面：切换主字体时
       「其他字体」的相对顺序不变，chip 不会跳来跳去 */
    const rowOn = document.createElement("div"), rowRest = document.createElement("div");
    rowOn.className = "fc-row"; rowRest.className = "fc-row";
    states.forEach((s) => {
      const el = document.createElement("span");
      el.className = "font-chip" + (s === active ? " on" : s.ok ? " avail" : " miss");
      const dot = document.createElement("i"); dot.className = "fc-dot";
      const nameEl = document.createElement("span"); nameEl.className = "fc-name"; nameEl.textContent = s.name;
      const badge = document.createElement("span"); badge.className = "fc-badge";
      badge.textContent = s === active ? (off ? "已停用" : "生效中") : s.ok ? "已装" : "未装";
      el.append(dot, nameEl, badge);
      if (s === active) {
        /* 点生效中的 chip = 停用自定义字体回系统默认；字体名列表保留，
           再点一次（或点任意已装字体）即恢复 */
        el.style.cursor = "pointer";
        if (off) {
          el.className = "font-chip paused";
          el.title = "点击恢复使用自定义字体";
          el.addEventListener("click", () => { state.font.off = false; save(); fontChipsRender(); });
        } else {
          el.title = "点击停用自定义字体，正文回系统默认（字体名列表保留）";
          el.addEventListener("click", () => { state.font.off = true; save(); fontChipsRender(); });
        }
      } else if (s.ok) {
        el.style.cursor = "pointer";
        el.title = off ? "已安装，点击恢复使用并切换为主字体" : "已安装，点击切换为主字体";
        el.addEventListener("click", () => {
          const rest = fontChipsNames().filter((n) => n !== s.name);
          const inp = $("font-family");
          inp.value = [s.name, ...rest].join(", ");
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          state.font.off = false;
          save();
          fontChipsExpanded = true;
          fontChipsRender();
        });
      } else {
        el.title = "本机读不到这个名称：可能没装，也可能该字体只有英文名（如京華老宋体 → KingHwa_OldSong）";
      }
      (s === active ? rowOn : rowRest).appendChild(el);
    });
    if (rowOn.firstChild) chips.appendChild(rowOn);
    if (rowRest.firstChild) chips.appendChild(rowRest);
    chips.style.display = fontChipsExpanded ? "block" : "none";
    $("font-chips-arrow").style.transform = fontChipsExpanded ? "rotate(90deg)" : "";
  }

  on("font-chips-toggle", "click", () => { fontChipsExpanded = !fontChipsExpanded; fontChipsRender(); });
  /* "?"帮助图标（通用）：点击展开/收起 data-hint 指向的说明段落 */
  document.addEventListener("click", (e) => {
    const dot = e.target.closest && e.target.closest(".help-dot[data-hint]");
    if (!dot) return;
    /* 有的 "?" 就写在 <label class="toggle"> 里面（如「悬停轻微放大」），
       不拦默认行为的话点它会顺带把那个开关翻一下 */
    e.preventDefault();
    const hint = document.getElementById(dot.getAttribute("data-hint"));
    if (!hint) return;
    const open = hint.classList.toggle("open");
    dot.classList.toggle("on", open);
  });
  /* Esc 转发：面板是宿主页里的 iframe，用户在面板内点过之后焦点留在 iframe
     文档，宿主页的 Esc 监听收不到键盘事件（表现为面板内点过就关不掉，
     2026-09-24 报）。仅在「作为 FAB 面板 iframe 嵌入」时（parent !== self）
     捕获：先 blur 焦点元素（消掉按键的 focus 描框），再写 storage 中继键，
     content.js 的 onChanged 收到就 closePanel。工具栏弹窗（顶层文档）不
     转发——它按浏览器默认行为自己关，免得关弹窗顺手把网页上的面板也关了。 */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || window.parent === window) return;
    /* 弹窗开着时 ESC 只关弹窗，不关整个面板（deco-import-cancel 会 resolve(null)） */
    const closers = {
      "dialogue-modal-overlay": "dialogue-modal-close",
      "sound-modal-overlay": "sound-modal-close",
      "deco-pick-modal-overlay": "deco-pick-modal-close",
      "deco-import-modal-overlay": "deco-import-cancel",
    };
    const openId = Object.keys(closers).find((id) => {
      const el = document.getElementById(id);
      return el && el.style.display === "flex";
    });
    if (openId) {
      const c = $(closers[openId]);
      if (c) c.click();
      return;
    }
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    try {
      chrome.storage.local.set({ lc_panel_esc: Date.now() });
    } catch (err) {}
  });

  on("dark-mode", "change", (e) => { state.darkMode.mode = e.target.value; syncDarkBrightness(); save(); });
  /* 按时段：起止时间改变即存（跨零点由 LC_scheduleActive 判定，无额外约束） */
  on("dark-schedule-from", "change", (e) => {
    if (!state.darkMode) state.darkMode = LC_clone(LC_DEFAULTS.darkMode);
    state.darkMode.schedule = Object.assign({}, state.darkMode.schedule, { from: e.target.value });
    save();
  });
  on("dark-schedule-to", "change", (e) => {
    if (!state.darkMode) state.darkMode = LC_clone(LC_DEFAULTS.darkMode);
    state.darkMode.schedule = Object.assign({}, state.darkMode.schedule, { to: e.target.value });
    save();
  });
  on("dark-brightness", "input", (e) => { state.darkMode.brightness = +e.target.value; $("dark-brightness-v").textContent = e.target.value + "%"; save(); });
  on("dark-feed-translucent", "change", (e) => {
    if (!state.darkMode) state.darkMode = LC_clone(LC_DEFAULTS.darkMode);
    state.darkMode.feedTranslucent = e.target.checked;
    syncFeedTrans();
    save();
  });
  on("dark-feed-trans-alpha", "input", (e) => {
    if (!state.darkMode) state.darkMode = LC_clone(LC_DEFAULTS.darkMode);
    state.darkMode.feedTransAlpha = +e.target.value / 100;
    $("dark-feed-trans-v").textContent = e.target.value + "%";
    save();
  });
  /* 玻璃材质档位只在「液态玻璃」开启时出现（毛玻璃是固定磨砂，无材质档） */
  function syncNavMat() {
    const row = $("nav-mat-row");
    if (row) row.style.display = state.navbar && state.navbar.hyalite ? "" : "none";
  }

  /* 导航栏两档玻璃互斥：开一个自动关另一个 */
  on("nav-blur", "change", (e) => {
    state.navbar.blur = e.target.checked;
    if (e.target.checked && state.navbar.hyalite) { state.navbar.hyalite = false; $("nav-hyalite").checked = false; }
    syncNavMat();
    save();
  });
  on("nav-hyalite", "change", (e) => {
    state.navbar.hyalite = e.target.checked;
    if (e.target.checked && state.navbar.blur) { state.navbar.blur = false; $("nav-blur").checked = false; }
    syncNavMat();
    save();
  });
  on("nav-mat-mode", "change", (e) => { state.navbar.matMode = e.target.value; save(); });
  /* 右侧栏玻璃：开关直接生效，材质档与折射选项只在开启时出现 */
  function syncSideMat() {
    const on = !!(state.sidebar && state.sidebar.hyalite);
    const row = $("side-mat-row");
    if (row) row.style.display = on ? "" : "none";
    const rf = $("side-refract-row");
    if (rf) rf.style.display = on ? "" : "none";
  }
  on("sidebar-hyalite", "change", (e) => {
    if (!state.sidebar) state.sidebar = LC_clone(LC_DEFAULTS.sidebar);
    state.sidebar.hyalite = e.target.checked;
    syncSideMat();
    save();
  });
  on("sidebar-refract", "change", (e) => {
    if (!state.sidebar) state.sidebar = LC_clone(LC_DEFAULTS.sidebar);
    state.sidebar.refract = e.target.checked;
    save();
  });
  on("side-mat-mode", "change", (e) => {
    if (!state.sidebar) state.sidebar = LC_clone(LC_DEFAULTS.sidebar);
    state.sidebar.matMode = e.target.value;
    save();
  });
  on("th-accent", "input", (e) => { state.theme.accent = e.target.value; save(); });
  on("search-placeholder", "input", (e) => { state.searchPlaceholder = e.target.value.trim() || "搜索用户、标签"; save(); }); 

  on("reset", "click", () => { if (!confirm(T("确定要全部重置吗？"))) return; state = LC_clone(LC_DEFAULTS); render(); save(); });

  /* ---------- 重置本栏（页脚双键之一）----------
   * 只回退「当前所在栏」对应的设置模块，其余栏一个字不动。
   * 为什么要它：最常见的出错场景是"只把某一栏改坏了"（尤其深色/背景/卡片
   * 材质），全量重置太粗暴——装饰图、表情、背景图这些用户攒出来的资产
   * 会一起被抹掉。粒度取「栏」而不是「每个分组」：20 个分组各挂一个 ↺
   * 会让标题行变挤，而栏级已经覆盖绝大多数"回退"诉求。 */
  const PANE_MODULES = {
    bg: ["display"], deco: ["deco"], card: ["card"],
    nav: ["nav"], func: ["func", "export"], misc: ["misc"],
  };
  /* 不参与「重置本栏」的键：界面语言属于"用户身份"而非观感设置，
     重置任何一栏都不该悄悄把繁体切回简体（切语言本身会整页重载） */
  const RESET_SKIP_KEYS = ["lang"];

  function resetPane(pane) {
    const keys = (PANE_MODULES[pane] || [])
      .flatMap((mid) => (LC_MODULES.find((m) => m.id === mid) || {}).keys || [])
      .filter((k) => RESET_SKIP_KEYS.indexOf(k) < 0);
    if (!keys.length) return false;
    keys.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(LC_DEFAULTS, k)) {
        state[k] = LC_clone(LC_DEFAULTS[k]);
      } else {
        delete state[k];   /* 默认里没有的键（如 searchPlaceholder）：删掉即回默认 */
      }
    });
    render();
    save();
    return true;
  }

  on("reset-pane", "click", () => {
    const paneEl = document.querySelector(".pane.on");
    const tabBtn = tabsBar.querySelector("button[data-tab].on");
    const pane = paneEl ? paneEl.dataset.pane : "bg";
    const label = tabBtn ? tabBtn.textContent.trim() : "";
    if (!PANE_MODULES[pane]) return;
    if (!confirm(T(`确定要重置「${label}」栏的设置吗？其他栏不受影响。`))) return;
    resetPane(pane);
  });

  /* ---------- 悬浮按钮总开关（「其他 → 面板」）----------
   * 写进 lc_settings_v1.panel.showFab；content.js 侧的 FAB 模块监听
   * storage 变更即时隐藏/恢复（不必刷新页面）。 */
  /* 「其他 → 面板」：说明折进 ?，但**关掉开关时自动摊开** —— 那一刻用户最需要知道
   * 「面板还能从工具栏打开」。重新打开就收回折叠（2026-11-10 作者：常驻说明左侧空一块） */
  function lcFabHelpSync(show) {
    const hint = $("fab-help");
    const dot = document.querySelector('.help-dot[data-hint="fab-help"]');
    if (hint) hint.classList.toggle("open", !show);
    if (dot) dot.classList.toggle("on", !show);
  }

  on("show-fab", "change", (e) => {
    if (!state.panel) state.panel = LC_clone(LC_DEFAULTS.panel);
    state.panel.showFab = e.target.checked;
    lcFabHelpSync(e.target.checked);
    save();
  });

  /* 语言切换（#16）：整页重载最稳 —— 文案散在初始渲染与多处动态状态里，
   * 逐处回滚易漏（译后的文本已不是字典键，就地反查不回来）。
   * 先落盘再 reload，避免重载后读到旧值。 */
  on("lang-select", "change", (e) => {
    state.lang = e.target.value;
    if (i18n) i18n.set(state.lang);
    save();
    setTimeout(() => location.reload(), 250);
  });

  /* ---------- 功能栏：关键词/用户过滤 ---------- */
  function ensureFilter() {
    if (!state.filter) state.filter = LC_clone(LC_DEFAULTS.filter);
    if (!state.filter.scope) state.filter.scope = { home: true, tag: true };
    /* 名单按账号分桶（lc-uid.js）：先迁老平铺数组，再保证当前桶存在。
     * 开关（enabled / scope / showCounter）留在顶层 —— 那是「这台机器
     * 怎么表现」，换号不该跟着变。 */
    LCUid.migrate(state.filter, LCUid.uid());
    LCUid.ensureBucket(state.filter, LCUid.uid());
    return state.filter;
  }

  /* 取当前账号的三份名单之一。写操作直接改返回的数组再 save() 即可：
   * 它就是 state.filter.buckets[uid] 里的那个数组本体。 */
  function lcList(kind) {
    return LCUid.list(ensureFilter(), kind);
  }

  /* 用户在关键词框里打过字吗 —— 异步的身份确认回来时会重填输入框，
   * 不能把人家正在敲的内容盖掉 */
  var lcKwTouched = false;

  /* 未登录时锁住「能改名单」的两个入口（2026-11-14 作者拍板）。
   * 不是为了藏隐私 —— 这两个输入在未登录时**没有任何作用**：LOFTER 未登录
   * 访问任何页面都会跳到登录页，站内没有可过滤的内容；而写进匿名桶的条目
   * 会在下一次登录时被并集认领进那个账号的名单 ⇒ 共用电脑时等于替别人投票。
   * 只在**明确**未登录（content 确认当前页停在登录页）时锁，问不出来一律不锁。 */
  var lcListLocked = false;
  var LC_LOCK_PH = "未登录，登录后才能添加";

  function lcSetListLock(onFlag) {
    lcListLocked = !!onFlag;
    const kw = $("filter-keywords");
    if (kw) {
      kw.disabled = lcListLocked;
      kw.style.opacity = lcListLocked ? "0.55" : "";
      kw.style.cursor = lcListLocked ? "not-allowed" : "";
    }
    const ti = $("official-add-input");
    if (ti) {
      ti.disabled = lcListLocked;
      ti.placeholder = lcListLocked
        ? LC_LOCK_PH
        : lcOffMode === "tag"
          ? "输入 tag 名称，或粘贴 tag 页链接"
          : "粘贴对方主页链接或 ID";
    }
    const tb = $("official-add-btn");
    if (tb) tb.disabled = lcListLocked;
    const note = $("filter-lock-note");
    if (note) note.style.display = lcListLocked ? "" : "none";
  }

  /* 名单级重渲染：换身份（登录 ⇄ 未登录）时用。
   * 只重画「按账号走」的那几块，其余 UI 不动。 */
  function lcRenderLists() {
    const f = ensureFilter();
    const kb = $("filter-keywords");
    if (kb && !lcKwTouched) kb.value = LCUid.list(f, "keywords").join("\n");
    renderFilterUsers();
    try {
      renderTagBlockList(); /* 本地段的账号名在段头里，换身份要重画 */
    } catch (e) {}
    renderFilterFold();
    /* 换身份 = 换了一个账号在用这台机器：记一笔使用时间与账号名，
       否则管理界面里那个桶永远是「账号 ·0853 · 未知」 */
    lcTouchBuckets();
    lcRenderBuckets();
  }

  /* 打开面板时确认「现在还登着吗」（2026-11-14 作者拍板 A 方案）。
   * popup 是 chrome-extension:// 域，看不见页面全局，只能问当前标签页的
   * content script。只有拿到**明确**的未登录（那个页面在登录页）才降级成
   * 匿名桶；问不到（非 LOFTER 页 / 消息没响应 / 子域页）一律沿用缓存 ——
   * 否则在任意标签页开面板都会把名单显示成空的。 */
  function lcVerifyWhoAmI() {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const t = tabs && tabs[0];
        if (!t || t.id == null) return;
        if (!/^https?:\/\/([a-z0-9-]+\.)?lofter\.com\//i.test(String(t.url || ""))) return;
        chrome.tabs.sendMessage(t.id, { action: "lcWhoAmI" }, (r) => {
          if (chrome.runtime.lastError || !r) return; /* 问不到 ⇒ 沿用缓存 */
          if (r.ok === true) {
            lcSetListLock(false); /* 确认在登录态：名单可改 */
            const changed = r.uid && r.uid !== LCUid.uid();
            if (changed) LCUid.setWho(r);
            /* 每次都试一次认领：登出期间（走匿名桶）加的条目，重新登录后
               要收回当前账号。migrate 幂等，没有真变更就不写盘。
               不做这步的话，那些条目要等页面那边（content）自己迁完才出现，
               面板刚打开时会显示得像"我加的词没了" */
            if (state && state.filter && LCUid.migrate(state.filter, LCUid.uid())) {
              LCUid.prune(state.filter);
              chrome.storage.local.set({ [LC_STORAGE_KEY]: state }, () => {});
            }
            if (changed) lcRenderLists();
            return;
          }
          if (r.ok === false) {
            LCUid.setAnon("login");
            /* 先上锁再重画：本地段的空态文案要按锁定态出（否则写着
               「或在这里输入」，而框已经灰了），重画会连着这段一起刷 */
            lcSetListLock(true); /* 明确未登录：锁住输入（页面全跳登录页，改了也无用） */
            lcRenderLists();
          }
        });
      });
    } catch (e) {}
  }

  function renderFilterUsers() {
    const box = $("filter-users");
    if (!box) return;
    const users = lcList("users");
    $("filter-user-count").textContent = users.length + " 人";
    box.innerHTML = users.length
      ? users
          .map(
            (u, i) =>
              `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-soft);">` +
              `<span data-lc-raw style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${String(u.name || u.id).replace(/[<>&"]/g, "")}</span>` +
              `<button class="btn" data-filter-unmute="${i}" type="button" style="padding:1px 8px;font-size:11px;flex-shrink:0;">移除</button></div>`,
          )
          .join("")
      : `<p class="hint" style="margin:0;">暂无。在帖子作者名或用户评论旁点「隐藏」即可添加。</p>`;
    renderFilterFold();
  }

  /* ---------- #21 渐进披露：通用折叠（2026-10-29） ----------
   * 一个开关 gate 一块具体设置：关 → 收起、只留一行摘要；开 → 展开、摘要让位。
   *
   * 为什么没有「修改」按钮、也没写「未生效」（作者 2026-10-29 拍板）：
   * 开关本身就是唯一的展开入口——要生效、要改名单，正常人都会先把开关打开，
   * 而开关一开卡片就展开了。再给一个「关闭态下点改」的第二条路属于重复入口，
   * 只会让人怀疑「我是不是得点修改才会生效」。「未生效」同理：开关关着就是
   * 没生效，写在摘要旁边是同一句话说两遍。
   *
   * 折叠 ≠ 隐藏状态：摘要必须报数量（「5 个关键词 · 3 个用户」），否则用户
   * 会以为名单被清空了。 */
  function lcBindFold(cfg) {
    const row = $(cfg.row);
    const body = $(cfg.body);
    const en = $(cfg.en);
    return function render() {
      if (!row || !body || !en) return;
      const on = !!en.checked;
      body.classList.toggle("closed", !on);
      /* 折起来时把里面的控件设 inert：不可见却能 Tab 聚焦是坑。
         老内核没有 inert 属性也不报错（赋值即普通属性），不影响折叠本身 */
      try {
        body.inert = !on;
      } catch (e) {}
      row.classList.toggle("show", !on);
      if (on) return;
      const el = $(cfg.sum);
      if (el) el.textContent = cfg.sumText();
    };
  }

  /* 摘要文案（纯函数，便于自检）：只列非零项，全零返回空串（由调用方
     换成「未设置屏蔽内容」）。 */
  function lcFilterSumText(f) {
    const n = (a) => (Array.isArray(a) ? a.length : 0);
    /* 量词短语单独过 T()：i18n 运行时是「整节点等值」匹配，运行时拼出来的
       「5 个关键词」永远匹配不上字典，所以只能整段短语进字典、数字在外面拼 */
    /* 按当前账号数（lc-uid.js 分桶）——摘要说「3 个用户」，那 3 个就是
     * 当前这个号看到的 3 个，不能把别的账号的名单也算进去 */
    const kw = n(f && LCUid.list(f, "keywords"));
    const us = n(f && LCUid.list(f, "users"));
    const tg = n(f && LCUid.list(f, "tags"));
    const parts = [];
    if (kw) parts.push(kw + " " + T("个关键词"));
    if (us) parts.push(us + " " + T("个用户"));
    if (tg) parts.push(tg + " " + T("个标签"));
    return parts.length ? parts.join(" · ") : "";
  }

  /* 文章导出的摘要：报「导出在哪几个位置 + 是否合并」，与过滤那边同理——
     折叠后不报范围，用户会以为设置被重置了 */
  function lcExportSumText(ex) {
    const sc = (ex && ex.scope) || {};
    const parts = [];
    if (sc.manage !== false) parts.push(T("批量管理页"));
    if (sc.detail) parts.push(T("文章详情页"));
    if (!parts.length) return T("未选择导出位置");
    if (ex && ex.merged) parts.push(T("合并为单个 .md"));
    return parts.join(" · ");
  }

  const renderFilterFold = lcBindFold({
    row: "filter-fold-row",
    body: "filter-body",
    en: "filter-enabled",
    sum: "filter-summary",
    sumText: () => lcFilterSumText(state.filter) || T("未设置屏蔽内容"),
  });

  const renderExportFold = lcBindFold({
    row: "export-fold-row",
    body: "export-body",
    en: "export-enabled",
    sum: "export-summary",
    sumText: () => lcExportSumText(state.export),
  });

  on("filter-users", "click", (e) => {
    const b = e.target.closest("[data-filter-unmute]");
    if (!b) return;
    lcList("users").splice(+b.dataset.filterUnmute, 1);
    renderFilterUsers();
    save();
  });

  /* 页面上点「隐藏」→ storage 变化 → 打开着的面板要实时反映出来，
   * 不能等重开面板（面板常驻期间收不到自己的渲染周期）。
   * 只同步 users/tags 列表：keywords textarea 可能正被用户编辑，不能覆盖 */
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.lc_settings_v1) return;
      const nf = changes.lc_settings_v1.newValue?.filter;
      if (!nf) return;
      /* 只比「当前账号那个桶」：别的账号的桶变了跟这个面板无关，
       * 整份 JSON 比对会在换号后把别人的名单当成自己的 */
      const nb = LCUid.ensureBucket(nf, LCUid.uid());
      const cur = LCUid.ensureBucket(ensureFilter(), LCUid.uid());
      if (JSON.stringify(cur.users) !== JSON.stringify(nb.users)) {
        cur.users = nb.users;
        renderFilterUsers();
      }
      /* 页面卡片上点 tag「屏蔽」→ 打开着的面板 tag 列表实时反映 */
      if (JSON.stringify(cur.tags) !== JSON.stringify(nb.tags)) {
        cur.tags = nb.tags;
        if (lcOffMode === "tag") renderTagBlockList();
        renderFilterFold(); /* 摘要里的标签数（两种模式都要刷） */
      }
    });
  } catch (e) {}

  on("filter-enabled", "change", (e) => {
    ensureFilter().enabled = e.target.checked;
    renderFilterFold();
    save();
  });
  on("filter-scope-home", "change", (e) => {
    ensureFilter().scope.home = e.target.checked;
    save();
  });
  on("filter-scope-tag", "change", (e) => {
    ensureFilter().scope.tag = e.target.checked;
    save();
  });
  /* 评论区（Phase 2）：只做用户维度隐藏，关键词不参与 */
  on("filter-scope-comment", "change", (e) => {
    ensureFilter().scope.comment = e.target.checked;
    save();
  });
  on("filter-counter", "change", (e) => {
    ensureFilter().showCounter = e.target.checked;
    save();
  });
  /* 评论区增强：工具行总开关（默认开；只看作者/排序的运行态由页面
   * 上的 chip 控制，不进配置——状态不跨帖保留） */
  on("comment-toolbar", "change", (e) => {
    if (!state.comment) state.comment = LC_clone(LC_DEFAULTS.comment);
    state.comment.toolbar = e.target.checked;
    save();
  });

  /* ---------- 功能栏：文章导出 ---------- */
  function ensureExport() {
    if (!state.export) state.export = LC_clone(LC_DEFAULTS.export);
    if (!state.export.scope) state.export.scope = { manage: true, detail: false };
    return state.export;
  }
  on("export-enabled", "change", (e) => {
    ensureExport().enabled = e.target.checked;
    renderExportFold();
    save();
  });
  on("export-scope-manage", "change", (e) => {
    ensureExport().scope.manage = e.target.checked;
    renderExportFold(); /* 折叠态下改不到，但摘要口径要始终跟手 */
    save();
  });
  on("export-scope-detail", "change", (e) => {
    ensureExport().scope.detail = e.target.checked;
    renderExportFold();
    save();
  });
  on("export-merged", "change", (e) => {
    ensureExport().merged = e.target.checked;
    renderExportFold();
    save();
  });

  /* ---------- 功能栏：生成分享图（#14） ----------
   * 入口恒 auto（作者 2026-10-07 退休「入口并进官方按钮条」开关）：
   * 官方按钮条 → 帧内 li / 横条并排钮 → 竖列侧钮 → 右下角悬浮球兜底。 */
  function ensureShareCard() {
    if (!state.shareCard) state.shareCard = LC_clone(LC_DEFAULTS.shareCard);
    return state.shareCard;
  }
  on("share-card-enabled", "change", (e) => {
    ensureShareCard().enabled = e.target.checked;
    save();
  });

  /* ---------- 功能栏：编辑防丢（#12 B-lite） ---------- */
  on("draft-guard", "change", (e) => {
    if (!state.draft) state.draft = LC_clone(LC_DEFAULTS.draft);
    state.draft.guard = e.target.checked;
    save();
  });

  /* ---------- 功能栏：私信增强（会话搜索，默认开） ---------- */
  on("msg-search", "change", (e) => {
    if (!state.msg) state.msg = LC_clone(LC_DEFAULTS.msg);
    state.msg.search = e.target.checked;
    save();
  });

  on("filter-keywords", "input", (e) => {
    lcKwTouched = true; /* 见 lcRenderLists：异步身份确认回来时别盖掉正在敲的字 */
    const seen = new Set();
    /* 多关键词两种写法都支持：一行一个，或中/英文逗号（分号）分隔 */
    const next = e.target.value
      .split(/[\n，,；;]+/)
      .map((k) => k.trim())
      .filter((k) => {
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    /* 就地替换数组内容：lcList 返回的是桶里那个数组本体，
     * 重新赋值给 f.keywords 会写到顶层（分账号就废了） */
    const arr = lcList("keywords");
    arr.length = 0;
    next.forEach((k) => arr.push(k));
    renderFilterFold(); /* 关闭态下手动展开编辑时，摘要要跟着变 */
    save();
  });

  /* ---------- 功能栏：官方黑名单 ----------
   * DWR 调用与回复解析在 lc-dwr.js（popup 页面 CSP 禁 eval，
   * 回复解析用手写解析器，不能 new Function）。 */
  let lcOfficialList = []; /* {id, blogId, blogName, nick, ava} */
  let lcOfficialLoading = false;
  /* 失败态要单独存：原先 catch 里「先设文案、再 render」会被 render 覆盖成
     「0 人」⇒ 用户看到的失败其实是假的 0 人（2026-10-23 真机反馈暴露） */
  let lcOfficialErr = null;
  let lcOfficialRetried = false; /* 首次失败自动重试一次，只一次 */
  /* 登录态（2026-11-10 未登录真机暴露）：DWR 对**受保护接口**在未登录时
   * 不报错，而是回 `_remoteHandleCallback('id','0',null)` —— 解析出来是 null。
   * 以前它落进「0 人（异常）+ 原始回复片段」，把开发态文案端给了用户；
   * 更糟的是 addBlacklist 未登录时回 `{id:-1000,blogInfo:null,...}` 的空壳，
   * 被当成加成功 ⇒ 列表里多一条破图、刷新就没了。所以单独记一档 auth。 */
  let lcOfficialAuth = "unknown"; /* unknown | ok | login */

  /* 卡片模式：同一张卡、同一个输入框，在「拉黑用户（官方 DWR）」与
   * 「屏蔽 tag（本地 filter.tags）」间切换——两个名单的日常管理动作
   * 相同（输入→添加→列表移除），合并一张卡免得面板越拉越长 */
  let lcOffMode = "user";

  const lcDwr = LC_dwrCall;

  function lcOfficialBlogName(input) {
    /* 接受三种写法：完整主页 URL / xxx.lofter.com / 裸 id。
     * 裸 id 必须先判：new URL("https://abc") 也能解析成功
     * （hostname 就是 "abc"），先走 URL 分支会把裸 id 误杀。 */
    const s = String(input || "").trim();
    if (!s) return "";
    if (/^[a-zA-Z0-9_-]+$/.test(s)) return s;
    try {
      const u = new URL(s.includes("://") ? s : "https://" + s);
      if (!/(^|\.)lofter\.com$/i.test(u.hostname)) return "";
      if (u.hostname !== "www.lofter.com" && u.hostname !== "lofter.com") {
        return u.hostname.split(".")[0] || "";
      }
      return u.pathname.split("/").filter(Boolean)[0] || "";
    } catch (e) {
      return "";
    }
  }

  function lcOfficialEsc(s) {
    return String(s || "").replace(/[<>&"]/g, "");
  }

  /* 成员列表日常收起（用户可能不想看见拉黑的人），收起时人数照样更新；
   * 拉黑成功后在人数旁闪现绿色「已拉黑 xxx」供即时确认 */
  let lcOfficialExpanded = false;
  let lcOfficialToastTimer = 0;

  function lcOfficialToast(msg) {
    const el = $("official-toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "";
    clearTimeout(lcOfficialToastTimer);
    lcOfficialToastTimer = setTimeout(() => {
      el.style.display = "none";
    }, 4000);
  }

  function renderOfficialList() {
    const box = $("official-list");
    if (!box) return;
    /* tag 模式下列表由 renderTagBlockList 接管：异步刷新官方名单完成时
     * 不能覆盖 tag 列表的计数与内容 */
    if (lcOffMode === "tag") return;
    $("official-count").textContent = lcOfficialLoading
      ? "读取中…"
      : lcOfficialAuth === "login"
        ? "未登录"
        : lcOfficialErr
          ? "读取失败"
          : lcOfficialList.length + " 人";
    const toggleBtn = $("official-toggle");
    if (toggleBtn) toggleBtn.textContent = lcOfficialExpanded ? "收起" : "展开";
    if (!lcOfficialExpanded) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
    box.style.display = "";
    if (lcOfficialLoading) return;
    if (lcOfficialAuth === "login") {
      box.innerHTML = `<p class="hint" style="margin:0;">请先登录 LOFTER 再管理黑名单（未登录时官方接口读不到名单，也写不进去）。<br>` +
        `登录后点<button class="lc-link" data-official-retry type="button" style="font-size:12px;padding:0 2px;">重试</button>` +
        `即可。</p>`;
      return;
    }
    if (lcOfficialErr) {
      /* 给明确出口：真机上首次打开面板常因 DWR 会话未就绪而失败，重开面板就好 ⇒
         自动重试一次（见 lcOfficialRefresh），仍失败再让用户手动点 */
      box.innerHTML = `<p class="hint" style="margin:0;">读取失败：${lcOfficialEsc(lcOfficialErr)}。<br>` +
        `首次打开面板时偶尔会这样，点<button class="lc-link" data-official-retry type="button" style="font-size:12px;padding:0 2px;">重试</button>` +
        `即可；一直失败请确认已在浏览器登录 LOFTER。</p>`;
      return;
    }
    if (!lcOfficialList.length) {
      box.innerHTML = `<p class="hint" style="margin:0;">黑名单为空。</p>`;
      return;
    }
    box.innerHTML = lcOfficialList
      .map((u, i) => {
        const home =
          u.home ||
          (u.blogName ? "https://" + u.blogName + ".lofter.com/" : "");
        return (
          `<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-soft);">` +
          (home
            ? `<a href="${lcOfficialEsc(home)}" target="_blank" rel="noopener noreferrer" title="访问 TA 的主页" style="flex-shrink:0;line-height:0;">` +
              `<img src="${lcOfficialEsc(u.ava)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" onerror="this.style.visibility='hidden'"></a>`
            : `<img src="${lcOfficialEsc(u.ava)}" style="width:24px;height:24px;border-radius:50%;flex-shrink:0;object-fit:cover;" onerror="this.style.visibility='hidden'">`) +
          `<span data-lc-raw style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">` +
          (home
            ? `<a href="${lcOfficialEsc(home)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${lcOfficialEsc(u.nick)}</a>`
            : lcOfficialEsc(u.nick)) +
          ` <span class="hint" style="font-size:11px;">@${lcOfficialEsc(u.blogName)}</span></span>` +
          `<button class="btn" data-official-unblk="${i}" type="button" style="padding:1px 8px;font-size:11px;flex-shrink:0;">移除</button></div>`
        );
      })
      .join("");
  }

  on("official-toggle", "click", () => {
    lcOfficialExpanded = !lcOfficialExpanded;
    if (lcOffMode === "tag") {
      renderTagBlockList();
      /* 展开才看得见名单，这时还没读过就补一次（30 秒节流在 lcTagsRefresh 里） */
      lcTagsRefresh().catch(() => {});
    } else {
      renderOfficialList();
    }
  });

  /* ---------- 模式切换 + tag 屏蔽名单 ---------- */
  function renderOfficialMode() {
    const tag = lcOffMode === "tag";
    const input = $("official-add-input");
    const btn = $("official-add-btn");
    if (input) input.placeholder = lcListLocked
      ? LC_LOCK_PH
      : tag
        ? "输入 tag 名称，或粘贴 tag 页链接"
        : "粘贴对方主页链接或 ID";
    if (btn) btn.textContent = tag ? "屏蔽" : "拉黑";
    const lbl = $("official-list-label");
    if (lbl) lbl.textContent = tag ? "已屏蔽 tag" : "黑名单成员";
    const help = $("official-help");
    if (help) help.style.display = tag ? "none" : "";
    const tagHelp = $("official-tag-help");
    if (tagHelp) tagHelp.style.display = tag ? "" : "none";
    /* 卡头那枚 ? 跟着页签换目标：tag 页签下官方黑名单说明是隐藏的，
       不换就会点了没反应（2026-11-10 走查发现）。换目标时把两边的展开态都收掉，
       免得切回来看到「? 是亮的但内容关了」或反过来 */
    const tagDetail = $("official-tag-detail");
    if (tagDetail) tagDetail.style.display = tag ? "" : "none";
    const dot = $("official-help-dot");
    if (dot) {
      dot.setAttribute("data-hint", tag ? "official-tag-detail" : "official-help");
      dot.title = tag ? "官方与本地两份名单有什么区别？" : "什么是官方黑名单？";
      dot.classList.remove("on");
    }
    if (help) help.classList.remove("open");
    if (tagDetail) tagDetail.classList.remove("open");
    const addHint = $("official-add-hint");
    if (addHint) addHint.style.display = tag ? "none" : "";
    const cRow = $("official-comments-row");
    if (cRow) cRow.style.display = tag ? "none" : "";
    if (tag) {
      renderTagBlockList();
      /* 切到 tag 页签才去读官方名单（30 秒内不重复打）：
       * 这是两个不同接口，默认页签是「拉黑用户」，没必要每次都多打一次 */
      lcTagsRefresh().catch(() => {});
    } else {
      renderOfficialList();
    }
  }

  on("official-mode", "change", () => {
    const checked = document.querySelector("#official-mode input:checked");
    lcOffMode = checked && checked.value === "tag" ? "tag" : "user";
    renderOfficialMode();
  });

  /* tag 名归一化：接受裸名或 tag 页链接（/tag/<名>[/new|/total]），
   * 从 href 段解码出原名（与 content.js 卡片匹配同一口径：href 比
   * 卡片文案稳，不受大小写/改写影响） */
  function lcTagNormalize(input) {
    let s = String(input || "").trim();
    if (!s) return "";
    const m = s.match(/\/tag\/([^\/?#]+)/);
    if (m) {
      try {
        s = decodeURIComponent(m[1]);
      } catch (e2) {
        s = m[1];
      }
    }
    return s.trim();
  }

  /* ---------- 官方「标签屏蔽」（#39）----------
   * 和本地名单并排的两段，写通道完全不同：
   *   官方 —— 服务端、账号级、上限 100、**全端生效（手机 App 也算）**。
   *           没有 DWR 读接口，名单由设置页 SSR 直出（见 lc-official-tags.js）；
   *           写接口 updateUserForbidTags 的 param0 是**操作后的完整列表**。
   *   本地 —— settings.filter.tags，只影响本浏览器，会随配置导出。
   *
   * 三条不能省的动作顺序（写侧安全的前提）：
   *   ① 写前现读：param0 全量覆盖 ⇒ 拿面板打开时的旧快照写，会把手机端刚加的标签冲掉
   *   ② 写后对账：DWR 是反向 Ajax，POST 回空/状态 null **不代表失败**，只能再读一次比
   *   ③ 先官方写成功、对账通过，才动本地列表（交换/降级时不会出现两边都不在或都在） */
  const lcTags = { state: "idle", tags: [], reason: "", loading: false, at: 0 };
  let lcTagsRetried = false;

  /* 集合比较（不区分大小写、不看顺序）：服务端可能排序或改大小写 */
  function lcSameTagSet(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const norm = (x) => String(x).toLowerCase();
    const s = new Set(a.map(norm));
    const seen = new Set();
    for (let i = 0; i < b.length; i++) {
      const k = norm(b[i]);
      if (!s.has(k) || seen.has(k)) return false;
      seen.add(k);
    }
    return true;
  }

  function lcTagsErrText(r) {
    if (!r) return "网络异常";
    if (r.state === "login") return "请先登录 LOFTER";
    if (r.state === "changed") return "官方页面形态可能已变化";
    return r.reason || "网络异常";
  }

  /* 拉官方名单。失败自动补试一次（黑名单卡 2026-10-23 的老毛病：面板刚打开时
   * 会话常未就绪，关掉重开就好 —— 这里自动兜一次，之后交给「重试」按钮） */
  async function lcTagsRefresh(force) {
    if (lcTags.loading) return;
    if (!force && lcTags.at && Date.now() - lcTags.at < 30000) return;
    lcTags.loading = true;
    if (!lcTags.tags.length) lcTags.state = "loading";
    renderTagBlockList();
    let r;
    try {
      r = await LCOfficialTags.fetchList();
    } catch (e) {
      r = { ok: false, state: "error", tags: [], reason: String((e && e.message) || e) };
    }
    lcTags.loading = false;
    lcTags.at = Date.now();
    if (r.state === "ok") {
      lcTags.state = "ok";
      lcTags.tags = r.tags || [];
      lcTags.reason = "";
      lcTagsRetried = false;
    } else {
      lcTags.state = r.state || "error";
      lcTags.reason = lcTagsErrText(r);
      if (!force && !lcTagsRetried) {
        lcTagsRetried = true;
        setTimeout(() => { lcTagsRefresh(true).catch(() => {}); }, 1200);
      }
    }
    renderTagBlockList();
  }

  /* 写官方名单：现读 → 算新列表 → 写 → 对账。
   * mutate(当前列表) 返回写入后的完整列表；tag/act 只影响服务端的动作位。
   * pre：调用方刚读到的结果（可选）。添加/升格为了判满本来就要读一次，
   * 传进来就复用 —— 一次操作固定两次 GET（写前现读 + 写后对账），
   * 而不是三次（判满读、commit 里再读、对账读）。 */
  async function lcOfficialTagCommit(mutate, tag, act, pre) {
    let cur = pre && pre.state === "ok" ? pre : null;
    if (!cur) {
      try {
        cur = await LCOfficialTags.fetchList();
      } catch (e) {
        cur = { ok: false, state: "error", tags: [], reason: String((e && e.message) || e) };
      }
    }
    if (cur.state !== "ok") {
      lcTags.state = cur.state || "error";
      lcTags.reason = lcTagsErrText(cur);
      renderTagBlockList();
      return { ok: false, reason: lcTags.reason };
    }
    const next = mutate(cur.tags.slice());
    try {
      await lcDwr("updateUserForbidTags", [next, "string:" + tag, "number:" + act]);
    } catch (e) {
      /* 网络/HTTP 失败：改动可能没到服务端，也可能到了没回执 —— 一律以现读为准 */
      lcTags.state = "ok";
      lcTags.tags = cur.tags;
      renderTagBlockList();
      return { ok: false, reason: String((e && e.message) || e) };
    }
    let after;
    try {
      after = await LCOfficialTags.fetchList();
    } catch (e) {
      after = { ok: false, state: "error", tags: [] };
    }
    if (after.state !== "ok") {
      /* 写成功与否未知：不假装成功，让用户点重试（面板停在旧数据上会误导） */
      lcTags.state = "ok";
      lcTags.tags = cur.tags;
      renderTagBlockList();
      return { ok: false, reason: "写后读取失败，请重试" };
    }
    lcTags.state = "ok";
    lcTags.tags = after.tags;
    lcTags.at = Date.now();
    renderTagBlockList();
    if (!lcSameTagSet(after.tags, next)) {
      /* DWR 静默拒绝 / 超上限 / 另一端刚改过：面板已经换成服务端现态，提示重试 */
      return { ok: false, reason: "刚才的修改没有生效" };
    }
    return { ok: true, tags: after.tags };
  }

  function lcTagRowHtml(t, i, official) {
    const btn = "padding:1px 8px;font-size:11px;flex-shrink:0;";
    const acts = official
      ? `<button class="btn" data-otag-demote="${i}" type="button" style="${btn}">移到本地</button>` +
        `<button class="btn" data-otag-unblk="${i}" type="button" style="${btn}">移除</button>`
      : `<button class="btn" data-tag-promote="${i}" type="button" style="${btn}">升到官方</button>` +
        `<button class="btn" data-tag-unblock="${i}" type="button" style="${btn}">移除</button>`;
    return (
      `<div style="display:flex;gap:6px;align-items:center;padding:4px 8px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-soft);">` +
      `<span data-lc-raw style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${lcEscHtml(t)}</span>` +
      acts +
      `</div>`
    );
  }

  /* 段头：名字与计数不许折（280px 下「官方」曾被挤成竖排「官 / 方」），
   * 说明单独占剩余宽度、需要时自己换行 */
  function lcTagSecHead(name, count, note) {
    return (
      `<div style="display:flex;align-items:baseline;gap:6px;margin:10px 0 6px 0;">` +
      `<span style="flex:0 0 auto;white-space:nowrap;font-size:11px;font-weight:600;">${lcEscHtml(name)}</span>` +
      `<span class="hint" style="flex:0 0 auto;white-space:nowrap;margin:0;font-size:11px;">${lcEscHtml(count)}</span>` +
      `<span class="hint" style="flex:1;min-width:0;margin:0;font-size:11px;opacity:.72;">${lcEscHtml(note)}</span>` +
      `</div>`
    );
  }

  function renderTagBlockList() {
    const box = $("official-list");
    if (!box) return;
    const f = ensureFilter();
    const tags = lcList("tags");
    const off = lcTags.tags || [];
    /* 头部计数：官方那份没读到就显示「…」，绝不用 0 冒充 ——
     * 黑名单卡 2026-10-23 就因为「失败被渲染成 0 人」误导过作者 */
    $("official-count").textContent =
      "官方 " + (lcTags.state === "ok" ? off.length : "\u2026") + " · 本地 " + tags.length;
    renderFilterFold(); /* 摘要里的标签数随名单走 */
    const toggleBtn = $("official-toggle");
    if (toggleBtn) toggleBtn.textContent = lcOfficialExpanded ? "收起" : "展开";
    if (!lcOfficialExpanded) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
    box.style.display = "";

    let offBody;
    if (lcTags.state === "ok") {
      offBody = off.length
        ? off.map((t, i) => lcTagRowHtml(t, i, true)).join("")
        : `<p class="hint" style="margin:0;">官方名单为空。</p>`;
    } else if (lcTags.state === "loading" || lcTags.state === "idle") {
      offBody = `<p class="hint" style="margin:0;">读取中…</p>`;
    } else {
      offBody =
        `<p class="hint" style="margin:0;">读取失败：${lcEscHtml(lcTags.reason)}。` +
        `<button class="lc-link" data-otag-retry type="button" style="font-size:12px;padding:0 2px;">重试</button></p>`;
    }

    const localBody = tags.length
      ? tags.map((t, i) => lcTagRowHtml(t, i, false)).join("")
      : `<p class="hint" style="margin:0;">${lcListLocked
          ? "暂无。登录后可在这里添加。"
          : "暂无。悬停帖子卡片上的 tag 点「屏蔽」，或在这里输入。"}</p>`;

    /* 两段的差异写在各自的段头上（贴着对象解释，比在顶部写一段话更好读）：
     * 官方「全端生效 · 不随导出」 ↔ 本地「仅此浏览器 · 会随配置导出」 */
    box.innerHTML =
      lcTagSecHead("官方", lcTags.state === "ok" ? off.length + " / 100" : "", "全端生效（含手机 App）· 不随导出") +
      offBody +
      lcTagSecHead("本地", tags.length + " 个", LCUid.label() + " · 仅此浏览器 · 会随导出") +
      localBody;
  }

  async function lcTagAdd() {
    if (lcListLocked) return; /* 未登录时入口已禁用，这里兜住程序化调用 */
    const input = $("official-add-input");
    const btn = $("official-add-btn");
    const name = lcTagNormalize(input.value);
    if (!name) {
      input.value = "";
      input.placeholder = "请输入 tag 名称或 tag 页链接";
      return;
    }
    const low = name.toLowerCase();
    const f = ensureFilter();
    if (lcList("tags").some((t) => String(t).toLowerCase() === low)) {
      lcOfficialToast("tag「" + name + "」已在本地屏蔽名单");
      return;
    }
    /* 写前现读：同时承担「查重（官方侧）」与「满员预检」两个职责。
     * 满员时**不向官方发写**，直接落本地并说明 —— 不自动补位、不改官方名单。 */
    const prev = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "…"; }
    try {
      let cur;
      try {
        cur = await LCOfficialTags.fetchList();
      } catch (e) {
        cur = { ok: false, state: "error", tags: [], reason: String((e && e.message) || e) };
      }
      if (cur.state !== "ok") {
        lcTags.state = cur.state || "error";
        lcTags.reason = lcTagsErrText(cur);
        renderTagBlockList();
        lcOfficialToast("读取官方名单失败：" + lcTags.reason);
        return;
      }
      lcTags.state = "ok";
      lcTags.tags = cur.tags;
      lcTags.at = Date.now();
      if (cur.tags.some((t) => String(t).toLowerCase() === low)) {
        renderTagBlockList();
        lcOfficialToast("tag「" + name + "」已在官方屏蔽名单");
        return;
      }
      if (cur.tags.length >= LCOfficialTags.LIMIT) {
        lcList("tags").push(name);
        renderTagBlockList();
        save();
        lcOfficialToast("官方名单已满，已存为本地屏蔽（仅此浏览器生效）");
        input.value = "";
        return;
      }
      const r = await lcOfficialTagCommit((list) => list.concat([name]), name, 0, cur);
      if (!r.ok) {
        /* 官方写失败**不**在本地兜底：否则会出现「官方没加上、本地加上了」的
         * 不确定态，用户以为全端生效而实际只有本机看得到 */
        lcOfficialToast("加入官方名单失败：" + r.reason + "，请重试");
        return;
      }
      lcOfficialToast("已加入官方屏蔽「" + name + "」（全端生效）");
      input.value = "";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prev || "屏蔽"; }
    }
  }

  /* 官方黑名单镜像到 storage（lc_official_bl_v1）：评论过滤（content.js
   * 任意帧）据此隐藏黑名单成员的评论。popup 能调 DWR，页面帧未必
   * （子域跨域）——所以谁调通谁写镜像，读取方只看存储。 */
  function lcOfficialPersist() {
    try {
      const names = Array.from(
        new Set(
          (lcOfficialList || [])
            .map((u) => String(u.blogName || "").toLowerCase())
            .filter(Boolean),
        ),
      );
      chrome.storage.local.set(
        { lc_official_bl_v1: { names, ts: Date.now() } },
        () => {},
      );
    } catch (e) {}
  }

  async function lcOfficialRefresh(isRetry) {
    if (lcOfficialLoading) return;
    lcOfficialLoading = true;
    lcOfficialErr = null;
    renderOfficialList();
    try {
      const raw = await lcDwr("getBlacklistUserList", [
        "number:200",
        "number:0",
      ]);
      /* 未登录：DWR 不报错，回 `_remoteHandleCallback('batch','0',null)`，
       * LC_dwrParse 解析出来就是 null（curl 实证，test-dwr 有样本）。
       * 登录后的空名单回的是 `[],{}` 一串 ⇒ 解析成空对象 {}，不是 null。 */
      const nullReply = raw === null || raw === undefined;
      if (nullReply) {
        lcOfficialAuth = "login";
        lcOfficialList = [];
        lcOfficialErr = null;
      } else {
        lcOfficialAuth = "ok";
        /* 正常应是条目数组；若服务端包了一层对象，取第一个数组型属性兜底。
         * 另一个实测形态（2026-11-10）：**空名单**回的是 `[],{},{}` 这一串，
         * 解析出来是个**空对象** {} —— 不归一成 [] 的话会被当成「解析失败（异常）」。
         * 三种回执由此分得清：null = 未登录、{} = 名单为空、数组 = 有成员。 */
        let arr = raw;
        if (!Array.isArray(arr) && arr && typeof arr === "object") {
          const cand = Object.values(arr).find((v) => Array.isArray(v));
          if (cand) arr = cand;
          else if (!Object.keys(arr).length) arr = [];
        }
        lcOfficialList = (Array.isArray(arr) ? arr : [])
          .filter((e) => e && typeof e === "object")
          .map((e) => ({
            id: e.id,
            blogId: e.blacklistBlogId,
            blogName: (e.blogInfo && e.blogInfo.blogName) || "",
            nick: (e.blogInfo && e.blogInfo.blogNickName) || "",
            ava: (e.blogInfo && e.blogInfo.bigAvaImg) || "",
            home: (e.blogInfo && e.blogInfo.homePageUrl) || "",
          }));
        if (!lcOfficialList.length && !Array.isArray(arr)) {
          /* 不是 null、也不是数组：回复形态和抓包样本不符（改版？）。
           * 把原始回复片段亮出来方便定位（强制展开列表，收起时看不到） */
          const rawSnap = String(LC_dwrCall.lastRaw || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 260);
          $("official-count").textContent = "0 人（异常）";
          $("official-list").style.display = "";
          $("official-list").innerHTML =
            `<p class="hint" style="margin:0;">接口成功但未解析到成员。原始回复片段：<br><code style="word-break:break-all;font-size:10px;">${lcOfficialEsc(rawSnap) || "(空)"}</code></p>`;
          return;
        }
        /* 数组（可能为空）⇒ 空名单就是真的空，渲染层会写「黑名单为空。」 */
      }
    } catch (err) {
      lcOfficialErr = (err && err.message) || String(err);
      lcOfficialList = [];
    } finally {
      lcOfficialLoading = false;
    }
    /* 真机现象（2026-10-23）：面板一打开就拉，DWR 会话常未就绪 ⇒ 失败；
       用户关掉重开就正常。自动补一次重试兜住这个瞬态（只一次，
       避免未登录场景反复打服务端），之后交给「重试」按钮 */
    if (lcOfficialErr) {
      renderOfficialList();
      if (!isRetry && !lcOfficialRetried) {
        lcOfficialRetried = true;
        setTimeout(() => { lcOfficialRefresh(true).catch(() => {}); }, 1200);
      }
      return;
    }
    lcOfficialRetried = false;
    renderOfficialList();
    /* 未登录时**不清镜像**：退出登录后没人再刷新它，清了评论过滤就跟着失效了 */
    if (lcOfficialAuth !== "login") lcOfficialPersist();
  }

  /* 两段确认（第一次点变成「确认…？」，3 秒内再点才执行）只给两类动作：
   *   ①「拿走」服务端名单里的东西 —— 删 / 降级 / 升格。少了一条不像多了一条
   *     那么显眼，而且手机上会跟着变，撤不回来得再写一次；
   *   ②「对人」—— 拉黑 / 移出拉黑。对象是真人，成员列表又默认收起，拉错了
   *     当场看不见。
   * 只动本机的（本地 tag 增删）和「往里加」一律一键：结果就出现在紧挨着的
   * 列表里，错了点一下「移除」即可，多一次点击只是仪式。 */
  on("official-add-btn", "click", async (e) => {
    if (lcOffMode === "tag") {
      lcTagAdd();
      return;
    }
    const btn = e.currentTarget;
    const name = lcOfficialBlogName($("official-add-input").value);
    if (!name) {
      $("official-add-input").value = "";
      $("official-add-input").placeholder = "请输入有效的 LOFTER 主页链接或 ID";
      return;
    }
    if (btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      btn.textContent = "确认拉黑？";
      setTimeout(() => {
        btn.dataset.confirm = "";
        btn.textContent = "拉黑";
      }, 3000);
      return;
    }
    btn.dataset.confirm = "";
    btn.textContent = "拉黑中…";
    btn.disabled = true;
    try {
      /* 写前现读（与 tag 段同一条规矩）：面板打开时读到的登录态可能已经过期
       * —— 用户可能刚在别处登录/退出，拿旧判断拦人或放行都会错 */
      await lcOfficialRefresh(true);
      if (lcOfficialAuth === "login") {
        lcOfficialToast("拉黑没有生效：请先登录 LOFTER");
        return;
      }
      const entry = await lcDwr("addBlacklist", ["string:" + name, "number:0"]);
      /* 未登录时 addBlacklist **不报错**，而是回一个空壳：
       *   {blacklistBlogId:0, blogInfo:null, createTime:0, id:-1000, userId:0}
       * （2026-11-10 curl 实证）。以前 `entry.id` 为 -1000 也算真值 ⇒ 当成拉黑成功，
       * 列表里多出一条没有头像、昵称退回输入的破图，刷新就没了。
       * 现在以「真条目」为准：id 是正数且带 blogInfo 才算加上了。 */
      const realEntry = !!(entry && Number(entry.id) > 0 && entry.blogInfo);
      if (!realEntry) {
        renderOfficialList();
        lcOfficialToast("拉黑没有生效，请重试");
        return;
      }
      let toastName = name;
      {
        const bi = entry.blogInfo || {};
        toastName = bi.blogNickName || bi.blogName || name;
        lcOfficialList.push({
          id: entry.id,
          blogId: entry.blacklistBlogId,
          blogName: bi.blogName || name,
          nick: bi.blogNickName || name,
          ava: bi.bigAvaImg || "",
          home: bi.homePageUrl || "",
        });
        renderOfficialList();
      }
      /* 绿色「已拉黑 xxx」闪现数秒，方便确认没拉错人；要细看就展开列表 */
      lcOfficialToast("已拉黑 " + toastName);
      lcOfficialPersist();
      $("official-add-input").value = "";
    } catch (err) {
      alert(T("拉黑失败：") + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "拉黑";
    }
  });

  on("official-list", "click", async (e) => {
    /* 失败态的「重试」出口（首次打开面板 DWR 未就绪时用） */
    if (e.target.closest("[data-official-retry]")) {
      lcOfficialRetried = true; /* 手动重试不再自动补刀 */
      lcOfficialRefresh(true).catch(() => {});
      return;
    }
    const tb = e.target.closest("[data-tag-unblock]");
    if (tb) {
      /* 本地名单：可逆、只影响本机 ⇒ 单段确认（现状不变） */
      lcList("tags").splice(+tb.dataset.tagUnblock, 1);
      renderTagBlockList();
      save();
      return;
    }

    /* ---------- 官方「标签屏蔽」段（#39）----------
     * 动的是账号级、全端生效的数据：手机 App 上会立刻消失/出现，
     * 所以删除、降级、升格都过两段确认（照黑名单卡的既有模式）。 */
    const isTagMode = lcOffMode === "tag";

    if (e.target.closest("[data-otag-retry]")) {
      lcTagsRefresh(true).catch(() => {});
      return;
    }

    /* 两段确认的公共前半段：第一次点只把按钮换成「确认…？」 */
    const needConfirm = (btn) => {
      if (btn.dataset.confirm === "1") return false;
      btn.dataset.confirm = "1";
      const label = btn.textContent;
      btn.textContent = "确认？";
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.dataset.confirm = "";
        btn.textContent = label;
      }, 3000);
      return true;
    };

    const demote = e.target.closest("[data-otag-demote]");
    if (demote && isTagMode) {
      const tag = (lcTags.tags || [])[+demote.dataset.otagDemote];
      if (!tag) return;
      if (needConfirm(demote)) return;
      demote.disabled = true;
      demote.textContent = "…";
      /* 一次确认覆盖两件事：官方移除 + 本地加入。顺序不能反 ——
       * 先官方写成功、对账通过，才动本地，否则失败时会出现「两边都不在」。 */
      const r = await lcOfficialTagCommit(
        (list) => list.filter((t) => String(t).toLowerCase() !== tag.toLowerCase()),
        tag,
        1,
      );
      if (!r.ok) {
        lcOfficialToast("移出官方失败：" + r.reason + "，请重试");
        return;
      }
      const f = ensureFilter();
      if (!lcList("tags").some((t) => String(t).toLowerCase() === tag.toLowerCase())) {
        lcList("tags").push(tag);
        save();
      }
      renderTagBlockList();
      lcOfficialToast("已把「" + tag + "」移出官方，转为本地屏蔽（仅此浏览器生效）");
      return;
    }

    const unblk = e.target.closest("[data-otag-unblk]");
    if (unblk && isTagMode) {
      const tag = (lcTags.tags || [])[+unblk.dataset.otagUnblk];
      if (!tag) return;
      if (needConfirm(unblk)) return;
      unblk.disabled = true;
      unblk.textContent = "…";
      const r = await lcOfficialTagCommit(
        (list) => list.filter((t) => String(t).toLowerCase() !== tag.toLowerCase()),
        tag,
        1,
      );
      lcOfficialToast(r.ok ? "已移除官方屏蔽「" + tag + "」" : "移除失败：" + r.reason + "，请重试");
      return;
    }

    const promote = e.target.closest("[data-tag-promote]");
    if (promote && isTagMode) {
      const f = ensureFilter();
      const tag = lcList("tags")[+promote.dataset.tagPromote];
      if (!tag) return;
      /* 先确认、再读、再写：确认态会停 3 秒，此时读到的名单在用户点确认时
       * 可能已经变了 ⇒ 读必须紧挨着写（硬规矩「写前现读」的字面含义）。 */
      if (needConfirm(promote)) return;
      promote.disabled = true;
      promote.textContent = "…";
      /* 现读同时承担三件事：判满员、查重（官方可能已被另一端点加过）、算 param0 */
      const cur = await LCOfficialTags.fetchList();
      if (cur.state !== "ok") {
        lcTags.state = cur.state || "error";
        lcTags.reason = lcTagsErrText(cur);
        renderTagBlockList();
        lcOfficialToast("读取官方名单失败：" + lcTags.reason);
        return;
      }
      lcTags.state = "ok";
      lcTags.tags = cur.tags;
      lcTags.at = Date.now();
      if (cur.tags.some((t) => String(t).toLowerCase() === tag.toLowerCase())) {
        /* 官方已经有了：本地这条是重复的，直接收掉（方向是"减少"，不用再确认一次） */
        const k = lcList("tags").findIndex((t) => String(t).toLowerCase() === tag.toLowerCase());
        if (k >= 0) lcList("tags").splice(k, 1);
        save();
        renderTagBlockList();
        lcOfficialToast("官方名单里已有「" + tag + "」，已去掉本地这条");
        return;
      }
      if (cur.tags.length >= LCOfficialTags.LIMIT) {
        /* 满员不自动补位（方案稿底线）：要让用户自己决定换掉哪一条 */
        renderTagBlockList();
        lcOfficialToast("官方名单已满 100 个，请先在官方段移除一条再升格");
        return;
      }
      const r = await lcOfficialTagCommit((list) => list.concat([tag]), tag, 0, cur);
      if (!r.ok) {
        renderTagBlockList();
        lcOfficialToast("升格失败：" + r.reason + "，请重试");
        return;
      }
      const k = lcList("tags").findIndex((t) => String(t).toLowerCase() === tag.toLowerCase());
      if (k >= 0) lcList("tags").splice(k, 1);
      save();
      renderTagBlockList();
      lcOfficialToast("已把「" + tag + "」升到官方（全端生效）");
      return;
    }

    const b = e.target.closest("[data-official-unblk]");
    if (!b) return;
    if (b.dataset.confirm !== "1") {
      b.dataset.confirm = "1";
      b.textContent = "确认移除？";
      setTimeout(() => {
        b.dataset.confirm = "";
        b.textContent = "移除";
      }, 3000);
      return;
    }
    const u = lcOfficialList[+b.dataset.officialUnblk];
    if (!u) return;
    b.textContent = "…";
    b.disabled = true;
    try {
      await lcDwr("removeBlacklist", ["number:" + u.id]);
      lcOfficialList = lcOfficialList.filter((x) => x.id !== u.id);
      renderOfficialList();
      lcOfficialPersist();
    } catch (err) {
      alert(T("移除失败：") + err.message);
      b.disabled = false;
      b.textContent = "移除";
    }
  });

  on("official-comments", "change", (e) => {
    if (!state.official) state.official = LC_clone(LC_DEFAULTS.official);
    state.official.hideInComments = e.target.checked;
    save();
  });

  /* 打开面板即拉取一次官方黑名单（轻量 XHR，读失败不影响其它功能） */
  lcOfficialRefresh().catch(() => {});

  on("gtotop-file-btn", "click", () => $("gtotop-file").click());
  on("gtotop-file", "change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const prev = state.gtotop.imageDataUrl;
    try {
      const ref = await lcIngest(f, "img", { maxW: 200, maxH: 200, quality: 0.85 });
      state.gtotop.imageDataUrl = ref;
      if (prev !== ref) lcDropRef(prev);
      $("gtotop-preview").src = pvOf(ref);
      $("gtotop-preview").style.display = "block";
      syncGtotopSize();
      save();
    } catch (err) { lcAssetFail(err); }
  });
  on("gtotop-clear", "click", () => {
    lcDropRef(state.gtotop.imageDataUrl);
    state.gtotop.imageDataUrl = "";
    $("gtotop-preview").src = "";
    $("gtotop-preview").style.display = "none";
    syncGtotopSize();
    save();
  });

  /* ---------- 装饰物 ---------- */
  on("dec-file-btn", "click", () => $("dec-file").click());
  on("dec-file", "change", async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    for (const f of files) {
      let ref;
      try {
        ref = await lcIngest(f, "img", { maxW: 800, maxH: 800, quality: 0.85 });
      } catch (err) { lcAssetFail(err); continue; }
      if (!state.decorations) state.decorations = [];
      state.decorations.push({
        id: 'dec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        dataUrl: ref,
        width: 20,
        x: 5,
        y: 50,
        zIndex: 0,
        opacity: 100,
        enabled: true,
        interactive: {
          enabled: false,
          particles: false,
          emojis: ["✨"],
          sound: false,

          // ===== 音效设置（新增完整字段）=====
          soundPreset: 'pop',        // 'pop' | 'ding' | 'puff' | 'meow' | 'dong' | 'double' | 'custom'
          soundFile: '',             // 自定义音频 data URL
          soundFileName: '',         // 自定义音频文件名（显示用）

          // 呼吸动画
          /* 默认关闭：新上传的贴图完全静止，要不要浮动、要不要互动由用户自己开。
             总开关（enabled）开着时面板会默认给「浮动」，所以这里的 false 只影响
             尚未开过互动的图，不会把新图点亮 */
          breathe: false,
          breatheMode: 'float',
          breatheAmplitude: 30,
          breatheSpeed: 'normal',

          // 挤压效果（已有）
          squeeze: true,
          squeezeStrength: 15,
          bounceStyle: 'elastic',

          // 词卡弹窗（已有）
          dialogue: false,
          dialogues: [],
          dialogueDuration: 3,
          dialogueStack: 1,
        },
      });
    }
    $("dec-file").value = "";
    renderDecorations();
    save();
  });

  on("gtotop-size", "input", (e) => {
    state.gtotop.imageSize = +e.target.value;
    $("gtotop-size-v").textContent = e.target.value + "%";
    save();
  });

  /* ============================================================
   * 数据栏：配置导入导出
   * 免权限方案——导出用 Blob + <a download>（不申请 downloads 权限），
   * 导入用 <input type="file"> + FileReader，全程本地、无网络请求。
   * 模块划分与面板一级栏目一致，便于"只恢复被我改坏的那一栏"。
   * ============================================================ */
  const LC_MODULES = [
    /* enabled（美化总开关）随「显示」走：它是整站观感的总闸 */
    { id: "display", label: "显示", keys: ["darkMode", "background", "font", "theme", "enabled"] },
    { id: "deco", label: "装饰", keys: ["decorations", "decorationsVisible"] },
    { id: "card", label: "卡片", keys: ["card", "tidy"] },
    /* sidebar（右侧栏玻璃）UI 在导航栏 pane 里，comment（评论区增强）
       UI 在功能 pane 里——两个键必须登记在对应模块下，否则导入时
       会被白名单当脏数据剔除（20260926 用户导入实测丢右侧栏磨砂） */
    { id: "nav", label: "导航", keys: ["navbar", "sidebar", "searchPlaceholder", "gtotop"] },
    { id: "func", label: "功能", keys: ["tools", "filter", "official", "comment", "draft", "msg"] },
  /* export（文章导出）单独一段：顶层配置键，漏登记 = 导入被白名单静默剔除
     （1.4.0 sidebar/comment 的教训） */
  { id: "export", label: "导出", keys: ["export"] },
    /* 表情：自定义表情包存在独立存储键（不在 lc_settings_v1 里），
     * 用 raw 声明要一起带走的原始 storage 键——用户一条条攒出来的
     * 资产，换机/重装必须能带走 */
    { id: "emoji", label: "表情", keys: [], raw: ["lc_emoji_v1"] },
    { id: "misc", label: "其他", keys: ["shortcutsEnabled", "panel"] },
  ];
  const LC_RAW_KEYS = LC_MODULES.flatMap((m) => m.raw || []);
  /* 允许写入 storage 的键白名单：导入时剔除非本扩展的键，避免脏数据进配置 */
  const LC_KNOWN_KEYS = new Set(
    LC_MODULES.flatMap((m) => m.keys).concat(LC_RAW_KEYS),
  );
  /* 原始键的本地副本：打开面板时读一次，导出直接取、导入后回写缓存 */
  let lcRawCache = {};

  function cfgDate() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function cfgDownload(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* 从当前 state 里挑出指定模块的键；mods 为 null 表示整份快照。
     原始键（自定义表情）来自 lcRawCache，与 settings 一起装进 data */
  function cfgPick(mods) {
    const data = {};
    if (!mods) {
      Object.assign(data, LC_clone(state), LC_clone(lcRawCache));
      return data;
    }
    mods.forEach((id) => {
      const m = LC_MODULES.find((x) => x.id === id);
      if (!m) return;
      m.keys.forEach((k) => {
        if (state[k] !== undefined) data[k] = LC_clone(state[k]);
      });
      (m.raw || []).forEach((k) => {
        if (lcRawCache[k] !== undefined) data[k] = LC_clone(lcRawCache[k]);
      });
    });
    return data;
  }

  /* ---------- #20 B3：素材引用收集 + 导出隐私（A+B 合体）+ _format:2 ---------- */
  /* 递归收集 lcidb: 引用的槽位（host/key 可写回，导入换 id 用）。
     口径与 lcIdbMigrate 的 walk 一致：数组逐项、深度有界 */
  function lcAssetRefSlots(v, out, depth) {
    out = out || [];
    if (!v || typeof v !== "object" || depth > 10) return out;
    for (const k of Object.keys(v)) {
      const val = v[k];
      if (typeof val === "string" && LC_ASSETS && LC_ASSETS.isRef(val)) {
        out.push({ host: v, key: k, ref: val, id: LC_ASSETS.idOf(val) });
      } else if (val && typeof val === "object") {
        lcAssetRefSlots(val, out, depth + 1);
      }
    }
    return out;
  }

  /* A+B 合体（作者 2026-10-23 拍板）：所选范围含屏蔽名单且名单非空才弹窗。
     filter 在「功能」模块 keys 里；mods=null = 全选。平时零打扰。 */
  function lcExportPrivacy(st, mods) {
    const hits = !mods || mods.indexOf("func") >= 0;
    if (!hits || !st || !st.filter) return null;
    const f = st.filter;
    const n = (a) => (Array.isArray(a) ? a.length : 0);
    const mine = {
      keywords: n(LCUid.list(f, "keywords")),
      users: n(LCUid.list(f, "users")),
      tags: n(LCUid.list(f, "tags")),
    };
    /* 名单是分账号存的 ⇒ 导出得说清「导谁的」。别的账号还有东西时
     * 才多给一个「所有账号」选项，否则那只是噪音。 */
    const keep = LCUid.uid() || LCUid.ANON;
    const all = LCUid.buckets(f);
    let other = 0;
    Object.keys(all).forEach((k) => {
      if (k === keep) return;
      const b = all[k] || {};
      other += n(b.keywords) + n(b.users) + n(b.tags);
    });
    if (!mine.keywords && !mine.users && !mine.tags && !other) return null;
    return {
      keywords: mine.keywords,
      users: mine.users,
      tags: mine.tags,
      other: other,
      who: LCUid.blogName() || LCUid.uid(),
    };
  }
  /* 按选择剔名单：只动导出副本，绝不碰 state。
   *   mine  —— 只留当前账号那个桶（自己换机；别的账号的名单不属于这台新机器？其实属于，
   *            但默认少带 = 少泄露，要全带就选 all）
   *   all   —— 桶原样带走（整机迁移；文件别外发）
   *   share —— 桶全清空，开关结构保留（导入方设置项完整，看不到你屏蔽了谁） */
  function lcStripFilterLists(data, mode) {
    const f = data && data.filter;
    if (!f || typeof f !== "object") return 0;
    const n = (a) => (Array.isArray(a) ? a.length : 0);
    let moved = 0;
    /* 老平铺数组（迁移前的包）：先清掉，免得下游 LC_merge 又把它当名单 */
    ["keywords", "users", "tags"].forEach((k) => {
      if (Array.isArray(f[k])) { moved += f[k].length; delete f[k]; }
    });
    const bs = LCUid.buckets(f);
    const sizeOf = (b) => n(b && b.keywords) + n(b && b.users) + n(b && b.tags);
    if (mode === "share") {
      Object.keys(bs).forEach((k) => { moved += sizeOf(bs[k]); });
      f.buckets = {};
      return moved;
    }
    if (mode === "mine") {
      const keep = LCUid.uid() || LCUid.ANON;
      Object.keys(bs).forEach((k) => {
        if (k === keep) return;
        moved += sizeOf(bs[k]);
        delete bs[k];
      });
    }
    return moved;
  }
  /* 导入时把「文件里没提到的账号」的名单留下来。
   * 为什么需要：整份导入是 LC_merge(LC_DEFAULTS, data) —— 基准是默认值，
   * 于是 filter.buckets 被文件里那份整体替换；而分享包（不含名单）buckets 是全空，
   * 收件人自己的名单会被静默清掉。桶按账号键合并：文件里有的账号以文件为准
   * （那才是迁移/恢复要的效果），文件里没有的账号原样保留。 */
  function lcMergeBuckets(before, after) {
    if (!before || !after || typeof before !== "object") return 0;
    const bs = LCUid.buckets(after);
    let kept = 0;
    Object.keys(before).forEach((k) => {
      if (bs[k]) return;
      bs[k] = before[k];
      kept++;
    });
    return kept;
  }
  function askExportPrivacy(p) {
    return new Promise((resolve) => {
      const ov = $("lc-export-privacy-overlay");
      const head = p.who ? `当前账号「${p.who}」` : "当前账号（未登录）";
      const parts = [];
      if (p.keywords) parts.push(`关键词 ${p.keywords}`);
      if (p.users) parts.push(`用户 ${p.users}`);
      if (p.tags) parts.push(`标签 ${p.tags}`);
      $("lc-export-privacy-desc").textContent =
        `${head}：屏蔽${parts.join("、")} 个。` +
        (p.other ? `另有别的账号共 ${p.other} 条。` : "") +
        "自己换机选「当前账号」，发给别人选「不含名单」（只剔名单，其余设置不动）。";
      const allBtn = $("lc-export-privacy-all");
      if (allBtn) allBtn.style.display = p.other ? "" : "none";
      const done = (v) => { ov.style.display = "none"; resolve(v); };
      $("lc-export-privacy-keep").onclick = () => done("mine");
      if (allBtn) allBtn.onclick = () => done("all");
      $("lc-export-privacy-share").onclick = () => done("share");
      $("lc-export-privacy-cancel").onclick = () => done(null);
      ov.onclick = (e) => { if (e.target === ov) done(null); };
      ov.style.display = "flex";
    });
  }

  /* 导出：把引用对应的本体读出来内嵌（_assets，顶层）。断链计入 broken */
  async function lcExportAssets(slots) {
    const assets = {};
    let broken = 0;
    for (const s of slots) {
      if (assets[s.id]) continue;
      try {
        const rec = await LC_ASSETS.getRecord(s.id);
        if (!rec || !rec.blob) { broken++; continue; }
        const ab = await rec.blob.arrayBuffer();
        assets[s.id] = {
          b64: LC_ASSETS.bytesToB64(new Uint8Array(ab)),
          type: rec.type || rec.blob.type || "",
        };
      } catch (e) { broken++; }
    }
    return { assets: assets, broken: broken };
  }

  /* 写入前比对：库里已有同 id 记录 ⇒ 内容一样就**不写**。
     为什么不能只靠覆盖写：IDB 的 put 是「追加新副本 + 旧副本变待回收空间」，
     同 id 覆盖 10 轮记录数恒为 3、估用却涨到 10 × 单轮（probe-idb-churn 真机实测）。
     跳过写入才是真幂等 —— 恢复备份、清空重装这类高频操作才不会越导越大。
     成本控制：先看 listMeta 的 size（库里没这条就不读盘），size 对上才读旧字节逐字节比。 */
  async function lcSameAssetBytes(id, bytes) {
    const rec = await LC_ASSETS.getRecord(id);
    if (!rec || !rec.blob || rec.blob.size !== bytes.length) return false;
    let cur;
    try { cur = new Uint8Array(await rec.blob.arrayBuffer()); } catch (e) { return false; }
    if (cur.length !== bytes.length) return false;
    for (let i = 0; i < bytes.length; i++) { if (cur[i] !== bytes[i]) return false; }
    return true;
  }

  /* 导入：_assets 写进本地素材库。
     ⚠ 2026-10-24 真机走查修：旧实现「库里已有同 id ⇒ 换新 id 写入」在**重复导入同一文件**时
     会把每一轮的旧记录留成孤儿（实测导 6 次堆了 18 条 / 约 7.5MB，probe-idb-verify 的 orphans 列出）。
     id 由本扩展生成（时间戳 + 随机后缀），不同素材撞 id 概率≈0 ⇒ 库里已有同 id 就是同一份素材，
     直接**覆盖写**：重复导入幂等、零孤儿、引用不必重写（少一次 remap）。
     断链（_assets 没给本体）仍计入 fail，引用保持原样由用户重新上传。 */
  async function lcImportAssets(data, assets) {
    const out = { ok: 0, skip: 0, fail: 0 };
    if (!assets || typeof assets !== "object") return out;
    const slots = lcAssetRefSlots(data);
    const done = {}; /* 同一 id 多个引用只写一次库 */
    /* size 索引：只用来决定「要不要白读一遍旧字节」，读不到就退回全写（不影响正确性） */
    let sizeById = null;
    try {
      if (LC_ASSETS && LC_ASSETS.listMeta) {
        sizeById = new Map((await LC_ASSETS.listMeta()).map((m) => [m.id, Number(m.size) || 0]));
      }
    } catch (e) { sizeById = null; }
    for (const s of slots) {
      if (done[s.id]) continue;
      done[s.id] = 1;
      const a = assets[s.id];
      if (!a || typeof a.b64 !== "string") { out.fail++; continue; }
      try {
        const bytes = LC_ASSETS.b64ToBytes(a.b64);
        if (sizeById && sizeById.get(s.id) === bytes.length &&
            await lcSameAssetBytes(s.id, bytes)) { out.skip++; continue; }
        const blob = new Blob([bytes], { type: a.type || "application/octet-stream" });
        await LC_ASSETS.putBlob(s.id, blob, { type: blob.type, size: blob.size });
        out.ok++;
      } catch (e) { out.fail++; }
    }
    return out;
  }

  /* 导入 / 迁移后统一刷新。settings 整份换掉 ⇒ 不只是主区：
     · render() 含装饰列表与屏蔽用户列表，但**不含**本地 tag 计数、不含素材预览
     · renderTagBlockList() 负责「屏蔽 tag（本地）」的 N 个（漏了就是「显示 1，展开变 0」）
     · warmPreviewAssets() 必须补：导入进来的都是 lcidb: 引用，本页还没建 objectURL
       ⇒ 不补则背景/装饰缩略图全空（2026-10-24 真机走查抓到的两处） */
  function lcRefreshAll() {
    render();
    initRanges();
    syncCfgMods();
    renderTagBlockList();
    warmPreviewAssets(state);
  }

  /* ─────────── 导入前快照（覆盖式导入的唯一后路） ───────────
     为什么要它：导入是整份覆盖，用户事后想回到导入前只能靠「自己提前导出过」——
     而意识到风险、找到导出按钮、存好文件这三步任何一步没做就来不及了。
     这里改成插件自动存（只有 1~2 KB，大件都是以 lcidb: 引用记的），用户什么都不用准备。
     它成立的前提是「孤儿不自动清」：素材还在库里，所以还原设置就能完整还原画面。 */
  function lcFmtWhen(ms) {
    const d = new Date(Number(ms) || 0);
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    return (d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  /* 展开/收起：默认收起。折叠时把里面设 inert —— 0 高度的按钮仍能被 Tab 聚焦，
     用户按 Tab 会跳到看不见的地方。auto 属性赋值在老大内核上也不报错。 */
  function lcSetPreImportOpen(open) {
    const pill = $("lc-prev-cfg-pill"), body = $("lc-prev-cfg-body");
    if (!pill || !body) return;
    body.classList.toggle("closed", !open);
    pill.setAttribute("aria-expanded", open ? "true" : "false");
    try {
      body.inert = !open;
    } catch (e) {}
  }

  function lcTogglePreImport() {
    const pill = $("lc-prev-cfg-pill");
    if (!pill) return;
    lcSetPreImportOpen(pill.getAttribute("aria-expanded") !== "true");
  }

  /* 方案 C（2026-11-02）：平时只在「导入配置…」后面挂一枚「有备份」胶囊。
     为什么不常驻一块提示条：备份是低频用的撤销点，常驻约 72px 会一直挤在
     导入按钮下面，字号也压不过周围的实心按钮（作者反馈）。
     但也不能只留一个图标——胶囊写着「有备份」，用户扫一眼就知道这里能反悔。 */
  function lcRenderPreImportRow(bak) {
    const pill = $("lc-prev-cfg-pill"), tip = $("lc-prev-cfg-tip"), body = $("lc-prev-cfg-body");
    if (!pill || !tip || !body) return;
    if (!bak || !bak.state) {
      pill.style.display = "none";
      body.style.display = "none";
      tip.textContent = "";
      lcSetPreImportOpen(false);
      return;
    }
    tip.textContent = T(`导入前的配置 · ${lcFmtWhen(bak.at)}`);
    /* 先放回 DOM 但保持 closed（0fr 高度）：新出现的备份不该自己弹开，
       那样等于把常驻条又还回去了，只是晚了一步 */
    if (body.style.display === "none") lcSetPreImportOpen(false);
    body.style.display = "";
    pill.style.display = "";
  }

  /* 还原：写回快照 → 一次性删除（它是「撤销」，不是长期备份；留着会与当前配置混淆）。
     断链要提前说：素材若被「清理」过，还原后那些图不显示 —— 用户有权在知情下选择还原。 */
  async function lcRestorePreImport() {
    const btn = $("lc-prev-cfg-restore");
    if (btn) btn.disabled = true;
    try {
      const bak = await new Promise((res) => {
        try {
          chrome.storage.local.get([LC_PREIMPORT_KEY], (r) => res(r && r[LC_PREIMPORT_KEY]));
        } catch (e) { res(null); }
      });
      if (!bak || !bak.state) { lcRenderPreImportRow(null); return; }
      let missing = 0;
      try {
        if (LC_ASSETS && LC_ASSETS.listMeta) {
          const have = new Set((await LC_ASSETS.listMeta()).map((m) => m.id));
          new Set(lcAssetRefSlots(bak.state).map((s) => s.id))
            .forEach((id) => { if (!have.has(id)) missing++; });
        }
      } catch (e) { missing = 0; }
      const ok = confirm(
        T(`将还原到 ${lcFmtWhen(bak.at)} 的配置。导入之后你改过的设置会一起回退。`) +
        (missing
          ? "\n\n" + T(`其中 ${missing} 件图片/音频已不在素材库里，还原后这几处会显示不出来。`)
          : "") +
        "\n\n" + T("还原后这条备份会被清除。"),
      );
      if (!ok) return;
      state = LC_migrateNav(LC_clone(bak.state));
      lcRefreshAll();
      save();
      chrome.storage.local.remove(LC_PREIMPORT_KEY);
      lcRenderPreImportRow(null);
      alert(T("已还原到导入前的配置。刷新 LOFTER 页面后生效。"));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* 丢弃备份：用户明确表示不再需要这个「撤销点」。
     它和「还原」是互斥的两个出口 —— 还原会消费掉备份，丢弃直接删掉，两者之后整块都消失 */
  async function lcDropPreImport() {
    const btn = $("lc-prev-cfg-drop");
    if (btn) btn.disabled = true;
    try {
      const yes = confirm(
        T("删除这份导入前的配置备份？") + "\n\n" +
        T("删除后就不能再还原到导入前的设置了。当前设置和素材都不受影响。"),
      );
      if (!yes) return;
      chrome.storage.local.remove(LC_PREIMPORT_KEY);
      lcRenderPreImportRow(null);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* 素材库对账：把 IDB 记录分成「settings 还引用着」与「没人引用」两组。
     为什么要分：usageReport 的 count/bytes 是 **IDB 全表**，孤儿（导入换 id / 删除音效
     只清引用留下的死记录）会被算成用户的素材 —— 真机实测面板显示 9.10 MB · 23 件，
     而 settings 实际只引用 3 件 1.25 MB。用户看到的是一个他并不拥有的数字。 */
  async function lcIdbScan() {
    const metas = await LC_ASSETS.listMeta();
    const refIds = new Set(lcAssetRefSlots(state).map((s) => s.id));
    const sum = (arr) => arr.reduce((a, r) => a + (Number(r.size) || 0), 0);
    const live = metas.filter((m) => refIds.has(m.id));
    const dead = metas.filter((m) => !refIds.has(m.id));
    return { metas, live, dead, liveBytes: sum(live), deadBytes: sum(dead) };
  }

  /* 面板素材行（2026-11-02 作者拍板 B 方案）：只报「用户实际拥有的素材」，
     不再报 estimate 的槽位。三点理由，都是真机实测换来的：
       ① 槽位是浏览器记账（delete 只标记，由 Chrome 择机回收），插件与用户都动不了
       ② 它会自己回落 —— 实测清理后 17.63 MB 在三小时内回到 9.78 MB，不是待办事项
       ③ 「占槽」是内部黑话；用户看到「占槽 39.8 MB vs 素材 1.25 MB」只会以为插件屯垃圾
     孤儿条数（「另 N 件未使用」）保留：那是用户能处理、也确实该处理的唯一数字。
     scan 缺省时退回全表口径（LC_ASSETS.listMeta 不可用的降级路径） */
  function lcUsageIdbRow(rep, scan) {
    const rep0 = rep || {};
    const s = scan || {};
    const hasScan = Array.isArray(s.live);
    const live = hasScan ? (Number(s.liveBytes) || 0) : (Number(rep0.bytes) || 0);
    const liveN = hasScan ? s.live.length : (Number(rep0.count) || 0);
    const deadN = hasScan ? s.dead.length : 0;
    return {
      label: "图片与音频",
      main: liveN ? lcFmtBytes(live) + " · " + liveN + " 件" : "0 B",
      note: deadN
        ? T(`另 ${deadN} 件未使用`)
        /* 空库时别留一个孤零零的 0 B —— 新装用户看到这句才知道这里本来就该是空的 */
        : liveN ? "" : T("还没有图片或音频素材"),
      deadN: deadN,
      deadBytes: hasScan ? (Number(s.deadBytes) || 0) : 0,
    };
  }

  async function cfgExport(mods, decoIds) {
    const picked = cfgPick(mods);
    /* 按张分享：只保留勾选的装饰图（decorationsVisible 不受影响） */
    if (decoIds && Array.isArray(picked.decorations)) {
      picked.decorations = picked.decorations.filter((d) => decoIds.includes(d.id));
    }
    /* A+B 合体：所选范围含非空屏蔽名单 → 三选一弹窗（平时不弹零打扰）。
       分享模式剔的是导出副本，不动 state */
    const priv = lcExportPrivacy(state, mods);
    if (priv) {
      const v = await askExportPrivacy(priv);
      if (v === null) return;
      if (v !== "all") lcStripFilterLists(picked, v);
    }
    /* _format:2：lcidb: 引用对应的本体读出来内嵌进顶层 _assets */
    let assets = null, broken = 0;
    if (LC_ASSETS && LC_ASSETS.isSupported()) {
      const slots = lcAssetRefSlots(picked);
      if (slots.length) {
        const r = await lcExportAssets(slots);
        if (Object.keys(r.assets).length) assets = r.assets;
        broken = r.broken;
      }
    }
    cfgDownload(
      `lofter-customizer-settings-${mods ? "part" : "all"}-${cfgDate()}.json`,
      {
        _type: "lofter-customizer-settings",
        _format: 2,
        _app: chrome.runtime.getManifest().version,
        _exportedAt: new Date().toISOString(),
        _modules: mods || "all",
        ...(assets ? { _assets: assets } : {}),
        data: picked,
      },
    );
    if (broken) {
      alert(T("注意：有 ") + broken +
        T(" 个素材引用找不到本体（可能来自别的设备），这些图导入后会缺失，可在原设备重新导出或在本机重新上传。"));
    }
  }

  /* 数据栏：模块勾选 → 导出按钮文案/可用态 + 已选计数
     全选=「导出全部」，部分=「导出 N 个模块」，全不选=置灰 */
  let cfgDecoPick = null; // null=全部；数组=勾选的装饰图 id（按张分享）
  function syncCfgMods() {
    const inputs = [...$("cfg-modules").querySelectorAll("input[data-mod]")];
    const n = inputs.filter((i) => i.checked).length;
    const btn = $("cfg-export-part");
    const count = $("cfg-mod-count");
    const tip = $("cfg-export-tip");
    if (count) count.textContent = `已选 ${n}/${inputs.length}`;
    if (!btn) return;
    if (n === 0) {
      btn.textContent = "导出模块";
      btn.disabled = true;
    } else if (n === inputs.length) {
      btn.textContent = "导出全部";
      btn.disabled = false;
    } else {
      btn.textContent = `导出 ${n} 个模块`;
      btn.disabled = false;
    }
    /* 快捷链接取代静态提示：指向「你没在的那个极端」——
       全选态=全不选，部分=全不选·全选，全不选态=全选 */
    if (tip) {
      tip.innerHTML = "";
      const mk = (label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "lc-link";
        b.textContent = label;
        return b;
      };
      if (n === 0) {
        tip.appendChild(mk("全选"));
      } else if (n === inputs.length) {
        tip.appendChild(mk("全不选"));
      } else {
        tip.appendChild(mk("全不选"));
        const sep = document.createElement("span");
        sep.textContent = "·";
        sep.style.color = "var(--lc-line)";
        tip.appendChild(sep);
        tip.appendChild(mk("全选"));
      }
    }
    /* 「装饰」勾选且有装饰图时，显示按张选择入口 */
    const pickRow = $("cfg-deco-pick-row");
    if (pickRow) {
      const decoChecked = inputs.some((i) => i.dataset.mod === "deco" && i.checked);
      pickRow.style.display = decoChecked && (state.decorations || []).length ? "" : "none";
    }
    syncDecoPickLink();
  }
  $("cfg-modules").addEventListener("change", syncCfgMods);
  /* 全不选/全选快捷链接（点击时按文案决定目标状态） */
  $("cfg-export-tip").addEventListener("click", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("lc-link")) return;
    const val = t.textContent === "全不选" ? false : true;
    [...$("cfg-modules").querySelectorAll("input[data-mod]")].forEach((i) => {
      i.checked = val;
    });
    syncCfgMods();
  });
  syncCfgMods();

  /* ---------- 装饰图按张导出选择 ---------- */
  function syncDecoPickLink() {
    const link = $("cfg-deco-pick");
    if (!link) return;
    const total = (state.decorations || []).length;
    link.textContent = cfgDecoPick ? `已选 ${cfgDecoPick.length}/${total} 张 ›` : "全部 ›";
  }

  function decoShareLabel(d, i) {
    const ia = d.interactive || {};
    const tags = [];
    if (Array.isArray(ia.dialogues) && ia.dialogues.length) tags.push("词卡×" + ia.dialogues.length);
    if (ia.particles) tags.push("粒子");
    if (ia.sound) tags.push("音效");
    return `装饰 #${i + 1}` + (tags.length ? " · " + tags.join("·") : "");
  }

  function syncDecoPickCount() {
    const boxes = [...$("deco-pick-modal-list").querySelectorAll("input")];
    const n = boxes.filter((b) => b.checked).length;
    $("deco-pick-count").textContent = `已选 ${n}/${boxes.length}`;
    $("deco-pick-done").disabled = n === 0;
  }

  function openDecoPickModal() {
    const list = $("deco-pick-modal-list");
    list.innerHTML = "";
    (state.decorations || []).forEach((d, i) => {
      const lab = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.decId = d.id;
      cb.checked = cfgDecoPick ? cfgDecoPick.includes(d.id) : true;
      const img = document.createElement("img");
      img.setAttribute("data-lc-pv", d.dataUrl || ""); /* 解析完成后只替 src，不重建列表 */
      img.src = pvOf(d.dataUrl);
      img.alt = "";
      const span = document.createElement("span");
      span.textContent = decoShareLabel(d, i);
      lab.append(cb, img, span);
      list.appendChild(lab);
    });
    syncDecoPickCount();
    $("deco-pick-modal-overlay").style.display = "flex";
  }

  on("cfg-deco-pick", "click", openDecoPickModal);
  on("deco-pick-modal-close", "click", () => $("deco-pick-modal-overlay").style.display = "none");
  on("deco-pick-all", "click", () => {
    $("deco-pick-modal-list").querySelectorAll("input").forEach((b) => { b.checked = true; });
    syncDecoPickCount();
  });
  on("deco-pick-none", "click", () => {
    $("deco-pick-modal-list").querySelectorAll("input").forEach((b) => { b.checked = false; });
    syncDecoPickCount();
  });
  on("deco-pick-modal-list", "change", syncDecoPickCount);
  on("deco-pick-done", "click", () => {
    const boxes = [...$("deco-pick-modal-list").querySelectorAll("input")];
    const ids = boxes.filter((b) => b.checked).map((b) => b.dataset.decId);
    cfgDecoPick = ids.length === boxes.length ? null : ids; // 全勾=回到「全部」，导出文件不带多余过滤
    syncDecoPickLink();
    $("deco-pick-modal-overlay").style.display = "none";
  });
  on("deco-pick-modal-overlay", "click", (e) => {
    if (e.target === $("deco-pick-modal-overlay")) $("deco-pick-modal-overlay").style.display = "none";
  });

  /* ---------- 装饰图导入方式弹窗（覆盖 / 追加） ---------- */
  function askDecoImportMode(incoming, current) {
    return new Promise((resolve) => {
      const ov = $("deco-import-modal-overlay");
      $("deco-import-modal-desc").textContent =
        `导入的配置包含 ${incoming} 张装饰图，你当前已有 ${current} 张。选择怎么处理：`;
      const done = (v) => { ov.style.display = "none"; resolve(v); };
      $("deco-import-append").onclick = () => done("append");
      $("deco-import-override").onclick = () => done("override");
      $("deco-import-cancel").onclick = () => done(null);
      ov.onclick = (e) => { if (e.target === ov) done(null); };
      ov.style.display = "flex";
    });
  }

  on("cfg-export-part", "click", () => {
    const inputs = [...$("cfg-modules").querySelectorAll("input[data-mod]")];
    const mods = inputs.filter((i) => i.checked).map((i) => i.dataset.mod);
    if (!mods.length) {
      alert(T("请先勾选至少一个模块。"));
      return;
    }
    const allSel = mods.length === inputs.length;
    /* 勾了「装饰」且做了按张选择 → 即使全选也不走整份快照（要保留过滤） */
    const decoIds =
      mods.includes("deco") && Array.isArray(cfgDecoPick) ? cfgDecoPick : null;
    /* 全选时走整份快照导出（文件名带 -all，_modules 记为 "all"） */
    cfgExport(allSel && !decoIds ? null : mods, decoIds);
  });

  on("cfg-import", "click", () => $("cfg-import-file").click());
  on("lc-prev-cfg-restore", "click", lcRestorePreImport);
  on("lc-prev-cfg-drop", "click", lcDropPreImport);
  /* 胶囊是 span（要跟按钮排在一行又不抢按钮的体量）⇒ 键盘得自己补 */
  on("lc-prev-cfg-pill", "click", lcTogglePreImport);
  on("lc-prev-cfg-pill", "keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      lcTogglePreImport();
    }
  });

  on("cfg-import-file", "change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // 清空，便于连续两次选同一个文件
    if (!f) return;

    let raw = null;
    try {
      raw = JSON.parse(await f.text());
    } catch (err) {
      alert(T("导入失败：文件不是有效的 JSON 文本。"));
      return;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      alert(T("导入失败：无法识别的配置文件。"));
      return;
    }

    /* 兼容两种来源：本扩展导出的包裹格式，以及手写的裸设置对象 */
    const wrapped = raw._type === "lofter-customizer-settings";
    let data = wrapped && raw.data && typeof raw.data === "object" ? raw.data : raw;
    const mods = wrapped && Array.isArray(raw._modules) ? raw._modules : null;
    /* _format:2：大件本体在顶层 _assets（base64）。旧版 v1.10.0 导入这种文件
       会忽略 _assets 且拒绝 lcidb: 引用 ⇒ 回退场景，数据卡口径「降级需先导出」 */
    const assetsIn =
      wrapped && raw._format === 2 && raw._assets && typeof raw._assets === "object"
        ? raw._assets
        : null;

    const dropped = Object.keys(data).filter((k) => !LC_KNOWN_KEYS.has(k));
    dropped.forEach((k) => delete data[k]);
    /* 原始键（自定义表情）先摘出来：它不属于 settings，直接落 storage，
       绝不能跟着 LC_merge 混进 lc_settings_v1 */
    const rawIn = {};
    LC_RAW_KEYS.forEach((k) => {
      if (k in data) {
        rawIn[k] = data[k];
        delete data[k];
      }
    });
    if (!Object.keys(data).length && !Object.keys(rawIn).length) {
      alert(T("导入失败：文件中没有本扩展认识的设置项。"));
      return;
    }

    const scope = mods
      ? "模块：" +
        mods
          .map((id) => (LC_MODULES.find((x) => x.id === id) || {}).label)
          .filter(Boolean)
          .join("、")
      : "全部配置";

    /* 装饰图冲突处理：双方都有装饰图时先问覆盖还是追加。
       词卡/音效/粒子都是装饰图的属性，随图走，不存在单独导入 */
    const incomingDecs = Array.isArray(data.decorations) ? data.decorations : [];
    const affectsDeco = !mods || mods.includes("deco");
    const currentDecsBefore = Array.isArray(state.decorations) ? state.decorations : [];
    let decoMode = null;
    if (affectsDeco && incomingDecs.length && currentDecsBefore.length) {
      decoMode = await askDecoImportMode(incomingDecs.length, currentDecsBefore.length);
      if (!decoMode) return;
    }

    const lines = [
      `即将导入${scope}。`,
      "",
      decoMode === "append"
        ? "装饰图会追加到你现有的后面，其余项只覆盖文件包含的设置。"
        : mods
          ? "只覆盖上述模块的设置，未包含的项保持当前值不变。"
          : "会覆盖当前全部设置（未包含的项回到默认值）。",
      "导入后需刷新 LOFTER 页面才会生效。",
    ];
    if (
      (!mods || mods.includes("emoji")) &&
      rawIn["lc_emoji_v1"]
    ) {
      const cur = lcRawCache["lc_emoji_v1"];
      const curN = cur && Array.isArray(cur.custom) ? cur.custom.length : 0;
      lines.push(
        "",
        curN
          ? `自定义表情会被文件里的那份整体替换（你现在有 ${curN} 个包）。`
          : "会导入文件里的自定义表情包。",
      );
    }
    if (dropped.length) lines.push("", `已忽略无法识别的项：${dropped.join("、")}`);
    if (assetsIn) {
      lines.push(
        "",
        `文件含 ${Object.keys(assetsIn).length} 个素材大件（图片/音频），会一并写入本地素材库（重复导入同一文件不会重复占用）。`,
      );
    }
    if (!confirm(lines.join("\n") + "\n\n" + T("继续？"))) return;

    /* 导入前快照：确认已通过、即将动 state 的那一刻存 —— 太早会被「取消」浪费，太晚就不是原状了 */
    const bak = { at: Date.now(), state: LC_clone(state) };
    await new Promise((res) => {
      try {
        chrome.storage.local.set({ [LC_PREIMPORT_KEY]: bak }, () => {
          void chrome.runtime.lastError; /* 读了才不报 unchecked */
          res();
        });
      } catch (e) { res(); }
    });
    lcRenderPreImportRow(bak);

    /* _format:2 素材重建：先写库再合并（用户取消就不写）。
       失败件引用保持原样 = 断链，结果弹窗说明 */
    if (assetsIn && LC_ASSETS && LC_ASSETS.isSupported()) {
      const r = await lcImportAssets(data, assetsIn);
      if (r.ok || r.fail || r.skip) {
        const parts = [];
        if (r.ok) parts.push(r.ok + T(" 件已写入"));
        if (r.skip) parts.push(r.skip + T(" 件已存在、跳过"));
        if (r.fail) parts.push(r.fail + T(" 件失败"));
        alert(
          T("素材：") + parts.join(T("，")) +
          (r.fail ? T("。失败的图会缺失，可重新上传。") : T("。")),
        );
      }
    }

    const hasSettings = Object.keys(data).length > 0;
    const bucketsBefore = state && state.filter ? LC_clone(LCUid.buckets(state.filter)) : null;
    if (mods) {
      const patch = {};
      mods.forEach((id) => {
        const m = LC_MODULES.find((x) => x.id === id);
        if (!m) return;
        m.keys.forEach((k) => {
          if (k in data) patch[k] = data[k];
        });
      });
      /* LC_merge 对数组是整体替换（装饰图列表按导入值覆盖），符合预期 */
      state = LC_migrateNav(LC_merge(state, patch));
    } else if (hasSettings) {
      state = LC_migrateNav(LC_merge(LC_DEFAULTS, data));
    }

    /* 整份导入的基准是默认值 ⇒ 文件里的 buckets 会把现有名单整体顶掉，
       而分享包的 buckets 通常是空的（收件人名单就这么被清了）。
       桶按账号合并：文件里提到的账号以文件为准，没提到的原样留着 */
    if (bucketsBefore && state && state.filter) lcMergeBuckets(bucketsBefore, state.filter);

    /* 老备份（1.12 及更早）里的名单是平铺数组 ⇒ 导入语义是「覆盖」，
       得直接盖进当前账号的桶；只塞匿名桶等认领的话，桶里已有内容就认领不到，
       名单看起来"没导进来"（详见 LCUid.adoptFlat 的注释） */
    if (state && state.filter) LCUid.adoptFlat(state.filter);

    /* 追加模式：保留现有装饰图，导入的重新编 id 加在后面（防 id 撞车） */

    /* 追加模式：保留现有装饰图，导入的重新编 id 加在后面（防 id 撞车） */
    if (decoMode === "append") {
      const stamp = Date.now();
      const inc = incomingDecs.map((d, i) => ({
        ...LC_clone(d),
        id: "dec_" + stamp + "_" + i + "_" + Math.random().toString(36).slice(2, 6),
      }));
      state.decorations = currentDecsBefore.concat(inc);
    }

    lcRefreshAll();
    save();
    /* 自定义表情：原始键直接落 storage（content.js 与 popup 都读同一份），
       本地缓存同步更新，避免连续导入两次时用的是旧缓存 */
    if ((!mods || mods.includes("emoji")) && Object.keys(rawIn).length) {
      chrome.storage.local.set(LC_clone(rawIn));
      Object.assign(lcRawCache, LC_clone(rawIn));
    }
    alert(T("导入完成。刷新 LOFTER 页面后生效。"));
  });

  buildFontOptions();
  chrome.storage.local.get(
    [LC_STORAGE_KEY, LC_PREIMPORT_KEY, LCUid.CACHE_KEY].concat(LC_RAW_KEYS),
    (res) => {
    /* LC_migrateNav：老配置「导航栏透明」迁移为毛玻璃（本批两档化） */
    state = LC_migrateNav(LC_merge(LC_DEFAULTS, res[LC_STORAGE_KEY] || {}));
    /* 身份证：popup 里没有页面全局，只能读「上次 www 页面写下的缓存」。
     * 和配置一次读回来 —— 分成两次异步读会先按匿名桶渲染一帧，
     * 看上去就像「我的名单突然空了」。 */
    LCUid.adopt(res[LCUid.CACHE_KEY]);
    /* 老配置的平铺名单搬进当前账号的桶：一次性静默落盘（不走 save()，
     * 开个面板不该弹「已保存」） */
    if (LCUid.migrate(state.filter, LCUid.uid())) {
      LCUid.ensureBucket(state.filter, LCUid.uid());
      LCUid.prune(state.filter);
      chrome.storage.local.set({ [LC_STORAGE_KEY]: state }, () => {});
    }
    /* 导入前快照：有才显示那一行（新装用户看不到多余的东西） */
    lcRenderPreImportRow(res[LC_PREIMPORT_KEY]);
    /* 原始键（自定义表情）本地缓存：导出取它、导入回写它 */
    LC_RAW_KEYS.forEach((k) => {
      if (res[k] !== undefined) lcRawCache[k] = res[k];
    });
    /* i18n（#16）：先定语言、再首渲染，最后挂 watcher。
     * watch 自带一次 apply，并守着后续全部增删改（含 popup.js 里那些
     * `el.textContent = "…"` / `innerHTML = "…"` 的动态文案，不必逐处包 T()）。 */
    if (i18n) i18n.set(state.lang);
    render();
    warmPreviewAssets(state); /* #20：引用形态的图先留空，解析完再补 src（不阻塞首渲染） */
    /* #20 B2：老配置增量迁移 —— 异步跑，不阻塞首渲染；迁完才 save/render */
    lcIdbMigrate(state).then((m) => {
      if (!m || !m.found) return;
      console.log("[LC] 素材迁移:", JSON.stringify(m));
      if (m.migrated) { save(); render(); }
      warmPreviewAssets(state);
      lcShowMigrateResult(m);
    }).catch(() => {});
    initRanges();
    syncCfgMods(); // 装饰图计数/按张入口依赖加载后的 state.decorations，初渲染时还没到手
    if (i18n) i18n.watch(document.body);
    /* 首渲染完再验身份：缓存里那位可能已经登出了（面板是扩展域，看不见
     * 页面全局），确认后要按新身份重画名单 */
    lcVerifyWhoAmI();
    lcStateLoaded = true; // 真值已到手，可以撤首开防白闪的预判标记了
    /* 「其他」栏的常显块必须在这里补一次。脚本末尾那段 sync 的补渲染跑在
       本回调**之前**（那时 state 还是默认值），占用数字与名单都是空的；
       而 lcVerifyWhoAmI 只在**身份变了**时才重画，缓存与当前一致就不重画
       ⇒「上次停在其他栏 + 登录状态没变」会让名单块一直是 display:none
       （2026-11-16 真机：登录另一个号后本机名单整块消失）。 */
    if (document.querySelector('.pane[data-pane="misc"].on')) {
      lcRenderUsage();
      lcTouchBuckets();
      lcRenderBuckets();
    }
    applyDarkFollow(state); // 面板暗色跟随（函数声明提升，定义在 IIFE 尾部）

    // 向当前网页查询是否在装饰图编辑模式
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "checkDecEditMode" }, (resp) => {
        if (chrome.runtime.lastError) return;
        if (resp && resp.editing) {
          syncDecEditButtons(true);
        }
      });
    });
  });

  // 进入装饰图编辑模式
  on("dec-enter-edit", "click", () => {
    syncDecEditButtons(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "editDecoration" });
    });
  });

  // 退出装饰图编辑模式
  on("dec-exit-edit", "click", () => {
    syncDecEditButtons(false);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "exitDecEditMode" });
    });
  });

  // 隐藏/显示装饰图
  on('dec-toggle-visibility', 'click', () => {
    state.decorationsVisible = !state.decorationsVisible;
    save();
    renderDecorations(); // 更新按钮文字

    // 通知 content.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleDecorationsVisibility',
          visible: state.decorationsVisible
        });
      }
    });
  });

  /* ============================================================
   * 音效设置弹窗
   * ============================================================ */
  let currentSoundIdx = -1;
  let soundModalPending = null;

  // 预设音效试听（Web Audio API）
  const soundAudioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // 通用音效合成函数
  function tone(ctx, { type = 'sine', freq = [], gain = [], dur }) {
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

  function playPresetSound(preset) {
    try {
      const ctx = soundAudioCtx;
      const t = ctx.currentTime;

      switch (preset) {
        case 'pop': {
          tone(ctx, {
            freq: [[0, 600], [0.1, 300, 1]],
            gain: [[0, 0.3], [0.1, 0.01, 1]],
            dur: 0.1
          });
          break;
        }
        case 'ding': {
          tone(ctx, {
            type: 'sine',
            freq: [[0, 1200], [0.05, 1800, 1]],
            gain: [[0, 0.25], [0.3, 0.01, 1]],
            dur: 0.3
          });
          break;
        }
        case 'dong': {
          tone(ctx, {
            type: 'sine',
            freq: [[0, 200], [0.3, 80, 1]],
            gain: [[0, 0.4], [0.4, 0.01, 1]],
            dur: 0.4
          });
          break;
        }
        case 'wobble': {
          const osc = ctx.createOscillator();
          const gn = ctx.createGain();
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();

          osc.type = 'triangle';
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
        case 'swoosh': {
          tone(ctx, {
            type: 'sine',
            freq: [[0, 250], [0.12, 900, 1], [0.25, 600, 1]],
            gain: [[0, 0.001], [0.02, 0.35, 1], [0.28, 0.001, 1]],
            dur: 0.3
          });
          break;
        }
        case 'boing': {
          tone(ctx, {
            freq: [[0, 500], [0.05, 900, 1], [0.15, 450, 1]],
            gain: [[0, 0.001], [0.02, 0.4, 1], [0.16, 0.001, 1]],
            dur: 0.18
          });
          setTimeout(() => {
            tone(ctx, {
              freq: [[0, 650], [0.04, 1050, 1], [0.14, 500, 1]],
              gain: [[0, 0.001], [0.02, 0.28, 1], [0.15, 0.001, 1]],
              dur: 0.17
            });
          }, 150);
          break;
        }
        case 'beep': {
          tone(ctx, {
            type: 'square',
            freq: [[0, 1400], [0.05, 1750, 1], [0.1, 1300, 1]],
            gain: [[0, 0.001], [0.01, 0.12, 1], [0.12, 0.001, 1]],
            dur: 0.13
          });
          setTimeout(() => {
            tone(ctx, {
              type: 'square',
              freq: [[0, 1100], [0.06, 850, 1]],
              gain: [[0, 0.001], [0.01, 0.1, 1], [0.1, 0.001, 1]],
              dur: 0.11
            });
          }, 120);
          break;
        }
        case 'stretch': {
          tone(ctx, {
            type: 'triangle',
            freq: [[0, 320], [0.35, 110, 1]],
            gain: [[0, 0.001], [0.04, 0.3, 1], [0.38, 0.001, 1]],
            dur: 0.4
          });
          setTimeout(() => {
            tone(ctx, {
              type: 'sine',
              freq: [[0, 180], [0.08, 420, 1], [0.2, 240, 1]],
              gain: [[0, 0.001], [0.02, 0.35, 1], [0.22, 0.001, 1]],
              dur: 0.24
            });
          }, 370);
          break;
        }
        case 'bubbles': {
          [0, 90, 190, 300].forEach(d => {
            setTimeout(() => {
              const base = 300 + Math.random() * 250;
              tone(ctx, {
                freq: [[0, base], [0.06, base * 2.2, 1]],
                gain: [[0, 0.001], [0.01, 0.25, 1], [0.08, 0.001, 1]],
                dur: 0.09
              });
            }, d);
          });
          break;
        }
      }
    } catch (e) {
      console.error('音效播放失败:', e);
    }
  }

  function openSoundModal(idx) {
    currentSoundIdx = idx;
    const dec = state.decorations[idx];
    const ia = dec?.interactive || {};

    soundModalPending = {
      preset: ia.soundPreset || 'pop',
      soundFile: ia.soundFile || '',
      soundFileName: ia.soundFileName || ''
    };

    $('sound-modal-title').textContent = `装饰 #${idx + 1} 的音效`;
    renderSoundModal();
    $('sound-modal-overlay').style.display = 'flex';
  }

  function closeSoundModal() {
    $('sound-modal-overlay').style.display = 'none';
    currentSoundIdx = -1;
    soundModalPending = null;
  }

  function renderSoundModal() {
    if (!soundModalPending) return;

    // 更新预设按钮选中状态
    document.querySelectorAll('.lc-sound-btn[data-preset]').forEach(btn => {
      const preset = btn.dataset.preset;
      if (preset === soundModalPending.preset) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    // 更新自定义音频区域
    const uploadArea = $('lc-sound-upload-area');
    const customInfo = $('lc-sound-custom-info');
    const customItem = $('lc-sound-custom-item');

    if (soundModalPending.soundFile) {
      uploadArea.style.display = 'none';
      customInfo.style.display = 'block';
      $('lc-sound-filename').textContent = soundModalPending.soundFileName || '自定义音频';

      // 自定义音频选中状态
      if (soundModalPending.preset === 'custom') {
        customItem.classList.add('selected');
      } else {
        customItem.classList.remove('selected');
      }
    } else {
      uploadArea.style.display = 'block';
      customInfo.style.display = 'none';
    }

    // 更新当前选择文字
    const currentEl = $('lc-sound-current');
    if (soundModalPending.preset === 'custom' && soundModalPending.soundFile) {
      currentEl.textContent = '当前选择：自定义 (' + (soundModalPending.soundFileName || '未命名') + ')';
    } else {
      const presetNames = {
        pop: '啵!', ding: '叮~', dong: '咚', wobble: '晃啷',
        swoosh: '咻↗', boing: '啵嘤~', beep: '哔啵!', stretch: '咻→咚', bubbles: '啵咕啵咕'
      };
      currentEl.textContent = '当前选择：' + (presetNames[soundModalPending.preset] || soundModalPending.preset) + ' (' + soundModalPending.preset + ')';
    }
  }

  // 音效弹窗事件绑定（只绑一次）
  if ($('sound-modal-overlay') && !$('sound-modal-overlay').dataset.lcBound) {
    $('sound-modal-overlay').dataset.lcBound = '1';

    // 点击遮罩关闭
    $('sound-modal-overlay').addEventListener('click', (e) => {
      if (e.target === $('sound-modal-overlay')) closeSoundModal();
    });

    // 关闭按钮（×）
    $('sound-modal-close').addEventListener('click', closeSoundModal);

    // 预设音效按钮：点击试听 + 选中 + 即时保存
    document.querySelectorAll('.lc-sound-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        // 切换到预设，不清除自定义文件，只是改变当前选中
        soundModalPending.preset = preset;
        // 切换到预设时，保留自定义音频文件，只是当前不选中它
        renderSoundModal();
        playPresetSound(preset);
        saveSoundConfig(); // 即时保存
      });
    });

    // 自定义音频上传
    const soundFileInput = $('lc-sound-file-input');
    const soundUploadArea = $('lc-sound-upload-area');

    soundUploadArea.addEventListener('click', () => {
      soundFileInput.click();
    });

    soundFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 1024 * 1024) {
        alert(T('文件超过 1MB 限制，请选择更小的文件'));
        return;
      }

      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
      const validExts = ['.mp3', '.wav'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        alert(T('仅支持 MP3 或 WAV 格式'));
        return;
      }

      let ref;
      try {
        ref = await lcIngest(file, 'aud'); /* 音频原样存，不压缩 */
      } catch (err) { lcAssetFail(err); return; }

      const prev = soundModalPending.soundFile;
      soundModalPending.preset = 'custom';
      soundModalPending.soundFile = ref;
      soundModalPending.soundFileName = file.name;
      if (prev !== ref) lcDropRef(prev);
      renderSoundModal();
      saveSoundConfig(); // 即时保存

      // 自动试听
      const audio = new Audio(pvOf(ref));
      audio.play().catch(() => { });
    });

    // 自定义音频项点击（选中但不播放，防止和试听按钮冲突）
    // 注意：通过事件委托处理，因为元素是动态显示/隐藏的
    $('lc-sound-custom-info').addEventListener('click', (e) => {
      // 如果点击的是试听或删除按钮，不处理选中
      if (e.target.closest('#lc-sound-play-custom') || e.target.closest('#lc-sound-delete-custom')) return;

      // 点击自定义音频项本身，选中它
      const item = $('lc-sound-custom-item');
      if (item && soundModalPending.soundFile) {
        soundModalPending.preset = 'custom';
        renderSoundModal();
        saveSoundConfig();
      }
    });

    // 试听自定义音频
    $('lc-sound-play-custom').addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发父元素的选中
      if (soundModalPending.soundFile) {
        const audio = new Audio(pvOf(soundModalPending.soundFile));
        audio.play().catch(() => { });
      }
    });

    // 删除自定义音频
    $('lc-sound-delete-custom').addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发父元素的选中
      const prev = soundModalPending.soundFile;
      soundModalPending.preset = 'pop';
      soundModalPending.soundFile = '';
      soundModalPending.soundFileName = '';
      soundFileInput.value = '';
      renderSoundModal();
      saveSoundConfig(); // 即时保存
      /* 2026-11-02：原来只清了引用、没删库里的本体 ⇒ 每删一次音效留一条孤儿。
         放在 saveSoundConfig 之后（此时 settings 已不引用），且用 IfUnused 兜住
         「弹窗没绑定装饰 ⇒ save 直接 return ⇒ 引用其实还在」这个边界。 */
      if (prev) lcDropRefIfUnused(prev);
    });
  }

  // 即时保存音效配置
  function saveSoundConfig() {
    if (currentSoundIdx < 0) return;

    const dec = state.decorations[currentSoundIdx];
    if (!dec.interactive) {
      dec.interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal', dialogue: false, dialogues: [], dialogueDuration: 3, dialogueStack: 1 };
    }

    dec.interactive.soundPreset = soundModalPending.preset;
    dec.interactive.soundFile = soundModalPending.soundFile;
    dec.interactive.soundFileName = soundModalPending.soundFileName;

    // 如果选了自定义但没文件，回退到 pop
    if (dec.interactive.soundPreset === 'custom' && !dec.interactive.soundFile) {
      dec.interactive.soundPreset = 'pop';
    }

    save();
    renderDecorations(); // 更新卡片显示
  }

  function updateShortcutDisplay() {
    chrome.commands.getAll((commands) => {
      const shortcuts = {};
      commands.forEach(cmd => {
        shortcuts[cmd.name] = cmd.shortcut || '未设置';
      });

      // 更新显示
      const decToggle = document.getElementById('shortcut-dec-toggle');
      const editMode = document.getElementById('shortcut-edit-mode');
      const darkMode = document.getElementById('shortcut-dark-mode');

      if (decToggle) decToggle.textContent = shortcuts['toggle-decorations'] || '未设置';
      if (editMode) editMode.textContent = shortcuts['toggle-edit-mode'] || '未设置';
      if (darkMode) darkMode.textContent = shortcuts['toggle-dark-mode'] || '未设置';
    });
  }
  // 更新快捷键显示
  updateShortcutDisplay();

  /* ---------- 美化批：滑杆已填充轨道（面板配色固定蓝紫，不注入主题色） ---------- */
  function paintRange(el) {
    const min = +el.min || 0, max = +el.max || 100, v = +el.value || 0;
    el.style.setProperty("--p", ((v - min) / (max - min) * 100) + "%");
  }
  function initRanges() {
    document.querySelectorAll('input[type="range"]').forEach((el) => {
      paintRange(el);
      if (!el.__lcRangeBound) {
        el.addEventListener("input", () => paintRange(el));
        el.__lcRangeBound = true;
      }
    });
  }

  /* ---------- 场景区分：工具栏弹窗（顶层窗口）vs 悬浮按钮 iframe ----------
   * 弹窗窗口高度按内容自适应，html/body 的 height:100% 无参照会塌成一条；
   * 顶层窗口时给 html 挂 .lc-standalone，由 CSS 定高（iframe 场景由宿主定高） */
  try {
    if (window.self === window.top) {
      document.documentElement.classList.add("lc-standalone");
    }
  } catch (e) {
    document.documentElement.classList.add("lc-standalone");
  }

  /* ---------- 面板暗色跟随：判据与 content.js isDarkMode() 一致 ----------
   * manual（手动开启）或 auto 且系统深色 → 面板切 body.dark（CSS 变量整体换暗） */
  const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
  function applyDarkFollow(s) {
    /* 判据与 content.js isDarkMode() 完全同源（含按时段档） */
    const on = typeof LC_darkActive === "function"
      ? LC_darkActive(s && s.darkMode)
      : ((s.darkMode && s.darkMode.mode) === "manual" ||
         ((s.darkMode && s.darkMode.mode) === "auto" && darkMq.matches));
    document.body.classList.toggle("dark", !!on);
    if (lcStateLoaded) document.documentElement.classList.remove("lc-pre-dark");
  }
  darkMq.addEventListener("change", () => applyDarkFollow(state));
  /* 面板常驻 iframe：存储被别人改了（FAB/快捷键/另一处面板）要回灌 state。
   * 血泪案（2026-09-21）：本监听器原先"只重算暗色、不回写 state"，而面板
   * state 只在加载时读一次存储——用户在别处把 darkMode 从 manual 改回 off
   * 后，面板 state 仍是旧值 manual，此时任意一次 save() 全量写盘就把
   * manual 写回存储 → 页面突然变暗。修复：字段级和解——与 state 不同的
   * 字段 adopt 进来并重渲染；自己刚写的字段 incoming===state 自然跳过，
   * 不会打断正在输入的控件（Chrome 对相同 value 赋值不动光标）。 */
  /* ============================================================
   * 存储占用（「其他 → 数据」）
   * ------------------------------------------------------------
   * 关键事实：chrome.storage.local 的配额是**整个扩展共用的一个池子**——
   *   · 10MB（Chrome/Edge 114 起；manifest 未申请 unlimitedStorage）
   *   · 不是「每个键各 10MB」，也不是「每张图各 10MB」：所有键相加不能超
   *   · 值按 JSON 序列化后计入体积，图片/音频以 base64 dataURL 存
   *     → 实际占用 ≈ 原文件 × 1.33（这就是「6MB 图撞墙」的成因）
   * 所以这里拆出「谁在吃空间」，用户才能对症清理。
   * 只做只读统计 + 引导到对应栏目删除，不在这里提供一键删除：
   * 删快照 = 删用户唯一副本，风险等级不同，不该混在同一个按钮里。
   * ============================================================ */
  const LC_QUOTA_FALLBACK = 10 * 1024 * 1024;
  const LC_USAGE_GROUPS = [
    { label: "设置", keys: ["lc_settings_v1"],
      note: "各项设置；图片/音频大件不在这里，只留引用" },
    { label: "草稿快照", keys: ["lc_draft_snap_v1"],
      note: "编辑防丢的正文快照（按上限自动修剪）" },
    { label: "表情包", keys: ["lc_emoji_v1"],
      note: "内置表情 + 你导入的自定义表情" },
    { label: "官方黑名单", keys: ["lc_official_bl_v1"],
      note: "跟随 LOFTER 账号的黑名单镜像" },
    { label: "导入前备份", keys: [LC_PREIMPORT_KEY],
      note: "上一次导入配置前的设置快照，用于一键还原" },
    { label: "其它缓存", keys: ["lc_self_v1", "lc_draft_tmpkey_v1", "lc_cmt_diag_v1",
      "lc_cmt_diag_req_v1", "lc_ep_diag_v1"],
      note: "身份缓存与诊断标记" },
  ];

  /* 写盘失败提示：只在首次弹一次（输入过程中反复弹会打断操作） */
  let lcSaveWarned = false;
  function lcSaveFailed(msg) {
    if (lcSaveWarned) return;
    lcSaveWarned = true;
    alert(T("保存失败：扩展的存储空间已满（全部数据共 10MB）。") +
      T("请到「其他 → 数据」查看占用，删掉不用的装饰图、背景图或自定义音效后重试。") +
      "\n\n" + msg);
  }

  function lcFmtBytes(n) {
    const v = Number(n) || 0;
    if (v < 1024) return v + " B";
    if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";
    return (v / 1024 / 1024).toFixed(2) + " MB";
  }

  function lcRenderUsage() {
    const totalEl = $("lc-usage-total"), listEl = $("lc-usage-list"),
      barEl = $("lc-usage-bar"), hintEl = $("lc-usage-hint"), idbEl = $("lc-usage-idb");
    if (!totalEl || !chrome.storage.local.getBytesInUse) return;
    totalEl.textContent = T("统计中…");
    const quota = chrome.storage.local.QUOTA_BYTES || LC_QUOTA_FALLBACK;
    chrome.storage.local.getBytesInUse(null, (total) => {
      const used = Number(total) || 0;
      const pct = Math.min(100, (used / quota) * 100);
      /* 整数额度别显示成「10.00 MB」（10.00 这种小数位对固定额度是噪音） */
      const quotaTxt = lcFmtBytes(quota).replace(/\.00 (MB|KB)$/, " $1");
      totalEl.textContent =
        lcFmtBytes(used) + " / " + quotaTxt + " · " + pct.toFixed(0) + "%";
      if (barEl) {
        barEl.style.width = pct + "%";
        barEl.style.background =
          pct >= 85 ? "#e5533d" : pct >= 60 ? "#e6a23c" : "#667eea";
      }
      /* 分组统计：逐组异步查，结果按索引落位后再拼（不能依赖回调顺序）。
         IDB 行与分组并行查，两边都齐才渲染 —— 但两者写的是**不同容器**：
         素材行常显（#lc-usage-idb），逐键分账留在收起区（#lc-usage-list） */
      const out = new Array(LC_USAGE_GROUPS.length);
      let done = 0, idbHtml = null;
      const tryRender = () => {
        if (done !== LC_USAGE_GROUPS.length || idbHtml === null) return;
        if (idbEl) idbEl.innerHTML = idbHtml;
        listEl.innerHTML =
          out
          /* 空组不占行，但主设置键恒显（0 也要让用户看到"这栏没吃空间"） */
          .filter((r) => r && (r.n > 0 || r.g.keys[0] === "lc_settings_v1"))
          .map((r) =>
            '<div style="display:flex;gap:8px;"><span style="flex:0 0 auto;min-width:74px;">' +
            T(r.g.label) +
            '</span><span style="flex:0 0 auto;color:var(--lc-text);min-width:62px;">' +
            lcFmtBytes(r.n) +
            '</span><span style="opacity:.75;">' + T(r.g.note) + '</span></div>'
          )
          .join("");
        if (hintEl) {
          hintEl.textContent = pct >= 95
            ? T("存储几乎满了，很可能保存失败。请立即清理：删除不用的装饰图 / 背景图 / 自定义音效（「显示」「装饰」栏）。")
            : pct >= 85
            ? T("已接近上限：再加数据可能保存失败（会弹提示）。建议先删掉不用的装饰图或草稿快照。")
            : T("上限是全部数据共用的 10MB（不是每项各 10MB）。图片与音频大件另存，不占这 10MB。清理入口：草稿快照在「编辑防丢」。");
        }
      };
      LC_USAGE_GROUPS.forEach((g, i) => {
        chrome.storage.local.getBytesInUse(g.keys, (n) => {
          out[i] = { g: g, n: Number(n) || 0 };
          done++;
          tryRender();
        });
      });
      /* 素材行：只报在用的（按 settings 引用对账），孤儿条数交给用户处理 */
      (async () => {
        try {
          if (LC_ASSETS && LC_ASSETS.usageReport) {
            const rep = await LC_ASSETS.usageReport();
            /* listMeta 拿不到就退回全表口径（宁可数字保守，不能让这一行消失） */
            let scan = null;
            try { if (LC_ASSETS.listMeta) scan = await lcIdbScan(); } catch (e) { scan = null; }
            const row = lcUsageIdbRow(rep, scan);
            /* 两列网格（标签 / 内容），而不是单行 flex：
               ① 备注与「清理」绑成一组不换行的尾巴 —— 单行 flex 在窄宽度下会把带
                  margin-left:auto 的按钮单独顶到下一行，孤零零悬在右边（真机走查抓的）
               ② 内容列内部换行时，第二行自然对齐到数值列（x=82），不会贴回最左边 */
            const tail =
              (row.note ? '<span style="opacity:.75;white-space:nowrap;">' + row.note + '</span>' : '') +
              (row.deadN
                ? '<button class="lc-link" type="button" data-idb-clean="1" style="white-space:nowrap;">' +
                  T("清理") + '</button>'
                : '');
            idbHtml =
              '<div style="display:grid;grid-template-columns:74px 1fr;column-gap:8px;align-items:baseline;">' +
              '<span>' + T(row.label) + '</span>' +
              '<span style="display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;">' +
              '<span style="color:var(--lc-text);white-space:nowrap;">' + row.main + '</span>' +
              (tail
                ? '<span style="display:inline-flex;align-items:baseline;gap:6px;">' + tail + '</span>'
                : '') +
              '</span></div>';
          } else idbHtml = "";
        } catch (e) { idbHtml = ""; }
        tryRender();
      })();
    });
  }

  /* ------------------------------------------------------------
   * #41 本机名单（数据卡底部，2026-11-16 作者拍板 A 位置）
   * 分账号之后本机可能压着几个号的名单，"看不见、删不掉"是唯一缺口。
   * 出现规则：**≥2 份才出现** —— 只有当前账号一份时，「本机名单 1 份」
   * 只是把过滤卡的数字重说一遍，是噪音；出现了就一定删得动，才配占版面。
   * 动词分两档：当前账号「清空」（清掉正在生效的名单）、其他「删除」（存档）。
   * 展开键与快捷键卡同一个套路：位置固定、0fr↔1fr、收起时 inert。
   * ============================================================ */
  var lcBucketsOpen = false;

  function lcTimeAgo(ts) {
    if (!ts) return T("未知");
    const d = Math.max(0, Date.now() - ts);
    if (d < 60e3) return T("刚刚");
    if (d < 3600e3) return Math.floor(d / 60e3) + " " + T("分钟前");
    if (d < 864e5) return Math.floor(d / 3600e3) + " " + T("小时前");
    if (d < 30 * 864e5) return Math.floor(d / 864e5) + " " + T("天前");
    if (d < 365 * 864e5) return Math.floor(d / (30 * 864e5)) + " " + T("个月前");
    return Math.floor(d / (365 * 864e5)) + " " + T("年前");
  }

  /* 账号显示名：桶里记的 `_blog`（切号那刻写下来的）优先，没有就退成 uid 尾 4 位。
   * 1.13 及更早的老桶没有 `_blog` —— 那时根本不知道该存名字，只能这样认。
   * 匿名桶不叫 `_anonymous`，叫「未登录时」。 */
  function lcBucketName(e) {
    if (e.anon) return T("未登录时");
    if (e.blog) return e.blog;
    return T("账号") + " ·" + String(e.uid).slice(-4);
  }

  function lcRenderBuckets() {
    const box = $("lc-lists"), sum = $("lc-lists-sum"), rows = $("lc-lists-rows");
    if (!box || !sum || !rows) return;
    const ens = LCUid.entries(ensureFilter());
    let total = 0;
    ens.forEach((e) => { total += e.n; });
    /* 出现条件：本机还压着**别的身份**的名单 —— 不是「至少 2 份」。
       `length >= 2` 把「当前账号那一行」也算进份数了，可它未必存在
       （读路径还没走到 / 刚换号还没建桶 / 未登录时匿名空桶按新规则不列），
       于是只剩 1 行时整块消失，用户再也删不掉上个账号的数据 ——
       而这正是做这块的理由（2026-11-16 真机：登录另一个号后整块不见了）。 */
    if (!ens.some((e) => !e.current)) { box.style.display = "none"; return; }
    box.style.display = "";
    sum.textContent = ens.length + " " + T("份") + " · " + total + " " + T("条");
    rows.innerHTML = ens.map((e) => {
      const meta = e.n + " " + T("条") + " · " + lcTimeAgo(e.ts);
      return (
        '<div style="min-width:0;">' +
        '<div style="font-size:13px;color:var(--lc-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        lcEscHtml(lcBucketName(e)) +
        (e.current
          ? '<span style="font-size:11px;color:var(--lc-sub);margin-left:4px;">' + T("当前") + "</span>"
          : "") +
        "</div>" +
        '<div style="font-size:11px;color:var(--lc-sub);margin-top:2px;white-space:nowrap;">' +
        lcEscHtml(meta) +
        "</div></div>" +
        '<button class="lc-link" type="button" data-lc-bucket="' +
        lcEscHtml(e.key) +
        '" style="white-space:nowrap;">' +
        (e.current ? T("清空") : T("删除")) +
        "</button>"
      );
    }).join("");
    const body = $("lc-lists-body"), more = $("lc-lists-more");
    if (body) {
      body.classList.toggle("closed", !lcBucketsOpen);
      try { body.inert = !lcBucketsOpen; } catch (e) {}
    }
    if (more) more.textContent = T(lcBucketsOpen ? "收起" : "管理");
  }

  /* 打一次「最后使用」+ 记住账号名。差不到 1 小时不写盘（见 LCUid.touch）。
   * **不走 save()**：save 是"你改了什么"的反馈通道（会闪「已保存 ✓」），
   * 而使用时间是系统自己记的账 —— 用户没动任何设置，不该看到保存提示。
   * 也不在首屏数据到手前写：那时 state 还是默认值，写下去等于拿默认值盖掉真配置。 */
  function lcTouchBuckets() {
    try {
      if (!lcStateLoaded || !LCUid.touch(ensureFilter())) return;
      chrome.storage.local.set({ [LC_STORAGE_KEY]: state }, () => {});
    } catch (e) {}
  }

  on("lc-lists-more", "click", () => {
    lcBucketsOpen = !lcBucketsOpen;
    lcRenderBuckets();
  });

  on("lc-lists-rows", "click", (e) => {
    const btn = e.target.closest("[data-lc-bucket]");
    if (!btn) return;
    const key = btn.getAttribute("data-lc-bucket");
    const f = ensureFilter();
    const row = LCUid.entries(f).find((x) => x.key === key);
    if (!row) { lcRenderBuckets(); return; }
    const name = lcBucketName(row);
    const ok = confirm(
      row.current
        ? T("清空") + "「" + name + "」" + T("的三份屏蔽名单？") + "\n\n" +
          T("这些名单正在生效，清空后这个账号的过滤立刻失效（当前页面刷新后，被隐藏的帖子会重新出现）。此操作不可撤销。")
        : T("删除") + "「" + name + "」" + T("的屏蔽名单？") + "\n\n" +
          T("这份名单属于一个当前没在用的账号，删除后不再占用本机存储，以后用那个账号登录看到的也是空白名单。")
    );
    if (!ok) return;
    /* 当前账号再确认一次：它是"正在生效的设置"，不是"一份存档" */
    if (row.current && !confirm(T("再确认一次：清空后当前账号的三份名单会全部删除，无法恢复。"))) return;
    LCUid.drop(f, key);
    save();
    lcRenderLists();
    lcRenderBuckets();
  });

  on("lc-usage-refresh", "click", lcRenderUsage);
  /* 「清理未使用」：删掉没有任何设置引用的素材记录（孤儿）。
     事件委托挂在整块 #lc-usage 上 —— 素材行会从常显区重建，绑在旧容器（明细列表）上会收不到。
     删完重新 scan 再刷一次，让行内的条数/按钮自己消失（不靠本地状态推测）。 */
  on("lc-usage", "click", async (e) => {
    const btn = e.target.closest("[data-idb-clean]");
    if (!btn || !LC_ASSETS) return;
    btn.disabled = true;
    try {
      const scan = await lcIdbScan();
      if (!scan.dead.length) { lcRenderUsage(); return; }
      const ok = confirm(
        T(`确定删除 ${scan.dead.length} 件未使用的素材（${lcFmtBytes(scan.deadBytes)}）吗？`) +
        "\n\n" +
        T("这些素材没有任何设置引用（多是重复导入、或已被替换掉的旧图与旧音效），删除不影响你的背景图、装饰图和音效。")
      );
      if (!ok) { btn.disabled = false; return; }
      for (const m of scan.dead) {
        try { await LC_ASSETS.del(m.id); } catch (err) {}
      }
      lcRenderUsage();
    } catch (err) {
      btn.disabled = false;
    }
  });
  /* 分组明细默认收起：展开时才把明细区显示出来（数据本身照常统计，
     这样展开/收起即时切换、不用重查） */
  on("lc-usage-more", "click", () => {
    const d = $("lc-usage-detail"), b = $("lc-usage-more");
    if (!d || !b) return;
    const open = d.style.display === "none";
    d.style.display = open ? "" : "none";
    b.textContent = T(open ? "收起明细" : "展开明细");
  });
  /* 首屏「其他」栏的补渲染已挪进 storage 回调（见 lcStateLoaded = true 处）：
     放在这里会跑在配置到手之前，用默认值算一遍白算。 */

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[LC_STORAGE_KEY]) return;
    const incoming = LC_merge(LC_DEFAULTS, ch[LC_STORAGE_KEY].newValue || {});
    let touched = false;
    for (const k of Object.keys(incoming)) {
      if (JSON.stringify(incoming[k]) !== JSON.stringify(state[k])) {
        state[k] = incoming[k];
        touched = true;
      }
    }
    lcStateLoaded = true; // 外部改动即说明存储可读，同上
    applyDarkFollow(state);
    if (touched) { render(); warmPreviewAssets(state); }
  });

})();
