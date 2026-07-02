import { request } from "./client";

export interface JuyouModel {
  model_name: string;
  pricing?: {
    input: number;
    output: number;
    unit: string;
  };
}

export const JuyouModelApi = {
  /**
   * 获取用户可用的模型列表
   */
  async getUserModels(): Promise<JuyouModel[]> {
    return request<JuyouModel[]>("/api/user/models");
  },
};
