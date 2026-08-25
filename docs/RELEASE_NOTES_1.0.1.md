# ForeJot 1.0.1

[中文发布说明](RELEASE_NOTES_1.0.1.zh-CN.md)

## Fixed

- Chinese and English application fonts are now independent in both the Chinese and English editions.
- Chinese text defaults to KaiTi and English text defaults to Times New Roman.
- Changing the Chinese font no longer changes the English font, and changing the English font no longer changes the Chinese font.
- The editor, preview, find highlights, interface, and HTML/PDF exports now use the same independent font settings.
- Existing single-font preferences are migrated automatically without losing the matching font choice.

## Install

Download and run `ForeJot Setup 1.0.1.exe` on 64-bit Windows 10 or Windows 11. The installer has no commercial code-signing certificate, so Windows SmartScreen may display an unknown-publisher prompt.

Upgrading does not delete `%APPDATA%\floating-notes\notes.json`. Back up that file before any upgrade or restore operation.

## Verification

SHA-256:

```text
3C2AA0DC9204D9B3F2F2D1CD0CF793B235202EAFDD05028C97701EC5872B2A2B
```

Verify a downloaded installer in PowerShell:

```powershell
Get-FileHash "<download-directory>\ForeJot Setup 1.0.1.exe" -Algorithm SHA256
```
