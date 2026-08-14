const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const candidateOutput = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

const candidates = candidateOutput.split("\0").filter(Boolean);
const failures = [];
const deniedPaths = [
  {
    pattern: /(^|\/)notes\.json$/i,
    reason: "local note data must never be published",
  },
  {
    pattern: /(^|\/)(?:node_modules|dist|release(?:-v\d+)?|output|tmp|\.artifacts|coverage)(\/|$)/i,
    reason: "generated output must not be committed",
  },
  {
    pattern: /\.(?:exe|msi|blockmap|asar|zip)$/i,
    reason: "release binaries and backups belong in GitHub Releases, not source control",
  },
  {
    pattern: /(^|\/)\.env(?:\.|$)/i,
    reason: "local environment files may contain credentials",
  },
];

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".nsh",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const sensitiveContent = [
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    reason: "private key material detected",
  },
  {
    pattern: /(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][^"']{8,}["']/i,
    reason: "possible credential assignment detected",
  },
  {
    pattern: /[A-Za-z]:\\Users\\[^\\\r\n]+\\/,
    reason: "machine-specific Windows user path detected",
  },
  {
    pattern: /(?:^|[\s"'])(?:D|E):\\/m,
    reason: "machine-specific drive path detected",
  },
  {
    pattern: new RegExp(["回归" + "分析", "Lec1" + "-Introduction"].join("|")),
    reason: "known private note content detected",
  },
];

for (const relativePath of candidates) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const absolutePath = path.join(root, relativePath);
  const stats = fs.statSync(absolutePath);

  for (const rule of deniedPaths) {
    if (rule.pattern.test(normalizedPath)) {
      failures.push(`${normalizedPath}: ${rule.reason}`);
    }
  }

  if (stats.size > 10 * 1024 * 1024) {
    failures.push(`${normalizedPath}: file is larger than 10 MB`);
  }

  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) continue;

  const content = fs.readFileSync(absolutePath, "utf8");
  for (const rule of sensitiveContent) {
    const match = rule.pattern.exec(content);
    if (!match) continue;
    const line = content.slice(0, match.index).split(/\r?\n/).length;
    failures.push(`${normalizedPath}:${line}: ${rule.reason}`);
  }
}

if (failures.length > 0) {
  console.error("Publication check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Publication check passed for ${candidates.length} candidate files.`);
