import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  CSSProperties,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import { flushSync } from "react-dom";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import {
  ALargeSmall,
  AlignCenter,
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Bold,
  BookOpen,
  Download,
  Eye,
  Grip,
  GripVertical,
  Heading,
  ImagePlus,
  Italic,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Sigma,
  Table2,
  Trash2,
  Type,
  Underline,
  Upload,
  X,
} from "lucide-react";
import "katex/dist/katex.min.css";
import type { AppFont, AppState, BodyFontSize, ExportFormat, ExportRequest, MarkdownImportResult, Note, NoteAttachment, UiLanguage } from "./types";
import { katexExportStyles } from "./katexExportStyles";

const SIDEBAR_MIN = 150;
const SIDEBAR_MAX = 420;
const NOTE_ASSET_PREFIX = "note-asset:";
const FIND_PANEL_MIN_WIDTH = 134;
const FIND_PANEL_MIN_HEIGHT = 104;

const fonts: { id: AppFont; label: string; labelEn: string; family: string; inlineFamily: string }[] = [
  { id: "kaiti", label: "楷体", labelEn: "KaiTi", family: 'KaiTi, "楷体", serif', inlineFamily: "楷体" },
  { id: "simsun", label: "宋体", labelEn: "SimSun", family: 'SimSun, "宋体", serif', inlineFamily: "宋体" },
  { id: "fangsong", label: "仿宋", labelEn: "FangSong", family: 'FangSong, "仿宋", serif', inlineFamily: "仿宋" },
  { id: "simhei", label: "黑体", labelEn: "SimHei", family: 'SimHei, "黑体", sans-serif', inlineFamily: "黑体" },
  { id: "times", label: "Times New Roman", labelEn: "Times New Roman", family: '"Times New Roman", SimSun, serif', inlineFamily: "Times New Roman" },
  { id: "segoe", label: "Segoe UI", labelEn: "Segoe UI", family: '"Segoe UI", SimHei, sans-serif', inlineFamily: "Segoe UI" },
  { id: "arial", label: "Arial", labelEn: "Arial", family: 'Arial, SimHei, sans-serif', inlineFamily: "Arial" },
  { id: "verdana", label: "Verdana", labelEn: "Verdana", family: 'Verdana, SimHei, sans-serif', inlineFamily: "Verdana" },
];

function contentFontFamily(baseFamily: string) {
  return baseFamily;
}

const bodyFontSizes: { id: BodyFontSize; label: string; labelEn: string; value: string }[] = [
  { id: "small1", label: "小一", labelEn: "32 px", value: "32px" },
  { id: "second", label: "二号", labelEn: "29 px", value: "29px" },
  { id: "small2", label: "小二", labelEn: "24 px", value: "24px" },
  { id: "third", label: "三号", labelEn: "21 px", value: "21px" },
  { id: "small3", label: "小三", labelEn: "20 px", value: "20px" },
  { id: "fourth", label: "四号（默认）", labelEn: "19 px (default)", value: "19px" },
  { id: "small4", label: "小四", labelEn: "16 px", value: "16px" },
  { id: "fifth", label: "五号", labelEn: "14 px", value: "14px" },
];

const exportFormats: { id: ExportFormat; label: string; labelEn: string }[] = [
  { id: "pdf", label: "PDF（默认）", labelEn: "PDF (default)" },
  { id: "word", label: "Word", labelEn: "Word" },
  { id: "latex", label: "LaTeX", labelEn: "LaTeX" },
  { id: "html", label: "HTML", labelEn: "HTML" },
  { id: "markdown", label: "Markdown (.md)", labelEn: "Markdown (.md)" },
];

const initialState: AppState = {
  notes: [],
  attachments: {},
  selectedId: null,
  settings: {
    alwaysOnTop: true,
    launchAtLogin: false,
    sidebarCollapsed: false,
    sidebarWidth: 294,
    opacity: 92,
    fontFamily: "kaiti",
    fontFamilySource: "installer",
    deleteWithBackspace: true,
    confirmBeforeDelete: true,
    exportFormat: "pdf",
    uiLanguage: "zh",
    uiLanguageSource: "installer",
    installerLanguage: "zh",
    installerLanguageGeneration: null,
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function makeNote(language: UiLanguage = "zh"): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: language === "en" ? "New note" : "新便签",
    body: "",
    color: "paper",
    createdAt: now,
    updatedAt: now,
  };
}

function inlineFontName(fontFamily: string) {
  const normalized = fontFamily.replace(/&quot;/gi, '"').toLocaleLowerCase();
  if (normalized.includes("times new roman")) return "Times New Roman";
  if (normalized.includes("segoe ui")) return "Segoe UI";
  if (normalized.includes("verdana")) return "Verdana";
  if (normalized.includes("arial")) return "Arial";
  if (normalized.includes("fangsong") || normalized.includes("仿宋")) return "仿宋";
  if (normalized.includes("simhei") || normalized.includes("黑体")) return "黑体";
  if (normalized.includes("simsun") || normalized.includes("宋体")) return "宋体";
  if (normalized.includes("kaiti") || normalized.includes("楷体")) return "楷体";
  return null;
}

function normalizeFontFamily(value: unknown, fallback: AppFont): AppFont {
  if (value === "system") return "kaiti";
  return fonts.find((font) => font.id === value)?.id ?? fallback;
}

function compactLegacyFontMarkup(markdown: string) {
  const tagPattern = /<span\b[^>]*>|<\/span\s*>/gi;
  const spanStack: boolean[] = [];
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(markdown))) {
    result += markdown.slice(cursor, match.index);
    const tag = match[0];
    if (/^<\/span/i.test(tag)) {
      result += spanStack.pop() ? "</font>" : tag;
    } else {
      const style = tag.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? "";
      const familyMatch = style.match(/^\s*font-family\s*:\s*(.+?)\s*;?\s*$/i);
      const face = familyMatch ? inlineFontName(familyMatch[1]) : null;
      spanStack.push(Boolean(face));
      result += face ? `<font face="${face}">` : tag;
    }
    cursor = tagPattern.lastIndex;
  }

  return result + markdown.slice(cursor);
}

function noteSummary(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?(?:font|span|u)\b[^>]*>/gi, "")
    .replace(/\s*\{center\}\s*$/gm, "")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+])\s+/gm, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeAttachmentId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function migrateInlineImages(notes: Note[], savedAttachments: Record<string, NoteAttachment> | undefined) {
  const attachments = savedAttachments && typeof savedAttachments === "object"
    ? { ...savedAttachments }
    : {};
  const existingByData = new Map(
    Object.values(attachments).map((attachment) => [attachment.dataUrl, attachment.id]),
  );
  let imageCount = Object.keys(attachments).length;
  const imagePattern = /!\[([^\]]*)\]\((data:image\/(png|jpeg|gif|webp|bmp|svg\+xml|avif);base64,[^)]+)\)/gi;

  const migratedNotes = notes.map((note) => ({
    ...note,
    body: note.body.replace(imagePattern, (_match, alt: string, dataUrl: string, subtype: string) => {
      let id = existingByData.get(dataUrl);
      if (!id) {
        id = makeAttachmentId();
        while (attachments[id]) id = makeAttachmentId();
        imageCount += 1;
        attachments[id] = {
          id,
          name: alt.trim() || `图片-${imageCount}`,
          mimeType: `image/${subtype.toLocaleLowerCase()}`,
          dataUrl,
        };
        existingByData.set(dataUrl, id);
      }
      return `![${alt}](${NOTE_ASSET_PREFIX}${id})`;
    }),
  }));

  return { notes: migratedNotes, attachments };
}

function normalizeState(saved: AppState | null | undefined): AppState {
  const normalizedNotes = Array.isArray(saved?.notes)
    ? saved.notes.map((note) => ({
      ...note,
      body: compactLegacyFontMarkup(note.body ?? ""),
      color: "paper" as const,
    }))
    : [];
  const { notes, attachments } = migrateInlineImages(normalizedNotes, saved?.attachments);
  const savedSettings = saved?.settings ?? initialState.settings;
  const sidebarWidth = Number(savedSettings.sidebarWidth);
  const exportFormat = exportFormats.some((item) => item.id === savedSettings.exportFormat)
    ? savedSettings.exportFormat
    : initialState.settings.exportFormat;
  const opacityValue = Number(savedSettings.opacity);
  const selectedId = notes.some((note) => note.id === saved?.selectedId)
    ? saved?.selectedId ?? null
    : notes[0]?.id ?? null;
  const installerLanguage = savedSettings.installerLanguage === "en" ? "en" : "zh";
  const defaultFont = installerLanguage === "en" ? "times" : "kaiti";

  return {
    notes,
    attachments,
    selectedId,
    settings: {
      ...initialState.settings,
      ...savedSettings,
      sidebarWidth: Number.isFinite(sidebarWidth)
        ? clamp(sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX)
        : initialState.settings.sidebarWidth,
      opacity: Number.isFinite(opacityValue)
        ? clamp(opacityValue, 10, 100)
        : initialState.settings.opacity,
      deleteWithBackspace: savedSettings.deleteWithBackspace !== false,
      confirmBeforeDelete: savedSettings.confirmBeforeDelete !== false,
      exportFormat,
      fontFamily: normalizeFontFamily(savedSettings.fontFamily, defaultFont),
      fontFamilySource: savedSettings.fontFamilySource === "user" ? "user" : "installer",
      uiLanguage: savedSettings.uiLanguage === "en" ? "en" : "zh",
      uiLanguageSource: savedSettings.uiLanguageSource === "user" ? "user" : "installer",
      installerLanguage,
      installerLanguageGeneration: Number.isInteger(savedSettings.installerLanguageGeneration)
        ? savedSettings.installerLanguageGeneration
        : null,
    },
  };
}

function loadWebFallback(): AppState {
  try {
    const value = localStorage.getItem("floating-notes-state");
    return normalizeState(value ? JSON.parse(value) : initialState);
  } catch {
    return initialState;
  }
}

function formatTime(timestamp: number, language: UiLanguage) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function buildExportHtml(title: string, markup: string, baseFontFamily = fonts[0].family, language: UiLanguage = "zh") {
  return `<!doctype html><html lang="${language === "en" ? "en" : "zh-CN"}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${katexExportStyles}</style><style>
    @page{size:A4;margin:14mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff}
    body{font-family:${contentFontFamily(baseFontFamily)};color:#202521;line-height:1.75;font-size:19px;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .export-document{padding:32px 48px 64px}
    h1,h2,h3,h4,h5{line-height:1.35;break-after:avoid-page}h1{font-size:32px}h2{font-size:29px}h3{font-size:24px}h4{font-size:21px}h5{font-size:20px}
    p,ul,ol,blockquote,pre,table{margin:0 0 1em}ul,ol{padding-left:1.55em}li:has(.katex){padding-block:.35em}strong{font-weight:900}em{font-style:oblique 14deg}u{text-decoration-line:underline;text-decoration-thickness:1px;text-underline-offset:2px}
    code{font-family:Consolas,"Courier New",monospace;font-size:.9em}
    :not(pre)>code{padding:.15em .35em;border-radius:3px;background:#eeece5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    pre{max-width:100%;overflow:visible;padding:14px 16px;border:1px solid #ddd9ce;border-radius:5px;background:#292e2b;color:#f4f1e9;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;break-inside:avoid-page;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    pre code{padding:0;background:transparent;color:inherit;white-space:inherit}pre::-webkit-scrollbar{display:none;width:0;height:0}
    img{display:block;max-width:100%;height:auto;margin:14px auto;break-inside:avoid-page}
    table{width:100%;border-collapse:collapse;break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid-page}th,td{border:1px solid #bbb;padding:6px;text-align:left}th{background:#eeece6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    blockquote{border-left:3px solid #c5a056;padding:2px 0 2px 12px;color:#666d67}
    .katex-display{max-width:100%;overflow:visible;padding:4px 0;break-inside:avoid-page}
    .katex .katex-mathml{position:absolute;width:1px;height:1px;overflow:hidden;padding:0;border:0;clip-path:inset(50%)}
    @media (max-width:640px){.export-document{padding:24px 20px 40px}}
    @media print{html,body{width:auto;min-width:0}.export-document{padding:0}pre{overflow:visible!important}pre::-webkit-scrollbar{display:none!important}:not(pre)>code,pre,th{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
    </style></head><body><main class="export-document"><h1>${escapeHtml(title)}</h1>${markup}</main></body></html>`;
}

function collectImageAssets(markdown: string, language: UiLanguage = "zh") {
  const assets: { fileName: string; dataUrl: string }[] = [];
  const imagePattern = /!\[[^\]]*\]\((data:image\/([a-z0-9.+-]+);base64,[^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = imagePattern.exec(markdown))) {
    const extension = imageFileExtension(match[2]);
    const prefix = language === "en" ? "ForeJot-image" : "驻笺图片";
    assets.push({ fileName: `${prefix}-${assets.length + 1}.${extension}`, dataUrl: match[1] });
  }
  return assets;
}

function imageFileExtension(mimeSubtype: string) {
  const normalized = mimeSubtype.toLowerCase();
  if (normalized === "jpeg") return "jpg";
  if (normalized === "svg+xml") return "svg";
  return normalized || "png";
}

function resolveAttachmentSource(source: string | undefined, attachments: Record<string, NoteAttachment>) {
  if (!source?.startsWith(NOTE_ASSET_PREFIX)) return source;
  return attachments[source.slice(NOTE_ASSET_PREFIX.length)]?.dataUrl ?? source;
}

function hydrateImageReferences(markdown: string, attachments: Record<string, NoteAttachment>) {
  return markdown.replace(/note-asset:([a-z0-9-]+)/gi, (source, id: string) => (
    attachments[id]?.dataUrl ?? source
  ));
}

function normalizePortableDisplayMath(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const normalized: string[] = [];
  let displayMathOpen = false;
  let codeFence: { marker: "`" | "~"; length: number } | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (codeFence) {
      normalized.push(line);
      if (fenceMatch && fenceMatch[1][0] === codeFence.marker && fenceMatch[1].length >= codeFence.length) {
        codeFence = null;
      }
      continue;
    }
    if (!displayMathOpen && fenceMatch) {
      codeFence = { marker: fenceMatch[1][0] as "`" | "~", length: fenceMatch[1].length };
      normalized.push(line);
      continue;
    }

    const trimmed = line.trim();
    const indentation = line.slice(0, line.length - line.trimStart().length);
    if (trimmed === "$$") {
      normalized.push(`${indentation}$$`);
      displayMathOpen = !displayMathOpen;
      continue;
    }

    if (!displayMathOpen && trimmed.startsWith("$$")) {
      const sameLineClose = trimmed.length > 2 && trimmed.endsWith("$$");
      const formula = trimmed.slice(2, sameLineClose ? -2 : undefined).trim();
      normalized.push(`${indentation}$$`);
      if (formula) normalized.push(`${indentation}${formula}`);
      if (sameLineClose) {
        normalized.push(`${indentation}$$`);
      } else {
        displayMathOpen = true;
      }
      continue;
    }

    if (displayMathOpen && trimmed.endsWith("$$")) {
      const formula = trimmed.slice(0, -2).trimEnd();
      if (formula) normalized.push(`${indentation}${formula}`);
      normalized.push(`${indentation}$$`);
      displayMathOpen = false;
      continue;
    }

    normalized.push(line);
  }

  return normalized.join("\n");
}

function buildPortableMarkdown(markdown: string, assets: { fileName: string; dataUrl: string }[]) {
  let imageIndex = 0;
  const portableImages = markdown.replace(
    /!\[([^\]]*)\]\(data:image\/(?:[a-z0-9.+-]+);base64,[^)]+\)/gi,
    (_match, alt: string) => {
      const asset = assets[imageIndex++];
      return asset ? `![${alt}](./${asset.fileName})` : _match;
    },
  );
  return normalizePortableDisplayMath(portableImages);
}

function escapeLatex(value: string) {
  const replacements: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "%": "\\%",
    "&": "\\&",
    "_": "\\_",
    "#": "\\#",
    "$": "\\$",
    "{": "\\{",
    "}": "\\}",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return value.replace(/[\\%&_#$\{\}~^]/g, (character) => replacements[character]);
}

interface LatexMarkdownNode {
  type: string;
  value?: string;
  depth?: number;
  ordered?: boolean;
  url?: string;
  alt?: string;
  children?: LatexMarkdownNode[];
}

interface LatexRenderContext {
  assets: { fileName: string; dataUrl: string }[];
  imageIndex: number;
}

function stripLatexCenterMarker(value: string) {
  const centered = /\\\{center\\\}\s*$/.test(value);
  return { centered, value: centered ? value.replace(/\s*\\\{center\\\}\s*$/, "") : value };
}

function latexImage(asset: { fileName: string }) {
  return `\\includegraphics[width=\\linewidth,height=.82\\textheight,keepaspectratio]{\\detokenize{${asset.fileName}}}`;
}

function renderLatexChildren(node: LatexMarkdownNode, context: LatexRenderContext) {
  return (node.children ?? []).map((child) => renderLatexNode(child, context)).join("");
}

function renderLatexTable(node: LatexMarkdownNode, context: LatexRenderContext) {
  const rows = node.children ?? [];
  const columnCount = Math.max(1, ...rows.map((row) => row.children?.length ?? 0));
  const renderedRows = rows.map((row) => {
    const cells = Array.from({ length: columnCount }, (_, index) => {
      const cell = row.children?.[index];
      return cell ? renderLatexChildren(cell, context).trim() : "";
    });
    return `${cells.join(" & ")} \\\\ \\hline`;
  });
  return `\\begin{center}\n\\begin{tabularx}{\\textwidth}{|*{${columnCount}}{>{\\raggedright\\arraybackslash}X|}}\n\\hline\n${renderedRows.join("\n")}\n\\end{tabularx}\n\\end{center}\n\n`;
}

function renderLatexNode(node: LatexMarkdownNode, context: LatexRenderContext): string {
  switch (node.type) {
    case "root":
      return renderLatexChildren(node, context);
    case "text":
      return escapeLatex(node.value ?? "");
    case "inlineMath":
      return `$${node.value ?? ""}$`;
    case "math":
      return `\\[\n${node.value ?? ""}\n\\]\n\n`;
    case "strong":
      return `\\textbf{${renderLatexChildren(node, context)}}`;
    case "emphasis":
      return `\\emph{${renderLatexChildren(node, context)}}`;
    case "delete":
      return `\\sout{${renderLatexChildren(node, context)}}`;
    case "inlineCode":
      return `\\texttt{${escapeLatex(node.value ?? "")}}`;
    case "code":
      return `\\begin{Verbatim}\n${node.value ?? ""}\n\\end{Verbatim}\n\n`;
    case "break":
      return "\\\\\n";
    case "paragraph": {
      if (node.children?.length === 1 && node.children[0].type === "image") {
        return `\\begin{center}\n${renderLatexNode(node.children[0], context)}\n\\end{center}\n\n`;
      }
      const content = stripLatexCenterMarker(renderLatexChildren(node, context).trim());
      return content.centered
        ? `\\begin{center}\n${content.value}\n\\end{center}\n\n`
        : `${content.value}\n\n`;
    }
    case "heading": {
      const commands = ["section", "subsection", "subsubsection", "paragraph", "subparagraph", "subparagraph"];
      const command = commands[Math.min(Math.max((node.depth ?? 1) - 1, 0), commands.length - 1)];
      const content = stripLatexCenterMarker(renderLatexChildren(node, context).trim());
      const heading = `\\${command}*{${content.value}}`;
      return content.centered ? `\\begin{center}\n${heading}\n\\end{center}\n\n` : `${heading}\n\n`;
    }
    case "list": {
      const environment = node.ordered ? "enumerate" : "itemize";
      const items = (node.children ?? []).map((child) => `\\item ${renderLatexChildren(child, context).trim()}`);
      return `\\begin{${environment}}\n${items.join("\n")}\n\\end{${environment}}\n\n`;
    }
    case "listItem":
      return renderLatexChildren(node, context);
    case "blockquote":
      return `\\begin{quote}\n${renderLatexChildren(node, context).trim()}\n\\end{quote}\n\n`;
    case "thematicBreak":
      return "\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par\n\n";
    case "link":
      return `\\href{\\detokenize{${node.url ?? ""}}}{${renderLatexChildren(node, context)}}`;
    case "image": {
      if (/^data:image\//i.test(node.url ?? "")) {
        const asset = context.assets[context.imageIndex++];
        if (asset) return latexImage(asset);
      }
      return node.url
        ? `\\href{\\detokenize{${node.url}}}{${escapeLatex(node.alt || node.url)}}`
        : escapeLatex(node.alt ?? "");
    }
    case "table":
      return renderLatexTable(node, context);
    case "tableRow":
    case "tableCell":
      return renderLatexChildren(node, context);
    case "html": {
      const html = (node.value ?? "").trim();
      if (/^<(?:u|strong|b)>$/i.test(html)) return /^<u>/i.test(html) ? "\\underline{" : "\\textbf{";
      if (/^<(?:em|i)>$/i.test(html)) return "\\emph{";
      if (/^<\/(?:u|strong|b|em|i)>$/i.test(html)) return "}";
      if (/^<(?:font|span)\b/i.test(html)) return "{";
      if (/^<\/(?:font|span)>$/i.test(html)) return "}";
      if (/^<br\s*\/?\s*>$/i.test(html)) return "\\\\\n";
      return "";
    }
    default:
      return renderLatexChildren(node, context);
  }
}

function buildLatex(title: string, markdown: string, assets: { fileName: string; dataUrl: string }[]) {
  const normalizedMarkdown = normalizeMarkdownForPreview(normalizePortableDisplayMath(markdown));
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .parse(normalizedMarkdown) as LatexMarkdownNode;
  const body = renderLatexNode(tree, { assets, imageIndex: 0 }).trim();
  return `% !TeX program = xelatex
\\documentclass[UTF8,a4paper]{ctexart}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage[a4paper,margin=2.2cm]{geometry}
\\usepackage{tabularx,array}
\\usepackage{fvextra}
\\usepackage[normalem]{ulem}
\\usepackage{hyperref}
\\hypersetup{hidelinks}
\\setlength{\\emergencystretch}{3em}
\\fvset{breaklines=true,breakanywhere=true,fontsize=\\small}
\\title{${escapeLatex(title)}}
\\author{}
\\date{}
\\begin{document}
\\maketitle
${body}
\\end{document}
`;
}

function markdownUrlTransform(url: string, key: string) {
  if (key === "src" && url.startsWith(NOTE_ASSET_PREFIX)) {
    return url;
  }
  if (key === "src" && /^data:image\/(?:png|jpeg|gif|webp|bmp|svg\+xml|avif);base64,/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
}

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hProperties?: Record<string, unknown>;
  };
}

function remarkCenterAlign() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if ((node.type === "paragraph" || node.type === "heading") && node.children?.length) {
        const findLastText = (current: MarkdownNode): MarkdownNode | null => {
          if (current.type === "text") return current;
          if (!current.children?.length) return null;
          for (let index = current.children.length - 1; index >= 0; index -= 1) {
            const found = findLastText(current.children[index]);
            if (found) return found;
          }
          return null;
        };
        const lastText = findLastText(node);
        if (lastText?.value && /\s*\{center\}\s*$/.test(lastText.value)) {
          lastText.value = lastText.value.replace(/\s*\{center\}\s*$/, "");
          node.data = {
            ...node.data,
            hProperties: { ...node.data?.hProperties, style: "text-align:center" },
          };
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

function normalizeEmphasisSegment(segment: string) {
  return segment
    .replace(/(^|[^*])\*\*([^*\n]+?)\*(?!\*)/g, "$1*$2*")
    .replace(/(^|[^*])\*([^*\n]+?)\*\*(?!\*)/g, "$1*$2*")
    .replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
}

function normalizeMathBlockDelimiters(segment: string) {
  const lines = segment.split("\n");
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!/^\s*\$\$\s*$/.test(lines[index])) continue;
    const closingOnFormulaLine = lines[index + 1].match(/^(\s*)(.*?)\s*\$\$\s*$/);
    if (!closingOnFormulaLine || !closingOnFormulaLine[2].trim()) continue;
    lines[index + 1] = `${closingOnFormulaLine[1]}${closingOnFormulaLine[2].replace(/\s+$/, "")}`;
    lines.splice(index + 2, 0, `${closingOnFormulaLine[1]}$$`);
    index += 1;
  }
  return lines.join("\n");
}

function normalizeMarkdownForPreview(markdown: string) {
  const protectedPattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
  const normalizedMath = markdown
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((segment) => /^(?:```|~~~|`)/.test(segment) ? segment : normalizeMathBlockDelimiters(segment))
    .join("");
  return normalizedMath
    .split(protectedPattern)
    .map((segment) => {
      if (/^(?:```|~~~|`|\$)/.test(segment)) return segment;
      return normalizeEmphasisSegment(segment);
    })
    .join("");
}

interface PositionedMarkdownNode {
  type: string;
  url?: string;
  children?: PositionedMarkdownNode[];
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
}

function externalHttpUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function markdownLinkAtPosition(markdown: string, position: number) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as PositionedMarkdownNode;
  let matchedUrl: string | null = null;
  const visit = (node: PositionedMarkdownNode) => {
    if (matchedUrl) return;
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (node.type === "link" && typeof start === "number" && typeof end === "number" && position >= start && position <= end) {
      matchedUrl = externalHttpUrl(node.url);
      return;
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return matchedUrl;
}

interface TextMatch {
  start: number;
  end: number;
}

interface FindPanelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function findTextMatches(text: string, query: string, caseSensitive: boolean): TextMatch[] {
  if (!query) return [];
  const haystack = caseSensitive ? text : text.toLocaleLowerCase();
  const needle = caseSensitive ? query : query.toLocaleLowerCase();
  const matches: TextMatch[] = [];
  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const start = haystack.indexOf(needle, offset);
    if (start === -1) break;
    matches.push({ start, end: start + query.length });
    offset = start + Math.max(query.length, 1);
  }
  return matches;
}

function textareaLineHeight(textarea: HTMLTextAreaElement) {
  const style = window.getComputedStyle(textarea);
  const parsedFontSize = Number.parseFloat(style.fontSize);
  const fontSize = Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : 19;
  const parsedLineHeight = Number.parseFloat(style.lineHeight);
  if (style.lineHeight.endsWith("px") && Number.isFinite(parsedLineHeight) && parsedLineHeight > 0) {
    return parsedLineHeight;
  }
  return fontSize * (Number.isFinite(parsedLineHeight) && parsedLineHeight > 1 ? parsedLineHeight : 1.8);
}

function measureTextareaMatchTop(textarea: HTMLTextAreaElement, position: number) {
  if (!textarea.clientWidth || !document.body) return null;
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.left = "-100000px";
  mirror.style.top = "0";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.textTransform = style.textTransform;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = "break-word";
  mirror.textContent = textarea.value.slice(0, position);
  marker.textContent = "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const top = marker.offsetTop - textarea.clientTop;
  mirror.remove();
  return top > 0 || position === 0 ? top : null;
}

function revealTextareaMatch(textarea: HTMLTextAreaElement, position: number) {
  const lineHeight = textareaLineHeight(textarea);
  const fallbackTop = textarea.value.slice(0, position).split("\n").length - 1;
  const estimatedTop = fallbackTop * lineHeight;
  const measuredTop = measureTextareaMatchTop(textarea, position);
  const targetTop = measuredTop ?? estimatedTop;
  const maximum = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
  const centeredTop = Math.max(0, targetTop - Math.max(0, (textarea.clientHeight - lineHeight) / 2));
  textarea.scrollTop = maximum > 0 ? clamp(centeredTop, 0, maximum) : centeredTop;
}

function toggleCenterMarkers(markdown: string) {
  const lines = markdown.split("\n");
  const targetLines: number[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    if (/^\s{0,3}#{1,6}\s+/.test(lines[index])) {
      targetLines.push(index);
      index += 1;
      continue;
    }
    let blockEnd = index;
    while (
      blockEnd + 1 < lines.length
      && lines[blockEnd + 1].trim()
      && !/^\s{0,3}#{1,6}\s+/.test(lines[blockEnd + 1])
    ) {
      blockEnd += 1;
    }
    targetLines.push(blockEnd);
    index = blockEnd + 1;
  }

  if (!targetLines.length) return markdown;
  const shouldRemove = targetLines.every((lineIndex) => /\s*\{center\}\s*$/.test(lines[lineIndex]));
  for (const lineIndex of targetLines) {
    lines[lineIndex] = shouldRemove
      ? lines[lineIndex].replace(/\s*\{center\}\s*$/, "")
      : `${lines[lineIndex].replace(/\s+$/, "")} {center}`;
  }
  return lines.join("\n");
}

function clipboardTextToMarkdownTable(value: string) {
  const text = value.trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const looksLikeMarkdownTable = lines.length >= 2
    && lines[0].includes("|")
    && /^\s*\|?\s*:?-{3,}/.test(lines[1]);
  if (looksLikeMarkdownTable) return text;
  if (!lines.some((line) => line.includes("\t"))) return null;

  const rows = lines.map((line) => line.split("\t"));
  const columnCount = Math.max(...rows.map((row) => row.length));
  const cell = (content: string) => content.trim().replace(/\|/g, "\\|");
  const row = (cells: string[]) => `| ${Array.from({ length: columnCount }, (_, column) => cell(cells[column] ?? "")).join(" | ")} |`;
  return [row(rows[0]), `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`, ...rows.slice(1).map(row)].join("\n");
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [findOpen, setFindOpen] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [findFocusToken, setFindFocusToken] = useState(0);
  const [findPanelRect, setFindPanelRect] = useState<FindPanelRect | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const [manualSaveVisible, setManualSaveVisible] = useState(false);
  const [exportSourceVisible, setExportSourceVisible] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findPanelRef = useRef<HTMLElement>(null);
  const findHighlightRef = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const exportSourceRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  const draggedNoteIdRef = useRef<string | null>(null);
  const historyRef = useRef<AppState[]>([]);
  const previousStateRef = useRef<AppState | null>(null);
  const undoingRef = useRef(false);
  const stateRef = useRef(state);
  const manualSaveTimerRef = useRef<number | null>(null);
  const pendingModeScrollRatioRef = useRef<number | null>(null);
  const pendingFindMatchRef = useRef<TextMatch | null>(null);
  const preserveFindInputFocusRef = useRef(false);
  const pendingFindStartRef = useRef<number | null>(null);
  const findPanelPointerCleanupRef = useRef<(() => void) | null>(null);
  const pendingEditorRestoreRef = useRef<{
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number;
    scrollLeft: number;
  } | null>(null);
  stateRef.current = state;
  const language = state.settings.uiLanguage;
  const ui = (zh: string, en: string) => language === "en" ? en : zh;

  const createNote = useCallback(() => {
    const note = makeNote(stateRef.current.settings.uiLanguage);
    setState((current) => ({
      ...current,
      notes: [note, ...current.notes],
      selectedId: note.id,
    }));
    setQuery("");
    setEditorMode("edit");
    window.setTimeout(() => titleRef.current?.select(), 50);
  }, []);

  useEffect(() => {
    const load = window.desktop?.loadState() ?? Promise.resolve(loadWebFallback());
    load.then((saved) => {
      const normalized = normalizeState(saved);
      if (normalized.notes.length) {
        setState(normalized);
      } else {
        const first = makeNote(normalized.settings.uiLanguage);
        setState({ ...normalized, notes: [first], selectedId: first.id });
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (undoingRef.current) {
      undoingRef.current = false;
      previousStateRef.current = state;
      return;
    }
    if (previousStateRef.current && previousStateRef.current !== state) {
      // AppState updates are immutable, so prior states safely share unchanged notes and image data.
      historyRef.current = [...historyRef.current.slice(-49), previousStateRef.current];
    }
    previousStateRef.current = state;
  }, [ready, state]);

  useEffect(() => {
    if (!ready) return;
    const frame = window.requestAnimationFrame(() => {
      const maxWidth = getSidebarMaxWidth();
      setState((current) => {
        const width = clamp(current.settings.sidebarWidth, SIDEBAR_MIN, maxWidth);
        return width === current.settings.sidebarWidth
          ? current
          : { ...current, settings: { ...current.settings, sidebarWidth: width } };
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void persistState(state);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ready, state]);

  useEffect(() => () => {
    if (manualSaveTimerRef.current !== null) {
      window.clearTimeout(manualSaveTimerRef.current);
    }
    findPanelPointerCleanupRef.current?.();
  }, []);

  useEffect(() => window.desktop?.onCreateNote(createNote), [createNote]);

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    document.title = language === "en" ? "ForeJot" : "驻笺";
  }, [language]);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop?.isMaximized || !desktop.onMaximizeChange) return;
    let active = true;
    void desktop.isMaximized().then((value) => active && setMaximized(value));
    const unsubscribe = desktop.onMaximizeChange(setMaximized);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "h") {
        event.preventDefault();
        toggleFindPanel();
        return;
      }
      if (findOpen && event.key === "Escape") {
        event.preventDefault();
        setFindOpen(false);
        bodyRef.current?.focus({ preventScroll: true });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "z") {
        event.preventDefault();
        undoLastChange();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === "s") {
        event.preventDefault();
        void saveImmediately();
        return;
      }
      if (
        state.settings.deleteWithBackspace
        && state.selectedId
        && !deleteId
        && (event.key === "Delete" || event.key === "Backspace")
        && !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        requestDelete(state.selectedId);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [deleteId, findOpen, ready, state.selectedId, state.settings.confirmBeforeDelete, state.settings.deleteWithBackspace]);

  const visibleNotes = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("zh-CN");
    if (!term) return state.notes;
    return state.notes.filter((note) => `${note.title} ${note.body}`.toLocaleLowerCase("zh-CN").includes(term));
  }, [query, state.notes]);

  const selected = state.notes.find((note) => note.id === state.selectedId) ?? null;
  const findMatches = useMemo(
    () => findTextMatches(selected?.body ?? "", findQuery, findCaseSensitive),
    [findCaseSensitive, findQuery, selected?.body],
  );
  const displayedMatchIndex = findMatches.length
    ? clamp(activeMatchIndex, 0, findMatches.length - 1)
    : -1;
  const activeFindMatch = displayedMatchIndex >= 0 ? findMatches[displayedMatchIndex] : null;
  const selectedFont = fonts.find((font) => font.id === state.settings.fontFamily) ?? fonts[0];
  const openExternalLink = useCallback((url: string | undefined) => {
    const safeUrl = externalHttpUrl(url);
    if (!safeUrl) return;
    void window.desktop?.openExternal(safeUrl);
  }, []);
  const markdownComponents = useMemo<Components>(() => ({
    img: ({ node: _node, src, ...props }) => (
      <img {...props} src={resolveAttachmentSource(src, state.attachments)} />
    ),
    a: ({ node: _node, href, ...props }) => (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          event.preventDefault();
          openExternalLink(href);
        }}
      />
    ),
  }), [openExternalLink, state.attachments]);

  useLayoutEffect(() => {
    const pending = pendingEditorRestoreRef.current;
    const textarea = bodyRef.current;
    if (!pending || !textarea) return;
    pendingEditorRestoreRef.current = null;
    textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(pending.selectionStart, pending.selectionEnd);
      textarea.scrollTop = pending.scrollTop;
      textarea.scrollLeft = pending.scrollLeft;
      syncFindHighlightScroll(textarea);
      window.requestAnimationFrame(() => {
        if (pendingEditorRestoreRef.current || bodyRef.current !== textarea) return;
        textarea.scrollTop = pending.scrollTop;
        textarea.scrollLeft = pending.scrollLeft;
        syncFindHighlightScroll(textarea);
      });
  }, [editorMode, selected?.body]);

  useLayoutEffect(() => {
    const match = pendingFindMatchRef.current;
    const textarea = bodyRef.current;
    if (!match || !textarea || editorMode !== "edit") return;
    pendingFindMatchRef.current = null;
    const preserveFindFocus = preserveFindInputFocusRef.current;
    preserveFindInputFocusRef.current = false;
    const selectAndReveal = () => {
      if (!preserveFindFocus) textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(match.start, match.end);
      revealTextareaMatch(textarea, match.start);
      syncFindHighlightScroll(textarea);
      if (preserveFindFocus) findInputRef.current?.focus({ preventScroll: true });
    };
    selectAndReveal();
    const frame = window.requestAnimationFrame(selectAndReveal);
    return () => window.cancelAnimationFrame(frame);
  }, [editorMode, findFocusToken, selected?.body]);

  useLayoutEffect(() => {
    const ratio = pendingModeScrollRatioRef.current;
    const target = editorMode === "edit" ? bodyRef.current : previewRef.current;
    if (ratio === null || !target) return;
    pendingModeScrollRatioRef.current = null;
    const restore = () => {
      const maximum = Math.max(0, target.scrollHeight - target.clientHeight);
      target.scrollTop = maximum * ratio;
      if (target instanceof HTMLTextAreaElement) syncFindHighlightScroll(target);
    };
    restore();
    window.requestAnimationFrame(restore);
  }, [editorMode]);

  useEffect(() => {
    if (!findOpen || !findQuery) {
      setActiveMatchIndex(-1);
      return;
    }
    const start = pendingFindStartRef.current ?? bodyRef.current?.selectionStart ?? 0;
    pendingFindStartRef.current = null;
    const nextIndex = findMatches.findIndex((match) => match.start >= start);
    focusFindMatch(nextIndex === -1 ? 0 : nextIndex, true);
  }, [findCaseSensitive, findOpen, findQuery, selected?.id]);

  useEffect(() => {
    const keepFindPanelVisible = () => {
      setFindPanelRect((current) => {
        if (!current) return current;
        const clamped = clampFindPanelRect(current);
        return clamped.left === current.left
          && clamped.top === current.top
          && clamped.width === current.width
          && clamped.height === current.height
          ? current
          : clamped;
      });
    };
    window.addEventListener("resize", keepFindPanelVisible);
    return () => window.removeEventListener("resize", keepFindPanelVisible);
  }, []);

  useLayoutEffect(() => {
    if (!findOpen || state.settings.sidebarCollapsed) return;
    const frame = window.requestAnimationFrame(() => {
      setFindPanelRect((current) => current ? clampFindPanelRect(current) : current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [findOpen, state.settings.sidebarCollapsed, state.settings.sidebarWidth]);

  const shellStyle = {
    "--app-font": selectedFont.family,
    "--content-font": contentFontFamily(selectedFont.family),
    "--surface-alpha": `${state.settings.opacity}%`,
    "--sidebar-width": `${state.settings.sidebarWidth}px`,
  } as CSSProperties;
  const findPanelStyle: CSSProperties | undefined = findPanelRect
    ? {
      left: `${findPanelRect.left}px`,
      top: `${findPanelRect.top}px`,
      width: `${findPanelRect.width}px`,
      height: `${findPanelRect.height}px`,
    }
    : undefined;

  function updateSelected(patch: Partial<Note>) {
    if (!state.selectedId) return;
    setState((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === current.selectedId ? { ...note, ...patch, color: "paper", updatedAt: Date.now() } : note,
      ),
    }));
  }

  function syncFindHighlightScroll(textarea = bodyRef.current) {
    const highlight = findHighlightRef.current;
    if (!textarea || !highlight) return;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = {
      ...selected,
      id: crypto.randomUUID(),
      title: language === "en"
        ? `${selected.title || "Untitled"} copy`
        : `${selected.title || "无标题"} 副本`,
      color: "paper" as const,
      updatedAt: Date.now(),
    };
    setState((current) => ({ ...current, notes: [copy, ...current.notes], selectedId: copy.id }));
  }

  function deleteNote(noteId: string, disableConfirmation = false) {
    setState((current) => {
      const notes = current.notes.filter((note) => note.id !== noteId);
      return {
        ...current,
        notes,
        selectedId: current.selectedId === noteId ? notes[0]?.id ?? null : current.selectedId,
        settings: disableConfirmation
          ? { ...current.settings, confirmBeforeDelete: false }
          : current.settings,
      };
    });
  }

  function requestDelete(noteId: string) {
    if (state.settings.confirmBeforeDelete) {
      setSkipDeleteConfirmation(false);
      setDeleteId(noteId);
      return;
    }
    deleteNote(noteId);
  }

  function closeDeleteDialog() {
    setDeleteId(null);
    setSkipDeleteConfirmation(false);
  }

  function confirmDelete() {
    if (!deleteId) return;
    deleteNote(deleteId, skipDeleteConfirmation);
    closeDeleteDialog();
  }

  function toggleFindPanel() {
    const nextOpen = !findOpen;
    setFindOpen(nextOpen);
    if (nextOpen) {
      if (state.settings.sidebarCollapsed) {
        updateSetting("sidebarCollapsed", false);
        setFindPanelRect(null);
      }
      changeEditorMode("edit");
      window.setTimeout(() => findInputRef.current?.focus({ preventScroll: true }));
    } else {
      bodyRef.current?.focus({ preventScroll: true });
    }
  }

  function clampFindPanelRect(rect: FindPanelRect) {
    const sidebarBounds = sidebarRef.current?.getBoundingClientRect();
    const containerWidth = sidebarBounds?.width || state.settings.sidebarWidth;
    const containerHeight = sidebarBounds?.height || window.innerHeight;
    const minimumWidth = Math.min(FIND_PANEL_MIN_WIDTH, Math.max(160, containerWidth));
    const minimumHeight = Math.min(FIND_PANEL_MIN_HEIGHT, Math.max(42, containerHeight));
    const width = clamp(rect.width, minimumWidth, Math.max(minimumWidth, containerWidth));
    const height = clamp(rect.height, minimumHeight, Math.max(minimumHeight, containerHeight));
    return {
      left: clamp(rect.left, 0, Math.max(0, containerWidth - width)),
      top: clamp(rect.top, 0, Math.max(0, containerHeight - height)),
      width,
      height,
    };
  }

  function readFindPanelRect(): FindPanelRect | null {
    const panelBounds = findPanelRef.current?.getBoundingClientRect();
    const sidebarBounds = sidebarRef.current?.getBoundingClientRect();
    if (!panelBounds || !sidebarBounds) return null;
    return clampFindPanelRect({
      left: panelBounds.left - sidebarBounds.left,
      top: panelBounds.top - sidebarBounds.top,
      width: panelBounds.width || Math.max(FIND_PANEL_MIN_WIDTH, sidebarBounds.width - 16),
      height: panelBounds.height || FIND_PANEL_MIN_HEIGHT,
    });
  }

  function beginFindPanelPointerAction(event: ReactPointerEvent<HTMLButtonElement>, mode: "move" | "resize") {
    if (event.button !== 0) return;
    const initial = readFindPanelRect();
    if (!initial) return;
    event.preventDefault();
    event.stopPropagation();
    findPanelPointerCleanupRef.current?.();
    setFindPanelRect(initial);

    const startX = event.clientX;
    const startY = event.clientY;
    const move = (pointerEvent: PointerEvent) => {
      const deltaX = pointerEvent.clientX - startX;
      const deltaY = pointerEvent.clientY - startY;
      const next = mode === "move"
        ? { ...initial, left: initial.left + deltaX, top: initial.top + deltaY }
        : { ...initial, width: initial.width + deltaX, height: initial.height + deltaY };
      setFindPanelRect(clampFindPanelRect(next));
    };
    const end = () => {
      findPanelPointerCleanupRef.current?.();
      findPanelPointerCleanupRef.current = null;
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    findPanelPointerCleanupRef.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function queueFindMatch(match: TextMatch | null, preserveFindFocus = false) {
    pendingFindMatchRef.current = match;
    preserveFindInputFocusRef.current = preserveFindFocus;
    setFindFocusToken((token) => token + 1);
  }

  function reorderNote(sourceId: string, targetId: string, position: "before" | "after") {
    if (sourceId === targetId) return;
    setState((current) => {
      const source = current.notes.find((note) => note.id === sourceId);
      if (!source) return current;
      const notes = current.notes.filter((note) => note.id !== sourceId);
      const targetIndex = notes.findIndex((note) => note.id === targetId);
      if (targetIndex === -1) return current;
      notes.splice(targetIndex + (position === "after" ? 1 : 0), 0, source);
      return { ...current, notes };
    });
  }

  function handleNoteDragStart(event: ReactDragEvent<HTMLButtonElement>, noteId: string) {
    draggedNoteIdRef.current = noteId;
    setDraggedNoteId(noteId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", noteId);
  }

  function handleNoteDragOver(event: ReactDragEvent<HTMLButtonElement>, noteId: string) {
    const sourceId = draggedNoteIdRef.current;
    if (!sourceId || sourceId === noteId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    setDropTarget((current) => (
      current?.id === noteId && current.position === position ? current : { id: noteId, position }
    ));
  }

  function clearNoteDrag() {
    draggedNoteIdRef.current = null;
    setDraggedNoteId(null);
    setDropTarget(null);
  }

  function handleNoteDrop(event: ReactDragEvent<HTMLButtonElement>, noteId: string) {
    event.preventDefault();
    const sourceId = draggedNoteIdRef.current || event.dataTransfer.getData("text/plain");
    const position = dropTarget?.id === noteId ? dropTarget.position : "before";
    if (sourceId) reorderNote(sourceId, noteId, position);
    clearNoteDrag();
  }

  async function toggleAlwaysOnTop() {
    const intended = !state.settings.alwaysOnTop;
    const actual = window.desktop ? await window.desktop.setAlwaysOnTop(intended) : intended;
    setState((current) => ({ ...current, settings: { ...current.settings, alwaysOnTop: actual } }));
  }

  async function toggleLaunchAtLogin() {
    const intended = !state.settings.launchAtLogin;
    const actual = window.desktop ? await window.desktop.setLaunchAtLogin(intended) : intended;
    setState((current) => ({ ...current, settings: { ...current.settings, launchAtLogin: actual } }));
  }

  async function toggleMaximize() {
    const actual = window.desktop ? await window.desktop.toggleMaximize() : !maximized;
    setMaximized(actual);
  }

  function updateSetting<K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) {
    if (key === "uiLanguage") {
      void window.desktop?.setUiLanguage(value as UiLanguage);
    }
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
        ...(key === "uiLanguage" ? { uiLanguageSource: "user" as const } : {}),
        ...(key === "fontFamily" ? { fontFamilySource: "user" as const } : {}),
      },
    }));
  }

  function persistState(value: AppState) {
    if (window.desktop) return window.desktop.saveState(value);
    localStorage.setItem("floating-notes-state", JSON.stringify(value));
    return Promise.resolve(true);
  }

  async function saveImmediately() {
    if (!ready) return;
    await persistState(stateRef.current);
    setManualSaveVisible(true);
    if (manualSaveTimerRef.current !== null) {
      window.clearTimeout(manualSaveTimerRef.current);
    }
    manualSaveTimerRef.current = window.setTimeout(() => {
      setManualSaveVisible(false);
      manualSaveTimerRef.current = null;
    }, 1600);
  }

  function undoLastChange() {
    const previous = historyRef.current.pop();
    if (!previous) return;
    undoingRef.current = true;
    setState({
      ...previous,
      settings: {
        ...previous.settings,
        confirmBeforeDelete: stateRef.current.settings.confirmBeforeDelete,
      },
    });
  }

  async function exportCurrentNote() {
    if (!selected) return;
    const hydratedMarkdown = hydrateImageReferences(selected.body, state.attachments);
    const assets = collectImageAssets(hydratedMarkdown, language);
    const emptyMarkup = `<p>${ui("这张便签还没有正文", "This note has no content yet")}</p>`;
    const fallbackTitle = ui("驻笺便签", "ForeJot note");
    flushSync(() => setExportSourceVisible(true));
    const markup = exportSourceRef.current?.innerHTML ?? emptyMarkup;
    flushSync(() => setExportSourceVisible(false));
    const request: ExportRequest = {
      format: state.settings.exportFormat,
      title: selected.title || fallbackTitle,
      html: buildExportHtml(selected.title || fallbackTitle, markup, selectedFont.family, language),
      markdown: buildPortableMarkdown(hydratedMarkdown, assets),
      latex: buildLatex(selected.title || fallbackTitle, hydratedMarkdown, assets),
      assets,
    };
    if (window.desktop) {
      await window.desktop.exportFile(request);
      return;
    }
    if (request.format === "pdf") {
      window.print();
      return;
    }
    const extension = request.format === "word" ? "doc" : request.format === "markdown" ? "md" : request.format;
    const content = request.format === "markdown" ? request.markdown : request.html;
    const mimeType = request.format === "markdown"
      ? "text/markdown"
      : request.format === "html"
        ? "text/html"
        : "application/msword";
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${request.title}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function replaceBodyRange(start: number, end: number, text: string, selectionStart: number, selectionEnd: number) {
    if (!selected) return;
    const textarea = bodyRef.current;
    pendingEditorRestoreRef.current = {
      selectionStart: start + selectionStart,
      selectionEnd: start + selectionEnd,
      scrollTop: textarea?.scrollTop ?? 0,
      scrollLeft: textarea?.scrollLeft ?? 0,
    };
    updateSelected({ body: `${selected.body.slice(0, start)}${text}${selected.body.slice(end)}` });
  }

  function replaceEditorSelection(text: string, selectionStart: number, selectionEnd: number) {
    if (!selected) return;
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? selected.body.length;
    const end = textarea?.selectionEnd ?? start;
    replaceBodyRange(start, end, text, selectionStart, selectionEnd);
  }

  function insertBlock(opening: string, closing: string, placeholder: string) {
    if (!selected) return;
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? selected.body.length;
    const end = textarea?.selectionEnd ?? start;
    const chosen = selected.body.slice(start, end) || placeholder;
    const before = selected.body.slice(0, start);
    const after = selected.body.slice(end);
    const leading = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const trailing = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
    const block = `${leading}${opening}\n${chosen}\n${closing}${trailing}`;
    const contentStart = leading.length + opening.length + 1;
    replaceEditorSelection(block, contentStart, contentStart + chosen.length);
  }

  function changeEditorMode(nextMode: "edit" | "preview") {
    if (nextMode === editorMode) return;
    const source = editorMode === "edit" ? bodyRef.current : previewRef.current;
    if (source) {
      const maximum = Math.max(0, source.scrollHeight - source.clientHeight);
      pendingModeScrollRatioRef.current = maximum > 0 ? source.scrollTop / maximum : 0;
    }
    setEditorMode(nextMode);
  }

  function runEditorAction(action: () => void) {
    if (editorMode === "edit") {
      action();
      return;
    }
    changeEditorMode("edit");
    window.setTimeout(action);
  }

  function getSelectionRange() {
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? selected?.body.length ?? 0;
    const end = textarea?.selectionEnd ?? start;
    return { start, end };
  }

  function applyHeadingLevel(level: number) {
    if (!selected) return;
    const { start, end } = getSelectionRange();
    const lineStart = selected.body.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = selected.body.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? selected.body.length : lineEndIndex;
    const lines = selected.body.slice(lineStart, lineEnd).split("\n");
    const prefix = level > 0 ? `${"#".repeat(level)} ` : "";
    const replacement = lines
      .map((line) => `${prefix}${line.replace(/^\s{0,3}#{1,6}(?:\s+|$)/, "")}`)
      .join("\n");
    replaceBodyRange(lineStart, lineEnd, replacement, 0, replacement.length);
  }

  function applyCenterAlignment() {
    if (!selected) return;
    const { start, end } = getSelectionRange();
    const lineStart = selected.body.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = selected.body.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? selected.body.length : lineEndIndex;
    const replacement = toggleCenterMarkers(selected.body.slice(lineStart, lineEnd));
    replaceBodyRange(lineStart, lineEnd, replacement, start - lineStart, start - lineStart + replacement.length);
  }

  function focusFindMatch(index: number, preserveFindFocus = false) {
    if (!findMatches.length || index < 0) {
      setActiveMatchIndex(-1);
      return;
    }
    const normalizedIndex = (index + findMatches.length) % findMatches.length;
    const match = findMatches[normalizedIndex];
    setActiveMatchIndex(normalizedIndex);
    queueFindMatch(match, preserveFindFocus);
    if (editorMode !== "edit") changeEditorMode("edit");
  }

  function navigateFind(direction: -1 | 1) {
    if (!findMatches.length) {
      setActiveMatchIndex(-1);
      return;
    }
    if (activeMatchIndex === -1) {
      focusFindMatch(direction === 1 ? 0 : findMatches.length - 1);
      return;
    }
    focusFindMatch(activeMatchIndex + direction);
  }

  function replaceCurrentFindMatch() {
    if (!selected || !findMatches.length) return;
    const index = activeMatchIndex >= 0 && activeMatchIndex < findMatches.length ? activeMatchIndex : 0;
    const match = findMatches[index];
    const nextBody = `${selected.body.slice(0, match.start)}${replacementText}${selected.body.slice(match.end)}`;
    const nextMatches = findTextMatches(nextBody, findQuery, findCaseSensitive);
    const nextStart = match.start + replacementText.length;
    const nextIndex = nextMatches.findIndex((candidate) => candidate.start >= nextStart);
    queueFindMatch(nextIndex === -1 ? null : nextMatches[nextIndex]);
    setActiveMatchIndex(nextIndex);
    updateSelected({ body: nextBody });
    if (nextIndex === -1) {
      window.requestAnimationFrame(() => {
        const textarea = bodyRef.current;
        if (!textarea) return;
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(match.start, match.start + replacementText.length);
      });
    }
  }

  function replaceAllFindMatches() {
    if (!selected || !findMatches.length) return;
    let cursor = 0;
    let nextBody = "";
    for (const match of findMatches) {
      nextBody += selected.body.slice(cursor, match.start) + replacementText;
      cursor = match.end;
    }
    nextBody += selected.body.slice(cursor);
    setActiveMatchIndex(-1);
    queueFindMatch(null);
    updateSelected({ body: nextBody });
    bodyRef.current?.focus({ preventScroll: true });
  }

  function applyInlineWrapper(
    opening: string,
    closing: string,
    wrappedPattern: RegExp,
    openingPattern: RegExp,
    closingPattern: RegExp,
  ) {
    if (!selected) return;
    const { start, end } = getSelectionRange();
    if (start === end) {
      bodyRef.current?.focus({ preventScroll: true });
      return;
    }

    const body = selected.body;
    const selectedText = body.slice(start, end);
    const fullyWrapped = selectedText.match(wrappedPattern);
    if (fullyWrapped) {
      const inner = fullyWrapped[1];
      replaceBodyRange(start, end, `${opening}${inner}${closing}`, opening.length, opening.length + inner.length);
      return;
    }

    const prefix = body.slice(0, start);
    const suffix = body.slice(end);
    const existingOpening = prefix.match(openingPattern)?.[0];
    const existingClosing = suffix.match(closingPattern)?.[0];
    if (existingOpening && existingClosing) {
      replaceBodyRange(
        start - existingOpening.length,
        end + existingClosing.length,
        `${opening}${selectedText}${closing}`,
        opening.length,
        opening.length + selectedText.length,
      );
      return;
    }

    replaceBodyRange(start, end, `${opening}${selectedText}${closing}`, opening.length, opening.length + selectedText.length);
  }

  function applyFontSize(sizeId: BodyFontSize) {
    const size = bodyFontSizes.find((item) => item.id === sizeId);
    if (!size) return;
    applyInlineWrapper(
      `<span style="font-size:${size.value}">`,
      "</span>",
      /^<span\s+style=(?:"font-size:\s*[^"]+"|'font-size:\s*[^']+')>([\s\S]*)<\/span>$/i,
      /<span\s+style=(?:"font-size:\s*[^"]+"|'font-size:\s*[^']+')>$/i,
      /^<\/span>/i,
    );
  }

  function applyFontFamily(fontId: AppFont) {
    const font = fonts.find((item) => item.id === fontId);
    if (!font) return;
    applyInlineWrapper(
      `<font face="${escapeHtml(font.inlineFamily)}">`,
      "</font>",
      /^<font\s+face=(?:"[^"]*"|'[^']*')>([\s\S]*)<\/font>$/i,
      /<font\s+face=(?:"[^"]*"|'[^']*')>$/i,
      /^<\/font>/i,
    );
  }

  function unwrapSelected(pattern: RegExp) {
    if (!selected) return false;
    const { start, end } = getSelectionRange();
    const match = selected.body.slice(start, end).match(pattern);
    if (!match) return false;
    replaceBodyRange(start, end, match[1], 0, match[1].length);
    return true;
  }

  function toggleInlineFormat(format: "bold" | "italic" | "underline") {
    if (!selected) return;
    const { start, end } = getSelectionRange();
    const body = selected.body;
    const selectedText = body.slice(start, end);
    const wrappers = format === "bold"
      ? [["**", "**"]]
      : format === "underline"
        ? [["<u>", "</u>"]]
        : [["*", "*"], ["**", "*"], ["*", "**"]];

    for (const [opening, closing] of wrappers) {
      const before = body.slice(Math.max(0, start - opening.length), start);
      const after = body.slice(end, end + closing.length);
      const openingIsSingleStar = opening === "*" && body[start - 2] === "*";
      const closingIsSingleStar = closing === "*" && body[end + 1] === "*";
      if (before === opening && after === closing && !openingIsSingleStar && !closingIsSingleStar) {
        replaceBodyRange(start - opening.length, end + closing.length, selectedText, 0, selectedText.length);
        return;
      }
    }

    const patterns = format === "bold"
      ? /^\*\*([\s\S]+)\*\*$/
      : format === "underline"
        ? /^<u>([\s\S]+)<\/u>$/i
        : /^(?:\*\*([\s\S]+)\*|\*([\s\S]+)\*\*|\*([\s\S]+)\*)$/;
    if (format === "italic") {
      const match = selectedText.match(patterns);
      const inner = match?.[1] ?? match?.[2] ?? match?.[3];
      if (inner) {
        replaceBodyRange(start, end, inner, 0, inner.length);
        return;
      }
    } else if (unwrapSelected(patterns)) {
      return;
    }

    const inner = selectedText || "文本";
    const [opening, closing] = wrappers[0];
    const wrapped = `${opening}${inner}${closing}`;
    replaceBodyRange(start, end, wrapped, opening.length, opening.length + inner.length);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!event.ctrlKey) return;
    const key = event.key.toLocaleLowerCase();
    if (event.shiftKey && key === "k") {
      event.preventDefault();
      insertBlock("```", "```", ui("在这里输入代码", "Enter code here"));
    } else if (event.shiftKey && key === "m") {
      event.preventDefault();
      insertBlock("$$", "$$", "E = mc^2");
    } else if (!event.shiftKey && ["0", "1", "2", "3", "4", "5"].includes(key)) {
      event.preventDefault();
      applyHeadingLevel(Number(key));
    } else if (!event.shiftKey && key === "b") {
      event.preventDefault();
      toggleInlineFormat("bold");
    } else if (!event.shiftKey && key === "i") {
      event.preventDefault();
      toggleInlineFormat("italic");
    } else if (!event.shiftKey && key === "u") {
      event.preventDefault();
      toggleInlineFormat("underline");
    } else if (!event.shiftKey && key === "e") {
      event.preventDefault();
      applyCenterAlignment();
    }
  }

  function insertImageFile(file: File) {
    if (!/^image\/(?:png|jpeg|gif|webp|bmp|svg\+xml|avif)$/i.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const fileName = (file.name.replace(/\.[^.]+$/, "") || "图片").replace(/[\[\]\r\n]/g, " ").trim() || "图片";
      let id = makeAttachmentId();
      while (stateRef.current.attachments[id]) id = makeAttachmentId();
      const attachment: NoteAttachment = {
        id,
        name: fileName,
        mimeType: file.type,
        dataUrl: reader.result,
      };
      const markdown = `![${fileName}](${NOTE_ASSET_PREFIX}${id})`;
      setState((current) => ({
        ...current,
        attachments: { ...current.attachments, [id]: attachment },
      }));
      runEditorAction(() => replaceEditorSelection(markdown, 0, markdown.length));
    };
    reader.readAsDataURL(file);
  }

  function handleImageChoice(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) insertImageFile(file);
    event.target.value = "";
  }

  async function handleMarkdownChoice(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let imported: MarkdownImportResult | null = null;
    if (window.desktop?.importMarkdownFile) {
      try {
        const result = await window.desktop.importMarkdownFile(file);
        if (result && typeof result.body === "string" && result.attachments && typeof result.attachments === "object") {
          imported = result;
        }
      } catch {
        // Browser fallback keeps the source Markdown intact when an attachment cannot be imported.
      }
    }
    if (!imported) imported = { body: await file.text(), attachments: {} };
    const now = Date.now();
    const title = file.name.replace(/\.md$/i, "").trim() || ui("导入的便签", "Imported note");
    const note: Note = {
      id: crypto.randomUUID(),
      title,
      body: imported.body,
      color: "paper",
      createdAt: now,
      updatedAt: now,
    };
    setState((current) => ({
      ...current,
      notes: [note, ...current.notes],
      attachments: { ...current.attachments, ...imported.attachments },
      selectedId: note.id,
    }));
    setQuery("");
    changeEditorMode("edit");
  }

  function insertStandaloneMarkdown(markdown: string) {
    if (!selected) return;
    const { start, end } = getSelectionRange();
    const before = selected.body.slice(0, start);
    const after = selected.body.slice(end);
    const leading = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const trailing = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
    const insertion = `${leading}${markdown}${trailing}`;
    replaceEditorSelection(insertion, leading.length, leading.length + markdown.length);
  }

  async function pasteClipboardTable() {
    let clipboardText = "";
    try {
      clipboardText = window.desktop?.readClipboardText
        ? await window.desktop.readClipboardText()
        : await navigator.clipboard.readText();
    } catch {
      return;
    }
    const table = clipboardTextToMarkdownTable(clipboardText);
    if (table) runEditorAction(() => insertStandaloneMarkdown(table));
  }

  function getSidebarMaxWidth() {
    const measured = workspaceRef.current?.getBoundingClientRect().width ?? 0;
    const available = measured > 0 ? measured : window.innerWidth;
    const editorMinimum = available <= 560 ? 170 : 240;
    return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, available - editorMinimum));
  }

  function resizeSidebar(clientX: number) {
    const left = workspaceRef.current?.getBoundingClientRect().left ?? 0;
    updateSetting("sidebarWidth", clamp(Math.round(clientX - left), SIDEBAR_MIN, getSidebarMaxWidth()));
  }

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    resizingRef.current = true;
    setResizingSidebar(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeSidebar(event.clientX);
  }

  function moveSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizingRef.current) resizeSidebar(event.clientX);
  }

  function stopSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    resizingRef.current = false;
    setResizingSidebar(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleSidebarResizeKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.shiftKey ? 32 : 12;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    updateSetting("sidebarWidth", clamp(state.settings.sidebarWidth + direction * step, SIDEBAR_MIN, getSidebarMaxWidth()));
  }

  return (
    <main className="app-shell" style={shellStyle}>
      <header className="titlebar">
        <div className="brand" aria-label={ui("驻笺", "ForeJot")}>
          <span className="brand-mark" aria-hidden="true">
            <BookOpen size={15} strokeWidth={2.1} />
            <PenLine className="brand-pen" size={10} strokeWidth={2.4} />
          </span>
          <span>{ui("驻笺", "ForeJot")}</span>
        </div>
        <div className="drag-space" onDoubleClick={() => void toggleMaximize()} />
        <button
          className={`title-action pin-button ${state.settings.alwaysOnTop ? "is-active" : ""}`}
          onClick={toggleAlwaysOnTop}
          title={state.settings.alwaysOnTop ? ui("取消始终置顶", "Turn off always on top") : ui("始终置顶", "Always on top")}
          aria-pressed={state.settings.alwaysOnTop}
        >
          {state.settings.alwaysOnTop ? <Pin size={15} /> : <PinOff size={15} />}
          <span>{state.settings.alwaysOnTop ? ui("已置顶", "Pinned") : ui("置顶", "Pin")}</span>
        </button>
        <button className="title-action icon-only" onClick={() => window.desktop?.minimize()} title={ui("最小化", "Minimize")} aria-label={ui("最小化", "Minimize")}>
          <Minus size={16} />
        </button>
        <button className="title-action icon-only" onClick={() => void toggleMaximize()} title={maximized ? ui("向下还原", "Restore") : ui("最大化", "Maximize")} aria-label={maximized ? ui("向下还原", "Restore") : ui("最大化", "Maximize")}>
          {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button className="title-action icon-only close-button" onClick={() => window.desktop?.hide()} title={ui("隐藏到托盘", "Hide to tray")} aria-label={ui("隐藏到托盘", "Hide to tray")}>
          <X size={16} />
        </button>
      </header>

      <section
        ref={workspaceRef}
        className={`workspace ${state.settings.sidebarCollapsed ? "sidebar-collapsed" : ""} ${resizingSidebar ? "is-resizing" : ""}`}
      >
        <aside ref={sidebarRef} className="sidebar">
          {state.settings.sidebarCollapsed ? (
            <div className="collapsed-sidebar-tools window-drag-region">
              <button
                onClick={() => updateSetting("sidebarCollapsed", false)}
                title={ui("展开便签目录", "Expand notes list")}
                aria-label={ui("展开便签目录", "Expand notes list")}
              >
                <PanelLeftOpen size={18} />
              </button>
              <button onClick={createNote} title={ui("新建便签", "New note")} aria-label={ui("新建便签", "New note")}>
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <>
              <div className="sidebar-head">
                <div>
                  <p className="eyebrow">{ui("我的便签", "My notes")}</p>
                  <strong>{state.notes.length}</strong>
                </div>
                <div className="sidebar-head-actions">
                  <button
                    className="sidebar-collapse"
                    onClick={() => updateSetting("sidebarCollapsed", true)}
                    title={ui("折叠便签目录", "Collapse notes list")}
                    aria-label={ui("折叠便签目录", "Collapse notes list")}
                  >
                    <PanelLeftClose size={17} />
                  </button>
                  <button className="primary-icon" onClick={createNote} title={ui("新建便签 (Ctrl+Alt+N)", "New note (Ctrl+Alt+N)")} aria-label={ui("新建便签", "New note")}>
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <label className="search-box">
                <Search size={15} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui("搜索便签", "Search notes")} aria-label={ui("搜索便签", "Search notes")} />
                {query && <button onClick={() => setQuery("")} title={ui("清空搜索", "Clear search")} aria-label={ui("清空搜索", "Clear search")}><X size={14} /></button>}
              </label>

              <div className="find-panel-slot">
                {findOpen && (
                  <section
                  ref={findPanelRef}
                  className={`find-panel ${replaceMode ? "is-replacing" : ""} ${findPanelRect ? "is-positioned" : ""}`}
                  style={findPanelStyle}
                  aria-label={ui("查找与替换", "Find and replace")}
                >
                  <button
                    type="button"
                    className="find-panel-drag-handle"
                    onPointerDown={(event) => beginFindPanelPointerAction(event, "move")}
                    title={ui("拖动查找面板", "Move find panel")}
                    aria-label={ui("拖动查找面板", "Move find panel")}
                  >
                    <GripVertical size={13} />
                  </button>
                  <div className="find-panel-header">
                    <button
                      className="find-mode-button"
                      onClick={() => setReplaceMode((visible) => !visible)}
                      aria-expanded={replaceMode}
                      title={ui("显示或隐藏替换栏", "Show or hide replace row")}
                    >
                      <span>{replaceMode ? ui("替换", "Replace") : ui("查找", "Find")}</span>
                      <ChevronDown size={13} className={replaceMode ? "rotate" : ""} />
                    </button>
                    <span className="find-count" aria-live="polite">
                      {findMatches.length
                        ? `${displayedMatchIndex + 1} / ${findMatches.length}`
                        : "0 / 0"}
                    </span>
                    <button onClick={() => setFindOpen(false)} title={ui("关闭查找", "Close find")} aria-label={ui("关闭查找", "Close find")}><X size={16} /></button>
                  </div>
                  <div className="find-panel-row find-search-row">
                    <div className="find-input-wrap">
                      <input
                        ref={findInputRef}
                        value={findQuery}
                        onChange={(event) => {
                          pendingFindStartRef.current = 0;
                          setFindQuery(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            navigateFind(event.shiftKey ? -1 : 1);
                          }
                        }}
                        placeholder={ui("查找", "Find")}
                        aria-label={ui("查找内容", "Find text")}
                      />
                      <button
                        className={findCaseSensitive ? "is-active" : ""}
                        onClick={() => {
                          pendingFindStartRef.current = 0;
                          setFindCaseSensitive((active) => !active);
                        }}
                        title={ui("区分大小写", "Match case")}
                        aria-label={ui("区分大小写", "Match case")}
                        aria-pressed={findCaseSensitive}
                      >
                        <CaseSensitive size={15} />
                      </button>
                    </div>
                    <button onClick={() => navigateFind(-1)} title={ui("查找上一处", "Previous match")} aria-label={ui("查找上一处", "Previous match")}><ArrowUp size={16} /></button>
                    <button onClick={() => navigateFind(1)} title={ui("查找下一处", "Next match")} aria-label={ui("查找下一处", "Next match")}><ArrowDown size={16} /></button>
                  </div>
                  {replaceMode && (
                    <div className="find-panel-row replace-row">
                      <input
                        value={replacementText}
                        onChange={(event) => setReplacementText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            replaceCurrentFindMatch();
                          }
                        }}
                        placeholder={ui("替换为", "Replace with")}
                        aria-label={ui("替换内容", "Replacement text")}
                      />
                      <button className="replace-text-button" onClick={replaceAllFindMatches}>{ui("全部", "All")}</button>
                      <button className="replace-text-button" onClick={replaceCurrentFindMatch}>{ui("替换", "Replace")}</button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="find-resize-handle"
                    onPointerDown={(event) => beginFindPanelPointerAction(event, "resize")}
                    title={ui("调整查找面板大小", "Resize find panel")}
                    aria-label={ui("调整查找面板大小", "Resize find panel")}
                  >
                    <Grip size={12} />
                  </button>
                  </section>
                )}
              </div>

              <div className="note-list" aria-label={ui("便签列表", "Notes list")}>
                {visibleNotes.map((note) => (
                  <button
                    key={note.id}
                    className={`note-row ${note.id === state.selectedId ? "is-selected" : ""} ${draggedNoteId === note.id ? "is-dragging" : ""} ${dropTarget?.id === note.id ? `drop-${dropTarget.position}` : ""}`}
                    draggable
                    data-note-id={note.id}
                    title={ui("拖动调整顺序，右键删除", "Drag to reorder; right-click to delete")}
                    onClick={() => setState((current) => ({ ...current, selectedId: note.id }))}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      requestDelete(note.id);
                    }}
                    onDragStart={(event) => handleNoteDragStart(event, note.id)}
                    onDragOver={(event) => handleNoteDragOver(event, note.id)}
                    onDrop={(event) => handleNoteDrop(event, note.id)}
                    onDragEnd={clearNoteDrag}
                  >
                    <span className="color-stripe" />
                    <span className="note-row-copy">
                      <strong>{note.title.trim() || ui("无标题", "Untitled")}</strong>
                      <span>{noteSummary(note.body) || ui("空白便签", "Empty note")}</span>
                    </span>
                    <time>{formatTime(note.updatedAt, language)}</time>
                  </button>
                ))}
                {visibleNotes.length === 0 && (
                  <div className="empty-list">
                    <Search size={20} />
                    <p>{ui("没有找到相关便签", "No matching notes")}</p>
                  </div>
                )}
              </div>

              <div className="sidebar-footer">
                <button className="settings-trigger" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}>
                  <Settings size={16} />
                  <span>{ui("偏好设置", "Preferences")}</span>
                  <ChevronDown size={14} className={settingsOpen ? "rotate" : ""} />
                </button>
                {settingsOpen && (
                  <div className="settings-popover">
                    <label className="settings-field settings-language-field">
                      <span><strong>{ui("页面语言", "Interface language")}</strong><small>{ui("只切换软件界面文字", "Changes application controls only")}</small></span>
                      <select
                        aria-label={ui("页面语言", "Interface language")}
                        value={state.settings.uiLanguage}
                        onChange={(event) => updateSetting("uiLanguage", event.target.value as UiLanguage)}
                      >
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label className="settings-row">
                      <span><strong>{ui("开机自动启动", "Launch at startup")}</strong><small>{ui("登录 Windows 后显示驻笺", "Show ForeJot after signing in")}</small></span>
                      <input type="checkbox" checked={state.settings.launchAtLogin} onChange={toggleLaunchAtLogin} />
                    </label>
                    <label className="settings-field">
                      <span><strong>{ui("字体", "Font")}</strong><small>{ui("便签与界面文字", "Notes and interface text")}</small></span>
                      <select
                        aria-label={ui("字体", "Font")}
                        value={state.settings.fontFamily}
                        onChange={(event) => updateSetting("fontFamily", event.target.value as AppFont)}
                      >
                        {fonts.map((font) => <option key={font.id} value={font.id}>{language === "en" ? font.labelEn : font.label}</option>)}
                      </select>
                    </label>
                    <label className="settings-field opacity-field">
                      <span><strong>{ui("背景透明度", "Background opacity")}</strong><small>{state.settings.opacity}%</small></span>
                      <input
                        aria-label={ui("背景透明度", "Background opacity")}
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={state.settings.opacity}
                        onChange={(event) => updateSetting("opacity", Number(event.target.value))}
                      />
                    </label>
                    <label className="settings-row settings-delete-row">
                      <span><strong>{ui("Delete / Backspace 删除", "Delete with Delete / Backspace")}</strong><small>{ui("删除前会弹出确认窗口", "Shows confirmation before deletion")}</small></span>
                      <input
                        aria-label={ui("Delete / Backspace 删除", "Delete with Delete / Backspace")}
                        type="checkbox"
                        checked={state.settings.deleteWithBackspace}
                        onChange={(event) => updateSetting("deleteWithBackspace", event.target.checked)}
                      />
                    </label>
                    <label className="settings-row settings-confirm-row">
                      <span><strong>{ui("删除前确认", "Confirm before deleting")}</strong><small>{ui("关闭后删除便签将不再弹窗", "Turn off to delete without prompting")}</small></span>
                      <input
                        aria-label={ui("删除前确认", "Confirm before deleting")}
                        type="checkbox"
                        checked={state.settings.confirmBeforeDelete}
                        onChange={(event) => updateSetting("confirmBeforeDelete", event.target.checked)}
                      />
                    </label>
                    <label className="settings-field">
                      <span><strong>{ui("导出格式", "Export format")}</strong><small>{ui("选择当前便签的文件格式", "Choose the current note file format")}</small></span>
                      <select
                        aria-label={ui("导出格式", "Export format")}
                        value={state.settings.exportFormat}
                        onChange={(event) => updateSetting("exportFormat", event.target.value as ExportFormat)}
                      >
                        {exportFormats.map((format) => <option key={format.id} value={format.id}>{language === "en" ? format.labelEn : format.label}</option>)}
                      </select>
                    </label>
                    <button className="settings-export-button" onClick={() => void exportCurrentNote()}>
                      <Download size={14} />
                      <span>{ui("导出当前便签", "Export current note")}</span>
                    </button>
                    <div className="settings-shortcuts" aria-label={ui("快捷键", "Shortcuts")}>
                      <div><span>{ui("新建", "New")}</span><kbd>Ctrl + Alt + N</kbd></div>
                      <div><span>{ui("保存", "Save")}</span><kbd>Ctrl + S</kbd></div>
                      <div><span>{ui("撤销", "Undo")}</span><kbd>Ctrl + Z</kbd></div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        {!state.settings.sidebarCollapsed && (
          <div
            className="sidebar-resizer"
            role="separator"
            aria-label={ui("调整便签目录宽度", "Resize notes list")}
            aria-orientation="vertical"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={state.settings.sidebarWidth}
            tabIndex={0}
            onPointerDown={startSidebarResize}
            onPointerMove={moveSidebarResize}
            onPointerUp={stopSidebarResize}
            onPointerCancel={stopSidebarResize}
            onKeyDown={handleSidebarResizeKey}
          />
        )}

        <section className="editor-panel">
          {selected ? (
            <>
              <div className="editor-toolbar">
                <div className="editor-tools">
                  <div className="mode-switch" role="tablist" aria-label={ui("正文视图", "Note view")}>
                    <button role="tab" aria-selected={editorMode === "edit"} className={editorMode === "edit" ? "is-selected" : ""} onClick={() => changeEditorMode("edit")} title={ui("编辑", "Edit")}>
                      <Pencil size={14} /><span>{ui("编辑", "Edit")}</span>
                    </button>
                    <button role="tab" aria-selected={editorMode === "preview"} className={editorMode === "preview" ? "is-selected" : ""} onClick={() => changeEditorMode("preview")} title={ui("预览", "Preview")}>
                      <Eye size={14} /><span>{ui("预览", "Preview")}</span>
                    </button>
                  </div>
                  <label className="heading-control" title={ui("标题层级（Ctrl+0 至 Ctrl+5）", "Heading level (Ctrl+0 to Ctrl+5)")}>
                    <Heading size={15} />
                    <select
                      aria-label={ui("标题级别", "Heading level")}
                      defaultValue="0"
                      onChange={(event) => {
                        const level = Number(event.target.value);
                        runEditorAction(() => applyHeadingLevel(level));
                        event.currentTarget.value = "0";
                      }}
                    >
                      <option value="0">{ui("正文", "Paragraph")}</option>
                      <option value="1">{ui("标题 1", "Heading 1")}</option>
                      <option value="2">{ui("标题 2", "Heading 2")}</option>
                      <option value="3">{ui("标题 3", "Heading 3")}</option>
                      <option value="4">{ui("标题 4", "Heading 4")}</option>
                      <option value="5">{ui("标题 5", "Heading 5")}</option>
                    </select>
                  </label>
                  <label className="heading-control font-size-control" title={ui("字号（仅作用于选中文字）", "Font size (selected text only)")}>
                    <ALargeSmall size={15} />
                    <select
                      aria-label={ui("选中文字的字号", "Selected text font size")}
                      defaultValue=""
                      onChange={(event) => {
                        const size = event.target.value as BodyFontSize;
                        runEditorAction(() => applyFontSize(size));
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="" disabled>{ui("字号", "Size")}</option>
                      {bodyFontSizes.map((size) => <option key={size.id} value={size.id}>{language === "en" ? size.labelEn : size.label}</option>)}
                    </select>
                  </label>
                  <label className="heading-control font-family-control" title={ui("字体（仅作用于选中文字）", "Font (selected text only)")}>
                    <Type size={15} />
                    <select
                      aria-label={ui("选中文字的字体", "Selected text font")}
                      defaultValue=""
                      onChange={(event) => {
                        const font = event.target.value as AppFont;
                        runEditorAction(() => applyFontFamily(font));
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="" disabled>{ui("字体", "Font")}</option>
                      {fonts.map((font) => <option key={font.id} value={font.id}>{language === "en" ? font.labelEn : font.label}</option>)}
                    </select>
                  </label>
                  <div className="format-actions">
                    <div className="inline-format-actions" aria-label={ui("文字格式", "Text formatting")}>
                      <button onClick={() => runEditorAction(() => toggleInlineFormat("bold"))} title={ui("加粗 (Ctrl+B)", "Bold (Ctrl+B)")} aria-label={ui("加粗", "Bold")}><Bold size={16} /></button>
                      <button onClick={() => runEditorAction(() => toggleInlineFormat("italic"))} title={ui("斜体 (Ctrl+I)", "Italic (Ctrl+I)")} aria-label={ui("斜体", "Italic")}><Italic size={16} /></button>
                      <button onClick={() => runEditorAction(() => toggleInlineFormat("underline"))} title={ui("下划线 (Ctrl+U)", "Underline (Ctrl+U)")} aria-label={ui("下划线", "Underline")}><Underline size={16} /></button>
                      <button onClick={() => runEditorAction(applyCenterAlignment)} title={ui("居中 (Ctrl+E)", "Center (Ctrl+E)")} aria-label={ui("居中", "Center")}><AlignCenter size={16} /></button>
                    </div>
                    <button onClick={() => runEditorAction(() => insertBlock("```", "```", ui("在这里输入代码", "Enter code here")))} title={ui("代码块 (Ctrl+Shift+K)", "Code block (Ctrl+Shift+K)")} aria-label={ui("插入代码块", "Insert code block")}><Code2 size={16} /></button>
                    <button onClick={() => runEditorAction(() => insertBlock("$$", "$$", "E = mc^2"))} title={ui("公式块 (Ctrl+Shift+M)", "Math block (Ctrl+Shift+M)")} aria-label={ui("插入公式块", "Insert math block")}><Sigma size={16} /></button>
                    <button onClick={() => void pasteClipboardTable()} title={ui("粘贴剪贴板表格", "Paste clipboard table")} aria-label={ui("粘贴剪贴板表格", "Paste clipboard table")}><Table2 size={16} /></button>
                    <button onClick={() => imageInputRef.current?.click()} title={ui("插入图片", "Insert image")} aria-label={ui("插入图片", "Insert image")}><ImagePlus size={16} /></button>
                    <button onClick={() => markdownInputRef.current?.click()} title={ui("导入 Markdown 文件", "Import Markdown file")} aria-label={ui("导入 Markdown 文件", "Import Markdown file")}><Upload size={16} /></button>
                    <button onClick={toggleFindPanel} title={ui("查找与替换 (Ctrl+H)", "Find and replace (Ctrl+H)")} aria-label={ui("查找与替换", "Find and replace")}><Search size={16} /></button>
                    <input
                      ref={imageInputRef}
                      className="visually-hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                      aria-label={ui("插入图片文件", "Insert image file")}
                      onChange={handleImageChoice}
                    />
                    <input
                      ref={markdownInputRef}
                      className="visually-hidden"
                      type="file"
                      accept=".md,text/markdown,text/plain"
                      aria-label={ui("选择 Markdown 文件", "Choose Markdown file")}
                      onChange={handleMarkdownChoice}
                    />
                  </div>
                </div>
                <div className="editor-actions">
                  <button onClick={duplicateSelected} title={ui("复制便签", "Duplicate note")} aria-label={ui("复制便签", "Duplicate note")}><Copy size={16} /></button>
                  <button onClick={() => requestDelete(selected.id)} title={ui("删除便签", "Delete note")} aria-label={ui("删除便签", "Delete note")}><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="editor-content">
                <input
                  ref={titleRef}
                  className="title-input"
                  value={selected.title}
                  onChange={(event) => updateSelected({ title: event.target.value })}
                  placeholder={ui("便签标题", "Note title")}
                  maxLength={80}
                  aria-label={ui("便签标题", "Note title")}
                />
                <p className="save-status" title={ui("Ctrl+S 立即保存", "Ctrl+S to save now")}>
                  <Check size={13} /> {manualSaveVisible ? ui("已立即保存", "Saved now") : ui("已自动保存", "Autosaved")} · {formatTime(selected.updatedAt, language)}
                </p>
                {editorMode === "edit" ? (
                  <div className="editor-textarea-wrap">
                    {activeFindMatch && (
                      <pre ref={findHighlightRef} className="find-highlight-layer" aria-hidden="true">
                        <span className="find-highlight-layout-text">
                          {selected.body.slice(0, activeFindMatch.start)}
                        </span>
                        <mark>
                          <span className="find-highlight-layout-text">
                            {selected.body.slice(activeFindMatch.start, activeFindMatch.end)}
                          </span>
                        </mark>
                        <span className="find-highlight-layout-text">
                          {selected.body.slice(activeFindMatch.end)}
                          {"\u200b"}
                        </span>
                      </pre>
                    )}
                    <textarea
                      ref={bodyRef}
                      value={selected.body}
                      onChange={(event) => updateSelected({ body: event.target.value })}
                      onClick={(event) => {
                        if (!event.altKey) return;
                        const url = markdownLinkAtPosition(event.currentTarget.value, event.currentTarget.selectionStart);
                        if (!url) return;
                        event.preventDefault();
                        openExternalLink(url);
                      }}
                      onKeyDown={handleEditorKeyDown}
                      onScroll={(event) => syncFindHighlightScroll(event.currentTarget)}
                      onPaste={(event) => {
                        const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
                        const file = imageItem?.getAsFile();
                        if (file) {
                          event.preventDefault();
                          insertImageFile(file);
                          return;
                        }
                        const table = clipboardTextToMarkdownTable(event.clipboardData.getData("text/plain"));
                        if (table && table !== event.clipboardData.getData("text/plain").trim()) {
                          event.preventDefault();
                          insertStandaloneMarkdown(table);
                        }
                      }}
                      placeholder={ui("使用 Markdown 写下要记住的事情…", "Write with Markdown…")}
                      aria-label={ui("便签内容", "Note content")}
                      autoFocus
                    />
                  </div>
                ) : (
                  <article ref={previewRef} className="markdown-preview" aria-label={ui("Markdown 预览", "Markdown preview")}>
                    {selected.body.trim() ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, remarkCenterAlign]}
                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                        urlTransform={markdownUrlTransform}
                        components={markdownComponents}
                      >
                        {normalizeMarkdownForPreview(selected.body)}
                      </ReactMarkdown>
                    ) : (
                      <p className="preview-placeholder">{ui("这张便签还没有正文", "This note has no content yet")}</p>
                    )}
                  </article>
                )}
                {exportSourceVisible && (
                  <article ref={exportSourceRef} className="export-source" aria-hidden="true">
                    {selected.body.trim() ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath, remarkCenterAlign]}
                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                        urlTransform={markdownUrlTransform}
                        components={markdownComponents}
                      >
                        {normalizeMarkdownForPreview(selected.body)}
                      </ReactMarkdown>
                    ) : (
                      <p>{ui("这张便签还没有正文", "This note has no content yet")}</p>
                    )}
                  </article>
                )}
                <div className="editor-meta">
                  <span>{selected.body.trim() ? selected.body.trim().length : 0} {ui("字", "characters")}</span>
                  <span>{ui("Markdown · 仅保存在本机", "Markdown · Stored locally")}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-editor">
              <span className="empty-note-icon"><Plus size={22} /></span>
              <h2>{ui("新建一张便签", "Create a note")}</h2>
              <button onClick={createNote}><Plus size={16} /> {ui("新建便签", "New note")}</button>
            </div>
          )}
        </section>
      </section>

      {deleteId && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDeleteDialog()}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <span className="danger-icon"><Trash2 size={19} /></span>
            <h2 id="delete-title">{ui("删除这张便签？", "Delete this note?")}</h2>
            <p>{ui("删除后可用 Ctrl + Z 撤销，其他便签不会受影响。", "You can undo with Ctrl+Z. Other notes are unaffected.")}</p>
            <label className="delete-confirm-option">
              <input
                type="checkbox"
                checked={skipDeleteConfirmation}
                onChange={(event) => setSkipDeleteConfirmation(event.target.checked)}
              />
              <span>{ui("以后删除便签时不再显示此弹窗", "Do not show this confirmation again")}</span>
            </label>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={closeDeleteDialog}>{ui("取消", "Cancel")}</button>
              <button className="danger-button" onClick={confirmDelete}>{ui("删除", "Delete")}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
