const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stickyApi', {
  getTasks:  ()            => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks)       => ipcRenderer.invoke('save-tasks', tasks),
  moveBy:    (dx, dy)      => ipcRenderer.invoke('move-sticky', dx, dy),
  resize:    (w, h)        => ipcRenderer.invoke('resize-sticky', w, h),
});
