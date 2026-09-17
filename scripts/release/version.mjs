import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

export function normalizeVersion(value) {
  const version = String(value ?? "").trim().replace(/^v/, "");
  if (!VERSION_RE.test(version)) {
    throw new Error(`版本必须符合 SemVer，例如 1.2.3 或 1.2.3-beta.1：${value}`);
  }
  return version;
}

export function readProjectVersions(root) {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const cargoToml = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8");
  const cargoLock = readFileSync(join(root, "src-tauri", "Cargo.lock"), "utf8");
  const tauriConfig = JSON.parse(
    readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
  );

  return {
    packageJson: packageJson.version,
    cargoToml: cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
    cargoLock: cargoLock.match(
      /\[\[package\]\]\s*\nname = "juyou-switcher"\s*\nversion = "([^"]+)"/,
    )?.[1],
    tauriConfig: tauriConfig.version,
  };
}

export function assertVersionConsistency(root) {
  const versions = readProjectVersions(root);
  const values = Object.values(versions);
  if (values.some((value) => !value) || new Set(values).size !== 1) {
    throw new Error(`项目版本号不一致：${JSON.stringify(versions)}`);
  }
  return normalizeVersion(values[0]);
}

export function bumpVersion(currentValue, releaseType) {
  const current = normalizeVersion(currentValue);
  const [major, minor, patch] = current.split("-", 1)[0].split(".").map(Number);

  if (releaseType === "major") return `${major + 1}.0.0`;
  if (releaseType === "minor") return `${major}.${minor + 1}.0`;
  if (releaseType === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`不支持的版本策略：${releaseType}`);
}

export function setProjectVersion(root, nextValue) {
  const version = normalizeVersion(nextValue);
  const packagePath = join(root, "package.json");
  const cargoTomlPath = join(root, "src-tauri", "Cargo.toml");
  const cargoLockPath = join(root, "src-tauri", "Cargo.lock");
  const tauriConfigPath = join(root, "src-tauri", "tauri.conf.json");

  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  packageJson.version = version;
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const cargoToml = readFileSync(cargoTomlPath, "utf8").replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${version}"`,
  );
  writeFileSync(cargoTomlPath, cargoToml);

  const cargoLock = readFileSync(cargoLockPath, "utf8").replace(
    /(\[\[package\]\]\s*\nname = "juyou-switcher"\s*\nversion = ")[^"]+(")/,
    `$1${version}$2`,
  );
  writeFileSync(cargoLockPath, cargoLock);

  const tauriConfig = readFileSync(tauriConfigPath, "utf8").replace(
    /("version"\s*:\s*")[^"]+(")/,
    `$1${version}$2`,
  );
  writeFileSync(tauriConfigPath, tauriConfig);

  return assertVersionConsistency(root);
}
