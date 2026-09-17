#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  loadEnvFile,
  normalizeOssConfig,
  publicObjectUrl,
  uploadObject,
} from "./release/oss.mjs";
import {
  assertVersionConsistency,
  bumpVersion,
  normalizeVersion,
  setProjectVersion,
} from "./release/version.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_ROOT = join(ROOT, ".release");
const TARGET_ROOT = join(RELEASE_ROOT, "target");
const PLATFORM_NAMES = ["macos", "windows", "linux"];

function fail(message) {
  throw new Error(message);
}

function printHelp() {
  console.log(`本地跨平台发布到阿里云 OSS

用法：
  pnpm release:local -- --bump patch
  pnpm release:local -- --version 1.1.0-beta.1 --channel beta
  pnpm release:local -- --version 1.0.3 --skip-build
  pnpm release:local -- --version 1.0.3 --platform macos --build-only

参数：
  --bump major|minor|patch   按 SemVer 递增版本（stable 通道）
  --version <x.y.z>         指定版本，也支持 x.y.z-beta.n
  --channel stable|beta     更新通道，默认 stable
  --platform <value>        all、native、macos、windows、linux，默认 all
  --skip-build              复用 .release/target 中已有构建产物
  --build-only              只构建和归档，不上传 OSS
  --dry-run                 只检查配置并展示计划
  --check-version           检查四处项目版本号是否一致
`);
}

function parseArgs(argv) {
  const args = {
    bump: null,
    version: null,
    channel: "stable",
    platform: "all",
    skipBuild: false,
    buildOnly: false,
    dryRun: false,
    checkVersion: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--bump") args.bump = argv[++index];
    else if (arg === "--version") args.version = argv[++index];
    else if (arg === "--channel") args.channel = argv[++index];
    else if (arg === "--platform") args.platform = argv[++index];
    else if (arg === "--skip-build") args.skipBuild = true;
    else if (arg === "--build-only") args.buildOnly = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--check-version") args.checkVersion = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else fail(`未知参数：${arg}`);
  }
  return args;
}

function commandExists(command) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  if (options.dryRun) return;
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    fail(`${command} 执行失败，退出码：${result.status ?? "unknown"}`);
  }
}

function resolvePlatforms(value) {
  if (value === "all") return [...PLATFORM_NAMES];
  if (value === "native") {
    if (process.platform === "darwin") return ["macos"];
    if (process.platform === "win32") return ["windows"];
    if (process.platform === "linux") return ["linux"];
  }
  const platforms = String(value).split(",");
  if (platforms.some((platform) => !PLATFORM_NAMES.includes(platform))) {
    fail(`不支持的平台：${value}`);
  }
  return platforms;
}

function validateReleasePolicy(args, version, platforms) {
  if (!["stable", "beta"].includes(args.channel)) {
    fail(`不支持的更新通道：${args.channel}`);
  }
  const isPrerelease = version.includes("-");
  if (args.channel === "stable" && isPrerelease) {
    fail("stable 通道不能发布预发布版本，请使用 --channel beta");
  }
  if (args.channel === "beta" && !isPrerelease) {
    fail("beta 通道版本必须带预发布后缀，例如 1.1.0-beta.1");
  }
  if (!args.buildOnly && platforms.length !== PLATFORM_NAMES.length) {
    fail(
      "为避免 latest.json 丢失平台，上传 OSS 时必须使用 --platform all；单平台请加 --build-only",
    );
  }
}

function loadReleaseConfig() {
  const fileValues = loadEnvFile(join(ROOT, ".release.env"));
  const values = { ...fileValues, ...process.env };
  values.TAURI_SIGNING_PRIVATE_KEY_PATH ||= join(
    homedir(),
    ".tauri",
    "juyou-switcher.key",
  );
  return values;
}

function updaterEndpoint(oss, channel) {
  return publicObjectUrl(
    oss,
    `${oss.releasePrefix}/channels/${channel}/latest.json`,
  );
}

function writeTauriBuildConfig(oss, channel, platform) {
  const bundleTargets = {
    macos: ["app", "dmg"],
    windows: ["nsis"],
    linux: ["appimage", "deb", "rpm"],
  };
  const path = join(RELEASE_ROOT, `tauri.${channel}.${platform}.conf.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        bundle: { targets: bundleTargets[platform] },
        plugins: { updater: { endpoints: [updaterEndpoint(oss, channel)] } },
      },
      null,
      2,
    )}\n`,
  );
  return path;
}

function signingEnvironment(values, targetDir) {
  const keyPath = values.TAURI_SIGNING_PRIVATE_KEY_PATH;
  if (!keyPath || !existsSync(keyPath)) {
    fail(
      `找不到 Tauri updater 私钥：${keyPath || "TAURI_SIGNING_PRIVATE_KEY_PATH 未配置"}`,
    );
  }
  const optionalSigningValues = [
    "APPLE_SIGNING_IDENTITY",
    "APPLE_ID",
    "APPLE_PASSWORD",
    "APPLE_TEAM_ID",
  ].reduce((result, key) => {
    if (values[key]) result[key] = values[key];
    return result;
  }, {});

  return {
    ...process.env,
    ...optionalSigningValues,
    CARGO_TARGET_DIR: targetDir,
    TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
    // Tauri bundler reads the updater key from this variable when producing
    // cross-platform artifacts. Keep the path variable as well for the CLI
    // signer fallback, but never print the key or persist it to the repo.
    TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyPath, "utf8"),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD:
      values.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
  };
}

function platformTargetDir(version, platform) {
  return join(TARGET_ROOT, `v${version}`, platform);
}

function buildMacos(values, configPath, version, dryRun) {
  if (process.platform !== "darwin") {
    fail("macOS 安装包必须在 macOS 主机上构建、签名和公证");
  }
  const env = signingEnvironment(values, platformTargetDir(version, "macos"));
  run(
    "rustup",
    ["target", "add", "aarch64-apple-darwin", "x86_64-apple-darwin"],
    { dryRun, env },
  );
  run(
    "pnpm",
    [
      "tauri",
      "build",
      "--target",
      "universal-apple-darwin",
      "--config",
      relative(ROOT, configPath),
    ],
    { dryRun, env },
  );
}

function buildWindows(values, configPath, version, dryRun) {
  if (!commandExists("cargo-xwin")) {
    fail("Windows 交叉编译需要 cargo-xwin，请先执行 cargo install cargo-xwin");
  }
  if (!commandExists("makensis")) {
    fail("Windows NSIS 打包需要 makensis，请先执行 brew install makensis");
  }
  const env = signingEnvironment(values, platformTargetDir(version, "windows"));
  run("rustup", ["target", "add", "x86_64-pc-windows-msvc"], {
    dryRun,
    env,
  });
  run(
    "pnpm",
    [
      "tauri",
      "build",
      "--runner",
      "cargo-xwin",
      "--target",
      "x86_64-pc-windows-msvc",
      "--config",
      relative(ROOT, configPath),
    ],
    { dryRun, env },
  );
}

function buildLinux(values, configPath, version, dryRun) {
  if (!commandExists("docker")) {
    fail("Linux x86_64 构建需要 Docker Desktop");
  }
  const keyPath = values.TAURI_SIGNING_PRIVATE_KEY_PATH;
  if (!keyPath || !existsSync(keyPath)) {
    fail(
      `找不到 Tauri updater 私钥：${keyPath || "TAURI_SIGNING_PRIVATE_KEY_PATH 未配置"}`,
    );
  }
  const image =
    values.LINUX_BUILDER_IMAGE || "juyou-switcher-linux-builder:local";
  const dockerEnv = {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD:
      values.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
  };
  run(
    "docker",
    [
      "build",
      "--platform",
      "linux/amd64",
      "-f",
      "scripts/linux-builder.Dockerfile",
      "-t",
      image,
      ".",
    ],
    { dryRun },
  );
  run(
    "docker",
    [
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "-v",
      `${ROOT}:/workspace`,
      "-v",
      "juyou-switcher-release-node-modules:/workspace/node_modules",
      "-v",
      `${keyPath}:/run/secrets/tauri.key:ro`,
      "-w",
      "/workspace",
      "-e",
      `CARGO_TARGET_DIR=/workspace/.release/target/v${version}/linux`,
      "-e",
      "TAURI_SIGNING_PRIVATE_KEY_PATH=/run/secrets/tauri.key",
      "-e",
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
      image,
      "bash",
      "-lc",
      `pnpm install --frozen-lockfile && pnpm tauri build --target x86_64-unknown-linux-gnu --config ${relative(ROOT, configPath)}`,
    ],
    { dryRun, env: dockerEnv },
  );
}

function buildPlatform(platform, values, oss, channel, version, dryRun) {
  const configPath = writeTauriBuildConfig(oss, channel, platform);
  if (platform === "macos") buildMacos(values, configPath, version, dryRun);
  else if (platform === "windows") {
    buildWindows(values, configPath, version, dryRun);
  } else buildLinux(values, configPath, version, dryRun);
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function findNewestBySuffix(files, suffix) {
  return files
    .filter((path) => path.toLowerCase().endsWith(suffix.toLowerCase()))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
}

function contentType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".dmg")) return "application/x-apple-diskimage";
  if (lower.endsWith(".tar.gz")) return "application/gzip";
  if (lower.endsWith(".appimage")) return "application/octet-stream";
  if (lower.endsWith(".exe"))
    return "application/vnd.microsoft.portable-executable";
  if (lower.endsWith(".deb")) return "application/vnd.debian.binary-package";
  if (lower.endsWith(".rpm")) return "application/x-rpm";
  if (lower.endsWith(".sig")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function stageFile(source, destination) {
  if (!source) return null;
  copyFileSync(source, destination);
  const sourceSignature = `${source}.sig`;
  const signature = existsSync(sourceSignature) ? `${destination}.sig` : null;
  if (signature) copyFileSync(sourceSignature, signature);
  return { path: destination, signature };
}

function stageArtifacts(platforms, version, channel) {
  const stageRoot = join(RELEASE_ROOT, "publish", channel, `v${version}`);
  if (existsSync(stageRoot)) rmSync(stageRoot, { recursive: true });
  mkdirSync(stageRoot, { recursive: true });
  const staged = {};

  for (const platform of platforms) {
    const files = walkFiles(platformTargetDir(version, platform)).filter(
      (path) => path.includes(`${sep}bundle${sep}`),
    );
    const specs =
      platform === "macos"
        ? [
            [".dmg", `juyou-switcher-v${version}-macOS.dmg`, false],
            [".tar.gz", `juyou-switcher-v${version}-macOS.tar.gz`, true],
          ]
        : platform === "windows"
          ? [[".exe", `juyou-switcher-v${version}-Windows-Setup.exe`, true]]
          : [
              [
                ".appimage",
                `juyou-switcher-v${version}-Linux-x86_64.AppImage`,
                true,
              ],
              [".deb", `juyou-switcher-v${version}-Linux-x86_64.deb`, false],
              [".rpm", `juyou-switcher-v${version}-Linux-x86_64.rpm`, false],
            ];

    staged[platform] = [];
    for (const [suffix, name, updater] of specs) {
      const source = findNewestBySuffix(files, suffix);
      if (!source && updater) fail(`${platform} 缺少 updater 产物：${suffix}`);
      const item = stageFile(source, join(stageRoot, name));
      if (!item) continue;
      if (updater && !item.signature) {
        fail(`${platform} updater 产物缺少签名：${source}.sig`);
      }
      staged[platform].push({ ...item, updater });
    }
  }
  return { stageRoot, staged };
}

function sha256(path) {
  return crypto.createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeChecksums(stageRoot, staged) {
  const files = Object.values(staged)
    .flat()
    .flatMap((item) => [item.path, item.signature].filter(Boolean));
  const contents = files
    .map((path) => `${sha256(path)}  ${path.split("/").pop()}`)
    .join("\n");
  const path = join(stageRoot, "SHA256SUMS");
  writeFileSync(path, `${contents}\n`);
  return path;
}

function createLatestManifest(version, staged, oss, channel) {
  const platforms = {};
  const add = (platform, key) => {
    const item = staged[platform]?.find((candidate) => candidate.updater);
    if (!item) return;
    const fileName = item.path.split("/").pop();
    const objectKey = `${oss.releasePrefix}/versions/v${version}/${fileName}`;
    platforms[key] = {
      signature: readFileSync(item.signature, "utf8").trim(),
      url: publicObjectUrl(oss, objectKey),
    };
  };
  add("macos", "darwin-aarch64");
  add("macos", "darwin-x86_64");
  add("windows", "windows-x86_64");
  add("linux", "linux-x86_64");

  return {
    version,
    notes: `Release v${version} (${channel})`,
    pub_date: new Date().toISOString(),
    platforms,
  };
}

async function uploadRelease(version, channel, stageRoot, staged, oss) {
  const versionPrefix = `${oss.releasePrefix}/versions/v${version}`;
  const files = Object.values(staged)
    .flat()
    .flatMap((item) => [item.path, item.signature].filter(Boolean));
  files.push(writeChecksums(stageRoot, staged));

  for (const path of files) {
    const objectKey = `${versionPrefix}/${path.split("/").pop()}`;
    console.log(`上传：${objectKey}`);
    await uploadObject(oss, objectKey, path, {
      contentType: contentType(path),
    });
  }

  const manifest = createLatestManifest(version, staged, oss, channel);
  const manifestPath = join(stageRoot, "latest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const versionManifestObject = `${versionPrefix}/latest.json`;
  console.log(`上传版本索引：${versionManifestObject}`);
  await uploadObject(oss, versionManifestObject, manifestPath, {
    contentType: "application/json",
  });
  const manifestObject = `${oss.releasePrefix}/channels/${channel}/latest.json`;
  console.log(`发布更新索引：${manifestObject}`);
  await uploadObject(oss, manifestObject, manifestPath, {
    contentType: "application/json",
    cacheControl: "no-cache, no-store, must-revalidate",
  });
  return publicObjectUrl(oss, manifestObject);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentVersion = assertVersionConsistency(ROOT);
  if (args.checkVersion) {
    console.log(`版本号一致：${currentVersion}`);
    return;
  }
  if (args.bump && args.version) fail("--bump 和 --version 不能同时使用");
  if (!args.bump && !args.version) {
    fail("请指定 --bump major|minor|patch 或 --version x.y.z");
  }

  const version = args.version
    ? normalizeVersion(args.version)
    : bumpVersion(currentVersion, args.bump);
  const platforms = resolvePlatforms(args.platform);
  validateReleasePolicy(args, version, platforms);

  const values = loadReleaseConfig();
  const oss = normalizeOssConfig(values);
  const endpoint = updaterEndpoint(oss, args.channel);
  console.log(`当前版本：${currentVersion}`);
  console.log(`目标版本：${version}`);
  console.log(`发布通道：${args.channel}`);
  console.log(`构建平台：${platforms.join(", ")}`);
  console.log(`更新索引：${endpoint}`);

  if (args.dryRun) {
    signingEnvironment(values, join(TARGET_ROOT, "dry-run"));
    console.log("\nDry run 通过，未修改版本、未构建、未上传。");
    return;
  }

  if (version !== currentVersion) setProjectVersion(ROOT, version);
  if (!args.skipBuild) {
    for (const platform of platforms) {
      buildPlatform(platform, values, oss, args.channel, version, false);
    }
  }

  const { stageRoot, staged } = stageArtifacts(
    platforms,
    version,
    args.channel,
  );
  console.log(`\n产物已归档：${relative(ROOT, stageRoot)}`);
  if (args.buildOnly) return;

  const manifestUrl = await uploadRelease(
    version,
    args.channel,
    stageRoot,
    staged,
    oss,
  );
  console.log(`\n发布完成：v${version}`);
  console.log(`更新索引：${manifestUrl}`);
}

main().catch((error) => {
  console.error(
    `\n发布失败：${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
});
