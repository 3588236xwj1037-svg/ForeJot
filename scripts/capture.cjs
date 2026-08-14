const { app, BrowserWindow, session } = require("electron");
const fs = require("node:fs");

const output = process.argv[2];
const width = Number(process.argv[3]) || 980;
const height = Number(process.argv[4]) || 660;
const mode = process.argv[5] || "default";

if (!output) {
  throw new Error("Usage: electron scripts/capture.cjs <output.png>");
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData({
    origin: "http://127.0.0.1:5173",
    storages: ["localstorage"],
  });
  const window = new BrowserWindow({
    width,
    height,
    show: true,
    transparent: false,
    backgroundColor: "#a8aaa6",
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await window.loadURL("http://127.0.0.1:5173");
  await new Promise((resolve) => setTimeout(resolve, 500));
  let actionApplied = true;
  if (mode === "settings") {
    actionApplied = await window.webContents.executeJavaScript('(() => { const target = document.querySelector(".settings-trigger"); if (!target) return false; target.click(); return true; })()');
  }
  if (mode === "delete-confirm") {
    actionApplied = await window.webContents.executeJavaScript('(() => { const target = document.querySelector(".note-row"); if (!target) return false; target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); return true; })()');
  }
  if (mode === "image-short") {
    actionApplied = await window.webContents.executeJavaScript(`(async () => {
      const input = document.querySelector('input[aria-label="插入图片文件"]');
      if (!input) return false;
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (value) => value.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], '示例图片.png', { type: 'image/png' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 200));
      return document.querySelector('textarea[aria-label="便签内容"]')?.value.includes('note-asset:') ?? false;
    })()`);
  }
  if (mode === "drag-reorder") {
    actionApplied = await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('.primary-icon')?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      let rows = Array.from(document.querySelectorAll('.note-row'));
      if (rows.length < 2) return false;
      const sourceId = rows[0].dataset.noteId;
      const targetId = rows[1].dataset.noteId;
      const transfer = new DataTransfer();
      rows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const target = document.querySelector('[data-note-id="' + targetId + '"]');
      const bounds = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: bounds.bottom - 1, dataTransfer: transfer }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      document.querySelector('[data-note-id="' + targetId + '"]').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: bounds.bottom - 1, dataTransfer: transfer }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      rows = Array.from(document.querySelectorAll('.note-row'));
      return rows[0]?.dataset.noteId === targetId && rows[1]?.dataset.noteId === sourceId;
    })()`);
  }
  if (mode === "collapsed") {
    actionApplied = await window.webContents.executeJavaScript('(() => { const target = document.querySelector("button[aria-label=\\"折叠便签目录\\"]"); if (!target) return false; target.click(); return true; })()');
  }
  if (mode === "resized") {
    actionApplied = await window.webContents.executeJavaScript('(() => { const target = document.querySelector("[role=separator]"); if (!target) return false; target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); return true; })()');
  }
  if (mode === "minimum") {
    actionApplied = await window.webContents.executeJavaScript('(async () => { const target = document.querySelector("[role=separator]"); if (!target) return false; for (let index = 0; index < 6; index += 1) { target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); } return true; })()');
  }
  if (mode === "preview") {
    actionApplied = await window.webContents.executeJavaScript('(() => { const target = document.querySelector("textarea[aria-label=\\"便签内容\\"]"); if (!target) return false; const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; setter.call(target, "# Markdown 便签 {center}\\n\\n（8）**完整句子的粗体。**后续内容\\n\\n“*完整句子的斜体！*”后续内容\\n\\n| 姓名 | 分数 |\\n| --- | --- |\\n| 张三 | 90 |\\n\\n$$E = mc^2$$"); target.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
    await new Promise((resolve) => setTimeout(resolve, 100));
    await window.webContents.executeJavaScript('document.querySelector("button[title=\\"预览\\"]")?.click()');
  }
  if (mode === "find") {
    actionApplied = await window.webContents.executeJavaScript(`(async () => {
      const textarea = document.querySelector('textarea[aria-label="便签内容"]');
      if (!textarea) return false;
      const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      textareaSetter.call(textarea, '目标 A 目标 B 目标 C');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const input = document.querySelector('input[aria-label="查找内容"]');
      if (!input) return false;
      const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      inputSetter.call(input, '目标');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.find-mode-button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return Boolean(document.querySelector('.find-panel.is-replacing'));
    })()`);
  }
  if (mode === "english-settings") {
    actionApplied = await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('.settings-trigger')?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const select = document.querySelector('select[aria-label="页面语言"]');
      if (!select) return false;
      select.value = 'en';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      return Boolean(document.querySelector('select[aria-label="Interface language"]'));
    })()`);
  }
  if (mode === "english") {
    actionApplied = await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('.settings-trigger')?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const languageSelect = document.querySelector('select[aria-label="页面语言"]');
      if (!languageSelect) return false;
      languageSelect.value = 'en';
      languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      document.querySelector('.settings-trigger')?.click();
      const title = document.querySelector('.title-input');
      const body = document.querySelector('textarea[aria-label="Note content"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      if (title && setter) {
        setter.call(title, 'Project notes');
        title.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      if (body && textareaSetter) {
        textareaSetter.call(body, '## Today\\'s focus\\n\\n- Keep this note visible\\n- Review the release checklist\\n- Export a copy when finished');
        body.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      return Boolean(document.querySelector('textarea[aria-label="Note content"]'));
    })()`);
  }
  let scrollTest = null;
  if (mode === "font-scroll") {
    scrollTest = await window.webContents.executeJavaScript(`(async () => {
      const textarea = document.querySelector('textarea[aria-label="便签内容"]');
      const sizeSelect = document.querySelector('select[aria-label="选中文字的字号"]');
      if (!textarea || !sizeSelect) return null;
      const content = Array.from({ length: 100 }, (_, index) => '第 ' + (index + 1) + ' 行正文').join('\\n');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, content);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const target = textarea.value.indexOf('第 45 行正文');
      textarea.setSelectionRange(target, target + '第 45 行正文'.length);
      textarea.scrollTop = 720;
      textarea.scrollLeft = 9;
      const before = { top: textarea.scrollTop, left: textarea.scrollLeft };
      sizeSelect.value = 'small2';
      sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        before,
        after: { top: textarea.scrollTop, left: textarea.scrollLeft },
        bodyContainsStyle: textarea.value.includes('<span style="font-size:24px">第 45 行正文</span>'),
      };
    })()`);
    actionApplied = Boolean(scrollTest?.bodyContainsStyle);
  }
  if (mode === "inline-font" || mode === "inline-font-edit") {
    actionApplied = await window.webContents.executeJavaScript(`(async () => {
      const textarea = document.querySelector('textarea[aria-label="便签内容"]');
      const fontSelect = document.querySelector('select[aria-label="选中文字的字体"]');
      if (!textarea || !fontSelect) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, '仿宋文字 普通文字');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      textarea.setSelectionRange(0, 4);
      fontSelect.value = 'fangsong';
      fontSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (${JSON.stringify(mode)} === 'inline-font') {
        document.querySelector('button[title="预览"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return true;
    })()`);
  }
  window.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 700));
  const diagnostics = await window.webContents.executeJavaScript(`(() => {
    const workspace = document.querySelector(".workspace");
    const sidebar = document.querySelector(".sidebar");
    const editor = document.querySelector(".editor-panel");
    const resizer = document.querySelector(".sidebar-resizer");
    const resizerAfter = resizer ? getComputedStyle(resizer, "::after") : null;
    const strong = document.querySelector(".markdown-preview strong");
    const emphasis = document.querySelector(".markdown-preview em");
    const inlineFont = document.querySelector('.markdown-preview font[face]');
    const attachmentImage = document.querySelector('.export-source img');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect();
    const resizerRect = resizer?.getBoundingClientRect();
    const expand = document.querySelector('button[aria-label="展开便签目录"]');
    return {
      workspaceClass: workspace?.className,
      gridColumns: workspace ? getComputedStyle(workspace).gridTemplateColumns : null,
      sidebarWidth: sidebarRect?.width,
      sidebarLeft: sidebarRect?.left,
      sidebarRight: sidebarRect?.right,
      editorLeft: editorRect?.left,
      boundaryDelta: sidebarRect && editorRect ? editorRect.left - sidebarRect.right : null,
      resizerLineCenter: resizerRect && resizerAfter ? resizerRect.left + parseFloat(resizerAfter.left) + parseFloat(resizerAfter.width) / 2 : null,
      resizerBoundaryDelta: resizerRect && resizerAfter && sidebarRect ? resizerRect.left + parseFloat(resizerAfter.left) + parseFloat(resizerAfter.width) / 2 - sidebarRect.right : null,
      resizerLineColor: resizerAfter?.backgroundColor,
      sidebarPosition: sidebar ? getComputedStyle(sidebar).position : null,
      sidebarBackground: sidebar ? getComputedStyle(sidebar).backgroundColor : null,
      editorBackground: editor ? getComputedStyle(editor).backgroundColor : null,
      expandVisible: Boolean(expand && expand.getBoundingClientRect().width),
      settingsExpanded: document.querySelector(".settings-trigger")?.getAttribute("aria-expanded"),
      popoverVisible: Boolean(document.querySelector(".settings-popover")),
      separatorWidth: document.querySelector("[role=separator]")?.getAttribute("aria-valuenow"),
      previewVisible: Boolean(document.querySelector(".markdown-preview")),
      previewStrongWeight: strong ? getComputedStyle(strong).fontWeight : null,
      previewEmphasisStyle: emphasis ? getComputedStyle(emphasis).fontStyle : null,
      previewInlineFont: inlineFont ? getComputedStyle(inlineFont).fontFamily : null,
      shortImageToken: document.querySelector('textarea[aria-label="便签内容"]')?.value.includes('note-asset:')
        ? document.querySelector('textarea[aria-label="便签内容"]').value
        : null,
      resolvedAttachmentSource: attachmentImage?.getAttribute('src')?.startsWith('data:image/') ?? false,
      deleteConfirmationCheckbox: Boolean(document.querySelector('.delete-confirm-option input[type="checkbox"]')),
      draggableNoteCount: document.querySelectorAll('.note-row[draggable="true"]').length,
      noteOrder: Array.from(document.querySelectorAll('.note-row')).map((row) => row.dataset.noteId),
      scrollTest: ${JSON.stringify(scrollTest)},
      windowControlCount: document.querySelectorAll(".title-action.icon-only").length,
    };
  })()`);
  console.log(JSON.stringify({ mode, actionApplied, width, height, diagnostics }));
  const image = await window.webContents.capturePage();
  fs.writeFileSync(output, image.toPNG());
  app.quit();
});
