const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, Tray, globalShortcut, nativeImage, shell } = require("electron");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  importMarkdownFile: importMarkdownFileWithHtmlImages,
  repairStoredNotesLocalImages,
} = require("./markdown-import.cjs");

const APP_USER_MODEL_ID = "cn.fujian.desktopnotes";
const INSTALL_LANGUAGE_REGISTRY_KEY = "Software\\cn.fujian.desktopnotes";
const USER_DATA_DIRECTORY = "floating-notes";
const SUPPORTED_CHINESE_FONTS = new Set(["simsun", "kaiti", "fangsong", "simhei"]);
const SUPPORTED_ENGLISH_FONTS = new Set(["times", "segoe", "arial", "verdana"]);
let mainWindow;
let tray;
let isQuitting = false;
let currentLanguage = "zh";

// Keep the existing data directory when the public product name changes to ForeJot.
app.setPath("userData", path.join(app.getPath("appData"), USER_DATA_DIRECTORY));
if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function installerSelection() {
  if (process.platform !== "win32") return null;
  const selections = [];
  for (const hive of ["HKCU", "HKLM"]) {
    try {
      const output = execFileSync("reg.exe", ["query", `${hive}\\${INSTALL_LANGUAGE_REGISTRY_KEY}`, "/v", "InstallLanguage"], {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const match = output.match(/InstallLanguage\s+REG_SZ\s+(zh|en)\b/i);
      if (!match) continue;
      let generation = null;
      try {
        const generationOutput = execFileSync("reg.exe", ["query", `${hive}\\${INSTALL_LANGUAGE_REGISTRY_KEY}`, "/v", "InstallLanguageGeneration"], {
          encoding: "utf8",
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        });
        const generationMatch = generationOutput.match(/InstallLanguageGeneration\s+REG_DWORD\s+0x([0-9a-f]+)\b/i);
        if (generationMatch) generation = Number.parseInt(generationMatch[1], 16);
      } catch {
        // Installers before the generation marker still provide a usable language value.
      }
      selections.push({ language: match[1].toLowerCase(), generation });
    } catch {
      // The marker is absent until a user has completed an NSIS installation.
    }
  }
  return selections.sort((first, second) => (second.generation ?? -1) - (first.generation ?? -1))[0] ?? null;
}

function defaultLanguage(selection) {
  if (selection?.language) return selection.language;
  try {
    return /^zh(?:[-_]|$)/i.test(app.getLocale()) ? "zh" : "en";
  } catch {
    return "en";
  }
}

function normalizeChineseFont(value, fallback) {
  if (value === "system") return "kaiti";
  return SUPPORTED_CHINESE_FONTS.has(value) ? value : fallback;
}

function normalizeEnglishFont(value, fallback) {
  return SUPPORTED_ENGLISH_FONTS.has(value) ? value : fallback;
}

function createDefaultState() {
  const selection = installerSelection();
  const language = defaultLanguage(selection);
  return {
    notes: [],
    attachments: {},
    selectedId: null,
    settings: {
      alwaysOnTop: true,
      launchAtLogin: false,
      sidebarCollapsed: false,
      sidebarWidth: 294,
      opacity: 92,
      chineseFontFamily: "kaiti",
      englishFontFamily: "times",
      deleteWithBackspace: true,
      confirmBeforeDelete: true,
      exportFormat: "pdf",
      uiLanguage: language,
      uiLanguageSource: "installer",
      installerLanguage: language,
      installerLanguageGeneration: selection?.generation ?? null,
    },
  };
}

function isEnglish(language = currentLanguage) {
  return language === "en";
}

function nativeText(zh, en) {
  return isEnglish() ? en : zh;
}

function applicationName(language = currentLanguage) {
  return isEnglish(language) ? "ForeJot" : "驻笺";
}

function stateLanguage(state) {
  return state?.settings?.uiLanguage === "en" ? "en" : "zh";
}

function storePath() {
  return path.join(app.getPath("userData"), "notes.json");
}

function legacyStorePaths() {
  const appData = app.getPath("appData");
  return [
    path.join(appData, "浮笺", "notes.json"),
    path.join(appData, "floating-notes", "notes.json"),
  ];
}

function readState() {
  const defaultState = createDefaultState();
  try {
    const destination = storePath();
    const source = fs.existsSync(destination)
      ? destination
      : legacyStorePaths().find((candidate) => candidate !== destination && fs.existsSync(candidate));
    if (!source) return defaultState;
    const saved = JSON.parse(fs.readFileSync(source, "utf8"));
    const savedSettings = saved.settings && typeof saved.settings === "object" && !Array.isArray(saved.settings)
      ? saved.settings
      : {};
    const { fontFamily: legacyFontFamily, fontFamilySource: _legacyFontFamilySource, ...currentSettings } = savedSettings;
    const normalizedChineseFont = normalizeChineseFont(
      savedSettings.chineseFontFamily ?? legacyFontFamily,
      defaultState.settings.chineseFontFamily,
    );
    const normalizedEnglishFont = normalizeEnglishFont(
      savedSettings.englishFontFamily ?? legacyFontFamily,
      defaultState.settings.englishFontFamily,
    );
    const needsFontMigration = Object.hasOwn(savedSettings, "fontFamily")
      || Object.hasOwn(savedSettings, "fontFamilySource")
      || !SUPPORTED_CHINESE_FONTS.has(savedSettings.chineseFontFamily)
      || !SUPPORTED_ENGLISH_FONTS.has(savedSettings.englishFontFamily);
    const shouldApplyInstallerLanguage = savedSettings.installerLanguage !== defaultState.settings.installerLanguage
      || savedSettings.installerLanguageGeneration !== defaultState.settings.installerLanguageGeneration;
    const normalized = {
      ...defaultState,
      ...saved,
      notes: Array.isArray(saved.notes) ? saved.notes.map((note) => ({ ...note, color: "paper" })) : [],
      attachments: saved.attachments && typeof saved.attachments === "object" && !Array.isArray(saved.attachments)
        ? saved.attachments
        : {},
      settings: {
        ...defaultState.settings,
        ...currentSettings,
        ...(shouldApplyInstallerLanguage
          ? {
            uiLanguage: defaultState.settings.uiLanguage,
            uiLanguageSource: "installer",
            installerLanguage: defaultState.settings.installerLanguage,
            installerLanguageGeneration: defaultState.settings.installerLanguageGeneration,
            // The installer language determines both first-run defaults, even after a prior installation.
            chineseFontFamily: defaultState.settings.chineseFontFamily,
            englishFontFamily: defaultState.settings.englishFontFamily,
          }
          : {
            uiLanguageSource: savedSettings.uiLanguageSource === "user" ? "user" : "installer",
            installerLanguage: defaultState.settings.installerLanguage,
            installerLanguageGeneration: defaultState.settings.installerLanguageGeneration,
            chineseFontFamily: normalizedChineseFont,
            englishFontFamily: normalizedEnglishFont,
          }),
      },
    };
    const repaired = repairStoredNotesLocalImages(normalized);
    if (source !== destination || repaired.changed || shouldApplyInstallerLanguage || needsFontMigration) writeState(repaired.state);
    return repaired.state;
  } catch {
    return defaultState;
  }
}

function writeState(state) {
  const destination = storePath();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(state, null, 2), "utf8");
  return true;
}

function externalHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function openExternalUrl(value) {
  const url = externalHttpUrl(value);
  if (!url) return false;
  try {
    await shell.openExternal(url);
    return true;
  } catch {
    showNativeError("无法打开链接。", "The link could not be opened.");
    return false;
  }
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function requestNewNote() {
  showWindow();
  mainWindow?.webContents.send("notes:create-requested");
}

function refreshTray() {
  if (!tray) return;
  tray.setToolTip(applicationName());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: nativeText("显示驻笺", "Show ForeJot"), click: showWindow },
      { label: nativeText("新建便签", "New note"), accelerator: "Ctrl+Alt+N", click: requestNewNote },
      { type: "separator" },
      {
        label: nativeText("退出", "Quit"),
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function updateNativeLanguage(language) {
  currentLanguage = language === "en" ? "en" : "zh";
  mainWindow?.setTitle(applicationName());
  refreshTray();
}

function showNativeError(zhMessage, enMessage) {
  dialog.showErrorBox(
    nativeText("操作未完成", "Action could not be completed"),
    nativeText(zhMessage, enMessage),
  );
}

function appIcon(size) {
  const iconPath = path.join(__dirname, "icon.png");
  if (fs.existsSync(iconPath)) {
    const image = nativeImage.createFromBuffer(fs.readFileSync(iconPath));
    return size ? image.resize({ width: size, height: size }) : image;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 8c6-3 11-2 12 1v19c-3-3-8-4-12-1Z" fill="#fff6df" stroke="#263a31" stroke-width="2"/><path d="M28 8c-6-3-11-2-12 1v19c3-3 8-4 12-1Z" fill="#fff6df" stroke="#263a31" stroke-width="2"/><path d="m10 22 12-12 3 3-12 12-4 1Z" fill="#315947" stroke="#263a31" stroke-width="1.5" stroke-linejoin="round"/><path d="m22 10 2-2 3 3-2 2Z" fill="#e2ae4a"/></svg>`;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  return size ? image.resize({ width: size, height: size }) : image;
}

function sameWindowsPath(first, second) {
  if (!first || !second) return false;
  return path.resolve(first).toLocaleLowerCase("en-US") === path.resolve(second).toLocaleLowerCase("en-US");
}

function ensureDesktopShortcutIcon() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  const iconPath = path.join(process.resourcesPath, "desktop-icon.ico");
  const shortcutName = applicationName();
  const shortcutPath = path.join(app.getPath("desktop"), `${shortcutName}.lnk`);
  if (!fs.existsSync(shortcutPath) || !fs.existsSync(iconPath)) return;

  try {
    const details = shell.readShortcutLink(shortcutPath);
    if (!sameWindowsPath(details.target, process.execPath)) return;
    if (sameWindowsPath(details.icon, iconPath) && details.iconIndex === 0) return;
    shell.writeShortcutLink(shortcutPath, "update", {
      ...details,
      target: process.execPath,
      icon: iconPath,
      iconIndex: 0,
      appUserModelId: APP_USER_MODEL_ID,
    });
  } catch {
    // A missing or user-managed shortcut should not prevent the app from starting.
  }
}

function createTray() {
  tray = new Tray(appIcon(16));
  refreshTray();
  tray.on("double-click", showWindow);
}

function createWindow() {
  const state = readState();
  updateNativeLanguage(stateLanguage(state));
  mainWindow = new BrowserWindow({
    width: 980,
    height: 660,
    minWidth: 320,
    minHeight: 240,
    frame: false,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    icon: appIcon(),
    alwaysOnTop: state.settings?.alwaysOnTop !== false,
    title: applicationName(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(state.settings?.alwaysOnTop !== false, "screen-saver");
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("maximize", () => mainWindow?.webContents.send("window:maximize-changed", true));
  mainWindow.on("unmaximize", () => mainWindow?.webContents.send("window:maximize-changed", false));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url);
    return { action: "deny" };
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
  }
}

ipcMain.handle("store:read", () => readState());
ipcMain.handle("store:write", (_event, state) => {
  updateNativeLanguage(stateLanguage(state));
  return writeState(state);
});
ipcMain.handle("clipboard:read-text", () => clipboard.readText());
ipcMain.handle("markdown:import-file", async (_event, filePath) => {
  try {
    let imported = await importMarkdownFileWithHtmlImages(filePath);
    if (!imported.unresolvedLocalImages?.length) return imported;
    const location = await dialog.showOpenDialog(mainWindow, {
      title: nativeText("定位 Markdown 图片", "Locate Markdown images"),
      message: nativeText(
        `有 ${imported.unresolvedLocalImages.length} 张本地图片的原绝对路径已失效，请选择这些图片所在的文件夹。`,
        `${imported.unresolvedLocalImages.length} local image path(s) could not be found. Select their folder.`,
      ),
      buttonLabel: nativeText("选择图片文件夹", "Select image folder"),
      properties: ["openDirectory"],
    });
    if (location.canceled || !location.filePaths[0]) return imported;
    imported = await importMarkdownFileWithHtmlImages(filePath, { searchRoots: location.filePaths });
    return imported;
  } catch {
    showNativeError("无法导入该 Markdown 文件。", "This Markdown file could not be imported.");
    throw new Error(nativeText("无法导入该 Markdown 文件。", "This Markdown file could not be imported."));
  }
});
ipcMain.handle("shell:open-external", (_event, url) => openExternalUrl(url));
ipcMain.handle("app:set-ui-language", (_event, language) => {
  updateNativeLanguage(language);
  return currentLanguage;
});
ipcMain.handle("window:set-always-on-top", (_event, enabled) => {
  mainWindow?.setAlwaysOnTop(Boolean(enabled), "screen-saver");
  return mainWindow?.isAlwaysOnTop() ?? false;
});
ipcMain.handle("window:toggle-maximize", () => {
  if (!mainWindow) return false;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);
ipcMain.handle("export:file", async (_event, request = {}) => {
  try {
  const format = ["pdf", "word", "latex", "html", "markdown"].includes(request.format) ? request.format : "pdf";
  const extension = { pdf: "pdf", word: "doc", latex: "tex", html: "html", markdown: "md" }[format];
  const fallbackTitle = nativeText("驻笺便签", "ForeJot note");
  const title = String(request.title || fallbackTitle).replace(/[\\/:*?"<>|]+/g, "-").trim() || fallbackTitle;
  const defaultPath = path.join(app.getPath("documents"), `${title}.${extension}`);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: nativeText("导出驻笺便签", "Export ForeJot note"),
    defaultPath,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (result.canceled || !result.filePath) return { cancelled: true };
  const destination = result.filePath.toLowerCase().endsWith(`.${extension}`)
    ? result.filePath
    : `${result.filePath}.${extension}`;

  const writeAssets = () => {
    const assets = Array.isArray(request.assets) ? request.assets : [];
    for (const asset of assets) {
      const dataUrl = String(asset?.dataUrl || "");
      const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) continue;
      const fileName = path.basename(String(asset.fileName || "image.png"));
      fs.writeFileSync(path.join(path.dirname(destination), fileName), Buffer.from(match[1], "base64"));
    }
  };

  if (format === "pdf") {
    const printWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
    });
    try {
      await printWindow.loadURL("about:blank");
      await printWindow.webContents.executeJavaScript(`
        document.open();
        document.write(${JSON.stringify(String(request.html || ""))});
        document.close();
      `, true);
      await printWindow.webContents.executeJavaScript(`
        Promise.race([
          Promise.all([
            document.fonts?.ready ?? Promise.resolve(),
            ...Array.from(document.images).map((image) => image.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  image.addEventListener("load", resolve, { once: true });
                  image.addEventListener("error", resolve, { once: true });
                })),
          ]),
          new Promise((resolve) => setTimeout(resolve, 10000)),
        ]).then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      `, true);
      const pdf = await printWindow.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        margins: { top: 0.4, bottom: 0.4, left: 0.45, right: 0.45 },
      });
      fs.writeFileSync(destination, pdf);
    } finally {
      printWindow.destroy();
    }
  } else if (format === "markdown") {
    fs.writeFileSync(destination, String(request.markdown || ""), "utf8");
    writeAssets();
  } else if (format === "latex") {
    fs.writeFileSync(destination, String(request.latex || ""), "utf8");
    writeAssets();
  } else {
    fs.writeFileSync(destination, String(request.html || ""), "utf8");
  }
  return { cancelled: false, path: destination };
  } catch {
    showNativeError("无法导出该便签。", "This note could not be exported.");
    return { cancelled: false, error: nativeText("无法导出该便签。", "This note could not be exported.") };
  }
});
ipcMain.handle("app:set-launch-at-login", (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:hide", () => mainWindow?.hide());

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.whenReady().then(() => {
    ensureDesktopShortcutIcon();
    createWindow();
    createTray();
    globalShortcut.register("CommandOrControl+Alt+N", requestNewNote);
    app.on("activate", showWindow);
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});
