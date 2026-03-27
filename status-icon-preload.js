const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('statusApi', {
  getStats: () => ipcRenderer.invoke('get-stats'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  moveBy: (dx, dy) => ipcRenderer.invoke('move-status-icon', dx, dy),
  setClickThrough: (on) => ipcRenderer.invoke('set-status-click-through', on),
  onStatsUpdate: (cb) => ipcRenderer.on('stats-update', (_e, stats) => cb(stats)),
  onSessionState: (cb) => ipcRenderer.on('session-state', (_e, active) => cb(active)),
  getBlockList: () => ipcRenderer.invoke('get-block-list'),
  saveBlockList: (list) => ipcRenderer.invoke('save-block-list', list),
  onBlockListUpdated: (cb) => ipcRenderer.on('block-list-updated', (_e, list) => cb(list)),
});
