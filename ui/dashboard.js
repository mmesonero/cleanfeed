const {
  CREATOR_LINKS,
  PLATFORMS,
  getMetrics,
  getSyncSettings,
  globalSummary,
  setSyncSetting,
  touchLastOpened,
  getToolLocks,
  setToolLock,
  getPlatformOrder,
  setPlatformOrder,
  getOrderedPlatforms,
  getTimeSpent,
  formatTime,
} = window.CleanFeedShared;

function statCard(value, label) {
  return `
    <article class="stat-card">
      <div class="stat-value gold">${value}</div>
      <div class="stat-label">${label}</div>
    </article>
  `;
}


async function renderStats(settings, metrics, toolLocks) {
  const summary = globalSummary(metrics);

  // Count all platform settings; locked platform = all its settings count as active
  let enabled = 0;
  let total = 0;
  PLATFORMS.forEach((platform) => {
    const isLocked = !!toolLocks[platform.id];
    platform.settings.forEach((setting) => {
      total++;
      if (isLocked || !!settings[setting.id]) enabled++;
    });
  });

  // Real tracked time: Shorts + X + Instagram + TikTok (excludes full YouTube sessions)
  const timeSpent = await getTimeSpent();
  const TRACKED_KEYS = new Set(['youtubeShorts', 'x', 'instagram', 'tiktok']);
  const totalMs = Object.entries(timeSpent)
    .filter(([k]) => TRACKED_KEYS.has(k))
    .reduce((s, [, ms]) => s + (ms || 0), 0);
  const timeLostTotal = totalMs >= 60000 ? formatTime(totalMs) : '< 1m';

  document.getElementById("stats-grid").innerHTML = [
    statCard(`${enabled}/${total}`, "rules active"),
    statCard(String(summary.blocksLast7d), "blocked last 7d"),
    statCard(String(summary.bypassesLast7d), "bypasses last 7d"),
    statCard(timeLostTotal, "time lost total"),
  ].join("");
}

function platformActiveCount(settings, platform) {
  return platform.settings.reduce((count, setting) => count + (settings[setting.id] ? 1 : 0), 0);
}

function platformCard(platform, settings, toolLocks) {
  const isLocked = !!toolLocks[platform.id];

  const rows = isLocked ? `` : platform.settings.map((setting) => `
    <div class="setting-row">
      <div class="setting-copy">
        <div class="setting-name">${setting.name}</div>
        <div class="setting-desc">${setting.description}</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="dash-${setting.id}" data-setting-id="${setting.id}"
          ${settings[setting.id] ? "checked" : ""} />
        <span class="slider"></span>
      </label>
    </div>
  `).join("");

  return `
    <article class="platform-card${isLocked ? " platform-card-locked" : ""}" data-platform-id="${platform.id}" draggable="true">
      <div class="platform-card-head">
        <span class="drag-handle">⠿</span>
        ${PLATFORM_ICONS[platform.id] || `<img src="${platform.icon}" alt="" style="width:22px;height:22px;border-radius:6px;object-fit:cover" />`}
        <div class="platform-card-title">${platform.label}</div>
        <div class="platform-card-count">${isLocked ? "Blocked" : `${platformActiveCount(settings, platform)}/${platform.settings.length} on`}</div>
        <button type="button" class="lock-btn${isLocked ? " lock-btn-active" : ""}"
          data-platform-id="${platform.id}"
          title="${isLocked ? "Desbloquear" : "Bloquear esta app"}">
          ${isLocked ? "🔒" : "🔓"}
        </button>
      </div>
      ${rows}
    </article>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STEP_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_PRESETS = [3, 5, 10, 15, 20, 30, 60, 90];

function displayKey(k) {
  const map = { ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', ' ': 'Space', Escape: 'Esc', Enter: '↵' };
  return map[k] || k;
}

const PLATFORM_ICONS = {
  youtube: `<div class="platform-icon-wrap" style="background:#FF0000">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
  </div>`,
  x: `<div class="platform-icon-wrap" style="background:#000;border:1px solid #333">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  </div>`,
  instagram: `<div class="platform-icon-wrap" style="background:linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  </div>`,
  tiktok: `<div class="platform-icon-wrap" style="background:#010101;border:1px solid #333">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.19 8.19 0 0 0 4.79 1.52V6.78a4.85 4.85 0 0 1-1.02-.09z"/></svg>
  </div>`,
};

function renderVideoSection(settings) {
  const speedEnabled = !!settings.videoSpeedEnabled;
  const subsEnabled  = !!settings.subsOff;
  const skipEnabled  = !!settings.skipEnabled;
  const keyInc = settings.videoSpeedKeyInc || '+';
  const keyDec = settings.videoSpeedKeyDec || '-';
  const step   = settings.videoSpeedStep != null ? settings.videoSpeedStep : 0.25;
  const skipFwd = settings.skipForwardKey  || 'ArrowRight';
  const skipBwd = settings.skipBackwardKey || 'ArrowLeft';
  const skipSecs = settings.skipSeconds != null ? settings.skipSeconds : 10;
  const activeCount = (subsEnabled ? 1 : 0) + (speedEnabled ? 1 : 0) + (skipEnabled ? 1 : 0);

  const disabledAttr = speedEnabled ? '' : 'disabled';
  const speedCardClass = speedEnabled ? '' : ' platform-card-disabled';
  const stepRow = `
    <div class="step-control">
      <span class="field-hint">step size</span>
      <div class="step-control-row">
        <button type="button" class="step-adj" data-step-dir="-1" data-current-step="${step}" ${disabledAttr}>−</button>
        <span class="step-display">${step}×</span>
        <button type="button" class="step-adj" data-step-dir="1" data-current-step="${step}" ${disabledAttr}>+</button>
      </div>
    </div>
  `;

  const keyRowInc = `
    <div class="key-control">
      <span class="field-hint">key</span>
      <button type="button" class="key-btn" data-key-id="videoSpeedKeyInc" ${disabledAttr}>${escapeHtml(keyInc)}</button>
    </div>
  `;

  const keyRowDec = `
    <div class="key-control">
      <span class="field-hint">key</span>
      <button type="button" class="key-btn" data-key-id="videoSpeedKeyDec" ${disabledAttr}>${escapeHtml(keyDec)}</button>
    </div>
  `;

  const speedCard = `
    <article class="platform-card${speedCardClass}">
      <div class="platform-card-head">
        <div class="platform-card-title">Speed Configuration</div>
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <div class="setting-name">Up</div>
          <div class="setting-desc">+${step}× per press</div>
        </div>
        ${stepRow}
        ${keyRowInc}
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <div class="setting-name">Down</div>
          <div class="setting-desc">−${step}× per press</div>
        </div>
        ${stepRow}
        ${keyRowDec}
      </div>
    </article>
  `;

  const skipDisabledAttr  = skipEnabled ? '' : 'disabled';
  const skipCardClass     = skipEnabled ? '' : ' platform-card-disabled';
  const skipCard = `
    <article class="platform-card${skipCardClass}">
      <div class="platform-card-head">
        <div class="platform-card-title">Skip Configuration</div>
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <div class="setting-name">Forward</div>
          <div class="setting-desc">+${skipSecs}s per press</div>
        </div>
        <div class="step-control">
          <span class="field-hint">seconds</span>
          <div class="step-control-row">
            <button type="button" class="step-adj" data-skip-dir="-1" data-current-skip="${skipSecs}" ${skipDisabledAttr}>−</button>
            <span class="step-display">${skipSecs}s</span>
            <button type="button" class="step-adj" data-skip-dir="1" data-current-skip="${skipSecs}" ${skipDisabledAttr}>+</button>
          </div>
        </div>
        <div class="key-control">
          <span class="field-hint">key</span>
          <button type="button" class="key-btn" data-key-id="skipForwardKey" ${skipDisabledAttr}>${escapeHtml(displayKey(skipFwd))}</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <div class="setting-name">Back</div>
          <div class="setting-desc">−${skipSecs}s per press</div>
        </div>
        <div class="step-control">
          <span class="field-hint">seconds</span>
          <div class="step-control-row">
            <button type="button" class="step-adj" data-skip-dir="-1" data-current-skip="${skipSecs}" ${skipDisabledAttr}>−</button>
            <span class="step-display">${skipSecs}s</span>
            <button type="button" class="step-adj" data-skip-dir="1" data-current-skip="${skipSecs}" ${skipDisabledAttr}>+</button>
          </div>
        </div>
        <div class="key-control">
          <span class="field-hint">key</span>
          <button type="button" class="key-btn" data-key-id="skipBackwardKey" ${skipDisabledAttr}>${escapeHtml(displayKey(skipBwd))}</button>
        </div>
      </div>
    </article>
  `;

  document.getElementById('speed-section').innerHTML = `
    <div class="video-grid">
      <article class="platform-card">
        <div class="platform-card-head">
          <img src="../assets/logo.png" alt="" />
          <div class="platform-card-title">General</div>
          <div class="platform-card-count">${activeCount}/3 on</div>
        </div>
        <div class="setting-row">
          <div class="setting-copy">
            <div class="setting-name">Subtitles always off</div>
            <div class="setting-desc">Auto-disable subtitles on any site</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dash-subsOff" data-setting-id="subsOff"
              ${subsEnabled ? 'checked' : ''} />
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div class="setting-copy">
            <div class="setting-name">Video speed keys</div>
            <div class="setting-desc">Keyboard shortcuts to control playback rate</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dash-videoSpeedEnabled" data-setting-id="videoSpeedEnabled"
              ${speedEnabled ? 'checked' : ''} />
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div class="setting-copy">
            <div class="setting-name">Skip seconds</div>
            <div class="setting-desc">Jump forward / back by configurable seconds</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dash-skipEnabled" data-setting-id="skipEnabled"
              ${skipEnabled ? 'checked' : ''} />
            <span class="slider"></span>
          </label>
        </div>
      </article>
      ${speedCard}
      ${skipCard}
    </div>
  `;
}

// Only handles key-capture and step buttons; toggles handled by bindDashboardToggles
function bindSpeedSection() {
  document.querySelectorAll('.key-btn[data-key-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const keyId = btn.dataset.keyId;
      const originalText = btn.textContent.trim();
      btn.textContent = 'Press a key…';
      btn.classList.add('listening');

      function onKey(e) {
        e.preventDefault();
        e.stopPropagation();
        document.removeEventListener('keydown', onKey, true);
        if (e.key === 'Escape') {
          btn.textContent = originalText;
          btn.classList.remove('listening');
        } else {
          setSyncSetting(keyId, e.key).then(() => refreshDashboard());
        }
      }

      document.addEventListener('keydown', onKey, true);
    });
  });

  // Speed step cycling buttons
  document.querySelectorAll('.step-adj[data-step-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.stepDir, 10);
      const current = parseFloat(btn.dataset.currentStep) || 0.25;
      const idx = STEP_PRESETS.findIndex((v) => Math.abs(v - current) < 0.001);
      const base = idx < 0 ? STEP_PRESETS.indexOf(0.25) : idx;
      const next = Math.max(0, Math.min(STEP_PRESETS.length - 1, base + dir));
      setSyncSetting('videoSpeedStep', STEP_PRESETS[next]).then(() => refreshDashboard());
    });
  });

  // Skip seconds cycling buttons
  document.querySelectorAll('.step-adj[data-skip-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.skipDir, 10);
      const current = parseInt(btn.dataset.currentSkip, 10) || 10;
      const idx = SKIP_PRESETS.findIndex((v) => v === current);
      const base = idx < 0 ? SKIP_PRESETS.indexOf(10) : idx;
      const next = Math.max(0, Math.min(SKIP_PRESETS.length - 1, base + dir));
      setSyncSetting('skipSeconds', SKIP_PRESETS[next]).then(() => refreshDashboard());
    });
  });
}

function renderControls(settings, toolLocks, orderedPlatforms) {
  // 'video' platform is rendered inside the video section below the grid
  const filtered = orderedPlatforms.filter((p) => p.id !== 'video');
  document.getElementById("controls-grid").innerHTML = filtered.map((platform) => {
    return platformCard(platform, settings, toolLocks);
  }).join("");
}

async function refreshDashboard() {
  const [settings, metrics, toolLocks, order] = await Promise.all([
    getSyncSettings(),
    getMetrics(),
    getToolLocks(),
    getPlatformOrder(),
  ]);
  const orderedPlatforms = getOrderedPlatforms(PLATFORMS, order);
  await renderStats(settings, metrics, toolLocks);
  renderControls(settings, toolLocks, orderedPlatforms);
  renderVideoSection(settings);
  bindDashboardToggles();
  bindDashboardLocks(toolLocks);
  bindDashboardDrag(order);
  bindSpeedSection();
}

function bindDashboardToggles() {
  document.querySelectorAll("[data-setting-id]").forEach((input) => {
    input.addEventListener("change", async () => {
      await setSyncSetting(input.dataset.settingId, input.checked);
      await refreshDashboard();
    });
  });
}

function bindDashboardLocks(toolLocks) {
  document.querySelectorAll(".lock-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const platformId = btn.dataset.platformId;
      const newValue = !toolLocks[platformId];
      await setToolLock(platformId, newValue);
      await refreshDashboard();
    });
  });
}

function bindDashboardDrag(order) {
  const grid = document.getElementById("controls-grid");

  grid.querySelectorAll(".platform-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.platformId);
      e.dataTransfer.effectAllowed = "move";
      requestAnimationFrame(() => card.classList.add("dragging"));
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      grid.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      grid.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
      card.classList.add("drag-over");
    });

    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      const fromId = e.dataTransfer.getData("text/plain");
      const toId = card.dataset.platformId;
      if (fromId === toId) return;

      const newOrder = [...order];
      const fi = newOrder.indexOf(fromId);
      const ti = newOrder.indexOf(toId);
      if (fi < 0 || ti < 0) return;
      newOrder.splice(fi, 1);
      const insertAt = fi < ti ? ti : ti;
      newOrder.splice(insertAt, 0, fromId);

      await setPlatformOrder(newOrder);
      await refreshDashboard();
    });
  });
}

function bindCredits() {
  document.getElementById("dashboard-github").addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: CREATOR_LINKS.github });
  });

  document.getElementById("dashboard-linkedin").addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: CREATOR_LINKS.linkedin });
  });
}

async function init() {
  await touchLastOpened();
  await refreshDashboard();
  bindCredits();
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});
