import type { Dispatch, SetStateAction } from "react";
import { CreditCard, Download, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TopupRecord } from "@/services/backend";
import type { JuyouUser as JuyouUserType } from "@/services/backend/types";

interface AssetsPanelProps {
  currentUser: JuyouUserType | null;
  selectedTopupAmount: number | null;
  setSelectedTopupAmount: Dispatch<SetStateAction<number | null>>;
  customTopupAmount: string;
  setCustomTopupAmount: Dispatch<SetStateAction<string>>;
  topupLoading: boolean;
  topupRecords: TopupRecord[];
  handleWeChatPayTopup: (amount: number) => void;
  onRefresh: () => void;
}

export function AssetsPanel({
  currentUser,
  selectedTopupAmount,
  setSelectedTopupAmount,
  customTopupAmount,
  setCustomTopupAmount,
  topupLoading,
  topupRecords,
  handleWeChatPayTopup,
  onRefresh,
}: AssetsPanelProps) {
  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[#202939]">
          资产管理
        </h1>
        <p className="mt-1 text-sm text-[#98a2b3]">
          监控您的 API 资费情况，管理账户余额
        </p>
      </div>

      {/* 2x2 网格布局 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 左上：账户余额 (CNY) */}
        <div className="overflow-hidden rounded-xl border border-[#e4e9f2] bg-white p-6 shadow-sm">
          <div className="mb-4 text-sm font-semibold text-[#667085]">
            账户余额 (CNY)
          </div>
          <div className="mb-6 text-4xl font-bold text-[#0b65d8]">
            ¥{currentUser ? (currentUser.quota / 500000).toFixed(2) : "0.00"}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                // 滚动到快速充值区域
                const element = document.querySelector(
                  '[data-section="quick-topup"]',
                );
                if (element) {
                  element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }
              }}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[#0b65d8] text-sm font-bold text-white hover:bg-[#095ac2]"
            >
              <Download className="h-4 w-4" />
              立即充值
            </button>
          </div>
        </div>

        {/* 右上：累计消耗 */}
        <div className="overflow-hidden rounded-xl border border-[#e4e9f2] bg-white p-6 shadow-sm">
          <div className="mb-4 text-sm font-semibold text-[#667085]">
            累计消耗
          </div>
          <div className="mb-2 text-4xl font-bold text-[#111827]">
            ¥{" "}
            {currentUser
              ? (currentUser.used_quota / 500000).toFixed(2)
              : "0.00"}
          </div>
        </div>

        {/* 下方：快速充值（占满整行） */}
        <div
          data-section="quick-topup"
          className="overflow-hidden rounded-xl border border-[#e4e9f2] bg-white p-6 shadow-sm lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#667085]">
            <Zap className="h-4 w-4 text-[#0b65d8]" />
            快速充值
          </div>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {[
              { label: "¥10", value: 10 },
              { label: "¥20", value: 20 },
              { label: "¥50", value: 50 },
              { label: "¥100", value: 100 },
              { label: "¥200", value: 200 },
              { label: "¥500", value: 500 },
              { label: "¥1000", value: 1000 },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setSelectedTopupAmount(option.value);
                  setCustomTopupAmount("");
                }}
                className={cn(
                  "relative flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-all",
                  selectedTopupAmount === option.value
                    ? "border-[#0b65d8] bg-[#eff6ff] text-[#0b65d8] ring-2 ring-[#0b65d8]"
                    : "border-[#d0d5dd] bg-white text-[#344054] hover:border-[#0b65d8] hover:bg-[#f8fbff]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mb-4 flex items-center gap-2 border-t border-[#edf2f7] pt-4">
            <span className="text-sm text-[#667085]">¥</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="输入金额"
              value={customTopupAmount}
              onChange={(e) => {
                setCustomTopupAmount(e.target.value);
                setSelectedTopupAmount(null);
              }}
              className="h-11 flex-1 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#344054] outline-none placeholder:text-[#98a2b3] focus:border-[#0b65d8] focus:ring-2 focus:ring-[#dbeafe]"
            />
          </div>
          <button
            onClick={() => {
              const amount = customTopupAmount
                ? parseFloat(customTopupAmount)
                : selectedTopupAmount;

              if (!amount || amount <= 0) {
                toast.error("请选择或输入充值金额");
                return;
              }

              handleWeChatPayTopup(amount);
            }}
            className="h-11 w-full rounded-lg bg-[#0b65d8] text-sm font-bold text-white hover:bg-[#095ac2]"
          >
            立即充值
          </button>
          <div className="mt-3 text-center text-xs text-[#98a2b3]">
            充值即代表同意《服务协议》
          </div>
        </div>
      </div>

      {/* 充值记录表格 */}
      <div
        data-section="topup-records"
        className="mt-6 overflow-hidden rounded-xl border border-[#e4e9f2] bg-white shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-[#edf2f7] px-6 py-4">
          <h2 className="text-base font-bold text-[#202939]">充值记录</h2>
          <button
            onClick={onRefresh}
            disabled={topupLoading}
            className="text-sm text-[#98a2b3] hover:text-[#667085] disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", topupLoading && "animate-spin")}
            />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#edf2f7] text-xs text-[#667085]">
              <tr>
                <th className="px-6 py-3 font-semibold">充值日期</th>
                <th className="px-6 py-3 font-semibold">金额</th>
                <th className="px-6 py-3 font-semibold">支付方式</th>
                <th className="px-6 py-3 font-semibold">状态</th>
                <th className="px-6 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7]">
              {topupLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-[#98a2b3]"
                  >
                    加载中...
                  </td>
                </tr>
              ) : topupRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-[#98a2b3]"
                  >
                    暂无充值记录
                  </td>
                </tr>
              ) : (
                topupRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-[#f8fbff]">
                    <td className="px-6 py-4 font-mono text-xs text-[#667085]">
                      {new Date(record.create_time * 1000).toLocaleString(
                        "zh-CN",
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#111827]">
                      ¥ {record.money.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-[#0b65d8]" />
                        <span className="text-[#344054]">
                          {record.payment_method === "wechatpay"
                            ? "微信支付"
                            : record.payment_method === "alipay"
                              ? "支付宝"
                              : "银行卡"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          record.status === "success"
                            ? "bg-emerald-50 text-emerald-600"
                            : record.status === "pending"
                              ? "bg-orange-50 text-orange-600"
                              : "bg-red-50 text-red-600",
                        )}
                      >
                        {record.status === "success"
                          ? "已支付"
                          : record.status === "pending"
                            ? "已取消"
                            : "已取消"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-sm font-semibold text-[#0b65d8] hover:underline">
                        详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {topupRecords.length > 0 && (
          <div className="border-t border-[#edf2f7] px-6 py-3 text-xs text-[#667085]">
            当前显示最近 {topupRecords.length} 条充值记录
          </div>
        )}
      </div>
    </main>
  );
}
