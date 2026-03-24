const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveSession: (data) => ipcRenderer.invoke('save-session', data),
  closeOverlay: () => ipcRenderer.invoke('close-overlay'),
  loadSessions: () => ipcRenderer.invoke('load-sessions'),
  onResetSession: (callback) => ipcRenderer.on('reset-session', callback),
  setWidgetMode: () => ipcRenderer.invoke('set-widget-mode'),
  setNormalMode: () => ipcRenderer.invoke('set-normal-mode'),
  onCursorProximity: (cb) => ipcRenderer.on('cursor-proximity', (_e, near) => cb(near)),
  onRuTriggered: (cb) => ipcRenderer.on('ru-triggered', cb),
  showReminder: (pct) => ipcRenderer.invoke('show-reminder', pct),
  hideStatusIcon: () => ipcRenderer.invoke('hide-status-icon'),
  showStatusIcon: () => ipcRenderer.invoke('show-status-icon'),
  addStats: (data) => ipcRenderer.invoke('add-stats', data),
});
