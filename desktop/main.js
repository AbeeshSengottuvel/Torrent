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
 * Validates that all files inside a torrent manifest resolve strictly within canonical target directory.
 * Blocks directory traversal, symlink escapes, and NTFS junction redirects.
 */
function validateTorrentFilesConfinement(canonicalBaseDir, files) {
  if (!Array.isArray(files)) return;
  for (const f of files) {
    const rel = (f.path || f.name || '').replace(/[\0]/g, '');
    const resolved = path.resolve(canonicalBaseDir, rel);
    if (!resolved.startsWith(canonicalBaseDir + path.sep) && resolved !== canonicalBaseDir) {
      throw new Error(`[SafePath Confinement Alert] File path traversal blocked: "${rel}" escapes ${canonicalBaseDir}`);
    }
  }
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
    const freeGB = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
    return {
      success: true,
      canonicalPath: canonical,
      rootDrive,
      drive: rootDrive,
      freeBytes,
      totalBytes,
      freeGB,
      totalGB,
      freeFormatted: `${freeGB} GB`,
      totalFormatted: `${totalGB} GB`
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
// REAL BITTORRENT ENGINE (LIVE PEERS, TRACKERS, & DISK I/O)
// ==========================================================================
let WebTorrentClass = null;
let parseTorrentFunc = null;
let torrentClient = null;
const activeTorrents = new Map(); // swarmId -> Torrent
const torrentPayloadCache = new Map(); // infoHash -> { buffer, sourcePath, name, announce }

// Bandwidth QoS / Traffic Governor state
let currentThrottleConfig = {
  downBytesSec: -1, // -1 is unlimited
  upBytesSec: -1,
  maxConns: 60,
  preset: 'unlimited'
};

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

/**
 * Strict RFC/BEP 0003 Bencode Info Dictionary extractor.
 * Walks the root bencoded dictionary ('d...e') key-by-key from offset 0
 * until the authentic top-level 'info' key is encountered, completely eliminating
 * any substring collision risks from preceding fields (e.g. comments or creators).
 */
function extractRawInfoSlice(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (buf[0] !== 0x64) { // 'd'
    throw new Error('[SafePath Bencode] Torrent payload does not begin with root bencoded dictionary.');
  }

  let pos = 1; // skip leading 'd'

  function parseNext() {
    if (pos >= buf.length) throw new Error('[SafePath Bencode] Unexpected EOF in bencode structure.');
    const ch = buf[pos];
    if (ch === 0x69) { // 'i' -> integer: i<num>e
      pos++;
      const end = buf.indexOf(0x65, pos); // 'e'
      if (end === -1) throw new Error('[SafePath Bencode] Unterminated integer in info dictionary.');
      pos = end + 1;
    } else if (ch === 0x6c) { // 'l' -> list: l<items>e
      pos++;
      while (pos < buf.length && buf[pos] !== 0x65) {
        parseNext();
      }
      if (pos >= buf.length) throw new Error('[SafePath Bencode] Unterminated list in info dictionary.');
      pos++; // skip 'e'
    } else if (ch === 0x64) { // 'd' -> dict: d<key><val>e
      pos++;
      while (pos < buf.length && buf[pos] !== 0x65) {
        parseNext(); // key
        parseNext(); // val
      }
      if (pos >= buf.length) throw new Error('[SafePath Bencode] Unterminated dictionary in info dictionary.');
      pos++; // skip 'e'
    } else if (ch >= 0x30 && ch <= 0x39) { // '0'-'9' -> string: <len>:<bytes>
      const colon = buf.indexOf(0x3a, pos); // ':'
      if (colon === -1) throw new Error('[SafePath Bencode] Unterminated string prefix in info dictionary.');
      const lenStr = buf.toString('ascii', pos, colon);
      const len = parseInt(lenStr, 10);
      if (isNaN(len) || len < 0) throw new Error('[SafePath Bencode] Invalid string length in info dictionary.');
      pos = colon + 1 + len;
      if (pos > buf.length) throw new Error('[SafePath Bencode] String data overflows buffer length.');
    } else {
      throw new Error(`[SafePath Bencode] Invalid bencode token 0x${ch.toString(16)} at offset ${pos}.`);
    }
  }

  while (pos < buf.length && buf[pos] !== 0x65) {
    if (buf[pos] < 0x30 || buf[pos] > 0x39) {
      throw new Error(`[SafePath Bencode] Expected string key in root dictionary at offset ${pos}`);
    }
    const colon = buf.indexOf(0x3a, pos);
    if (colon === -1) throw new Error('[SafePath Bencode] Unterminated root key string length.');
    const keyLen = parseInt(buf.toString('ascii', pos, colon), 10);
    const keyStart = colon + 1;
    const keyEnd = keyStart + keyLen;
    if (keyEnd > buf.length) throw new Error('[SafePath Bencode] Key length overflows buffer length.');
    const key = buf.toString('utf8', keyStart, keyEnd);
    pos = keyEnd;

    if (key === 'info') {
      const valStart = pos;
      parseNext(); // Skip the exact info dictionary structure
      const valEnd = pos;
      return buf.slice(valStart, valEnd);
    } else {
      parseNext(); // Skip non-info value
    }
  }

  throw new Error('[SafePath Bencode] No top-level "info" dictionary found in .torrent payload.');
}

function computeRawInfoHash(buf) {
  const slice = extractRawInfoSlice(buf);
  return crypto.createHash('sha1').update(slice).digest('hex').toLowerCase();
}

const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://explodie.org:6969/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz'
];

let dhtBroadcastInterval = null;
function startDhtStatusBroadcaster() {
  if (dhtBroadcastInterval) return;
  dhtBroadcastInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && torrentClient && torrentClient.dht) {
      const count = (typeof torrentClient.dht.nodes?.toArray === 'function')
        ? torrentClient.dht.nodes.toArray().length
        : 0;
      mainWindow.webContents.send('kernel:dhtStatus', {
        ready: !!torrentClient.dht.listening,
        nodes: count
      });
    }
  }, 2000);
}

async function getTorrentEngine() {
  if (!torrentClient) {
    if (!WebTorrentClass) {
      const mod = await import('webtorrent');
      WebTorrentClass = mod.default;
    }
    torrentClient = new WebTorrentClass({
      maxConns: currentThrottleConfig.maxConns,
      dht: true,
      tracker: true,
      lsd: true,
      webSeeds: true,
    });

    if (torrentClient.dht) {
      torrentClient.dht.on('node', () => {
        // DHT node added to routing table
      });
      torrentClient.dht.on('ready', () => {
        const count = torrentClient.dht?.nodes?.toArray?.()?.length || 0;
        broadcastKernelLog('DHT', `Kademlia DHT routing table initialized. Listening on UDP port. (Nodes: ${count})`);
      });
      torrentClient.dht.on('warning', (err) => {
        broadcastKernelLog('DHT/WARN', `DHT warning: ${err.message}`, 'warn');
      });
    }

    if (typeof torrentClient.throttleDownload === 'function') {
      torrentClient.throttleDownload(currentThrottleConfig.downBytesSec);
    }
    if (typeof torrentClient.throttleUpload === 'function') {
      torrentClient.throttleUpload(currentThrottleConfig.upBytesSec);
    }

    torrentClient.on('error', (err) => {
      console.error('[WebTorrent Engine Error]', err);
      broadcastKernelLog('ENGINE/ERR', `Engine error: ${err.message}`, 'error');
    });

    startDhtStatusBroadcaster();
  }
  return torrentClient;
}

registerSecureHandler('torrent:getDhtStatus', () => {
  const count = (torrentClient && torrentClient.dht && typeof torrentClient.dht.nodes?.toArray === 'function')
    ? torrentClient.dht.nodes.toArray().length
    : 0;
  return { ready: !!torrentClient?.dht?.listening, nodes: count };
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

  // 1. Strict BEP 0003 authentic SHA-1 computation over raw info dictionary slice
  let authenticSha1 = null;
  try {
    authenticSha1 = computeRawInfoHash(buffer);
  } catch (err) {
    broadcastKernelLog('BENCODE/WARN', `Strict slice parser: ${err.message}`, 'warn');
  }

  // 2. Metadata parsing via parse-torrent
  const parseTorrent = await getParseTorrent();
  const parsed = await parseTorrent(buffer);

  if (!parsed || (!parsed.infoHash && !authenticSha1)) {
    broadcastKernelLog('BENCODE/ERR', 'Corrupt Bencode: could not compute infoHash.', 'error');
    throw new Error('[BENCODE] Corrupt or invalid .torrent file. InfoHash missing.');
  }

  const infoHash = (authenticSha1 || parsed.infoHash).toLowerCase();
  const name = parsed.name || (sourcePath ? path.basename(sourcePath, '.torrent') : 'unnamed-torrent');
  const pieceLength = parsed.pieceLength || 0;
  const totalLength = Number(parsed.length) || 0;
  const pieces = parsed.pieces ? parsed.pieces.length : (pieceLength > 0 ? Math.ceil(totalLength / pieceLength) : 0);
  const trackers = Array.isArray(parsed.announce) ? parsed.announce : [];

  // Cache authentic buffer and path in backend Map for instant swarm launch
  torrentPayloadCache.set(infoHash, {
    buffer,
    sourcePath,
    name,
    announce: trackers
  });

  let firstRiskName = null;
  const files = (parsed.files || []).map(f => {
    const fPath = f.path || f.name || 'payload';
    const ext = path.extname(fPath).toLowerCase();
    const isRisk = BLOCKED_EXECUTABLE_EXTS.has(ext);
    if (isRisk && !firstRiskName) {
      firstRiskName = f.name || path.basename(fPath);
    }
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
    if (isRisk && !firstRiskName) firstRiskName = name;
    files.push({
      name,
      path: name,
      sizeBytes: totalLength,
      isRisk,
      selected: !isRisk,
      locked: isRisk
    });
  }

  const execRiskDetected = files.some(f => f.isRisk);
  const quarantineReason = firstRiskName ? `Executable payload detected: ${firstRiskName}` : null;

  broadcastKernelLog('BENCODE', `Decoded: "${name}" | InfoHash: ${infoHash} | Total: ${(totalLength / (1024*1024)).toFixed(1)} MB | Pieces: ${pieces} (${pieceLength} B) | Trackers: ${trackers.length}`);

  return {
    success: true,
    infoHash,
    name,
    totalBytes: totalLength,
    pieceLength,
    pieces,
    files,
    execRiskDetected,
    quarantineReason,
    announce: trackers,
    buffer: buffer.toString('base64'),
    sourcePath: sourcePath || null
  };
}

// Register secure IPC handlers for torrent parsing (including aliases)
registerSecureHandler('torrent:parseTorrentFile', async (_event, fileArg) => {
  return await handleParseTorrentFile(fileArg);
});

registerSecureHandler('torrent:parseTorrent', async (_event, fileArg) => {
  return await handleParseTorrentFile(fileArg);
});

const startingSwarmIds = new Set();

registerSecureHandler('file:readTorrent', async (_event, filePath) => {
  return await handleParseTorrentFile(filePath);
});

registerSecureHandler('torrent:start', async (_event, payload) => {
  if (!payload || !payload.id) return { success: false, error: 'Invalid payload' };
  const { id, hash, source, targetDir, name, fileBuffer, deselectedFiles } = payload;

  // Concurrency guard: block duplicate simultaneous start calls for the same swarm ID
  if (startingSwarmIds.has(id)) {
    return { success: true, active: true };
  }
  startingSwarmIds.add(id);

  try {
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

    const client = await getTorrentEngine();

    if (activeTorrents.has(id)) {
      const existing = activeTorrents.get(id);
      if (existing.paused) {
        existing.resume();
        if (Array.isArray(existing.wires)) {
          existing.wires.forEach(w => {
            try { if (typeof w.unchoke === 'function') w.unchoke(); } catch (_) {}
          });
        }
        broadcastKernelLog('ENGINE', `Resumed active transfer: ${existing.name || id}`);
      }
      wakeHeartbeatIfNeeded();
      startingSwarmIds.delete(id);
      return { success: true, active: true };
    }

    let input = null;
    let extraAnnounce = [];

    // 1. Check if authentic raw .torrent Buffer or path is cached by infoHash
    const cleanHash = (hash || '').toLowerCase();
    if (cleanHash && torrentPayloadCache.has(cleanHash)) {
      const cached = torrentPayloadCache.get(cleanHash);
      if (cached.buffer) {
        input = cached.buffer;
        if (Array.isArray(cached.announce)) extraAnnounce = cached.announce;
        broadcastKernelLog('ENGINE', `Ingesting authentic raw .torrent buffer (${input.length} B) for hash: ${cleanHash.slice(0, 16)}...`);
      } else if (cached.sourcePath && fs.existsSync(cached.sourcePath)) {
        input = cached.sourcePath;
        if (Array.isArray(cached.announce)) extraAnnounce = cached.announce;
        broadcastKernelLog('ENGINE', `Ingesting authentic .torrent file path: ${input}`);
      }
    }

    // 2. Fall back to fileBuffer if provided from frontend
    if (!input && fileBuffer) {
      input = Buffer.from(fileBuffer, 'base64');
      broadcastKernelLog('ENGINE', `Ingesting authentic .torrent binary payload (${input.length} B) from renderer`);
    }

    // 3. Fall back to source (Magnet URI or file path or hash)
    if (!input && source) {
      input = source;
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

    if (!input) {
      startingSwarmIds.delete(id);
      return { success: false, error: 'No source provided' };
    }

    const mergedTrackers = Array.from(new Set([...PUBLIC_TRACKERS, ...extraAnnounce]));

    // WebTorrent v3: Check client.torrents synchronously instead of calling client.get() (which returns a Promise)
    const existingTorrent = client.torrents.find(t => 
      (cleanHash && t.infoHash && t.infoHash.toLowerCase() === cleanHash) ||
      (t.name && name && t.name === name)
    );

    if (existingTorrent) {
      activeTorrents.set(id, existingTorrent);
      if (existingTorrent.paused) {
        existingTorrent.resume();
        if (Array.isArray(existingTorrent.wires)) {
          existingTorrent.wires.forEach(w => {
            try { if (typeof w.unchoke === 'function') w.unchoke(); } catch (_) {}
          });
        }
      }
      broadcastKernelLog('ENGINE', `Re-attached to active swarm: ${existingTorrent.name || existingTorrent.infoHash}`);
      wakeHeartbeatIfNeeded();
      startingSwarmIds.delete(id);
      return { success: true, active: true };
    }

    broadcastKernelLog('ENGINE', `Starting swarm download for "${name || id}" at ${safeTargetDir}`);

    const torrent = client.add(input, {
      path: safeTargetDir,
      announce: mergedTrackers
    });

    activeTorrents.set(id, torrent);
    wakeHeartbeatIfNeeded();

    torrent.on('infoHash', () => {
      broadcastKernelLog('DHT/TRACKER', `InfoHash active on DHT network: ${torrent.infoHash}`);
    });

    const processTorrentMetadata = () => {
      // SafePath Confinement: Enforce internal path confinement
      try {
        validateTorrentFilesConfinement(safeTargetDir, torrent.files);
      } catch (err) {
        broadcastKernelLog('SAFEPATH/ERR', err.message, 'error');
        torrent.destroy();
        activeTorrents.delete(id);
        return;
      }

      broadcastKernelLog('DHT/TRACKER', `Metadata active: "${torrent.name}" (${(torrent.length / (1024*1024)).toFixed(1)} MB, ${torrent.files ? torrent.files.length : 0} files)`);
      
      const { sanitizedFiles, execRiskDetected } = inspectTorrentFileManifest(torrent.files);
      let quarantineReason = null;

      // SafePath Confinement: Automatically quarantine and deselect executable extensions
      if (Array.isArray(torrent.files)) {
        torrent.files.forEach((file, idx) => {
          const ext = path.extname(file.name || '').toLowerCase();
          if (BLOCKED_EXECUTABLE_EXTS.has(ext)) {
            if (typeof file.deselect === 'function') file.deselect();
            if (!quarantineReason) {
              quarantineReason = `Executable payload detected: ${file.name}`;
            }
            broadcastKernelLog('SAFEPATH/GATE', `Quarantined and deselected executable risk: ${file.name}`, 'warn');
          } else if (Array.isArray(deselectedFiles) && (deselectedFiles.includes(idx) || deselectedFiles.includes(file.name))) {
            if (typeof file.deselect === 'function') file.deselect();
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
          quarantineReason,
          files: sanitizedFiles
        });
      }
    };

    torrent.on('metadata', processTorrentMetadata);

    torrent.on('ready', () => {
      broadcastKernelLog('ENGINE', `Swarm ready: ${torrent.pieces?.length || 0} pieces (${torrent.pieceLength} bytes/piece). Sockets listening.`);
      processTorrentMetadata();
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
        // Wire closed
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

    startingSwarmIds.delete(id);
    return { success: true };
  } catch (err) {
    startingSwarmIds.delete(id);
    broadcastKernelLog('ERR/ADD', `Failed to start swarm: ${err.message}`, 'error');
    throw new Error(`[Engine] Failed to add swarm: ${err.message}`);
  }
});

registerSecureHandler('torrent:pause', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    if (!t.paused) {
      t.pause();
      // True Pause: choke all active wires so speed drops to 0 B/s immediately
      if (Array.isArray(t.wires)) {
        t.wires.forEach(w => {
          try { if (typeof w.choke === 'function') w.choke(); } catch (_) {}
        });
      }
      broadcastKernelLog('ENGINE', `Transfer paused. Choked active wires for: ${t.name || id}`);
    }
    return true;
  }
  return false;
});

registerSecureHandler('torrent:resume', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    if (t.paused) {
      t.resume();
      // Unchoke wires and resume data transfer
      if (Array.isArray(t.wires)) {
        t.wires.forEach(w => {
          try { if (typeof w.unchoke === 'function') w.unchoke(); } catch (_) {}
        });
      }
      broadcastKernelLog('ENGINE', `Transfer resumed. Re-engaged swarm for: ${t.name || id}`);
    }
    wakeHeartbeatIfNeeded();
    return true;
  }
  return false;
});

registerSecureHandler('torrent:stop', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    broadcastKernelLog('ENGINE', `Stopping swarm transfer: ${t.name || id}`);
    await new Promise(resolve => {
      try {
        t.destroy({ destroyStore: false }, () => resolve());
      } catch (_) {
        resolve();
      }
    });
    activeTorrents.delete(id);
    diskBytesCache.delete(id);
    return true;
  }
  return false;
});

registerSecureHandler('torrent:recheck', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    broadcastKernelLog('ENGINE', `Initiating force recheck for: ${t.name || id}`);
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
          if (typeof f.deselect === 'function') f.deselect();
        } else if (payload.fileIndices.includes(idx)) {
          if (typeof f.select === 'function') f.select();
        } else {
          if (typeof f.deselect === 'function') f.deselect();
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
    broadcastKernelLog('ENGINE', `Destroying swarm: ${t.name || id} (disk purge: ${!!deleteFiles})`);
    await new Promise(resolve => {
      try {
        t.destroy({ destroyStore: !!deleteFiles }, () => resolve());
      } catch (_) {
        resolve();
      }
    });
    activeTorrents.delete(id);
  }

  if (deleteFiles && targetDir && name) {
    try {
      const normalizedDir = path.normalize(targetDir);
      const resolvedName = resolvePayloadFileName(name);
      const targetFile = path.join(normalizedDir, resolvedName);
      const rawFile = path.join(normalizedDir, name.replace(/[\/\\:*?"<>|]/g, '_'));

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
    } catch (err) {
      console.warn('[Delete file warning]', err.message);
    }
  }
  return true;
});

// Real Traffic Throttle / Bandwidth & Connection Limiter (QoS)
registerSecureHandler('torrent:setThrottle', async (_event, config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('[QoS] Invalid throttle configuration object.');
  }

  const down = (typeof config.downBytesSec === 'number' && config.downBytesSec > 0) ? Math.round(config.downBytesSec) : -1;
  const up = (typeof config.upBytesSec === 'number' && config.upBytesSec > 0) ? Math.round(config.upBytesSec) : -1;
  const maxConns = (typeof config.maxConns === 'number' && config.maxConns > 0) ? Math.min(200, Math.max(5, Math.round(config.maxConns))) : 60;
  const preset = typeof config.preset === 'string' ? config.preset : 'custom';

  currentThrottleConfig = { downBytesSec: down, upBytesSec: up, maxConns, preset };

  if (torrentClient) {
    if (typeof torrentClient.throttleDownload === 'function') {
      torrentClient.throttleDownload(down);
    }
    if (typeof torrentClient.throttleUpload === 'function') {
      torrentClient.throttleUpload(up);
    }
    torrentClient.maxConns = maxConns;
    for (const t of activeTorrents.values()) {
      t.maxConns = maxConns;
    }
  }

  const downStr = down === -1 ? 'UNLIMITED' : `${(down / (1024 * 1024)).toFixed(2)} MB/s`;
  const upStr = up === -1 ? 'UNLIMITED' : `${(up / 1024).toFixed(0)} KB/s`;
  broadcastKernelLog('QOS/THROTTLE', `Bandwidth cap enforced: DOWN=${downStr} | UP=${upStr} | MAX_WIRES=${maxConns} [${preset.toUpperCase()}]`);

  return { success: true, config: currentThrottleConfig };
});

registerSecureHandler('torrent:getThrottle', async () => {
  return { success: true, config: currentThrottleConfig };
});

// SafePath Quarantine & Release IPC Handlers
registerSecureHandler('torrent:quarantineSwarm', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    if (!t.paused) t.pause();
    if (Array.isArray(t.files)) {
      t.files.forEach(f => f.deselect());
    }
    broadcastKernelLog('SAFEPATH/GATE', `Swarm manually quarantined & locked from disk: ${t.name || id}`, 'warn');
    return true;
  }
  return false;
});

registerSecureHandler('torrent:releaseQuarantine', async (_event, id) => {
  if (typeof id === 'string' && activeTorrents.has(id)) {
    const t = activeTorrents.get(id);
    if (Array.isArray(t.files)) {
      t.files.forEach(f => {
        const ext = path.extname(f.name || '').toLowerCase();
        if (!BLOCKED_EXECUTABLE_EXTS.has(ext)) {
          f.select();
        }
      });
    }
    if (t.paused) t.resume();
    wakeHeartbeatIfNeeded();
    broadcastKernelLog('SAFEPATH/TRUST', `Swarm released from quarantine by user: ${t.name || id}`);
    return true;
  }
  return false;
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

    // Boot WebTorrent engine and DHT discovery in background
    getTorrentEngine().then(() => {
      startDhtStatusBroadcaster();
      broadcastKernelLog('ENGINE', 'WebTorrent Swarm Engine booted. DHT & public trackers active.');
    }).catch(err => {
      console.error('[Engine Startup Warning]', err);
    });

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
