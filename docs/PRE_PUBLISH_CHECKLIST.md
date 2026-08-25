# ForeJot（驻笺）公开前检查清单

每次把源码首次公开或发布新版本前，逐项核对。未能确认的项目不要凭猜测勾选，应先补充证据或暂缓发布。

## A. 发布主体、名称与授权

- [ ] 明确仓库所有者、公开提交署名和用于处理公开问题的 GitHub 账号。
- [ ] 已检索中国商标网、国家企业信用信息公示系统、GitHub 和常见应用商店中“ForeJot”“Fore Jot”“Fore-Jot”“驻笺”及近似名称的使用情况。
- [ ] 没有在 README、应用元数据、Release 页面或截图中声称拥有公司、注册商标、认证或资质，除非有真实证明。
- [ ] 已检查图标、截图、字体、示例文本、图片和依赖许可证，确认拥有公开和再分发所需权利。
- [ ] 已选择开源许可证，并在根目录加入准确的 `LICENSE`；`package.json` 和 README 中的许可证信息一致。
- [ ] 理解许可证不等于商标授权，也不能替代法律意见。涉及名称注册、侵权或商业化争议时，先咨询有资质的专业人士。

## B. 隐私与公开文件

- [ ] 已完全退出 ForeJot（驻笺），并确认 `%APPDATA%\floating-notes\notes.json` 没有被复制到项目目录、文档、截图或附件中。
- [ ] `.gitignore` 保留了 `notes.json`、`floating-notes/`、`.env*`、安装包和构建输出的忽略规则。
- [ ] 已运行 `npm run check:public` 并获得通过结果。
- [ ] 已运行 `git add --dry-run --all`，并人工审查其中每一个文件。
- [ ] 使用 GitHub 的网页代码搜索或本地 `rg` 再检查真实姓名、地址、手机号、私人笔记关键词、个人照片、令牌和本机路径。
- [ ] `PRIVACY.md` 与软件当前行为一致，尤其是本地存储、远程 Markdown 图片、外部链接和导入行为。
- [ ] 若仓库曾经误提交过隐私或密钥，已在公开前清理 Git 历史并撤销所有可能泄露的凭据；只补 `.gitignore` 不足以移除历史内容。

## C. GitHub 账号与仓库设置

- [ ] GitHub 账号已启用双重验证，恢复代码保存于安全位置，登录邮箱仍可使用。
- [ ] 已设置公开提交署名；如不希望公开私人邮箱，已启用 GitHub `noreply` 邮箱。
- [ ] 远程仓库地址、默认分支和可见性（Public）已在网页中复核。
- [ ] `README.md`、`CONTRIBUTING.md`、`PRIVACY.md`、`SECURITY.md`、`CHANGELOG.md`、Issue 模板和 Pull Request 模板会被首次提交。
- [ ] 已检查 `.github/workflows/ci.yml` 和 `.github/workflows/release.yml` 的触发条件与权限；目前 Release 工作流具有创建 Release 所需的 `contents: write` 权限。
- [ ] 按维护方式设置 `main` 分支保护和 Actions 权限。单人维护可以保留简洁流程，但应理解每项例外规则的后果。
- [ ] 已决定是否添加行为准则和支持渠道。项目尚无专用联系邮箱时，可先使用 Issue 和 GitHub Security Advisory；不要虚构联系渠道。

## D. 代码与安装包验证

- [ ] 使用锁定依赖完成 `npm ci`。
- [ ] `npm run check:public`、`npm test`、`npm run build` 与 `npm run qa:formula` 全部通过。
- [ ] 已手动检查：创建、编辑、自动保存、搜索、置顶、透明度、图片粘贴/导入、公式预览和导出。
- [ ] 已从发布提交执行 `npm run dist`，得到版本与 `package.json` 一致的安装包。
- [ ] 已在无开发环境的 Windows 账户或虚拟机上测试：安装、启动、创建便签、退出重开、公式、导出、卸载、覆盖安装及数据保留。
- [ ] 已生成 SHA-256：`Get-FileHash "release\ForeJot Setup <版本号>.exe" -Algorithm SHA256`。
- [ ] 已检查 Release 中只有 `.exe` 和必要说明；不上传 `.blockmap`、ASAR、ZIP 备份、`notes.json` 或构建目录。
- [ ] 已决定是否进行 VirusTotal 扫描；若使用，理解上传二进制到第三方服务可能带来的保密与分发影响。
- [ ] 已在 Release Notes 中写清新增、修复、已知限制、升级方式与 SHA-256。

## E. 首次公开和发布后

- [ ] 首次推送后，检查 GitHub 代码页、提交历史、Actions 日志和 Release 附件，不含私人数据与异常文件。
- [ ] 从 GitHub Release 下载一次安装包，并用 SHA-256 确认它与发布时校验值一致。
- [ ] 在 Windows SmartScreen 显示未知发布者的情况下，只引导用户通过 Release 页和 SHA-256 验证来源；不承诺不存在该提示。
- [ ] 确认 Issue 模板可用，安全问题通过私密 Security Advisory 报告。
- [ ] 定期查看 Actions、Dependabot 和安全公告；依赖升级后重新运行完整验证。
- [ ] 将每个版本的发布提交、标签、Release Notes 和安装包校验值保留为可追溯记录。

## 当前发布前的固定事实

- 当前项目版本：`1.0.1`。
- 当前应用 ForeJot（中文界面名称为“驻笺”）仅支持 Windows 10/11 64 位。
- 用户数据路径：`%APPDATA%\floating-notes\notes.json`，不属于源码或发布附件。
- 当前没有账号、云同步、广告、遥测或自动更新。
- 当前 Windows 安装包未使用商业代码签名；SmartScreen 提示需要通过可信发布来源和校验值降低风险，代码签名需另行取得。
