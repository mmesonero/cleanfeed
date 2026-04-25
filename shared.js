(function () {
  const SYNC_DEFAULTS = {
    videoSpeedEnabled: true,
    videoSpeedKeyInc: '+',
    videoSpeedKeyDec: '-',
    videoSpeedStep: 0.25,
    subsOff: false,
    hideShorts: true,
    ytHideMetrics: false,
    ytSubtitlesOff: false,
    ytRemoveRecommendations: false,
    ytRemoveComments: false,
    ytRedirectToSubs: false,
    xHideParaTi: true,
    xCleanSidebar: true,
    xHidePanel: true,
    xHideMetrics: false,
    hideReels: true,
    igOnlyFollowing: false,
    igHideMetrics: false,
    ttHideMetrics: false,
  };

  const TOOL_LOCKS_KEY = "toolLocks";
  const TOOL_LOCKS_DEFAULT = { video: false, youtube: false, x: false, instagram: false, tiktok: false };

  const PLATFORMS = [
    {
      id: "video",
      label: "Video",
      icon: "logo.png",
      settings: [
        { id: "subsOff", name: "Subtitles always off", description: "Auto-disables subtitles on any site (YouTube, Crunchyroll, Twitch…)" },
      ],
    },
    {
      id: "youtube",
      label: "YouTube",
      icon: "youtube.png",
      settings: [
        { id: "hideShorts", name: "Hide Shorts", description: "Removes Shorts from feed, search and sidebar" },
        { id: "ytRemoveRecommendations", name: "Remove recommendations", description: "Hides the sidebar while watching a video" },
        { id: "ytRemoveComments", name: "Remove comments", description: "Hides the comments section" },
        { id: "ytHideMetrics", name: "Hide metrics", description: "Hides views, likes and subscriber counts" },
        { id: "ytRedirectToSubs", name: "Redirect to Subscriptions", description: "Always opens Subscriptions instead of the recommendation feed" },
      ],
    },
    {
      id: "x",
      label: "X",
      icon: "x.jpg",
      settings: [
        { id: "xHideParaTi", name: 'Remove "For You"', description: "Opens the Following tab by default" },
        { id: "xCleanSidebar", name: "Clean sidebar", description: "Hides Explore, Communities and Premium links" },
        { id: "xHidePanel", name: "Hide right panel", description: "Hides trends and suggestions" },
        { id: "xHideMetrics", name: "Hide metrics", description: "Hides likes, reposts and counters" },
      ],
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: "instagram.png",
      settings: [
        { id: "hideReels", name: "Hide Reels", description: "Removes Reels from the app" },
        { id: "igOnlyFollowing", name: "Only accounts I follow", description: "Filters feed to followed accounts only" },
        { id: "igHideMetrics", name: "Hide metrics", description: "Hides likes, views and follower counts" },
      ],
    },
    {
      id: "tiktok",
      label: "TikTok",
      icon: "tiktok.jpg",
      settings: [
        { id: "ttHideMetrics", name: "Hide metrics", description: "Hides likes, saves and share counts" },
      ],
    },
  ];

  const CREATOR_LINKS = {
    github: "https://github.com/mmesonero?tab=repositories",
    linkedin: "https://www.linkedin.com/in/mesonero/",
  };

  const METRICS_KEY = "cleanfeedMetrics";
  const TIME_SPENT_KEY = "cleanfeedTime";
  const TIME_DEFAULTS = { youtube: 0, x: 0, instagram: 0, tiktok: 0 };
  const PLATFORM_ORDER_KEY = "platformOrder";

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function todayKey(offsetDays = 0) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join("-");
  }

  function isoDateTime(value) {
    if (!value) return "Never";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Never";

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function defaultMetrics() {
    return {
      lastOpenedAt: null,
      sites: {},
    };
  }

  function cloneMetrics(metrics) {
    return JSON.parse(JSON.stringify(metrics || defaultMetrics()));
  }

  function storageGet(area, defaults) {
    return new Promise((resolve) => {
      area.get(defaults, (result) => resolve(result));
    });
  }

  function storageSet(area, value) {
    return new Promise((resolve) => {
      area.set(value, () => resolve());
    });
  }

  async function getSyncSettings() {
    return storageGet(chrome.storage.sync, SYNC_DEFAULTS);
  }

  async function setSyncSetting(id, value) {
    await storageSet(chrome.storage.sync, { [id]: value });
  }

  async function getToolLocks() {
    const result = await storageGet(chrome.storage.local, { [TOOL_LOCKS_KEY]: TOOL_LOCKS_DEFAULT });
    return { ...TOOL_LOCKS_DEFAULT, ...(result[TOOL_LOCKS_KEY] || {}) };
  }

  async function setToolLock(tool, value) {
    const locks = await getToolLocks();
    locks[tool] = value;
    await storageSet(chrome.storage.local, { [TOOL_LOCKS_KEY]: locks });
  }

  async function getPlatformOrder() {
    const defaultOrder = PLATFORMS.map((p) => p.id);
    const result = await storageGet(chrome.storage.local, { [PLATFORM_ORDER_KEY]: defaultOrder });
    const stored = result[PLATFORM_ORDER_KEY];
    if (!stored || stored.length !== defaultOrder.length) return defaultOrder;
    return stored;
  }

  async function setPlatformOrder(order) {
    await storageSet(chrome.storage.local, { [PLATFORM_ORDER_KEY]: order });
  }

  function getOrderedPlatforms(platforms, order) {
    return [...platforms].sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }

  async function getTimeSpent() {
    const result = await storageGet(chrome.storage.local, { [TIME_SPENT_KEY]: TIME_DEFAULTS });
    return { ...TIME_DEFAULTS, ...(result[TIME_SPENT_KEY] || {}) };
  }

  function formatTime(ms) {
    if (!ms || ms < 60000) return "< 1m";
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }

  async function getMetrics() {
    const result = await storageGet(chrome.storage.local, { [METRICS_KEY]: defaultMetrics() });
    return cloneMetrics(result[METRICS_KEY]);
  }

  async function saveMetrics(metrics) {
    await storageSet(chrome.storage.local, { [METRICS_KEY]: metrics });
  }

  async function touchLastOpened() {
    const metrics = await getMetrics();
    metrics.lastOpenedAt = Date.now();
    await saveMetrics(metrics);
    return metrics;
  }

  function ensureSite(metrics, site) {
    if (!metrics.sites[site]) {
      metrics.sites[site] = {
        blocks: {},
        bypasses: {},
      };
    }

    return metrics.sites[site];
  }

  async function recordMetric(site, kind) {
    const metrics = await getMetrics();
    const siteMetrics = ensureSite(metrics, site);
    const key = todayKey();

    if (!siteMetrics[kind][key]) {
      siteMetrics[kind][key] = 0;
    }

    siteMetrics[kind][key] += 1;
    await saveMetrics(metrics);
    return metrics;
  }

  function sumLastDays(bucket, days) {
    let total = 0;

    for (let index = 0; index < days; index += 1) {
      const key = todayKey(-index);
      total += bucket[key] || 0;
    }

    return total;
  }

  function siteSummary(metrics, site) {
    const siteMetrics = metrics.sites[site] || { blocks: {}, bypasses: {} };
    return {
      blocksToday: siteMetrics.blocks[todayKey()] || 0,
      blocksLast7d: sumLastDays(siteMetrics.blocks, 7),
      bypassesLast7d: sumLastDays(siteMetrics.bypasses, 7),
    };
  }

  function globalSummary(metrics) {
    let blocksToday = 0;
    let blocksLast7d = 0;
    let bypassesLast7d = 0;
    let bypassesTotal = 0;

    Object.keys(metrics.sites).forEach((site) => {
      const summary = siteSummary(metrics, site);
      blocksToday += summary.blocksToday;
      blocksLast7d += summary.blocksLast7d;
      bypassesLast7d += summary.bypassesLast7d;
      const siteMetrics = metrics.sites[site] || { bypasses: {} };
      Object.values(siteMetrics.bypasses || {}).forEach((count) => {
        bypassesTotal += count || 0;
      });
    });

    return {
      blocksToday,
      blocksLast7d,
      bypassesLast7d,
      bypassesTotal,
      lastOpenedLabel: isoDateTime(metrics.lastOpenedAt),
    };
  }

  window.CleanFeedShared = {
    CREATOR_LINKS,
    PLATFORMS,
    SYNC_DEFAULTS,
    TOOL_LOCKS_KEY,
    TOOL_LOCKS_DEFAULT,
    TIME_SPENT_KEY,
    PLATFORM_ORDER_KEY,
    getPlatformOrder,
    setPlatformOrder,
    getOrderedPlatforms,
    getSyncSettings,
    setSyncSetting,
    getToolLocks,
    setToolLock,
    getTimeSpent,
    formatTime,
    getMetrics,
    globalSummary,
    siteSummary,
    touchLastOpened,
    recordBlock(site) {
      return recordMetric(site, "blocks");
    },
    recordBypass(site) {
      return recordMetric(site, "bypasses");
    },
  };
})();
