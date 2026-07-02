import type { Dispatch, SetStateAction } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogStat } from "@/services/backend";
import type { JuyouLog as JuyouLogType } from "@/services/backend/types";

type TimeRange = "today" | "yesterday" | "week" | "month";

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function formatQuotaCost(quota: number): string {
  return `¥${(quota / 500000).toFixed(4)}`;
}

function normalizeLogText(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  if (!text || /^\?+$/.test(text) || text.includes("�")) {
    return fallback;
  }
  return text;
}

function getLogStatus(log: JuyouLogType): {
  label: string;
  className: string;
} {
  // /api/log/self 的 type 是日志类型，不是 HTTP 状态码：2 表示消费/调用记录。
  // 老逻辑把非 1/200 都当失败，会把成功调用误标成“失败”。
  const hasUsage =
    (log.quota || 0) > 0 ||
    (log.prompt_tokens || 0) > 0 ||
    (log.completion_tokens || 0) > 0;
  const success =
    log.type === 1 || log.type === 2 || log.type === 200 || hasUsage;
  return success
    ? {
        label: "成功",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      }
    : { label: "失败", className: "bg-rose-50 text-rose-700 ring-rose-100" };
}

interface DataPanelProps {
  logStats: LogStat | null;
  logs: JuyouLogType[];
  logsLoading: boolean;
  logsPage: number;
  logsPageSize: number;
  logsTotal: number;
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: Dispatch<SetStateAction<TimeRange>>;
  loadLogStats: (range: TimeRange) => void;
  loadLogs: (range: TimeRange, page?: number) => void;
  onRefresh: () => void;
}

export function DataPanel({
  logStats,
  logs,
  logsLoading,
  logsPage,
  logsPageSize,
  logsTotal,
  selectedTimeRange,
  setSelectedTimeRange,
  loadLogStats,
  loadLogs,
  onRefresh,
}: DataPanelProps) {
  const totalPages = Math.max(1, Math.ceil(logsTotal / logsPageSize));
  const canGoPrevious = logsPage > 1 && !logsLoading;
  const canGoNext = logsPage < totalPages && !logsLoading;

  const handleRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range);
    loadLogStats(range);
    loadLogs(range, 1);
  };

  const handlePageChange = (page: number) => {
    loadLogs(selectedTimeRange, page);
  };

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-[#202939]">
          数据面板概览
        </h1>
        <div className="flex items-center gap-3 text-xs text-[#98a2b3]">
          <span>
            最后更新：
            {new Date().toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-[#0b65d8] hover:text-[#095ac2]"
            aria-label="刷新数据"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {[
          { label: "今日", value: "today" as const },
          { label: "昨日", value: "yesterday" as const },
          { label: "本周", value: "week" as const },
          { label: "本月", value: "month" as const },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleRangeChange(tab.value)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition-all",
              selectedTimeRange === tab.value
                ? "bg-[#0b65d8] text-white shadow-md"
                : "bg-white text-[#667085] hover:bg-[#f8fafc]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            icon: Zap,
            label: "消耗 Token 数",
            value: logStats?.tpm ? `${(logStats.tpm / 1000).toFixed(1)}k` : "0",
          },
          {
            icon: Wallet,
            label: "消耗金额",
            value: logStats?.quota
              ? `¥${(logStats.quota / 500000).toFixed(2)}`
              : "¥0.00",
          },
          {
            icon: Activity,
            label: "请求次数",
            value: logStats?.rpm?.toLocaleString("en-US") || "0",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="overflow-hidden rounded-xl border border-[#e4e9f2] bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#667085]">
                <Icon className="h-4 w-4" />
                {stat.label}
              </div>
              <div className="text-2xl font-bold text-[#111827]">
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-6 min-h-[190px] shrink-0 overflow-hidden rounded-xl border border-[#e4e9f2] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#edf2f7] px-6 py-4">
          <h2 className="text-base font-bold text-[#202939]">Token 消耗趋势</h2>
          <button
            type="button"
            className="text-xs font-semibold text-[#98a2b3] hover:text-[#667085]"
          >
            最近 7 天
          </button>
        </div>
        <div className="flex h-32 items-center justify-center px-6 py-6 text-sm text-[#98a2b3]">
          暂无趋势数据
        </div>
      </div>

      <div className="min-h-[430px] shrink-0 overflow-hidden rounded-xl border border-[#e4e9f2] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#edf2f7] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#202939]">调用记录</h2>
            <p className="mt-1 text-xs text-[#98a2b3]">
              按当前时间范围展示历史调用，问号会被识别为缺失字段并显示为“未知模型”。
            </p>
          </div>
          <span className="text-xs font-semibold text-[#667085]">
            共 {logsTotal.toLocaleString("en-US")} 条
          </span>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-[#edf2f7]">
          {logsLoading ? (
            <div className="px-6 py-10 text-center text-sm text-[#667085]">
              加载中...
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[#667085]">
              暂无调用记录
            </div>
          ) : (
            logs.map((log) => {
              const totalTokens = log.prompt_tokens + log.completion_tokens;
              const status = getLogStatus(log);
              const modelName = normalizeLogText(log.model_name, "未知模型");
              const tokenName = normalizeLogText(log.token_name, "");
              const channelName = normalizeLogText(log.channel_name, "");

              return (
                <div
                  key={log.id}
                  className="px-6 py-4 transition-colors hover:bg-[#f8fbff]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-bold ring-1",
                            status.className,
                          )}
                        >
                          {status.label}
                        </span>
                        <span className="truncate text-sm font-bold text-[#202939]">
                          {modelName}
                        </span>
                        {tokenName && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-[#667085]">
                            {tokenName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#98a2b3]">
                        <span>{formatRelativeTime(log.created_at)}</span>
                        <span>耗时 {(log.use_time / 1000).toFixed(1)}s</span>
                        <span>
                          {totalTokens.toLocaleString("en-US")} tokens
                        </span>
                        {channelName && <span>{channelName}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-[#111827]">
                        {formatQuotaCost(log.quota || 0)}
                      </div>
                      <div className="mt-1 text-[11px] text-[#98a2b3]">
                        #{log.id}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-[#edf2f7] px-6 py-4 text-xs text-[#667085] sm:flex-row sm:items-center sm:justify-between">
          <span>
            第 {logsPage} / {totalPages} 页，每页 {logsPageSize} 条
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => handlePageChange(logsPage - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d8e0ec] px-3 py-2 font-semibold text-[#344054] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一页
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => handlePageChange(logsPage + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d8e0ec] px-3 py-2 font-semibold text-[#344054] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-45"
            >
              下一页
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
