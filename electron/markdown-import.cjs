const { net } = require("electron");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const NOTE_ASSET_PREFIX = "note-asset:";
const MAX_IMPORTED_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORTED_IMAGE_COUNT = 32;
const MAX_IMPORTED_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024;
const IMPORTED_IMAGE_REQUEST_TIMEOUT_MS = 8000;
const MAX_RELOCATION_SEARCH_DEPTH = 6;
const MAX_RELOCATION_SEARCH_FILES = 20000;
const ignoredRelocationDirectories = new Set([".git", ".svn", "node_modules"]);
const imageMimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};
const supportedImageMimeTypes = new Set(Object.values(imageMimeTypes));
const markdownImagePattern = /!\[([^\]]*)\]\(\s*(?:<([^>\r\n]+)>|([^\s)\r\n]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const htmlImagePattern = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const htmlImageSourcePattern = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const htmlImageAltPattern = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

function normalizeImageMimeType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function imageMimeTypeFromPath(source) {
  const extension = path.extname(String(source).split(/[?#]/, 1)[0]).toLowerCase();
  return imageMimeTypes[extension] || null;
}

function decodeImagePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeHtmlAttribute(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([\da-f]+));/gi, (entity, decimal, hexadecimal) => {
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
    if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
    return {
      "&amp;": "&",
      "&quot;": '"',
      "&apos;": "'",
      "&lt;": "<",
      "&gt;": ">",
    }[entity.toLowerCase()] || entity;
  });
}

function htmlAttributeValue(tag, pattern) {
  const match = tag.match(pattern);
  if (!match) return "";
  return decodeHtmlAttribute(match.slice(1).find((value) => value !== undefined) || "");
}

function replaceHtmlImageSource(tag, source) {
  return tag.replace(htmlImageSourcePattern, (_attribute, doubleQuoted, singleQuoted) => {
    const quote = doubleQuoted !== undefined ? '"' : singleQuoted !== undefined ? "'" : '"';
    return `src=${quote}${source}${quote}`;
  });
}

function resolveMarkdownImagePath(source, markdownPath) {
  const value = source.trim();
  if (!value || /^data:/i.test(value)) return null;
  if (/^file:/i.test(value)) {
    try {
      return fileURLToPath(value);
    } catch {
      return null;
    }
  }
  const decodedPath = decodeImagePath(value.split(/[?#]/, 1)[0]);
  if (path.isAbsolute(decodedPath)) return decodedPath;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//")) return null;
  return path.resolve(path.dirname(markdownPath), decodedPath);
}

function resolveAbsoluteImagePath(source) {
  const value = String(source || "").trim();
  if (!value || /^note-asset:/i.test(value) || /^data:/i.test(value) || /^https?:\/\//i.test(value)) {
    return null;
  }
  if (/^file:/i.test(value)) {
    try {
      return fileURLToPath(value);
    } catch {
      return null;
    }
  }
  const decodedPath = decodeImagePath(value.split(/[?#]/, 1)[0]);
  return path.isAbsolute(decodedPath) ? decodedPath : null;
}

function dataUrlImage(source) {
  const match = source.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mimeType = normalizeImageMimeType(match[1]);
  if (!supportedImageMimeTypes.has(mimeType)) return null;
  const data = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!data.length || data.length > MAX_IMPORTED_IMAGE_BYTES) return null;
  return { mimeType, data };
}

function localImageFromPath(localPath) {
  const mimeType = imageMimeTypeFromPath(localPath);
  if (!mimeType) return null;
  try {
    const stats = fs.statSync(localPath);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_IMPORTED_IMAGE_BYTES) return null;
    return { localPath, mimeType, data: fs.readFileSync(localPath) };
  } catch {
    return null;
  }
}

function localImage(source, markdownPath) {
  const localPath = resolveMarkdownImagePath(source, markdownPath);
  return localPath ? localImageFromPath(localPath) : null;
}

function absoluteLocalImage(source) {
  const localPath = resolveAbsoluteImagePath(source);
  return localPath ? localImageFromPath(localPath) : null;
}

function relocationSearchRoots(markdownPath, additionalRoots = []) {
  const roots = [path.dirname(markdownPath), ...additionalRoots]
    .filter((candidate) => typeof candidate === "string" && candidate.trim())
    .map((candidate) => path.resolve(candidate));
  const seen = new Set();
  return roots.filter((candidate) => {
    const key = candidate.toLocaleLowerCase("en-US");
    if (seen.has(key)) return false;
    try {
      if (!fs.statSync(candidate).isDirectory()) return false;
    } catch {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildRelocationIndex(markdownPath, additionalRoots = []) {
  const index = new Map();
  const roots = relocationSearchRoots(markdownPath, additionalRoots);
  let visitedFiles = 0;

  roots.forEach((root, rootIndex) => {
    const queue = [{ directory: root, depth: 0 }];
    while (queue.length && visitedFiles < MAX_RELOCATION_SEARCH_FILES) {
      const current = queue.shift();
      let entries;
      try {
        entries = fs.readdirSync(current.directory, { withFileTypes: true })
          .sort((first, second) => first.name.localeCompare(second.name, "en-US"));
      } catch {
        continue;
      }
      for (const entry of entries) {
        const entryPath = path.join(current.directory, entry.name);
        if (entry.isDirectory()) {
          if (current.depth < MAX_RELOCATION_SEARCH_DEPTH && !ignoredRelocationDirectories.has(entry.name.toLowerCase())) {
            queue.push({ directory: entryPath, depth: current.depth + 1 });
          }
          continue;
        }
        if (!entry.isFile()) continue;
        visitedFiles += 1;
        if (!imageMimeTypeFromPath(entry.name)) continue;
        const key = entry.name.toLocaleLowerCase("en-US");
        const candidates = index.get(key) || [];
        candidates.push({ filePath: entryPath, rootIndex, depth: current.depth });
        index.set(key, candidates);
        if (visitedFiles >= MAX_RELOCATION_SEARCH_FILES) break;
      }
    }
  });

  return index;
}

function matchingTrailingPathSegments(first, second) {
  const firstParts = path.normalize(first).split(path.sep).filter(Boolean);
  const secondParts = path.normalize(second).split(path.sep).filter(Boolean);
  let matches = 0;
  while (matches < firstParts.length && matches < secondParts.length) {
    const firstPart = firstParts[firstParts.length - 1 - matches];
    const secondPart = secondParts[secondParts.length - 1 - matches];
    if (firstPart.localeCompare(secondPart, "en-US", { sensitivity: "accent" }) !== 0) break;
    matches += 1;
  }
  return matches;
}

function relocatedImagePath(source, relocationIndex) {
  const originalPath = resolveAbsoluteImagePath(source);
  if (!originalPath || !relocationIndex) return null;
  const candidates = relocationIndex.get(path.basename(originalPath).toLocaleLowerCase("en-US")) || [];
  if (!candidates.length) return null;
  const ranked = candidates.map((candidate) => ({
    ...candidate,
    suffixMatches: matchingTrailingPathSegments(originalPath, candidate.filePath),
  })).sort((first, second) => (
    second.suffixMatches - first.suffixMatches
    || first.rootIndex - second.rootIndex
    || first.depth - second.depth
    || first.filePath.localeCompare(second.filePath, "en-US")
  ));
  if (ranked.length > 1) {
    const first = ranked[0];
    const second = ranked[1];
    if (first.suffixMatches === second.suffixMatches && first.rootIndex === second.rootIndex && first.depth === second.depth) {
      return null;
    }
  }
  return ranked[0].filePath;
}

async function remoteImage(source) {
  if (!/^https?:\/\//i.test(source)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMPORTED_IMAGE_REQUEST_TIMEOUT_MS);
  try {
    const response = await net.fetch(source, { signal: controller.signal });
    if (!response.ok) return null;
    const headerMimeType = normalizeImageMimeType(response.headers.get("content-type"));
    const fallbackMimeType = imageMimeTypeFromPath(new URL(source).pathname);
    const mimeType = supportedImageMimeTypes.has(headerMimeType) ? headerMimeType : fallbackMimeType;
    if (!mimeType || !supportedImageMimeTypes.has(mimeType)) return null;
    const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMPORTED_IMAGE_BYTES) return null;
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length || data.length > MAX_IMPORTED_IMAGE_BYTES) return null;
    return { mimeType, data };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function importedAttachmentName(alt, source, index) {
  const fallback = (() => {
    try {
      return path.basename(new URL(source).pathname);
    } catch {
      return path.basename(source.split(/[?#]/, 1)[0]);
    }
  })();
  return (alt.trim() || fallback || `图片-${index}`)
    .replace(/[\\/:*?"<>|\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || `图片-${index}`;
}

function imageReferences(markdown) {
  const references = Array.from(markdown.matchAll(markdownImagePattern), (match) => ({
    index: match.index,
    original: match[0],
    source: (match[2] || match[3] || "").trim(),
    alt: match[1],
    replacement: (id) => `![${match[1]}](${NOTE_ASSET_PREFIX}${id})`,
  }));

  for (const match of markdown.matchAll(htmlImagePattern)) {
    const source = htmlAttributeValue(match[0], htmlImageSourcePattern).trim();
    if (!source) continue;
    const alt = htmlAttributeValue(match[0], htmlImageAltPattern);
    references.push({
      index: match.index,
      original: match[0],
      source,
      alt,
      replacement: (id) => replaceHtmlImageSource(match[0], `${NOTE_ASSET_PREFIX}${id}`),
    });
  }

  return references.sort((first, second) => first.index - second.index);
}

function uniqueAttachmentId(reservedIds) {
  let id = randomUUID().replace(/-/g, "").slice(0, 16);
  while (reservedIds.has(id)) id = randomUUID().replace(/-/g, "").slice(0, 16);
  reservedIds.add(id);
  return id;
}

function repairLocalImagesInMarkdown(markdown, options = {}) {
  if (typeof markdown !== "string" || !markdown) {
    return { body: markdown, attachments: {}, repairedReferences: 0 };
  }

  const reservedIds = new Set(options.reservedAttachmentIds || []);
  const attachments = {};
  const attachmentByPath = new Map();
  const matches = imageReferences(markdown);
  let cursor = 0;
  let imageCount = 0;
  let importedBytes = 0;
  let repairedReferences = 0;
  let body = "";

  for (const match of matches) {
    const absolutePath = resolveAbsoluteImagePath(match.source);
    const pathKey = absolutePath
      ? path.resolve(absolutePath).toLocaleLowerCase("en-US")
      : null;
    const existingId = pathKey ? attachmentByPath.get(pathKey) : null;
    const image = existingId || !pathKey || imageCount >= MAX_IMPORTED_IMAGE_COUNT || importedBytes >= MAX_IMPORTED_TOTAL_IMAGE_BYTES
      ? null
      : absoluteLocalImage(match.source);
    let replacement = match.original;

    if (existingId) {
      replacement = match.replacement(existingId);
      repairedReferences += 1;
    } else if (image && importedBytes + image.data.length <= MAX_IMPORTED_TOTAL_IMAGE_BYTES) {
      const id = uniqueAttachmentId(reservedIds);
      imageCount += 1;
      importedBytes += image.data.length;
      attachments[id] = {
        id,
        name: importedAttachmentName(match.alt, match.source, imageCount),
        mimeType: image.mimeType,
        dataUrl: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
      };
      attachmentByPath.set(pathKey, id);
      replacement = match.replacement(id);
      repairedReferences += 1;
    }

    body += markdown.slice(cursor, match.index) + replacement;
    cursor = match.index + match.original.length;
  }

  return {
    body: repairedReferences ? body + markdown.slice(cursor) : markdown,
    attachments,
    repairedReferences,
  };
}

function repairStoredNotesLocalImages(state) {
  if (!state || typeof state !== "object" || !Array.isArray(state.notes)) {
    return { state, changed: false, addedAttachments: 0, repairedReferences: 0 };
  }

  const existingAttachments = state.attachments && typeof state.attachments === "object" && !Array.isArray(state.attachments)
    ? state.attachments
    : {};
  let attachments = existingAttachments;
  let addedAttachments = 0;
  let repairedReferences = 0;

  const notes = state.notes.map((note) => {
    if (!note || typeof note !== "object" || typeof note.body !== "string") return note;
    const repaired = repairLocalImagesInMarkdown(note.body, {
      reservedAttachmentIds: Object.keys(attachments),
    });
    const newAttachments = Object.keys(repaired.attachments);
    if (!newAttachments.length) return note;
    attachments = { ...attachments, ...repaired.attachments };
    addedAttachments += newAttachments.length;
    repairedReferences += repaired.repairedReferences;
    return { ...note, body: repaired.body };
  });

  if (!addedAttachments) {
    return { state, changed: false, addedAttachments: 0, repairedReferences: 0 };
  }
  return {
    state: { ...state, notes, attachments },
    changed: true,
    addedAttachments,
    repairedReferences,
  };
}

async function importMarkdownFile(filePath, options = {}) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("Markdown file path is required.");
  }
  const markdownPath = path.resolve(filePath);
  if (path.extname(markdownPath).toLowerCase() !== ".md") {
    throw new Error("Only Markdown files can be imported.");
  }

  const markdown = fs.readFileSync(markdownPath, "utf8");
  const attachments = {};
  const attachmentBySource = new Map();
  const matches = imageReferences(markdown);
  const unresolvedLocalImages = new Map();
  let relocationIndex = null;
  let cursor = 0;
  let imageCount = 0;
  let importedBytes = 0;
  let body = "";

  for (const match of matches) {
    const existingId = attachmentBySource.get(match.source);
    let image = null;
    if (!existingId && imageCount < MAX_IMPORTED_IMAGE_COUNT && importedBytes < MAX_IMPORTED_TOTAL_IMAGE_BYTES) {
      image = dataUrlImage(match.source) || localImage(match.source, markdownPath);
      if (!image && resolveAbsoluteImagePath(match.source)) {
        relocationIndex ||= buildRelocationIndex(markdownPath, options.searchRoots);
        const relocatedPath = relocatedImagePath(match.source, relocationIndex);
        image = relocatedPath ? localImageFromPath(relocatedPath) : null;
        if (!image && !unresolvedLocalImages.has(match.source)) {
          unresolvedLocalImages.set(match.source, { source: match.source, alt: match.alt });
        }
      }
      if (!image) image = await remoteImage(match.source);
    }
    let replacement = match.original;

    if (existingId) {
      replacement = match.replacement(existingId);
    } else if (image && importedBytes + image.data.length <= MAX_IMPORTED_TOTAL_IMAGE_BYTES) {
      let id = randomUUID().replace(/-/g, "").slice(0, 16);
      while (attachments[id]) id = randomUUID().replace(/-/g, "").slice(0, 16);
      imageCount += 1;
      importedBytes += image.data.length;
      attachments[id] = {
        id,
        name: importedAttachmentName(match.alt, match.source, imageCount),
        mimeType: image.mimeType,
        dataUrl: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
      };
      attachmentBySource.set(match.source, id);
      replacement = match.replacement(id);
    }

    body += markdown.slice(cursor, match.index) + replacement;
    cursor = match.index + match.original.length;
  }

  return {
    body: body + markdown.slice(cursor),
    attachments,
    unresolvedLocalImages: Array.from(unresolvedLocalImages.values()),
  };
}

module.exports = { importMarkdownFile, repairLocalImagesInMarkdown, repairStoredNotesLocalImages };
