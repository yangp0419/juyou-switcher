import { request } from "./client";

type LegacyEnvelope<T> = {
  message?: string;
  data?: T;
};

function unwrapLegacyEnvelope<T>(payload: T | LegacyEnvelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "message" in payload
  ) {
    return (payload as LegacyEnvelope<T>).data as T;
  }
  return payload as T;
}

export interface TopupInfo {
  min_amount?: number;
  exchange_rate?: number;
  payment_methods?: string[];
  enable_wechatpay_topup?: boolean;
  wechatpay_min_topup?: number;
  pay_methods?: Array<{
    name: string;
    type: string;
    color: string;
    min_topup: string;
  }>;
}

export interface WeChatPayOrder {
  payment_type: string;
  code_url: string;
  qr_code: string;
  trade_no: string;
  order_id: string;
  amount: number;
  money: number;
  amount_fen: number;
  expires_at: number;
}

export interface PaymentStatus {
  trade_no: string;
  status: string; // pending, success, failed, expired
  complete_time: number;
  money: number;
}

export const JuyouWeChatPayApi = {
  /**
   * 获取充值信息（是否启用微信支付等）
   */
  async getTopupInfo(): Promise<TopupInfo> {
    return request<TopupInfo>("/api/user/topup/info");
  },

  /**
   * 计算微信支付金额
   */
  async calculateAmount(amount: number): Promise<string> {
    const payload = await request<string | LegacyEnvelope<string>>(
      "/api/user/amount",
      {
        method: "POST",
        body: { amount },
      },
    );
    return unwrapLegacyEnvelope(payload);
  },

  /**
   * 创建微信支付订单
   */
  async createOrder(amount: number): Promise<WeChatPayOrder> {
    const payload = await request<
      WeChatPayOrder | LegacyEnvelope<WeChatPayOrder>
    >("/api/user/wechatpay/pay", {
      method: "POST",
      body: { amount },
    });
    return unwrapLegacyEnvelope(payload);
  },

  /**
   * 查询支付状态
   */
  async getPaymentStatus(tradeNo: string): Promise<PaymentStatus> {
    const payload = await request<
      PaymentStatus | LegacyEnvelope<PaymentStatus>
    >("/api/user/wechatpay/status", {
      query: { trade_no: tradeNo },
    });
    return unwrapLegacyEnvelope(payload);
  },
};
