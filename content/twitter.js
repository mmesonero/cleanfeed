// CleanFeed — X/Twitter module

// ── Time tracking ─────────────────────────────────────────────────────────
(function () {
  const CF_TIME_KEY = 'cleanfeedTime';
  let start = document.hidden ? null : Date.now();

  function flush() {
    if (!start) return;
    const ms = Date.now() - start;
    start = null;
    if (ms < 1000) return;
    chrome.storage.local.get({ [CF_TIME_KEY]: {} }, (data) => {
      const t = { ...(data[CF_TIME_KEY] || {}) };
      t.x = (t.x || 0) + ms;
      chrome.storage.local.set({ [CF_TIME_KEY]: t });
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flush(); } else { start = Date.now(); }
  });
  window.addEventListener('beforeunload', flush);
})();

(function () {
  'use strict';

  if (window.__cfXLoaded) return;
  window.__cfXLoaded = true;

  const DEFAULTS = {
    xHideParaTi:    true,
    xCleanSidebar:  true,
    xHidePanel:     true,
    xHideMetrics:   false,
  };

  let cfg = { ...DEFAULTS };

  // ── CSS injection ─────────────────────────────────────────────────────────
  const STYLE_ID = 'cf-x-styles';

  function applyStyles() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }

    const panel  = cfg.xHidePanel   ? `
      [data-testid="sidebarColumn"] section,
      [data-testid="sidebarColumn"] aside,
      [data-testid="sidebarColumn"] nav,
      [data-testid="sidebarColumn"] hr,
      [data-testid="sidebarColumn"] [data-testid="ConnectModule"],
      [data-testid="sidebarColumn"] [data-testid="trendsSection"],
      [data-testid="sidebarColumn"] [data-testid="sidebarRecommendations"],
      [data-testid="sidebarColumn"] [data-testid="trend"],
      [data-testid="sidebarColumn"] [data-testid="UserCell"],
      [role="separator"],
      [data-testid="sidebarColumn"] [aria-label*="Tendencia"] > div > div:not(:has(form[role="search"])),
      [data-testid="sidebarColumn"] [aria-label*="Trending"] > div > div:not(:has(form[role="search"])) { display: none !important; }
      [data-testid="sidebarColumn"] [style*="min-height"] { min-height: 0 !important; overflow: hidden; }
    ` : '';
    const views = cfg.xCleanSidebar ? `
      [data-testid="analyticsButton"],
      [aria-label*="views"],[aria-label*="Views"],
      [aria-label*="vistas"],[aria-label*="Vistas"] { display: none !important; }
    ` : '';
    const metrics = cfg.xHideMetrics ? `
      [data-testid="reply"],[data-testid="retweet"],[data-testid="like"],
      [data-testid="unlike"],[aria-label*="Me gusta"]{display:none!important}
    ` : '';

    el.textContent = panel + views + metrics;
  }

  // ── Tab: eliminar "Para ti" y forzar "Siguiendo" ─────────────────────────
  function handleTabs() {
    if (!cfg.xHideParaTi) return;

    let siguiendoActive = false;

    document.querySelectorAll('[role="tab"]').forEach(tab => {
      const text = (tab.innerText || tab.textContent || '').trim();

      if (/^(Para ti|For you)$/i.test(text)) {
        tab.closest('li, [role="presentation"]')?.remove() ?? tab.remove();
        return;
      }

      if (/^(Siguiendo|Following)$/i.test(text)) {
        if (tab.getAttribute('aria-selected') !== 'true') {
          tab.click();
        }
        siguiendoActive = true;
      }
    });

    return siguiendoActive;
  }

  // ── Sidebar: ocultar items por texto o data-testid ───────────────────────
  const SIDEBAR_LABELS = [
    /^Explorar$/i, /^Explore$/i,
    /^Mensajes$/i, /^Messages$/i,
    /^Premium$/i,
    /^Comunidades$/i, /^Communities$/i,
    /^Verificados$/i, /^Verified Orgs$/i,
  ];

  const SIDEBAR_TESTIDS = [
    'AppTabBar_Explore_Link',
    'AppTabBar_DirectMessage_Link',
  ];

  function cleanSidebar() {
    if (!cfg.xCleanSidebar) return;

    // Por texto en nav
    document.querySelectorAll('nav a, nav [role="link"]').forEach(el => {
      const text = (el.innerText || el.textContent || '').trim();
      if (SIDEBAR_LABELS.some(re => re.test(text))) {
        const li = el.closest('li, [data-testid]');
        (li || el).style.setProperty('display', 'none', 'important');
      }
    });

    // Por data-testid (más estable)
    SIDEBAR_TESTIDS.forEach(id => {
      document.querySelector(`[data-testid="${id}"]`)
        ?.closest('li, [role="listitem"]')
        ?.style.setProperty('display', 'none', 'important');
    });
  }

  function removeRightPanel() {
    if (!cfg.xHidePanel) return;
    const sel = [
      '[data-testid="sidebarColumn"] section',
      '[data-testid="sidebarColumn"] aside',
      '[data-testid="sidebarColumn"] nav',
      '[data-testid="sidebarColumn"] hr',
      '[data-testid="sidebarColumn"] [data-testid="ConnectModule"]',
      '[data-testid="sidebarColumn"] [data-testid="trendsSection"]',
      '[data-testid="sidebarColumn"] [data-testid="sidebarRecommendations"]',
      '[data-testid="sidebarColumn"] [data-testid="trend"]',
      '[data-testid="sidebarColumn"] [data-testid="UserCell"]',
    ].join(',');
    document.querySelectorAll(sel).forEach(el => el.style.setProperty('display', 'none', 'important'));
  }

  // ── Runner principal ──────────────────────────────────────────────────────
  let rafId = null;

  function runAll() {
    handleTabs();
    cleanSidebar();
    removeRightPanel();
  }

  function scheduleRun() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { runAll(); rafId = null; });
  }

  // ── MutationObserver ──────────────────────────────────────────────────────
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.addedNodes.length > 0)) scheduleRun();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ── Storage ───────────────────────────────────────────────────────────────
  chrome.storage.sync.get(DEFAULTS, s => {
    cfg = s;
    applyStyles();
    runAll();
  });

  chrome.storage.onChanged.addListener(changes => {
    let changed = false;
    Object.keys(changes).forEach(k => {
      if (k in cfg) { cfg[k] = changes[k].newValue; changed = true; }
    });
    if (changed) { applyStyles(); runAll(); }
  });

  // Arranque inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { applyStyles(); runAll(); });
  } else {
    applyStyles();
    runAll();
  }
})();
