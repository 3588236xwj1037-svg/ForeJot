const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  loadState: () => ipcRenderer.invoke("store:read"),
  saveState: (state) => ipcRenderer.invoke("store:write", state),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:set-always-on-top", enabled),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke("app:set-launch-at-login", enabled),
  minimize: () => ipcRenderer.send("window:minimize"),
  hide: () => ipcRenderer.send("window:hide"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  setUiLanguage: (language) => ipcRenderer.invoke("app:set-ui-language", language),
  onMaximizeChange: (callback) => {
    const listener = (_event, maximized) => callback(Boolean(maximized));
    ipcRenderer.on("window:maximize-changed", listener);
    return () => ipcRenderer.removeListener("window:maximize-changed", listener);
  },
  exportFile: (request) => ipcRenderer.invoke("export:file", request),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  readClipboardText: () => ipcRenderer.invoke("clipboard:read-text"),
  importMarkdownFile: (file) => ipcRenderer.invoke("markdown:import-file", webUtils.getPathForFile(file)),
  onCreateNote: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("notes:create-requested", listener);
    return () => ipcRenderer.removeListener("notes:create-requested", listener);
  },
});
