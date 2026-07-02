import { useEffect, useState } from "react";
import { RotateCcw, Settings, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { providersApi, settingsApi, type AppId } from "@/lib/api";
import { JuyouUser } from "@/services/backend";
import { cn } from "@/lib/utils";
import type { JuyouUser as JuyouUserType } from "@/services/backend/types";

interface SettingsPanelProps {
  currentUser: JuyouUserType | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export function SettingsPanel({
  currentUser,
  onLogout,
  onOpenLogin,
}: SettingsPanelProps) {
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [isLoadingStartup, setIsLoadingStartup] = useState(true);
  const [isSavingStartup, setIsSavingStartup] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    originalPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [restoringOriginalApp, setRestoringOriginalApp] =
    useState<AppId | null>(null);
  const [switchingCodexOfficial, setSwitchingCodexOfficial] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAutoLaunchStatus() {
      try {
        const settings = await settingsApi.get();
        const enabled =
          settings.launchOnStartup ?? (await settingsApi.getAutoLaunchStatus());
        if (!cancelled) {
          setLaunchOnStartup(enabled);
        }
      } catch (error) {
        console.error("Failed to load auto-launch status:", error);
        if (!cancelled) {
          toast.error("读取开机自启状态失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStartup(false);
        }
      }
    }

    void loadAutoLaunchStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLaunchOnStartup = async () => {
    if (isLoadingStartup || isSavingStartup) return;

    const nextValue = !launchOnStartup;
    setLaunchOnStartup(nextValue);
    setIsSavingStartup(true);

    try {
      await settingsApi.setAutoLaunch(nextValue);
      const settings = await settingsApi.get();
      await settingsApi.save({ ...settings, launchOnStartup: nextValue });
      toast.success(nextValue ? "已开启开机自启" : "已关闭开机自启");
    } catch (error) {
      console.error("Failed to update auto-launch:", error);
      setLaunchOnStartup(!nextValue);
      toast.error("设置开机自启失败");
    } finally {
      setIsSavingStartup(false);
    }
  };

  const restoreOriginalConfig = async (appId: AppId) => {
    setRestoringOriginalApp(appId);
    try {
      const providers = await providersApi.getAll(appId);
      if (!providers.user) {
        toast.error(
          `${appId === "codex" ? "Codex" : "Claude"} 暂无可恢复的原配置`,
        );
        return;
      }

      await providersApi.switch("user", appId);
      await providersApi.updateTrayMenu();
      toast.success(`${appId === "codex" ? "Codex" : "Claude"} 已回到原配置`);
    } catch (error) {
      console.error("Failed to restore original config:", error);
      toast.error(
        `回到原配置失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setRestoringOriginalApp(null);
    }
  };

  const restoreCodexConfig = async () => {
    setSwitchingCodexOfficial(true);
    try {
      const providers = await providersApi.getAll("codex");
      const targetProviderId = providers.user ? "user" : "codex-official";
      if (targetProviderId === "codex-official") {
        await providersApi.ensureCodexOfficialProvider();
      }

      await providersApi.switch(targetProviderId, "codex");
      await providersApi.updateTrayMenu();
      toast.success(
        targetProviderId === "user"
          ? "Codex 已回到原配置"
          : "Codex 已切回官方配置",
      );
    } catch (error) {
      console.error("Failed to restore Codex config:", error);
      toast.error(
        `恢复 Codex 配置失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSwitchingCodexOfficial(false);
    }
  };

  const handleSetPassword = async () => {
    const nextPassword = passwordForm.password.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!currentUser || isSavingPassword) return;
    if (!nextPassword || !confirmPassword) {
      toast.error("请输入新密码并确认");
      return;
    }
    if (nextPassword.length < 6) {
      toast.error("密码至少需要 6 位");
      return;
    }
    if (nextPassword !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setIsSavingPassword(true);
    try {
      await JuyouUser.updateUser({
        password: nextPassword,
        original_password: passwordForm.originalPassword.trim() || undefined,
      });
      setPasswordForm({
        originalPassword: "",
        password: "",
        confirmPassword: "",
      });
      setShowPasswordModal(false);
      toast.success("密码设置成功");
    } catch (error) {
      console.error("Failed to set password:", error);
      toast.error("设置密码失败，请检查原密码后重试");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <>
      <main className="flex flex-1 flex-col overflow-y-auto px-8 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            系统设置
          </h1>
          <p className="mt-2 text-sm font-medium text-[#64748b]">
            管理应用的常规行为、启动偏好与账户信息。
          </p>
        </div>

        <div className="w-full max-w-[620px] space-y-5">
          <section className="rounded-xl border border-[#cfd9e8] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3 border-b border-[#dbe4ef] pb-4">
              <UserCircle className="h-5 w-5 text-[#0b65d8]" />
              <h2 className="text-lg font-bold text-[#172033]">个人中心</h2>
            </div>

            {currentUser ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700">
                      <UserCircle className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-[#172033]">
                        {currentUser.display_name ||
                          currentUser.username ||
                          "用户"}
                      </div>
                      <div className="mt-1 text-xs text-[#64748b]">
                        {currentUser.phone ||
                          currentUser.email ||
                          currentUser.username}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="h-9 rounded-md bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    退出登录
                  </button>
                </div>

                <div className="flex items-center justify-between gap-6 rounded-lg border border-[#dbe4ef] bg-[#f8fafc] p-4">
                  <div>
                    <div className="text-sm font-bold text-[#172033]">
                      登录密码
                    </div>
                    <div className="mt-1 text-xs text-[#64748b]">
                      用于之后通过手机号和密码登录。
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(true)}
                    className="h-9 rounded-md bg-[#0b65d8] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#095ac2]"
                  >
                    设置密码
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <UserCircle className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-[#172033]">
                      未登录
                    </div>
                    <div className="mt-1 text-xs text-[#64748b]">
                      登录后可设置登录密码与使用完整功能。
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="h-9 rounded-md bg-[#0b65d8] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#095ac2]"
                >
                  立即登录
                </button>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#cfd9e8] bg-white p-6 shadow-sm">
            <div>
              <div className="mb-5 flex items-center gap-3 border-b border-[#dbe4ef] pb-4">
                <Settings className="h-5 w-5 text-[#0b65d8]" />
                <h2 className="text-lg font-bold text-[#172033]">常规设置</h2>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div>
                  <div className="text-sm font-bold text-[#172033]">
                    启动设置
                  </div>
                  <div className="mt-1 text-xs text-[#64748b]">
                    系统登录时自动启动应用程序。
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={launchOnStartup}
                  disabled={isLoadingStartup || isSavingStartup}
                  onClick={toggleLaunchOnStartup}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    launchOnStartup ? "bg-[#0b65d8]" : "bg-[#c8ceda]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      launchOnStartup ? "left-6" : "left-1",
                    )}
                  />
                </button>
              </div>

              <div className="mt-5 border-t border-[#dbe4ef] pt-5">
                <div className="mb-3 flex items-start justify-between gap-5">
                  <div>
                    <div className="text-sm font-bold text-[#172033]">
                      回到原配置
                    </div>
                    <div className="mt-1 text-xs text-[#64748b]">
                      将一键配置前保存的用户配置写回工具配置文件。
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={restoringOriginalApp !== null}
                    onClick={() => restoreOriginalConfig("claude")}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      "border-[#dbe4ef] bg-white text-[#475569] hover:bg-[#f8fafc]",
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Claude</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {restoringOriginalApp === "claude"
                        ? "恢复中"
                        : "还原配置"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={switchingCodexOfficial}
                    onClick={restoreCodexConfig}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      "border-[#dbe4ef] bg-white text-[#475569] hover:bg-[#f8fafc]",
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Codex</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {switchingCodexOfficial ? "恢复中" : "还原配置"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-lg font-bold text-[#172033]">设置密码</h3>
              <p className="mt-1 text-xs text-[#64748b]">
                设置后可使用手机号和密码登录。
              </p>
            </div>

            <div className="grid gap-3">
              <input
                type="password"
                value={passwordForm.originalPassword}
                onChange={(event) =>
                  setPasswordForm((form) => ({
                    ...form,
                    originalPassword: event.target.value,
                  }))
                }
                placeholder="原密码（首次设置可不填）"
                className="h-10 rounded-md border border-[#cfd9e8] bg-white px-3 text-sm text-[#172033] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[#0b65d8]"
              />
              <input
                type="password"
                value={passwordForm.password}
                onChange={(event) =>
                  setPasswordForm((form) => ({
                    ...form,
                    password: event.target.value,
                  }))
                }
                placeholder="新密码"
                className="h-10 rounded-md border border-[#cfd9e8] bg-white px-3 text-sm text-[#172033] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[#0b65d8]"
              />
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((form) => ({
                    ...form,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="确认新密码"
                className="h-10 rounded-md border border-[#cfd9e8] bg-white px-3 text-sm text-[#172033] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[#0b65d8]"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSavingPassword}
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({
                    originalPassword: "",
                    password: "",
                    confirmPassword: "",
                  });
                }}
                className="h-9 rounded-md bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isSavingPassword}
                onClick={handleSetPassword}
                className="h-9 rounded-md bg-[#0b65d8] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#095ac2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingPassword ? "保存中..." : "保存密码"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
