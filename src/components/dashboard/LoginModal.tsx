import { KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoginModalProps {
  loginMode: "password" | "email";
  setLoginMode: (mode: "password" | "email") => void;
  loginForm: { username: string; password: string };
  setLoginForm: (form: { username: string; password: string }) => void;
  emailLoginForm: { email: string; code: string };
  setEmailLoginForm: (form: { email: string; code: string }) => void;
  loginLoading: boolean;
  emailCodeLoading: boolean;
  emailCodeCountdown: number;
  onLogin: () => void;
  onSendEmailCode: () => void;
  onClose: () => void;
}

const fieldClass =
  "group flex h-11 items-center gap-2 rounded-lg border border-[#cfd9e8] bg-white px-3 transition-colors focus-within:border-[#0b65d8] focus-within:ring-2 focus-within:ring-[#0b65d8]/15";
const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#172033] outline-none ring-0 placeholder:text-[#a3adbd] focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none";

export function LoginModal({
  loginMode,
  setLoginMode,
  loginForm,
  setLoginForm,
  emailLoginForm,
  setEmailLoginForm,
  loginLoading,
  emailCodeLoading,
  emailCodeCountdown,
  onLogin,
  onSendEmailCode,
  onClose,
}: LoginModalProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/18 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[330px] rounded-2xl border border-[#dbe4ef] bg-white px-6 py-7 text-center shadow-[0_18px_45px_rgba(16,24,40,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[#172033]">邮箱登录</h2>
        <p className="mt-2 text-sm font-medium text-[#7c8aa1]">请先登录</p>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-[#dbe4ef] bg-[#f3f7fc] p-1 text-xs font-bold text-[#667085] shadow-inner shadow-slate-200/70">
          <button
            type="button"
            onClick={() => setLoginMode("email")}
            aria-pressed={loginMode === "email"}
            className={cn(
              "h-9 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b65d8]/25",
              loginMode === "email" &&
                "border border-white bg-white text-[#0b65d8] shadow-[0_5px_14px_rgba(15,65,120,0.12)]",
              loginMode !== "email" &&
                "text-[#7c8aa1] hover:bg-white/70 hover:text-[#344054]",
            )}
          >
            邮箱登录
          </button>
          <button
            type="button"
            onClick={() => setLoginMode("password")}
            aria-pressed={loginMode === "password"}
            className={cn(
              "h-9 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b65d8]/25",
              loginMode === "password" &&
                "border border-white bg-white text-[#0b65d8] shadow-[0_5px_14px_rgba(15,65,120,0.12)]",
              loginMode !== "password" &&
                "text-[#7c8aa1] hover:bg-white/70 hover:text-[#344054]",
            )}
          >
            密码登录
          </button>
        </div>

        <div className="mt-5 space-y-4 text-left">
          {loginMode === "password" ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#8a96a8]">
                  邮箱、手机号或用户名
                </label>
                <div className={fieldClass}>
                  <Mail className="h-4 w-4 text-[#98a2b3] transition-colors group-focus-within:text-[#0b65d8]" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={loginForm.username}
                    onChange={(e) =>
                      setLoginForm({
                        ...loginForm,
                        username: e.target.value,
                      })
                    }
                    onKeyDown={(e) => e.key === "Enter" && onLogin()}
                    placeholder="请输入邮箱、手机号或用户名"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#8a96a8]">
                  密码
                </label>
                <div className={fieldClass}>
                  <KeyRound className="h-4 w-4 text-[#98a2b3] transition-colors group-focus-within:text-[#0b65d8]" />
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({
                        ...loginForm,
                        password: e.target.value,
                      })
                    }
                    onKeyDown={(e) => e.key === "Enter" && onLogin()}
                    placeholder="请输入密码"
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#8a96a8]">
                  邮箱
                </label>
                <div className={fieldClass}>
                  <Mail className="h-4 w-4 text-[#98a2b3] transition-colors group-focus-within:text-[#0b65d8]" />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={emailLoginForm.email}
                    onChange={(e) =>
                      setEmailLoginForm({
                        ...emailLoginForm,
                        email: e.target.value,
                      })
                    }
                    onKeyDown={(e) => e.key === "Enter" && onLogin()}
                    placeholder="请输入邮箱"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#8a96a8]">
                  验证码
                </label>
                <div className={fieldClass}>
                  <KeyRound className="h-4 w-4 text-[#98a2b3] transition-colors group-focus-within:text-[#0b65d8]" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={emailLoginForm.code}
                    onChange={(e) =>
                      setEmailLoginForm({
                        ...emailLoginForm,
                        code: e.target.value.replace(/\D/g, "").slice(0, 6),
                      })
                    }
                    onKeyDown={(e) => e.key === "Enter" && onLogin()}
                    placeholder="请输入验证码"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={onSendEmailCode}
                    disabled={emailCodeLoading || emailCodeCountdown > 0}
                    className="shrink-0 rounded-md px-1.5 py-1 text-xs font-bold text-[#0b65d8] transition-colors hover:bg-[#e7f0ff] disabled:bg-transparent disabled:text-[#98a2b3]"
                  >
                    {emailCodeCountdown > 0
                      ? `${emailCodeCountdown}s`
                      : emailCodeLoading
                        ? "发送中"
                        : "获取验证码"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <Button
          onClick={onLogin}
          disabled={loginLoading}
          className="mt-5 h-11 w-full rounded-lg bg-[#0b65d8] text-sm font-bold text-white shadow-none hover:bg-[#095ac2] disabled:opacity-50"
        >
          {loginLoading ? "登录中..." : "登录"}
        </Button>

        <p className="mt-5 text-xs font-medium text-[#98a2b3]">
          未注册的邮箱将会自动注册
        </p>
      </div>
    </div>
  );
}
