import { invoke } from "@tauri-apps/api/core";
import { getBaseUrl, getApiToken } from "./client";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  apiKey?: string;
}

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: ChatUsage;
}

export interface ChatCompletionStreamCallbacks {
  onDelta?: (delta: string) => void;
  onUsage?: (usage: ChatUsage) => void;
}

interface NativeJuyouApiResponse {
  status: number;
  status_text: string;
  headers: Array<[string, string]>;
  text: string;
}

async function requestChatCompletion(
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  const baseUrl = getBaseUrl();
  const { apiKey, ...body } = req;
  const token = apiKey || getApiToken();

  if (!token) {
    throw new Error("Chat API 请求失败：未找到可用 API Key");
  }

  const headers: Array<[string, string]> = [
    ["Content-Type", "application/json"],
  ];
  if (token) {
    headers.push([
      "Authorization",
      token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    ]);
  }

  const nativeResponse = await invoke<NativeJuyouApiResponse>(
    "juyou_api_request",
    {
      request: {
        method: "POST",
        url: `${baseUrl}/v1/chat/completions`,
        headers,
        body: JSON.stringify(body),
      },
    },
  );

  if (nativeResponse.status < 200 || nativeResponse.status >= 300) {
    throw new Error(
      `Chat API 请求失败 (${nativeResponse.status}): ${nativeResponse.text}`,
    );
  }

  return JSON.parse(nativeResponse.text) as ChatCompletionResponse;
}

/**
 * 发送聊天完成请求到 /v1/chat/completions（OpenAI 兼容接口）
 */
export async function sendChatCompletion(
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  return requestChatCompletion({ ...req, stream: false });
}

export async function sendChatCompletionStream(
  req: ChatCompletionRequest,
  callbacks: ChatCompletionStreamCallbacks = {},
): Promise<{ content: string; usage?: ChatUsage }> {
  // 桌面端通过 Rust 命令请求，避免 webview 跨域/插件 HTTP 问题；当前以非流式响应模拟完成回调。
  const response = await requestChatCompletion({ ...req, stream: false });
  const content = response.choices[0]?.message?.content || "";

  if (content) {
    callbacks.onDelta?.(content);
  }
  if (response.usage) {
    callbacks.onUsage?.(response.usage);
  }

  return { content, usage: response.usage };
}
