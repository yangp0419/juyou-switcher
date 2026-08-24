import { info as logInfo } from "@tauri-apps/plugin-log";
import { request } from "./client";
import type {
  JuyouUser,
  EmailCodeLoginRequest,
  LoginRequest,
  SendEmailCodeRequest,
} from "./types";

const EMAIL_LOGIN_CODE_ENDPOINT = "/api/verification/email-login";

function logLoginResponse(source: string, user: JuyouUser): JuyouUser {
  const fields = Object.keys(user);
  const tokenFields = fields.filter((field) => /token/i.test(field));
  const line = `[Juyou API] ${source} 登录响应字段 ${JSON.stringify({
    userId: user.id,
    fields,
    tokenFields,
    hasAccessToken: Boolean(
      user.access_token || user.accessToken || user.token,
    ),
  })}`;
  console.info(line);
  void logInfo(line).catch(() => undefined);
  return user;
}

export async function login(req: LoginRequest): Promise<JuyouUser> {
  const user = await request<JuyouUser>("/api/user/login", {
    method: "POST",
    body: req,
  });
  return logLoginResponse("密码", user);
}

export async function loginByEmailCode(
  req: EmailCodeLoginRequest,
): Promise<JuyouUser> {
  const { turnstile, ...body } = req;
  const user = await request<JuyouUser>("/api/user/login/email-code", {
    method: "POST",
    body,
    query: { turnstile },
  });
  return logLoginResponse("邮箱验证码", user);
}

export async function sendEmailLoginCode(
  req: SendEmailCodeRequest,
): Promise<void> {
  const { email, turnstile } = req;
  await request<null>(EMAIL_LOGIN_CODE_ENDPOINT, {
    query: { email, turnstile },
  });
}

export async function logout(): Promise<void> {
  await request<null>("/api/user/logout");
}

export async function getCurrentUser(): Promise<JuyouUser> {
  return request<JuyouUser>("/api/user/self");
}

export async function updateUser(data: {
  username?: string;
  display_name?: string;
  password?: string;
  original_password?: string;
}): Promise<void> {
  await request<null>("/api/user/self", {
    method: "PUT",
    body: data,
  });
}

export async function topupByCode(key: string): Promise<number> {
  return request<number>("/api/user/topup", {
    method: "POST",
    body: { key },
  });
}
