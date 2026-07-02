// Juyou 后端 API 类型定义

// 标准响应信封
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// 用户信息
export interface JuyouUser {
  id: number;
  username: string;
  display_name: string;
  role: number;
  status: number;
  email: string;
  phone: string;
  quota: number;
  used_quota: number;
  request_count: number;
  group: string;
  aff_code: string;
  access_token?: string;
  accessToken?: string;
  token?: string;
  aff_count?: number;
  aff_quota?: number;
  setting?: Record<string, unknown>;
  permissions?: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PhoneCodeLoginRequest {
  phone: string;
  code: string;
  aff_code?: string;
  turnstile?: string;
}

export interface SendPhoneCodeRequest {
  phone: string;
  turnstile?: string;
}

// 令牌（API 密钥）
export interface JuyouToken {
  id: number;
  user_id?: number;
  name: string;
  key: string;
  status: number;
  remain_quota: number;
  unlimited_quota: boolean;
  expired_time: number;
  created_time: number;
  accessed_time: number;
  used_quota?: number;
  model_limits_enabled?: boolean;
  model_limits?: string;
  models?: string[] | string | null;
  allow_ips?: string;
  group: string;
  cross_group_retry?: boolean;
}

export interface CreateTokenRequest {
  name: string;
  remain_quota?: number;
  expired_time?: number;
  unlimited_quota?: boolean;
  model_limits_enabled?: boolean;
  model_limits?: string[] | string;
  allow_ips?: string;
  group?: string;
  cross_group_retry?: boolean;
}

export interface UpdateTokenRequest {
  id: number;
  name?: string;
  remain_quota?: number;
  status?: number;
  unlimited_quota?: boolean;
  expired_time?: number;
  model_limits_enabled?: boolean;
  model_limits?: string[] | string;
  allow_ips?: string;
  group?: string;
  cross_group_retry?: boolean;
}

// 日志
export interface JuyouLog {
  id: number;
  created_at: number;
  type: number;
  username: string;
  token_name: string;
  model_name: string;
  quota: number;
  prompt_tokens: number;
  completion_tokens: number;
  channel_name: string;
  content: string;
  use_time: number;
}

export interface LogStat {
  // 后端实际返回的字段（与文档不符）
  quota?: number; // 总配额消耗
  rpm?: number; // 请求数/速率
  tpm?: number; // Token 数/速率

  // 文档里的字段（可能未实现或已废弃）
  total_quota?: number;
  total_tokens?: number;
  total_requests?: number;
  by_model?: Record<string, number>;
}

// 充值历史
export interface TopupRecord {
  id: number;
  amount: number;
  money: number;
  trade_no: string;
  payment_method: string;
  status: string;
  create_time: number;
  complete_time: number;
}

// 通用分页响应
export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface PageParams {
  p?: number;
  page?: number;
  page_size?: number;
}

export interface LogQueryParams extends PageParams {
  start_time?: number;
  end_time?: number;
  model_name?: string;
  username?: string;
  token_name?: string;
  channel_id?: number;
}

// 模型信息
export interface JuyouModel {
  model_name: string;
  pricing?: {
    input: number;
    output: number;
    unit: string;
  };
}
