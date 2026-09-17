import crypto from "node:crypto";
import { createReadStream, readFileSync, statSync } from "node:fs";
import https from "node:https";

export function loadEnvFile(path) {
  const values = {};
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return values;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

export function normalizeOssConfig(values) {
  const required = [
    "OSS_ACCESS_KEY_ID",
    "OSS_ACCESS_KEY_SECRET",
    "OSS_BUCKET",
    "OSS_ENDPOINT",
  ];
  const missing = required.filter((key) => !values[key]);
  if (missing.length) throw new Error(`缺少 OSS 配置：${missing.join(", ")}`);

  const endpoint = values.OSS_ENDPOINT.replace(/^https?:\/\//, "").replace(
    /\/$/,
    "",
  );

  return {
    accessKeyId: values.OSS_ACCESS_KEY_ID,
    accessKeySecret: values.OSS_ACCESS_KEY_SECRET,
    bucket: values.OSS_BUCKET,
    endpoint,
    publicBaseUrl: (
      values.OSS_PUBLIC_BASE_URL || `https://${values.OSS_BUCKET}.${endpoint}`
    ).replace(/\/$/, ""),
    releasePrefix: (
      values.OSS_RELEASE_PREFIX || "juyou-switcher/releases"
    ).replace(/^\/+|\/+$/g, ""),
  };
}

export function encodeObjectKey(objectKey) {
  return objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function publicObjectUrl(config, objectKey) {
  return `${config.publicBaseUrl}/${encodeObjectKey(objectKey)}`;
}

export function uploadObject(config, objectKey, filePath, options = {}) {
  const contentType = options.contentType ?? "application/octet-stream";
  const acl = options.acl ?? "public-read";
  const cacheControl =
    options.cacheControl ?? "public, max-age=31536000, immutable";
  const date = new Date().toUTCString();
  const canonicalHeaders = acl ? `x-oss-object-acl:${acl}\n` : "";
  const canonicalResource = `/${config.bucket}/${objectKey}`;
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalHeaders}${canonicalResource}`;
  const signature = crypto
    .createHmac("sha1", config.accessKeySecret)
    .update(stringToSign)
    .digest("base64");
  const url = `https://${config.bucket}.${config.endpoint}/${encodeObjectKey(objectKey)}`;

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "PUT",
        headers: {
          Authorization: `OSS ${config.accessKeyId}:${signature}`,
          Date: date,
          "Content-Type": contentType,
          "Content-Length": statSync(filePath).size,
          "Cache-Control": cacheControl,
          ...(acl ? { "x-oss-object-acl": acl } : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
            return;
          }
          reject(
            new Error(
              `OSS 上传失败 (${response.statusCode})：${Buffer.concat(chunks).toString("utf8")}`,
            ),
          );
        });
      },
    );
    request.on("error", reject);
    createReadStream(filePath).on("error", reject).pipe(request);
  });
}
