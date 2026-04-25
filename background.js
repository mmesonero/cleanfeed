const RULES = {
  instagram: { block: 20, bypass: 21, filter: "||instagram.com", bypassFilter: "||instagram.com*bypass=true", path: "/ui/block.html?site=instagram" },
  youtube:   { block: 22, bypass: 23, filter: "||youtube.com",   bypassFilter: "||youtube.com*bypass=true",   path: "/ui/block.html?site=youtube"   },
  x:         { block: 24, bypass: 25, filter: "||x.com",         bypassFilter: "||x.com*bypass=true",         path: "/ui/block.html?site=x"         },
  tiktok:    { block: 26, bypass: 27, filter: "||tiktok.com",    bypassFilter: "||tiktok.com*bypass=true",    path: "/ui/block.html?site=tiktok"    },
};

const TOOL_LOCKS_KEY = "toolLocks";
const TOOL_LOCKS_DEFAULT = { youtube: false, x: false, instagram: false, tiktok: false };

let _applyQueue = Promise.resolve();

function applyAllLocks(locks) {
  _applyQueue = _applyQueue.then(() => _doApply(locks));
}

async function _doApply(locks) {
  const resolved = { ...TOOL_LOCKS_DEFAULT, ...(locks || {}) };

  const removeRuleIds = new Set();
  const addRules = [];
  const addedIds = new Set();

  for (const [site, enabled] of Object.entries(resolved)) {
    const rule = RULES[site];
    if (!rule) continue;

    const { block, bypass, filter, bypassFilter, path } = rule;
    removeRuleIds.add(block);
    removeRuleIds.add(bypass);

    if (!enabled) continue;
    if (addedIds.has(block) || addedIds.has(bypass)) continue;

    addRules.push(
      {
        id: block,
        priority: 1,
        action: { type: "redirect", redirect: { extensionPath: path } },
        condition: { urlFilter: filter, resourceTypes: ["main_frame"] },
      },
      {
        id: bypass,
        priority: 2,
        action: { type: "allow" },
        condition: { urlFilter: bypassFilter, resourceTypes: ["main_frame"] },
      }
    );

    addedIds.add(block);
    addedIds.add(bypass);
  }

  if (!chrome?.declarativeNetRequest?.updateDynamicRules) {
    console.error("[CleanFeed] declarativeNetRequest unavailable");
    return;
  }

  const ruleApi = chrome.declarativeNetRequest;
  try {
    await ruleApi.updateDynamicRules({ removeRuleIds: Array.from(removeRuleIds) });
  } catch (err) {
    console.error("[CleanFeed] removeDynamicRules:", err);
  }

  if (addRules.length === 0) return;

  try {
    await ruleApi.updateDynamicRules({ addRules });
  } catch (err) {
    if (err?.message?.includes("does not have a unique ID")) {
      const duplicateIds = addRules.map((rule) => rule.id);
      try {
        await ruleApi.updateDynamicRules({ removeRuleIds: duplicateIds });
        await ruleApi.updateDynamicRules({ addRules });
      } catch (retryErr) {
        console.error("[CleanFeed] retry applyAllLocks failed:", retryErr);
      }
      return;
    }
    console.error("[CleanFeed] applyAllLocks:", err);
  }
}

// Clean up legacy rules from old versions
if (chrome?.declarativeNetRequest?.updateDynamicRules) {
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [10, 11, 20, 21, 22, 23, 24, 25, 26, 27] })
    .catch((err) => console.error("[CleanFeed] cleanup startup rules:", err));
} else {
  console.error("[CleanFeed] declarativeNetRequest unavailable on startup");
}

// Initialize on startup
if (chrome?.storage?.local?.get) {
  chrome.storage.local.get({ [TOOL_LOCKS_KEY]: TOOL_LOCKS_DEFAULT }, (data = {}) => {
    const toolLocks = data?.toolLocks ?? TOOL_LOCKS_DEFAULT;
    applyAllLocks(toolLocks);
  });
} else {
  console.error("[CleanFeed] storage.local unavailable");
}

// React to changes
if (chrome?.storage?.onChanged?.addListener) {
  chrome.storage.onChanged.addListener((changes = {}, areaName) => {
    if (areaName !== "local" || !(TOOL_LOCKS_KEY in changes)) return;
    applyAllLocks(changes[TOOL_LOCKS_KEY].newValue);
  });
} else {
  console.error("[CleanFeed] storage.onChanged unavailable");
}
