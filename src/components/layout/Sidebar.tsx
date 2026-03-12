import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Layers,
  Wrench,
  History,
  Download,
  Code,
  Users,
  Building2,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import guyuLogo from "@/assets/icons/guyulogo.png";
import sidebarBg from "@/assets/icons/xmulogo.png";
import { McpIcon } from "@/components/BrandIcons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// View types matching App.tsx
type View =
  | "providers"
  | "settings"
  | "prompts"
  | "skills"
  | "skillsDiscovery"
  | "mcp"
  | "agents"
  | "universal"
  | "sessions"
  | "workspace"
  | "openclawEnv"
  | "openclawTools"
  | "openclawAgents"
  | "setup"
  | "ide"
  | "users"
  | "organizations";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onSettingsClick: () => void;
}

export function Sidebar({
  currentView,
  onViewChange,
  onSettingsClick,
}: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("jg-mate-sidebar-collapsed");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("jg-mate-sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);
  const sidebarWidth = isCollapsed ? 64 : 200;

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        className="h-full flex flex-col border-r border-border relative overflow-hidden"
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        {/* 背景图层 */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${sidebarBg})`,
            backgroundSize: '100%',
            backgroundPosition: 'center calc(100% - 40px)',
            backgroundRepeat: 'no-repeat',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-4 h-6 w-6 rounded-full border bg-background shadow-sm hover:bg-muted"
          style={{ zIndex: 10 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* App Brand */}
        <div className="p-3 border-b border-border relative" style={{ zIndex: 2 }}>
          <SidebarItem
            icon={
              <img src={guyuLogo} alt="GuYu Mate" className="w-8 h-8 rounded-sm object-contain" />
            }
            label="谷雨助手"
            isActive={false}
            isCollapsed={isCollapsed}
            onClick={() => onViewChange("providers")}
          />
          {!isCollapsed && (
            <div className="mt-1.5 text-xs text-muted-foreground font-medium">
              厦门大学谷雨大模型创新实验室
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto p-3 relative" style={{ zIndex: 2 }}>
          <div className="space-y-1">
            {/* IDE */}
            <SidebarItem
              icon={<Code className="h-5 w-5" />}
              label="工作台"
              isActive={currentView === "ide"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("ide")}
            />

            {/* 一键安装 - Setup */}
            {/* <SidebarItem
              icon={<Download className="h-5 w-5" />}
              label={t("setup.title", { defaultValue: "一键安装" })}
              isActive={currentView === "setup"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("setup")}
              highlight
            /> */}

            {/* AI供应商 - Providers */}
            {/* <SidebarItem
              icon={<Layers className="h-5 w-5" />}
              label={t("common.providers", { defaultValue: "AI供应商" })}
              isActive={currentView === "providers"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("providers")}
            /> */}

            {/* Skills */}
            <SidebarItem
              icon={<Wrench className="h-5 w-5" />}
              label={t("skills.title", { defaultValue: "Skills" })}
              isActive={currentView === "skills" || currentView === "skillsDiscovery"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("skills")}
            />

            {/* 会话管理 - Sessions */}
            <SidebarItem
              icon={<History className="h-5 w-5" />}
              label={t("sessionManager.title", { defaultValue: "会话管理" })}
              isActive={currentView === "sessions"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("sessions")}
            />

            {/* Agent管理 */}
            <SidebarItem
              icon={<Bot className="h-5 w-5" />}
              label="Agent管理"
              isActive={currentView === "agents"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("agents")}
            />

            {/* MCP */}
            <SidebarItem
              icon={<McpIcon size={20} />}
              label={t("mcp.title", { defaultValue: "MCP" })}
              isActive={currentView === "mcp"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("mcp")}
            />

            <SidebarItem
              icon={<Users className="h-5 w-5" />}
              label={t("common.providers", { defaultValue: "用户管理" })}
              isActive={currentView === "users"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("users")}
            />

            <SidebarItem
              icon={<Building2 className="h-5 w-5" />}
              label={t("common.providers", { defaultValue: "组织管理" })}
              isActive={currentView === "organizations"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("organizations")}
            />
          </div>
        </div>

        {/* Settings Section */}
        <div className="p-3 border-t border-border relative" style={{ zIndex: 2 }}>
          <SidebarItem
            icon={<Settings className="h-5 w-5" />}
            label={t("settings.title", { defaultValue: "设置" })}
            isActive={currentView === "settings"}
            isCollapsed={isCollapsed}
            onClick={onSettingsClick}
          />
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

// Sidebar Item Component
interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  highlight?: boolean;
}

function SidebarItem({
  icon,
  label,
  isActive,
  isCollapsed,
  onClick,
  highlight,
}: SidebarItemProps) {
  const content = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        highlight && !isActive && "text-orange-500 hover:text-orange-600",
        isCollapsed && "justify-center px-2",
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="whitespace-nowrap overflow-hidden"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
