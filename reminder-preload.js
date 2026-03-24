const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reminder', {
  onShow: (cb) => ipcRenderer.on('reminder-show', (_e, pct) => cb(pct)),
  onHide: (cb) => ipcRenderer.on('reminder-hide', cb),
});
