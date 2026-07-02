import type { Dispatch, SetStateAction } from "react";
import {
  Activity,
  BarChart2,
  Key,
  PanelLeft,
  Settings,
  UserCircle,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JuyouUser as JuyouUserType } from "@/services/backend/types";
import appIcon from "../../../src-tauri/icons/128x128.png";

export type DashboardView =
  | "quickStart"
  | "apiKeys"
  | "dataPanel"
  | "experience"
  | "assets"
  | "settings";

type ProtectedDashboardView = Exclude<DashboardView, "settings">;

interface DashboardSidebarProps {
  activeView: DashboardView;
  setActiveView: Dispatch<SetStateAction<DashboardView>>;
  requireLogin: (target: ProtectedDashboardView) => void;
  isLoggedIn: boolean;
  currentUser: JuyouUserType | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

const setupNavItems = [
  { key: "quickStart" as const, icon: PanelLeft, label: "快速开始" },
  { key: "apiKeys" as const, icon: Key, label: "API 密钥" },
  { key: "dataPanel" as const, icon: BarChart2, label: "数据面板" },
  { key: "experience" as const, icon: Activity, label: "体验中心" },
  { key: "assets" as const, icon: Wallet, label: "资产中心" },
  { key: "settings" as const, icon: Settings, label: "系统设置" },
];

export function DashboardSidebar({
  activeView,
  setActiveView,
  requireLogin,
  isLoggedIn,
  currentUser,
  onLogout,
  onOpenLogin,
}: DashboardSidebarProps) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#dbe4ef] bg-[#f8fafc] px-4 pb-4 pt-12">
      <div className="mb-7 flex items-center gap-3 px-1">
        <div className="flex h-7 w-7 items-center justify-center">
          <img src={appIcon} alt="" className="h-7 w-7 rounded-lg" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-[#101828]">
            聚游助手
          </div>
          <div className="text-xs text-[#98a2b3]">聚游 API 的 Agent 助手</div>
        </div>
      </div>

      <nav className="space-y-2">
        {setupNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.key === "quickStart" || item.key === "settings") {
                  setActiveView(item.key);
                } else {
                  requireLogin(item.key);
                }
              }}
              className={cn(
                "flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                activeView === item.key
                  ? "bg-[#1677e8] text-white shadow-sm shadow-blue-500/20"
                  : "text-[#58677d] hover:bg-blue-50 hover:text-blue-700",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#dbe4ef] pt-4">
        {isLoggedIn ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700">
                <UserCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#344054]">
                  {currentUser?.display_name || currentUser?.username || "用户"}
                </div>
                <div className="text-[11px] text-[#98a2b3]">
                  余额: ¥{((currentUser?.quota || 0) / 500000).toFixed(2)}
                </div>
              </div>
            </div>
            <Button
              onClick={onLogout}
              className="h-8 w-full rounded-md bg-slate-100 text-xs font-semibold text-slate-700 shadow-none hover:bg-slate-200"
            >
              退出登录
            </Button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <UserCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#64748b]">
                  未登录
                </div>
                <div className="text-[11px] text-[#98a2b3]">
                  请登录以体验完整功能
                </div>
              </div>
            </div>
            <Button
              onClick={onOpenLogin}
              className="h-8 w-full rounded-md bg-[#0b65d8] text-xs font-semibold text-white shadow-none hover:bg-[#095ac2]"
            >
              立即登录
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
