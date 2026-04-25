// CleanFeed — YouTube enhancements
// Features: Remove video recommendations, Remove comments

(function () {
  'use strict';
  if (window.__cfYouTubeLoaded) return;
  window.__cfYouTubeLoaded = true;

  const isYT = location.hostname.includes('youtube.com');
  if (!isYT) return;

  let cfg = {
    ytRemoveRecommendations: false,
    ytRemoveComments: false,
    ytRedirectToSubs: false,
  };

  // ── Redirect to Subscriptions ──────────────────────────────────────────

  function isHomepage(path) {
    return path === '/' || path === '' || /^\/?(\?.*)?$/.test(path);
  }

  function maybeRedirect() {
    if (!cfg.ytRedirectToSubs) return;
    if (isHomepage(location.pathname + location.search)) {
      location.replace('https://www.youtube.com/feed/subscriptions');
    }
  }

  // YouTube SPA fires yt-navigate-finish after every client-side navigation.
  // We intercept it to catch logo clicks and back-navigations to the homepage.
  window.addEventListener('yt-navigate-finish', () => {
    maybeRedirect();
  });

  // ── Remove video recommendations ────────────────────────────────────────

  function removeVideoRecommendations() {
    if (!cfg.ytRemoveRecommendations) return;

    // Hide secondary results (right sidebar recommendations when watching)
    document.querySelectorAll('ytd-watch-next-secondary-results-renderer').forEach((el) => {
      el.style.display = 'none';
    });

    // Hide watch next results
    document.querySelectorAll('ytd-watch-next-results').forEach((el) => {
      el.style.display = 'none';
    });

    // Hide secondary results
    document.querySelectorAll('ytd-secondary-results').forEach((el) => {
      el.style.display = 'none';
    });

    // Hide endscreen (video finished recommendations)
    document.querySelectorAll('ytd-endscreen-renderer').forEach((el) => {
      el.style.display = 'none';
    });

    // Hide endscreen container
    document.querySelectorAll('.ytp-endscreen-container').forEach((el) => {
      el.style.display = 'none';
    });
  }

  // ── Remove comments ────────────────────────────────────────────────────

  function removeComments() {
    if (!cfg.ytRemoveComments) return;

    // Hide main comments container
    document.querySelectorAll('ytd-comments').forEach((el) => {
      el.style.display = 'none';
    });

    // Hide comments section renderer (alternative structure)
    document.querySelectorAll('ytd-comments-section-renderer').forEach((el) => {
      el.style.display = 'none';
    });

    // Hide comment view models
    document.querySelectorAll('ytd-comment-view-model').forEach((el) => {
      el.style.display = 'none';
    });

    // Hide comment thread renderers
    document.querySelectorAll('yt-comment-thread-renderer').forEach((el) => {
      el.style.display = 'none';
    });
  }

  // ── Handle features ────────────────────────────────────────────────────

  function applyYouTubeFeatures() {
    removeVideoRecommendations();
    removeComments();

    if (cfg.ytRemoveRecommendations) {
      document.documentElement.classList.add('cf-yt-remove-recommendations');
    } else {
      document.documentElement.classList.remove('cf-yt-remove-recommendations');
    }

    if (cfg.ytRemoveComments) {
      document.documentElement.classList.add('cf-yt-remove-comments');
    } else {
      document.documentElement.classList.remove('cf-yt-remove-comments');
    }
  }


  // ── MutationObserver ──────────────────────────────────────────────────

  const observer = new MutationObserver(() => {
    requestAnimationFrame(() => {
      applyYouTubeFeatures();
    });
  });

  const startObserver = () => {
    observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true,
      attributes: false,
      characterData: false
    });
    applyYouTubeFeatures();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // ── Storage ────────────────────────────────────────────────────────────

  chrome.storage.sync.get(
    { ytRemoveRecommendations: false, ytRemoveComments: false, ytRedirectToSubs: false },
    (s) => {
      cfg.ytRemoveRecommendations = s.ytRemoveRecommendations;
      cfg.ytRemoveComments = s.ytRemoveComments;
      cfg.ytRedirectToSubs = s.ytRedirectToSubs;
      maybeRedirect();
      applyYouTubeFeatures();
    }
  );

  chrome.storage.onChanged.addListener((changes) => {
    if ('ytRemoveRecommendations' in changes) {
      cfg.ytRemoveRecommendations = changes.ytRemoveRecommendations.newValue;
      applyYouTubeFeatures();
    }
    if ('ytRemoveComments' in changes) {
      cfg.ytRemoveComments = changes.ytRemoveComments.newValue;
      applyYouTubeFeatures();
    }
    if ('ytRedirectToSubs' in changes) {
      cfg.ytRedirectToSubs = changes.ytRedirectToSubs.newValue;
      applyYouTubeFeatures();
    }
  });

  applyYouTubeFeatures();
})();
