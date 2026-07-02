import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Brain, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getIcon } from "@/icons/extracted";
import { cn } from "@/lib/utils";
import type { AppId } from "@/lib/api";
import type { JuyouModel as JuyouModelType } from "@/services/backend/types";

const quickStartAgents: {
  id: AppId;
  name: string;
  icon: string;
  iconColor: string;
}[] = [
  { id: "codex" as AppId, name: "Codex", icon: "openai", iconColor: "#202939" },
  {
    id: "claude" as AppId,
    name: "Claude",
    icon: "claude",
    iconColor: "#D97757",
  },
  {
    id: "opencode" as AppId,
    name: "OpenCode",
    icon: "opencode",
    iconColor: "#211E1E",
  },
];

const fallbackModels = [
  { id: "gpt-4o", name: "GPT-4o" },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5",
  },
  {
    id: "llama-3.1-405b",
    name: "Llama 3.1",
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek",
  },
];

const modelVendors = [
  { id: "all", label: "全部", prefixes: [] },
  {
    id: "claude",
    label: "Claude",
    prefixes: ["claude"],
    icon: "claude",
    iconColor: "#D97757",
  },
  {
    id: "gpt",
    label: "GPT",
    prefixes: ["gpt"],
    icon: "openai",
    iconColor: "#202939",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    prefixes: ["deepseek"],
    icon: "deepseek",
    iconColor: "#4D6BFE",
  },
  {
    id: "qwen",
    label: "Qwen",
    prefixes: ["qwen"],
    icon: "qwen",
    iconColor: "#615CED",
  },
  {
    id: "gemini",
    label: "Gemini",
    prefixes: ["gemini"],
    icon: "gemini",
    iconColor: "#4285F4",
  },
  {
    id: "llama",
    label: "Llama",
    prefixes: ["llama"],
    icon: "meta",
    iconColor: "#0081FB",
  },
  {
    id: "kimi",
    label: "Kimi",
    prefixes: ["kimi"],
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    id: "glm",
    label: "GLM",
    prefixes: ["glm"],
    icon: "zhipu",
    iconColor: "#0F62FE",
  },
  {
    id: "minimax",
    label: "MiniMax",
    prefixes: ["minimax"],
    icon: "minimax",
    iconColor: "#FF6B6B",
  },
  {
    id: "doubao",
    label: "DouBao",
    prefixes: ["doubao"],
    icon: "doubao",
    iconColor: "#2563EB",
  },
  {
    id: "step",
    label: "Step",
    prefixes: ["step"],
    icon: "stepfun",
    iconColor: "#005AFF",
  },
  {
    id: "baidu",
    label: "Baidu",
    prefixes: ["baidu"],
    icon: "baidu",
    iconColor: "#2932E1",
  },
  { id: "other", label: "其他", prefixes: [] },
];

type ModelVendorId = (typeof modelVendors)[number]["id"];

interface QuickStartModel {
  id: string;
  name: string;
}

function getModelVersionParts(modelName: string): number[] {
  return (modelName.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function compareModelsByVersionDesc(a: QuickStartModel, b: QuickStartModel) {
  const aVersions = getModelVersionParts(a.id);
  const bVersions = getModelVersionParts(b.id);
  const maxLength = Math.max(aVersions.length, bVersions.length);

  for (let index = 0; index < maxLength; index += 1) {
    const aVersion = aVersions[index] ?? -1;
    const bVersion = bVersions[index] ?? -1;

    if (aVersion !== bVersion) {
      return bVersion - aVersion;
    }
  }

  return a.name.localeCompare(b.name);
}

function getModelVendor(modelName: string): ModelVendorId {
  const name = modelName.toLowerCase();
  const vendor = modelVendors.find(
    (item) =>
      item.id !== "all" &&
      item.id !== "other" &&
      item.prefixes.some((prefix) => name.startsWith(prefix)),
  );

  return vendor?.id ?? "other";
}

function getModelVendorConfig(modelName: string) {
  const vendor = getModelVendor(modelName);
  return modelVendors.find((item) => item.id === vendor);
}

function BrandIcon({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center [&_svg]:h-full [&_svg]:w-full",
        className,
      )}
      style={{ color }}
      dangerouslySetInnerHTML={{
        __html: getIcon(icon).replace(/<title>.*?<\/title>/g, ""),
      }}
    />
  );
}

interface QuickStartPanelProps {
  selectedAgent: AppId;
  setSelectedAgent: Dispatch<SetStateAction<AppId>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  availableModels: JuyouModelType[];
  modelsLoading: boolean;
  onQuickSetup: () => void;
}

export function QuickStartPanel({
  selectedAgent,
  setSelectedAgent,
  selectedModel,
  setSelectedModel,
  availableModels,
  modelsLoading,
  onQuickSetup,
}: QuickStartPanelProps) {
  const handleQuickSetup = onQuickSetup;
  const [activeModelVendor, setActiveModelVendor] =
    useState<ModelVendorId>("all");
  const modelOptions = useMemo<QuickStartModel[]>(() => {
    if (availableModels && availableModels.length > 0) {
      return availableModels
        .map((model) => ({
          id: model.model_name,
          name: model.model_name,
        }))
        .sort(compareModelsByVersionDesc);
    }

    return [...fallbackModels].sort(compareModelsByVersionDesc);
  }, [availableModels]);

  const availableModelVendors = useMemo(() => {
    const vendorCounts = modelOptions.reduce<Record<string, number>>(
      (counts, model) => {
        const vendor = getModelVendor(model.id);
        counts[vendor] = (counts[vendor] ?? 0) + 1;
        return counts;
      },
      {},
    );

    return modelVendors.filter(
      (vendor) => vendor.id === "all" || vendorCounts[vendor.id],
    );
  }, [modelOptions]);

  const visibleModelOptions = useMemo(() => {
    if (activeModelVendor === "all") {
      return modelOptions;
    }

    return modelOptions.filter(
      (model) => getModelVendor(model.id) === activeModelVendor,
    );
  }, [activeModelVendor, modelOptions]);

  return (
    <main className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-6 sm:px-8">
      <div className="my-auto w-full max-w-[530px] text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#0b65d8]">
          <Rocket className="h-5 w-5" />
        </div>
        <h1 className="text-[20px] font-bold tracking-tight text-[#202939]">
          欢迎使用聚游助手
        </h1>
        <p className="mt-2 text-sm font-medium text-[#9aa6b8]">
          只需几分钟，即可完成您的生产环境配置。
        </p>

        <div className="relative mt-7 overflow-hidden rounded-xl border border-[#dbe4ef] bg-white px-7 py-7 text-left shadow-[0_16px_40px_rgba(16,24,40,0.12)]">
          {/* 第一步：选择 Agent */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0b65d8] text-[11px] font-bold text-white">
                1
              </span>
              <span className="text-sm font-semibold text-[#344054]">
                第一步：选择 Agent
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {quickStartAgents.map((agent) => {
                const active = selectedAgent === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-lg border px-4 py-4 transition-all",
                      active
                        ? "border-[#0b65d8] bg-[#f2f7ff] ring-1 ring-[#0b65d8]"
                        : "border-[#e4e9f2] bg-white hover:border-[#cfd9e8]",
                    )}
                  >
                    <BrandIcon
                      icon={agent.icon}
                      color={agent.iconColor}
                      className={active ? "opacity-100" : "opacity-60"}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        active ? "text-[#0b65d8]" : "text-[#667085]",
                      )}
                    >
                      {agent.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 第二步：选择模型 */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#cdd5e1] text-[11px] font-bold text-white">
                2
              </span>
              <span className="text-sm font-semibold text-[#344054]">
                第二步：选择模型
              </span>
            </div>
            {modelsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-[#98a2b3]">
                加载模型列表...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                  <div className="flex w-max min-w-full flex-nowrap gap-2">
                    {availableModelVendors.map((vendor) => {
                      const active = activeModelVendor === vendor.id;
                      return (
                        <button
                          key={vendor.id}
                          onClick={() => setActiveModelVendor(vendor.id)}
                          className={cn(
                            "h-8 shrink-0 rounded-full border px-3 text-[11px] font-bold transition-all",
                            active
                              ? "border-[#0b65d8] bg-[#f2f7ff] text-[#0b65d8]"
                              : "border-[#e4e9f2] bg-white text-[#667085] hover:border-[#cfd9e8]",
                          )}
                        >
                          {vendor.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="-mx-1 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                  <div className="flex w-max min-w-full flex-nowrap gap-2">
                    {visibleModelOptions.map((model) => {
                      const vendor = getModelVendorConfig(model.id);
                      const active = selectedModel === model.id;
                      return (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={cn(
                            "flex h-[74px] w-[112px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 transition-all",
                            active
                              ? "border-[#0b65d8] bg-[#f2f7ff]"
                              : "border-[#e4e9f2] bg-white hover:border-[#cfd9e8]",
                          )}
                        >
                          {vendor?.icon ? (
                            <BrandIcon
                              icon={vendor.icon}
                              color={vendor.iconColor ?? "#667085"}
                              className={cn(
                                "h-4 w-4 shrink-0",
                                active ? "opacity-100" : "opacity-60",
                              )}
                            />
                          ) : (
                            <Brain
                              className={cn(
                                "h-4 w-4 shrink-0",
                                active ? "text-[#0b65d8]" : "text-[#98a2b3]",
                              )}
                            />
                          )}
                          <span
                            className={cn(
                              "w-full truncate text-center text-[10px] font-semibold leading-tight",
                              active ? "text-[#0b65d8]" : "text-[#667085]",
                            )}
                            title={model.name}
                          >
                            {model.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {visibleModelOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#dbe4ef] py-5 text-center text-xs font-semibold text-[#98a2b3]">
                    当前分类暂无模型
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* 一键配置按钮 */}
          <div className="flex items-center justify-between rounded-lg bg-[#f2f7ff] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b65d8] text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-sm font-bold text-[#202939]">
                一键配置你的 Agent
              </div>
            </div>
            <Button
              onClick={handleQuickSetup}
              className="h-10 rounded-md bg-[#0b65d8] px-5 text-xs font-bold text-white shadow-[0_8px_16px_rgba(11,101,216,0.28)] hover:bg-[#095ac2]"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              一键配置
            </Button>
          </div>
        </div>

        <p className="mt-5 text-xs text-[#98a2b3]">
          您的数据存储在本地，符合{" "}
          <span className="font-semibold text-[#0b65d8]">隐私安全规范</span>。
        </p>
      </div>
    </main>
  );
}
