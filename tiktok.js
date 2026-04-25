// CleanFeed — TikTok (content script, document_start)
// Blocking is handled via declarativeNetRequest redirect in background.js.
// This script only runs when TikTok is accessible (not blocked, or bypassed).
(function () {
  'use strict';

  if (window.__cfTkLoaded) return;
  window.__cfTkLoaded = true;

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
        t.tiktok = (t.tiktok || 0) + ms;
        chrome.storage.local.set({ [CF_TIME_KEY]: t });
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { flush(); } else { start = Date.now(); }
    });
    window.addEventListener('beforeunload', flush);
  })();

  // ── Metrics hiding ────────────────────────────────────────────────────────
  let hideMetrics = false;

  const styleEl = document.createElement('style');
  styleEl.id = 'cf-tiktok-metrics';

  function applyMetricStyles() {
    if (!hideMetrics) {
      styleEl.remove();
      return;
    }

    styleEl.textContent = `
      [data-e2e="browse-like-count"],
      [data-e2e="browse-comment-count"],
      [data-e2e="browse-share-count"],
      [data-e2e="undefined-count"],
      [class*="DivActionItemContainer"] strong,
      [class*="DivActionItemContainer"] h4,
      [class*="DivSocialActionBar"] strong,
      [class*="DivSocialActionBar"] h4 {
        display: none !important;
      }
    `;

    if (!styleEl.isConnected) {
      document.documentElement.appendChild(styleEl);
    }
  }

  chrome.storage.sync.get({ ttHideMetrics: false }, ({ ttHideMetrics }) => {
    hideMetrics = ttHideMetrics;
    applyMetricStyles();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && 'ttHideMetrics' in changes) {
      hideMetrics = changes.ttHideMetrics.newValue;
      applyMetricStyles();
    }
  });
})();
