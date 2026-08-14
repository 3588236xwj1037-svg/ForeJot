import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AppState, DesktopApi } from "./types";

const savedState = {
  notes: [
    {
      id: "note-1",
      title: "今天要做的事",
      body: "整理会议记录",
      color: "yellow",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  selectedId: "note-1",
  settings: {
    alwaysOnTop: true,
    launchAtLogin: false,
    sidebarCollapsed: false,
    sidebarWidth: 294,
    opacity: 92,
    fontFamily: "kaiti",
    fontFamilySource: "installer",
  },
} as unknown as AppState;

function desktopMock(): DesktopApi {
  return {
    loadState: vi.fn().mockResolvedValue(savedState),
    saveState: vi.fn().mockResolvedValue(true),
    setAlwaysOnTop: vi.fn().mockResolvedValue(false),
    setLaunchAtLogin: vi.fn().mockResolvedValue(false),
    minimize: vi.fn(),
    hide: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    toggleMaximize: vi.fn().mockResolvedValue(false),
    setUiLanguage: vi.fn().mockResolvedValue("zh"),
    onMaximizeChange: vi.fn().mockReturnValue(() => undefined),
    exportFile: vi.fn().mockResolvedValue({ cancelled: false, path: "C:/export.pdf" }),
    openExternal: vi.fn().mockResolvedValue(true),
    readClipboardText: vi.fn().mockResolvedValue(""),
    onCreateNote: vi.fn().mockReturnValue(() => undefined),
  };
}

describe("App", () => {
  beforeEach(() => {
    Object.defineProperty(window, "desktop", { configurable: true, writable: true, value: desktopMock() });
  });

  it("loads a saved note and persists edits", async () => {
    render(<App />);

    const title = await screen.findByDisplayValue("今天要做的事");
    fireEvent.change(title, { target: { value: "本周安排" } });

    await waitFor(() => expect(window.desktop?.saveState).toHaveBeenCalled(), { timeout: 1000 });
    const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
    expect(latest?.notes[0].title).toBe("本周安排");
  });

  it("turns off the system always-on-top state", async () => {
    render(<App />);

    const pinButton = await screen.findByRole("button", { name: /已置顶/ });
    fireEvent.click(pinButton);

    await waitFor(() => expect(window.desktop?.setAlwaysOnTop).toHaveBeenCalledWith(false));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "置顶" })).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("requires confirmation before deleting a note", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "删除便签" }));
    expect(screen.getByRole("dialog", { name: "删除这张便签？" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(await screen.findByText("新建一张便签")).toBeInTheDocument();
  });

  it("collapses and expands the notes directory", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "折叠便签目录" }));
    const expandButton = screen.getByRole("button", { name: "展开便签目录" });
    expect(expandButton).toBeInTheDocument();
    expect(expandButton.parentElement).toHaveClass("window-drag-region");
    fireEvent.click(expandButton);
    expect(screen.getByRole("button", { name: "折叠便签目录" })).toBeInTheDocument();
  });

  it("resizes the notes directory and persists its width", async () => {
    render(<App />);

    const separator = await screen.findByRole("separator", { name: "调整便签目录宽度" });
    fireEvent.keyDown(separator, { key: "ArrowRight" });

    expect(separator).toHaveAttribute("aria-valuenow", "306");
    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(latest?.settings.sidebarWidth).toBe(306);
    });
  });

  it("migrates legacy note colors to paper white", async () => {
    render(<App />);

    await screen.findByDisplayValue("今天要做的事");
    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(latest?.notes[0].color).toBe("paper");
    });
    expect(screen.queryByLabelText("便签颜色")).not.toBeInTheDocument();
  });

  it("inserts code and formula blocks with Typora-style shortcuts", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.keyDown(editor, { key: "K", ctrlKey: true, shiftKey: true });
    expect((editor as HTMLTextAreaElement).value).toContain("```\n在这里输入代码\n```");

    (editor as HTMLTextAreaElement).setSelectionRange(
      (editor as HTMLTextAreaElement).value.length,
      (editor as HTMLTextAreaElement).value.length,
    );
    fireEvent.keyDown(editor, { key: "M", ctrlKey: true, shiftKey: true });
    expect((editor as HTMLTextAreaElement).value).toContain("$$\nE = mc^2\n$$");
  });

  it("applies heading levels with Ctrl+0 through Ctrl+5", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "章节标题" } });
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: "2", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("## 章节标题"));

    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: "0", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("章节标题"));
  });

  it("toggles bold, italic, and underline Markdown marks", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "我爱你" } });

    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: "b", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("**我爱你**"));
    editor.setSelectionRange(2, editor.value.length - 2);
    fireEvent.keyDown(editor, { key: "b", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("我爱你"));

    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: "i", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("*我爱你*"));
    editor.setSelectionRange(1, editor.value.length - 1);
    fireEvent.keyDown(editor, { key: "i", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("我爱你"));

    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: "u", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("<u>我爱你</u>"));
    editor.setSelectionRange(3, editor.value.length - 4);
    fireEvent.keyDown(editor, { key: "u", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("我爱你"));
  });

  it("renders Markdown and math in preview mode", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, { target: { value: "# 今日重点\n\n**完成文档**\n\n$$E = mc^2$$" } });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));

    expect(screen.getByRole("heading", { name: "今日重点" })).toBeInTheDocument();
    const preview = screen.getByLabelText("Markdown 预览");
    const bold = within(preview).getByText("完成文档");
    expect(bold.tagName).toBe("STRONG");
    expect(preview.querySelector(".katex")).toBeInTheDocument();
  });

  it("keeps inline fractions compact without changing display or explicit text fractions", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, {
      target: {
        value: "行内 $J=\\frac{1}{2m}e^Te$。\n\n$$J=\\frac{1}{2m}$$\n\n保留 $\\tfrac{1}{2}$。",
      },
    });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));

    const annotations = [...screen.getByLabelText("Markdown 预览").querySelectorAll('annotation[encoding="application/x-tex"]')]
      .map((annotation) => annotation.textContent);
    expect(annotations).toEqual([
      "J=\\frac{1}{2m}e^Te",
      "J=\\frac{1}{2m}",
      "\\tfrac{1}{2}",
    ]);
  });

  it("preserves not-equal commands as accessible math relations", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, {
      target: { value: "检验 $H_1: \\beta_1 \\neq 0$，以及 $x \\ne y$。" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));

    const preview = screen.getByLabelText("Markdown 预览");
    const annotations = [...preview.querySelectorAll('annotation[encoding="application/x-tex"]')]
      .map((annotation) => annotation.textContent);
    const mathRelations = [...preview.querySelectorAll("math mo")]
      .map((relation) => relation.textContent)
      .filter((relation) => relation === "≠");

    expect(annotations).toEqual(["H_1: \\beta_1 \\neq 0", "x \\ne y"]);
    expect(mathRelations).toEqual(["≠", "≠"]);
    expect(preview.querySelectorAll(".katex-html .rlap")).toHaveLength(2);
  });

  it("renders underline HTML in Markdown preview", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, { target: { value: "<u>源文本</u>" } });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));

    expect(await within(screen.getByLabelText("Markdown 预览")).findByText("源文本")).toHaveProperty("tagName", "U");
  });

  it("normalizes the two asymmetric italic spellings in preview", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, { target: { value: "**左二右一*\n\n*左一右二**" } });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));

    const preview = screen.getByLabelText("Markdown 预览");
    expect(within(preview).getByText("左二右一").tagName).toBe("EM");
    expect(within(preview).getByText("左一右二").tagName).toBe("EM");
  });

  it("stores an inserted image as a short Markdown attachment reference", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    const image = new File([new Uint8Array([137, 80, 78, 71])], "记录.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("插入图片文件"), { target: { files: [image] } });

    await waitFor(() => expect((editor as HTMLTextAreaElement).value).toMatch(/!\[记录\]\(note-asset:[a-z0-9-]+\)/));
    expect((editor as HTMLTextAreaElement).value.length).toBeLessThan(100);
    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(Object.values(latest?.attachments ?? {})).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "记录", dataUrl: expect.stringContaining("data:image/png;base64,") }),
      ]));
    });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    expect(await screen.findByRole("img", { name: "记录" })).toHaveAttribute("src", expect.stringContaining("data:image/png;base64,"));
  });

  it("migrates legacy embedded image data to a short attachment reference", async () => {
    const dataUrl = `data:image/png;base64,${"A".repeat(50000)}`;
    vi.mocked(window.desktop!.loadState).mockResolvedValue({
      ...savedState,
      notes: [{ ...savedState.notes[0], body: `![旧图片](${dataUrl})` }],
    } as AppState);

    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    expect(editor.value).toMatch(/^!\[旧图片\]\(note-asset:[a-z0-9-]+\)$/);
    expect(editor.value.length).toBeLessThan(100);
    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(Object.values(latest?.attachments ?? {})[0]?.dataUrl).toBe(dataUrl);
    });
  });

  it("toggles between maximize and restore controls", async () => {
    window.desktop = desktopMock();
    vi.mocked(window.desktop.toggleMaximize).mockResolvedValueOnce(true);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "最大化" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "向下还原" })).toBeInTheDocument());
    expect(window.desktop.toggleMaximize).toHaveBeenCalledOnce();
  });

  it("persists font and background opacity preferences", async () => {
    render(<App />);

    const shell = document.querySelector(".app-shell") as HTMLElement;
    await screen.findByDisplayValue("今天要做的事");
    expect(shell.style.getPropertyValue("--app-font")).toContain("KaiTi");
    expect(shell.style.getPropertyValue("--content-font")).toBe('KaiTi, "楷体", serif');

    fireEvent.click(await screen.findByRole("button", { name: /偏好设置/ }));
    const fontPreference = screen.getByRole("combobox", { name: "字体" });
    expect(within(fontPreference).queryByRole("option", { name: "系统默认（楷体）" })).not.toBeInTheDocument();
    expect(within(fontPreference).getByRole("option", { name: "楷体" })).toBeInTheDocument();
    expect(within(fontPreference).getByRole("option", { name: "仿宋" })).toBeInTheDocument();
    expect(within(fontPreference).getByRole("option", { name: "黑体" })).toBeInTheDocument();
    fireEvent.change(fontPreference, { target: { value: "fangsong" } });
    fireEvent.change(screen.getByRole("slider", { name: "背景透明度" }), { target: { value: "75" } });

    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(latest?.settings.fontFamily).toBe("fangsong");
      expect(latest?.settings.opacity).toBe(75);
    });
    expect(shell.style.getPropertyValue("--surface-alpha")).toBe("75%");
    expect(shell.style.getPropertyValue("--app-font")).toContain("FangSong");
    expect(shell.style.getPropertyValue("--content-font")).toBe('FangSong, "仿宋", serif');
  });

  it("shows confirmation when the Delete or Backspace shortcut is pressed", async () => {
    render(<App />);

    await screen.findByDisplayValue("今天要做的事");
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(screen.getByRole("dialog", { name: "删除这张便签？" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "删除这张便签？" })).not.toBeInTheDocument();
  });

  it("deletes a note from its context menu and can disable future confirmations", async () => {
    render(<App />);

    const noteList = await screen.findByLabelText("便签列表");
    fireEvent.contextMenu(within(noteList).getByRole("button", { name: /今天要做的事/ }));
    const dialog = screen.getByRole("dialog", { name: "删除这张便签？" });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "以后删除便签时不再显示此弹窗" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "删除" }));
    expect(await screen.findByText("新建一张便签")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    const restored = await within(noteList).findByRole("button", { name: /今天要做的事/ });
    fireEvent.contextMenu(restored);

    expect(screen.queryByRole("dialog", { name: "删除这张便签？" })).not.toBeInTheDocument();
    expect(await screen.findByText("新建一张便签")).toBeInTheDocument();
  });

  it("reorders notes by dragging one note below another", async () => {
    vi.mocked(window.desktop!.loadState).mockResolvedValue({
      ...savedState,
      notes: [
        savedState.notes[0],
        { ...savedState.notes[0], id: "note-2", title: "第二张便签", updatedAt: 2 },
      ],
    } as AppState);
    render(<App />);

    const noteList = await screen.findByLabelText("便签列表");
    const first = within(noteList).getByRole("button", { name: /今天要做的事/ });
    const second = within(noteList).getByRole("button", { name: /第二张便签/ });
    vi.spyOn(second, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 72, width: 200, height: 72, toJSON: () => ({}),
    });
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue("note-1"),
    };

    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(second, { dataTransfer, clientY: 60 });
    fireEvent.drop(second, { dataTransfer, clientY: 60 });

    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(latest?.notes.map((note) => note.id)).toEqual(["note-2", "note-1"]);
    });
  });

  it("undoes both text edits and note deletion with Ctrl+Z", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "第一步" } });
    fireEvent.change(editor, { target: { value: "第二步" } });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("第一步"));

    fireEvent.click(screen.getByRole("button", { name: "删除便签" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(await screen.findByText("新建一张便签")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(await screen.findByDisplayValue("今天要做的事")).toBeInTheDocument();
  });

  it("restores image attachments when undoing a note deletion", async () => {
    vi.mocked(window.desktop!.loadState).mockResolvedValue({
      ...savedState,
      notes: [{ ...savedState.notes[0], body: "![参考图](note-asset:asset-1)" }],
      attachments: {
        "asset-1": {
          id: "asset-1",
          name: "参考图",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,AA==",
        },
      },
    });
    render(<App />);

    await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.click(screen.getByRole("button", { name: "删除便签" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    await screen.findByDisplayValue("今天要做的事");
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    expect(await screen.findByRole("img", { name: "参考图" })).toHaveAttribute("src", "data:image/png;base64,AA==");
  });

  it("applies a font size only to selected text", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "大字 普通" } });
    editor.setSelectionRange(0, 2);
    fireEvent.change(screen.getByRole("combobox", { name: "选中文字的字号" }), { target: { value: "small1" } });

    await waitFor(() => expect(editor.value).toBe('<span style="font-size:32px">大字</span> 普通'));
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    expect(within(screen.getByLabelText("Markdown 预览")).getByText("大字")).toHaveStyle({ fontSize: "32px" });
    expect(within(screen.getByLabelText("Markdown 预览")).getByText("普通")).not.toHaveStyle({ fontSize: "32px" });
  });

  it("offers and applies the 小四 and 五号 sizes only to their selections", async () => {
    render(<App />);

    const sizeSelect = await screen.findByRole("combobox", { name: "选中文字的字号" });
    expect(within(sizeSelect).getByRole("option", { name: "小四" })).toHaveValue("small4");
    expect(within(sizeSelect).getByRole("option", { name: "五号" })).toHaveValue("fifth");

    const editor = screen.getByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "小四 五号 普通" } });
    editor.setSelectionRange(0, 2);
    fireEvent.change(sizeSelect, { target: { value: "small4" } });
    await waitFor(() => expect(editor.value).toContain('<span style="font-size:16px">小四</span>'));

    const fifthStart = editor.value.indexOf("五号");
    editor.setSelectionRange(fifthStart, fifthStart + 2);
    fireEvent.change(sizeSelect, { target: { value: "fifth" } });
    await waitFor(() => expect(editor.value).toContain('<span style="font-size:14px">五号</span>'));

    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    const preview = within(screen.getByLabelText("Markdown 预览"));
    expect(preview.getByText("小四")).toHaveStyle({ fontSize: "16px" });
    expect(preview.getByText("五号")).toHaveStyle({ fontSize: "14px" });
    expect(preview.getByText("普通")).not.toHaveStyle({ fontSize: "16px" });
    expect(preview.getByText("普通")).not.toHaveStyle({ fontSize: "14px" });
  });

  it("keeps the editor scroll position after applying a selected font size", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    const body = `${Array.from({ length: 80 }, (_, index) => `第 ${index + 1} 行`).join("\n")}\n目标文字`;
    fireEvent.change(editor, { target: { value: body } });
    editor.scrollTop = 360;
    editor.scrollLeft = 14;
    const start = body.indexOf("目标文字");
    editor.setSelectionRange(start, start + 4);

    fireEvent.change(screen.getByRole("combobox", { name: "选中文字的字号" }), { target: { value: "small2" } });

    await waitFor(() => expect(editor.value).toContain('<span style="font-size:24px">目标文字</span>'));
    expect(editor.scrollTop).toBe(360);
    expect(editor.scrollLeft).toBe(14);
  });

  it("applies a font family only to selected text", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "仿宋文字 普通文字" } });
    editor.setSelectionRange(0, 4);
    fireEvent.change(screen.getByRole("combobox", { name: "选中文字的字体" }), { target: { value: "fangsong" } });

    await waitFor(() => expect(editor.value).toBe('<font face="仿宋">仿宋文字</font> 普通文字'));
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    const preview = screen.getByLabelText("Markdown 预览");
    expect(within(preview).getByText("仿宋文字")).toHaveAttribute("face", "仿宋");
    expect(within(preview).getByText("普通文字")).not.toHaveAttribute("face", "仿宋");
  });

  it("migrates long legacy font markup without breaking nested font sizes", async () => {
    vi.mocked(window.desktop!.loadState).mockResolvedValue({
      ...savedState,
      notes: [{
        ...savedState.notes[0],
        body: '<span style="font-family: SimSun, &quot;宋体&quot;, serif">宋体 <span style="font-size: 24px">大字</span></span>',
      }],
    } as AppState);

    render(<App />);

    expect(await screen.findByRole("textbox", { name: "便签内容" })).toHaveValue(
      '<font face="宋体">宋体 <span style="font-size: 24px">大字</span></font>',
    );
  });

  it("keeps formatting commands out of note summaries", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, { target: { value: '<font face="黑体">**重点文字**</font>' } });

    const noteList = screen.getByLabelText("便签列表");
    await waitFor(() => expect(within(noteList).getByText("重点文字")).toBeInTheDocument());
    expect(within(noteList).queryByText(/<font|\*\*/)).not.toBeInTheDocument();
  });

  it("shows shortcuts in three aligned rows", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /偏好设置/ }));
    const shortcuts = screen.getByLabelText("快捷键");
    expect(within(shortcuts).getByText("新建")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Ctrl + Alt + N")).toBeInTheDocument();
    expect(within(shortcuts).getByText("保存")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Ctrl + S")).toBeInTheDocument();
    expect(within(shortcuts).getByText("撤销")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Ctrl + Z")).toBeInTheDocument();
    expect(shortcuts.children).toHaveLength(3);
  });

  it("saves immediately with Ctrl+S", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    vi.mocked(window.desktop!.saveState).mockClear();
    fireEvent.change(editor, { target: { value: "立刻保存这段内容" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(latest?.notes[0].body).toBe("立刻保存这段内容");
    });
    expect(screen.getByText(/已立即保存/)).toBeInTheDocument();
  });

  it("persists shortcut and export preferences and exports rendered HTML", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, { target: { value: "**加粗**\n\n*斜体*\n\n<u>下划线</u>" } });
    fireEvent.click(screen.getByRole("button", { name: /偏好设置/ }));
    fireEvent.change(screen.getByRole("slider", { name: "背景透明度" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Delete / Backspace 删除" }));
    fireEvent.change(screen.getByRole("combobox", { name: "导出格式" }), { target: { value: "html" } });

    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(latest?.settings.opacity).toBe(10);
      expect(latest?.settings.deleteWithBackspace).toBe(false);
      expect(latest?.settings.exportFormat).toBe("html");
    });
    expect(screen.getByRole("slider", { name: "背景透明度" })).toHaveAttribute("min", "10");

    expect(document.querySelector(".export-source")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "导出当前便签" }));
    await waitFor(() => expect(window.desktop?.exportFile).toHaveBeenCalled());
    expect(document.querySelector(".export-source")).not.toBeInTheDocument();
    const request = vi.mocked(window.desktop!.exportFile).mock.calls.at(-1)?.[0];
    expect(request?.format).toBe("html");
    expect(request?.html).toContain("<strong>加粗</strong>");
    expect(request?.html).toContain("<em>斜体</em>");
    expect(request?.html).toContain("<u>下划线</u>");
    expect(request?.html).toContain('<main class="export-document">');
    expect(request?.html).toContain('body{font-family:KaiTi, "楷体", serif');
    expect(request?.html).toContain(".export-document{padding:32px 48px 64px}");
    expect(request?.html).toContain("@media (max-width:640px){.export-document{padding:24px 20px 40px}}");
    expect(request?.html).toContain("@media print{html,body{width:auto;min-width:0}.export-document{padding:0}");
  });

  it("exports formulas and code with self-contained print styles", async () => {
    render(<App />);

    const markdown = [
      "矩阵 $X$ 与 $y$，公式：$w=0$",
      "",
      "$$J(w) = \\frac{1}{2m}(Xw-y)^T(Xw-y)$$",
      "",
      "```python",
      "def linear_regression_gradient_descent(X, y, alpha, iterations):",
      "    return X",
      "```",
      "",
      "行内代码 `Ctrl+Shift+K` 保留背景。",
    ].join("\n");
    fireEvent.change(await screen.findByRole("textbox", { name: "便签内容" }), { target: { value: markdown } });
    fireEvent.click(screen.getByRole("button", { name: /偏好设置/ }));
    fireEvent.click(screen.getByRole("button", { name: "导出当前便签" }));

    await waitFor(() => expect(window.desktop?.exportFile).toHaveBeenCalled());
    const html = vi.mocked(window.desktop!.exportFile).mock.calls.at(-1)?.[0].html ?? "";
    expect(html).toContain("src:url(\"");
    expect(html).not.toContain('format("woff"),url');
    expect(html).not.toContain("fonts/KaTeX_");
    expect(html).toContain(".katex .katex-mathml");
    expect(html).toContain("li:has(.katex){padding-block:.35em}");
    expect(html).toContain("clip-path:inset(50%)");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("pre::-webkit-scrollbar");
    expect(html).not.toContain("overflow:auto");
    expect(html).toContain("print-color-adjust:exact");
    expect(html).toContain("def linear_regression_gradient_descent(X, y, alpha, iterations):");
    expect(html).toContain("<code>Ctrl+Shift+K</code>");
  });

  it("exports structured LaTeX without broken math, lonely list items, or unescaped prose", async () => {
    render(<App />);

    const markdown = [
      "# 梯度下降",
      "",
      "- 输入矩阵 $X$",
      "- 准确率 50% 与 x_value",
      "",
      "$$",
      "\\nabla J(w) = \\frac{1}{m}X^T(Xw-y)$$",
      "",
      "$$w := w - \\alpha \\nabla J(w)$$",
      "",
      "```python",
      "def train(x_value):",
      "    # 保留代码注释",
      "    return x_value",
      "```",
      "",
      "| 名称 | 值 |",
      "| --- | --- |",
      "| 损失 | $J(w)$ |",
    ].join("\n");
    fireEvent.change(await screen.findByRole("textbox", { name: "便签内容" }), { target: { value: markdown } });
    fireEvent.click(screen.getByRole("button", { name: /偏好设置/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "导出格式" }), { target: { value: "latex" } });
    fireEvent.click(screen.getByRole("button", { name: "导出当前便签" }));

    await waitFor(() => expect(window.desktop?.exportFile).toHaveBeenCalled());
    const latex = vi.mocked(window.desktop!.exportFile).mock.calls.at(-1)?.[0].latex ?? "";
    expect(latex).toContain("% !TeX program = xelatex");
    expect(latex).toContain("\\documentclass[UTF8,a4paper]{ctexart}");
    expect(latex).toContain("\\usepackage[a4paper,margin=2.2cm]{geometry}");
    expect(latex).toContain("\\begin{itemize}\n\\item 输入矩阵 $X$\n\\item 准确率 50\\% 与 x\\_value\n\\end{itemize}");
    expect(latex).toContain("\\[\n\\nabla J(w) = \\frac{1}{m}X^T(Xw-y)\n\\]");
    expect(latex).toContain("\\[\nw := w - \\alpha \\nabla J(w)\n\\]");
    expect(latex).toContain("\\begin{Verbatim}\ndef train(x_value):\n    # 保留代码注释\n    return x_value\n\\end{Verbatim}");
    expect(latex).toContain("\\begin{tabularx}{\\textwidth}");
    expect(latex).not.toContain("```");
  });

  it("exports the original note source as Markdown", async () => {
    render(<App />);

    const markdown = "# 标题\n\n**正文**\n\n![图片](data:image/png;base64,AA==)";
    fireEvent.change(await screen.findByRole("textbox", { name: "便签内容" }), { target: { value: markdown } });
    fireEvent.click(screen.getByRole("button", { name: /偏好设置/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "导出格式" }), { target: { value: "markdown" } });
    fireEvent.click(screen.getByRole("button", { name: "导出当前便签" }));

    await waitFor(() => expect(window.desktop?.exportFile).toHaveBeenCalled());
    const request = vi.mocked(window.desktop!.exportFile).mock.calls.at(-1)?.[0];
    expect(request?.format).toBe("markdown");
    expect(request?.markdown).toBe("# 标题\n\n**正文**\n\n![图片](./驻笺图片-1.png)");
    expect(request?.assets).toEqual([
      expect.objectContaining({ fileName: "驻笺图片-1.png", dataUrl: "data:image/png;base64,AA==" }),
    ]);
  });

  it("normalizes mixed display-math delimiters in Markdown exports without changing code fences", async () => {
    render(<App />);

    const markdown = [
      "## 3.梯度计算",
      "",
      "$$",
      "\\nabla J(w) = \\frac{1}{m}X^T(Xw - y)$$",
      "",
      "## 4.批量梯度下降更新公式",
      "",
      "$$w := w - \\alpha \\nabla J(w) = w - \\frac{\\alpha}{m}X^T(Xw - y)$$",
      "",
      "```python",
      "literal = '$$not display math$$'",
      "```",
    ].join("\n");
    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, { target: { value: markdown } });
    fireEvent.click(screen.getByRole("button", { name: /偏好设置/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "导出格式" }), { target: { value: "markdown" } });
    fireEvent.click(screen.getByRole("button", { name: "导出当前便签" }));

    await waitFor(() => expect(window.desktop?.exportFile).toHaveBeenCalled());
    const exported = vi.mocked(window.desktop!.exportFile).mock.calls.at(-1)?.[0].markdown ?? "";
    expect(exported).toContain("$$\n\\nabla J(w) = \\frac{1}{m}X^T(Xw - y)\n$$");
    expect(exported).toContain("$$\nw := w - \\alpha \\nabla J(w) = w - \\frac{\\alpha}{m}X^T(Xw - y)\n$$");
    expect(exported).toContain("```python\nliteral = '$$not display math$$'\n```");
    expect(exported).not.toContain("X^T(Xw - y)$$");
    expect((editor as HTMLTextAreaElement).value).toBe(markdown);
  });

  it("renders full bold and italic sentences next to punctuation", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, {
      target: { value: "（8）**健全因地制宜发展新质生产力体制机制。**推动后文。\n\n“*完整的斜体句子！*”继续。" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));

    const preview = screen.getByLabelText("Markdown 预览");
    expect(within(preview).getByText("健全因地制宜发展新质生产力体制机制。").tagName).toBe("STRONG");
    expect(within(preview).getByText("完整的斜体句子！").tagName).toBe("EM");
  });

  it("centers selected headings and paragraphs with Ctrl+E", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "# 居中标题\n\n居中段落" } });
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.keyDown(editor, { key: "e", ctrlKey: true });
    await waitFor(() => expect(editor.value).toBe("# 居中标题 {center}\n\n居中段落 {center}"));

    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    expect(screen.getByRole("heading", { name: "居中标题" })).toHaveStyle({ textAlign: "center" });
    expect(within(screen.getByLabelText("Markdown 预览")).getByText("居中段落")).toHaveStyle({ textAlign: "center" });
  });

  it("switches application controls to English without changing note content", async () => {
    render(<App />);

    await screen.findByDisplayValue("今天要做的事");
    fireEvent.click(screen.getByRole("button", { name: /偏好设置/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "页面语言" }), { target: { value: "en" } });

    expect(screen.getByRole("button", { name: /Preferences/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Note content" })).toHaveValue("整理会议记录");
    expect(window.desktop?.setUiLanguage).toHaveBeenCalledWith("en");
    await waitFor(() => {
      const latest = vi.mocked(window.desktop!.saveState).mock.calls.at(-1)?.[0];
      expect(latest?.settings.uiLanguage).toBe("en");
      expect(latest?.settings.uiLanguageSource).toBe("user");
    });
  });

  it("finds, replaces, and automatically selects the next match", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "目标 A 目标 B 目标" } });
    fireEvent.keyDown(window, { key: "h", ctrlKey: true });
    const findInput = await screen.findByRole("textbox", { name: "查找内容" });
    fireEvent.change(findInput, { target: { value: "目标" } });

    const panel = screen.getByRole("region", { name: "查找与替换" });
    expect(document.querySelector(".sidebar")).toContainElement(panel);
    expect(document.querySelector(".editor-content")).not.toContainElement(panel);
    expect(within(panel).queryByText("0 / 3")).not.toBeInTheDocument();

    await waitFor(() => expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe("目标"));
    await waitFor(() => expect(findInput).toHaveFocus());
    expect(within(panel).getByText("1 / 3")).toBeInTheDocument();
    const highlightLayer = document.querySelector(".find-highlight-layer")!;
    expect(highlightLayer.querySelector("mark")).toHaveTextContent("目标");
    expect(highlightLayer.querySelectorAll(".find-highlight-layout-text")).toHaveLength(3);
    expect(Array.from(highlightLayer.childNodes).every((node) => node.nodeType === Node.ELEMENT_NODE)).toBe(true);

    fireEvent.click(within(panel).getByRole("button", { name: "查找" }));
    fireEvent.change(within(panel).getByRole("textbox", { name: "替换内容" }), { target: { value: "完成" } });
    fireEvent.click(within(panel).getAllByRole("button", { name: "替换" }).at(-1)!);

    await waitFor(() => expect(editor.value).toBe("完成 A 目标 B 目标"));
    expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe("目标");
    expect(within(panel).getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "全部" }));
    await waitFor(() => expect(editor.value).toBe("完成 A 完成 B 完成"));
    fireEvent.keyDown(window, { key: "h", ctrlKey: true });
    expect(screen.queryByRole("region", { name: "查找与替换" })).not.toBeInTheDocument();
  });

  it("keeps equivalent scroll progress when switching edit and preview", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 1000 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });

    try {
      render(<App />);
      const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: Array.from({ length: 60 }, (_, index) => `第 ${index + 1} 行`).join("\n\n") } });
      editor.scrollTop = 450;
      fireEvent.click(screen.getByRole("tab", { name: "预览" }));

      const preview = screen.getByLabelText("Markdown 预览");
      await waitFor(() => expect(preview.scrollTop).toBe(450));
      preview.scrollTop = 675;
      fireEvent.click(screen.getByRole("tab", { name: "编辑" }));
      await waitFor(() => expect((screen.getByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement).scrollTop).toBe(675));
    } finally {
      if (scrollHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
      if (clientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it("imports a Markdown file as a new note", async () => {
    render(<App />);

    await screen.findByDisplayValue("今天要做的事");
    const file = new File(["# 导入正文"], "项目记录.md", { type: "text/markdown" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("# 导入正文") });
    fireEvent.change(screen.getByLabelText("选择 Markdown 文件"), { target: { files: [file] } });

    expect(await screen.findByDisplayValue("项目记录")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "便签内容" })).toHaveValue("# 导入正文");
  });

  it("renders imported-style math blocks without swallowing the following code fence", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.change(editor, {
      target: {
        value: "$$\n\\nabla J(w) = \\frac{1}{m}X^T(Xw-y)$$\n\n```python\ndef step():\n    return 1\n```",
      },
    });
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));

    const preview = screen.getByLabelText("Markdown 预览");
    expect(preview.querySelector(".katex")).toBeInTheDocument();
    expect(preview.querySelector("pre code")).toHaveTextContent("def step():");
  });

  it("opens editor links with Alt+click and preview links in the default browser", async () => {
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    const markdown = "[外部文档](https://example.com/docs)\n\n裸网址：https://example.com/raw";
    fireEvent.change(editor, { target: { value: markdown } });

    editor.setSelectionRange(markdown.indexOf("外部文档") + 1, markdown.indexOf("外部文档") + 1);
    fireEvent.click(editor, { altKey: false });
    expect(window.desktop?.openExternal).not.toHaveBeenCalled();
    fireEvent.click(editor, { altKey: true });
    expect(window.desktop?.openExternal).toHaveBeenLastCalledWith("https://example.com/docs");

    const bareUrlPosition = markdown.indexOf("example.com/raw") + 2;
    editor.setSelectionRange(bareUrlPosition, bareUrlPosition);
    fireEvent.click(editor, { altKey: true });
    expect(window.desktop?.openExternal).toHaveBeenLastCalledWith("https://example.com/raw");

    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    fireEvent.click(await screen.findByRole("link", { name: "外部文档" }));
    expect(window.desktop?.openExternal).toHaveBeenLastCalledWith("https://example.com/docs");
  });

  it("uses imported attachments so Markdown and Typora HTML images render in preview", async () => {
    const importMarkdownFile = vi.fn().mockResolvedValue({
      body: "# 导入内容\n\n![公式图](note-asset:equation)\n\n<img src=\"note-asset:typora\" alt=\"Typora 图片\" style=\"zoom:80%;\" />\n\n```python\nprint('ready')\n```",
      attachments: {
        equation: {
          id: "equation",
          name: "公式图",
          mimeType: "image/svg+xml",
          dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
        },
        typora: {
          id: "typora",
          name: "Typora 图片",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      },
    });
    window.desktop = { ...desktopMock(), importMarkdownFile };
    render(<App />);

    const file = new File(["# 导入内容"], "力扣笔记.md", { type: "text/markdown" });
    fireEvent.change(await screen.findByLabelText("选择 Markdown 文件"), { target: { files: [file] } });

    expect(await screen.findByDisplayValue("力扣笔记")).toBeInTheDocument();
    expect((screen.getByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement).value).toContain('style="zoom:80%;"');
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    expect(await screen.findByRole("img", { name: "公式图" })).toHaveAttribute("src", "data:image/svg+xml;base64,PHN2Zy8+");
    expect(screen.getByRole("img", { name: "Typora 图片" })).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
    expect(screen.getByText("print('ready')")).toBeInTheDocument();
    expect(importMarkdownFile).toHaveBeenCalledWith(file);
  });

  it("scrolls the editor to a searched match while keeping the find input ready", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "scrollHeight");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "clientHeight");
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", { configurable: true, get: () => 3000 });
    Object.defineProperty(HTMLTextAreaElement.prototype, "clientHeight", { configurable: true, get: () => 120 });

    try {
      render(<App />);
      const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: `${Array.from({ length: 90 }, (_, index) => `第 ${index + 1} 行`).join("\n")}\n目标文本` } });
      fireEvent.keyDown(window, { key: "h", ctrlKey: true });
      const findInput = await screen.findByRole("textbox", { name: "查找内容" });
      fireEvent.change(findInput, { target: { value: "目标文本" } });

      await waitFor(() => expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe("目标文本"));
      await waitFor(() => expect(editor.scrollTop).toBeGreaterThan(0));
      expect(findInput).toHaveFocus();
      const highlightLayer = document.querySelector(".find-highlight-layer") as HTMLPreElement;
      expect(highlightLayer.querySelector("mark")).toHaveTextContent("目标文本");
      editor.scrollTop = 720;
      fireEvent.scroll(editor);
      expect(highlightLayer.scrollTop).toBe(720);
    } finally {
      if (scrollHeightDescriptor) Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", scrollHeightDescriptor);
      else delete (HTMLTextAreaElement.prototype as unknown as Record<string, unknown>).scrollHeight;
      if (clientHeightDescriptor) Object.defineProperty(HTMLTextAreaElement.prototype, "clientHeight", clientHeightDescriptor);
      else delete (HTMLTextAreaElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it("lets the find panel be moved and resized", async () => {
    render(<App />);

    await screen.findByRole("textbox", { name: "便签内容" });
    fireEvent.keyDown(window, { key: "h", ctrlKey: true });
    const panel = await screen.findByRole("region", { name: "查找与替换" });
    const sidebar = document.querySelector(".sidebar") as HTMLElement;
    const sidebarRect = vi.spyOn(sidebar, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 294, height: 420, right: 294, bottom: 420, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    const panelRect = vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      left: 8, top: 124, width: 220, height: 104, right: 228, bottom: 228, x: 8, y: 124, toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(within(panel).getByRole("button", { name: "拖动查找面板" }), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 135 });
    fireEvent.pointerUp(window);
    await waitFor(() => expect(panel).toHaveStyle({ left: "58px", top: "159px" }));

    panelRect.mockReturnValue({
      left: 58, top: 159, width: 220, height: 104, right: 278, bottom: 263, x: 58, y: 159, toJSON: () => ({}),
    } as DOMRect);
    fireEvent.pointerDown(within(panel).getByRole("button", { name: "调整查找面板大小" }), { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 230 });
    fireEvent.pointerUp(window);
    await waitFor(() => expect(panel).toHaveStyle({ width: "260px", height: "134px" }));

    sidebarRect.mockRestore();
    panelRect.mockRestore();
  });

  it("pastes a TSV clipboard table as a Markdown table", async () => {
    vi.mocked(window.desktop!.readClipboardText).mockResolvedValue("姓名\t分数\n张三\t90");
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "便签内容" }) as HTMLTextAreaElement;
    editor.setSelectionRange(editor.value.length, editor.value.length);
    fireEvent.click(screen.getByRole("button", { name: "粘贴剪贴板表格" }));

    await waitFor(() => expect(editor).toHaveValue("整理会议记录\n\n| 姓名 | 分数 |\n| --- | --- |\n| 张三 | 90 |"));
    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
