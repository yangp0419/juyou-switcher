# 本地跨平台构建与阿里云 OSS 发布

## 当前配置在哪里

桌面应用的发布配置分成四类：

| 配置               | 文件                               | 作用                                             |
| ------------------ | ---------------------------------- | ------------------------------------------------ |
| 前端版本           | `package.json`                     | Node/Tauri CLI 读取的应用版本                    |
| Rust 版本          | `src-tauri/Cargo.toml`             | Rust crate 版本                                  |
| Rust 锁文件版本    | `src-tauri/Cargo.lock`             | 锁文件中的当前应用版本                           |
| Tauri 版本和更新器 | `src-tauri/tauri.conf.json`        | 安装包版本、更新公钥、默认更新地址               |
| 本地发布密钥       | `.release.env`                     | OSS RAM 凭据、OSS 地址、Tauri 私钥路径；Git 忽略 |
| 本地发布流程       | `scripts/release.mjs`              | 版本同步、跨平台构建、签名、归档和上传           |
| Linux 构建环境     | `scripts/linux-builder.Dockerfile` | 在 Mac 上构建 Linux x86_64 安装包                |

仓库中另外还有 `juyou-website/.env`：它供官网后端生成私有 OSS 下载签名，不参与桌面应用构建。根目录 `.release.env` 使用的是“发布者”凭据，需要上传权限；两者不要共用同一个高权限 RAM 用户。

`src-tauri/tauri.conf.json` 默认从以下地址检查稳定版更新：

```text
https://juyouapi.oss-cn-hangzhou.aliyuncs.com/juyou-switcher/releases/channels/stable/latest.json
```

本地发布时会生成临时 Tauri 配置，并根据 `.release.env` 中的 OSS 公网地址和发布通道覆盖这个地址。

## 版本策略

项目采用 SemVer：

- `patch`：修复和小调整，例如 `1.0.2 -> 1.0.3`。
- `minor`：向后兼容的新功能，例如 `1.0.3 -> 1.1.0`。
- `major`：存在不兼容变化，例如 `1.1.0 -> 2.0.0`。
- Beta：使用 `x.y.z-beta.n`，例如 `1.2.0-beta.1`，并发布到独立的 `beta` 通道。

发布命令会同步更新四个版本来源。可以随时检查：

```bash
pnpm version:check
```

OSS 对象采用不可变版本目录，更新通道只保存一个指针：

```text
juyou-switcher/releases/
├── versions/
│   └── v1.0.3/
│       ├── juyou-switcher-v1.0.3-macOS.dmg
│       ├── juyou-switcher-v1.0.3-macOS.tar.gz
│       ├── juyou-switcher-v1.0.3-Windows-Setup.exe
│       ├── juyou-switcher-v1.0.3-Linux-x86_64.AppImage
│       ├── SHA256SUMS
│       └── latest.json
└── channels/
    ├── stable/latest.json
    └── beta/latest.json
```

所有产物先上传，`channels/<channel>/latest.json` 最后上传。这样客户端不会读到只有更新索引、但安装包还没上传完的半发布状态。

## 配置阿里云 OSS

### 1. 创建 Bucket 和公网下载地址

建议：

- Bucket 与用户尽量处于同一主要地域，例如杭州 `oss-cn-hangzhou`。
- 开启 HTTPS。
- 可以直接使用 Bucket 公网域名，也可以绑定 CDN/自定义域名。
- `latest.json` 和 Tauri updater 安装包必须能被客户端匿名下载。
- 如果 Bucket 开启了“阻止公共访问”，需要为发布前缀配置允许匿名 `GetObject` 的 Bucket Policy，或关闭该前缀的公共访问阻止。

发布脚本默认给上传对象设置 `public-read`。OSS AccessKey 只存在本机，不会进入安装包；安装包中只有公开下载 URL 和 Tauri 更新公钥。

### 2. 创建最小权限 RAM 用户

给本地发布专用 RAM 用户授予当前发布前缀的上传权限。将 Bucket 名和路径替换为真实值：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject", "oss:PutObjectAcl"],
      "Resource": ["acs:oss:*:*:juyouapi/juyou-switcher/releases/*"]
    }
  ]
}
```

不要使用阿里云主账号 AccessKey，也不要给 RAM 用户 Bucket 删除权限。

### 3. 创建本机配置

```bash
cp .release.env.example .release.env
```

编辑 `.release.env`：

```dotenv
OSS_ACCESS_KEY_ID=你的RAM用户AccessKeyId
OSS_ACCESS_KEY_SECRET=你的RAM用户AccessKeySecret
OSS_BUCKET=juyouapi
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_PUBLIC_BASE_URL=https://juyouapi.oss-cn-hangzhou.aliyuncs.com
OSS_RELEASE_PREFIX=juyou-switcher/releases

TAURI_SIGNING_PRIVATE_KEY_PATH=/Users/你的用户名/.tauri/juyou-switcher.key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
```

`OSS_PUBLIC_BASE_URL` 未填写时默认使用 `https://<bucket>.<endpoint>`，`OSS_RELEASE_PREFIX` 默认使用 `juyou-switcher/releases`，Tauri 私钥路径默认使用 `~/.tauri/juyou-switcher.key`。如果 `juyou-website/.env` 已经配置了同一个发布专用 RAM 用户，可以将其复制为根目录 `.release.env`；更推荐为官网只读下载与本地上传分别创建最小权限 RAM 用户。

`.release.env` 和 `.release/` 已被 Git 忽略。不要把 AccessKey 或 Tauri 私钥写进仓库、命令行参数或聊天记录。

## 本机构建环境

在 Apple Silicon Mac 上安装：

```bash
brew install makensis
cargo install cargo-xwin
```

还需要：

- Xcode Command Line Tools：构建 macOS universal 应用。
- Docker Desktop：在 `linux/amd64` 容器中构建 Linux x86_64 包。
- 项目现有的 Node.js、pnpm 和 Rust 环境。
- `~/.tauri/juyou-switcher.key`：必须与 `tauri.conf.json` 中的更新公钥匹配。

平台边界：

- macOS 包必须在 macOS 上构建。正式分发还需要 Developer ID 签名和 Apple 公证。
- Windows 使用 `cargo-xwin` 交叉编译，并用 NSIS 生成 Setup EXE。正式消除 SmartScreen 提示仍需要 Windows 代码签名证书。
- Linux 使用 Docker x86_64 环境原生构建 AppImage、deb 和 rpm，不直接在 macOS 上链接 WebKitGTK。

这套方案属于“一台 Mac 本地编排三个平台”，不是让单个 Rust target 绕过各操作系统的安装器和签名要求。

## 发布命令

先只检查配置，不改版本、不构建、不上传：

```bash
pnpm release:local -- --bump patch --dry-run
```

发布下一个稳定补丁版本：

```bash
pnpm release:local -- --bump patch
```

发布指定稳定版本：

```bash
pnpm release:local -- --version 1.1.0
```

发布 Beta：

```bash
pnpm release:local -- --version 1.2.0-beta.1 --channel beta
```

只构建单个平台，不更新 OSS 通道索引：

```bash
pnpm release:local -- --version 1.0.3 --platform macos --build-only
```

构建失败后，修复环境并复用已有产物重新发布：

```bash
pnpm release:local -- --version 1.0.3 --skip-build
```

构建和归档输出位于 `.release/`。发布脚本不会自动执行 Git commit、Git tag 或 Git push；确认 OSS 更新正常后再提交版本文件并打 tag。

## 发布前检查

```bash
pnpm version:check
pnpm typecheck
pnpm test:unit
pnpm test:release
```

发布后检查：

```bash
curl -fsSL \
  https://juyouapi.oss-cn-hangzhou.aliyuncs.com/juyou-switcher/releases/channels/stable/latest.json \
  | jq .
```

确认 `version` 正确，每个平台都有 `url` 和 `signature`，且所有 URL 都能匿名下载。

## 回滚

每个版本目录都保存自己的 `latest.json`。回滚时不要删除新版本产物，只需把目标版本的索引覆盖到通道索引。例如把：

```text
versions/v1.0.2/latest.json
```

重新上传为：

```text
channels/stable/latest.json
```

Tauri 默认不会自动降级已经安装的新版本；这个操作主要用于阻止旧客户端继续升级到有问题的版本。需要强制降级时应另外发布一个版本号更高的修复版本。
