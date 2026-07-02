# 聚游助手官网项目

这个目录同时包含官网前端和下载后端：

```text
juyou-website/
  Cargo.toml        # Rust 后端
  src/main.rs       # 官网静态资源 + 下载 API
  web/              # Vite + React 官网源码
```

## 前端开发

```bash
cd juyou-website/web
pnpm install
pnpm dev
```

## 前端打包

```bash
cd juyou-website/web
pnpm build
```

构建产物在：

```text
juyou-website/web/dist
```

## 后端开发

```bash
cd juyou-website
cp .env.example .env
make dev
```

接口：

```text
GET /health
GET /api/download?platform=mac
GET /api/download?platform=windows
GET /api/download?platform=linux
```

后端会做简单的 per-IP、per-platform 内存限流，然后 `302` 跳转到配置的 OSS/CDN 下载地址。

后端会把 `web/dist` 嵌入到 Rust 二进制里。先构建前端：
`make dev` 会先执行 `pnpm --dir web build`，再启动 Rust 后端。

```bash
cd juyou-website
make dev
```

然后访问：

```text
http://127.0.0.1:8010
```

## 生产部署

首次在 Mac 本机交叉编译 Linux x86_64 前，先安装工具：

```bash
brew install zig
cargo install cargo-zigbuild
rustup target add x86_64-unknown-linux-musl
```

构建 Linux x86_64 单个二进制：

```bash
cd juyou-website
make build
```

启动：

```bash
BIND_ADDR=0.0.0.0:8010 \
DOWNLOAD_MAC_URL=https://download.example.com/juyou-switcher/latest/juyou-switcher-mac.dmg \
DOWNLOAD_WINDOWS_URL=https://download.example.com/juyou-switcher/latest/juyou-switcher-windows.msi \
DOWNLOAD_LINUX_URL=https://download.example.com/juyou-switcher/latest/juyou-switcher-linux.AppImage \
./release/juyou-website-backend
```

## 一键打包

在本机交叉编译 Linux x86_64 后端：

```bash
cd juyou-website
make build
```

它会：

```text
1. pnpm --dir web build
2. 将 web/dist 嵌入 Rust 二进制
3. cargo zigbuild --release --target x86_64-unknown-linux-musl
4. 生成 release/juyou-website-backend
```

最终只需要部署这个文件：

```text
release/juyou-website-backend
```

注意：`make build` 现在固定生成 Linux x86_64 静态二进制，适合常见 `x86_64` Linux 服务器。服务器如果是 ARM64，需要改 Makefile 里的 `LINUX_TARGET`。

## 下载链接配置

生产环境建议通过环境变量配置：

```bash
DOWNLOAD_MAC_URL=https://download.example.com/juyou-switcher/latest/juyou-switcher-mac.dmg
DOWNLOAD_WINDOWS_URL=https://download.example.com/juyou-switcher/latest/juyou-switcher-windows.msi
DOWNLOAD_LINUX_URL=https://download.example.com/juyou-switcher/latest/juyou-switcher-linux.AppImage
```

前端按钮建议指向后端接口，而不是直接暴露 OSS 原始链接。
