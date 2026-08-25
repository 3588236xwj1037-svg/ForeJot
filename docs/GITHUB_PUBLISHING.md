# ForeJot（驻笺）GitHub 开源发布教程

本文档用于把 ForeJot（驻笺）源码公开到 GitHub，并通过 GitHub Releases 分发 Windows 安装包。它不授权任何人替你登录 GitHub、创建仓库或推送代码；这些步骤需要由仓库所有者手动完成。

先完成 [发布前检查清单](PRE_PUBLISH_CHECKLIST.md)。便签数据不属于源码，绝不能上传。

## 发布方式

仓库已经提供两条发布路径。一次版本只选择其中一条，避免同一标签被两个流程同时发布。

| 方式 | 适用情况 | 结果 |
| --- | --- | --- |
| 标签自动发布（推荐） | 希望每个正式版本都在干净的 GitHub Windows 环境重新构建 | 推送版本标签后，`release.yml` 自动测试、构建 `.exe` 并创建 Release。 |
| 浏览器手动发布 | 希望自行上传已经在本机验证过的安装包 | 需要先禁用或移除 `release.yml` 的标签触发，再在 GitHub 网页建立 Release 并上传 `.exe`。 |

无论选择哪种方式：源码进入仓库分支，安装包只作为 Release 附件上传，不提交到 Git。

## 1. 首次公开前的本地检查

在项目根目录运行：

```powershell
npm ci
npm run check:public
npm test
npm run build
npm run qa:formula
git status --short
git add --dry-run --all
```

`check:public` 会阻止已知的风险内容进入公开文件清单，包括：

- `notes.json` 与 Electron 用户数据目录。
- `.env`、疑似密钥、本机用户路径和已知私人便签文本。
- 安装包、ASAR、ZIP 备份和构建输出。

实际用户数据位于 `%APPDATA%\floating-notes\notes.json`。不要将这个文件或整个数据目录复制进项目目录、截图或 Issue 附件。

`git add --dry-run --all` 的输出就是准备公开的文件清单。请逐项查看，确认没有私人文本、个人照片、真实姓名、学校/单位信息、下载的第三方文件或安装包。

## 2. 选择许可证

公开仓库但不放许可证，并不等于开放使用。它反而会让他人没有明确的使用、修改和分发权限。桌面工具常见选择如下：

| 许可证 | 他人可以做什么 | 需要注意什么 |
| --- | --- | --- |
| MIT | 可用于商业或非商业用途，可修改和再分发。 | 衍生作品只需保留版权和许可证；不能要求衍生版本继续开源。 |
| GPL-3.0 | 可使用、修改和再分发。 | 发布衍生版本时需要同时公开相应源码；适合希望改进回流的项目。 |

决定前可以阅读 GitHub 的 [选择许可证说明](https://choosealicense.com/)。选定后：

1. 在仓库根目录新增对应的 `LICENSE` 原文，版权年份和版权所有者填写你本人或你决定使用的署名。
2. 将 `package.json` 中的 `license` 字段改为相同 SPDX 标识，例如 `MIT` 或 `GPL-3.0-only`。
3. 更新 README 的 License 章节，删除“首次公开前必须选择”的提示。

许可证处理的是代码授权，不等于商标授权，也不能代替法律意见。

## 3. 名称、版权与开源边界

- ForeJot（驻笺）是软件产品名称，不是公司名称。当前 Windows 文件属性中的公司字段已留空。
- 在公开前，自行检索中国商标网、国家企业信用信息公示系统和 GitHub/应用商店中是否已有相同或近似名称。发现冲突风险时，咨询具备资质的专业人士后再决定是否更名或注册。
- 不要声称已经注册商标、拥有公司主体、获得第三方认证或具有某种资质，除非你能提供真实证明。
- 检查应用图标、截图、字体、示例内容和依赖许可证。只发布你有权公开的内容。
- 开源代码与个人便签必须隔离。`%APPDATA%\floating-notes\notes.json` 始终保留在电脑本地，绝不进入仓库或 Release。

## 4. 创建本地首个提交

确认公开清单没有问题后，创建首个提交：

```powershell
git add --all
git commit -m "Initial open-source release"
git branch -M main
```

如果 `git commit` 提示没有作者身份，请只在本机配置提交署名。提交邮箱可以使用 GitHub 的 `noreply` 地址，以避免在公开提交历史中显示私人邮箱：

```powershell
git config --global user.name "<你的公开署名>"
git config --global user.email "<你的 GitHub noreply 邮箱>"
```

在 GitHub 的邮箱设置中启用“隐藏我的邮箱地址”后，复制该页面给出的 `noreply` 地址。不要在仓库文件、提交信息或截图中保存密码和访问令牌。

## 5. 在 GitHub 网页创建空仓库

1. 为 GitHub 账号启用双重验证，保存恢复代码，并确认账号邮箱可用。
2. 登录 GitHub，点击右上角 **New repository**。
3. 输入仓库名，例如 `forejot`，选择 **Public**。
4. 不勾选 README、`.gitignore` 或 License 初始化，因为本地已有对应文件或即将添加许可证。
5. 点击 **Create repository**，复制 HTTPS 仓库地址，例如：

```text
https://github.com/<你的用户名>/forejot.git
```

6. 在本地连接并推送源码：

```powershell
git remote add origin https://github.com/<你的用户名>/zhujian-notes.git
git push -u origin main
```

GitHub 要求认证时，使用浏览器登录或官方 GitHub CLI 完成认证。访问令牌只应保存在凭据管理器或 GitHub CLI 中，不能写入项目文件或命令历史截图。

推送完成后，在 GitHub 网页检查 Code 标签页、提交历史和 Actions 页面。首次公开后再添加到 `.gitignore` 的文件无法从历史中自动消失；发现误传隐私或密钥时，应立刻撤销相关凭据、联系平台支持，并按 GitHub 的历史清理指引处理。

## 6. 以标签自动创建 Release（推荐）

当前 `.github/workflows/release.yml` 会在推送 `v*` 标签时执行：安装锁定依赖、检查公开文件、运行测试、验证标签和 `package.json` 版本一致、构建 Windows 安装包，然后创建 GitHub Release。它只上传 `.exe`，不会上传 `.blockmap`。

以当前 `1.0.1` 为例：

```powershell
# package.json 的 version 必须是 1.0.1，且所有版本修改已经提交
git tag v1.0.1
git push origin v1.0.1
```

然后打开仓库的 **Actions** 页面，确认 `Release` 工作流全部成功；再打开 **Releases** 下载该工作流生成的安装包测试。不要把本机的 `.exe` 提交到 `main`，也不要把包含私人数据的备份作为 Release Asset 上传。

在 GitHub 仓库的 Settings 中，建议为 `main` 设置分支保护：要求 Pull Request 审核（如未来有协作者）和 CI 通过后才允许合并。个人单人维护时可按实际工作流放宽，不要让规则阻断自己修复紧急问题。

## 7. 在网页手动创建 Release

当你确实要手动上传本机验证过的安装包时，先将 `.github/workflows/release.yml` 的标签触发禁用或将该工作流从公开仓库移除并提交，否则创建标签时会同时触发自动发布流程。

1. 从准备发布的提交构建并验证安装包：

```powershell
npm run dist
Get-FileHash "release\ForeJot Setup <版本号>.exe" -Algorithm SHA256
```

2. 使用新安装包在没有开发环境的 Windows 用户账户或虚拟机中测试安装、启动、创建便签、公式预览、重启、导出和卸载后的数据保留情况。
3. 在 GitHub 仓库打开 **Releases > Draft a new release**。
4. 在 **Choose a tag** 中输入 `v<版本号>`，并从已推送的发布提交创建标签；标签必须与 `package.json` 的 `version` 完全一致。
5. 标题填写 `ForeJot <版本号>`，说明使用英文 `docs/RELEASE_NOTES_<版本号>.md` 和中文 `docs/RELEASE_NOTES_<版本号>.zh-CN.md` 的内容，写清升级提示、已知限制与 SHA-256。
6. 仅上传 `ForeJot Setup <版本号>.exe`。`.blockmap` 只在以后接入自动更新机制时才有用途，目前不上传；不要上传 `notes.json`、ZIP 备份、ASAR 或开发构建产物。
7. 可先勾选 **Set as a pre-release** 让少数测试者试用，确认无误后再发布为正式版本。

手动 Release 与标签自动 Release 不要对同一版本并用。若已启用自动流程，只需推送标签。

## 8. 安装包校验与版本说明

每次正式发布都应在 Release 正文中提供 SHA-256 值。用户下载后可在 PowerShell 中核对：

```powershell
Get-FileHash "<下载目录>\ForeJot Setup <版本号>.exe" -Algorithm SHA256
```

正式发布的 `1.0.1` 安装包 SHA-256 应写入 Release 正文和 `docs/RELEASE_NOTES_1.0.1.md`：

```text
3C2AA0DC9204D9B3F2F2D1CD0CF793B235202EAFDD05028C97701EC5872B2A2B
```

只发布由对应提交构建并经过实际安装测试的安装包。可选择将安装包提交至 VirusTotal 扫描；这有助于发现异常，但不替代你自己的安装、启动和数据回归测试。当前安装包未使用商业代码签名，Windows SmartScreen 可能提示未知发布者。若要改善这个提示，需要购买受信任的 Windows 代码签名证书或配置 Azure Trusted Signing；GitHub 不能替代代码签名。

## 9. 后续版本

每次发布先修改版本号、更新 `CHANGELOG.md` 和对应发布说明。下一个补丁版本示例为 `1.0.2`：

```powershell
npm version 1.0.2 --no-git-tag-version
npm run check:public
npm test
npm run build
npm run qa:formula
git add --all
git commit -m "Release 1.0.3"
git tag v1.0.3
git push origin main
git push origin v1.0.3
```

若采用自动发布，最后一条命令会启动工作流。若采用网页手动发布，请按第 7 节处理工作流和 Release。

## 10. 发布后检查

- 在 GitHub 代码搜索中确认搜不到 `notes.json`、私人便签文本、本机绝对路径和凭据。
- 确认 CI 和 Release 工作流均通过，安装包来自预期的提交和版本。
- 用未安装开发依赖的 Windows 环境完成安装、启动、保存、重启、公式渲染、导出和卸载测试。
- 从 Release 页下载安装包，再次核对 SHA-256，确保上传文件没有弄错。
- 查看公开 Issue、Security Advisory 和 Dependabot 提醒；安全问题使用私密渠道处理。
- 后续如增加云同步、自动更新、遥测或其他网络能力，先更新 `PRIVACY.md`、README、Release Notes 和发布前检查项，再公开该版本。
