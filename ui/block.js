const SITES = {
  tiktok:    { domain: 'tiktok.com',    bypass: 'https://www.tiktok.com/?bypass=true'    },
  instagram: { domain: 'instagram.com', bypass: 'https://www.instagram.com/?bypass=true' },
  youtube:   { domain: 'youtube.com',   bypass: 'https://www.youtube.com/?bypass=true'   },
  x:         { domain: 'x.com',         bypass: 'https://www.x.com/?bypass=true'         },
};

const {
  getMetrics,
  recordBlock,
  recordBypass,
  siteSummary,
  getTimeSpent,
  formatTime,
} = window.CleanFeedShared;

const site   = new URLSearchParams(location.search).get('site') || 'tiktok';
const config = SITES[site] || SITES.tiktok;

document.getElementById('blocked-domain').textContent = config.domain;

async function refreshStats() {
  const [metrics, timeSpent] = await Promise.all([getMetrics(), getTimeSpent()]);
  const summary = siteSummary(metrics, site);

  document.getElementById('blocks-last-7d').textContent = String(summary.blocksLast7d);
  document.getElementById('bypasses-last-7d').textContent = String(summary.bypassesLast7d);
  document.getElementById('time-spent').textContent = formatTime(timeSpent[site] || 0);
}

document.getElementById('go-back').addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
});

document.getElementById('bypass').addEventListener('click', async () => {
  await recordBypass(site);
  window.location.href = config.bypass;
});

document.addEventListener('DOMContentLoaded', async () => {
  await recordBlock(site);
  await refreshStats();
});
