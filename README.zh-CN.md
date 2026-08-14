# ForeJot（驻笺）

> ForeJot（驻笺）是一款本地优先、始终置顶的 Windows Markdown 桌面便签，适合把当下需要反复查看和快速补写的内容留在眼前。

[English](README.md) | [1.0.0 Release Notes](docs/RELEASE_NOTES_1.0.0.md) | [中文发布说明](docs/RELEASE_NOTES_1.0.0.zh-CN.md)

![ForeJot（驻笺）公式预览](docs/screenshot.zh-CN.png)

ForeJot（驻笺）由独立开发者维护。“ForeJot”和“驻笺”是软件产品名称，不表示存在或已注册同名公司主体。

## 一眼了解

ForeJot（驻笺）适合放在工作旁边的那一张笔记，而不是塞进浏览器标签页或大型工作区：会议待办、计算过程、代码片段、临时调研和每日清单，都能保持可见、可补写。

| 使用中的需求 | ForeJot（驻笺）的处理方式 |
| --- | --- |
| 一边工作一边查看和补记 | 窗口默认置顶，可随时开关，也可调节透明度以减少遮挡。 |
| 用纯文本快速组织内容 | Markdown 编辑与实时预览在同一张便签中完成，支持标题、列表、表格、任务列表、代码、链接和公式。 |
| 记录数学、理工或技术内容 | 内置 KaTeX，行内和块级公式会实时渲染；代码块、表格和图片仍与同一份 Markdown 源文放在一起。 |
| 导入已有草稿和截图 | 可导入 Markdown、粘贴截图或插入本地图片；导入图片的绝对路径失效时，可选择其所在文件夹重新定位。 |
| 交付或归档当前便签 | 当前便签可导出为 PDF、HTML、Word 兼容 .doc、Markdown 或 LaTeX。 |
| 不希望笔记离开电脑 | 不需要账号，没有云同步、广告、遥测或便签上传；便签和设置仅保存在当前 Windows 用户目录。 |

## 为什么是 ForeJot（驻笺）

许多笔记产品围绕知识库、数据库、浏览器工作区或多人协作设计。ForeJot（驻笺）有意把界面收敛为正在辅助工作的那张便签。

| 差异 | 实际使用体验 |
| --- | --- |
| 紧凑的单窗口布局 | 可调宽、可折叠的便签列表，加上聚焦的编辑或预览区域，减少需要管理的界面。它适合放在屏幕边缘，而不是与主任务争夺注意力。 |
| 本地优先 | 没有登录流程、同步引擎、托管工作区、插件运行时或后台便签上传。开始记录前不需要配置额外服务。 |
| 同一份 Markdown 源文 | 编辑的文本就是实时预览和可携带 Markdown、LaTeX 导出的来源，可保留长期可读的纯文本表达，而不是被锁进私有文档格式。 |
| 原生 Windows 行为 | 始终置顶、系统托盘、开机启动、原生保存窗口和全局新建便签快捷键都在桌面端完成，而不是依赖浏览器标签页。 |
| 技术笔记无需另开编辑器 | KaTeX、围栏代码块、Markdown 表格、图片附件和导出都在同一个小型工作界面中完成。 |

ForeJot（驻笺）不发布跨产品的内存占用对比数据。Electron 的内存使用会随 Windows、便签大小、图片和预览状态变化。这里追求的是更低的使用与配置负担，而不是没有依据的数值宣传：软件不包含云同步、后台索引服务或多工作区应用外壳。

## 快速开始

1. 从 [GitHub Releases](../../releases/latest) 下载并运行 `ForeJot Setup 1.0.0.exe`。
2. 在安装程序中选择中文或 English。选择会决定首次启动的界面语言与默认字体。
3. 点击“新建便签”，或在 Windows 任意位置按 <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>N</kbd>。
4. 在“编辑”中输入 Markdown；需要查看排版效果时切换到“预览”。
5. 内容会自动保存。需要立即确认保存时，按 <kbd>Ctrl</kbd> + <kbd>S</kbd>。
6. 在“设置”中选择导出格式、界面语言、字体、透明度、开机启动等桌面行为。

## 快捷键

下列格式快捷键需要编辑器获得焦点；全局新建便签快捷键则在 ForeJot（驻笺）运行期间任意位置均可使用。

| 操作 | Windows 快捷键 | 作用 |
| --- | --- | --- |
| 新建便签 | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>N</kbd> | 显示 ForeJot（驻笺）并创建一张便签。 |
| 立即保存 | <kbd>Ctrl</kbd> + <kbd>S</kbd> | 立即写入当前状态；正常编辑也会自动保存。 |
| 撤销 | <kbd>Ctrl</kbd> + <kbd>Z</kbd> | 撤销最近一次受支持的编辑或便签删除。 |
| 查找和替换 | <kbd>Ctrl</kbd> + <kbd>H</kbd> | 打开查找和替换面板；按 <kbd>Esc</kbd> 关闭。 |
| 标题或正文 | <kbd>Ctrl</kbd> + <kbd>0</kbd> 至 <kbd>5</kbd> | 将当前行或选区设为正文，或标题 1 至标题 5。 |
| 加粗 | <kbd>Ctrl</kbd> + <kbd>B</kbd> | 为选区切换 `**加粗**` Markdown 标记。 |
| 斜体 | <kbd>Ctrl</kbd> + <kbd>I</kbd> | 为选区切换 `*斜体*` Markdown 标记。 |
| 下划线 | <kbd>Ctrl</kbd> + <kbd>U</kbd> | 为选区切换 HTML 下划线标记。 |
| 居中 | <kbd>Ctrl</kbd> + <kbd>E</kbd> | 在预览中居中选中的段落或标题。 |
| 生成代码块 | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> | 插入围栏代码块，并将光标放到块内。 |
| 生成公式块 | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> | 插入块级公式，并将光标放到公式内。 |

工具栏也提供相同的格式操作，以及选中文字字号和字体、剪贴板表格转换、插入图片、导入 Markdown 和导出。点击图钉按钮即可切换始终置顶。

## 用 Markdown 写作

ForeJot（驻笺）采用 Markdown 源文与实时预览。可以直接输入语法，也可以先选中内容，再用工具栏或快捷键处理。

### 常用格式

```markdown
# 项目标题

**加粗**、*斜体* 和 <u>下划线</u>

> 一段引用

- 一项清单
- [ ] 未完成任务
- [x] 已完成任务

[ForeJot 发布页](https://github.com/)
```

### 代码和公式

按 <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> 可生成下面的代码块。为便于在其他工具中继续使用，可以在开头围栏后填写语言名称。

```javascript
const task = "发布 ForeJot";
console.log(task);
```

按 <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> 生成块级公式；行内公式只需在两边各放一个美元符号。

```markdown
能量方程为 $E = mc^2$。

$$
a^2 + b^2 = c^2
$$
```

KaTeX 会在预览和适用的导出格式中渲染结果。KaTeX 支持标准 LaTeX 记号；无法识别的表达式会保留源文，便于继续修正。

### 表格和图片

将表格软件中的制表符分隔单元格复制到剪贴板后，在编辑器中点击表格按钮，即可将剪贴板内容转换为 Markdown 表格。也可以直接输入：

```markdown
| 项目 | 负责人 | 完成 |
| --- | --- | --- |
| 发布说明 | 小林 | 是 |
| 验证安装包 | 小周 | 否 |
```

可从剪贴板粘贴图片，或使用图片按钮选择本地文件。ForeJot（驻笺）会将图片作为便签附件保存，并在正文中保存简短的 Markdown 引用。导入 Markdown 时，只要可以解析，都会保留本地或远程图片；遇到失效的绝对路径时，按提示选择图片所在文件夹。

## 功能

### 写作与阅读

- Markdown 编辑与实时预览，支持标题、列表、表格、任务列表、引用、代码、链接、下划线、居中、选中文字字体和字号。
- KaTeX 行内公式与块级公式。
- 搜索标题和正文；复制、删除、拖动排序便签。
- 自动保存，支持立即保存快捷键；受支持的编辑和删除可撤销。
- 界面可以随时切换中文或 English。

### 图片、导入与导出

- 从剪贴板粘贴图片或插入本地图片文件。
- 导入 Markdown，并尽可能把本地或远程图片保存为便签附件。
- 导出当前便签到 PDF、HTML、Word 兼容 .doc、Markdown 或 LaTeX；适用的导出会包含图片和公式。

### 桌面控制

- 始终置顶、透明度、字体、侧栏宽度、侧栏折叠和开机启动设置。
- 系统托盘控制和全局新建便签快捷键。
- 提供 Times New Roman、Segoe UI、Arial、Verdana 和常用中文 Windows 字体。
- Windows 10/11 64 位原生桌面应用，不依赖浏览器标签页。

## 安装与语言

从 [GitHub Releases](../../releases/latest) 下载 `ForeJot Setup 1.0.0.exe`。安装开始前会显示中文和 English 选择。

- 中文 Windows 默认选择中文，软件显示“驻笺”。
- 其他语言 Windows 默认选择 English，软件显示 ForeJot。
- 安装时的选择决定首次启动的界面和默认字体：中文为楷体，English 为 Times New Roman。
- 安装完成后，仍可在“设置 > 界面语言”中随时切换中文或 English。用户在软件中主动修改的选择会在升级后保留。

系统要求：Windows 10/11 64 位。安装包尚未使用商业代码签名证书，Windows SmartScreen 可能提示未知发布者；请仅从项目发布页下载，并核对发布页的校验值。

当前没有自动更新服务。新版本发布后，运行新的安装包覆盖安装即可，原有便签会保留。

## 数据、备份与隐私

ForeJot（驻笺）没有账号、云同步、广告、遥测或便签上传。便签正文、内嵌图片和设置保存在当前 Windows 用户目录：

```text
%APPDATA%\floating-notes\notes.json
```

备份时复制 `notes.json` 即可。恢复到另一台电脑前，请完全退出 ForeJot（驻笺），并先备份目标电脑已有的同名文件；覆盖它会替换该电脑的便签状态。安装包和本源码仓库均不包含任何用户便签。

驻笺不运营云服务；但远程 Markdown 图片、导入含远程图片的 Markdown，以及点击外部链接，可能按用户操作访问相应网站。详细情况见 [隐私说明](PRIVACY.md)。

## 使用边界

- 当前仅支持 Windows 10/11 64 位。
- 当前不含跨设备同步、多人协作和自动更新。数据随 Windows 用户配置文件保存，迁移电脑请自行备份 `notes.json`。
- .doc 导出为基于 HTML 的兼容文档；如需复杂排版或长期归档，请同时保留 Markdown 或 LaTeX 源文件。
- 远程图片由其来源服务器提供，是否可访问、是否保留以及隐私政策由来源网站决定。

## 本地开发

需要 Node.js 22 或更高版本（建议使用 Node.js 24）及 npm。

```powershell
npm ci
npm run dev
```

常用命令：

```powershell
npm test             # 运行单元与界面测试
npm run build        # 类型检查并构建前端
npm run check:public # 检查待公开文件是否包含本地数据或密钥
npm run qa:formula   # 运行 Electron 公式渲染回归检查
npm run dist         # 构建 Windows NSIS 安装包
```

安装包默认输出至 `release/`，该目录不会提交到 Git。项目结构如下：

```text
electron/   Electron 主进程、预加载脚本和 Markdown 导入
src/        React 界面、样式和测试
scripts/    窗口、置顶、内存、公开文件与公式渲染检查
build/      应用图标和 NSIS 配置
docs/       发布教程、发布前清单和版本说明
```

## 参与项目

- 贡献代码或报告问题前，请阅读 [贡献指南](CONTRIBUTING.md)。
- 涉及漏洞、私人便签或敏感信息时，请按 [安全策略](SECURITY.md) 使用私密报告，不要创建公开 Issue。
- 历史变更见 [CHANGELOG.md](CHANGELOG.md)，当前版本的发布信息见 [1.0.0 发布说明](docs/RELEASE_NOTES_1.0.0.md)。

## License

本项目采用 [MIT License](LICENSE)。
