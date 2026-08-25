const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../package.json");

const root = process.env.STICKY_APP_ROOT || path.resolve(__dirname, "..");
const artifactRoot = path.resolve(__dirname, "..", ".artifacts");
const artifactName = `formula-qa-v${packageJson.version}`;
const output = process.env.STICKY_QA_OUTPUT || path.join(artifactRoot, `${artifactName}.json`);
const screenshotPath = process.env.STICKY_QA_SCREENSHOT || path.join(artifactRoot, `${artifactName}.png`);
const formula = [
  String.raw`检验：$H_0: \beta_1 = 0; H_1: \beta_1 \neq 0$，且 $x \ne y$。`,
  "",
  String.raw`* 正态分布 ($N(\mu, \sigma^2)$):`,
  String.raw`  * 概率密度函数 (pdf): $f(x; \mu, \sigma^2) = \frac{1}{\sqrt{2\pi}\sigma}e^{-\frac{(x-\mu)^2}{2\sigma^2}}$`,
  String.raw`  * 标准化: 如果 $x \sim N(\mu, \sigma^2)$，则 $z = \frac{x-\mu}{\sigma} \sim N(0, 1)$`,
  String.raw`  * 样本均值: 如果 $x_1, \ldots, x_n$ 是独立标准正态变量，则 $z = \frac{\bar{x} - \mu}{\sigma/\sqrt{n}} \sim N(0, 1)$。`,
].join("\n");
const expectedAnnotations = [String.raw`H_0: \beta_1 = 0; H_1: \beta_1 \neq 0`, String.raw`x \ne y`];
const state = {
  notes: [{ id: "formula-check", title: "公式关系符检查", body: formula, color: "paper", createdAt: 1, updatedAt: 1 }],
  attachments: {},
  selectedId: "formula-check",
  settings: { alwaysOnTop: false, launchAtLogin: false, sidebarCollapsed: false, sidebarWidth: 294, opacity: 100, chineseFontFamily: "kaiti", englishFontFamily: "times", deleteWithBackspace: true, confirmBeforeDelete: true, exportFormat: "pdf", uiLanguage: "zh" },
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
app.setPath("userData", path.join(artifactRoot, `${artifactName}-userdata`));
ipcMain.handle("store:read", () => state);
ipcMain.handle("store:write", () => true);
ipcMain.handle("window:set-always-on-top", () => false);
ipcMain.handle("app:set-launch-at-login", () => false);
ipcMain.handle("window:is-maximized", () => false);
ipcMain.handle("window:toggle-maximize", () => false);
ipcMain.handle("clipboard:read-text", () => "");
ipcMain.handle("shell:open-external", () => true);
ipcMain.handle("export:file", () => ({ cancelled: true }));
ipcMain.handle("markdown:import-file", () => ({ body: "", attachments: {} }));

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1200,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(root, "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await window.loadFile(path.join(root, "dist", "index.html"));
    const result = await window.webContents.executeJavaScript(`(async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      let previewButton = null;
      for (let i = 0; i < 100 && !previewButton; i += 1) {
        previewButton = document.querySelector('.mode-switch button[title="预览"]');
        if (!previewButton) await delay(50);
      }
      if (!previewButton) throw new Error('Preview button did not mount');
      previewButton.click();

      let preview = null;
      for (let i = 0; i < 100 && !preview; i += 1) {
        preview = document.querySelector('.markdown-preview');
        if (!preview) await delay(50);
      }
      if (!preview) throw new Error('Preview did not mount');
      await document.fonts.ready;

      const formulas = [...preview.querySelectorAll('.katex')];
      const annotations = formulas.map((node) => node.querySelector('annotation')?.textContent || '');
      const mathRelations = [...preview.querySelectorAll('math mo')]
        .map((node) => node.textContent || '')
        .filter((text) => text === '≠');
      const overlayRelations = [...preview.querySelectorAll('.katex-html .mrel')]
        .filter((node) => (node.textContent || '') === '\\uE020=' && node.querySelector('.rlap'));
      const relations = overlayRelations.map((node) => {
        const slash = node.querySelector('.rlap .mrel');
        const equals = [...node.children].find((child) => (child.textContent || '') === '=');
        const slashRect = slash?.getBoundingClientRect();
        const equalsRect = equals?.getBoundingClientRect();
        return {
          slashFont: slash ? getComputedStyle(slash).fontFamily : '',
          slashLeft: slashRect?.left ?? null,
          equalsLeft: equalsRect?.left ?? null,
          horizontalDelta: slashRect && equalsRect ? slashRect.left - equalsRect.left : null,
        };
      });
      const formulaItems = [...preview.querySelectorAll('ul ul > li')].map((item) => {
        const itemRect = item.getBoundingClientRect();
        const formulaRects = [...item.querySelectorAll('.katex-html, .katex-html *')]
          .map((node) => node.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);
        return {
          itemTop: itemRect.top,
          itemBottom: itemRect.bottom,
          formulaTop: Math.min(...formulaRects.map((rect) => rect.top)),
          formulaBottom: Math.max(...formulaRects.map((rect) => rect.bottom)),
        };
      });
      const formulaItemGaps = formulaItems.slice(0, -1).map((item, index) => ({
        from: index + 1,
        to: index + 2,
        gap: formulaItems[index + 1].formulaTop - item.formulaBottom,
      }));

      return {
        mode: document.querySelector('.mode-switch [aria-selected="true"]')?.textContent || '',
        katexCount: formulas.length,
        annotations,
        mathRelations,
        relations,
        formulaItems,
        formulaItemGaps,
        katexMainLoaded: document.fonts.check('16px KaTeX_Main'),
      };
    })()`);

    const failures = [];
    if (result.mode !== "预览") failures.push(`unexpected mode: ${result.mode}`);
    if (result.katexCount !== 8) failures.push(`expected 8 formulas, received ${result.katexCount}`);
    if (JSON.stringify(result.annotations.slice(0, 2)) !== JSON.stringify(expectedAnnotations)) failures.push("LaTeX annotations changed");
    if (result.mathRelations.length !== 2) failures.push(`expected 2 accessible ≠ relations, received ${result.mathRelations.length}`);
    if (!result.katexMainLoaded) failures.push("KaTeX_Main font did not load");
    if (result.relations.length !== 2) failures.push(`expected 2 visual ≠ overlays, received ${result.relations.length}`);
    result.relations.forEach((relation, index) => {
      if (relation.horizontalDelta === null || Math.abs(relation.horizontalDelta) > 1) {
        failures.push(`relation ${index + 1} is not overlaid (delta ${relation.horizontalDelta})`);
      }
    });
    if (result.formulaItems.length !== 3) failures.push(`expected 3 nested formula items, received ${result.formulaItems.length}`);
    result.formulaItemGaps.forEach(({ from, to, gap }) => {
      if (gap < 6) failures.push(`formula items ${from} and ${to} are too close (${gap}px)`);
    });

    const screenshot = await window.capturePage();
    fs.writeFileSync(screenshotPath, screenshot.toPNG());
    fs.writeFileSync(output, JSON.stringify({ passed: failures.length === 0, failures, ...result, root, screenshotPath }, null, 2), "utf8");
    app.exit(failures.length === 0 ? 0 : 1);
  } catch (error) {
    fs.writeFileSync(output, JSON.stringify({ passed: false, error: error.stack || error.message, root }, null, 2), "utf8");
    app.exit(1);
  }
});
