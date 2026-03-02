import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useInstallSkill } from "@/hooks/useSkills";
import type { DiscoverableSkill } from "@/lib/api/skills";

/**
 * 推荐的开发者 Skills — 硬编码列表，不依赖网络
 * 安装时直接构造 DiscoverableSkill 对象传给后端
 */
interface RecommendedItem {
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  directory: string;
  labelKey: string;
  descKey: string;
}

const RECOMMENDED_SKILLS: RecommendedItem[] = [
  {
    repoOwner: "anthropics",
    repoName: "skills",
    repoBranch: "main",
    directory: "software-engineer",
    labelKey: "skills.recommend.softwareEngineer",
    descKey: "skills.recommend.softwareEngineerDesc",
  },
  {
    repoOwner: "anthropics",
    repoName: "skills",
    repoBranch: "main",
    directory: "test-driven-development",
    labelKey: "skills.recommend.tdd",
    descKey: "skills.recommend.tddDesc",
  },
  {
    repoOwner: "anthropics",
    repoName: "skills",
    repoBranch: "main",
    directory: "code-review",
    labelKey: "skills.recommend.codeReview",
    descKey: "skills.recommend.codeReviewDesc",
  },
  {
    repoOwner: "obra",
    repoName: "superpowers",
    repoBranch: "main",
    directory: "architecture-design",
    labelKey: "skills.recommend.architectureDesign",
    descKey: "skills.recommend.architectureDesignDesc",
  },
  {
    repoOwner: "obra",
    repoName: "superpowers",
    repoBranch: "main",
    directory: "debug-systematically",
    labelKey: "skills.recommend.debugSystematically",
    descKey: "skills.recommend.debugSystematicallyDesc",
  },
  {
    repoOwner: "obra",
    repoName: "superpowers",
    repoBranch: "main",
    directory: "git-commit-best-practices",
    labelKey: "skills.recommend.gitCommit",
    descKey: "skills.recommend.gitCommitDesc",
  },
];

/** 从推荐项构造后端所需的 DiscoverableSkill */
function toDiscoverableSkill(item: RecommendedItem, name: string, description: string): DiscoverableSkill {
  return {
    key: `${item.repoOwner}/${item.repoName}:${item.directory}`,
    name,
    description,
    directory: item.directory,
    repoOwner: item.repoOwner,
    repoName: item.repoName,
    repoBranch: item.repoBranch,
  };
}

interface RecommendedSkillsDialogProps {
  onOpenDiscovery: () => void;
}

export const RecommendedSkillsDialog: React.FC<RecommendedSkillsDialogProps> = ({
  onOpenDiscovery,
}) => {
  const { t } = useTranslation();
  const installMutation = useInstallSkill();

  // 用 directory 作为唯一标识
  const [selected, setSelected] = useState<Set<string>>(() => new Set(RECOMMENDED_SKILLS.map((s) => s.directory)));
  const [installing, setInstalling] = useState(false);
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, "success" | "error">>(new Map());

  const toggleSelect = useCallback((dir: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allDone = RECOMMENDED_SKILLS.every((s) => results.get(s.directory) === "success");
    if (allDone) return;
    setSelected(new Set(
      RECOMMENDED_SKILLS
        .filter((s) => results.get(s.directory) !== "success")
        .map((s) => s.directory),
    ));
  }, [results]);

  const handleBatchInstall = useCallback(async () => {
    if (selected.size === 0) return;
    setInstalling(true);
    const newResults = new Map(results);

    for (const dir of selected) {
      const item = RECOMMENDED_SKILLS.find((s) => s.directory === dir);
      if (!item) continue;
      if (newResults.get(dir) === "success") continue;

      setCurrentItem(dir);
      const name = t(item.labelKey);
      const desc = t(item.descKey);
      const skill = toDiscoverableSkill(item, name, desc);

      try {
        await installMutation.mutateAsync({ skill, currentApp: "claude" });
        newResults.set(dir, "success");
      } catch (error) {
        console.error("Install skill failed:", dir, error);
        newResults.set(dir, "error");
      }
      setResults(new Map(newResults));
    }

    setCurrentItem(null);
    setInstalling(false);

    const successCount = [...newResults.values()].filter((v) => v === "success").length;
    const failCount = [...newResults.values()].filter((v) => v === "error").length;

    if (successCount > 0) {
      toast.success(
        t("skills.recommend.installSuccess", { count: successCount }),
        { closeButton: true },
      );
    }
    if (failCount > 0) {
      toast.error(
        t("skills.recommend.installPartialFailed", { count: failCount }),
        { closeButton: true },
      );
    }
  }, [selected, results, installMutation, t]);

  const allInstalled = RECOMMENDED_SKILLS.every((s) => results.get(s.directory) === "success");

  return (
    <div className="text-center py-3">
      <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
        <Sparkles size={20} className="text-blue-500" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-0.5">
        {t("skills.recommend.title")}
      </h3>
      <p className="text-muted-foreground text-xs mb-3 max-w-md mx-auto">
        {t("skills.recommend.description")}
      </p>

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            disabled={installing}
          >
            {t("skills.recommend.selectAll")}
          </button>
          <span className="text-xs text-muted-foreground">
            {t("skills.recommend.selectedCount", { count: selected.size })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {RECOMMENDED_SKILLS.map((item) => {
            const isSelected = selected.has(item.directory);
            const result = results.get(item.directory);
            const isCurrent = currentItem === item.directory;

            return (
              <label
                key={item.directory}
                className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                  result === "success"
                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                    : result === "error"
                      ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                      : isSelected
                        ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                        : "hover:bg-muted/50 border-border"
                } ${installing ? "pointer-events-none opacity-80" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected || result === "success"}
                  onChange={() => toggleSelect(item.directory)}
                  disabled={installing || result === "success"}
                  className="mt-0.5 accent-blue-500 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm leading-tight">{t(item.labelKey)}</span>
                    {isCurrent && (
                      <Loader2 size={12} className="text-blue-500 animate-spin flex-shrink-0" />
                    )}
                    {result === "success" && (
                      <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                    )}
                    {result === "error" && !isCurrent && (
                      <XCircle size={12} className="text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                    {t(item.descKey)}
                  </p>
                  <span className="text-[10px] text-muted-foreground/40">
                    {item.repoOwner}/{item.repoName}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-3">
          {!allInstalled && (
            <Button
              onClick={handleBatchInstall}
              disabled={selected.size === 0 || installing}
              className="gap-2"
            >
              {installing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {installing
                ? t("skills.recommend.installing")
                : t("skills.recommend.installSelected", { count: selected.size })}
            </Button>
          )}
          <Button variant="outline" onClick={onOpenDiscovery}>
            {t("skills.recommend.browseMore")}
          </Button>
        </div>
      </div>
    </div>
  );
};
