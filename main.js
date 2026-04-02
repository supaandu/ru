const { app, BrowserWindow, ipcMain, screen, systemPreferences, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { WebSocketServer } = require('ws');

const SESSIONS_PATH   = path.join(app.getPath('userData'), 'sessions.json');
const BLOCKLIST_PATH  = path.join(app.getPath('userData'), 'blocklist.json');
const DEFAULT_BLOCK_LIST = [
  'youtube.com', 'reddit.com', 'twitter.com', 'x.com',
  'instagram.com', 'chess.com', 'tiktok.com', 'facebook.com',
  'twitch.tv', 'netflix.com',
];

function loadBlockList() {
  try { return JSON.parse(fs.readFileSync(BLOCKLIST_PATH, 'utf-8')); }
  catch { return [...DEFAULT_BLOCK_LIST]; }
}

function saveBlockList(list) {
  fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(list), 'utf-8');
  wsBroadcast({ type: 'block-list-update', blockList: list });
}

let mainWindow = null;
let reminderWindow = null;
let statusIconWindow = null;
let reminderHideTimeout = null;
const heldKeys = new Set();
let overlayVisible = false;
let proximityInterval = null;

function startProximityPoll() {
  if (proximityInterval) return;
  proximityInterval = setInterval(() => {
    if (!mainWindow) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    const margin = 80;
    const near =
      cursor.x >= bounds.x - margin &&
      cursor.x <= bounds.x + bounds.width + margin &&
      cursor.y >= bounds.y - margin &&
      cursor.y <= bounds.y + bounds.height + margin;
    mainWindow.webContents.send('cursor-proximity', near);
  }, 150);
}

function stopProximityPoll() {
  if (proximityInterval) {
    clearInterval(proximityInterval);
    proximityInterval = null;
  }
}

function createStatusIconWindow() {
  const display = screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: dw } = display.workArea;
  statusIconWindow = new BrowserWindow({
    width: 220,
    height: 480,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'status-icon-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  statusIconWindow.setPosition(dx + dw - 232, dy + 10);
  statusIconWindow.setIgnoreMouseEvents(true, { forward: true });
  if (process.platform === 'darwin') {
    statusIconWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    statusIconWindow.setAlwaysOnTop(true, 'floating');
  }
  statusIconWindow.loadFile('status-icon.html');
  statusIconWindow.show();
}

function createReminderWindow() {
  reminderWindow = new BrowserWindow({
    width: 260,
    height: 90,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'reminder-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (process.platform === 'darwin') {
    reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    reminderWindow.setAlwaysOnTop(true, 'floating');
  }
  reminderWindow.loadFile('reminder.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 430,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'floating');
  }

  mainWindow.on('blur', () => {
    if (overlayVisible) {
      const level = process.platform === 'darwin' ? 'floating' : undefined;
      mainWindow.setAlwaysOnTop(true, level);
    }
  });
}

function showOverlay() {
  if (overlayVisible || !mainWindow) return;
  overlayVisible = true;
  if (statusIconWindow) statusIconWindow.hide();
  mainWindow.setSize(420, 430);
  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('reset-session');
}

function hideOverlay() {
  if (!mainWindow) return;
  overlayVisible = false;
  mainWindow.hide();
  if (statusIconWindow) statusIconWindow.show();
}

// Live stats (in-memory, accumulates across sessions without restarting)
let liveStats = null;

function computeScore(starts, minutes, speeds, bails) {
  const momentum  = Math.min(40, starts * 8);
  const focus     = Math.min(30, minutes * 0.25);
  const avgSpeed  = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
  const speed     = avgSpeed !== null ? Math.max(0, 20 - avgSpeed / 4.5) : 0;
  const penalty   = Math.min(20, bails * 5);
  return Math.round(Math.max(0, Math.min(100, momentum + focus + speed - penalty)));
}

function computeSavedStats(todayStr) {
  const sessions = loadSessions();
  const todaySessions = sessions.filter((s) => {
    const day = s.sessionDate || new Date(s.timestamp).toDateString();
    return day === todayStr;
  });
  const starts = todaySessions.filter((s) => s.completed).length;
  const bails  = todaySessions.filter((s) => !s.completed).length;
  let minutes = 0;
  todaySessions.forEach((s) => {
    if (Array.isArray(s.blocks)) s.blocks.forEach((b) => { minutes += b.durationMin || 0; });
  });
  const speeds = todaySessions
    .filter((s) => s.firstStepMs > 0)
    .map((s) => Math.round(s.firstStepMs / 1000));
  return { starts, minutes, speeds, bails };
}

function ensureLiveStats() {
  const todayStr = new Date().toDateString();
  if (liveStats && liveStats.date === todayStr) return;
  const { starts, minutes, speeds, bails } = computeSavedStats(todayStr);
  liveStats = { date: todayStr, starts, minutes, speeds, bails };
}

function pushStatsToIcon() {
  if (!statusIconWindow || statusIconWindow.isDestroyed()) return;
  const avgSpeed = liveStats.speeds.length > 0
    ? Math.round(liveStats.speeds.reduce((a, b) => a + b, 0) / liveStats.speeds.length)
    : null;
  const score = computeScore(liveStats.starts, liveStats.minutes, liveStats.speeds, liveStats.bails);
  statusIconWindow.webContents.send('stats-update', {
    starts:  liveStats.starts,
    minutes: Math.round(liveStats.minutes * 10) / 10,
    speed:   avgSpeed,
    bails:   liveStats.bails,
    score,
  });
}

// --- WebSocket server for browser extension ---
let wss = null;
const wsClients = new Set();
let sessionInProgress = false;

function startWSServer() {
  wss = new WebSocketServer({ port: 54321 });
  wss.on('connection', (client) => {
    wsClients.add(client);
    client.send(JSON.stringify({ type: 'block-list-update', blockList: loadBlockList() }));
    if (sessionInProgress) client.send(JSON.stringify({ type: 'session-start' }));
    client.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'launch-ru') {
          showOverlay();
          setTimeout(() => {
            if (mainWindow) mainWindow.webContents.send('pre-fill-task', msg.firstStep || '');
          }, 300);
        } else if (msg.type === 'save-block-list') {
          saveBlockList(msg.blockList);
          if (statusIconWindow) statusIconWindow.webContents.send('block-list-updated', msg.blockList);
        }
      } catch {}
    });
    client.on('close', () => wsClients.delete(client));
    client.on('error', () => wsClients.delete(client));
  });
}

function wsBroadcast(msg) {
  const data = JSON.stringify(msg);
  wsClients.forEach((c) => { if (c.readyState === 1) c.send(data); });
}

// Session storage
function loadSessions() {
  try {
    const data = fs.readFileSync(SESSIONS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveSession(session) {
  const sessions = loadSessions();
  sessions.push(session);
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), 'utf-8');
}

// IPC handlers
ipcMain.handle('save-session', (_event, data) => {
  saveSession(data);
  return true;
});

ipcMain.handle('close-overlay', () => {
  hideOverlay();
  sessionInProgress = false;
  wsBroadcast({ type: 'session-end' });
  if (statusIconWindow) statusIconWindow.webContents.send('session-state', false);
  return true;
});

ipcMain.handle('start-session', () => {
  sessionInProgress = true;
  wsBroadcast({ type: 'session-start' });
  if (statusIconWindow) statusIconWindow.webContents.send('session-state', true);
  return true;
});


ipcMain.handle('load-sessions', () => {
  return loadSessions();
});

ipcMain.handle('set-widget-mode', () => {
  const display = screen.getDisplayNearestPoint(mainWindow.getBounds());
  const { x: dx, y: dy } = display.workArea;
  mainWindow.setMinimumSize(0, 0);
  mainWindow.setOpacity(0);
  mainWindow.setContentBounds({ x: dx + 20, y: dy + 20, width: 160, height: 80 }, false);
  startProximityPoll();
  setTimeout(() => mainWindow.setOpacity(1), 80);
  return true;
});

// VISIBLE_MS controls how long the reminder stays on screen (excluding 150ms fade in/out)
const REMINDER_VISIBLE_MS = 2000;

ipcMain.handle('show-reminder', (_e, pct) => {
  if (!reminderWindow) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  reminderWindow.setContentBounds({
    x: Math.round(dx + dw / 2 - 130),
    y: Math.round(dy + dh / 2 - 45),
    width: 260,
    height: 90,
  }, false);
  reminderWindow.show();
  reminderWindow.webContents.send('reminder-show', pct);
  clearTimeout(reminderHideTimeout);
  reminderHideTimeout = setTimeout(() => {
    reminderWindow.webContents.send('reminder-hide');
    setTimeout(() => reminderWindow.hide(), 150);
  }, REMINDER_VISIBLE_MS);
  return true;
});

ipcMain.handle('hide-status-icon', () => {
  if (statusIconWindow) statusIconWindow.hide();
  return true;
});

ipcMain.handle('show-status-icon', () => {
  if (statusIconWindow) statusIconWindow.show();
  return true;
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

ipcMain.handle('get-block-list', () => loadBlockList());

ipcMain.handle('save-block-list', (_e, list) => {
  saveBlockList(list);
  return true;
});

ipcMain.handle('add-stats', (_e, { starts = 0, minutes = 0, firstStepMs = null, bails = 0 }) => {
  ensureLiveStats();
  liveStats.starts  += starts;
  liveStats.minutes += minutes;
  liveStats.bails   += bails;
  if (firstStepMs > 0) liveStats.speeds.push(Math.round(firstStepMs / 1000));
  pushStatsToIcon();
  return true;
});

ipcMain.handle('get-stats', () => {
  ensureLiveStats();
  const avgSpeed = liveStats.speeds.length > 0
    ? Math.round(liveStats.speeds.reduce((a, b) => a + b, 0) / liveStats.speeds.length)
    : null;
  const score = computeScore(liveStats.starts, liveStats.minutes, liveStats.speeds, liveStats.bails);
  return {
    starts:  liveStats.starts,
    minutes: Math.round(liveStats.minutes * 10) / 10,
    speed:   avgSpeed,
    bails:   liveStats.bails,
    score,
  };
});

ipcMain.handle('move-status-icon', (_e, dx, dy) => {
  if (!statusIconWindow) return;
  const [x, y] = statusIconWindow.getPosition();
  statusIconWindow.setPosition(x + dx, y + dy);
  return true;
});

ipcMain.handle('set-status-click-through', (_e, on) => {
  if (!statusIconWindow) return;
  statusIconWindow.setIgnoreMouseEvents(on, { forward: true });
  return true;
});

ipcMain.handle('set-normal-mode', () => {
  stopProximityPoll();
  mainWindow.setMinimumSize(0, 0);
  mainWindow.setOpacity(0);
  mainWindow.setContentBounds({ x: 0, y: 0, width: 420, height: 430 }, false);
  mainWindow.center();
  setTimeout(() => mainWindow.setOpacity(1), 80);
  return true;
});

// Global keyboard hook with uiohook-napi
let ruHoldTimeout = null;

function setupKeyboardHook() {
  uIOhook.on('keydown', (e) => {
    heldKeys.add(e.keycode);
    // Require R+U held simultaneously for 300ms to avoid accidental triggers while typing
    if (heldKeys.has(UiohookKey.R) && heldKeys.has(UiohookKey.U)) {
      if (!ruHoldTimeout) {
        ruHoldTimeout = setTimeout(() => {
          ruHoldTimeout = null;
          if (overlayVisible && mainWindow) {
            mainWindow.webContents.send('ru-triggered');
          } else {
            showOverlay();
          }
        }, 100);
      }
    }
  });

  uIOhook.on('keyup', (e) => {
    heldKeys.delete(e.keycode);
    if (!heldKeys.has(UiohookKey.R) || !heldKeys.has(UiohookKey.U)) {
      clearTimeout(ruHoldTimeout);
      ruHoldTimeout = null;
    }
  });

  try {
    uIOhook.start();
  } catch (err) {
    console.error('uIOhook failed to start (accessibility permission may be missing):', err);
  }
}

// Prevent multiple instances — second launch quits immediately
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.whenReady().then(() => {
  // macOS: hide from dock (background utility app)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  createWindow();
  createReminderWindow();
  createStatusIconWindow();
  startWSServer();

  // macOS: uiohook-napi requires Accessibility permission to capture global keys
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!trusted) {
      systemPreferences.isTrustedAccessibilityClient(true); // prompts System Preferences
      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Accessibility Permission Required',
        message: 'RU needs Accessibility access to detect the R+U hotkey.',
        detail: 'Go to System Settings → Privacy & Security → Accessibility → enable RU.\n\nThen restart the app.',
        buttons: ['OK'],
      });
      // Don't start the keyboard hook — app needs to restart after permission is granted
    } else {
      setupKeyboardHook();
    }
  } else {
    setupKeyboardHook();
  }
});

// macOS: re-show status icon if user clicks dock icon (though dock is hidden, handle activate anyway)
app.on('activate', () => {
  if (statusIconWindow) statusIconWindow.show();
});

app.on('will-quit', () => {
  try { uIOhook.stop(); } catch {}
});

app.on('window-all-closed', () => {
  // Don't auto-quit when main/reminder windows close — status icon keeps app alive
});
