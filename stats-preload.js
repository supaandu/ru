const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stats', {
  getStats: () => ipcRenderer.invoke('get-stats'),
});
