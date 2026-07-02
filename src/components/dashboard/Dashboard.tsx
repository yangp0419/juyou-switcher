import { useEffect, useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink } from "lucide-react";
import {
  JuyouChat,
  JuyouLog,
  JuyouModelApi,
  JuyouToken,
  JuyouUser,
  JuyouWeChatPayApi,
  setApiToken,
  type LogStat,
  type TopupRecord,
} from "@/services/backend";
import type {
  JuyouLog as JuyouLogType,
  JuyouModel as JuyouModelType,
  JuyouToken as JuyouTokenType,
  JuyouUser as JuyouUserType,
} from "@/services/backend/types";
import type { ChatMessage } from "@/services/backend/chat";
import type { AppId } from "@/lib/api";
import { providersApi } from "@/lib/api";
import { extractErrorMessage } from "@/utils/errorUtils";
import { LoginModal } from "@/components/dashboard/LoginModal";
import { PaymentQrModal } from "@/components/dashboard/PaymentQrModal";
import {
  DashboardSidebar,
  type DashboardView,
} from "@/components/dashboard/DashboardSidebar";
import { QuickStartPanel } from "@/components/dashboard/QuickStartPanel";
import { ApiKeysPanel } from "@/components/dashboard/ApiKeysPanel";
import { DataPanel } from "@/components/dashboard/DataPanel";
import { ExperiencePanel } from "@/components/dashboard/ExperiencePanel";
import { AssetsPanel } from "@/components/dashboard/AssetsPanel";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";

const MAINLAND_PHONE_RE = /^1[3-9]\d{9}$/;
const LOGS_PAGE_SIZE = 10;
const QUICK_SETUP_TOKEN_PAGE_SIZE = 100;
const QUICK_SETUP_TOKEN_MAX_PAGES = 20;
const QUOTA_PER_YUAN = 500000;

type ChatCostSource = "backend" | "pending" | "fallback" | "none";

interface ChatStats {
  latency: number;
  throughput: number;
  tokens: number;
  cost: number;
  costSource: ChatCostSource;
  logId?: number;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(0, 11);
}

function quotaToYuan(quota: number): number {
  return quota / QUOTA_PER_YUAN;
}

function getLogTokens(log: JuyouLogType): number {
  return (log.prompt_tokens || 0) + (log.completion_tokens || 0);
}

function calculateThroughput(tokens: number, latencyMs: number): number {
  if (tokens <= 0 || latencyMs <= 0) return 0;
  return tokens / (latencyMs / 1000);
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.trim().length / 4));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getQuickSetupTokenName(appId: AppId): string {
  return appId === "codex" ? "Codex" : "Claude";
}

function getQuickSetupAppName(appId: AppId): string {
  if (appId === "codex") return "Codex";
  if (appId === "claude") return "Claude";
  if (appId === "opencode") return "OpenCode";
  return appId.toUpperCase();
}

function getUserAccessToken(user: JuyouUserType): string | null {
  return user.access_token || user.accessToken || user.token || null;
}

function persistLoggedInUser(
  user: JuyouUserType,
  _options: { requireAccessToken?: boolean } = {},
): void {
  const accessToken = getUserAccessToken(user) || null;

  if (accessToken) {
    setApiToken(accessToken);
  }
  localStorage.setItem("juyou-user-id", String(user.id));
  if (!accessToken) {
    console.info(
      "[Juyou API] 登录响应未包含 access_token，按 API_DOCS.md 使用 Session Cookie 认证",
      {
        userId: user.id,
        fields: Object.keys(user),
      },
    );
  }
}

function isQuickSetupTokenName(
  name: string | undefined,
  tokenName: string,
): boolean {
  const normalizedName = name?.trim().toLowerCase();
  if (!normalizedName) return false;

  const normalizedTokenName = tokenName.toLowerCase();
  return (
    normalizedName === normalizedTokenName ||
    normalizedName.startsWith(`${normalizedTokenName}-`) ||
    normalizedName.startsWith(`${normalizedTokenName}_`) ||
    normalizedName.startsWith(`${normalizedTokenName} `) ||
    normalizedName.startsWith(`juyou-${normalizedTokenName}`) ||
    normalizedName.startsWith(`juyou_${normalizedTokenName}`) ||
    normalizedName.startsWith(`聚游助手${tokenName}`.toLowerCase())
  );
}

async function findQuickSetupTokenId(
  tokenName: string,
): Promise<number | undefined> {
  for (let page = 1; page <= QUICK_SETUP_TOKEN_MAX_PAGES; page += 1) {
    const result = await JuyouToken.getTokens({
      page,
      page_size: QUICK_SETUP_TOKEN_PAGE_SIZE,
    });
    const matchedToken = result?.items?.find((token) =>
      isQuickSetupTokenName(token.name, tokenName),
    );

    if (matchedToken) {
      return matchedToken.id;
    }

    const total = result?.total ?? 0;
    const loaded = page * QUICK_SETUP_TOKEN_PAGE_SIZE;
    if (!result?.items?.length || loaded >= total) {
      break;
    }
  }

  return undefined;
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>("quickStart");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<JuyouUserType | null>(null);
  const [pendingViewAfterLogin, setPendingViewAfterLogin] = useState<
    "quickStart" | "apiKeys" | "dataPanel" | "experience" | "assets" | null
  >(null);
  const [loginMode, setLoginMode] = useState<"password" | "phone">("phone");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [phoneLoginForm, setPhoneLoginForm] = useState({
    phone: "",
    code: "",
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [phoneCodeLoading, setPhoneCodeLoading] = useState(false);
  const [phoneCodeCountdown, setPhoneCodeCountdown] = useState(0);
  const [tokens, setTokens] = useState<JuyouTokenType[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensPage, setTokensPage] = useState(1);
  const [tokensTotal, setTokensTotal] = useState(0);
  const [showCreateTokenModal, setShowCreateTokenModal] = useState(false);
  const [createTokenForm, setCreateTokenForm] = useState({
    name: "",
    remain_quota: 100000,
    unlimited_quota: false,
    expired_time: 0,
  });
  const [createTokenLoading, setCreateTokenLoading] = useState(false);
  const [updatingTokenIds, setUpdatingTokenIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [logs, setLogs] = useState<JuyouLogType[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logStats, setLogStats] = useState<LogStat | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<
    "today" | "yesterday" | "week" | "month"
  >("today");
  const [topupRecords, setTopupRecords] = useState<TopupRecord[]>([]);
  const [topupLoading, setTopupLoading] = useState(false);
  const [selectedTopupAmount, setSelectedTopupAmount] = useState<number | null>(
    null,
  );
  const [customTopupAmount, setCustomTopupAmount] = useState("");
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [currentTradeNo, setCurrentTradeNo] = useState("");
  const [paymentPolling, setPaymentPolling] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AppId>("codex");
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o");
  const [availableModels, setAvailableModels] = useState<JuyouModelType[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // 体验中心 - 对话测试状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "您好！我是聚游助手，您可以尝试输入任何问题，我将通过最优节点为您提供回答。您可以察看下方的实时性能指标。",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStreamingEnabled, setChatStreamingEnabled] = useState(true);
  const [chatStats, setChatStats] = useState<ChatStats>({
    latency: 0,
    throughput: 0,
    tokens: 0,
    cost: 0,
    costSource: "none",
  });

  const isLoggedIn = currentUser !== null;

  useEffect(() => {
    if (phoneCodeCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setPhoneCodeCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [phoneCodeCountdown]);

  // 加载可用模型列表（登录后）
  useEffect(() => {
    if (!isLoggedIn) {
      setAvailableModels([]);
      return;
    }

    setModelsLoading(true);
    JuyouModelApi.getUserModels()
      .then((models: JuyouModelType[]) => {
        setAvailableModels(models);
        // 如果当前选择的模型不在列表中，选择第一个
        if (
          models.length > 0 &&
          !models.some((m: JuyouModelType) => m.model_name === selectedModel)
        ) {
          setSelectedModel(models[0].model_name);
        }
      })
      .catch((err: any) => {
        console.error("加载模型列表失败:", err);
        // 失败时使用空列表，保留硬编码的备用列表
      })
      .finally(() => {
        setModelsLoading(false);
      });
  }, [isLoggedIn]);

  // 启动时检查登录状态（静默失败）
  useEffect(() => {
    // 只有本地存有用户 ID 时才尝试恢复会话
    const savedUserId = localStorage.getItem("juyou-user-id");
    if (!savedUserId) return;

    JuyouUser.getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        persistLoggedInUser(user);
      })
      .catch((err) => {
        // 认证失效，清除本地状态
        if (err.isAuthError) {
          setApiToken(null);
          localStorage.removeItem("juyou-user-id");
        } else if (err.status === 0) {
          toast.error("无法连接到服务器，请检查后端是否运行");
        }
      });
  }, []);

  // 切换到 API 密钥页面时加载令牌列表
  useEffect(() => {
    if (activeView === "apiKeys" && isLoggedIn) {
      loadTokens();
    }
  }, [activeView, isLoggedIn, tokensPage]);

  // 切换到数据面板时加载日志统计和记录
  useEffect(() => {
    if (activeView === "dataPanel" && isLoggedIn) {
      setSelectedTimeRange("today");
      setLogsPage(1);
      loadLogStats("today");
      loadLogs("today", 1);
    }
  }, [activeView, isLoggedIn]);

  // 切换到资产中心时加载充值记录
  useEffect(() => {
    if (activeView === "assets" && isLoggedIn) {
      loadTopupRecords();
    }
  }, [activeView, isLoggedIn]);

  const refreshCurrentUser = async (): Promise<JuyouUserType | null> => {
    try {
      const user = await JuyouUser.getCurrentUser();
      persistLoggedInUser(user);
      setCurrentUser(user);
      return user;
    } catch (err: any) {
      if (err.isAuthError) {
        setApiToken(null);
        localStorage.removeItem("juyou-user-id");
        setCurrentUser(null);
      }
      throw err;
    }
  };

  const loadTopupRecords = async () => {
    setTopupLoading(true);
    try {
      const [result] = await Promise.all([
        JuyouLog.getTopupRecords({ page: 1, page_size: 10 }),
        refreshCurrentUser().catch((err) => {
          console.error("刷新用户余额失败:", err);
          return null;
        }),
      ]);
      setTopupRecords(result.items);
    } catch (err: any) {
      toast.error(err.message || "加载充值记录失败");
    } finally {
      setTopupLoading(false);
    }
  };

  // 发送聊天消息
  const ensureExperienceApiKey = async (): Promise<string> => {
    const tokensResult = await JuyouToken.getTokens({
      page: 1,
      page_size: 100,
    });
    const existingToken = tokensResult?.items?.find(
      (token) =>
        token.status === 1 && (token.unlimited_quota || token.remain_quota > 0),
    );

    let apiKey: string | undefined;
    if (existingToken) {
      const keyResult = await JuyouToken.getTokenKey(existingToken.id);
      apiKey = keyResult?.key;
    } else {
      const created = await JuyouToken.createToken({
        name: `Experience-${Date.now()}`,
        unlimited_quota: true,
        expired_time: -1,
      });
      apiKey = created?.key;
    }

    if (!apiKey) {
      throw new Error("Unable to get an available API Key");
    }

    setApiToken(apiKey);
    return apiKey;
  };

  const findExperienceLog = async ({
    requestStartedAt,
    model,
    userContent,
  }: {
    requestStartedAt: number;
    model: string;
    userContent: string;
  }): Promise<JuyouLogType | null> => {
    const contentSnippet = userContent.trim().slice(0, 24);

    for (const delayMs of [0, 1200]) {
      if (delayMs > 0) {
        await wait(delayMs);
      }

      try {
        const now = Math.floor(Date.now() / 1000);
        const result = await JuyouLog.getLogs({
          page: 1,
          page_size: 10,
          start_time: requestStartedAt - 5,
          end_time: now + 5,
          model_name: model,
        });

        const candidates = (result.items || [])
          .filter((log) => log.created_at >= requestStartedAt - 5)
          .filter((log) => !model || log.model_name === model)
          .sort((a, b) => b.created_at - a.created_at || b.id - a.id);

        const contentMatched = contentSnippet
          ? candidates.find((log) => log.content?.includes(contentSnippet))
          : null;
        const matched = contentMatched || candidates[0];
        if (matched) {
          return matched;
        }
      } catch (err) {
        console.warn("[体验中心] 同步真实调用日志失败:", err);
        return null;
      }
    }

    return null;
  };

  const syncExperienceLogStats = async ({
    requestStartedAt,
    model,
    userContent,
    fallbackTokens,
    fallbackLatency,
  }: {
    requestStartedAt: number;
    model: string;
    userContent: string;
    fallbackTokens: number;
    fallbackLatency: number;
  }) => {
    const realLog = await findExperienceLog({
      requestStartedAt,
      model,
      userContent,
    });

    if (realLog) {
      const tokens = getLogTokens(realLog) || fallbackTokens;
      const realLatency = realLog.use_time || fallbackLatency;
      setChatStats({
        latency: realLatency,
        throughput: calculateThroughput(tokens, realLatency),
        tokens,
        cost: quotaToYuan(realLog.quota || 0),
        costSource: "backend",
        logId: realLog.id,
      });
      if (selectedTimeRange === "today") {
        loadLogStats("today");
      }
    } else {
      setChatStats((stats) => ({
        ...stats,
        costSource: "fallback",
      }));
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    if (!isLoggedIn) {
      setPendingViewAfterLogin("experience");
      setShowLoginModal(true);
      return;
    }
    if (!selectedModel) {
      toast.error("请先选择一个模型");
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
    };
    const messages = [...chatMessages, userMessage];
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    const startTime = performance.now();
    const requestStartedAt = Math.floor(Date.now() / 1000);

    try {
      const apiKey = await ensureExperienceApiKey();

      if (chatStreamingEnabled) {
        const assistantIndex = messages.length;
        let streamedContent = "";
        let firstDeltaLatency = 0;
        let latestTokens = 0;

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        const streamResult = await JuyouChat.sendChatCompletionStream(
          {
            model: selectedModel,
            messages,
            temperature: 0.7,
            max_tokens: 2048,
            apiKey,
          },
          {
            onDelta: (delta) => {
              if (!firstDeltaLatency) {
                firstDeltaLatency = Math.round(performance.now() - startTime);
              }
              streamedContent += delta;
              latestTokens = estimateTokens(streamedContent);
              const elapsed = Math.round(performance.now() - startTime);

              setChatMessages((prev) =>
                prev.map((message, index) =>
                  index === assistantIndex
                    ? { ...message, content: streamedContent }
                    : message,
                ),
              );
              setChatStats({
                latency: firstDeltaLatency || elapsed,
                throughput: calculateThroughput(latestTokens, elapsed),
                tokens: latestTokens,
                cost: 0,
                costSource: "pending",
              });
            },
            onUsage: (usage) => {
              latestTokens = usage.total_tokens;
            },
          },
        );

        const latency = Math.round(performance.now() - startTime);
        const finalTokens = streamResult.usage?.total_tokens || latestTokens;
        setChatLoading(false);
        setChatStats((stats) => ({
          ...stats,
          latency: stats.latency || latency,
          throughput: calculateThroughput(finalTokens, latency),
          tokens: finalTokens,
          costSource: "pending",
        }));

        await syncExperienceLogStats({
          requestStartedAt,
          model: selectedModel,
          userContent: userMessage.content,
          fallbackTokens: finalTokens,
          fallbackLatency: latency,
        });
        return;
      }

      const response = await JuyouChat.sendChatCompletion({
        model: selectedModel,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        apiKey,
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      const responseTokens = response.usage.total_tokens;

      setChatMessages((prev) => [...prev, response.choices[0].message]);
      setChatStats({
        latency,
        throughput: calculateThroughput(responseTokens, latency),
        tokens: responseTokens,
        cost: 0,
        costSource: "pending",
      });
      setChatLoading(false);

      await syncExperienceLogStats({
        requestStartedAt,
        model: selectedModel,
        userContent: userMessage.content,
        fallbackTokens: responseTokens,
        fallbackLatency: latency,
      });
    } catch (err: any) {
      toast.error(err.message || "发送消息失败");
      setChatMessages((prev) =>
        prev.filter(
          (message) => message.content.trim() || message.role !== "assistant",
        ),
      );
    } finally {
      setChatLoading(false);
    }
  };

  const loadTokens = async () => {
    setTokensLoading(true);
    try {
      const result = await JuyouToken.getTokens({
        page: tokensPage,
        page_size: 10,
      });
      setTokens(result.items);
      setTokensTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || "加载令牌列表失败");
    } finally {
      setTokensLoading(false);
    }
  };

  const getTimeRange = (range: "today" | "yesterday" | "week" | "month") => {
    const now = Math.floor(Date.now() / 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = Math.floor(today.getTime() / 1000);

    switch (range) {
      case "today":
        return { start_time: todayStart, end_time: now };
      case "yesterday":
        const yesterdayStart = todayStart - 24 * 3600;
        const yesterdayEnd = todayStart - 1;
        return { start_time: yesterdayStart, end_time: yesterdayEnd };
      case "week":
        const weekStart = todayStart - 7 * 24 * 3600;
        return { start_time: weekStart, end_time: now };
      case "month":
        const monthStart = todayStart - 30 * 24 * 3600;
        return { start_time: monthStart, end_time: now };
    }
  };

  const loadLogStats = async (
    range: "today" | "yesterday" | "week" | "month" = selectedTimeRange,
  ) => {
    try {
      const timeRange = getTimeRange(range);
      const stats = await JuyouLog.getLogStats(timeRange);
      setLogStats(stats);
    } catch (err: any) {
      console.error("[数据面板] 加载统计失败:", err);
      toast.error(err.message || "加载统计失败");
    }
  };

  const loadLogs = async (
    range: "today" | "yesterday" | "week" | "month" = selectedTimeRange,
    page = logsPage,
  ) => {
    setLogsLoading(true);
    try {
      const timeRange = getTimeRange(range);
      const result = await JuyouLog.getLogs({
        page,
        page_size: LOGS_PAGE_SIZE,
        ...timeRange,
      });
      setLogs(result.items);
      setLogsTotal(result.total);
      setLogsPage(page);
    } catch (err: any) {
      toast.error(err.message || "加载调用记录失败");
    } finally {
      setLogsLoading(false);
    }
  };

  const handleDeleteToken = async (id: number, _name: string) => {
    try {
      await JuyouToken.deleteToken(id);
      toast.success("删除成功");
      loadTokens();
    } catch (err: any) {
      toast.error(err.message || "删除失败");
    }
  };

  const handleToggleTokenStatus = async (token: JuyouTokenType) => {
    const nextStatus = token.status === 1 ? 2 : 1;
    setUpdatingTokenIds((prev) => new Set(prev).add(token.id));
    try {
      await JuyouToken.updateToken({
        id: token.id,
        name: token.name,
        remain_quota: token.remain_quota,
        unlimited_quota: token.unlimited_quota,
        expired_time: token.expired_time,
        model_limits:
          typeof token.models === "string"
            ? token.models
            : token.models?.join(",") || token.model_limits || undefined,
        allow_ips: token.allow_ips || undefined,
        group: token.group || undefined,
        cross_group_retry: token.cross_group_retry,
        status: nextStatus,
      });
      setTokens((prev) =>
        prev.map((item) =>
          item.id === token.id ? { ...item, status: nextStatus } : item,
        ),
      );
      toast.success(nextStatus === 1 ? "已启用密钥" : "已停用密钥");
    } catch (err: any) {
      toast.error(err.message || "状态更新失败");
    } finally {
      setUpdatingTokenIds((prev) => {
        const next = new Set(prev);
        next.delete(token.id);
        return next;
      });
    }
  };

  const handleCreateToken = async () => {
    if (!createTokenForm.name.trim()) {
      toast.error("请输入令牌名称");
      return;
    }
    setCreateTokenLoading(true);
    try {
      // 创建接口会返回完整密钥；完整密钥仅此一次可见。
      const created = await JuyouToken.createToken({
        name: createTokenForm.name,
        remain_quota: createTokenForm.unlimited_quota
          ? undefined
          : createTokenForm.remain_quota,
        unlimited_quota: createTokenForm.unlimited_quota,
        expired_time: createTokenForm.expired_time || undefined,
      });

      let key = created?.key;
      if (!key && created?.id) {
        const keyResult = await JuyouToken.getTokenKey(created.id);
        key = keyResult?.key;
      }

      if (!key) {
        throw new Error("无法获取 Token 密钥");
      }

      toast.success("创建成功");
      // 显示完整密钥
      alert(`令牌创建成功！\n\n密钥（请妥善保管，仅显示一次）：\n${key}`);
      closeCreateTokenModal();
      loadTokens();
    } catch (err: any) {
      toast.error(err.message || "创建失败");
    } finally {
      setCreateTokenLoading(false);
    }
  };

  const requireLogin = (
    target: "quickStart" | "apiKeys" | "dataPanel" | "experience" | "assets",
  ) => {
    if (isLoggedIn) {
      setActiveView(target);
    } else {
      setPendingViewAfterLogin(target);
      setShowLoginModal(true);
    }
  };

  const handleLogin = async () => {
    const passwordPhone = normalizePhone(loginForm.username);
    if (loginMode === "password" && (!passwordPhone || !loginForm.password)) {
      toast.error("请输入手机号和密码");
      return;
    }
    if (loginMode === "password" && !MAINLAND_PHONE_RE.test(passwordPhone)) {
      toast.error("请输入有效的中国大陆手机号");
      return;
    }

    const phone = normalizePhone(phoneLoginForm.phone);
    const code = phoneLoginForm.code.trim();
    if (loginMode === "phone" && (!phone || !code)) {
      toast.error("请输入手机号和验证码");
      return;
    }
    if (loginMode === "phone" && !MAINLAND_PHONE_RE.test(phone)) {
      toast.error("请输入有效的中国大陆手机号");
      return;
    }

    setLoginLoading(true);
    try {
      const user =
        loginMode === "phone"
          ? await JuyouUser.loginByPhoneCode({ phone, code })
          : await JuyouUser.login({
              username: passwordPhone,
              password: loginForm.password,
            });
      if ((user as { require_2fa?: boolean }).require_2fa) {
        toast.error("该账号开启了两步验证，请使用手机号密码登录");
        return;
      }
      persistLoggedInUser(user);
      setCurrentUser(user);
      setShowLoginModal(false);
      toast.success("登录成功");
      if (pendingViewAfterLogin) {
        setActiveView(pendingViewAfterLogin);
        setPendingViewAfterLogin(null);
      }
    } catch (err: any) {
      toast.error(err.message || "登录失败");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendPhoneCode = async () => {
    const phone = normalizePhone(phoneLoginForm.phone);
    if (!phone) {
      toast.error("请输入手机号");
      return;
    }
    if (!MAINLAND_PHONE_RE.test(phone)) {
      toast.error("请输入有效的中国大陆手机号");
      return;
    }

    setPhoneCodeLoading(true);
    try {
      await JuyouUser.sendPhoneLoginCode({ phone });
      setPhoneLoginForm((form) => ({ ...form, phone }));
      setPhoneCodeCountdown(60);
      toast.success("验证码已发送");
    } catch (err: any) {
      toast.error(err.message || "验证码发送失败");
    } finally {
      setPhoneCodeLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await JuyouUser.logout();
      setCurrentUser(null);
      setApiToken(null);
      localStorage.removeItem("juyou-user-id");
      setActiveView("quickStart");
      toast.success("已退出登录");
    } catch (err: any) {
      toast.error(err.message || "退出失败");
    }
  };

  // 掩码显示密钥：sk_live_••••••••39a1
  const maskKey = (key: string): string => {
    if (!key) return "";
    const prefixMatch = key.match(/^(sk[-_][a-z]+[-_]?)/i);
    const prefix = prefixMatch ? prefixMatch[1] : key.slice(0, 7);
    const tail = key.slice(-4);
    return `${prefix}••••••••${tail}`;
  };

  const closeCreateTokenModal = () => {
    setShowCreateTokenModal(false);
    setCreateTokenForm({
      name: "",
      remain_quota: 100000,
      unlimited_quota: false,
      expired_time: 0,
    });
  };

  const handleQuickSetup = async () => {
    if (!isLoggedIn) {
      setPendingViewAfterLogin("quickStart");
      setShowLoginModal(true);
      return;
    }

    try {
      const appId = selectedAgent;
      toast.loading(`正在配置 ${appId.toUpperCase()}...`, {
        id: "quick-setup",
      });

      // Codex/Claude: 复用或创建聚游助手 Token，然后写入 live 配置并保存到数据库。
      if (appId === "codex" || appId === "claude") {
        try {
          const tokenPrefix = getQuickSetupTokenName(appId);

          // 步骤1: 查找是否已有对应 Agent 的 Token，有则复用
          let tokenId = await findQuickSetupTokenId(tokenPrefix);
          let juyouApiKey: string | undefined;

          if (!tokenId) {
            // 没有则创建新的。使用固定名称，避免每次 miss 后创建一批时间戳 Token。
            const tokenName = tokenPrefix;
            const created = (await JuyouToken.createToken({
              name: tokenName,
              unlimited_quota: true,
              expired_time: -1,
            })) as any;
            tokenId = created?.id ?? created?.token?.id ?? created?.data?.id;
            juyouApiKey =
              created?.key ?? created?.token?.key ?? created?.data?.key;

            if (!tokenId) {
              tokenId = await findQuickSetupTokenId(tokenPrefix);
            }
          }

          // 步骤2: 获取完整密钥
          if (!juyouApiKey && tokenId) {
            const keyResult = await JuyouToken.getTokenKey(tokenId);
            juyouApiKey = keyResult?.key;
          }

          if (!juyouApiKey) {
            throw new Error("无法获取 Token 密钥");
          }

          // 步骤3: 写入 live 配置，并把生成后的配置保存到数据库
          toast.loading("正在写入配置文件...", { id: "quick-setup" });
          await invoke(
            appId === "codex" ? "quick_setup_codex" : "quick_setup_claude",
            {
              apiKey: juyouApiKey,
              model: selectedModel,
            },
          );

          toast.success(
            `${getQuickSetupAppName(appId)} 配置成功，重启 ${getQuickSetupAppName(appId)} 后生效`,
            {
              id: "quick-setup",
              duration: 3000,
            },
          );
        } catch (err: any) {
          console.error("配置失败:", err);
          toast.error(
            `配置失败: ${extractErrorMessage(err) || err?.message || String(err)}`,
            { id: "quick-setup" },
          );
        }
        return;
      }

      // Claude/Gemini: 使用数据库导入
      let imported = await providersApi.importDefault(appId);

      if (!imported) {
        toast.dismiss("quick-setup");
        const shouldReimport = window.confirm(
          `检测到 ${appId.toUpperCase()} 已有配置。\n\n是否删除现有的 "default" 配置并重新导入？`,
        );

        if (shouldReimport) {
          await providersApi.delete("default", appId);
          toast.loading(`正在重新导入 ${appId.toUpperCase()} 配置...`, {
            id: "quick-setup",
          });
          imported = await providersApi.importDefault(appId);
        } else {
          toast.info("已取消重新导入", { id: "quick-setup" });
          return;
        }
      }

      if (imported) {
        toast.success(
          `${getQuickSetupAppName(appId)} 配置成功，重启 ${getQuickSetupAppName(appId)} 后生效`,
          {
            id: "quick-setup",
            duration: 3000,
          },
        );
      } else {
        toast.info("配置已存在", { id: "quick-setup" });
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err) || "配置失败", {
        id: "quick-setup",
      });
    }
  };

  // 处理微信支付充值
  const handleWeChatPayTopup = async (amount: number) => {
    if (!isLoggedIn) {
      toast.error("请先登录");
      return;
    }

    try {
      toast.loading("正在创建支付订单...", { id: "wechatpay" });

      // 微信支付接口按用户选择的人民币金额下单；账户 quota/used_quota 才按积分换算展示。
      let order = await JuyouWeChatPayApi.createOrder(amount);

      // 如果返回的是信封格式，手动解包
      if (
        order &&
        typeof order === "object" &&
        "data" in order &&
        "message" in order
      ) {
        order = (order as any).data;
      }

      toast.success("请使用微信扫码支付", { id: "wechatpay", duration: 2000 });

      // 显示二维码
      const payQrCode = order.qr_code || order.code_url || "";
      const tradeNo = order.trade_no || order.order_id || "";

      setQrCodeUrl(payQrCode);
      setCurrentTradeNo(tradeNo);
      setShowQrCodeModal(true);

      // 开始轮询支付状态
      if (tradeNo) {
        startPaymentPolling(tradeNo);
      }
    } catch (err: any) {
      console.error("[微信支付] 创建支付订单失败:", err);
      console.error("[微信支付] 错误详情:", {
        status: err.status,
        isAuthError: err.isAuthError,
        message: err.message,
      });
      toast.error(
        `创建订单失败: ${extractErrorMessage(err) || err?.message || String(err)}`,
        { id: "wechatpay" },
      );
    }
  };

  // 轮询支付状态
  const startPaymentPolling = (tradeNo: string) => {
    setPaymentPolling(true);

    const pollInterval = setInterval(async () => {
      try {
        const status = await JuyouWeChatPayApi.getPaymentStatus(tradeNo);

        if (status.status === "success") {
          clearInterval(pollInterval);
          setPaymentPolling(false);
          setShowQrCodeModal(false);
          toast.success(`支付成功！已充值 ¥${status.money}`, {
            duration: 3000,
          });

          // 刷新用户余额
          await refreshCurrentUser();

          // 刷新充值记录
          loadTopupRecords();
        } else if (status.status === "failed" || status.status === "expired") {
          clearInterval(pollInterval);
          setPaymentPolling(false);
          setShowQrCodeModal(false);
          toast.error(status.status === "expired" ? "订单已过期" : "支付失败");
        }
      } catch (err) {
        console.error("查询支付状态失败:", err);
      }
    }, 3000); // 每3秒查询一次

    // 5分钟后停止轮询
    setTimeout(() => {
      clearInterval(pollInterval);
      setPaymentPolling(false);
    }, 300000);
  };

  // 关闭二维码弹窗
  const handleCloseQrCode = () => {
    setShowQrCodeModal(false);
    setPaymentPolling(false);
  };

  const renderApiSwitcherMockup = () => (
    <div className="h-screen overflow-hidden bg-[#f6f8fb] text-[#172033]">
      <div className="flex h-full border border-[#d7e3f2] bg-white/40">
        <DashboardSidebar
          activeView={activeView}
          setActiveView={setActiveView}
          requireLogin={requireLogin}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenLogin={() => setShowLoginModal(true)}
        />

        <section className="relative flex min-w-0 flex-1 flex-col">
          {(activeView === "quickStart" || activeView === "settings") && (
            <a
              href="https://api.juyouhuyu.top"
              target="_blank"
              rel="noreferrer"
              className="absolute right-8 top-6 z-10 inline-flex h-9 items-center gap-2 rounded-md border border-[#dbe4ef] bg-white px-3 text-xs font-bold text-[#0b65d8] shadow-sm transition-colors hover:border-[#0b65d8] hover:bg-[#f2f7ff]"
              aria-label="访问聚游 API 官网"
            >
              访问官网
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {activeView === "quickStart" ? (
            <QuickStartPanel
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onQuickSetup={handleQuickSetup}
            />
          ) : activeView === "apiKeys" ? (
            <ApiKeysPanel
              tokens={tokens}
              tokensLoading={tokensLoading}
              tokensPage={tokensPage}
              tokensTotal={tokensTotal}
              updatingTokenIds={updatingTokenIds}
              showCreateTokenModal={showCreateTokenModal}
              createTokenForm={createTokenForm}
              createTokenLoading={createTokenLoading}
              setTokensPage={setTokensPage}
              setShowCreateTokenModal={setShowCreateTokenModal}
              setCreateTokenForm={setCreateTokenForm}
              loadTokens={loadTokens}
              maskKey={maskKey}
              handleDeleteToken={handleDeleteToken}
              handleToggleTokenStatus={handleToggleTokenStatus}
              handleCreateToken={handleCreateToken}
              closeCreateTokenModal={closeCreateTokenModal}
            />
          ) : activeView === "dataPanel" ? (
            <DataPanel
              logStats={logStats}
              logs={logs}
              logsLoading={logsLoading}
              logsPage={logsPage}
              logsPageSize={LOGS_PAGE_SIZE}
              logsTotal={logsTotal}
              selectedTimeRange={selectedTimeRange}
              setSelectedTimeRange={setSelectedTimeRange}
              loadLogStats={loadLogStats}
              loadLogs={loadLogs}
              onRefresh={() => {
                loadLogStats(selectedTimeRange);
                loadLogs(selectedTimeRange, logsPage);
              }}
            />
          ) : activeView === "assets" ? (
            <AssetsPanel
              currentUser={currentUser}
              selectedTopupAmount={selectedTopupAmount}
              setSelectedTopupAmount={setSelectedTopupAmount}
              customTopupAmount={customTopupAmount}
              setCustomTopupAmount={setCustomTopupAmount}
              topupLoading={topupLoading}
              topupRecords={topupRecords}
              handleWeChatPayTopup={handleWeChatPayTopup}
              onRefresh={loadTopupRecords}
            />
          ) : activeView === "experience" ? (
            <ExperiencePanel
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatLoading={chatLoading}
              chatStats={chatStats}
              setChatStats={setChatStats}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              chatStreamingEnabled={chatStreamingEnabled}
              setChatStreamingEnabled={setChatStreamingEnabled}
              sendChatMessage={sendChatMessage}
            />
          ) : (
            <SettingsPanel
              currentUser={currentUser}
              onLogout={handleLogout}
              onOpenLogin={() => setShowLoginModal(true)}
            />
          )}
        </section>
      </div>

      {showLoginModal && (
        <LoginModal
          loginMode={loginMode}
          setLoginMode={setLoginMode}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          phoneLoginForm={phoneLoginForm}
          setPhoneLoginForm={setPhoneLoginForm}
          loginLoading={loginLoading}
          phoneCodeLoading={phoneCodeLoading}
          phoneCodeCountdown={phoneCodeCountdown}
          onLogin={handleLogin}
          onSendPhoneCode={handleSendPhoneCode}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* ????????? */}
      {showQrCodeModal && (
        <PaymentQrModal
          qrCodeUrl={qrCodeUrl}
          currentTradeNo={currentTradeNo}
          paymentPolling={paymentPolling}
          onClose={handleCloseQrCode}
        />
      )}
    </div>
  );

  return renderApiSwitcherMockup();
}

export default Dashboard;
