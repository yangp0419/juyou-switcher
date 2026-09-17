import { expect, test } from "vitest";
import {
  encodeObjectKey,
  normalizeOssConfig,
  publicObjectUrl,
} from "./oss.mjs";

test("normalizes OSS endpoints and public object URLs", () => {
  const config = normalizeOssConfig({
    OSS_ACCESS_KEY_ID: "id",
    OSS_ACCESS_KEY_SECRET: "secret",
    OSS_BUCKET: "bucket",
    OSS_ENDPOINT: "https://oss-cn-hangzhou.aliyuncs.com/",
    OSS_PUBLIC_BASE_URL: "https://download.example.com/",
    OSS_RELEASE_PREFIX: "/juyou-switcher/releases/",
  });

  expect(config.endpoint).toBe("oss-cn-hangzhou.aliyuncs.com");
  expect(config.releasePrefix).toBe("juyou-switcher/releases");
  expect(encodeObjectKey("版本/a b.dmg")).toBe("%E7%89%88%E6%9C%AC/a%20b.dmg");
  expect(publicObjectUrl(config, "stable/latest.json")).toBe(
    "https://download.example.com/stable/latest.json",
  );
});

test("derives the public URL and release prefix from OSS bucket settings", () => {
  const config = normalizeOssConfig({
    OSS_ACCESS_KEY_ID: "id",
    OSS_ACCESS_KEY_SECRET: "secret",
    OSS_BUCKET: "juyouapi",
    OSS_ENDPOINT: "oss-cn-hangzhou.aliyuncs.com",
  });

  expect(config.publicBaseUrl).toBe(
    "https://juyouapi.oss-cn-hangzhou.aliyuncs.com",
  );
  expect(config.releasePrefix).toBe("juyou-switcher/releases");
});
