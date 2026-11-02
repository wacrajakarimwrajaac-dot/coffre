// What the website may use from the desktop app. Nothing else of Node / Electron is exposed.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coffreDesktop', {
  isDesktop: true,
  /** Opens an https address in the person's own browser (Google sign-in, payment page). */
  openExternal: (url) => ipcRenderer.invoke('open-external', String(url)),
  /** Called with the coffre-desktop://auth-callback#... address when the browser sends the person back. */
  onAuthCallback: (callback) => {
    const handler = (_event, url) => callback(url);
    ipcRenderer.on('auth-callback', handler);
    ipcRenderer.send('auth-ready'); // delivers a callback that arrived before the page was ready
    return () => ipcRenderer.removeListener('auth-callback', handler);
  },
});
