const WS_PORT = 54321;
const DEFAULT_BLOCK_LIST = [
  'youtube.com', 'reddit.com', 'twitter.com', 'x.com',
  'instagram.com', 'chess.com', 'tiktok.com', 'facebook.com',
  'twitch.tv', 'netflix.com',
];

let ws = null;
let sessionActive = false;

// Always reset session on extension startup — if app was closed mid-session it would be stuck
sessionActive = false;
chrome.storage.local.set({ sessionActive: false, wsConnected: false });

// --- WebSocket connection to Electron app ---
function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(`ws://localhost:${WS_PORT}`);

    ws.onopen = () => {
      chrome.storage.local.set({ wsConnected: true });
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'session-start') {
          sessionActive = true;
          chrome.storage.local.set({ sessionActive: true, blockingEnabled: true });
        } else if (msg.type === 'session-end') {
          sessionActive = false;
          chrome.storage.local.set({ sessionActive: false, blockingEnabled: true });
        } else if (msg.type === 'block-list-update') {
          chrome.storage.local.set({ blockList: msg.blockList });
      } catch {}
    };

    ws.onclose = () => {
      ws = null;
      sessionActive = false;
      chrome.storage.local.set({ sessionActive: false, wsConnected: false });
      setTimeout(connectWS, 5000);
    };

    ws.onerror = () => {
      // onclose will fire after onerror and handle retry
    };
  } catch {
    setTimeout(connectWS, 5000);
  }
}

connectWS();

// MV3 service workers go to sleep after ~30s — use alarms to stay alive and reconnect
chrome.alarms.create('ws-keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ws-keepalive') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWS();
    }
  }
});

// --- Blocking logic ---
async function isBlocked(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const { blockList = DEFAULT_BLOCK_LIST, blockingEnabled = true } =
      await chrome.storage.local.get(['blockList', 'blockingEnabled']);
    if (!blockingEnabled) return false;
    return blockList.some((d) => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading' || !tab.url) return;
  if (tab.url.startsWith('chrome-extension://')) return;
  if (tab.url.startsWith('chrome://')) return;

  const blocked = await isBlocked(tab.url);
  if (!blocked) return;

  // Read from storage — in-memory sessionActive may be stale if SW was sleeping
  const { sessionActive: active } = await chrome.storage.local.get('sessionActive');
  const mode = active ? 'hard' : 'soft';
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(
      `blocked.html?site=${encodeURIComponent(tab.url)}&mode=${mode}`
    ),
  });
});

// --- Messages from blocked page / popup ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'get-state') {
    sendResponse({ sessionActive, wsConnected: ws !== null && ws.readyState === WebSocket.OPEN });
    return true;
  }

  if (msg.type === 'launch-ru') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'launch-ru', firstStep: msg.firstStep }));
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'get-block-list') {
    chrome.storage.local.get(['blockList', 'blockingEnabled'], (r) => {
      sendResponse({
        blockList: (r.blockList && r.blockList.length > 0) ? r.blockList : DEFAULT_BLOCK_LIST,
        blockingEnabled: r.blockingEnabled !== false,
      });
    });
    return true;
  }

  if (msg.type === 'save-block-list') {
    chrome.storage.local.set({ blockList: msg.blockList }, () => sendResponse({ ok: true }));
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'save-block-list', blockList: msg.blockList }));
    }
    return true;
  }

  if (msg.type === 'set-blocking-enabled') {
    chrome.storage.local.set({ blockingEnabled: msg.enabled }, () => sendResponse({ ok: true }));
    return true;
  }
});
