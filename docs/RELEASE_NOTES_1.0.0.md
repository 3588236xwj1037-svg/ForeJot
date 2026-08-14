# ForeJot 1.0.0

[中文发布说明](RELEASE_NOTES_1.0.0.zh-CN.md)

The first public stable release of ForeJot, a local-first Markdown note app for Windows.

## Highlights

- Always-on-top Markdown notes with live preview and KaTeX math.
- Image paste, Markdown import, and PDF, HTML, `.doc`, Markdown, and LaTeX export.
- Search, note reordering, automatic saving, adjustable opacity, fonts, and launch-at-login.
- English and Chinese interfaces, with matching tray menus, native dialogs, export windows, and error prompts.
- The NSIS installer opens a language chooser before installation. Chinese Windows defaults to the Chinese **驻笺** interface; other Windows languages default to the English **ForeJot** interface.
- The first-run Chinese font is KaiTi and the English font is Times New Roman. Segoe UI, Arial, Verdana, and Chinese Windows fonts are also available in settings.

## Stability

- Corrects the KaTeX rendering of `\neq` and `\ne`.
- Corrects spacing around tall fractions in adjacent list items.
- Keeps formula styling aligned across the desktop preview and HTML/PDF exports.
- Includes regression checks for formula fonts, relation symbols, and pixel spacing.

## Install

Download and run `ForeJot Setup 1.0.0.exe` on 64-bit Windows 10 or Windows 11. The installer has no commercial code-signing certificate, so Windows SmartScreen may display an unknown-publisher prompt.

Upgrading does not delete `%APPDATA%\floating-notes\notes.json`. Back up that file before any upgrade or restore operation.

## Verification

SHA-256:

```text
F398EDC767B25D26D36EFE2C101AA8E27D54C89A1047A8D3B7E836E13DAAC334
```

Verify a downloaded installer in PowerShell:

```powershell
Get-FileHash "<download-directory>\ForeJot Setup 1.0.0.exe" -Algorithm SHA256
```
