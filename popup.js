const {
  CREATOR_LINKS,
  PLATFORMS,
  getSyncSettings,
  globalSummary,
  setSyncSetting,
  touchLastOpened,
  getMetrics,
  getTimeSpent,
  formatTime,
  getToolLocks,
  setToolLock,
  getPlatformOrder,
  setPlatformOrder,
  getOrderedPlatforms,
} = window.CleanFeedShared;

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
}

function activeCount(settings, platform) {
  return platform.settings.reduce((n, s) => n + (settings[s.id] ? 1 : 0), 0);
}

// ── Render social platforms (draggable, lockable) ──────────────────────────

function renderPlatforms(settings, toolLocks, orderedPlatforms) {
  const root = document.getElementById('platform-list');
  root.innerHTML = '';

  // Exclude the 'video' platform — rendered separately in General section
  const social = orderedPlatforms.filter(p => p.id !== 'video');

  social.forEach((platform) => {
    const isLocked = !!toolLocks[platform.id];

    const wrapper = document.createElement('section');
    wrapper.className = 'platform';
    wrapper.dataset.platformId = platform.id;
    // Head
    const head = document.createElement('div');
    head.className = 'platform-head';
    head.innerHTML = `
      <div class="platform-toggle">
        <img class="platform-icon platform-${platform.id}" src="${platform.icon}" alt="" />
        <span class="platform-name">${platform.label}</span>
        <span class="platform-count">${isLocked ? 'Blocked' : `${activeCount(settings, platform)}/${platform.settings.length}`}</span>
      </div>
      <button type="button" class="lock-btn ${isLocked ? 'lock-btn-active' : ''}"
        data-platform-id="${platform.id}">
        ${isLocked ? '🔒' : '🔓'}
      </button>
    `;

    // Settings
    const settingsList = document.createElement('div');
    settingsList.className = 'setting-list';

    if (!isLocked) {
      platform.settings.forEach((setting) => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.innerHTML = `
          <div class="setting-copy">
            <strong class="setting-name">${setting.name}</strong>
            <span class="setting-desc">${setting.description}</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="${setting.id}" ${settings[setting.id] ? 'checked' : ''} />
            <span class="slider"></span>
          </label>
        `;
        settingsList.appendChild(row);
      });
    }

    wrapper.appendChild(head);
    wrapper.appendChild(settingsList);
    root.appendChild(wrapper);

  });

  // Fix image errors
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => { img.style.opacity = '0'; }, { once: true });
  });
}

// ── Render General (video) section ────────────────────────────────────────

function renderGeneral(settings) {
  const videoPlatform = PLATFORMS.find(p => p.id === 'video');
  const section = document.getElementById('general-section');
  if (!videoPlatform) { section.innerHTML = ''; return; }

  const rows = videoPlatform.settings.map(setting => `
    <div class="setting-row">
      <div class="setting-copy">
        <strong class="setting-name">${setting.name}</strong>
        <span class="setting-desc">${setting.description}</span>
      </div>
      <label class="switch">
        <input type="checkbox" id="gen-${setting.id}" ${settings[setting.id] ? 'checked' : ''} />
        <span class="slider"></span>
      </label>
    </div>
  `).join('');

  section.innerHTML = `
    <div class="general-head">
      <div class="general-icon"><img src="logo.png" alt="" /></div>
      <span class="general-name">General</span>
      <button class="dashboard-btn" id="open-dashboard">Full settings ↗</button>
    </div>
    ${rows}
  `;

  document.getElementById('open-dashboard').addEventListener('click', openDashboard);

  videoPlatform.settings.forEach(setting => {
    const el = document.getElementById(`gen-${setting.id}`);
    if (!el) return;
    el.addEventListener('change', async () => {
      await setSyncSetting(setting.id, el.checked);
    });
  });
}

// ── Header meta ───────────────────────────────────────────────────────────

async function updateHeaderMeta(settings) {
  const timeSpent = await getTimeSpent();

  // Count only boolean toggle settings from platform cards + videoSpeedEnabled
  let enabled = 0, total = 0;
  PLATFORMS.forEach(p => {
    p.settings.forEach(s => {
      total++;
      if (settings[s.id]) enabled++;
    });
  });
  total++;
  if (settings.videoSpeedEnabled) enabled++;

  // Exclude YouTube — content.js tracks all YT watching, not just "lost" time
  const socialMs = Object.entries(timeSpent)
    .filter(([k]) => k !== 'youtube')
    .reduce((s, [, ms]) => s + (ms || 0), 0);
  const timePart = socialMs >= 60000 ? ` · ${formatTime(socialMs)} lost` : '';

  document.getElementById('header-meta').textContent =
    `${enabled}/${total} filters${timePart}`;
}

// ── Bind setting toggles ──────────────────────────────────────────────────

function bindSettings(settings, toolLocks, orderedPlatforms) {
  orderedPlatforms.filter(p => p.id !== 'video').forEach((platform) => {
    if (toolLocks[platform.id]) return;
    platform.settings.forEach((setting) => {
      const el = document.getElementById(setting.id);
      if (!el) return;
      el.addEventListener('change', async () => {
        await setSyncSetting(setting.id, el.checked);
        const newSettings = await getSyncSettings();
        await updateHeaderMeta(newSettings);
        const countNode = el.closest('.platform')?.querySelector('.platform-count');
        if (countNode) countNode.textContent = `${activeCount(newSettings, platform)}/${platform.settings.length}`;
      });
    });
  });
}

// ── Bind lock buttons ─────────────────────────────────────────────────────

function bindLocks(toolLocks) {
  document.querySelectorAll('.lock-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const platformId = btn.dataset.platformId;
      await setToolLock(platformId, !toolLocks[platformId]);
      await refresh();
    });
  });
}

// ── Refresh ───────────────────────────────────────────────────────────────

async function refresh() {
  const [settings, toolLocks, order] = await Promise.all([
    getSyncSettings(),
    getToolLocks(),
    getPlatformOrder(),
  ]);
  const orderedPlatforms = getOrderedPlatforms(PLATFORMS, order);
  renderPlatforms(settings, toolLocks, orderedPlatforms);
  renderGeneral(settings);
  bindSettings(settings, toolLocks, orderedPlatforms);
  bindLocks(toolLocks);
  await updateHeaderMeta(settings);
}

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  await touchLastOpened();
  await refresh();
}

document.addEventListener('DOMContentLoaded', init);
