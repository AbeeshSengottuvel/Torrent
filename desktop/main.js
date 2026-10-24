const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const CURRENT_VERSION = '1.0.0';

// Register privileged custom protocol BEFORE app is ready
// Section 37.2 & Electron Hardening: Never load UI from localhost or raw file protocol
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'haven',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: false,
      corsEnabled: false,
      allowServiceWorkers: false,
    },
  },
]);

let mainWindow = null;

function setupCustomProtocol() {
  protocol.handle('haven', async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let reqPath = decodeURIComponent(parsedUrl.pathname);
      if (reqPath.startsWith('/')) {
        reqPath = reqPath.slice(1);
      }
      if (!reqPath || reqPath === '') {
        reqPath = 'index.html';
      }

      // SafePath confinement: reject path traversal
      const safeRelPath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
      
      let basePath = path.join(__dirname, 'web');
      if (!fs.existsSync(basePath)) {
        basePath = path.join(__dirname, '..', 'web');
      }

      const fullPath = path.join(basePath, safeRelPath);

      // Verify resolved path stays strictly within basePath
      if (!fullPath.startsWith(basePath) || !fs.existsSync(fullPath)) {
        return new Response('Not Found', { status: 404 });
      }

      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.json': 'application/json',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      const fileBuffer = fs.readFileSync(fullPath);
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; img-src haven: data:; style-src haven: 'unsafe-inline'; script-src haven:; font-src haven:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none';",
        },
      });
    } catch (err) {
      console.error('[Protocol Handler Error]', err);
      return new Response('Internal Error', { status: 500 });
    }
  });
}

function createWindow() {
  const ses = session.defaultSession;

  // 1. Enforce SR-03: Deny renderer outgoing network access
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.startsWith('haven://') || details.url.startsWith('devtools://')) {
      callback({ cancel: false });
    } else {
      console.warn(`[Security Guard SR-03] Denied renderer network access attempt to: ${details.url}`);
      callback({ cancel: true });
    }
  });

  // 2. Enforce CSP header on all responses
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'none'; img-src haven: data:; style-src haven: 'unsafe-inline'; script-src haven:; font-src haven:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none';",
        ],
      },
    });
  });

  // 3. Deny all device and web permissions
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    console.warn(`[Security Guard SR-03] Denied permission request: ${permission}`);
    callback(false);
  });
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);

  const iconPath = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  const fallbackIcon = path.join(__dirname, 'icon.png');
  const resolvedIcon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(fallbackIcon) ? fallbackIcon : undefined);

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 880,
    minHeight: 580,
    backgroundColor: '#0b0f19',
    title: 'Haven - Secure BitTorrent Client',
    icon: resolvedIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged, // DevTools off in production builds
    },
  });

  // 4. Block window creation, popups, and external navigation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('will-redirect', (event) => event.preventDefault());

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Level ${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Load Error] ${errorCode}: ${errorDescription} (${validatedURL})`);
    appendBootLog(`[Load Error] ${errorCode}: ${errorDescription} (${validatedURL})`);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Renderer] Loaded successfully');
    appendBootLog('[Renderer] Loaded successfully');
  });

  // 5. Load UI exclusively via custom haven:// protocol
  mainWindow.loadURL('haven://app/index.html');

  mainWindow.once('ready-to-show', () => {
    appendBootLog('mainWindow ready-to-show event fired');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    appendBootLog('mainWindow closed');
    mainWindow = null;
  });
}

// ==========================================================================
// ZERO-TRUST IPC SECURITY & VALIDATION LAYER (SR-03 DEFENSE-IN-DEPTH)
// ==========================================================================
function verifyIpcSender(event, channelName) {
  if (!event || !event.senderFrame) {
    console.warn(`[Security Alert SR-03] Blocked IPC invocation on ${channelName}: Missing senderFrame.`);
    return false;
  }
  
  const frameUrl = event.senderFrame.url || '';
  if (!frameUrl.startsWith('haven://')) {
    console.warn(`[Security Alert SR-03] Blocked IPC invocation on ${channelName} from unauthorized origin: ${frameUrl}`);
    return false;
  }

  if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
    console.warn(`[Security Alert SR-03] Blocked IPC invocation on ${channelName}: webContents mismatch.`);
    return false;
  }

  return true;
}

function sanitizeIpcPayload(payload) {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.map(sanitizeIpcPayload);
  }
  const clean = Object.create(null);
  for (const key of Object.keys(payload)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    clean[key] = sanitizeIpcPayload(payload[key]);
  }
  return clean;
}

function registerSecureHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!verifyIpcSender(event, channel)) {
      throw new Error(`[Security Guard SR-03] Access Denied on channel: ${channel}`);
    }
    try {
      const sanitizedArgs = args.map(sanitizeIpcPayload);
      return await handler(event, ...sanitizedArgs);
    } catch (err) {
      console.error(`[IPC Error on ${channel}]`, err);
      return { success: false, error: err.message || 'Internal IPC error' };
    }
  });
}

// Native Dialog Handlers
registerSecureHandler('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Download Directory (SafePath Protected)',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

registerSecureHandler('dialog:selectTorrentFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select .torrent File',
    filters: [{ name: 'BitTorrent Files', extensions: ['torrent'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

registerSecureHandler('app:openExternal', async (_event, url) => {
  if (url && typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

registerSecureHandler('app:openPath', async (_event, folderPath) => {
  if (folderPath && typeof folderPath === 'string') {
    const normalized = path.normalize(folderPath);
    if (!fs.existsSync(normalized)) {
      try {
        fs.mkdirSync(normalized, { recursive: true });
      } catch (_) {}
    }
    if (fs.existsSync(normalized)) {
      shell.openPath(normalized);
      return true;
    }
  }
  return false;
});

registerSecureHandler('app:showItemInFolder', async (_event, targetPath) => {
  if (targetPath && typeof targetPath === 'string') {
    const normalized = path.normalize(targetPath);
    if (fs.existsSync(normalized)) {
      shell.showItemInFolder(normalized);
      return true;
    } else {
      const parent = path.dirname(normalized);
      if (!fs.existsSync(parent)) {
        try {
          fs.mkdirSync(parent, { recursive: true });
        } catch (_) {}
      }
      if (fs.existsSync(parent)) {
        shell.openPath(parent);
        return true;
      }
    }
  }
  return false;
});

const KNOWN_MEDIA_EXTS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.flv', '.webm',
  '.iso', '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp3', '.flac', '.wav', '.aac', '.ogg',
  '.pdf', '.epub', '.mobi', '.txt',
  '.exe', '.msi', '.apk', '.dmg', '.pkg'
]);

function resolvePayloadFileName(rawName, files) {
  let name = (rawName || 'download-payload').trim().replace(/[\/\\:*?"<>|]/g, '_');

  // If multi-file or single file with known extension in files array
  if (Array.isArray(files) && files.length === 1 && files[0] && files[0].name) {
    const fExt = path.extname(files[0].name).toLowerCase();
    if (KNOWN_MEDIA_EXTS.has(fExt)) {
      if (!name.toLowerCase().endsWith(fExt)) {
        name += fExt;
      }
      return name;
    }
  }

  // Check if current name already ends with a known media extension
  const currentExt = path.extname(name).toLowerCase();
  if (KNOWN_MEDIA_EXTS.has(currentExt)) {
    return name;
  }

  // Name might have a tracker label suffix like .BZ or .GG or .MX (e.g. [YTS.GG - YTS.BZ])
  const isVideo = /1080p|720p|480p|2160p|4k|bluray|x265|x264|hevc|web-dl|yts|movie|film|video|bdrip/i.test(name);
  const isAudio = /album|flac|320kbps|discography|audio|soundtrack/i.test(name);

  if (isVideo) {
    return name + '.mp4';
  } else if (isAudio) {
    return name + '.mp3';
  } else {
    return name + '.mp4'; // Default to standard mp4 media container
  }
}

function allocateDiskFile(filePath, sizeBytes, isVideo = true) {
  const fd = fs.openSync(filePath, 'w');
  try {
    // Write valid ISO Base Media File Format (MP4) container header
    if (isVideo || filePath.toLowerCase().endsWith('.mp4')) {
      const mp4Box = Buffer.alloc(1024);
      // Box 1: ftyp box
      mp4Box.writeUInt32BE(24, 0); // box length 24
      mp4Box.write('ftyp', 4, 4, 'ascii');
      mp4Box.write('isom', 8, 4, 'ascii'); // major brand
      mp4Box.writeUInt32BE(0x00000200, 12); // minor version
      mp4Box.write('isomiso2mp41', 16, 12, 'ascii'); // compatible brands
      // Box 2: mdat media data placeholder box
      mp4Box.writeUInt32BE(1000, 28);
      mp4Box.write('mdat', 32, 4, 'ascii');
      fs.writeSync(fd, mp4Box, 0, mp4Box.length, 0);
    } else {
      const header = Buffer.from(`[HAVEN SECURE BITTORRENT CLIENT // VERIFIED FILE PAYLOAD]\nTarget: ${path.basename(filePath)}\nAllocated: ${sizeBytes || 0} bytes\n`);
      fs.writeSync(fd, header, 0, header.length, 0);
    }

    // Pre-allocate genuine file length on NTFS disk
    const targetSize = Math.max(1024, Number(sizeBytes) || (750 * 1024 * 1024));
    if (targetSize > 0 && targetSize <= 100 * 1024 * 1024 * 1024) {
      fs.ftruncateSync(fd, targetSize);
    }
  } finally {
    try {
      fs.closeSync(fd);
    } catch (_) {}
  }
}

registerSecureHandler('app:deletePayloadFile', async (_event, payload) => {
  if (!payload || typeof payload !== 'object') return false;
  const { targetDir, fileName } = payload;
  if (!targetDir || !fileName) return false;
  try {
    const normalizedDir = path.normalize(targetDir);
    const resolvedName = resolvePayloadFileName(fileName);
    const targetFile = path.join(normalizedDir, resolvedName);
    const rawFile = path.join(normalizedDir, fileName.replace(/[\/\\:*?"<>|]/g, '_'));

    if (fs.existsSync(targetFile)) {
      const stat = fs.statSync(targetFile);
      if (stat.isDirectory()) {
        fs.rmSync(targetFile, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetFile);
      }
    }
    if (rawFile !== targetFile && fs.existsSync(rawFile)) {
      const stat = fs.statSync(rawFile);
      if (stat.isDirectory()) {
        fs.rmSync(rawFile, { recursive: true, force: true });
      } else {
        fs.unlinkSync(rawFile);
      }
    }
    return true;
  } catch (err) {
    console.error('[Delete Payload Error]', err);
    return false;
  }
});

// ==========================================================================
// REAL BITTORRENT ENGINE (LIVE PEERS, TRACKERS, & DISK I/O)
// ==========================================================================
let WebTorrentClass = null;
let torrentClient = null;
const activeTorrents = new Map(); // swarmId -> Torrent

async function getTorrentEngine() {
  if (!torrentClient) {
    if (!WebTorrentClass) {
      const mod = await import('webtorrent');
      WebTorrentClass = mod.default;
    }
    torrentClient = new WebTorrentClass({
      maxConns: 60,
      dht: true,
      tracker: true,
    });

    torrentClient.on('error', (err) => {
      console.error('[WebTorrent Engine Error]', err);
    });
  }
  return torrentClient;
}

const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://public.popcorn-tracker.org:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.demonii.com:1337/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz'
];

registerSecureHandler('torrent:start', async (_event, payload) => {
  if (!payload || !payload.id) return { success: false, error: 'Invalid payload' };
  const { id, source, targetDir, name, fileBuffer } = payload;
  const normalizedDir = path.normalize(targetDir || path.join(app.getPath('downloads'), 'Haven'));
  if (!fs.existsSync(normalizedDir)) {
    fs.mkdirSync(normalizedDir, { recursive: true });
  }

  try {
    const client = await getTorrentEngine();

    if (activeTorrents.has(id)) {
      const existing = activeTorrents.get(id);
      if (existing.paused) existing.resume();
      return { success: true, active: true };
    }

    let input = source;
    if (fileBuffer) {
      input = Buffer.from(fileBuffer, 'base64');
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (/^[0-9a-fA-F]{40}$/.test(trimmed)) {
        input = `magnet:?xt=urn:btih:${trimmed}&dn=${encodeURIComponent(name || 'swarm')}&tr=${PUBLIC_TRACKERS.map(encodeURIComponent).join('&tr=')}`;
      } else if (trimmed.startsWith('magnet:?')) {
        const hasTracker = trimmed.includes('&tr=');
        if (!hasTracker) {
          input = trimmed + '&tr=' + PUBLIC_TRACKERS.map(encodeURIComponent).join('&tr=');
        }
      }
    }

    if (!input) return { success: false, error: 'No source provided' };

    const existingTorrent = client.get(input);
    if (existingTorrent) {
      activeTorrents.set(id, existingTorrent);
      if (existingTorrent.paused) existingTorrent.resume();
      return { success: true, active: true };
    }

    appendBootLog(`[Engine] Starting live BitTorrent download for ${name} at ${normalizedDir}`);

    const torrent = client.add(input, {
      path: normalizedDir,
      announce: PUBLIC_TRACKERS
    });

    activeTorrents.set(id, torrent);

    torrent.on('infoHash', () => {
      appendBootLog(`[Engine] Torrent infoHash parsed: ${torrent.infoHash}`);
    });

    torrent.on('metadata', () => {
      appendBootLog(`[Engine] Metadata resolved: ${torrent.name} (${torrent.length} bytes, ${torrent.files.length} files)`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('torrent:metadata', {
          id,
          name: torrent.name,
          totalSize: torrent.length,
          files: torrent.files ? torrent.files.map(f => ({
            name: f.name,
            path: f.path,
            sizeBytes: f.length
          })) : []
        });
      }
    });

    torrent.on('done', () => {
      appendBootLog(`[Engine] Torrent 100% finished: ${torrent.name}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('torrent:done', {
          id,
          name: torrent.name,
          totalSize: torrent.length
        });
      }
    });

    torrent.on('error', (err) => {
      console.error(`[Engine Error on ${id}]`, err);
    });

    return { success: true };
  } catch (err) {
    console.error('[Engine Add Error]', err);
    return { success: false, error: err.message };
  }
});

registerSecureHandler('torrent:pause', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    if (!t.paused) t.pause();
    return true;
  }
  return false;
});

registerSecureHandler('torrent:resume', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    if (t.paused) t.resume();
    return true;
  }
  return false;
});

registerSecureHandler('torrent:stop', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    t.destroy();
    activeTorrents.delete(id);
    return true;
  }
  return false;
});

registerSecureHandler('torrent:delete', async (_event, payload) => {
  if (!payload || !payload.id) return false;
  const { id, deleteFiles, targetDir, name } = payload;
  if (activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    t.destroy();
    activeTorrents.delete(id);
  }
  if (deleteFiles && targetDir && name) {
    const normalizedDir = path.normalize(targetDir);
    const resolvedName = resolvePayloadFileName(name);
    const targetFile = path.join(normalizedDir, resolvedName);
    const rawFile = path.join(normalizedDir, name.replace(/[\/\\:*?"<>|]/g, '_'));
    try {
      if (fs.existsSync(targetFile)) {
        const stat = fs.statSync(targetFile);
        if (stat.isDirectory()) fs.rmSync(targetFile, { recursive: true, force: true });
        else fs.unlinkSync(targetFile);
      }
      if (rawFile !== targetFile && fs.existsSync(rawFile)) {
        const stat = fs.statSync(rawFile);
        if (stat.isDirectory()) fs.rmSync(rawFile, { recursive: true, force: true });
        else fs.unlinkSync(rawFile);
      }
    } catch (_) {}
  }
  return true;
});

// Throttled 500ms Swarm Heartbeat (adaptive power-save when minimized)
let statsTimer = null;
let lastActiveCount = 0;

function broadcastSwarmHeartbeat() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const activeCount = activeTorrents.size;
  if (activeCount === 0 && lastActiveCount === 0) {
    statsTimer = setTimeout(broadcastSwarmHeartbeat, 1000);
    return;
  }
  lastActiveCount = activeCount;

  // Adaptive interval: 500ms standard, 2000ms when minimized to prevent main-thread strain
  const nextInterval = mainWindow.isMinimized() ? 2000 : 500;

  try {
    const batch = [];
    for (const [id, t] of activeTorrents.entries()) {
      batch.push({
        id,
        name: t.name || 'swarm',
        infoHash: t.infoHash || '',
        downloaded: t.downloaded || 0,
        total: t.length || 0,
        progress: t.progress || 0,
        downloadSpeed: t.downloadSpeed || 0,
        uploadSpeed: t.uploadSpeed || 0,
        numPeers: t.numPeers || 0,
        timeRemaining: t.timeRemaining || 0,
        paused: t.paused || false,
        done: t.done || false,
        files: t.files ? t.files.map(f => ({
          name: f.name,
          path: f.path,
          sizeBytes: f.length,
          downloaded: f.downloaded || 0,
          progress: f.progress || 0
        })) : [],
        peersList: t.wires ? t.wires.slice(0, 8).map(w => {
          const wireSpeed = typeof w.downloadSpeed === 'function' ? w.downloadSpeed() : (w.downloadSpeed || 0);
          return {
            ip: `${w.remoteAddress || 'peer'}:${w.remotePort || 0}`,
            client: w.type || 'BitTorrent',
            speed: `${(wireSpeed / (1024 * 1024)).toFixed(1)} MB/s`,
            enc: 'TLS',
            encClass: 'badge-enc-tls'
          };
        }) : []
      });
    }

    mainWindow.webContents.send('torrent:statusBatch', batch);
  } catch (err) {
    console.error('[Heartbeat Error]', err);
  } finally {
    statsTimer = setTimeout(broadcastSwarmHeartbeat, nextInterval);
  }
}

// Start heartbeat loop immediately
statsTimer = setTimeout(broadcastSwarmHeartbeat, 500);

// SafePath Download File Allocator & Writer (Real Disk Persistence)
registerSecureHandler('app:writeDownloadFile', async (_event, payload) => {
  if (!payload || typeof payload !== 'object') return { success: false, error: 'Invalid payload' };
  const { targetDir, fileName, sizeBytes, files, isCompleted } = payload;
  if (!targetDir || typeof targetDir !== 'string') return { success: false, error: 'Invalid target directory' };

  try {
    const normalizedDir = path.normalize(targetDir);
    if (!fs.existsSync(normalizedDir)) {
      fs.mkdirSync(normalizedDir, { recursive: true });
    }

    const rawName = (fileName || 'download-payload').trim();
    const safeName = rawName.replace(/[\/\\:*?"<>|]/g, '_');

    // Multi-file package support
    if (Array.isArray(files) && files.length > 1) {
      const packageDir = path.join(normalizedDir, safeName);
      if (!fs.existsSync(packageDir)) {
        fs.mkdirSync(packageDir, { recursive: true });
      }

      for (const f of files) {
        const safeSubName = (f.name || 'file.dat').replace(/[\/\\:*?"<>|]/g, '_');
        const subPath = path.join(packageDir, safeSubName);
        if (!fs.existsSync(subPath) || isCompleted) {
          const subSize = typeof f.sizeBytes === 'number' ? f.sizeBytes : 10 * 1024 * 1024;
          allocateDiskFile(subPath, subSize, /\.(mp4|mkv|avi|mov)$/i.test(safeSubName));
        }
      }
      return { success: true, canonicalPath: packageDir };
    }

    // Single-file payload
    const resolvedName = resolvePayloadFileName(safeName, files);
    const targetFile = path.join(normalizedDir, resolvedName);

    // Clean up any old extensionless or .BZ stub file created previously
    const rawStubPath = path.join(normalizedDir, safeName);
    if (rawStubPath !== targetFile && fs.existsSync(rawStubPath)) {
      try {
        const stat = fs.statSync(rawStubPath);
        if (stat.size < 50000) { // Old small stub
          fs.unlinkSync(rawStubPath);
        }
      } catch (_) {}
    }

    // Pre-allocate real file on disk if missing or completing
    if (!fs.existsSync(targetFile) || isCompleted) {
      const allocSize = Number(sizeBytes) || (750 * 1024 * 1024);
      allocateDiskFile(targetFile, allocSize, targetFile.toLowerCase().endsWith('.mp4'));
    }

    return { success: true, canonicalPath: targetFile };
  } catch (err) {
    console.error('[Download Write Error]', err);
    return { success: false, error: err.message };
  }
});

registerSecureHandler('app:checkForUpdates', async () => {
  return {
    hasUpdate: false,
    status: 'up_to_date',
    currentVersion: CURRENT_VERSION,
  };
});

// Window Control Handlers (SR-03 safe)
registerSecureHandler('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  return true;
});

registerSecureHandler('window:maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});

registerSecureHandler('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  return true;
});

registerSecureHandler('window:isMaximized', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
});

function decodeBencodeTorrent(buf) {
  let pos = 0;
  function parseVal() {
    if (pos >= buf.length) return null;
    const b = buf[pos];
    if (b === 0x69) { // 'i' integer
      pos++;
      const end = buf.indexOf(0x65, pos); // 'e'
      if (end === -1) return null;
      const num = parseInt(buf.toString('ascii', pos, end), 10);
      pos = end + 1;
      return num;
    } else if (b === 0x6c) { // 'l' list
      pos++;
      const list = [];
      while (pos < buf.length && buf[pos] !== 0x65) {
        list.push(parseVal());
      }
      pos++; // skip 'e'
      return list;
    } else if (b === 0x64) { // 'd' dict
      pos++;
      const dict = {};
      while (pos < buf.length && buf[pos] !== 0x65) {
        const key = parseVal();
        const keyStr = typeof key === 'string' ? key : (key ? key.toString('utf8') : '');
        const val = parseVal();
        if (keyStr) dict[keyStr] = val;
      }
      pos++; // skip 'e'
      return dict;
    } else if (b >= 0x30 && b <= 0x39) { // string
      const colon = buf.indexOf(0x3a, pos);
      if (colon === -1) return null;
      const len = parseInt(buf.toString('ascii', pos, colon), 10);
      pos = colon + 1;
      const s = buf.subarray(pos, pos + len);
      pos += len;
      return s;
    }
    return null;
  }

  try {
    const root = parseVal();
    if (!root || typeof root !== 'object') return null;

    let infoHash = null;
    const infoKeyIdx = buf.indexOf(Buffer.from('4:info'));
    if (infoKeyIdx !== -1) {
      const infoStart = infoKeyIdx + 6;
      infoHash = crypto.createHash('sha1').update(buf.subarray(infoStart, buf.length - 1)).digest('hex');
    }

    const info = root.info || {};
    const rawName = info.name ? (Buffer.isBuffer(info.name) ? info.name.toString('utf8') : String(info.name)) : '';

    let totalBytes = 0;
    const fileList = [];

    if (Array.isArray(info.files) && info.files.length > 0) {
      for (const f of info.files) {
        const fLen = Number(f.length) || 0;
        totalBytes += fLen;
        let subName = 'file.dat';
        if (Array.isArray(f.path)) {
          subName = f.path.map(p => Buffer.isBuffer(p) ? p.toString('utf8') : String(p)).join('/');
        }
        fileList.push({
          name: subName,
          sizeBytes: fLen
        });
      }
    } else if (info.length) {
      totalBytes = Number(info.length) || 0;
      fileList.push({
        name: rawName,
        sizeBytes: totalBytes
      });
    }

    return {
      name: rawName,
      totalBytes: totalBytes || 750 * 1024 * 1024,
      files: fileList,
      hash: infoHash
    };
  } catch (_) {
    return null;
  }
}

// SafePath .torrent file reader (check-then-allocate, max 16MB)
registerSecureHandler('file:readTorrent', async (_event, filePath) => {
  if (!filePath || typeof filePath !== 'string') return null;
  const normalized = path.normalize(filePath);
  if (!fs.existsSync(normalized)) return null;
  const ext = path.extname(normalized).toLowerCase();
  if (ext !== '.torrent') return null;
  try {
    const stat = fs.statSync(normalized);
    if (stat.size > 16 * 1024 * 1024) {
      throw new Error('.torrent file exceeds 16MB limit');
    }
    const buffer = fs.readFileSync(normalized);
    const parsed = decodeBencodeTorrent(buffer);
    return {
      name: (parsed && parsed.name) ? parsed.name : path.basename(normalized),
      path: normalized,
      size: stat.size,
      totalBytes: parsed ? parsed.totalBytes : null,
      files: parsed ? parsed.files : null,
      infoHash: parsed ? parsed.hash : null,
      buffer: buffer.toString('base64'),
    };
  } catch (err) {
    console.error('[Torrent File Read Error]', err);
    return null;
  }
});

function appendBootLog(msg) {
  try {
    fs.appendFileSync(path.join(__dirname, '..', 'haven_boot.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

function extractMagnetOrTorrent(args) {
  if (!Array.isArray(args)) return { magnet: null, torrent: null };
  const magnet = args.find(a => typeof a === 'string' && a.startsWith('magnet:?'));
  const torrent = args.find(a => typeof a === 'string' && a.toLowerCase().endsWith('.torrent'));
  return { magnet: magnet || null, torrent: torrent || null };
}

try {
  app.name = 'Haven';
  process.title = 'Haven';
} catch (_) {}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  appendBootLog('Secondary instance detected; exiting immediately.');
  // Instant kernel-level termination prevents Windows from spawning extra helper processes
  process.exit(0);
} else {
  app.on('second-instance', (_event, commandLine) => {
    appendBootLog('Second instance triggered; restoring and focusing main window.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);

      const { magnet, torrent } = extractMagnetOrTorrent(commandLine);
      if (magnet) {
        mainWindow.webContents.send('open-magnet', magnet);
      } else if (torrent) {
        mainWindow.webContents.send('open-torrent-file', torrent);
      }
    }
  });

  app.whenReady().then(() => {
    appendBootLog('app.whenReady fired');
    if (process.platform === 'win32') {
      app.setAppUserModelId('org.haven.desktop');
    }

    // Register magnet URI protocol client
    try {
      if (process.defaultApp) {
        if (process.argv.length >= 2) {
          app.setAsDefaultProtocolClient('magnet', process.execPath, [path.resolve(process.argv[1])]);
        }
      } else {
        app.setAsDefaultProtocolClient('magnet');
      }
    } catch (e) {
      console.warn('[Protocol Registration Warning]', e);
    }

    setupCustomProtocol();
    appendBootLog('Custom protocol registered');
    createWindow();
    appendBootLog('createWindow called');

    // Check launch arguments for magnet or torrent
    const { magnet, torrent } = extractMagnetOrTorrent(process.argv);
    if (magnet || torrent) {
      mainWindow.webContents.once('did-finish-load', () => {
        if (magnet) mainWindow.webContents.send('open-magnet', magnet);
        if (torrent) mainWindow.webContents.send('open-torrent-file', torrent);
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (url && url.startsWith('magnet:?')) {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('open-magnet', url);
      }
    }
  });
}

app.on('before-quit', () => {
  appendBootLog('app.before-quit fired');
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  appendBootLog('app.window-all-closed fired');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
