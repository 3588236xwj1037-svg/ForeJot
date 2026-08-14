# ForeJot（驻笺）1.0.0

ForeJot（驻笺）的首个正式公开稳定版本。

## 主要功能

- 本地优先的 Markdown 桌面便签
- 始终置顶、透明度、字体和开机启动设置
- Markdown 与 KaTeX 公式实时预览
- 图片粘贴、Markdown 导入和多格式导出
- 中英文界面，英文模式的托盘、系统弹窗、导出窗口和错误提示均显示英文
- 安装开始前显示中英文选择；中文 Windows 默认显示“驻笺”，其他语言 Windows 默认显示 ForeJot
- 中文版首次启动默认使用楷体，英文版首次启动默认使用 Times New Roman，并提供 Segoe UI、Arial、Verdana 等字体

## 稳定性修复

- 修复 `\neq` 和 `\ne` 被错误显示为 `/=` 的公式字体问题。
- 修复高分式在相邻列表项之间间距不足的问题。
- 统一桌面预览与 HTML/PDF 导出的公式样式。
- 增加公式字体、关系符号和像素间距回归检查。
- 清理 Windows 安装包继承的公司元数据，产品名为“ForeJot”，公司字段留空。

## 安装

下载 `ForeJot Setup 1.0.0.exe` 后运行安装程序。支持 Windows 10/11 64 位。安装包尚未使用商业代码签名证书，Windows SmartScreen 可能提示未知发布者。

升级安装不会主动删除 `%APPDATA%\floating-notes\notes.json` 中的便签数据，但升级前仍建议备份。

## 安装包校验

安装包 SHA-256：

```text
F398EDC767B25D26D36EFE2C101AA8E27D54C89A1047A8D3B7E836E13DAAC334
```

下载后可在 PowerShell 中执行以下命令核对：

```powershell
Get-FileHash "<下载目录>\ForeJot Setup 1.0.0.exe" -Algorithm SHA256
```
