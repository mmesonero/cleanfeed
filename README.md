# CleanFeed

Chrome extension (Manifest V3) that removes distractions across YouTube, X, Instagram and TikTok. Each platform's features are individually toggleable. Any platform can be hard-blocked entirely.

---

## Installation (developer mode)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the repo folder.
5. The CleanFeed icon will appear in the toolbar.

---

## Popup (extension icon)

Click the CleanFeed icon to open the quick-access panel.

- **Platform cards** — one card per platform, showing how many filters are active (`2/4`).
- **Toggle switches** — enable or disable any individual feature instantly.
- **Lock button (🔒 / 🔓)** — hard-block an entire platform. When locked the card collapses and every visit to that site redirects to the CleanFeed block screen.
- **General section** (pinned at the bottom) — subtitles and speed-key toggles, plus a **Full settings ↗** button that opens the Dashboard.
- **Header** — shows `enabled/total filters` and time spent on social media (X, Instagram, TikTok).

> Platform order in the popup follows whatever order you set in the Dashboard.

---

## Dashboard

Open via **Full settings ↗** in the popup, or navigate to `chrome-extension://<id>/dashboard.html`.

### Stats row

| Card | What it counts |
|---|---|
| Rules active | Enabled toggles out of total |
| Blocked last 7d | Times a platform block fired |
| Bypasses last 7d | Times a user bypassed a block |
| Time lost total | Cumulative bypass time estimate |

### Platform cards

Drag cards by the `⠿` handle to reorder them — order is saved and reflected in the popup.

Each card has a **lock button** (top-right) that hard-blocks the whole platform and a set of feature toggles (see per-platform details below).

### General / Video section

Two cards side by side:

**General**
- **Subtitles always off** — auto-disables subtitles on any site (YouTube, Crunchyroll, Twitch…).
- **Video speed keys** — enable/disable keyboard speed control.

**Speed keys**
- Shows current step size with **−** / **+** buttons that cycle through presets: `0.1 · 0.25 · 0.5 · 0.75 · 1 · 1.25 · 1.5 · 1.75 · 2`.
- Two key-capture buttons (click → press any key) to set the **speed-up** and **slow-down** keys (defaults: `+` / `−`).

---

## Per-platform features

### YouTube

| Setting | What it does |
|---|---|
| Hide Shorts | Removes Shorts from feed, search, sidebar chip and guide entry |
| Remove recommendations | Hides the right-hand sidebar while watching, endscreen cards and autoplay tray |
| Remove comments | Hides the full comments section |
| Hide metrics | Hides view counts, like counts and subscriber counts |
| Redirect to Subscriptions | Always opens `/feed/subscriptions` instead of the recommendation homepage — applies on page load, logo clicks and SPA navigations |

### X (Twitter)

| Setting | What it does |
|---|---|
| Remove "For You" | Opens the Following tab by default |
| Clean sidebar | Hides Explore, Communities and Premium links |
| Hide right panel | Hides trends and suggestions |
| Hide metrics | Hides likes, reposts and counters |

### Instagram

| Setting | What it does |
|---|---|
| Hide Reels | Removes Reels from the app |
| Only accounts I follow | Filters feed to followed accounts only |
| Hide metrics | Hides likes, views and follower counts |

### TikTok

| Setting | What it does |
|---|---|
| Hide metrics | Hides likes, saves and share counts |

---

## Video speed HUD

A floating pill appears over any playing video (on any site) when the video is large enough.

- **Pill** — always visible, shows current playback rate (e.g. `1.5×`). Drag it anywhere on the video.
- **Hover menu** — expands on hover:
  - **Speed display** — current rate, large and centered.
  - **Slider** — drag the CleanFeed logo along the track (0.25× → 4×). Click anywhere on the track to jump. **−** / **+** buttons step through the configured preset.
  - **Preset buttons** — `1× · 1.25× · 1.5× · 2× · 3×`. Active preset highlighted in gold.
- **Sync with YouTube** — when you change speed via YouTube's native speed panel, the HUD adopts it automatically instead of fighting it.
- **reset** link — returns to 1×.

---

## Platform blocking (hard block)

When a platform is locked:

1. `background.js` uses `chrome.declarativeNetRequest` to redirect all navigations to that domain to `block.html`.
2. A bypass rule (`?bypass=true`) is also registered so the block screen can offer a "visit anyway" option.
3. Unlocking removes both rules instantly.

Platforms supported: YouTube, X, Instagram, TikTok.

---

## File structure

```
manifest.json        Extension manifest (MV3)
background.js        Service worker — manages declarativeNetRequest block/bypass rules
shared.js            Shared state: PLATFORMS definition, storage helpers, metrics
content.js           YouTube — Shorts removal (CSS + DOM) + time tracking
youtube.js           YouTube — recommendations, comments, metrics via DOM + CSS classes
video.js             All sites — floating speed HUD, keyboard speed keys, subtitles off
twitter.js           X/Twitter — For You removal, sidebar, panel, metrics
instagram.js         Instagram — Reels, following filter, metrics
tiktok.js            TikTok — metrics
hide.css             CSS rules activated by classes on <html> (Shorts, metrics, etc.)
popup.html / .js     Extension popup UI
dashboard.html / .js Full settings dashboard
block.html / .js     Hard-block redirect screen
```

---

## Storage

All user settings are stored in `chrome.storage.sync` (syncs across devices). Metrics, tool locks and platform order use `chrome.storage.local`.

### Sync defaults

```js
videoSpeedEnabled:        true
videoSpeedKeyInc:         '+'
videoSpeedKeyDec:         '-'
videoSpeedStep:           0.25
subsOff:                  false
hideShorts:               true
ytHideMetrics:            false
ytSubtitlesOff:           false
ytRemoveRecommendations:  false
ytRemoveComments:         false
ytRedirectToSubs:         false
xHideParaTi:              true
xCleanSidebar:            true
xHidePanel:               true
xHideMetrics:             false
hideReels:                true
igOnlyFollowing:          false
igHideMetrics:            false
ttHideMetrics:            false
```

---

## CSS class system (hide.css)

Content scripts add classes to `<html>` to activate CSS-based hiding rules — zero DOM polling, no flicker on page load.

| Class | Activated by |
|---|---|
| `cf-shorts` | `hideShorts` setting |
| `cf-yt-metrics` | `ytHideMetrics` setting |
| `cf-yt-remove-recommendations` | `ytRemoveRecommendations` setting |
| `cf-yt-remove-comments` | `ytRemoveComments` setting |

---

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist settings, metrics and platform order |
| `tabs` | Open dashboard / external links from popup |
| `declarativeNetRequest` | Hard-block platform domains |
| Host permissions | Run content scripts on each platform |

---

## Credits

Built by [mmesonero](https://github.com/mmesonero) · [LinkedIn](https://linkedin.com/in/mesonero)
