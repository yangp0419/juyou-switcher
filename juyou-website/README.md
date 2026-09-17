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

## 本地开发

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

后端会做简单的 per-IP、per-platform 内存限流，然后为私有阿里云 OSS 文件生成临时签名 URL，并通过 `302` 跳转下载。

`make dev` 会同时启动 Rust 后端和 Vite 前端开发服务。前端开发服务会把 `/api` 和 `/health` 代理到后端。

```bash
cd juyou-website
make dev
```

然后访问：

```text
http://127.0.0.1:5173
```

后端会在 `http://127.0.0.1:8010` 启动。正式构建时，`make build` 会先打包前端，再把 `web/dist` 嵌入到 Rust 二进制里。

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
OSS_ACCESS_KEY_ID=your-access-key-id \
OSS_ACCESS_KEY_SECRET=your-access-key-secret \
OSS_BUCKET=juyouapi \
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com \
OSS_MAC_OBJECT=downloads/juyou-switcher-v1.0.1-macOS.dmg \
OSS_WINDOWS_OBJECT=downloads/juyou-switcher-v1.0.1-Windows.msi \
OSS_LINUX_OBJECT=downloads/juyou-switcher-v1.0.1-Linux-x86_64.deb \
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

## 私有 OSS 下载配置

生产环境建议通过环境变量配置：

```bash
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=juyouapi
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_SIGN_EXPIRES_SECONDS=300

OSS_MAC_OBJECT=downloads/juyou-switcher-v1.0.1-macOS.dmg
OSS_WINDOWS_OBJECT=downloads/juyou-switcher-v1.0.1-Windows.msi
OSS_LINUX_OBJECT=downloads/juyou-switcher-v1.0.1-Linux-x86_64.deb
```

AccessKey 建议使用 RAM 子账号，并且只授予当前 Bucket 下载目录的 `oss:GetObject` 权限。
前端按钮继续指向后端接口，不直接暴露 OSS 原始链接。
