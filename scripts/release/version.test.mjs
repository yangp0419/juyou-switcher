import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  assertVersionConsistency,
  bumpVersion,
  normalizeVersion,
  setProjectVersion,
} from "./version.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "juyou-release-version-"));
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "juyou-switcher", version: "1.2.3" })}\n`,
  );
  writeFileSync(
    join(root, "src-tauri", "Cargo.toml"),
    '[package]\nname = "juyou-switcher"\nversion = "1.2.3"\n',
  );
  writeFileSync(
    join(root, "src-tauri", "Cargo.lock"),
    '[[package]]\nname = "juyou-switcher"\nversion = "1.2.3"\n',
  );
  writeFileSync(
    join(root, "src-tauri", "tauri.conf.json"),
    `${JSON.stringify({ version: "1.2.3" })}\n`,
  );
  return root;
}

test("normalizes and bumps semantic versions", () => {
  expect(normalizeVersion("v1.2.3-beta.1")).toBe("1.2.3-beta.1");
  expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
  expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
  expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
});

test("updates every project version source", () => {
  const root = fixture();
  try {
    expect(assertVersionConsistency(root)).toBe("1.2.3");
    expect(setProjectVersion(root, "1.3.0-beta.1")).toBe("1.3.0-beta.1");
  } finally {
    rmSync(root, { recursive: true });
  }
});
