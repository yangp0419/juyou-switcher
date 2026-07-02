import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  Check,
  ChevronDown,
  MessageSquare,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import type { ChatMessage } from "@/services/backend/chat";
import type { JuyouModel as JuyouModelType } from "@/services/backend/types";

type ChatCostSource = "backend" | "pending" | "fallback" | "none";

interface ChatStats {
  latency: number;
  throughput: number;
  tokens: number;
  cost: number;
  costSource: ChatCostSource;
  logId?: number;
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-[#0b65d8] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-5 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-5 list-decimal space-y-1">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-[#c7d7ee] pl-3 text-[#58677d]">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const block = className?.includes("language-");
    return block ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[0.85em] text-[#0b65d8] ring-1 ring-[#dbe4ef]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-[#111827] p-3 font-mono text-xs leading-relaxed text-[#e5e7eb]">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[#dbe4ef] bg-white/70 px-2 py-1 font-bold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[#dbe4ef] px-2 py-1">{children}</td>
  ),
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown components={markdownComponents}>
      {content || "正在生成..."}
    </ReactMarkdown>
  );
}

interface ExperiencePanelProps {
  chatMessages: ChatMessage[];
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  chatInput: string;
  setChatInput: Dispatch<SetStateAction<string>>;
  chatLoading: boolean;
  chatStats: ChatStats;
  setChatStats: Dispatch<SetStateAction<ChatStats>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  availableModels: JuyouModelType[];
  modelsLoading: boolean;
  chatStreamingEnabled: boolean;
  setChatStreamingEnabled: Dispatch<SetStateAction<boolean>>;
  sendChatMessage: () => void;
}

export function ExperiencePanel({
  chatMessages,
  setChatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  chatStats,
  setChatStats,
  selectedModel,
  setSelectedModel,
  availableModels,
  modelsLoading,
  chatStreamingEnabled,
  setChatStreamingEnabled,
  sendChatMessage,
}: ExperiencePanelProps) {
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const modelOptions = useMemo(() => {
    if (availableModels && availableModels.length > 0) {
      return availableModels.map((model) => model.model_name);
    }
    return ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro", "deepseek-chat"];
  }, [availableModels]);

  const selectedModelLabel = modelsLoading
    ? "加载模型中..."
    : selectedModel || modelOptions[0] || "选择模型";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (!modelMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(event.target as Node)
      ) {
        setModelMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [modelMenuOpen]);

  const amountLabel =
    chatStats.costSource === "backend"
      ? `实际金额: ¥${chatStats.cost.toFixed(4)}`
      : chatStats.costSource === "pending"
        ? "实际金额: 同步中"
        : chatStats.costSource === "fallback"
          ? "实际金额: 待日志同步"
          : "实际金额: ¥0.0000";

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-[#f7f9fc] p-6">
      {/* 对话测试卡片 */}
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#e4e9f2] bg-white shadow-sm">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-[#edf2f7] px-6 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#0b65d8]" />
            <h2 className="text-base font-bold text-[#202939]">对话测试</h2>
            <div ref={modelMenuRef} className="relative ml-3">
              <button
                type="button"
                disabled={chatLoading || modelsLoading}
                onClick={() => setModelMenuOpen((open) => !open)}
                className="flex h-9 min-w-[220px] max-w-[320px] items-center justify-between gap-3 rounded-lg border border-[#d0d5dd] bg-white px-3 text-left text-xs font-semibold text-[#344054] shadow-sm transition-colors hover:border-[#0b65d8] hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="truncate">{selectedModelLabel}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#667085] transition-transform ${
                    modelMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {modelMenuOpen && !modelsLoading && (
                <div className="absolute left-0 top-11 z-50 w-[320px] overflow-hidden rounded-lg border border-[#d0d5dd] bg-white shadow-xl">
                  <div className="max-h-72 overflow-y-auto py-1">
                    {modelOptions.map((modelName) => {
                      const active = selectedModel === modelName;
                      return (
                        <button
                          key={modelName}
                          type="button"
                          onClick={() => {
                            setSelectedModel(modelName);
                            setModelMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold transition-colors ${
                            active
                              ? "bg-[#eff6ff] text-[#0b65d8]"
                              : "text-[#344054] hover:bg-[#f8fafc]"
                          }`}
                        >
                          <span className="truncate">{modelName}</span>
                          {active && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={chatLoading}
              onClick={() => setChatStreamingEnabled((enabled) => !enabled)}
              className="flex h-8 items-center gap-2 rounded-md border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold text-[#344054] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
              aria-pressed={chatStreamingEnabled}
            >
              <span>流式输出</span>
              <span
                className={`relative h-4 w-7 rounded-full transition-colors ${
                  chatStreamingEnabled ? "bg-[#0b65d8]" : "bg-[#cbd5e1]"
                }`}
              >
                <span
                  className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                    chatStreamingEnabled ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
            <button className="rounded-md px-3 py-1.5 text-xs font-semibold text-emerald-600">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
              真实调用
            </button>
            <button
              onClick={() => {
                setChatMessages([
                  {
                    role: "assistant",
                    content:
                      "您好！我是聚游助手，您可以尝试输入任何问题，我将通过最优节点为您提供回答。您可以察看下方的实时性能指标。",
                  },
                ]);
                setChatStats({
                  latency: 0,
                  throughput: 0,
                  tokens: 0,
                  cost: 0,
                  costSource: "none",
                });
              }}
              className="rounded-md border border-[#d0d5dd] px-3 py-1.5 text-xs font-semibold text-[#667085] hover:bg-[#f8fafc]"
            >
              清空对话
            </button>
          </div>
        </div>

        {/* 对话区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {chatMessages.map((msg, idx) =>
              msg.role === "assistant" ? (
                <div key={idx} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b65d8] text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="rounded-2xl rounded-tl-sm bg-[#f1f3f5] px-4 py-3 text-sm leading-relaxed text-[#202939]">
                      <MarkdownMessage content={msg.content} />
                    </div>
                  </div>
                </div>
              ) : (
                <div key={idx} className="flex flex-row-reverse gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e7f0ff] text-[#0b65d8]">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-tr-sm bg-[#0b65d8] px-4 py-3 text-sm leading-relaxed text-white">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
            {chatLoading && !chatStreamingEnabled && (
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b65d8] text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="rounded-2xl rounded-tl-sm bg-[#f1f3f5] px-4 py-3 text-sm leading-relaxed text-[#98a2b3]">
                    正在思考...
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* 底部统计栏 */}
        <div className="flex items-center justify-between border-t border-[#edf2f7] bg-[#f8fafc] px-6 py-3 text-xs">
          <div className="flex gap-6 text-[#667085]">
            <span>
              首字延迟:{" "}
              <span className="font-semibold text-[#202939]">
                {chatStats.latency}ms
              </span>
            </span>
            <span>
              吞吐量:{" "}
              <span className="font-semibold text-[#202939]">
                {chatStats.throughput.toFixed(1)} t/s
              </span>
            </span>
            <span>
              Token 消耗:{" "}
              <span className="font-semibold text-[#202939]">
                {chatStats.tokens} tk
              </span>
            </span>
          </div>
          <div className="font-semibold text-[#0b65d8]">{amountLabel}</div>
        </div>

        {/* 输入框区域 */}
        <div className="border-t border-[#edf2f7] p-4">
          <div className="relative">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder="在此输入您的问题..."
              className="w-full resize-none rounded-lg border border-[#d0d5dd] bg-white px-4 py-3 pr-12 text-sm text-[#202939] outline-none focus:border-[#0b65d8] focus:ring-2 focus:ring-[#0b65d8]/20"
              rows={3}
              disabled={chatLoading}
            />
            <button
              onClick={sendChatMessage}
              disabled={chatLoading || !chatInput.trim()}
              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b65d8] text-white hover:bg-[#095ac2] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
