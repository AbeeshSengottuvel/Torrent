const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('havenNative', {
  isDesktop: true,
  appVersion: '1.0.0',
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectTorrentFile: () => ipcRenderer.invoke('dialog:selectTorrentFile'),
  readTorrentFile: (filePath) => ipcRenderer.invoke('file:readTorrent', filePath),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openPath: (folderPath) => ipcRenderer.invoke('app:openPath', folderPath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('app:showItemInFolder', filePath),
  writeDownloadFile: (payload) => ipcRenderer.invoke('app:writeDownloadFile', payload),
  deletePayloadFile: (payload) => ipcRenderer.invoke('app:deletePayloadFile', payload),
  
  // Real BitTorrent Engine IPC Handlers
  startTorrent: (payload) => ipcRenderer.invoke('torrent:start', payload),
  pauseTorrent: (id) => ipcRenderer.invoke('torrent:pause', id),
  resumeTorrent: (id) => ipcRenderer.invoke('torrent:resume', id),
  stopTorrent: (id) => ipcRenderer.invoke('torrent:stop', id),
  deleteTorrent: (payload) => ipcRenderer.invoke('torrent:delete', payload),

  // Window Control Handlers
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Native Zoom Controls
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),

  // Event Listeners
  onTorrentStatusBatch: (callback) => {
    ipcRenderer.on('torrent:statusBatch', (_event, batch) => callback(batch));
  },
  onTorrentMetadata: (callback) => {
    ipcRenderer.on('torrent:metadata', (_event, data) => callback(data));
  },
  onTorrentDone: (callback) => {
    ipcRenderer.on('torrent:done', (_event, data) => callback(data));
  },
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
