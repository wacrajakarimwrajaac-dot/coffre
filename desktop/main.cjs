// Coffre PC: the Coffre website in its own window, with the computer's local copy of the library inside the app.
// The website is served from the app itself (app://coffre/), nothing is hosted.
const { app, BrowserWindow, Menu, ipcMain, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

const SCHEME = 'app';
const AUTH_SCHEME = 'coffre-desktop';
const WEB_ROOT = path.join(__dirname, 'web-dist');

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

let win = null;
let pendingAuthUrl = null;

const isAuthUrl = (s) => typeof s === 'string' && s.startsWith(`${AUTH_SCHEME}://`);
const authUrlFrom = (argv) => argv.find(isAuthUrl) ?? null;

function deliverAuth(url) {
  if (!url) return;
  if (win && !win.isDestroyed() && !win.webContents.isLoading()) win.webContents.send('auth-callback', url);
  else pendingAuthUrl = url;
}

// One window only: opening the app again (or coming back from the browser sign-in) focuses it.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    deliverAuth(authUrlFrom(argv));
  });
  app.on('open-url', (event, url) => { // macOS
    event.preventDefault();
    deliverAuth(url);
  });

  app.whenReady().then(() => {
    if (process.defaultApp) app.setAsDefaultProtocolClient(AUTH_SCHEME, process.execPath, [path.resolve(process.argv[1] ?? '.')]);
    else app.setAsDefaultProtocolClient(AUTH_SCHEME);

    // app://coffre/<path> -> files of the built website (index.html for unknown paths).
    protocol.handle(SCHEME, (request) => {
      const { pathname } = new URL(request.url);
      let file = path.normalize(path.join(WEB_ROOT, decodeURIComponent(pathname)));
      if (!file.startsWith(WEB_ROOT)) return new Response('Forbidden', { status: 403 });
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_ROOT, 'index.html');
      return net.fetch(pathToFileURL(file).toString());
    });

    // Only the app's own pages may use the microphone (voice notes).
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(permission === 'media' && wc.getURL().startsWith(`${SCHEME}://`)));

    ipcMain.handle('open-external', (_event, url) => {
      if (typeof url === 'string' && /^https:\/\//i.test(url)) return shell.openExternal(url);
      throw new Error('Adresse refusée');
    });
    ipcMain.on('auth-ready', () => {
      if (pendingAuthUrl && win) {
        win.webContents.send('auth-callback', pendingAuthUrl);
        pendingAuthUrl = null;
      }
    });

    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      width: 1280, height: 820, minWidth: 420, minHeight: 560, title: 'Coffre', backgroundColor: '#0E0F13',
      icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    win.on('closed', () => { win = null; });
    // Links to other sites open in the person's browser, never inside the app.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//i.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`${SCHEME}://`)) {
        event.preventDefault();
        if (/^https:\/\//i.test(url)) void shell.openExternal(url);
      }
    });
    win.loadURL(`${SCHEME}://coffre/`);
    pendingAuthUrl = authUrlFrom(process.argv);
  });

  app.on('window-all-closed', () => app.quit());
}
