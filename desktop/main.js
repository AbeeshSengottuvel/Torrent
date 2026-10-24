const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray } = require('electron');
const path = require('path');
const https = require('https');

const CURRENT_VERSION = '1.0.0';
const GITHUB_REPO = 'AbeeshSengottuvel/Torrent';
const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json`;
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

let mainWindow = null;
let tray = null;

function createWindow() {
  // Enforce SR-03: UI renderer has NO network access
  const { session } = require('electron');
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // Only allow local file URLs and devtools; block all external HTTP/HTTPS/WS from renderer
    if (details.url.startsWith('file://') || details.url.startsWith('devtools://')) {
      callback({ cancel: false });
    } else {
      console.warn(`[Security Guard SR-03] Denied renderer network access attempt to: ${details.url}`);
      callback({ cancel: true });
    }
  });

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
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Block any in-window navigation or external popups
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'web', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Check for GitHub updates on startup
  setTimeout(() => {
    checkForGitHubUpdates();
  }, 3000);
}

// Native Dialogs
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

// GitHub Auto-Update Checker (Section 22)
ipcMain.handle('app:checkForUpdates', async () => {
  return await checkForGitHubUpdates();
});

// Pinned Root Public Key for Ed25519 update verification (matches core/cairn-core/src/updater.rs)
const PINNED_ROOT_PUBKEY_HEX = '2b117a93483d02ae78d1a9b8ec224e61952a01cc3d76fe12a095516e3392741f';

function verifyEd25519Manifest(canonicalData, signatureHex, pubKeyHex) {
  try {
    const crypto = require('crypto');
    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiKey = Buffer.concat([spkiHeader, Buffer.from(pubKeyHex, 'hex')]);
    const publicKey = crypto.createPublicKey({ key: spkiKey, format: 'der', type: 'spki' });
    const signature = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, Buffer.from(canonicalData, 'utf8'), publicKey, signature);
  } catch (err) {
    console.error('[Security Guard SR-16] Manifest signature verification error:', err.message);
    return false;
  }
}

function checkForGitHubUpdates() {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'Haven-Torrent-Desktop-Client',
      },
    };

    https.get(VERSION_URL, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const remote = JSON.parse(data);

          // 1. Rollback protection (INV-09): target version must be strictly newer
          if (!isNewerVersion(remote.version, CURRENT_VERSION)) {
            resolve({ hasUpdate: false, reason: 'installed_version_current' });
            return;
          }

          // 2. Expiration check (freeze attack protection)
          const nowUnix = Math.floor(Date.now() / 1000);
          if (remote.expiresUnix && nowUnix >= remote.expiresUnix) {
            console.warn('[Security Guard SR-16] Rejected update: manifest expired');
            resolve({ hasUpdate: false, reason: 'manifest_expired' });
            return;
          }

          // 3. Ed25519 Signature verification (INV-09, SR-16)
          if (remote.signatureHex) {
            const canonicalData = `version=${remote.version}|timestamp=${remote.timestampUnix}|expires=${remote.expiresUnix}|sha256=${(remote.sha256 || '').toLowerCase()}|len=${remote.lengthBytes}`;
            const isValid = verifyEd25519Manifest(canonicalData, remote.signatureHex, PINNED_ROOT_PUBKEY_HEX);
            if (!isValid) {
              console.warn('[Security Guard SR-16] REJECTED update: invalid or forged Ed25519 signature!');
              resolve({ hasUpdate: false, reason: 'invalid_signature' });
              return;
            }
          }

          const updateInfo = {
            hasUpdate: true,
            currentVersion: CURRENT_VERSION,
            latestVersion: remote.version,
            releaseNotes: remote.releaseNotes || 'Security updates and performance improvements.',
            downloadUrl: remote.downloadUrl || `https://github.com/${GITHUB_REPO}/releases/latest`,
          };

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:available', updateInfo);
          }

          resolve(updateInfo);
        } catch (err) {
          resolve({ hasUpdate: false, error: err.message });
        }
      });
    }).on('error', (err) => {
      resolve({ hasUpdate: false, error: err.message });
    });
  });
}

function isNewerVersion(remote, current) {
  const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
  const r = parse(remote);
  const c = parse(current);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (c[i] || 0)) return true;
    if ((r[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

app.whenReady().then(() => {
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
