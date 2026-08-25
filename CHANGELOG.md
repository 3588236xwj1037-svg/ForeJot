# Changelog

[中文变更记录](CHANGELOG.zh-CN.md)

This project maintains public change records from `1.0.0` onward.

## 1.0.1 - 2026-08-25

- Split application font preferences into independent Chinese and English settings.
- Chinese text defaults to KaiTi and English text defaults to Times New Roman in both installer language editions.
- Changing a Chinese font no longer changes English text, and changing an English font no longer changes Chinese text.
- Apply the combined font settings consistently to the editor, preview, find highlights, interface, and HTML/PDF export.
- Migrate existing single-font preferences without discarding the selected font for its matching script.

## 1.0.0 - 2026-08-12

- First public stable release.
- Local-first Markdown notes with KaTeX math, images, search, and multi-format export.
- English and Chinese interfaces, always-on-top behavior, opacity, font, and launch-at-login settings.
- An installer language chooser that sets the first-run language and the English Times New Roman default.
- Correct inline fraction spacing, KaTeX relation-symbol rendering, and matching preview/export formula styling.
