# ForeJot（驻笺）1.0.1

[English release notes](RELEASE_NOTES_1.0.1.md)

## 修复内容

- 中文版与英文版均支持独立设置中文字体和英文字体。
- 中文文字默认使用楷体，英文文字默认使用 Times New Roman。
- 修改中文字体不再影响英文；修改英文字体不再影响中文。
- 编辑器、预览、查找高亮、界面、HTML/PDF 导出统一使用相同的独立字体设置。
- 旧版单字体设置会自动迁移，并保留其对应文字类型的原有字体选择。

## 安装

下载 `ForeJot Setup 1.0.1.exe` 后运行安装程序。支持 Windows 10/11 64 位。安装包尚未使用商业代码签名证书，Windows SmartScreen 可能提示未知发布者。

升级安装不会主动删除 `%APPDATA%\floating-notes\notes.json` 中的便签数据，但升级前仍建议备份。

## 安装包校验

安装包 SHA-256：

```text
3C2AA0DC9204D9B3F2F2D1CD0CF793B235202EAFDD05028C97701EC5872B2A2B
```

下载后可在 PowerShell 中执行以下命令核对：

```powershell
Get-FileHash "<下载目录>\ForeJot Setup 1.0.1.exe" -Algorithm SHA256
```
