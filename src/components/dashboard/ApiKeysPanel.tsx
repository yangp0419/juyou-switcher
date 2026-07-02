import { useState, type Dispatch, type SetStateAction } from "react";
import { KeyRound, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JuyouToken as JuyouTokenType } from "@/services/backend/types";

interface CreateTokenFormState {
  name: string;
  remain_quota: number;
  unlimited_quota: boolean;
  expired_time: number;
}

interface ApiKeysPanelProps {
  tokens: JuyouTokenType[];
  tokensLoading: boolean;
  tokensPage: number;
  tokensTotal: number;
  updatingTokenIds: Set<number>;
  showCreateTokenModal: boolean;
  createTokenForm: CreateTokenFormState;
  createTokenLoading: boolean;
  setTokensPage: Dispatch<SetStateAction<number>>;
  setShowCreateTokenModal: Dispatch<SetStateAction<boolean>>;
  setCreateTokenForm: Dispatch<SetStateAction<CreateTokenFormState>>;
  loadTokens: () => void;
  maskKey: (key: string) => string;
  handleDeleteToken: (id: number, name: string) => void;
  handleToggleTokenStatus: (token: JuyouTokenType) => void;
  handleCreateToken: () => void;
  closeCreateTokenModal: () => void;
}

export function ApiKeysPanel({
  tokens,
  tokensLoading,
  tokensPage,
  tokensTotal,
  updatingTokenIds,
  showCreateTokenModal,
  createTokenForm,
  createTokenLoading,
  setTokensPage,
  setShowCreateTokenModal,
  setCreateTokenForm,
  loadTokens,
  maskKey,
  handleDeleteToken,
  handleToggleTokenStatus,
  handleCreateToken,
  closeCreateTokenModal,
}: ApiKeysPanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<JuyouTokenType | null>(null);

  const confirmDeleteToken = () => {
    if (!deleteTarget) return;
    handleDeleteToken(deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#f7f9fc] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[620px]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-13 w-13 items-center justify-center rounded-full bg-blue-100 p-3 text-[#0b65d8]">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#202939]">
            API 密钥管理
          </h1>
          <p className="mt-2 text-sm font-medium text-[#9aa6b8]">
            安全、简洁地管理您的生产环境访问凭证。
          </p>
        </div>

        <div className="mt-7 overflow-hidden rounded-xl border border-[#dbe4ef] bg-white shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
          {/* 卡片头部 */}
          <div className="flex items-center justify-between border-b border-[#edf2f7] px-6 py-5">
            <div>
              <div className="text-base font-bold text-[#202939]">可用密钥</div>
              <div className="mt-0.5 text-xs text-[#98a2b3]">
                当前共有 {tokensTotal} 个活跃密钥
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadTokens}
                disabled={tokensLoading}
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] hover:bg-[#f1f5f9] disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-4 w-4", tokensLoading && "animate-spin")}
                />
              </button>
              <Button
                onClick={() => setShowCreateTokenModal(true)}
                className="h-9 rounded-md bg-[#0b65d8] px-4 text-xs font-bold text-white shadow-[0_8px_16px_rgba(11,101,216,0.24)] hover:bg-[#095ac2]"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                创建新密钥
              </Button>
            </div>
          </div>

          {/* 密钥列表 */}
          <div className="divide-y divide-[#edf2f7]">
            {tokensLoading ? (
              <div className="px-6 py-10 text-center text-sm text-[#667085]">
                加载中...
              </div>
            ) : tokens.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#667085]">
                暂无密钥，点击右上角「创建新密钥」开始
              </div>
            ) : (
              tokens.map((token) => {
                const enabled = token.status === 1;
                const updating = updatingTokenIds.has(token.id);
                return (
                  <div
                    key={token.id}
                    className="group flex items-center justify-between px-6 py-4 hover:bg-[#f8fbff]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            enabled ? "text-[#202939]" : "text-[#98a2b3]",
                          )}
                        >
                          {token.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(token)}
                          className="text-[#cbd5e1] opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                          title="删除密钥"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={cn(
                            "font-mono text-xs",
                            enabled ? "text-[#94a3b8]" : "text-[#cbd5e1]",
                          )}
                        >
                          {maskKey(token.key)}
                        </span>
                        <span className="rounded bg-[#eef2f7] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                          {token.unlimited_quota
                            ? "FULL ACCESS"
                            : `¥${(token.remain_quota / 500000).toFixed(2)}`}
                        </span>
                        {token.group && (
                          <span className="rounded bg-[#eef2f7] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                            {token.group}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          enabled ? "text-[#0b65d8]" : "text-[#98a2b3]",
                        )}
                      >
                        {enabled ? "已启用" : "已禁用"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleToggleTokenStatus(token)}
                        disabled={updating}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50",
                          enabled ? "bg-[#0b65d8]" : "bg-[#cbd5e1]",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                            enabled ? "translate-x-[22px]" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 卡片底部分页 */}
          {tokensTotal > 0 && (
            <div className="flex items-center justify-center gap-4 border-t border-[#edf2f7] px-6 py-4 text-sm font-semibold text-[#0b65d8]">
              <button
                type="button"
                disabled={tokensPage === 1}
                onClick={() => setTokensPage((p) => p - 1)}
                className="disabled:opacity-30"
              >
                上一页
              </button>
              <span className="text-[#94a3b8]">
                共 {tokensTotal} 个密钥 · 第 {tokensPage} 页
              </span>
              <button
                type="button"
                disabled={tokensPage * 10 >= tokensTotal}
                onClick={() => setTokensPage((p) => p + 1)}
                className="disabled:opacity-30"
              >
                下一页
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#98a2b3]">
          您的 API 密钥受到企业级加密保护，符合{" "}
          <span className="font-semibold text-[#0b65d8]">隐私安全规范</span>。
        </p>
      </div>

      {showCreateTokenModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/18 p-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-xl border border-[#dbe4ef] bg-white p-5 shadow-[0_18px_45px_rgba(16,24,40,0.18)] sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#172033]">创建新令牌</h2>
              <button
                onClick={closeCreateTokenModal}
                className="text-[#98a2b3] hover:text-[#172033]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">
                  令牌名称 *
                </label>
                <input
                  type="text"
                  value={createTokenForm.name}
                  onChange={(e) =>
                    setCreateTokenForm({
                      ...createTokenForm,
                      name: e.target.value,
                    })
                  }
                  placeholder="例如：生产环境 API 密钥"
                  className="h-10 w-full rounded-md border border-[#cfd9e8] bg-white px-3 text-sm text-[#172033] outline-none focus:border-[#0b65d8] focus:ring-1 focus:ring-[#0b65d8]"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="unlimited"
                    checked={createTokenForm.unlimited_quota}
                    onChange={(e) =>
                      setCreateTokenForm({
                        ...createTokenForm,
                        unlimited_quota: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-[#cfd9e8] text-[#0b65d8]"
                  />
                  <label
                    htmlFor="unlimited"
                    className="text-sm font-semibold text-[#344054]"
                  >
                    无限额度
                  </label>
                </div>
              </div>

              {!createTokenForm.unlimited_quota && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#344054]">
                    初始额度（tokens）
                  </label>
                  <input
                    type="number"
                    value={createTokenForm.remain_quota}
                    onChange={(e) =>
                      setCreateTokenForm({
                        ...createTokenForm,
                        remain_quota: Number(e.target.value),
                      })
                    }
                    placeholder="100000"
                    className="h-10 w-full rounded-md border border-[#cfd9e8] bg-white px-3 text-sm text-[#172033] outline-none focus:border-[#0b65d8] focus:ring-1 focus:ring-[#0b65d8]"
                  />
                  <p className="mt-1 text-xs text-[#667085]">
                    约 ¥{(createTokenForm.remain_quota / 500000).toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">
                  过期时间（可选）
                </label>
                <input
                  type="datetime-local"
                  value={
                    createTokenForm.expired_time
                      ? new Date(createTokenForm.expired_time * 1000)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setCreateTokenForm({
                      ...createTokenForm,
                      expired_time: e.target.value
                        ? Math.floor(new Date(e.target.value).getTime() / 1000)
                        : 0,
                    })
                  }
                  className="h-10 w-full rounded-md border border-[#cfd9e8] bg-white px-3 text-sm text-[#172033] outline-none focus:border-[#0b65d8] focus:ring-1 focus:ring-[#0b65d8]"
                />
                <p className="mt-1 text-xs text-[#667085]">留空表示永不过期</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={closeCreateTokenModal}
                className="h-10 flex-1 rounded-md bg-slate-100 text-sm font-semibold text-slate-700 shadow-none hover:bg-slate-200"
              >
                取消
              </Button>
              <Button
                onClick={handleCreateToken}
                disabled={createTokenLoading}
                className="h-10 flex-1 rounded-md bg-[#0b65d8] text-sm font-bold text-white shadow-none hover:bg-[#095ac2] disabled:opacity-50"
              >
                {createTokenLoading ? "创建中..." : "创建"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/18 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-xl border border-[#dbe4ef] bg-white p-6 shadow-[0_18px_45px_rgba(16,24,40,0.18)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#172033]">
                  删除 API 密钥
                </h2>
                <p className="mt-1 text-xs text-[#64748b]">此操作无法撤销。</p>
              </div>
            </div>
            <p className="text-sm text-[#344054]">
              确定删除密钥「
              <span className="font-semibold text-[#172033]">
                {deleteTarget.name}
              </span>
              」吗？删除后该密钥将无法继续调用接口。
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => setDeleteTarget(null)}
                className="h-10 flex-1 rounded-md bg-slate-100 text-sm font-semibold text-slate-700 shadow-none hover:bg-slate-200"
              >
                取消
              </Button>
              <Button
                onClick={confirmDeleteToken}
                className="h-10 flex-1 rounded-md bg-rose-600 text-sm font-bold text-white shadow-none hover:bg-rose-700"
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
