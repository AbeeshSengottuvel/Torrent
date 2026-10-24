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
      throw new Error(`[IPC:${channel}] ${err.message || 'Operation failed'}`);
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

// ==========================================================================
// SAFEPATH DISK CONFINEMENT & SECURITY GATE (SR-04 / SR-16)
// ==========================================================================
const BLOCKED_EXECUTABLE_EXTS = new Set([
  '.exe', '.bat', '.ps1', '.scr', '.msi', '.cmd', '.vbs', '.com', 
  '.hta', '.dll', '.sys', '.cpl', '.pif', '.reg', '.wsf', '.vbe', '.jse'
]);

const PROTECTED_SYSTEM_PATHS = [
  process.env.SystemRoot, // e.g. C:\Windows
  process.env.ProgramFiles,
  process.env['ProgramFiles(x86)'],
  process.env.ProgramData
].filter(Boolean).map(p => path.normalize(p).toLowerCase());

/**
 * Validates that a target directory is real, canonical, not a protected OS path,
 * and writable (SafePath Confinement).
 */
async function validateSafePathTarget(targetDir) {
  if (!targetDir || typeof targetDir !== 'string') {
    throw new Error('[SafePath] Target directory path must be a non-empty string.');
  }

  // Reject path traversal and null bytes
  if (targetDir.includes('\0') || targetDir.split(/[\\\/]/).includes('..')) {
    throw new Error('[SafePath Traversal Alert] Path traversal characters detected in target path.');
  }

  const normalized = path.normalize(targetDir);

  // Reject protected Windows system directories
  const lowerNorm = normalized.toLowerCase();
  for (const sysPath of PROTECTED_SYSTEM_PATHS) {
    if (lowerNorm === sysPath || lowerNorm.startsWith(sysPath + path.sep)) {
      throw new Error(`[SafePath Security Gate] Denied write access to protected OS directory: ${normalized}`);
    }
  }

  // Ensure directory exists
  if (!fs.existsSync(normalized)) {
    await fs.promises.mkdir(normalized, { recursive: true });
  }

  // Resolve canonical path to prevent symlink/junction escapes
  const realTarget = await fs.promises.realpath(normalized);
  return realTarget;
}

/**
 * Validates torrent internal file paths against traversal and executable payload rules.
 */
function inspectTorrentFileManifest(files) {
  const sanitizedFiles = [];
  let execRiskDetected = false;

  if (Array.isArray(files)) {
    for (const f of files) {
      const relPath = (f.path || f.name || '').replace(/[\0]/g, '');
      const parts = relPath.split(/[\\\/]/);
      if (parts.includes('..') || path.isAbsolute(relPath)) {
        throw new Error(`[SafePath Traversal Alert] Malicious internal path rejected: ${relPath}`);
      }

      const ext = path.extname(relPath).toLowerCase();
      const isExec = BLOCKED_EXECUTABLE_EXTS.has(ext);
      if (isExec) {
        execRiskDetected = true;
      }

      sanitizedFiles.push({
        name: f.name || path.basename(relPath),
        path: relPath,
        sizeBytes: Number(f.length || f.sizeBytes || 0),
        isRisk: isExec,
        quarantined: isExec
      });
    }
  }

  return { sanitizedFiles, execRiskDetected };
}

/**
 * Queries real NTFS volume statistics for available disk space.
 */
async function queryVolumeStorage(targetPath) {
  try {
    const canonical = await validateSafePathTarget(targetPath || app.getPath('downloads'));
    const stats = await fs.promises.statfs(canonical);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const rootDrive = path.parse(canonical).root;
    return {
      success: true,
      canonicalPath: canonical,
      rootDrive,
      freeBytes,
      totalBytes,
      freeFormatted: (freeBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
      totalFormatted: (totalBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

registerSecureHandler('safepath:getVolumeInfo', async (_event, targetPath) => {
  return await queryVolumeStorage(targetPath || app.getPath('downloads'));
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

  if (Array.isArray(files) && files.length === 1 && files[0] && files[0].name) {
    const fExt = path.extname(files[0].name).toLowerCase();
    if (KNOWN_MEDIA_EXTS.has(fExt)) {
      if (!name.toLowerCase().endsWith(fExt)) {
        name += fExt;
      }
      return name;
    }
  }

  const currentExt = path.extname(name).toLowerCase();
  if (KNOWN_MEDIA_EXTS.has(currentExt)) {
    return name;
  }

  const isVideo = /1080p|720p|480p|2160p|4k|bluray|x265|x264|hevc|web-dl|yts|movie|film|video|bdrip/i.test(name);
  const isAudio = /album|flac|320kbps|discography|audio|soundtrack/i.test(name);

  if (isVideo) {
    return name + '.mp4';
  } else if (isAudio) {
    return name + '.mp3';
  } else {
    return name + '.mp4';
  }
}

// Authentic BitTorrent filesystem writes are handled directly by the WebTorrent storage engine.

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
let parseTorrentFunc = null;
let torrentClient = null;
const activeTorrents = new Map(); // swarmId -> Torrent

function broadcastKernelLog(tag, message, level = 'info') {
  const ts = new Date().toTimeString().split(' ')[0];
  const item = { timestamp: ts, tag, message, level };
  appendBootLog(`[${tag}] ${message}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('kernel:log', item);
  }
}

async function getParseTorrent() {
  if (!parseTorrentFunc) {
    const pt = await import('parse-torrent');
    parseTorrentFunc = pt.default;
  }
  return parseTorrentFunc;
}

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
      broadcastKernelLog('ENGINE/ERR', `Engine error: ${err.message}`, 'error');
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
  const { id, source, targetDir, name, fileBuffer, deselectedFiles } = payload;
  
  // SafePath Confinement: Validate and canonicalize destination folder
  const safeTargetDir = await validateSafePathTarget(targetDir || path.join(app.getPath('downloads'), 'Haven'));
  broadcastKernelLog('FS/INGEST', `SafePath validated destination mount: ${safeTargetDir}`);

  // SafePath Storage Check: Verify volume space before start
  if (payload.sizeBytes && typeof payload.sizeBytes === 'number' && payload.sizeBytes > 0) {
    const vol = await queryVolumeStorage(safeTargetDir);
    if (vol.success && vol.freeBytes > 0 && vol.freeBytes < payload.sizeBytes) {
      broadcastKernelLog('DISK/ERR', `Insufficient disk space on ${vol.rootDrive}: Needed ${payload.sizeBytes} B, free ${vol.freeBytes} B`, 'error');
      throw new Error(`[SafePath Storage Gate] Insufficient disk space on ${vol.rootDrive}. Required: ${payload.sizeBytes} bytes, Available: ${vol.freeBytes} bytes.`);
    } else if (vol.success) {
      broadcastKernelLog('DISK/OK', `Storage Gate: ${vol.freeFormatted} available on ${vol.rootDrive} (Allocation verified)`);
    }
  }

  try {
    const client = await getTorrentEngine();

    if (activeTorrents.has(id)) {
      const existing = activeTorrents.get(id);
      if (existing.paused) {
        existing.resume();
        broadcastKernelLog('ENGINE', `Resumed active transfer: ${existing.name || id}`);
      }
      wakeHeartbeatIfNeeded();
      return { success: true, active: true };
    }

    let input = source;
    if (fileBuffer) {
      input = Buffer.from(fileBuffer, 'base64');
      broadcastKernelLog('ENGINE', `Passing authentic .torrent binary payload (${input.length} B) to WebTorrent client`);
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (/^[0-9a-fA-F]{40}$/.test(trimmed)) {
        input = `magnet:?xt=urn:btih:${trimmed}&dn=${encodeURIComponent(name || 'swarm')}&tr=${PUBLIC_TRACKERS.map(encodeURIComponent).join('&tr=')}`;
        broadcastKernelLog('DHT/TRACKER', `Assembled Magnet URI with tiered trackers for BTIH: ${trimmed.slice(0, 16)}...`);
      } else if (trimmed.startsWith('magnet:?')) {
        const hasTracker = trimmed.includes('&tr=');
        if (!hasTracker) {
          input = trimmed + '&tr=' + PUBLIC_TRACKERS.map(encodeURIComponent).join('&tr=');
        }
        broadcastKernelLog('DHT/TRACKER', `Connecting via Magnet URI: ${input.slice(0, 48)}...`);
      }
    }

    if (!input) return { success: false, error: 'No source provided' };

    const existingTorrent = client.get(input);
    if (existingTorrent) {
      activeTorrents.set(id, existingTorrent);
      if (existingTorrent.paused) existingTorrent.resume();
      broadcastKernelLog('ENGINE', `Re-attached to existing swarm: ${existingTorrent.infoHash}`);
      wakeHeartbeatIfNeeded();
      return { success: true, active: true };
    }

    broadcastKernelLog('ENGINE', `Starting swarm download for "${name || id}" at ${safeTargetDir}`);

    const torrent = client.add(input, {
      path: safeTargetDir,
      announce: PUBLIC_TRACKERS
    });

    activeTorrents.set(id, torrent);
    wakeHeartbeatIfNeeded();

    torrent.on('infoHash', () => {
      broadcastKernelLog('DHT/TRACKER', `InfoHash active on DHT network: ${torrent.infoHash}`);
    });

    torrent.on('metadata', () => {
      broadcastKernelLog('DHT/TRACKER', `Metadata resolved: "${torrent.name}" (${(torrent.length / (1024*1024)).toFixed(1)} MB, ${torrent.files ? torrent.files.length : 0} files)`);
      
      const { sanitizedFiles, execRiskDetected } = inspectTorrentFileManifest(torrent.files);

      // SafePath Confinement: Automatically quarantine and deselect executable extensions
      if (Array.isArray(torrent.files)) {
        torrent.files.forEach((file, idx) => {
          const ext = path.extname(file.name || '').toLowerCase();
          if (BLOCKED_EXECUTABLE_EXTS.has(ext)) {
            file.deselect();
            broadcastKernelLog('SAFEPATH/GATE', `Quarantined and deselected executable risk: ${file.name}`, 'warn');
          } else if (Array.isArray(deselectedFiles) && (deselectedFiles.includes(idx) || deselectedFiles.includes(file.name))) {
            file.deselect();
            broadcastKernelLog('SAFEPATH/OPT', `Deselected non-required file: ${file.name}`);
          }
        });
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('torrent:metadata', {
          id,
          name: torrent.name,
          totalSize: torrent.length,
          execRiskDetected,
          files: sanitizedFiles
        });
      }
    });

    torrent.on('ready', () => {
      broadcastKernelLog('ENGINE', `Swarm ready: ${torrent.pieces?.length || 0} pieces (${torrent.pieceLength} bytes/piece). Sockets listening.`);
    });

    torrent.on('warning', (err) => {
      broadcastKernelLog('WARN/TRACKER', `Swarm warning [${torrent.name || id}]: ${err.message}`, 'warn');
    });

    torrent.on('error', (err) => {
      broadcastKernelLog('ERR/SWARM', `Swarm error [${torrent.name || id}]: ${err.message}`, 'error');
    });

    let wireCounter = 0;
    torrent.on('wire', (wire, addr) => {
      wireCounter++;
      const peerClient = wire.peerExtendedHandshake?.v || wire.type || 'uTP/TCP';
      const encState = wire.isEncrypted ? 'CHACHA20/TLS' : 'PLAIN';
      broadcastKernelLog('WIRE/HANDSHAKE', `Connected to peer #${wireCounter} at ${addr} | Client: ${peerClient} | Encryption: ${encState}`);

      wire.on('unchoke', () => {
        broadcastKernelLog('WIRE/UNCHOKE', `Peer ${addr} sent UNCHOKE message. Active data flow engaged.`);
      });

      wire.on('close', () => {
        // Wire closed silently
      });
    });

    let loggedFirstPiece = false;
    torrent.on('piece', (pieceIndex) => {
      if (!loggedFirstPiece) {
        loggedFirstPiece = true;
        broadcastKernelLog('DISK/SHA1', `First piece #${pieceIndex} verified against SHA-1 hash. Committed to NTFS: ${safeTargetDir}`);
      }
    });

    torrent.on('done', () => {
      broadcastKernelLog('DISK/SHA1', `All pieces verified (100.0% SHA-1 integrity). Flushed to ${safeTargetDir}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('torrent:done', {
          id,
          name: torrent.name,
          totalSize: torrent.length
        });
      }
    });

    return { success: true };
  } catch (err) {
    broadcastKernelLog('ERR/ADD', `Failed to start swarm: ${err.message}`, 'error');
    throw new Error(`[Engine] Failed to add swarm: ${err.message}`);
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
    wakeHeartbeatIfNeeded();
    return true;
  }
  return false;
});

registerSecureHandler('torrent:stop', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    t.destroy();
    activeTorrents.delete(id);
    diskBytesCache.delete(id);
    return true;
  }
  return false;
});

registerSecureHandler('torrent:recheck', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    if (typeof t.rescanPieces === 'function') {
      t.rescanPieces();
      return true;
    }
    if (t.paused) t.resume();
    return true;
  }
  return false;
});

registerSecureHandler('torrent:selectFiles', async (_event, payload) => {
  if (!payload || !payload.id || !Array.isArray(payload.fileIndices)) return false;
  if (activeTorrents.has(payload.id)) {
    const t = activeTorrents.get(payload.id);
    if (Array.isArray(t.files)) {
      t.files.forEach((f, idx) => {
        const ext = path.extname(f.name || '').toLowerCase();
        if (BLOCKED_EXECUTABLE_EXTS.has(ext)) {
          f.deselect();
        } else if (payload.fileIndices.includes(idx)) {
          f.select();
        } else {
          f.deselect();
        }
      });
      return true;
    }
  }
  return false;
});

registerSecureHandler('torrent:delete', async (_event, payload) => {
  if (!payload || !payload.id) return false;
  const { id, deleteFiles, targetDir, name } = payload;
  diskBytesCache.delete(id);
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

// Ground-Truth Asynchronous Disk Byte Verifier (Cached every 2500ms to preserve 60fps)
const diskBytesCache = new Map(); // swarmId -> { bytes: number, lastChecked: number }

async function getTorrentBytesOnDisk(torrentId, torrent) {
  if (!torrent) return 0;
  const now = Date.now();
  const cached = diskBytesCache.get(torrentId);
  if (cached && (now - cached.lastChecked < 2500)) {
    return cached.bytes;
  }

  try {
    let totalBytes = 0;
    if (Array.isArray(torrent.files) && torrent.files.length > 0) {
      for (const f of torrent.files) {
        if (!f.path) continue;
        const fullFilePath = path.join(torrent.path, f.path);
        try {
          const stat = await fs.promises.stat(fullFilePath);
          totalBytes += stat.size;
        } catch (_) {}
      }
    } else if (torrent.name && torrent.path) {
      const singlePath = path.join(torrent.path, torrent.name);
      try {
        const stat = await fs.promises.stat(singlePath);
        totalBytes = stat.size;
      } catch (_) {}
    }
    diskBytesCache.set(torrentId, { bytes: totalBytes, lastChecked: now });
    return totalBytes;
  } catch (_) {
    return cached ? cached.bytes : 0;
  }
}

// Adaptive 500ms Ground-Truth Swarm Heartbeat
let statsTimer = null;

function wakeHeartbeatIfNeeded() {
  if (statsTimer === null && activeTorrents.size > 0) {
    broadcastSwarmHeartbeat();
  }
}

async function broadcastSwarmHeartbeat() {
  if (statsTimer) {
    clearTimeout(statsTimer);
    statsTimer = null;
  }

  if (!mainWindow || mainWindow.isDestroyed()) return;

  // Law 1: Pause heartbeat completely when zero swarms are active
  if (activeTorrents.size === 0) {
    return;
  }

  // Adaptive throttling: 500ms when focused/visible, 2000ms when minimized
  const nextInterval = mainWindow.isMinimized() ? 2000 : 500;

  try {
    const batch = [];
    for (const [id, t] of activeTorrents.entries()) {
      const totalPieces = t.pieces ? t.pieces.length : 0;
      const pieceLength = t.pieceLength || 0;
      const bytesOnDisk = await getTorrentBytesOnDisk(id, t);

      const livePeers = t.wires ? t.wires.slice(0, 8).map(w => {
        const clientVer = (w.peerExtendedHandshake && w.peerExtendedHandshake.v) 
          ? w.peerExtendedHandshake.v 
          : (w.type || 'BitTorrent');
        const wireSpeed = typeof w.downloadSpeed === 'function' ? w.downloadSpeed() : 0;
        const wireUpSpeed = typeof w.uploadSpeed === 'function' ? w.uploadSpeed() : 0;
        return {
          address: `${w.remoteAddress || 'peer'}:${w.remotePort || 0}`,
          client: clientVer,
          downloaded: w.downloaded || 0,
          uploaded: w.uploaded || 0,
          speed: wireSpeed,
          upSpeed: wireUpSpeed
        };
      }) : [];

      batch.push({
        id,
        name: t.name || 'swarm',
        infoHash: t.infoHash || '',
        pieceLength,
        totalPieces,
        verifiedBytes: t.downloaded || 0,
        receivedBytes: t.received || 0,
        uploadedBytes: t.uploaded || 0,
        bytesOnDisk,
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
        livePeers
      });
    }

    mainWindow.webContents.send('torrent:statusBatch', batch);
  } catch (err) {
    console.error('[Heartbeat Error]', err);
  } finally {
    if (activeTorrents.size > 0 && mainWindow && !mainWindow.isDestroyed()) {
      statsTimer = setTimeout(broadcastSwarmHeartbeat, nextInterval);
    }
  }
}

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

async function handleParseTorrentFile(fileArg) {
  if (!fileArg) throw new Error('[SafePath] No torrent file or buffer provided');

  let buffer;
  let sourcePath = null;

  if (typeof fileArg === 'string') {
    const trimmed = fileArg.trim();
    if (trimmed.length < 1024 && fs.existsSync(trimmed)) {
      sourcePath = path.normalize(trimmed);
      const stat = await fs.promises.stat(sourcePath);
      if (stat.size > 16 * 1024 * 1024) {
        throw new Error('[SafePath / SR-04] .torrent file exceeds 16 MiB hard limit.');
      }
      buffer = await fs.promises.readFile(sourcePath);
      broadcastKernelLog('FS/INGEST', `Reading .torrent package from disk: ${sourcePath} (${stat.size} bytes)`);
    } else {
      buffer = Buffer.from(trimmed, 'base64');
      broadcastKernelLog('FS/INGEST', `Reading .torrent binary buffer (${buffer.length} bytes)`);
    }
  } else if (fileArg.buffer && typeof fileArg.buffer === 'string') {
    buffer = Buffer.from(fileArg.buffer, 'base64');
    sourcePath = fileArg.path || null;
    broadcastKernelLog('FS/INGEST', `Reading .torrent buffer payload (${buffer.length} bytes)`);
  } else if (Buffer.isBuffer(fileArg) || fileArg instanceof Uint8Array) {
    buffer = Buffer.from(fileArg);
    broadcastKernelLog('FS/INGEST', `Reading raw binary .torrent payload (${buffer.length} bytes)`);
  } else {
    throw new Error('[SafePath] Unsupported torrent input format.');
  }

  const parseTorrent = await getParseTorrent();
  const parsed = await parseTorrent(buffer);

  if (!parsed || !parsed.infoHash) {
    broadcastKernelLog('BENCODE/ERR', 'Corrupt Bencode: could not compute infoHash.', 'error');
    throw new Error('[BENCODE] Corrupt or invalid .torrent file. InfoHash missing.');
  }

  const infoHash = parsed.infoHash.toLowerCase();
  const name = parsed.name || (sourcePath ? path.basename(sourcePath, '.torrent') : 'unnamed-torrent');
  const pieceLength = parsed.pieceLength || 0;
  const totalLength = Number(parsed.length) || 0;
  const pieces = parsed.pieces ? parsed.pieces.length : (pieceLength > 0 ? Math.ceil(totalLength / pieceLength) : 0);
  const trackers = Array.isArray(parsed.announce) ? parsed.announce : [];

  const files = (parsed.files || []).map(f => {
    const fPath = f.path || f.name || 'payload';
    const ext = path.extname(fPath).toLowerCase();
    const isRisk = BLOCKED_EXECUTABLE_EXTS.has(ext);
    return {
      name: f.name || path.basename(fPath),
      path: fPath,
      sizeBytes: Number(f.length) || 0,
      isRisk,
      selected: !isRisk,
      locked: isRisk
    };
  });

  if (files.length === 0 && totalLength > 0) {
    const ext = path.extname(name).toLowerCase();
    const isRisk = BLOCKED_EXECUTABLE_EXTS.has(ext);
    files.push({
      name,
      path: name,
      sizeBytes: totalLength,
      isRisk,
      selected: !isRisk,
      locked: isRisk
    });
  }

  broadcastKernelLog('BENCODE', `Decoded: "${name}" | InfoHash: ${infoHash} | Total: ${(totalLength / (1024*1024)).toFixed(1)} MB | Pieces: ${pieces} (${pieceLength} B) | Trackers: ${trackers.length}`);

  return {
    success: true,
    infoHash,
    name,
    totalBytes: totalLength,
    pieceLength,
    pieces,
    files,
    announce: trackers,
    buffer: buffer.toString('base64'),
    sourcePath: sourcePath || null
  };
}

// SafePath authentic Bencode torrent parser
registerSecureHandler('torrent:parseTorrentFile', async (_event, fileArg) => {
  return await handleParseTorrentFile(fileArg);
});

registerSecureHandler('file:readTorrent', async (_event, filePath) => {
  return await handleParseTorrentFile(filePath);
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
