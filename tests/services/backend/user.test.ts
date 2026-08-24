import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-log", () => ({
  info: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/backend/client", () => ({
  request: requestMock,
}));

import { loginByEmailCode, sendEmailLoginCode } from "@/services/backend/user";
import type { JuyouUser } from "@/services/backend/types";

const user: JuyouUser = {
  id: 1,
  username: "user@example.com",
  display_name: "User",
  role: 1,
  status: 1,
  email: "user@example.com",
  phone: "",
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: "default",
  aff_code: "",
};

describe("email authentication API", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("logs in or registers with an email verification code", async () => {
    requestMock.mockResolvedValue(user);

    await expect(
      loginByEmailCode({
        email: "user@example.com",
        code: "123456",
        aff_code: "AFF",
        turnstile: "challenge-token",
      }),
    ).resolves.toEqual(user);

    expect(requestMock).toHaveBeenCalledWith("/api/user/login/email-code", {
      method: "POST",
      body: {
        email: "user@example.com",
        code: "123456",
        aff_code: "AFF",
      },
      query: { turnstile: "challenge-token" },
    });
  });

  it("requests an email login verification code", async () => {
    requestMock.mockResolvedValue(null);

    await sendEmailLoginCode({
      email: "user@example.com",
      turnstile: "challenge-token",
    });

    expect(requestMock).toHaveBeenCalledWith("/api/verification/email-login", {
      query: {
        email: "user@example.com",
        turnstile: "challenge-token",
      },
    });
  });
});
