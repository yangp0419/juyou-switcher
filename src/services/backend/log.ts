import { request } from "./client";
import type {
  JuyouLog,
  LogStat,
  Paginated,
  LogQueryParams,
  TopupRecord,
  PageParams,
} from "./types";

export async function getLogs(
  params: LogQueryParams = {},
): Promise<Paginated<JuyouLog>> {
  const page = params.page || params.p || 1;
  return request<Paginated<JuyouLog>>("/api/log/self", {
    query: {
      ...params,
      // 兼容后端分页参数：部分部署只读取 p，文档里同时出现过 p/page。
      p: page,
      page,
      // 与统计接口保持一致：后端实际读取 *_timestamp 字段。
      start_timestamp: params.start_time,
      end_timestamp: params.end_time,
    } as Record<string, string | number | undefined>,
  });
}

export async function getLogStats(params: {
  start_time?: number;
  end_time?: number;
}): Promise<LogStat> {
  return request<LogStat>("/api/log/self/stat", {
    query: {
      type: 0,
      start_timestamp: params.start_time,
      end_timestamp: params.end_time,
    },
  });
}

export async function getTopupRecords(
  params: PageParams = {},
): Promise<Paginated<TopupRecord>> {
  return request<Paginated<TopupRecord>>("/api/user/topup/self", {
    query: {
      page: params.page || 1,
      page_size: params.page_size || 10,
    },
  });
}
