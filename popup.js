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

      chrome.storage.local.set({ [LC_STORAGE_KEY]: state }, () => {
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

  /* 标签切换（--i 驱动 .tabs::before 滑动色块平移） */
  const tabsBar = $("tabs");
  tabsBar.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".pane").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    document.querySelector(`.pane[data-pane="${b.dataset.tab}"]`).classList.add("on");
    const btns = [...tabsBar.querySelectorAll("button[data-tab]")];
    tabsBar.style.setProperty("--i", btns.indexOf(b));
  });

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
  }
  /* 亮度 */
  function syncDarkBrightness() {
    const mode = state.darkMode.mode;
    $("dark-brightness-row").hidden = !mode || mode === 'off';
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
      card.style.cssText = "border:1px solid var(--lc-line);border-radius:8px;padding:10px;background:var(--lc-soft);";
      const ia = dec.interactive;
      const isOpen = card.dataset.interactiveOpen === "true";

      card.innerHTML = `
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <img src="${dec.dataUrl}" style="width:52px;height:52px;object-fit:contain;border-radius:6px;flex-shrink:0;background:repeating-conic-gradient(rgba(128,128,128,.18) 0 25%,transparent 0 50%) 0 0/12px 12px,rgba(128,128,128,.08);" />
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;color:var(--lc-text);font-weight:500;">装饰 #${idx + 1}</span>
              <button class="btn" data-del="${idx}" style="padding:2px 8px;font-size:11px;flex-shrink:0;">删除</button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
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
        <div style="margin-top:8px;border-top:1px solid var(--lc-line);padding-top:6px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn" data-toggle-ia="${idx}" type="button" ${ia.enabled ? '' : 'disabled'} style="padding:4px 0;font-size:12px;color:${ia.enabled ? 'var(--lc-accent)' : 'var(--lc-sub)'};background:transparent;border:none;text-align:left;display:flex;align-items:center;gap:4px;cursor:${ia.enabled ? 'pointer' : 'default'};flex:1;min-width:0;">
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
        if (confirm("( \u02b6> <)\u055e \u055e确定删除这个装饰图吗？")) {
          state.decorations.splice(idx, 1);
          renderDecorations();
          save();
        }
      });
    });

    // 拖拽排序：只在缩略图上触发，带视觉反馈
    let dragSrcIdx = -1;
    list.querySelectorAll(':scope > div').forEach((card, idx) => {
      card.dataset.sortIdx = idx;
      const thumb = card.querySelector('img[src]');
      if (thumb) {
        thumb.draggable = true;
        thumb.style.cursor = 'grab';
        thumb.title = '拖拽调整图层顺序';
        thumb.addEventListener('dragstart', (e) => {
          dragSrcIdx = idx;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', idx);
          card.style.opacity = '0.4';
          thumb.style.cursor = 'grabbing';
          list.querySelectorAll(':scope > div').forEach(c => {
            if (c !== card) c.style.transition = 'transform 0.2s ease';
          });
        });
        thumb.addEventListener('dragend', () => {
          dragSrcIdx = -1;
          card.style.opacity = '';
          thumb.style.cursor = 'grab';
          list.querySelectorAll(':scope > div').forEach(c => {
            c.style.transition = '';
            c.style.transform = '';
          });
        });
      }
      card.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (dragSrcIdx === -1 || dragSrcIdx === idx) return;
        const allCards = Array.from(list.querySelectorAll(':scope > div'));
        allCards.forEach((c, i) => {
          if (i === dragSrcIdx) return;
          if (dragSrcIdx < idx) {
            if (i > dragSrcIdx && i <= idx) {
              c.style.transform = 'translateY(-8px)';
            } else {
              c.style.transform = '';
            }
          } else {
            if (i >= idx && i < dragSrcIdx) {
              c.style.transform = 'translateY(8px)';
            } else {
              c.style.transform = '';
            }
          }
        });
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIdx = dragSrcIdx;
        const toIdx = idx;
        dragSrcIdx = -1;
        list.querySelectorAll(':scope > div').forEach(c => {
          c.style.transition = '';
          c.style.transform = '';
        });
        if (fromIdx === -1 || fromIdx === toIdx) return;
        const item = state.decorations.splice(fromIdx, 1)[0];
        state.decorations.splice(toIdx, 0, item);
        state.decorations.forEach((dec, i) => {
          dec.zIndex = state.decorations.length - i;
        });
        renderDecorations();
        save();
      });

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
      <span style="flex:1;font-size:13px;color:var(--lc-text);word-break:break-word;">${text}</span>
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
    if (s.background.image.dataUrl) { img.src = s.background.image.dataUrl; img.style.display = "block"; } else { img.style.display = "none"; }

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
      gp.src = s.gtotop.imageDataUrl; gp.style.display = "block";
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
    $("filter-enabled").checked = !!f.enabled;
    $("filter-scope-home").checked = !!(f.scope && f.scope.home);
    $("filter-scope-tag").checked = !!(f.scope && f.scope.tag);
    $("filter-scope-comment").checked = !!(f.scope && f.scope.comment);
    $("filter-counter").checked = f.showCounter !== false;
    $("filter-keywords").value = (f.keywords || []).join("\n");
    renderFilterUsers();

    // 官方黑名单联动
    $("official-comments").checked = !!(
      s.official && s.official.hideInComments
    );

    // 评论区增强（工具行总开关，默认开；控件本身默认熄灭。
    // 表情快捷输入跟随本开关，不单列）
    $("comment-toolbar").checked = !(s.comment && s.comment.toolbar === false);

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
    // 快捷键开关
    const shortcutsEnabled = $('shortcuts-enabled');
    const shortcutsList = $('shortcuts-list');

    shortcutsEnabled.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      state.shortcutsEnabled = enabled;
      save();

      if (enabled) {
        shortcutsList.style.opacity = '1';
        shortcutsList.style.pointerEvents = 'auto';
      } else {
        shortcutsList.style.opacity = '0.5';
        shortcutsList.style.pointerEvents = 'none';
      }
    });

    // 初始化状态
    if (state.shortcutsEnabled) {
      shortcutsEnabled.checked = true;
      shortcutsList.style.opacity = '1';
      shortcutsList.style.pointerEvents = 'auto';
    }

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
  on("bg-file", "change", async (e) => { const f = e.target.files[0]; if (!f) return; state.background.image.dataUrl = await readFile(f); $("bg-preview").src = state.background.image.dataUrl; $("bg-preview").style.display = "block"; save(); });

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

  on("reset", "click", () => { if (!confirm("确定要全部重置吗？")) return; state = LC_clone(LC_DEFAULTS); render(); save(); });

  /* ---------- 功能栏：关键词/用户过滤 ---------- */
  function ensureFilter() {
    if (!state.filter) state.filter = LC_clone(LC_DEFAULTS.filter);
    if (!state.filter.scope) state.filter.scope = { home: true, tag: true };
    if (!Array.isArray(state.filter.keywords)) state.filter.keywords = [];
    if (!Array.isArray(state.filter.users)) state.filter.users = [];
    if (!Array.isArray(state.filter.tags)) state.filter.tags = [];
    return state.filter;
  }

  function renderFilterUsers() {
    const box = $("filter-users");
    if (!box) return;
    const f = state.filter || LC_DEFAULTS.filter;
    const users = f.users || [];
    $("filter-user-count").textContent = users.length + " 人";
    box.innerHTML = users.length
      ? users
          .map(
            (u, i) =>
              `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-soft);">` +
              `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${String(u.name || u.id).replace(/[<>&"]/g, "")}</span>` +
              `<button class="btn" data-filter-unmute="${i}" type="button" style="padding:1px 8px;font-size:11px;flex-shrink:0;">移除</button></div>`,
          )
          .join("")
      : `<p class="hint" style="margin:0;">暂无。在帖子作者名或用户评论旁点「隐藏」即可添加。</p>`;
  }

  on("filter-users", "click", (e) => {
    const b = e.target.closest("[data-filter-unmute]");
    if (!b) return;
    const f = ensureFilter();
    f.users.splice(+b.dataset.filterUnmute, 1);
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
      const cur = ensureFilter();
      if (Array.isArray(nf.users)) {
        if (JSON.stringify(cur.users) !== JSON.stringify(nf.users)) {
          cur.users = nf.users;
          renderFilterUsers();
        }
      }
      /* 页面卡片上点 tag「屏蔽」→ 打开着的面板 tag 列表实时反映 */
      if (Array.isArray(nf.tags)) {
        if (JSON.stringify(cur.tags) !== JSON.stringify(nf.tags)) {
          cur.tags = nf.tags;
          if (lcOffMode === "tag") renderTagBlockList();
        }
      }
    });
  } catch (e) {}

  on("filter-enabled", "change", (e) => {
    ensureFilter().enabled = e.target.checked;
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
  on("filter-keywords", "input", (e) => {
    const f = ensureFilter();
    const seen = new Set();
    /* 多关键词两种写法都支持：一行一个，或中/英文逗号（分号）分隔 */
    f.keywords = e.target.value
      .split(/[\n，,；;]+/)
      .map((k) => k.trim())
      .filter((k) => {
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    save();
  });

  /* ---------- 功能栏：官方黑名单 ----------
   * DWR 调用与回复解析在 lc-dwr.js（popup 页面 CSP 禁 eval，
   * 回复解析用手写解析器，不能 new Function）。 */
  let lcOfficialList = []; /* {id, blogId, blogName, nick, ava} */
  let lcOfficialLoading = false;

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
          `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">` +
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
    if (lcOffMode === "tag") renderTagBlockList();
    else renderOfficialList();
  });

  /* ---------- 模式切换 + tag 屏蔽名单 ---------- */
  function renderOfficialMode() {
    const tag = lcOffMode === "tag";
    const input = $("official-add-input");
    const btn = $("official-add-btn");
    if (input) input.placeholder = tag
      ? "输入 tag 名称，或粘贴 tag 页链接"
      : "粘贴对方主页链接或 ID";
    if (btn) btn.textContent = tag ? "屏蔽" : "拉黑";
    const lbl = $("official-list-label");
    if (lbl) lbl.textContent = tag ? "已屏蔽 tag" : "黑名单成员";
    const help = $("official-help");
    if (help) help.style.display = tag ? "none" : "";
    const tagHelp = $("official-tag-help");
    if (tagHelp) tagHelp.style.display = tag ? "" : "none";
    const addHint = $("official-add-hint");
    if (addHint) addHint.style.display = tag ? "none" : "";
    const cRow = $("official-comments-row");
    if (cRow) cRow.style.display = tag ? "none" : "";
    if (tag) renderTagBlockList();
    else renderOfficialList();
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

  function renderTagBlockList() {
    const box = $("official-list");
    if (!box) return;
    const f = ensureFilter();
    const tags = f.tags || [];
    $("official-count").textContent = tags.length + " 个";
    const toggleBtn = $("official-toggle");
    if (toggleBtn) toggleBtn.textContent = lcOfficialExpanded ? "收起" : "展开";
    if (!lcOfficialExpanded) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }
    box.style.display = "";
    box.innerHTML = tags.length
      ? tags
          .map(
            (t, i) =>
              `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-soft);">` +
              `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${String(t).replace(/[<>&"]/g, "")}</span>` +
              `<button class="btn" data-tag-unblock="${i}" type="button" style="padding:1px 8px;font-size:11px;flex-shrink:0;">移除</button></div>`,
          )
          .join("")
      : `<p class="hint" style="margin:0;">暂无。悬停帖子卡片上的 tag 点「屏蔽」，或在这里输入。</p>`;
  }

  function lcTagAdd() {
    const input = $("official-add-input");
    const name = lcTagNormalize(input.value);
    if (!name) {
      input.value = "";
      input.placeholder = "请输入 tag 名称或 tag 页链接";
      return;
    }
    const f = ensureFilter();
    if (f.tags.some((t) => String(t).toLowerCase() === name.toLowerCase())) {
      lcOfficialToast("tag「" + name + "」已在屏蔽名单");
      return;
    }
    f.tags.push(name);
    renderTagBlockList();
    save();
    lcOfficialToast("已屏蔽 tag「" + name + "」");
    input.value = "";
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

  async function lcOfficialRefresh() {
    if (lcOfficialLoading) return;
    lcOfficialLoading = true;
    renderOfficialList();
    try {
      const raw = await lcDwr("getBlacklistUserList", [
        "number:200",
        "number:0",
      ]);
      /* 正常应是条目数组；若服务端包了一层对象，取第一个数组型属性兜底 */
      let arr = raw;
      if (!Array.isArray(arr) && arr && typeof arr === "object") {
        const cand = Object.values(arr).find((v) => Array.isArray(v));
        if (cand) arr = cand;
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
      if (!lcOfficialList.length) {
        /* 官方页明明有成员但这里读到空：多半是回复形态和抓包样本不符，
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
    } catch (err) {
      $("official-count").textContent = "读取失败";
      lcOfficialList = [];
      renderOfficialList();
      $("official-list").style.display = "";
      $("official-list").innerHTML =
        `<p class="hint" style="margin:0;">读取失败：${lcOfficialEsc(err.message)}。请确认已在浏览器登录 LOFTER 后重试。</p>`;
      return;
    } finally {
      lcOfficialLoading = false;
    }
    renderOfficialList();
    lcOfficialPersist();
  }

  /* 拉黑是对方可感知的强动作：两段式确认（第一次点变成「确认拉黑？」，3 秒内再点才执行）。
   * tag 屏蔽是本地可逆操作：不确认，一键生效（面板/页面都可随时移除） */
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
      const entry = await lcDwr("addBlacklist", ["string:" + name, "number:0"]);
      let toastName = name;
      if (entry && entry.id) {
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
      } else {
        await lcOfficialRefresh();
      }
      /* 绿色「已拉黑 xxx」闪现数秒，方便确认没拉错人；要细看就展开列表 */
      lcOfficialToast("已拉黑 " + toastName);
      lcOfficialPersist();
      $("official-add-input").value = "";
    } catch (err) {
      alert("拉黑失败：" + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "拉黑";
    }
  });

  on("official-list", "click", async (e) => {
    const tb = e.target.closest("[data-tag-unblock]");
    if (tb) {
      const f = ensureFilter();
      f.tags.splice(+tb.dataset.tagUnblock, 1);
      renderTagBlockList();
      save();
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
      alert("移除失败：" + err.message);
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
    let dataUrl = await readFile(f);
    if (f.type !== 'image/gif') {
      dataUrl = await compressImage(dataUrl, 200, 200, 0.85);
    }
    state.gtotop.imageDataUrl = dataUrl;
    $("gtotop-preview").src = dataUrl;
    $("gtotop-preview").style.display = "block";
    syncGtotopSize();
    save();
  });
  on("gtotop-clear", "click", () => {
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
      let dataUrl = await readFile(f);
      if (f.type !== 'image/gif') {
        dataUrl = await compressImage(dataUrl, 800, 800, 0.85);
      }
      if (!state.decorations) state.decorations = [];
      state.decorations.push({
        id: 'dec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        dataUrl,
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
    { id: "func", label: "功能", keys: ["tools", "filter", "official", "comment"] },
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

  function cfgExport(mods, decoIds) {
    const picked = cfgPick(mods);
    /* 按张分享：只保留勾选的装饰图（decorationsVisible 不受影响） */
    if (decoIds && Array.isArray(picked.decorations)) {
      picked.decorations = picked.decorations.filter((d) => decoIds.includes(d.id));
    }
    cfgDownload(
      `lofter-customizer-settings-${mods ? "part" : "all"}-${cfgDate()}.json`,
      {
        _type: "lofter-customizer-settings",
        _format: 1,
        _app: chrome.runtime.getManifest().version,
        _exportedAt: new Date().toISOString(),
        _modules: mods || "all",
        data: picked,
      },
    );
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
      img.src = d.dataUrl;
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
      alert("请先勾选至少一个模块。");
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

  on("cfg-import-file", "change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // 清空，便于连续两次选同一个文件
    if (!f) return;

    let raw = null;
    try {
      raw = JSON.parse(await f.text());
    } catch (err) {
      alert("导入失败：文件不是有效的 JSON 文本。");
      return;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      alert("导入失败：无法识别的配置文件。");
      return;
    }

    /* 兼容两种来源：本扩展导出的包裹格式，以及手写的裸设置对象 */
    const wrapped = raw._type === "lofter-customizer-settings";
    let data = wrapped && raw.data && typeof raw.data === "object" ? raw.data : raw;
    const mods = wrapped && Array.isArray(raw._modules) ? raw._modules : null;

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
      alert("导入失败：文件中没有本扩展认识的设置项。");
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
    if (!confirm(lines.join("\n") + "\n\n继续？")) return;

    const hasSettings = Object.keys(data).length > 0;
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

    /* 追加模式：保留现有装饰图，导入的重新编 id 加在后面（防 id 撞车） */
    if (decoMode === "append") {
      const stamp = Date.now();
      const inc = incomingDecs.map((d, i) => ({
        ...LC_clone(d),
        id: "dec_" + stamp + "_" + i + "_" + Math.random().toString(36).slice(2, 6),
      }));
      state.decorations = currentDecsBefore.concat(inc);
    }

    render();
    initRanges();
    save();
    /* 自定义表情：原始键直接落 storage（content.js 与 popup 都读同一份），
       本地缓存同步更新，避免连续导入两次时用的是旧缓存 */
    if ((!mods || mods.includes("emoji")) && Object.keys(rawIn).length) {
      chrome.storage.local.set(LC_clone(rawIn));
      Object.assign(lcRawCache, LC_clone(rawIn));
    }
    alert("导入完成。刷新 LOFTER 页面后生效。");
  });

  buildFontOptions();
  chrome.storage.local.get([LC_STORAGE_KEY].concat(LC_RAW_KEYS), (res) => {
    /* LC_migrateNav：老配置「导航栏透明」迁移为毛玻璃（本批两档化） */
    state = LC_migrateNav(LC_merge(LC_DEFAULTS, res[LC_STORAGE_KEY] || {}));
    /* 原始键（自定义表情）本地缓存：导出取它、导入回写它 */
    LC_RAW_KEYS.forEach((k) => {
      if (res[k] !== undefined) lcRawCache[k] = res[k];
    });
    render();
    initRanges();
    syncCfgMods(); // 装饰图计数/按张入口依赖加载后的 state.decorations，初渲染时还没到手
    lcStateLoaded = true; // 真值已到手，可以撤首开防白闪的预判标记了
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

    soundFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 1024 * 1024) {
        alert('文件超过 1MB 限制，请选择更小的文件');
        return;
      }

      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
      const validExts = ['.mp3', '.wav'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        alert('仅支持 MP3 或 WAV 格式');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        soundModalPending.preset = 'custom';
        soundModalPending.soundFile = ev.target.result;
        soundModalPending.soundFileName = file.name;
        renderSoundModal();
        saveSoundConfig(); // 即时保存

        // 自动试听
        const audio = new Audio(ev.target.result);
        audio.play().catch(() => { });
      };
      reader.readAsDataURL(file);
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
        const audio = new Audio(soundModalPending.soundFile);
        audio.play().catch(() => { });
      }
    });

    // 删除自定义音频
    $('lc-sound-delete-custom').addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发父元素的选中
      soundModalPending.preset = 'pop';
      soundModalPending.soundFile = '';
      soundModalPending.soundFileName = '';
      soundFileInput.value = '';
      renderSoundModal();
      saveSoundConfig(); // 即时保存
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
    const mode = (s.darkMode && s.darkMode.mode) || "off";
    document.body.classList.toggle(
      "dark",
      mode === "manual" || (mode === "auto" && darkMq.matches),
    );
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
    if (touched) render();
  });

})();
