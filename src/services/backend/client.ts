import type { ApiEnvelope } from "./types";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { error as logError, info as logInfo } from "@tauri-apps/plugin-log";

const BASE_URL_KEY = "juyou-api-base-url";
const TOKEN_KEY = "juyou-api-token";
const DEFAULT_BASE_URL = "https://api.juyouhuyu.top"; // Juyou API 生产地址

export function getBaseUrl(): string {
  return localStorage.getItem(BASE_URL_KEY) || DEFAULT_BASE_URL;
}

export function setBaseUrl(url: string): void {
  localStorage.setItem(BASE_URL_KEY, url.replace(/\/+$/, ""));
}

// Bearer Token（用于 /v1 中继接口；/api 用户管理接口默认走 Session Cookie）
export function getApiToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setApiToken(token: string | null): void {
  const normalized = token?.trim();
  if (normalized) {
    localStorage.setItem(TOKEN_KEY, normalized);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  isAuthError: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isAuthError = status === 401 || status === 403;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  // 是否携带 Bearer Token；默认不携带，/api 用户接口使用 Session Cookie。
  useToken?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = getBaseUrl();

  // 如果是绝对路径且 base 为空，直接使用相对路径
  if (!base && path.startsWith("/")) {
    const url = new URL(path, window.location.origin);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.pathname + url.search;
  }

  // 原有逻辑：拼接 base 和 path
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

interface RequestLogEntry {
  body?: unknown;
  error?: string;
  headers?: Record<string, string>;
  hasBody?: boolean;
  method: string;
  query?: RequestOptions["query"];
  requestId: string;
  status?: number;
  durationMs?: number;
  url: string;
}

function maskSensitiveValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return "••••";
}

function maskSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveData);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (/token|key|secret|password|authorization/i.test(key)) {
          return [key, maskSensitiveValue(item)];
        }
        return [key, maskSensitiveData(item)];
      }),
    );
  }
  return value;
}

function logRequest(message: string, entry: RequestLogEntry): void {
  const line = `[Juyou API] ${message} ${JSON.stringify(entry)}`;
  console.info(line);
  void logInfo(line).catch(() => undefined);
}

function logRequestError(message: string, entry: RequestLogEntry): void {
  const line = `[Juyou API] ${message} ${JSON.stringify(entry)}`;
  console.error(line);
  void logError(line).catch(() => undefined);
}

function toTauriRequestInit(
  init: RequestInit,
): Parameters<typeof tauriFetch>[1] {
  // @tauri-apps/plugin-http internally constructs a browser Request first.
  // Passing explicit undefined values can throw opaque WebKit TypeErrors.
  const tauriInit: Parameters<typeof tauriFetch>[1] = {};
  if (init.method !== undefined) {
    tauriInit.method = init.method;
  }
  if (init.headers !== undefined) {
    tauriInit.headers = init.headers;
  }
  if (init.body !== undefined && init.body !== null) {
    tauriInit.body = init.body;
  }
  if (init.signal !== undefined && init.signal !== null) {
    tauriInit.signal = init.signal;
  }
  return tauriInit;
}

interface NativeJuyouApiResponse {
  status: number;
  status_text: string;
  headers: Array<[string, string]>;
  text: string;
}

async function fetchWithNativeCommand(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const nativeResponse = await invoke<NativeJuyouApiResponse>(
    "juyou_api_request",
    {
      request: {
        method: String(init.method ?? "GET"),
        url,
        headers: Array.from(headers.entries()),
        body:
          typeof init.body === "string"
            ? init.body
            : init.body == null
              ? null
              : String(init.body),
      },
    },
  );

  return new Response(nativeResponse.text, {
    status: nativeResponse.status,
    statusText: nativeResponse.status_text,
    headers: nativeResponse.headers,
  });
}

async function fetchWithFallback(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchWithNativeCommand(url, init);
  } catch (nativeError) {
    const nativeMessage =
      nativeError instanceof Error ? nativeError.message : String(nativeError);
    logRequestError("Rust 请求命令失败，改用 Tauri HTTP 重试", {
      requestId: "fallback",
      method: String(init.method ?? "GET"),
      url,
      error: `${nativeError instanceof Error ? nativeError.name : "Error"}: ${nativeMessage}`,
    });
  }

  try {
    return await tauriFetch(url, toTauriRequestInit(init));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logRequestError("Tauri HTTP 失败，改用浏览器 fetch 重试", {
      requestId: "fallback",
      method: String(init.method ?? "GET"),
      url,
      error: `${error instanceof Error ? error.name : "Error"}: ${message}`,
    });

    return await fetch(url, init);
  }
}

/**
 * 发送请求并解包标准信封 {success, message, data}。
 * 失败时抛出 ApiError。
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, useToken, signal } = options;

  const url = buildUrl(path, query);
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (useToken === true) {
    const token = getApiToken();
    if (token) {
      headers["Authorization"] = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
  }

  // 添加 Juyouapi-User Header（只传用户 ID，与后端 session 校验匹配）
  const juyouUserId = localStorage.getItem("juyou-user-id");
  if (juyouUserId) {
    headers["Juyouapi-User"] = juyouUserId;
  }

  const maskedHeaders = { ...headers };
  if (maskedHeaders.Authorization) {
    maskedHeaders.Authorization = maskedHeaders.Authorization.replace(
      /Bearer\s+(.{4}).+(.{4})$/,
      "Bearer $1••••••$2",
    );
  }

  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const startedAt = performance.now();
  logRequest("请求", {
    requestId,
    method,
    url,
    query,
    hasBody: body !== undefined,
    body: body !== undefined ? maskSensitiveData(body) : undefined,
    headers: maskedHeaders,
  });

  let res: Response;
  try {
    res = await fetchWithFallback(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal,
    });
  } catch (err) {
    logRequestError("请求异常", {
      requestId,
      method,
      url,
      query,
      error:
        err instanceof Error
          ? `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`
          : String(err),
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw new ApiError(err instanceof Error ? err.message : "网络请求失败", 0);
  }

  let payload: ApiEnvelope<T> | T | null = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  logRequest(res.ok ? "响应" : "响应失败", {
    requestId,
    method,
    url,
    query,
    status: res.status,
    durationMs: Math.round(performance.now() - startedAt),
  });

  // 标准信封
  if (
    payload &&
    typeof payload === "object" &&
    "success" in (payload as Record<string, unknown>)
  ) {
    const env = payload as ApiEnvelope<T>;
    if (!env.success) {
      logRequestError("业务失败", {
        requestId,
        method,
        url,
        query,
        status: res.status,
        error: env.message || "请求失败",
        durationMs: Math.round(performance.now() - startedAt),
      });
      if (res.status === 401 || res.status === 403) {
        setApiToken(null);
        localStorage.removeItem("juyou-user-id");
      }
      throw new ApiError(env.message || "请求失败", res.status);
    }
    return env.data as T;
  }

  // 非信封格式（上游兼容），HTTP 状态判断
  if (!res.ok) {
    const message =
      (payload as { message?: string; error?: { message?: string } } | null)
        ?.message ||
      (payload as { error?: { message?: string } } | null)?.error?.message ||
      `请求失败 (${res.status})`;
    if (res.status === 401 || res.status === 403) {
      setApiToken(null);
      localStorage.removeItem("juyou-user-id");
    }
    throw new ApiError(message, res.status);
  }

  return payload as T;
}
