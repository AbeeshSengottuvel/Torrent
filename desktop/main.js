const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');

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

// Native Dialog Handlers
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Download Directory (SafePath Protected)',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('dialog:selectTorrentFile', async () => {
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

ipcMain.handle('app:openExternal', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

ipcMain.handle('app:openPath', async (_event, folderPath) => {
  if (folderPath && typeof folderPath === 'string') {
    const normalized = path.normalize(folderPath);
    if (fs.existsSync(normalized)) {
      shell.openPath(normalized);
      return true;
    }
  }
  return false;
});

ipcMain.handle('app:checkForUpdates', async () => {
  // In Task D0/D1: Updates follow the offline signed manifest design (docs/UPDATE-DESIGN.md)
  return {
    hasUpdate: false,
    status: 'up_to_date',
    currentVersion: CURRENT_VERSION,
  };
});

// Window Control Handlers (SR-03 safe)
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// SafePath .torrent file reader (check-then-allocate, max 10MB)
ipcMain.handle('file:readTorrent', async (_event, filePath) => {
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
    return {
      name: path.basename(normalized),
      path: normalized,
      size: stat.size,
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

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  appendBootLog('Secondary instance detected; quitting immediately.');
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    appendBootLog('Second instance triggered; restoring and focusing main window.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();

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
