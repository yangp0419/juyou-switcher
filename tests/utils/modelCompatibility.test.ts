import { describe, expect, it } from "vitest";
import { isGptModelName } from "@/utils/modelCompatibility";

describe("isGptModelName", () => {
  it.each(["gpt-4o", "GPT-5.5", "openai/gpt-5.3-codex", "gpt_5"])(
    "accepts GPT model %s",
    (modelName) => {
      expect(isGptModelName(modelName)).toBe(true);
    },
  );

  it.each(["claude-3.5-sonnet", "gemini-2.5-pro", "notgpt-5", ""])(
    "rejects non-GPT model %s",
    (modelName) => {
      expect(isGptModelName(modelName)).toBe(false);
    },
  );
});
