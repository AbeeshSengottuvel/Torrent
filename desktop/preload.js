/**
 * HAVEN // SECURE PRELOAD BRIDGE (SR-03 HARDENED)
 * Zero-trust context isolation boundary between Renderer and Main process.
 * Conforms to docs/PLAN.md Section 16 (SafePath) & Section 18 (NetGuard).
 */

const { contextBridge, ipcRenderer, webFrame } = require('electron');

/**
 * Validates that an argument is a plain string.
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Validates and sanitizes a listener callback.
 */
function createSafeListener(channel, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(`[Haven Preload] Listener for ${channel} must be a function.`);
  }

  const handler = (_event, data) => {
    try {
      callback(data);
    } catch (err) {
      console.error(`[Haven Preload] Error in ${channel} callback:`, err);
    }
  };

  ipcRenderer.on(channel, handler);

  // Return unsubscribe teardown function to prevent memory leaks
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const nativeBridge = {
  isDesktop: true,
  appVersion: '1.0.0',

  // Dialog Operations
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectTorrentFile: () => ipcRenderer.invoke('dialog:selectTorrentFile'),
  
  // SafePath File Inspection
  readTorrentFile: (filePath) => {
    if (!isNonEmptyString(filePath)) {
      return Promise.reject(new Error('[SafePath] Invalid torrent file path.'));
    }
    return ipcRenderer.invoke('file:readTorrent', filePath.trim());
  },

  // Shell / Path Operations
  openExternal: (url) => {
    if (!isNonEmptyString(url) || (!url.startsWith('https://') && !url.startsWith('http://'))) {
      return Promise.reject(new Error('[Security Guard] Only http/https URLs may be opened externally.'));
    }
    return ipcRenderer.invoke('app:openExternal', url.trim());
  },

  openPath: (folderPath) => {
    if (!isNonEmptyString(folderPath)) {
      return Promise.reject(new Error('[SafePath] Invalid directory path.'));
    }
    return ipcRenderer.invoke('app:openPath', folderPath.trim());
  },

  showItemInFolder: (filePath) => {
    if (!isNonEmptyString(filePath)) {
      return Promise.reject(new Error('[SafePath] Invalid file path.'));
    }
    return ipcRenderer.invoke('app:showItemInFolder', filePath.trim());
  },

  // File Allocator & Eraser
  writeDownloadFile: (payload) => {
    if (!payload || typeof payload !== 'object') {
      return Promise.reject(new Error('[SafePath] Invalid download allocation payload.'));
    }
    return ipcRenderer.invoke('app:writeDownloadFile', payload);
  },

  deletePayloadFile: (payload) => {
    if (!payload || typeof payload !== 'object') {
      return Promise.reject(new Error('[SafePath] Invalid deletion payload.'));
    }
    return ipcRenderer.invoke('app:deletePayloadFile', payload);
  },

  // BitTorrent Swarm Lifecycle Operations
  startTorrent: (payload) => {
    if (!payload || typeof payload !== 'object' || !isNonEmptyString(payload.id)) {
      return Promise.reject(new Error('[Swarm Engine] Invalid torrent start payload.'));
    }
    return ipcRenderer.invoke('torrent:start', payload);
  },

  pauseTorrent: (id) => {
    if (!isNonEmptyString(id)) return Promise.resolve(false);
    return ipcRenderer.invoke('torrent:pause', id);
  },

  resumeTorrent: (id) => {
    if (!isNonEmptyString(id)) return Promise.resolve(false);
    return ipcRenderer.invoke('torrent:resume', id);
  },

  stopTorrent: (id) => {
    if (!isNonEmptyString(id)) return Promise.resolve(false);
    return ipcRenderer.invoke('torrent:stop', id);
  },

  deleteTorrent: (payload) => {
    if (!payload || typeof payload !== 'object' || !isNonEmptyString(payload.id)) {
      return Promise.resolve(false);
    }
    return ipcRenderer.invoke('torrent:delete', payload);
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Native Zoom Controls (Bounds-checked 50% - 300%)
  setZoomFactor: (factor) => {
    if (typeof factor !== 'number' || !Number.isFinite(factor)) return;
    const clamped = Math.max(0.5, Math.min(3.0, factor));
    webFrame.setZoomFactor(clamped);
  },
  getZoomFactor: () => webFrame.getZoomFactor(),

  // Update Checks
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),

  // Teardown-Safe Event Streams
  onTorrentStatusBatch: (callback) => createSafeListener('torrent:statusBatch', callback),
  onTorrentMetadata: (callback) => createSafeListener('torrent:metadata', callback),
  onTorrentDone: (callback) => createSafeListener('torrent:done', callback),
  onUpdateAvailable: (callback) => createSafeListener('update:available', callback),
  onOpenMagnet: (callback) => createSafeListener('open-magnet', callback),
  onOpenTorrentFile: (callback) => createSafeListener('open-torrent-file', callback)
};

// Freeze the API object to prevent any renderer-side prototype tampering
contextBridge.exposeInMainWorld('havenNative', Object.freeze(nativeBridge));
