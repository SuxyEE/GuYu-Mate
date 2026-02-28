import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  Terminal,
  Loader2,
  ExternalLink,
  Square,
  ArrowRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProviderIcon } from "@/components/ProviderIcon";
import { setupApi, EnvironmentStatus, SystemInfo } from "@/lib/api/setup";
import { settingsApi, providersApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { generateUUID } from "@/utils/uuid";
import guyuLogo from "@/assets/icons/guyu-logo.jpg";

// Types for tool versions (reusing existing API)
interface ToolVersion {
  name: string;
  version: string | null;
  latest_version: string | null;
  error: string | null;
  env_type: string;
  wsl_distro: string | null;
}

type CliId = "claude";

interface CliStatus {
  id: CliId;
  name: string;
  icon: string;
  version: ToolVersion | null;
  packageName: string;
  installCmd: string;
  docsUrl: string;
}

const CLI_CONFIG: Record<CliId, Omit<CliStatus, "version">> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    icon: "claude",
    packageName: "@anthropic-ai/claude-code",
    installCmd: "npm install -g @anthropic-ai/claude-code",
    docsUrl: "https://docs.anthropic.com/en/docs/claude-code",
  },
};

type StepStatus = "completed" | "current" | "pending";

export function SetupPage() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [nodeEnv, setNodeEnv] = useState<EnvironmentStatus | null>(null);
  const [cliVersions, setCliVersions] = useState<
    Record<CliId, ToolVersion | null>
  >({
    claude: null,
  });
  const [installingCli, setInstallingCli] = useState<CliId | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState("");
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);
  const [existingProviderId, setExistingProviderId] = useState<string | null>(null);
  const [installingNode, setInstallingNode] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // Fetch environment status
  const fetchEnvironment = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch Node.js environment
      const env = await setupApi.detectNodeEnvironment();
      setNodeEnv(env);

      // Fetch system info
      try {
        const sysInfo = await setupApi.getSystemInfo();
        setSystemInfo(sysInfo);
      } catch {
        // ignore system info errors
      }

      // Fetch CLI versions using existing API
      const { invoke } = await import("@tauri-apps/api/core");
      const versions = await invoke<ToolVersion[]>("get_tool_versions", {
        tools: ["claude"],
      });

      const versionMap: Record<CliId, ToolVersion | null> = {
        claude: null,
      };
      for (const v of versions) {
        if (v.name in versionMap) {
          versionMap[v.name as CliId] = v;
        }
      }
      setCliVersions(versionMap);

      // Check if 谷雨大模型 provider already exists
      try {
        const providers = await providersApi.getAll("claude");
        const guyu = Object.values(providers).find((p) => {
          const env = p.settingsConfig?.env as Record<string, string> | undefined;
          return env?.ANTHROPIC_BASE_URL?.includes("code.o2oe.net");
        });
        if (guyu) {
          setExistingProviderId(guyu.id);
          setProviderSaved(true);
        }
      } catch {
        // ignore provider check errors
      }
    } catch (error) {
      console.error("Failed to fetch environment:", error);
      toast.error(t("setup.fetchError", { defaultValue: "获取环境信息失败" }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchEnvironment();
  }, [fetchEnvironment]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Install CLI
  const handleInstall = useCallback(
    async (cliId: CliId) => {
      if (!nodeEnv?.node.is_installed || !nodeEnv?.npm.is_installed) {
        toast.error(
          t("setup.nodeRequired", {
            defaultValue: "请先安装 Node.js 和 npm",
          }),
        );
        return;
      }

      const cli = CLI_CONFIG[cliId];
      setInstallingCli(cliId);
      setShowTerminal(true);
      setTerminalOutput([`$ ${cli.installCmd}`, ""]);

      const taskId = `install-${cliId}-${Date.now()}`;
      setCurrentTaskId(taskId);

      try {
        // Listen for command output
        const unlisten = await setupApi.onCommandOutput((event) => {
          if (event.task_id !== taskId) return;

          if (event.output_type === "exit") {
            setInstallingCli(null);
            setCurrentTaskId(null);
            if (event.exit_code === 0) {
              toast.success(
                t("setup.installSuccess", {
                  name: cli.name,
                  defaultValue: `${cli.name} 安装成功`,
                }),
              );
              // Refresh versions
              fetchEnvironment();
            } else {
              toast.error(
                t("setup.installFailed", {
                  name: cli.name,
                  defaultValue: `${cli.name} 安装失败`,
                }),
              );
            }
            unlisten();
          } else {
            setTerminalOutput((prev) => [...prev, event.content]);
          }
        });

        // Start command
        await setupApi.executeCommandStream(taskId, cli.installCmd);
      } catch (error) {
        console.error("Install failed:", error);
        setInstallingCli(null);
        setCurrentTaskId(null);
        toast.error(
          t("setup.installError", {
            defaultValue: "安装命令执行失败",
          }),
        );
      }
    },
    [nodeEnv, t, fetchEnvironment],
  );

  // Cancel installation
  const handleCancel = useCallback(async () => {
    if (currentTaskId) {
      await setupApi.cancelCommand(currentTaskId);
      setInstallingCli(null);
      setCurrentTaskId(null);
      setTerminalOutput((prev) => [...prev, "", "--- 安装已取消 ---"]);
      toast.info(t("setup.installCancelled", { defaultValue: "安装已取消" }));
    }
  }, [currentTaskId, t]);

  // Open external link
  const handleOpenDocs = useCallback(async (url: string) => {
    try {
      await settingsApi.openExternal(url);
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  }, []);

  // One-click install Node.js
  const handleInstallNode = useCallback(async () => {
    setInstallingNode(true);
    setShowTerminal(true);
    setTerminalOutput(["$ 一键安装 Node.js LTS...", ""]);
    const taskId = `install-node-${Date.now()}`;
    setCurrentTaskId(taskId);
    try {
      const unlisten = await setupApi.onCommandOutput((event) => {
        if (event.task_id !== taskId) return;
        if (event.output_type === "exit") {
          setInstallingNode(false);
          setCurrentTaskId(null);
          if (event.exit_code === 0) {
            toast.success("Node.js 安装成功");
            fetchEnvironment();
          } else {
            toast.error(event.content || "Node.js 安装失败");
          }
          unlisten();
        } else {
          setTerminalOutput((prev) => [...prev, event.content]);
        }
      });
      await setupApi.installNodeAuto(taskId);
    } catch (error) {
      console.error("Install Node.js failed:", error);
      setInstallingNode(false);
      setCurrentTaskId(null);
      toast.error("安装命令执行失败");
    }
  }, [fetchEnvironment]);

  // Save 谷雨大模型 provider with API key
  const handleSaveProvider = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("请输入 API Key");
      return;
    }
    setIsSavingProvider(true);
    try {
      const provider = {
        id: generateUUID(),
        name: "谷雨大模型应用",
        websiteUrl: "https://code.o2oe.net/",
        settingsConfig: {
          env: {
            ANTHROPIC_BASE_URL: "https://code.o2oe.net/",
            ANTHROPIC_AUTH_TOKEN: key,
            ANTHROPIC_MODEL: "claude-opus-4-6",
            ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5-20251001",
            ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-5-20250929",
            ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-4-6",
          },
        },
        category: "third_party" as const,
        isPartner: true,
        meta: {
          custom_endpoints: {
            "https://code.o2oe.net/": {
              url: "https://code.o2oe.net/",
              addedAt: Date.now(),
              lastUsed: undefined,
            },
          },
        },
      };
      await providersApi.add(provider, "claude");
      await providersApi.switch(provider.id, "claude");
      setProviderSaved(true);
      setExistingProviderId(provider.id);
      toast.success("AI 供应商配置成功！已自动启用谷雨大模型");
      toast.success("AI 供应商配置成功！已自动启用谷雨大模型");
    } catch (error) {
      console.error("Failed to save provider:", error);
      toast.error("配置保存失败，请重试");
    } finally {
      setIsSavingProvider(false);
    }
  }, [apiKey]);

  // Open terminal with provider config
  const handleOpenTerminal = useCallback(async () => {
    if (!existingProviderId) return;
    try {
      await providersApi.openTerminal(existingProviderId, "claude");
      toast.success("终端已打开");
    } catch (error) {
      console.error("Failed to open terminal:", error);
      toast.error("打开终端失败");
    }
  }, [existingProviderId]);

  // Helper: count installed CLIs
  const getInstalledCliCount = useCallback((): number => {
    return (Object.keys(CLI_CONFIG) as CliId[]).filter(
      (id) => !!cliVersions[id]?.version,
    ).length;
  }, [cliVersions]);

  // Helper: determine current step
  const getCurrentStep = useCallback((): number => {
    const nodeReady = nodeEnv?.node.is_installed && nodeEnv?.npm.is_installed;
    if (!nodeReady) return 1;
    if (getInstalledCliCount() === 0) return 2;
    return 3;
  }, [nodeEnv, getInstalledCliCount]);

  // Helper: get step status
  const getStepStatus = useCallback(
    (stepNumber: number): StepStatus => {
      const current = getCurrentStep();
      if (stepNumber < current) return "completed";
      if (stepNumber === current) return "current";
      return "pending";
    },
    [getCurrentStep],
  );

  // Helper: render step indicator circle
  const renderStepIndicator = (stepNumber: number, status: StepStatus) => {
    if (status === "completed") {
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500 text-white shadow-md">
          <Check className="h-5 w-5" />
        </div>
      );
    }
    if (status === "current") {
      return (
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <span className="text-sm font-bold">{stepNumber}</span>
          <span className="absolute inset-0 rounded-full ring-4 ring-primary/20 animate-pulse" />
        </div>
      );
    }
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground border-2 border-muted-foreground/20">
        <span className="text-sm font-medium">{stepNumber}</span>
      </div>
    );
  };


  const nodeReady =
    !isLoading && nodeEnv?.node.is_installed && nodeEnv?.npm.is_installed;
  const step1Status = getStepStatus(1);
  const step2Status = getStepStatus(2);
  const step3Status = getStepStatus(3);

  return (
    <div className="flex flex-col h-full overflow-hidden px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">欢迎使用 GuYu Mate</h1>
          <p className="text-muted-foreground text-sm mt-1">
            只需 3 步，即可开始使用 AI 编程助手
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEnvironment}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
          />
          {t("common.refresh", { defaultValue: "刷新" })}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* ===== Step 1: Node.js Environment ===== */}
          <motion.section
            className={cn(
              "rounded-xl border-2 p-6 transition-colors",
              step1Status === "completed" &&
                "border-green-500/40 bg-green-500/5",
              step1Status === "current" && "border-primary/40 bg-primary/5",
              step1Status === "pending" && "border-muted opacity-60",
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start gap-4">
              {renderStepIndicator(1, step1Status)}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-3">
                  安装 Node.js 环境
                </h2>

                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Node.js status */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      {nodeEnv?.node.is_installed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">Node.js</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {nodeEnv?.node.version ?? "未安装"}
                        </span>
                      </div>
                    </div>

                    {/* npm status */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      {nodeEnv?.npm.is_installed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">npm</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {nodeEnv?.npm.version ?? "未安装"}
                        </span>
                      </div>
                    </div>

                    {/* Action area */}
                    {nodeReady ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">
                          Node.js 环境已就绪！
                        </span>
                      </div>
                    ) : (
                      <div className="pt-1 space-y-2">
                        {systemInfo && (
                          <p className="text-xs text-muted-foreground">
                            检测到系统: {systemInfo.os_display} ({systemInfo.arch_display})
                          </p>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleInstallNode}
                          disabled={installingNode || installingCli !== null}
                        >
                          {installingNode ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              正在安装...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              一键安装 Node.js
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          {/* ===== Step 2: Install AI CLI Tools ===== */}
          <motion.section
            className={cn(
              "rounded-xl border-2 p-6 transition-colors",
              step2Status === "completed" &&
                "border-green-500/40 bg-green-500/5",
              step2Status === "current" && "border-primary/40 bg-primary/5",
              step2Status === "pending" && "border-muted opacity-60",
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="flex items-start gap-4">
              {renderStepIndicator(2, step2Status)}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-3">安装 Claude Code 工具</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(CLI_CONFIG) as CliId[]).map((cliId) => {
                    const cli = CLI_CONFIG[cliId];
                    const version = cliVersions[cliId];
                    const isInstalled = !!version?.version;
                    const isInstalling = installingCli === cliId;

                    return (
                      <motion.div
                        key={cliId}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors",
                          step2Status === "pending" && "pointer-events-none",
                        )}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ProviderIcon
                          icon={cli.icon}
                          name={cli.name}
                          size={28}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{cli.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {isInstalled
                              ? `v${version?.version}`
                              : cli.packageName}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isInstalled ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              onClick={() => handleInstall(cliId)}
                              disabled={
                                isInstalling ||
                                installingCli !== null ||
                                !nodeReady
                              }
                            >
                              {isInstalling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Download className="h-3.5 w-3.5 mr-1" />
                                  安装
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.section>

          {/* ===== Step 3: Start Using ===== */}
          <motion.section
            className={cn(
              "rounded-xl border-2 p-6 transition-colors",
              step3Status === "completed" &&
                "border-green-500/40 bg-green-500/5",
              step3Status === "current" && "border-primary/40 bg-primary/5",
              step3Status === "pending" && "border-muted opacity-60",
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="flex items-start gap-4">
              {renderStepIndicator(3, step3Status)}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-3">配置 AI 供应商</h2>

                {step3Status === "current" || step3Status === "completed" ? (
                  <div className="space-y-4">
                    {providerSaved ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-5 w-5 shrink-0" />
                          <span className="text-sm font-medium">
                            AI 供应商已配置完成，可以开始使用了！
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleOpenTerminal}
                            disabled={!existingProviderId}
                          >
                            <Terminal className="h-4 w-4 mr-2" />
                            打开终端对话
                          </Button>
                        </div>
                        <div className="space-y-2 pl-1">
                          {[
                            "点击上方按钮即可打开终端开始 AI 对话",
                            "在左侧 AI供应商 页面可以管理和切换配置",
                          ].map((tip, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 注册引导 */}
                        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                          <div className="flex items-center gap-2">
                            <img src={guyuLogo} alt="谷雨大模型" className="w-6 h-6 rounded-sm object-cover" />
                            <p className="text-sm font-medium">第一步：注册谷雨大模型账号</p>
                          </div>
                          <p className="text-sm font-medium">第一步：注册谷雨大模型账号</p>
                          <p className="text-xs text-muted-foreground">
                            前往谷雨大模型应用平台注册账号，并在控制台生成 API Key
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDocs("https://code.o2oe.net/")}
                          >
                            前往注册
                            <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />
                          </Button>
                        </div>

                        {/* API Key 输入 */}
                        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                          <p className="text-sm font-medium">第二步：输入 API Key</p>
                          <p className="text-xs text-muted-foreground">
                            将谷雨大模型控制台生成的 API Key 粘贴到下方
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="password"
                              placeholder="请输入谷雨大模型 API Key"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              className="flex-1 h-9 text-sm"
                            />
                            <Button
                              size="sm"
                              className="h-9 px-4"
                              onClick={handleSaveProvider}
                              disabled={isSavingProvider || !apiKey.trim()}
                            >
                              {isSavingProvider ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "一键配置"
                              )}
                            </Button>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          默认模型：主模型 claude-opus-4-6 / sonnet claude-sonnet-4-5 / haiku claude-haiku-4-5
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    完成前两步后即可配置 AI 供应商
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          {/* ===== Terminal Output ===== */}
          <AnimatePresence>
            {showTerminal && (
              <motion.section
                className="rounded-xl border border-border overflow-hidden"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <span className="font-medium text-sm">终端输出</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentTaskId && (
                      <Button variant="ghost" size="sm" onClick={handleCancel}>
                        <Square className="h-3 w-3 mr-1" />
                        取消
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTerminal(false)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div
                  ref={terminalRef}
                  className="bg-zinc-900 text-zinc-100 p-4 font-mono text-sm max-h-64 overflow-y-auto"
                >
                  {terminalOutput.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        "whitespace-pre-wrap",
                        line.startsWith("$") && "text-green-400",
                        line.includes("error") && "text-red-400",
                        line.includes("warning") && "text-yellow-400",
                      )}
                    >
                      {line || "\u00A0"}
                    </div>
                  ))}
                  {currentTaskId && (
                    <div className="flex items-center gap-2 text-muted-foreground mt-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>执行中...</span>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
