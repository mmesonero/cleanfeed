// CleanFeed — Instagram (optimized)
// run_at: document_start

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
      t.instagram = (t.instagram || 0) + ms;
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

  if (window.__cfIgLoaded) return;
  window.__cfIgLoaded = true;

  // ── CSS inmediato: sidebar Reels button ──────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.id = 'cf-ig';
  styleEl.textContent = 'a[href="/reels/"] { display: none !important; }';
  document.documentElement.appendChild(styleEl);

  function buildCss() {
    const parts = [];

    if (sidebarActive) {
      parts.push('a[href="/reels/"] { display: none !important; }');
    }

    if (metricsActive) {
      parts.push(`
        section main article ul ul,
        section main article div[role="button"] span.html-span,
        section main article a[href$="/liked_by/"],
        section main article a[href*="/liked_by/"],
        section main article span[title][dir="auto"] {
          display: none !important;
        }
      `);
    }

    return parts.join('\n');
  }

  function applyStyles() {
    styleEl.textContent = buildCss();
  }

  // ── Detección: Reels ─────────────────────────────────────────────────────
  // Usa videoHeight/videoWidth en lugar de getBoundingClientRect (sin layout thrash)

  function isReel(post) {
    const video = post.querySelector('video');
    if (!video) return false;

    const h = video.videoHeight || video.clientHeight;
    const w = video.videoWidth  || video.clientWidth;
    if (h > 0 && w > 0) return h > w * 1.1;

    return post.textContent.includes('Reels');
  }

  // ── Detección: sugerencias ───────────────────────────────────────────────
  // Usa textContent (no innerText) → no fuerza layout reflow

  function isSuggested(post) {
    const txt = post.textContent || '';

    if (
      txt.includes('Sugerencia para ti')  ||
      txt.includes('Sugerencias para ti') ||
      txt.includes('Suggested for you')
    ) return true;

    return Array.from(post.querySelectorAll('button, a'))
      .some(el => /^(seguir|follow)$/i.test((el.textContent || '').trim()));
  }

  // ── Cache + hide ─────────────────────────────────────────────────────────
  // WeakMap: O(1) lookup, sin memory leak cuando los posts salen del DOM

  let seen = new WeakMap();

  function processPost(post) {
    if (seen.has(post)) return;
    seen.set(post, true);

    if (isReel(post) || isSuggested(post)) {
      post.style.setProperty('display', 'none', 'important');
      post.dataset.cfHidden = '1';
    }
  }

  function restoreHidden() {
    document.querySelectorAll('[data-cf-hidden="1"]').forEach(el => {
      el.style.removeProperty('display');
      delete el.dataset.cfHidden;
    });
    seen = new WeakMap(); // Reset cache para re-evaluar si se reactiva
  }

  // ── Throttle independiente por tarea ─────────────────────────────────────

  let feedPending    = false;
  let sidebarPending = false;

  function scheduleFeed() {
    if (feedPending) return;
    feedPending = true;
    requestAnimationFrame(() => { feedPending = false; cleanFeed(); });
  }

  function scheduleSidebar() {
    if (sidebarPending) return;
    sidebarPending = true;
    requestAnimationFrame(() => {
      sidebarPending = false;
      document.querySelectorAll('a[href="/reels/"]').forEach(el =>
        el.style.setProperty('display', 'none', 'important')
      );
    });
  }

  // ── Feed scan (scope limitado a <main>) ──────────────────────────────────

  function cleanFeed() {
    const root = document.querySelector('main');
    if (!root) return;
    root.querySelectorAll('article').forEach(processPost);
  }

  // ── Un solo MutationObserver para ambas tareas ───────────────────────────

  let sidebarActive = true;
  let feedActive    = false;
  let metricsActive = false;

  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => m.addedNodes.length > 0)) return;
    if (sidebarActive) scheduleSidebar();
    if (feedActive)    scheduleFeed();
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  chrome.storage.sync.get({ hideReels: true, igOnlyFollowing: false, igHideMetrics: false }, s => {
    sidebarActive = s.hideReels;
    feedActive = s.igOnlyFollowing;
    metricsActive = s.igHideMetrics;
    applyStyles();

    startObserver();
    if (feedActive) scheduleFeed();
  });

  chrome.storage.onChanged.addListener(changes => {
    if ('hideReels' in changes) {
      sidebarActive = changes.hideReels.newValue;
      applyStyles();
      if (!sidebarActive) {
        document.querySelectorAll('a[href="/reels/"]').forEach(el =>
          el.style.removeProperty('display')
        );
      }
    }

    if ('igOnlyFollowing' in changes) {
      feedActive = changes.igOnlyFollowing.newValue;
      if (feedActive) {
        scheduleFeed();
      } else {
        restoreHidden();
      }
    }

    if ('igHideMetrics' in changes) {
      metricsActive = changes.igHideMetrics.newValue;
      applyStyles();
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startObserver();
      if (feedActive) scheduleFeed();
    });
  } else {
    startObserver();
    if (feedActive) scheduleFeed();
  }
})();
