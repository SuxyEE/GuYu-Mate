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
} from "lucide-react";
import { cn } from "@/lib/utils";
import guyuLogo from "@/assets/icons/guyu-logo.jpg";
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
  | "setup"; // New: Setup/Installation view

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
        className="h-full flex flex-col border-r border-border bg-muted/30 relative"
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-sm hover:bg-muted"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* App Brand */}
        <div className="p-3 border-b border-border">
          <SidebarItem
            icon={
              <img src={guyuLogo} alt="GuYu Mate" className="w-5 h-5 rounded-sm object-cover" />
            }
            label="GuYu Mate"
            isActive={false}
            isCollapsed={isCollapsed}
            onClick={() => onViewChange("providers")}
          />
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {/* 一键安装 - Setup */}
            <SidebarItem
              icon={<Download className="h-5 w-5" />}
              label={t("setup.title", { defaultValue: "一键安装" })}
              isActive={currentView === "setup"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("setup")}
              highlight
            />

            {/* AI供应商 - Providers */}
            <SidebarItem
              icon={<Layers className="h-5 w-5" />}
              label={t("common.providers", { defaultValue: "AI供应商" })}
              isActive={currentView === "providers"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("providers")}
            />

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

            {/* MCP */}
            <SidebarItem
              icon={<McpIcon size={20} />}
              label={t("mcp.title", { defaultValue: "MCP" })}
              isActive={currentView === "mcp"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("mcp")}
            />
          </div>
        </div>

        {/* Settings Section */}
        <div className="p-3 border-t border-border">
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
