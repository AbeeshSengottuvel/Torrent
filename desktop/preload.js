const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('havenNative', {
  isDesktop: true,
  appVersion: '1.0.0',
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectTorrentFile: () => ipcRenderer.invoke('dialog:selectTorrentFile'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (_event, data) => callback(data));
  }
});
