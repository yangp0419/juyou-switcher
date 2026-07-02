import React from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  Download,
  Github,
  HardDriveDownload,
  Layers3,
  Monitor,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

import "./styles.css";
import logoUrl from "./logo.png";

const repoUrl = "https://github.com/yangp0419/juyou-switcher";
const downloadApiBase = import.meta.env.VITE_DOWNLOAD_API_BASE ?? "";

const downloadUrls = {
  mac: `${downloadApiBase}/api/download?platform=mac`,
  windows: `${downloadApiBase}/api/download?platform=windows`,
  linux: `${downloadApiBase}/api/download?platform=linux`,
};

const primaryDownloadUrl = downloadUrls.windows;

const navItems = [
  { label: "功能", href: "#features" },
  { label: "下载", href: "#download" },
  { label: "安装", href: "#install" },
  { label: "FAQ", href: "#faq" },
];

const platforms = [
  {
    name: "Windows",
    package: "MSI 安装包 / Portable ZIP",
    requirement: "Windows 10 及以上",
    downloadUrl: downloadUrls.windows,
    icon: Monitor,
    accent: "blue",
  },
  {
    name: "macOS",
    package: "DMG 安装包 / Homebrew",
    requirement: "macOS 12 Monterey 及以上",
    downloadUrl: downloadUrls.mac,
    icon: PackageCheck,
    accent: "dark",
  },
  {
    name: "Linux",
    package: "AppImage / deb / rpm",
    requirement: "Ubuntu 22.04+ 等主流发行版",
    downloadUrl: downloadUrls.linux,
    icon: Terminal,
    accent: "teal",
  },
];

const features = [
  {
    title: "多工具统一接管",
    description:
      "在单一界面中无缝管理 Claude Code、Claude Desktop、Codex、Gemini CLI、OpenCode、OpenClaw 和 Hermes，支持快速热切换。",
    icon: Layers3,
    accent: "blue",
  },
  {
    title: "50+ 预设与一键配置",
    description:
      "内置官方登录、AWS Bedrock、NVIDIA NIM 及主流中转预设；支持秒级扫描并导入本地已有配置，告别手动编辑烦恼。",
    icon: Sparkles,
    accent: "violet",
  },
  {
    title: "统一 MCP 与 Skills 同步",
    description:
      "可视化管理 Prompts 与 Skills；通过软链接支持跨应用双向同步，并提供 Deep Link 一键导入生态。",
    icon: Code2,
    accent: "teal",
  },
  {
    title: "本地代理与故障转移",
    description:
      "提供本地高可用代理接管，支持自动 Failover 故障转移、服务商健康监控与智能整流，适合复杂模型路由。",
    icon: Zap,
    accent: "rose",
  },
  {
    title: "用量监控与成本审计",
    description:
      "可视化用量仪表盘，跨供应商统计 Token 消耗、消费趋势及详细请求日志，支持自定义模型定价。",
    icon: BarChart3,
    accent: "amber",
  },
  {
    title: "原子写入与自动备份",
    description:
      "基于 SQLite 数据库，使用临时文件+重命名原子写入机制，配有自动备份保护，极大保障本地数据安全性。",
    icon: ShieldCheck,
    accent: "slate",
  },
];

const steps = [
  {
    number: "01",
    title: "下载安装",
    description: "选择适合您操作系统（Windows/macOS/Linux）的安装包下载，或在 macOS 上使用 Homebrew 快捷安装。",
  },
  {
    number: "02",
    title: "一键配置导入",
    description: "首次打开可一键扫描并自动迁移本地已有的 Claude 或 Codex 配置，也可从 50+ 预设中选择添加。",
  },
  {
    number: "03",
    title: "即时热切换",
    description: "在主界面或系统托盘菜单一键启用新供应商，无缝热更新，即时应用于您的 AI 开发工作流。",
  },
];

const faqs = [
  {
    question: "聚游助手支持哪些 AI 编程工具？",
    answer:
      "全面支持 Claude Code、Claude Desktop、Codex、Gemini CLI、OpenCode、OpenClaw 以及 Hermes Agent 的配置管理。",
  },
  {
    question: "切换供应商后需要重启终端生效吗？",
    answer:
      "大部分 CLI 工具需要重启终端或应用生效，但本地代理热切换以及部分支持热更的场景（如 Claude Code）可实现免重启无缝切换。",
  },
  {
    question: "我的数据存储在哪里？安全吗？",
    answer:
      "所有数据本地化存储，完全符合隐私安全规范。数据库及备份存放在本地的 ~/.juyou-switcher 目录中，绝不上传到外部服务器。",
  },
  {
    question: "多台设备之间如何同步配置数据？",
    answer:
      "支持自定义配置路径与标准的 WebDAV 同步，您可以轻松利用 iCloud、OneDrive、Dropbox、坚果云或自建 NAS 保持多端数据实时共享。",
  },
];

function Logo() {
  return (
    <img
      src={logoUrl}
      className="logo-mark"
      alt="聚游助手"
    />
  );
}

function ButtonLink({
  children,
  href,
  tone = "primary",
}: {
  children: React.ReactNode;
  href: string;
  tone?: "primary" | "dark" | "light";
}) {
  return (
    <a
      className={`button-link button-link-${tone}`}
      href={href}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      target={href.startsWith("http") ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

function ProductPreview() {
  const providers = [
    { name: "OpenAI Official", meta: "官方登录 · 可切换", active: true },
    { name: "Kimi K2.7 Code", meta: "第三方供应商 · 代理接管", active: false },
    { name: "Volcengine Ark", meta: "模型路由 · 自动故障转移", active: false },
  ];

  return (
    <div className="product-preview">
      <div className="window-bar">
        <span className="traffic traffic-red" />
        <span className="traffic traffic-yellow" />
        <span className="traffic traffic-green" />
      </div>
      <div className="mock-shell">
        <aside className="mock-sidebar">
          {["Claude", "Codex", "Gemini", "OpenCode", "Hermes"].map((item) => (
            <span className={item === "Codex" ? "active" : ""} key={item}>
              {item}
            </span>
          ))}
        </aside>
        <main className="mock-main">
          <div className="mock-head">
            <h3>供应商总览</h3>
            <span>已启用 Codex</span>
          </div>
          <div className="provider-list">
            {providers.map((provider, index) => (
              <div className="provider-row" key={provider.name}>
                <span className={`provider-icon provider-icon-${index}`}>
                  {provider.name.slice(0, 1)}
                </span>
                <span className="provider-text">
                  <strong>{provider.name}</strong>
                  <small>{provider.meta}</small>
                </span>
                <span className={provider.active ? "status active" : "status"}>
                  {provider.active ? "Active" : "Ready"}
                </span>
              </div>
            ))}
          </div>
          <div className="usage-card">
            <div className="usage-head">
              <strong>本月用量趋势</strong>
              <span>+18.4%</span>
            </div>
            <div className="bars">
              {[36, 58, 42, 70, 50, 62, 78].map((height, index) => (
                <span
                  className={index === 6 ? "bar hot" : "bar"}
                  key={`${height}-${index}`}
                  style={{ height }}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="site">
      <div className="glow-sphere glow-sphere-1" />
      <div className="glow-sphere glow-sphere-2" />
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top">
            <Logo />
            <span>聚游助手</span>
          </a>
          <nav>
            {navItems.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <ButtonLink href={primaryDownloadUrl}>
            <Download size={16} />
            立即下载
          </ButtonLink>
        </div>
      </header>

      <main id="top">
        <section className="container hero">
          <div className="hero-copy">
            <div className="support-pill animate-fade-in-up">
              <CheckCircle2 size={16} />
              适用于 Windows / macOS / Linux
            </div>
            <h1 className="animate-fade-in-up delay-1">一个应用，管理所有 AI 编程工具</h1>
            <p className="animate-fade-in-up delay-2">
              基于 Tauri 2 与 Rust 构建的原生跨平台桌面应用。一站式可视化托管 Claude Code、Claude Desktop、Codex、Gemini CLI、OpenCode、OpenClaw 和 Hermes 的 API 路由、MCP 同步与 Token 用量追踪，告别繁琐的手动编辑配置文件。
            </p>
            <div className="hero-actions animate-fade-in-up delay-3">
              <ButtonLink href={downloadUrls.windows}>
                <Monitor size={20} />
                下载 Windows 版
              </ButtonLink>
              <ButtonLink href={downloadUrls.mac} tone="dark">
                <PackageCheck size={20} />
                下载 macOS 版
              </ButtonLink>
              <ButtonLink href={downloadUrls.linux} tone="light">
                <Terminal size={20} />
                下载 Linux 版
              </ButtonLink>
            </div>
            <div className="trust-row animate-fade-in-up delay-4">
              <span>50+ 供应商预设</span>
              <span>系统托盘快速切换</span>
              <span>SQLite 原子写入保护配置</span>
            </div>
          </div>
          <div className="preview-wrap animate-fade-in-up delay-4">
            <div className="preview-glow" />
            <ProductPreview />
          </div>
        </section>

        <section className="section section-white" id="download">
          <div className="container">
            <p className="eyebrow">Download</p>
            <div className="section-head">
              <div>
                <h2>选择适合你的安装方式</h2>
                <p>
                  根据您的操作系统环境选择对应的二进制安装包下载，或使用 Homebrew 命令行快捷安装。
                </p>
              </div>
              <ButtonLink href={repoUrl} tone="light">
                <Github size={16} />
                查看 GitHub
              </ButtonLink>
            </div>
            <div className="platform-grid">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <a
                    className="platform-card"
                    href={platform.downloadUrl}
                    key={platform.name}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="platform-title">
                      <span className={`icon-box ${platform.accent}`}>
                        <Icon size={20} />
                      </span>
                      <span>
                        <strong>{platform.name}</strong>
                        <small>{platform.package}</small>
                      </span>
                    </div>
                    <p>{platform.requirement}</p>
                    <span className="download-chip">
                      下载 {platform.name} 版
                      <ArrowRight size={16} />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <div className="container">
            <h2>把分散的配置，收进一个清晰的工作台</h2>
            <p className="section-subtitle">
              面向每天使用 AI 编程工具的人：少改配置文件，少记路径，多一点确定感。
            </p>
            <div className="feature-grid">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article className="feature-card" key={feature.title}>
                    <span className={`icon-box ${feature.accent}`}>
                      <Icon size={20} />
                    </span>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section section-white" id="install">
          <div className="container install-grid">
            <div>
              <h2>三步完成安装与首次配置</h2>
              <p className="section-subtitle">
                把“下载安装”和“快速开始”放在同一视野，降低新用户从下载到成功切换供应商的阻力。
              </p>
              <div className="steps">
                {steps.map((step) => (
                  <article className="step-row" key={step.number}>
                    <strong>{step.number}</strong>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="terminal-card">
              <h3>
                <Terminal size={20} />
                macOS 快速安装
              </h3>
              <pre>
                <code>{`$ brew install --cask juyou-switcher\n$ brew upgrade --cask juyou-switcher`}</code>
              </pre>
              <p>
                Windows / Linux 用户可在下载区选择 MSI、Portable ZIP、AppImage、deb 或 rpm。
              </p>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="container">
            <div className="cta">
              <div>
                <h2>准备好把 AI 编程工具配置交给一个工作台了吗？</h2>
                <p>立即下载聚游助手，开始统一管理供应商、MCP、Skills、用量与会话。</p>
              </div>
              <ButtonLink href={primaryDownloadUrl} tone="light">
                下载 Windows 版
              </ButtonLink>
            </div>
            <div className="faq-grid">
              {faqs.map((faq) => (
                <article className="faq-card" key={faq.question}>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-inner">
          <div>
            <a className="brand footer-brand" href="#top">
              <Logo />
              <span>聚游助手</span>
            </a>
            <p>Claude Code、Codex、Gemini CLI 等 AI 编程工具的全方位管理工具。</p>
          </div>
          <div className="footer-links">
            <a href="#download">下载</a>
            <a href={repoUrl} rel="noreferrer" target="_blank">
              文档
            </a>
            <a href={`${repoUrl}/blob/main/CHANGELOG.md`} rel="noreferrer" target="_blank">
              更新日志
            </a>
            <a href={repoUrl} rel="noreferrer" target="_blank">
              GitHub
            </a>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>唯一官方网站：github.com/yangp0419/juyou-switcher</span>
          <span>Windows · macOS · Linux</span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
