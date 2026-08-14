import { afterAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const {
  importMarkdownFile,
  repairLocalImagesInMarkdown,
  repairStoredNotesLocalImages,
} = require("../electron/markdown-import.cjs") as {
  importMarkdownFile: (filePath: string, options?: { searchRoots?: string[] }) => Promise<{
    body: string;
    attachments: Record<string, { id: string; dataUrl: string }>;
    unresolvedLocalImages: Array<{ source: string; alt: string }>;
  }>;
  repairLocalImagesInMarkdown: (body: string, options?: { reservedAttachmentIds?: string[] }) => {
    body: string;
    attachments: Record<string, { id: string; dataUrl: string }>;
    repairedReferences: number;
  };
  repairStoredNotesLocalImages: (state: Record<string, unknown>) => {
    state: Record<string, any>;
    changed: boolean;
    addedAttachments: number;
    repairedReferences: number;
  };
};

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "floating-notes-image-repair-"));
const imagePath = path.join(temporaryRoot, "示例 image.png");
const missingPath = path.join(temporaryRoot, "missing.png");
fs.writeFileSync(
  imagePath,
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
);

afterAll(() => {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

describe("saved Markdown image repair", () => {
  it("repairs readable absolute images without changing styles or fetching remote images", () => {
    const fileUrl = pathToFileURL(imagePath).toString();
    const body = [
      `<img src="${imagePath}" alt="本地图片" style="zoom:80%;" />`,
      `![重复图片](<${fileUrl}>)`,
      "![已有附件](note-asset:keep)",
      "![远程图片](https://example.com/remote.png)",
      `<img src="${missingPath}" alt="缺失图片" />`,
    ].join("\n");

    const repaired = repairLocalImagesInMarkdown(body, { reservedAttachmentIds: ["keep"] });
    const attachmentIds = Object.keys(repaired.attachments);

    expect(repaired.repairedReferences).toBe(2);
    expect(attachmentIds).toHaveLength(1);
    expect(attachmentIds[0]).not.toBe("keep");
    expect(repaired.body).toContain(`src="note-asset:${attachmentIds[0]}"`);
    expect(repaired.body).toContain(`![重复图片](note-asset:${attachmentIds[0]})`);
    expect(repaired.body).toContain('style="zoom:80%;"');
    expect(repaired.body).toContain("![已有附件](note-asset:keep)");
    expect(repaired.body).toContain("https://example.com/remote.png");
    expect(repaired.body).toContain(missingPath);
  });

  it("preserves stored note metadata, order, settings, and existing attachments", () => {
    const notes = [
      {
        id: "note-1",
        title: "第一条",
        body: `<img src="${imagePath}" style="zoom:65%;" />`,
        createdAt: "2026-08-01T01:02:03.000Z",
        updatedAt: "2026-08-02T04:05:06.000Z",
      },
      {
        id: "note-2",
        title: "第二条",
        body: "没有本地图片",
        createdAt: "2026-08-03T01:02:03.000Z",
        updatedAt: "2026-08-04T04:05:06.000Z",
      },
    ];
    const existingAttachment = {
      old: { id: "old", name: "旧附件", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" },
    };
    const settings = { alwaysOnTop: true, opacity: 42 };
    const originalState = { notes, attachments: existingAttachment, selectedId: "note-1", settings };

    const repaired = repairStoredNotesLocalImages(originalState);

    expect(repaired.changed).toBe(true);
    expect(repaired.addedAttachments).toBe(1);
    expect(repaired.repairedReferences).toBe(1);
    expect(repaired.state.notes).toHaveLength(2);
    expect(repaired.state.notes.map((note: typeof notes[number]) => note.id)).toEqual(["note-1", "note-2"]);
    expect(repaired.state.notes.map((note: typeof notes[number]) => note.title)).toEqual(["第一条", "第二条"]);
    expect(repaired.state.notes[0].createdAt).toBe(notes[0].createdAt);
    expect(repaired.state.notes[0].updatedAt).toBe(notes[0].updatedAt);
    expect(repaired.state.notes[1]).toBe(notes[1]);
    expect(repaired.state.selectedId).toBe("note-1");
    expect(repaired.state.settings).toBe(settings);
    expect(repaired.state.attachments.old).toBe(existingAttachment.old);
    expect(Object.keys(repaired.state.attachments)).toHaveLength(2);
    expect(repaired.state.notes[0].body).toContain('style="zoom:65%;"');
    expect(repaired.state.notes[0].body).toMatch(/src="note-asset:[a-z0-9]+"/);
  });

  it("does not rewrite state when no readable local image is found", () => {
    const state = {
      notes: [{ id: "note-1", body: `![缺失](<${pathToFileURL(missingPath)}>)` }],
      attachments: {},
    };

    const repaired = repairStoredNotesLocalImages(state);

    expect(repaired.changed).toBe(false);
    expect(repaired.state).toBe(state);
  });
});

describe("portable Markdown image import", () => {
  it("relocates a stale absolute Typora path from a folder beside the Markdown file", async () => {
    const documentRoot = path.join(temporaryRoot, "portable-document");
    const imageRoot = path.join(documentRoot, "typora-user-images");
    const portableImage = path.join(imageRoot, "portable.png");
    const markdownPath = path.join(documentRoot, "portable.md");
    const stalePath = "Z:\\FormerComputer\\AppData\\Roaming\\Typora\\typora-user-images\\portable.png";
    fs.mkdirSync(imageRoot, { recursive: true });
    fs.copyFileSync(imagePath, portableImage);
    fs.writeFileSync(markdownPath, `<img src="${stalePath}" alt="便携图片" style="zoom:72%;" />`, "utf8");

    const imported = await importMarkdownFile(markdownPath);
    const attachmentIds = Object.keys(imported.attachments);

    expect(attachmentIds).toHaveLength(1);
    expect(imported.unresolvedLocalImages).toEqual([]);
    expect(imported.body).toContain(`src="note-asset:${attachmentIds[0]}"`);
    expect(imported.body).toContain('style="zoom:72%;"');
  });

  it("uses a user-selected image folder when the image is outside the Markdown folder", async () => {
    const documentRoot = path.join(temporaryRoot, "selected-root-document");
    const selectedRoot = path.join(temporaryRoot, "selected-image-library");
    const selectedImageRoot = path.join(selectedRoot, "archive", "images");
    const selectedImage = path.join(selectedImageRoot, "selected.png");
    const markdownPath = path.join(documentRoot, "selected.md");
    const stalePath = "Y:\\OldUser\\Documents\\images\\selected.png";
    fs.mkdirSync(documentRoot, { recursive: true });
    fs.mkdirSync(selectedImageRoot, { recursive: true });
    fs.copyFileSync(imagePath, selectedImage);
    fs.writeFileSync(markdownPath, `![选择目录](${stalePath})`, "utf8");

    const initial = await importMarkdownFile(markdownPath);
    const relocated = await importMarkdownFile(markdownPath, { searchRoots: [selectedRoot] });

    expect(Object.keys(initial.attachments)).toHaveLength(0);
    expect(initial.unresolvedLocalImages).toEqual([{ source: stalePath, alt: "选择目录" }]);
    expect(Object.keys(relocated.attachments)).toHaveLength(1);
    expect(relocated.unresolvedLocalImages).toEqual([]);
    expect(relocated.body).toMatch(/^!\[选择目录\]\(note-asset:[a-z0-9]+\)$/);
  });

  it("leaves an unresolved absolute path unchanged when matching filenames are ambiguous", async () => {
    const documentRoot = path.join(temporaryRoot, "ambiguous-document");
    const firstRoot = path.join(documentRoot, "first");
    const secondRoot = path.join(documentRoot, "second");
    const markdownPath = path.join(documentRoot, "ambiguous.md");
    const stalePath = "X:\\OldUser\\Pictures\\duplicate.png";
    fs.mkdirSync(firstRoot, { recursive: true });
    fs.mkdirSync(secondRoot, { recursive: true });
    fs.copyFileSync(imagePath, path.join(firstRoot, "duplicate.png"));
    fs.copyFileSync(imagePath, path.join(secondRoot, "duplicate.png"));
    fs.writeFileSync(markdownPath, `![歧义图片](${stalePath})`, "utf8");

    const imported = await importMarkdownFile(markdownPath);

    expect(Object.keys(imported.attachments)).toHaveLength(0);
    expect(imported.unresolvedLocalImages).toEqual([{ source: stalePath, alt: "歧义图片" }]);
    expect(imported.body).toBe(`![歧义图片](${stalePath})`);
  });
});
