/* popup.js */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let state = LC_clone(LC_DEFAULTS);

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

  /* 返回顶层图片大小组显隐 */
  function syncGtotopSize() {
    $("gtotop-size-row").hidden = !state.gtotop || !state.gtotop.imageDataUrl;
  }

  /* 同步装饰图编辑按钮的显示状态 */
  function syncDecEditButtons(isEditing) {
    const hasDecs = (state.decorations || []).length > 0;
    const editBtn = $("dec-enter-edit");
    const exitBtn = $("dec-exit-edit");
    const toggleVisBtn = $("dec-toggle-visibility");

    if (!hasDecs) {
      editBtn.style.display = "none";
      exitBtn.style.display = "none";
      if (toggleVisBtn) toggleVisBtn.style.display = "none";
    } else if (isEditing) {
      editBtn.style.display = "none";
      exitBtn.style.display = "";
      if (toggleVisBtn) toggleVisBtn.style.display = "none";
    } else {
      editBtn.style.display = "";
      exitBtn.style.display = "none";
      if (toggleVisBtn) toggleVisBtn.style.display = "";
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
    });

    arr.forEach((dec, idx) => {
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid var(--lc-line);border-radius:8px;padding:10px;background:var(--lc-soft);";
      const ia = dec.interactive;
      const isOpen = card.dataset.interactiveOpen === "true";

      card.innerHTML = `
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <img src="${dec.dataUrl}" style="width:52px;height:52px;object-fit:contain;border-radius:6px;background:#eee;flex-shrink:0;" />
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;color:var(--lc-text);font-weight:500;">装饰 #${idx + 1}</span>
              <button class="btn" data-del="${idx}" style="padding:2px 8px;font-size:11px;flex-shrink:0;">删除</button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <label class="dec-toggle" style="font-size:11px;cursor:pointer;">
                <input type="checkbox" data-idx="${idx}" data-key="enabled" ${dec.enabled !== false ? 'checked' : ''} />
                <span style="color:${dec.enabled !== false ? '#22c55e' : 'var(--lc-sub)'};font-weight:${dec.enabled !== false ? '500' : 'normal'};transition:color 0.2s;">显示</span>
              </label>
              <label class="dec-toggle" style="font-size:11px;cursor:pointer;">
                <input type="checkbox" data-idx="${idx}" data-key="aboveCards" ${dec.aboveCards ? 'checked' : ''} />
                <span style="color:${dec.aboveCards ? '#22c55e' : 'var(--lc-sub)'};font-weight:${dec.aboveCards ? '500' : 'normal'};transition:color 0.2s;">覆盖卡片</span>
              </label>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;">透明</span>
              <input type="range" data-idx="${idx}" data-key="opacity" min="10" max="100" value="${dec.opacity ?? 100}" style="flex:1;min-width:0;height:4px;" />
              <span class="value" style="min-width:28px;font-size:11px;">${dec.opacity ?? 100}</span>
            </div>
          </div>
        </div>
        <!-- 互动效果展开栏 -->
        <div style="margin-top:8px;border-top:1px solid var(--lc-line);padding-top:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn" data-toggle-ia="${idx}" type="button" style="padding:4px 0;font-size:12px;color:var(--lc-accent);background:transparent;border:none;text-align:left;display:flex;align-items:center;gap:4px;cursor:pointer;flex:1;">
              <span data-arrow="${idx}" style="display:inline-block;transition:transform 0.2s;${isOpen ? 'transform:rotate(90deg);' : ''}">▶</span>
              <span>互动效果</span>
            </button>
            <button class="btn" data-ia-toggle="${idx}" type="button" style="font-size:11px;flex-shrink:0;padding:2px 8px;border-radius:10px;transition:all 0.2s;cursor:pointer;border:none;${ia.enabled ? 'color:#22c55e;background:color-mix(in srgb,#22c55e 12%,var(--lc-card));font-weight:500;' : 'color:var(--lc-sub);background:var(--lc-soft);'}">${ia.enabled ? '已开启' : '未开启'}</button>
          </div>
          <div data-ia-panel="${idx}" style="${isOpen ? '' : 'display:none;'}padding-top:8px;">
            <p class="hint" style="margin:0 0 8px 0;font-size:11px;color:var(--lc-sub);">开启后默认开启覆盖卡片（确保点击能响应）</p>

<div style="margin-bottom:8px;display:flex;align-items:center;gap:6px;">
  <span style="font-size:11px;color:var(--lc-sub);flex-shrink:0;">呼吸模式</span>
  <select data-idx="${idx}" data-ia-key="breatheMode" style="flex:1;padding:2px 6px;border:1px solid var(--lc-line);border-radius:6px;font-size:12px;background:var(--lc-card);">
    <option value="float" ${(ia?.breatheMode || 'float') !== 'squish' ? 'selected' : ''}>浮动</option>
    <option value="squish" ${(ia?.breatheMode || 'float') === 'squish' ? 'selected' : ''}>挤压</option>
  </select>
  <button class="btn" data-breathe-more="${idx}" type="button" style="padding:2px 8px;font-size:11px;background:var(--lc-soft);border:none;border-radius:6px;cursor:pointer;color:var(--lc-sub);">更多</button>
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
  <input type="range" data-idx="${idx}" data-ia-key="hitScale" min="20" max="100" value="${dec.hitScale ?? 100}" style="flex:1;min-width:0;height:4px;" />
  <span class="value" style="min-width:32px;font-size:11px;">${dec.hitScale ?? 100}%</span>
</div>
            <div data-ia-options="${idx}" style="${ia.enabled ? '' : 'display:none;'}padding-left:10px;border-left:2px solid var(--lc-line);">
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
                <label class="dec-toggle" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
                  <input type="checkbox" data-idx="${idx}" data-ia-key="particles" ${ia.particles ? 'checked' : ''} />
                  <span style="color:${ia.particles ? '#22c55e' : 'var(--lc-sub)'};font-weight:${ia.particles ? '500' : 'normal'};transition:color 0.2s;">弹出emoji粒子</span>
                </label>
                <div style="display:flex;align-items:center;gap:8px;">
                  <input type="text" data-idx="${idx}" data-ia-key="emojis" value="${(ia.emojis || []).join('')}" placeholder="" maxlength="12" style="width:70px;padding:3px 6px;border:1px solid var(--lc-line);border-radius:6px;font-size:16px;text-align:center;" />
                  <span class="hint" style="margin:0;font-size:11px;color:var(--lc-sub);">填写1~3个emoji</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <label class="dec-toggle" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
                  <input type="checkbox" data-idx="${idx}" data-ia-key="sound" ${ia.sound ? 'checked' : ''} />
                  <span style="color:${ia.sound ? '#22c55e' : 'var(--lc-sub)'};font-weight:${ia.sound ? '500' : 'normal'};transition:color 0.2s;">音效</span>
                </label>
                <button class="btn" data-sound-edit="${idx}" type="button" style="padding:2px 10px;font-size:11px;background:var(--lc-soft);border:none;border-radius:6px;cursor:pointer;color:var(--lc-accent);display:${ia.sound ? '' : 'none'};">更多设置</button>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <label class="dec-toggle" style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
                  <input type="checkbox" data-idx="${idx}" data-ia-key="dialogue" ${ia.dialogue ? 'checked' : ''} />
                  <span style="color:${ia.dialogue ? '#22c55e' : 'var(--lc-sub)'};font-weight:${ia.dialogue ? '500' : 'normal'};transition:color 0.2s;">词卡弹窗</span>
                </label>
                <button class="btn" data-dialogue-edit="${idx}" type="button" style="padding:2px 10px;font-size:11px;background:var(--lc-soft);border:none;border-radius:6px;cursor:pointer;color:var(--lc-accent);">编辑词卡 (${(ia.dialogues || []).length})</button>
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
        e.target.nextElementSibling.textContent = val;
        save();
      });
    });

    // 绑定显示/隐藏复选框
    list.querySelectorAll('input[type="checkbox"][data-key]').forEach(input => {
      input.addEventListener("change", (e) => {
        const idx = +e.target.dataset.idx;
        const key = e.target.dataset.key;
        if (!state.decorations[idx]) return;
        state.decorations[idx][key] = e.target.checked;
        // 实时更新文字颜色
        const span = e.target.nextElementSibling;
        if (span) {
          span.style.color = e.target.checked ? '#22c55e' : 'var(--lc-sub)';
          span.style.fontWeight = e.target.checked ? '500' : 'normal';
        }
        save();
      });
    });

    // 绑定互动效果 toggle
    list.querySelectorAll('button[data-ia-toggle]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.iaToggle;
        if (!state.decorations[idx]) return;
        if (!state.decorations[idx].interactive) {
          state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true };
        }
        const newVal = !state.decorations[idx].interactive.enabled;
        state.decorations[idx].interactive.enabled = newVal;
        // 如果正在开启互动效果，自动联动覆盖卡片 + 粒子和音效
        if (newVal) {
          state.decorations[idx].aboveCards = true;
          state.decorations[idx].interactive.particles = true;
          state.decorations[idx].interactive.sound = true;
        }

        // 实时更新按钮样式
        const btnEl = e.currentTarget;
        if (newVal) {
          btnEl.textContent = "已开启";
          btnEl.style.cssText = "font-size:11px;flex-shrink:0;padding:2px 8px;border-radius:10px;transition:all 0.2s;cursor:pointer;border:none;color:#22c55e;background:color-mix(in srgb,#22c55e 12%,var(--lc-card));font-weight:500;";
        } else {
          btnEl.textContent = "未开启";
          btnEl.style.cssText = "font-size:11px;flex-shrink:0;padding:2px 8px;border-radius:10px;transition:all 0.2s;cursor:pointer;border:none;color:var(--lc-sub);background:var(--lc-soft);";
        }

        // 同步更新"覆盖卡片"开关的显示状态
        const aboveCheckbox = list.querySelector(`input[data-idx="${idx}"][data-key="aboveCards"]`);
        if (aboveCheckbox) {
          aboveCheckbox.checked = state.decorations[idx].aboveCards;
          const aboveSpan = aboveCheckbox.nextElementSibling;
          if (aboveSpan) {
            aboveSpan.style.color = aboveCheckbox.checked ? '#22c55e' : 'var(--lc-sub)';
            aboveSpan.style.fontWeight = aboveCheckbox.checked ? '500' : 'normal';
          }
        }

        // 同步更新 particles 和 sound 开关的显示状态
        const particlesCheckbox = list.querySelector(`input[data-idx="${idx}"][data-ia-key="particles"]`);
        if (particlesCheckbox) {
          particlesCheckbox.checked = state.decorations[idx].interactive.particles;
          const particlesSpan = particlesCheckbox.nextElementSibling;
          if (particlesSpan) {
            particlesSpan.style.color = particlesCheckbox.checked ? '#22c55e' : 'var(--lc-sub)';
            particlesSpan.style.fontWeight = particlesCheckbox.checked ? '500' : 'normal';
          }
        }
        const soundCheckbox = list.querySelector(`input[data-idx="${idx}"][data-ia-key="sound"]`);
        if (soundCheckbox) {
          soundCheckbox.checked = state.decorations[idx].interactive.sound;
          const soundSpan = soundCheckbox.nextElementSibling;
          if (soundSpan) {
            soundSpan.style.color = soundCheckbox.checked ? '#22c55e' : 'var(--lc-sub)';
            soundSpan.style.fontWeight = soundCheckbox.checked ? '500' : 'normal';
          }
        }

        // 显示/隐藏子选项
        const card = list.children[idx];
        const optionsDiv = card.querySelector(`[data-ia-options="${idx}"]`);
        if (optionsDiv) {
          optionsDiv.style.display = newVal ? "" : "none";
        }
        save();
      });
    });

    // 绑定 particles 和 sound 复选框
    list.querySelectorAll('input[type="checkbox"][data-ia-key]').forEach(input => {
      input.addEventListener("change", (e) => {
        const idx = +e.target.dataset.idx;
        const key = e.target.dataset.iaKey;
        if (!state.decorations[idx]) return;
        if (!state.decorations[idx].interactive) {
          state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true };
        }
        state.decorations[idx].interactive[key] = e.target.checked;
        // 实时更新文字颜色
        const span = e.target.nextElementSibling;
        if (span) {
          span.style.color = e.target.checked ? '#22c55e' : 'var(--lc-sub)';
          span.style.fontWeight = e.target.checked ? '500' : 'normal';
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

      // 呼吸模式下拉框
      list.querySelectorAll('select[data-ia-key="breatheMode"]').forEach(select => {
        select.addEventListener("change", (e) => {
          const idx = +e.target.dataset.idx;
          if (!state.decorations[idx]) return;
          if (!state.decorations[idx].interactive) {
            state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal' };
          }
          state.decorations[idx].interactive.breatheMode = e.target.value;
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

    // 词卡弹窗开关
    list.querySelectorAll('input[type="checkbox"][data-ia-key="dialogue"]').forEach(input => {
      input.addEventListener("change", (e) => {
        const idx = +e.target.dataset.idx;
        if (!state.decorations[idx]) return;
        if (!state.decorations[idx].interactive) {
          state.decorations[idx].interactive = { enabled: false, particles: false, emojis: ["\u2728"], sound: false, breathe: true, squeezeStrength: 15, bounceStyle: 'elastic', breatheMode: 'float', breatheAmplitude: 30, breatheSpeed: 'normal', dialogue: false, dialogues: [] };
        }
        state.decorations[idx].interactive.dialogue = e.target.checked;
        const span = e.target.nextElementSibling;
        if (span) {
          span.style.color = e.target.checked ? '#22c55e' : 'var(--lc-sub)';
          span.style.fontWeight = e.target.checked ? '500' : 'normal';
        }
        save();
      });
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

    // 暗色
    $("dark-mode").value = s.darkMode.mode || 'off';
    $("dark-brightness").value = s.darkMode.brightness || 90;
    $("dark-brightness-v").textContent = (s.darkMode.brightness || 90) + "%";

    // 导航
    $("nav-transparent").checked = s.navbar.transparent;
    $("nav-blur").checked = s.navbar.blur;
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

    // 功能栏
    $("tool-wordcount").checked = !!(s.tools && s.tools.wordCount);

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
  });
  on("font-scale", "input", (e) => { state.font.scale = +e.target.value; $("font-scale-v").textContent = e.target.value + "%"; save(); });
  on("font-family", "input", (e) => { state.font.family = e.target.value.trim(); save(); });
  /* 字体名"?"帮助：点击展开/收起详细说明 */
  on("font-family-help", "click", () => {
    const dot = $("font-family-help");
    const hint = $("font-family-hint");
    const open = hint.classList.toggle("open");
    dot.classList.toggle("on", open);
  });

  on("dark-mode", "change", (e) => { state.darkMode.mode = e.target.value; syncDarkBrightness(); save(); });
  on("nav-transparent", "change", (e) => {
    state.navbar.transparent = e.target.checked;
    if (!e.target.checked) { state.navbar.blur = false; $("nav-blur").checked = false; }
    save();
  });
  on("dark-brightness", "input", (e) => { state.darkMode.brightness = +e.target.value; $("dark-brightness-v").textContent = e.target.value + "%"; save(); });
  on("nav-blur", "change", (e) => {
    state.navbar.blur = e.target.checked;
    if (e.target.checked) { state.navbar.transparent = true; $("nav-transparent").checked = true; }
    save();
  });
  on("th-accent", "input", (e) => { state.theme.accent = e.target.value; save(); });
  on("search-placeholder", "input", (e) => { state.searchPlaceholder = e.target.value.trim() || "搜索用户、标签"; save(); }); 

  on("reset", "click", () => { if (!confirm("确定要全部重置吗？")) return; state = LC_clone(LC_DEFAULTS); render(); save(); });

  /* 功能栏：长文章实时字数统计（默认关闭，见 defaults.js 开发约定） */
  on("tool-wordcount", "change", (e) => {
    if (!state.tools) state.tools = LC_clone(LC_DEFAULTS.tools);
    state.tools.wordCount = e.target.checked;
    save();
  });

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

          // 呼吸动画（已有）
          breathe: true,
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
    { id: "nav", label: "导航", keys: ["navbar", "searchPlaceholder", "gtotop"] },
    { id: "func", label: "功能", keys: ["tools"] },
    { id: "misc", label: "其他", keys: ["shortcutsEnabled", "panel"] },
  ];
  /* 允许写入 storage 的键白名单：导入时剔除非本扩展的键，避免脏数据进配置 */
  const LC_KNOWN_KEYS = new Set(LC_MODULES.flatMap((m) => m.keys));

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

  /* 从当前 state 里挑出指定模块的键；mods 为 null 表示整份快照 */
  function cfgPick(mods) {
    const data = {};
    if (!mods) return LC_clone(state);
    mods.forEach((id) => {
      const m = LC_MODULES.find((x) => x.id === id);
      if (!m) return;
      m.keys.forEach((k) => {
        if (state[k] !== undefined) data[k] = LC_clone(state[k]);
      });
    });
    return data;
  }

  function cfgExport(mods) {
    const picked = cfgPick(mods);
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

  on("cfg-export-all", "click", () => cfgExport(null));

  on("cfg-export-part", "click", () => {
    const mods = [...$("cfg-modules").querySelectorAll("input[data-mod]")]
      .filter((i) => i.checked)
      .map((i) => i.dataset.mod);
    if (!mods.length) {
      alert("请先勾选至少一个模块。");
      return;
    }
    cfgExport(mods);
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
    if (!Object.keys(data).length) {
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

    const lines = [
      `即将导入${scope}。`,
      "",
      mods
        ? "只覆盖上述模块的设置，未包含的项保持当前值不变。"
        : "会覆盖当前全部设置（未包含的项回到默认值）。",
      "导入后需刷新 LOFTER 页面才会生效。",
    ];
    if (dropped.length) lines.push("", `已忽略无法识别的项：${dropped.join("、")}`);
    if (!confirm(lines.join("\n") + "\n\n继续？")) return;

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
      state = LC_merge(state, patch);
    } else {
      state = LC_merge(LC_DEFAULTS, data);
    }

    render();
    initRanges();
    save();
    alert("导入完成。刷新 LOFTER 页面后生效。");
  });

  buildFontOptions();
  chrome.storage.local.get(LC_STORAGE_KEY, (res) => {
    state = LC_merge(LC_DEFAULTS, res[LC_STORAGE_KEY] || {});
    render();
    initRanges();
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
  }
  darkMq.addEventListener("change", () => applyDarkFollow(state));
  /* 面板常驻 iframe：网页里改了深色模式设置也要实时跟上（只重算暗色，不重渲染） */
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[LC_STORAGE_KEY]) return;
    applyDarkFollow(LC_merge(LC_DEFAULTS, ch[LC_STORAGE_KEY].newValue || {}));
  });

})();
