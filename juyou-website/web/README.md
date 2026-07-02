# 聚游助手官网

这是独立的官网静态页面项目，不依赖 Tauri 客户端运行。

## 本地开发

```bash
cd juyou-website/web
pnpm install
pnpm dev
```

## 打包

```bash
cd juyou-website/web
pnpm build
```

构建产物在：

```text
juyou-website/web/dist
```

把 `web/dist` 上传到服务器或 CDN 即可。

## 下载链接配置

前端默认下载地址指向同域后端：

```ts
const downloadUrls = {
  mac: "/api/download?platform=mac",
  windows: "/api/download?platform=windows",
  linux: "/api/download?platform=linux",
};
```

如果后端接口和官网不在同一个域名，可以在构建前设置：

```bash
VITE_DOWNLOAD_API_BASE=https://api.example.com pnpm build
```

## Nginx 示例

```nginx
server {
  server_name your-domain.com;
  root /var/www/juyou-website/web/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```
