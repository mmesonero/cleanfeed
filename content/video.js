// CleanFeed — Global video speed HUD + YouTube subtitle auto-off

(function () {
  'use strict';
  if (window.__cfVideoLoaded) return;
  window.__cfVideoLoaded = true;

  const isYT = location.hostname.includes('youtube.com');
  let cfg = { videoSpeedEnabled: true, subsOff: false, videoSpeedKeyInc: '+', videoSpeedKeyDec: '-', videoSpeedStep: 0.25 };
  let subsOffManualEnabled = false;
  let lastUrl = location.href;

  const PRESETS  = [1, 1.25, 1.5, 2, 3];
  const GOLD     = '#d4b062';
  const GOLD_DIM = 'rgba(212,176,98,0.15)';
  const INK      = 'rgba(8,8,10,0.22)';
  const BORDER   = 'rgba(255,255,255,0.08)';
  const MONO     = 'ui-monospace,"JetBrains Mono",monospace';
  const MIN_W    = 280;
  const MIN_H    = 160;

  const hudMap = new WeakMap();

  // ── Build HUD ──────────────────────────────────────────────────────────────

  function buildHUD(video) {
    let savedRate   = video.playbackRate || 1;
    let settingRate = false;
    let dragDx = 0;
    let dragDy = 0;

    const wrap = el('div', {
      'data-cf-hud': '1',
      style: css({
        position: 'fixed',
        zIndex: '2147483640',
        top: '0', left: '0',
        pointerEvents: 'auto',
        transition: 'opacity 0.18s',
      }),
    });

    // ── Pill ────────────────────────────────────────────────────────────────
    const pill = el('div', {
      style: css({
        background: INK,
        color: '#fff',
        font: `600 11px/1 ${MONO}`,
        padding: '3px 7px',
        borderRadius: '999px',
        border: `1px solid ${BORDER}`,
        cursor: 'grab',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        letterSpacing: '0.5px',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        minWidth: '32px',
        textAlign: 'center',
        transition: 'border-color 0.15s, color 0.15s',
      }),
    });

    // ── Drag ────────────────────────────────────────────────────────────────
    pill.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const startDx = dragDx;
      const startDy = dragDy;

      pill.style.cursor = 'grabbing';

      function onMove(ev) {
        dragDx = startDx + (ev.clientX - startClientX);
        dragDy = startDy + (ev.clientY - startClientY);
      }

      function onUp() {
        pill.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ── Menu ────────────────────────────────────────────────────────────────
    const menu = el('div', {
      style: css({
        background: INK,
        border: `1px solid ${BORDER}`,
        borderRadius: '10px',
        padding: '12px 14px',
        marginTop: '7px',
        display: 'none',
        flexDirection: 'column',
        gap: '10px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        minWidth: '210px',
      }),
    });

    // Label row
    const labelRow = el('div', {
      style: css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2px',
      }),
    });
    const labelText = el('span', {
      style: css({
        font: `500 10px/1 ${MONO}`,
        color: 'rgba(255,255,255,0.65)',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
      }),
    });
    labelText.textContent = 'VELOCIDAD';
    const resetBtn = el('button', {
      style: css({
        all: 'unset',
        cursor: 'pointer',
        font: `500 10px/1 ${MONO}`,
        color: 'rgba(255,255,255,0.65)',
        letterSpacing: '0.5px',
        transition: 'color 0.15s',
      }),
    });
    resetBtn.textContent = 'reset';
    resetBtn.addEventListener('click', (e) => { e.stopPropagation(); applyRate(1); });
    resetBtn.addEventListener('mouseenter', () => { resetBtn.style.color = GOLD; });
    resetBtn.addEventListener('mouseleave', () => { resetBtn.style.color = 'rgba(255,255,255,0.65)'; });
    labelRow.append(labelText, resetBtn);

    // Speed display (big centered value)
    const speedLabel = el('div', {
      style: css({
        textAlign: 'center',
        font: `700 20px/1 ${MONO}`,
        color: '#fff',
        letterSpacing: '-0.3px',
        padding: '2px 0',
      }),
    });

    // Slider row — [−] track [+]
    const SLIDER_MIN = 0.25;
    const SLIDER_MAX = 4;

    const sliderRow = el('div', {
      style: css({ display: 'flex', alignItems: 'center', gap: '8px' }),
    });
    const btnDec = iconBtn('−');
    const btnInc = iconBtn('+');

    const trackWrap = el('div', {
      style: css({ flex: '1', position: 'relative', height: '20px', display: 'flex', alignItems: 'center', cursor: 'pointer' }),
    });
    const trackBg = el('div', {
      style: css({ position: 'absolute', left: '0', right: '0', height: '3px', background: 'rgba(255,255,255,0.12)', borderRadius: '999px' }),
    });
    const trackFill = el('div', {
      style: css({ position: 'absolute', left: '0', height: '3px', background: GOLD, borderRadius: '999px', width: '0%' }),
    });
    const thumb = el('img', {
      src: chrome.runtime.getURL('assets/logo.png'),
      style: css({ position: 'absolute', width: '22px', height: '22px', transform: 'translate(-50%,-50%)', top: '50%', left: '0%', cursor: 'grab', display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }),
    });
    trackWrap.append(trackBg, trackFill, thumb);

    function sliderRatio(rate) {
      return (clamp(rate) - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
    }
    function updateSlider(rate) {
      const pct = `${sliderRatio(rate) * 100}%`;
      trackFill.style.width = pct;
      thumb.style.left = pct;
    }

    function rateFromEvent(e) {
      const rect = trackBg.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      return round(SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN));
    }

    thumb.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      thumb.style.cursor = 'grabbing';
      function onMove(ev) { applyRate(clamp(rateFromEvent(ev))); }
      function onUp() {
        thumb.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    trackWrap.addEventListener('click', (e) => {
      if (e.target === thumb) return;
      e.stopPropagation();
      applyRate(clamp(rateFromEvent(e)));
    });

    btnDec.addEventListener('click', (e) => {
      e.stopPropagation();
      applyRate(clamp(round(video.playbackRate - cfg.videoSpeedStep)));
    });
    btnInc.addEventListener('click', (e) => {
      e.stopPropagation();
      applyRate(clamp(round(video.playbackRate + cfg.videoSpeedStep)));
    });

    // Presets row (below slider, like YouTube)
    const presetsRow = el('div', {
      style: css({ display: 'flex', gap: '4px', alignItems: 'flex-start', marginTop: '2px' }),
    });
    const presetBtns = PRESETS.map(speed => {
      const wrap2 = el('div', { style: css({ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }) });
      const b = el('button', {
        style: css({
          all: 'unset',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'center',
          font: `600 11px/1 ${MONO}`,
          color: 'rgba(255,255,255,0.7)',
          padding: '5px 2px',
          borderRadius: '5px',
          border: `1px solid transparent`,
          transition: 'color 0.12s, background 0.12s, border-color 0.12s',
        }),
      });
      b.textContent = speed === 1 ? '1×' : `${speed}×`;
      b.addEventListener('click', (e) => { e.stopPropagation(); applyRate(speed); });
      wrap2.appendChild(b);
      presetsRow.appendChild(wrap2);
      return { btn: b };
    });

    sliderRow.append(btnDec, trackWrap, btnInc);
    menu.append(speedLabel, sliderRow, presetsRow);
    wrap.append(pill, menu);
    document.body.appendChild(wrap);

    // ── Update display ───────────────────────────────────────────────────────
    function update() {
      const r = video.playbackRate;
      const s = `${r}×`;
      pill.textContent = s;
      pill.style.color = r === 1 ? 'rgba(255,255,255,0.42)' : '#fff';
      pill.style.borderColor = r === 1 ? BORDER : 'rgba(212,176,98,0.45)';
      speedLabel.textContent = s;
      updateSlider(r);
      presetBtns.forEach(({ btn }, i) => {
        const active = PRESETS[i] === r;
        btn.style.color = active ? GOLD : 'rgba(255,255,255,0.7)';
        btn.style.background = active ? GOLD_DIM : 'transparent';
        btn.style.borderColor = active ? 'rgba(212,176,98,0.35)' : 'transparent';
      });
    }

    // ── Apply rate (preserves across pause) ──────────────────────────────────
    function applyRate(rate) {
      savedRate = rate;
      settingRate = true;
      video.playbackRate = rate;
      settingRate = false;
      update();
    }

    // ── Hover expand ─────────────────────────────────────────────────────────
    let hideTimer = null;
    wrap.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
      menu.style.display = 'flex';
      update();
    });
    wrap.addEventListener('mouseleave', () => {
      hideTimer = setTimeout(() => { menu.style.display = 'none'; }, 260);
    });

    function getFullscreenRoot() {
      return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    }

    function tick() {
      if (!document.contains(video)) { wrap.remove(); return; }
      const fsRoot = getFullscreenRoot();
      const targetParent = fsRoot && (fsRoot === video || fsRoot.contains(video)) ? fsRoot : document.body;
      if (wrap.parentNode !== targetParent) targetParent.appendChild(wrap);
      const r = video.getBoundingClientRect();
      const tooSmall = r.width < MIN_W || r.height < MIN_H;
      const offscreen = r.bottom < 0 || r.top > window.innerHeight;
      if (tooSmall || offscreen || !cfg.videoSpeedEnabled) {
        wrap.style.opacity = '0';
        wrap.style.pointerEvents = 'none';
      } else {
        wrap.style.opacity = '1';
        wrap.style.pointerEvents = 'auto';
        const x = Math.max(0, Math.min(r.width  - 52, 10 + dragDx));
        const y = Math.max(0, Math.min(r.height - 34, 10 + dragDy));
        wrap.style.top  = `${r.top  + y}px`;
        wrap.style.left = `${r.left + x}px`;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // ── Sync with external speed changes (YouTube native controls) ────────────
    video.addEventListener('ratechange', () => {
      if (settingRate) { update(); return; }
      savedRate = video.playbackRate;
      update();
    });

    video.addEventListener('play', () => {
      if (Math.abs(video.playbackRate - savedRate) > 0.001) {
        video.playbackRate = savedRate;
      }
    });

    update();
    hudMap.set(video, { wrap, update, applyRate });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function el(tag, attrs = {}) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v);
    });
    return e;
  }

  function css(obj) {
    return Object.entries(obj)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
      .join(';');
  }

  function iconBtn(char) {
    const b = el('button', {
      style: css({
        all: 'unset',
        cursor: 'pointer',
        width: '22px',
        height: '22px',
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${BORDER}`,
        borderRadius: '5px',
        font: `600 13px/1 ${MONO}`,
        color: '#fff',
        flexShrink: '0',
        transition: 'background 0.12s',
      }),
    });
    b.textContent = char;
    b.addEventListener('mouseenter', () => { b.style.background = GOLD_DIM; b.style.borderColor = 'rgba(212,176,98,0.3)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'rgba(255,255,255,0.06)'; b.style.borderColor = BORDER; });
    return b;
  }

  function round(n) { return Math.round(n * 100) / 100; }
  function clamp(n) { return Math.min(4, Math.max(0.25, n)); }

  // ── Speed setter ───────────────────────────────────────────────────────────

  function setSpeed(video, rate) {
    const hud = hudMap.get(video);
    if (hud) {
      hud.applyRate(rate);
    } else {
      video.playbackRate = rate;
    }
  }

  // ── Active video ───────────────────────────────────────────────────────────

  function activeVideo() {
    const all = [...document.querySelectorAll('video')];
    return all.find(v => !v.paused && v.readyState > 2) || all[0] || null;
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (!cfg.videoSpeedEnabled) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    const isInc = e.key === cfg.videoSpeedKeyInc;
    const isDec = e.key === cfg.videoSpeedKeyDec;
    if (!isInc && !isDec) return;
    const v = activeVideo();
    if (!v) return;
    e.preventDefault();
    setSpeed(v, clamp(round(v.playbackRate + (isInc ? cfg.videoSpeedStep : -cfg.videoSpeedStep))));
  }, { passive: false });

  // ── Init videos ────────────────────────────────────────────────────────────

  function initVideo(v) {
    if (hudMap.has(v)) return;
    buildHUD(v);
    watchTracks(v);
    if (cfg.subsOff) disableNativeTracks(v);
  }

  function scanVideos() {
    document.querySelectorAll('video').forEach(initVideo);
  }

  // ── Subtitles off ─────────────────────────────────────────────────────────

  // Detect active subtitle buttons by behavior, not by domain.
  // A button is considered "on" if any of these are true:
  //   - aria-pressed="true"
  //   - aria-checked="true"
  //   - aria-label contains "disable subtitles/captions" (button label flips when active)
  //   - has a class like 'active', 'on', 'is-selected', 'enabled'
  const SUBS_BTN_SEL = [
    '[aria-label*="subtitl" i]',
    '[aria-label*="caption" i]',
    '[aria-label*="subtitulo" i]',
    '[class*="subtitle" i]',
    '[class*="caption" i]',
    '[data-testid*="subtitle"]',
    '[data-testid*="caption"]',
  ].join(',');

  const ACTIVE_CLASSES = ['active', 'on', 'is-selected', 'enabled', 'pressed'];

  function isBtnActive(el) {
    if (el.getAttribute('aria-pressed') === 'true') return true;
    if (el.getAttribute('aria-checked') === 'true') return true;
    // Some players (like the CC button in screenshot) mark active via class
    if (ACTIVE_CLASSES.some(c => el.classList.contains(c))) return true;
    // Button whose label says "Disable …" means it's currently ON
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    if (label.startsWith('disable')) return true;
    return false;
  }

  function disableSubsSel() {
    document.querySelectorAll(SUBS_BTN_SEL).forEach(el => {
      if (el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.getAttribute('role') !== 'button') return;
      if (isBtnActive(el)) el.click();
    });
  }

  function disableNativeTracks(video) {
    if (!video.textTracks?.length) return;
    for (const track of video.textTracks) {
      track.mode = 'disabled';
    }
  }

  // ── Shadow DOM subtitle disable ───────────────────────────────────────────

  const shadowObservers = new WeakMap();

  function clickCaptionsBtn(root) {
    // 1. Try the custom element by aria-label (no tag restriction)
    const byLabel = root.querySelector('[aria-label="closed captions"]');
    if (byLabel) {
      if (byLabel.getAttribute('aria-checked') === 'true') byLabel.click();
      return;
    }
    // 2. Fallback: any media-captions-button that is checked
    const byTag = root.querySelector('media-captions-button');
    if (byTag && byTag.getAttribute('aria-checked') === 'true') byTag.click();
  }

  function disableShadowSubs(root) {
    clickCaptionsBtn(root);
    // Also walk nested shadow roots (some players nest them)
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) clickCaptionsBtn(el.shadowRoot);
    });
  }

  function watchShadowRoot(shadowRoot) {
    if (shadowObservers.has(shadowRoot)) return;
    disableShadowSubs(shadowRoot);
    const obs = new MutationObserver(() => {
      if (cfg.subsOff && !subsOffManualEnabled) disableShadowSubs(shadowRoot);
    });
    obs.observe(shadowRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    shadowObservers.set(shadowRoot, obs);
  }

  function disableSubsShadow() {
    // Walk ALL elements in the page looking for shadow roots with caption buttons
    document.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) watchShadowRoot(el.shadowRoot);
    });
  }

  function subtitlesAreActive() {
    if (isYT) {
      const btn = document.querySelector('.ytp-subtitles-button');
      if (btn?.getAttribute('aria-pressed') === 'true') return true;
    }
    if ([...document.querySelectorAll(SUBS_BTN_SEL)].some(isBtnActive)) return true;
    for (const video of document.querySelectorAll('video')) {
      if ([...video.textTracks || []].some((track) => track.mode === 'showing')) return true;
    }
    return false;
  }

  document.addEventListener('click', () => {
    if (!cfg.subsOff) return;
    if (subtitlesAreActive()) subsOffManualEnabled = true;
  }, true);

  document.addEventListener('keydown', () => {
    if (!cfg.subsOff) return;
    if (subtitlesAreActive()) subsOffManualEnabled = true;
  }, true);

  function resetSubsOffState() {
    if (location.href !== lastUrl) {
      subsOffManualEnabled = false;
      lastUrl = location.href;
    }
  }

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
    return result;
  };

  window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
  window.addEventListener('locationchange', resetSubsOffState);

  function disableSubs() {
    if (!cfg.subsOff || subsOffManualEnabled) return;
    if (isYT) {
      const btn = document.querySelector('.ytp-subtitles-button');
      if (btn?.getAttribute('aria-pressed') === 'true') btn.click();
    }
    document.querySelectorAll('video').forEach(disableNativeTracks);
    disableSubsSel();
    disableSubsShadow();
  }

  function watchTracks(video) {
    if (!video.textTracks || video.__cfTracksWatched) return;
    video.__cfTracksWatched = true;
    video.textTracks.addEventListener('addtrack', () => {
      if (cfg.subsOff) disableNativeTracks(video);
    });
  }

  // ── MutationObserver ───────────────────────────────────────────────────────

  new MutationObserver(() => { scanVideos(); disableSubs(); })
    .observe(document.documentElement, { childList: true, subtree: true });

  // ── Storage ────────────────────────────────────────────────────────────────

  chrome.storage.sync.get({ videoSpeedEnabled: true, subsOff: false, videoSpeedKeyInc: '+', videoSpeedKeyDec: '-', videoSpeedStep: 0.25 }, (s) => {
    cfg.videoSpeedEnabled  = s.videoSpeedEnabled;
    cfg.subsOff            = s.subsOff;
    cfg.videoSpeedKeyInc   = s.videoSpeedKeyInc;
    cfg.videoSpeedKeyDec   = s.videoSpeedKeyDec;
    cfg.videoSpeedStep     = s.videoSpeedStep;
    scanVideos();
    disableSubs();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if ('videoSpeedEnabled' in changes) cfg.videoSpeedEnabled = changes.videoSpeedEnabled.newValue;
    if ('videoSpeedKeyInc'  in changes) cfg.videoSpeedKeyInc  = changes.videoSpeedKeyInc.newValue;
    if ('videoSpeedKeyDec'  in changes) cfg.videoSpeedKeyDec  = changes.videoSpeedKeyDec.newValue;
    if ('videoSpeedStep'    in changes) cfg.videoSpeedStep    = changes.videoSpeedStep.newValue;
    if ('subsOff' in changes) {
      cfg.subsOff = changes.subsOff.newValue;
      if (cfg.subsOff) disableSubs();
    }
  });

  scanVideos();
  disableSubs();
})();
