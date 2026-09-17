---
name: juyou-release
description: "发布聚游助手桌面应用的新版本：同步 SemVer、构建并签名 macOS/Windows/Linux 安装包、上传阿里云 OSS 更新产物和 latest.json。仅用于版本发布与更新渠道维护。"
---

# 聚游助手版本发布

用于用户明确要求发布新版本、升级版本号、生成桌面安装包或更新 Tauri updater 更新清单时。

## 发布流程

1. 在仓库根目录确认版本一致：`pnpm version:check`。
2. 检查 `.release.env` 已配置 OSS 上传凭据、Bucket/Endpoint 和 Tauri updater 私钥；不要输出或提交密钥。
3. 先执行 dry-run：
   `pnpm release:local -- --bump patch --dry-run`。
4. 用户确认发布范围后，执行完整发布，例如：
   - 稳定版补丁：`pnpm release:local -- --bump patch`
   - 指定稳定版：`pnpm release:local -- --version 1.1.0`
   - Beta：`pnpm release:local -- --version 1.2.0-beta.1 --channel beta`
5. 默认构建 macOS、Windows、Linux 三个平台。上传 OSS 时必须使用 `--platform all`，避免 latest.json 缺少平台；单平台只能使用 `--build-only`。
6. 发布脚本会同步 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`，构建并签名安装包，上传不可变版本目录，最后更新 `channels/<channel>/latest.json`。
7. 发布后验证清单：
   `curl -fsSL <OSS_PUBLIC_BASE_URL>/<OSS_RELEASE_PREFIX>/channels/<channel>/latest.json | jq .`
   检查版本号、各平台 `url` 和 `signature`，并确认 URL 可匿名下载。

## 环境要求

- macOS 包必须在 macOS 上构建；Windows 交叉编译需要 `cargo-xwin` 和 `makensis`。
- Linux x86_64 构建需要 Docker Desktop。
- Tauri 私钥必须与 `src-tauri/tauri.conf.json` 中的 updater 公钥匹配。
- 正式发布前建议运行 `pnpm typecheck`、`pnpm test:unit`、`pnpm test:release`。

## 安全与回滚

- 不要把 `.release.env`、AccessKey、私钥写入仓库、命令行日志或回复。
- 发布脚本不会自动 commit、tag 或 push；发布完成后应先验证 OSS，再由用户决定是否提交 Git。
- 回滚通过把目标版本的 `versions/vX.Y.Z/latest.json` 重新上传为通道 `latest.json`，不要删除版本产物；Tauri 不会自动降级已安装的新版本。

详细的 OSS 配置、构建环境和目录结构见项目文档：
`docs/guides/local-oss-release-zh.md`。
