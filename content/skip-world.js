// Runs in MAIN world at document_start — intercepts keydown before any site JS.
// Config is written to dataset.cfSkip by the isolated-world content script.
(function () {
  function getConfig() {
    try { return JSON.parse(document.documentElement.dataset.cfSkip || 'null'); } catch (_) { return null; }
  }

  function activeVideo() {
    // Pierce shadow roots for sites that host the player in a shadow DOM
    function collectVideos(root, out) {
      root.querySelectorAll('video').forEach(v => out.push(v));
      root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) collectVideos(el.shadowRoot, out); });
    }
    const all = [];
    collectVideos(document, all);
    return all.find(v => !v.paused && v.readyState > 1) || all.find(v => v.readyState > 1) || all[0] || null;
  }

  window.addEventListener('keydown', function (e) {
    const cfg = getConfig();
    if (!cfg || !cfg.enabled) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;
    const isFwd = e.key === cfg.forwardKey;
    const isBwd = e.key === cfg.backwardKey;
    if (!isFwd && !isBwd) return;
    const v = activeVideo();
    if (!v) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    v.currentTime = Math.max(0, v.currentTime + (isFwd ? cfg.seconds : -cfg.seconds));
  }, { capture: true });
})();
