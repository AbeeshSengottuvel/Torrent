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

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 880,
    minHeight: 580,
    backgroundColor: '#0b0f19',
    title: 'Haven - Secure BitTorrent Client',
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

  // 5. Load UI exclusively via custom haven:// protocol
  mainWindow.loadURL('haven://app/index.html');

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
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

ipcMain.handle('app:checkForUpdates', async () => {
  // In Task D0/D1: Updates follow the offline signed manifest design (docs/UPDATE-DESIGN.md)
  return {
    hasUpdate: false,
    status: 'up_to_date',
    currentVersion: CURRENT_VERSION,
  };
});

app.whenReady().then(() => {
  setupCustomProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
