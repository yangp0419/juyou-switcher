import { request } from "./client";
import type {
  JuyouToken,
  CreateTokenRequest,
  UpdateTokenRequest,
  Paginated,
  PageParams,
} from "./types";

function serializeModelLimits<
  T extends CreateTokenRequest | UpdateTokenRequest,
>(req: T): T {
  if (Array.isArray(req.model_limits)) {
    return { ...req, model_limits: req.model_limits.join(",") };
  }
  return req;
}

export async function getTokens(
  params: PageParams = {},
): Promise<Paginated<JuyouToken>> {
  return request<Paginated<JuyouToken>>("/api/token", {
    query: {
      page: params.page || 1,
      page_size: params.page_size || 10,
    },
  });
}

export async function createToken(
  req: CreateTokenRequest,
): Promise<{ id: number; key: string }> {
  return request<{ id: number; key: string }>("/api/token", {
    method: "POST",
    body: serializeModelLimits(req),
  });
}

export async function updateToken(req: UpdateTokenRequest): Promise<void> {
  await request<null>("/api/token", {
    method: "PUT",
    body: serializeModelLimits(req),
  });
}

export async function deleteToken(id: number): Promise<void> {
  await request<null>(`/api/token/${id}`, {
    method: "DELETE",
  });
}

export async function getTokenKey(id: number): Promise<{ key: string }> {
  return request<{ key: string }>(`/api/token/${id}/key`, {
    method: "POST",
  });
}
