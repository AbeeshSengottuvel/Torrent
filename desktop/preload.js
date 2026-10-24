const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('havenNative', {
  isDesktop: true,
  appVersion: '1.0.0',
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectTorrentFile: () => ipcRenderer.invoke('dialog:selectTorrentFile'),
  readTorrentFile: (filePath) => ipcRenderer.invoke('file:readTorrent', filePath),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  
  // Window Control Handlers
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Native Zoom Controls
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),

  // Event Listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (_event, data) => callback(data));
  },
  onOpenMagnet: (callback) => {
    ipcRenderer.on('open-magnet', (_event, uri) => callback(uri));
  },
  onOpenTorrentFile: (callback) => {
    ipcRenderer.on('open-torrent-file', (_event, filePath) => callback(filePath));
  }
});
