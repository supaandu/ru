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
chrome.storage.local.set({ sessionActive: false });

// --- WebSocket connection to Electron app ---
function connectWS() {
  try {
    ws = new WebSocket(`ws://localhost:${WS_PORT}`);

    ws.onopen = () => {
      console.log('RU extension: connected to app');
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'session-start') {
          sessionActive = true;
          chrome.storage.local.set({ sessionActive: true });
        } else if (msg.type === 'session-end') {
          sessionActive = false;
          chrome.storage.local.set({ sessionActive: false });
        } else if (msg.type === 'block-list-update') {
          chrome.storage.sync.set({ blockList: msg.blockList });
        }
      } catch {}
    };

    ws.onclose = () => {
      ws = null;
      // App disconnected — no session can be running
      sessionActive = false;
      chrome.storage.local.set({ sessionActive: false });
      setTimeout(connectWS, 5000);
    };

    ws.onerror = () => {
      ws = null;
    };
  } catch {
    setTimeout(connectWS, 5000);
  }
}

connectWS();

// --- Blocking logic ---
async function isBlocked(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const { blockList = DEFAULT_BLOCK_LIST, blockingEnabled = true } =
      await chrome.storage.sync.get(['blockList', 'blockingEnabled']);
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

  const mode = sessionActive ? 'hard' : 'soft';
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(
      `blocked.html?site=${encodeURIComponent(tab.url)}&mode=${mode}`
    ),
  });
});

// --- Messages from blocked page / popup ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'get-state') {
    sendResponse({ sessionActive });
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
    chrome.storage.sync.get(['blockList', 'blockingEnabled'], (r) => {
      sendResponse({
        blockList: r.blockList || DEFAULT_BLOCK_LIST,
        blockingEnabled: r.blockingEnabled !== false,
      });
    });
    return true;
  }

  if (msg.type === 'save-block-list') {
    chrome.storage.sync.set({ blockList: msg.blockList }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'set-blocking-enabled') {
    chrome.storage.sync.set({ blockingEnabled: msg.enabled }, () => sendResponse({ ok: true }));
    return true;
  }
});
