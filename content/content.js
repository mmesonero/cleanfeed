// CleanFeed — YouTube
// Objetivo: eliminar únicamente Shorts. El resto de YouTube queda intacto.

// ── Time tracking (Shorts only) ───────────────────────────────────────────
(function () {
  const CF_TIME_KEY = 'cleanfeedTime';
  let start = null;

  function onShorts() {
    return location.pathname.startsWith('/shorts/');
  }

  function save(ms) {
    try {
      const storageLocal = chrome?.storage?.local;
      if (!storageLocal?.get) return;
      storageLocal.get({ [CF_TIME_KEY]: {} }, (data) => {
        const t = { ...(data[CF_TIME_KEY] || {}) };
        t.youtubeShorts = (t.youtubeShorts || 0) + ms;
        storageLocal.set({ [CF_TIME_KEY]: t });
      });
    } catch (_) {}
  }

  function flush() {
    if (!start) return;
    const ms = Date.now() - start;
    start = null;
    if (ms >= 1000) save(ms);
  }

  // Single sync function: start tracking if on Shorts and visible, stop otherwise.
  function sync() {
    if (document.hidden || !onShorts()) {
      flush();
    } else if (!start) {
      start = Date.now();
    }
  }

  document.addEventListener('visibilitychange', sync);
  window.addEventListener('yt-navigate-finish', sync);
  window.addEventListener('beforeunload', flush);

  sync();
})();

// Añadir cf-shorts en document_start activa las reglas CSS de hide.css
// antes de que el navegador pinte nada — cero parpadeo para elementos
// que el CSS puede seleccionar por atributo o componente.
document.documentElement.classList.add("cf-shorts");
// ytHideMetrics se activa en storage.sync.get más abajo; clase por defecto off

// ── Helpers ───────────────────────────────────────────────────────────────

function hide(el) {
  el.style.setProperty("display", "none", "important");
}

function shelfIsShorts(shelf) {
  // Comprueba el título del shelf — más fiable que buscar en todo el innerText
  const header = shelf.querySelector("#header, #title, h2, #shelf-header, h3");
  if (header?.textContent.includes("Shorts")) return true;
  const first = shelf.querySelector("yt-formatted-string");
  return first?.textContent.includes("Shorts") ?? false;
}

// ── Única función de limpieza: SOLO Shorts ────────────────────────────────

function removeShorts() {
  if (!document.documentElement.classList.contains("cf-shorts")) return;

  // 1. Botón "Shorts" en sidebar
  //    YouTube retiró el href /shorts; detectamos por texto exacto.
  document.querySelectorAll("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer").forEach((el) => {
    if (el.querySelector("yt-formatted-string")?.textContent.trim() === "Shorts") hide(el);
  });

  // 2. Chip "Shorts" en barra de filtros
  document.querySelectorAll("yt-chip-cloud-chip-renderer").forEach((el) => {
    if (el.textContent.trim() === "Shorts") hide(el);
  });

  // 3. Shelves cuyo título es "Shorts" → ocultar también la sección padre
  document.querySelectorAll("ytd-shelf-renderer, ytd-rich-shelf-renderer").forEach((el) => {
    if (!shelfIsShorts(el)) return;
    const section = el.closest("ytd-rich-section-renderer, ytd-item-section-renderer");
    hide(section ?? el);
  });

  // 4. Shelves donde todos los vídeos apuntan a /shorts/ (sin depender del título)
  document.querySelectorAll("ytd-shelf-renderer, ytd-rich-shelf-renderer").forEach((el) => {
    const videos = [...el.querySelectorAll(
      "ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer"
    )];
    if (videos.length && videos.every((v) => v.querySelector('a[href*="/shorts/"]'))) {
      const section = el.closest("ytd-rich-section-renderer, ytd-item-section-renderer");
      hide(section ?? el);
    }
  });
}

// ── MutationObserver ──────────────────────────────────────────────────────
// YouTube es una SPA que muta el DOM en cada navegación.
// Debounced con RAF: se ejecuta como máximo una vez por frame,
// aunque lleguen decenas de mutaciones seguidas.

let rafId = null;

const observer = new MutationObserver((mutations) => {
  if (!mutations.some((m) => m.addedNodes.length > 0)) return;
  if (rafId) return;
  rafId = requestAnimationFrame(() => { removeShorts(); rafId = null; });
});

document.addEventListener("DOMContentLoaded", () => {
  observer.observe(document.body, { childList: true, subtree: true });
  removeShorts();
});

// ── Settings ──────────────────────────────────────────────────────────────

const storageSync = chrome?.storage?.sync;
const storageOnChanged = chrome?.storage?.onChanged;

if (storageSync?.get) {
  storageSync.get({ hideShorts: true, ytHideMetrics: false }, (s) => {
    document.documentElement.classList.toggle("cf-shorts", s.hideShorts);
    document.documentElement.classList.toggle("cf-yt-metrics", s.ytHideMetrics);
    if (s.hideShorts) removeShorts();
  });
}

if (storageOnChanged?.addListener) {
  storageOnChanged.addListener((changes) => {
    if ("hideShorts" in changes) {
      document.documentElement.classList.toggle("cf-shorts", changes.hideShorts.newValue);
      if (changes.hideShorts.newValue) removeShorts();
    }
    if ("ytHideMetrics" in changes) {
      document.documentElement.classList.toggle("cf-yt-metrics", changes.ytHideMetrics.newValue);
    }
  });
}
