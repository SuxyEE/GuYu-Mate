// 项目设置对话框
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { ideApi, type IdeProject } from "@/lib/api/ide";
import { toast } from "sonner";

interface ProjectSettingsProps {
  project: IdeProject;
  onClose: () => void;
  onSave: () => void;
}

export function ProjectSettings({ project, onClose, onSave }: ProjectSettingsProps) {
  const [description, setDescription] = useState(project.description || "");

  const handleSave = async () => {
    try {
      const settings = JSON.stringify({ description });
      await ideApi.updateProjectSettings(project.id, settings);
      toast.success("项目设置已保存");
      onSave();
      onClose();
    } catch (error) {
      toast.error(`保存失败: ${error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-[500px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">项目设置</h2>
          <button onClick={onClose} className="hover:bg-muted rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-auto">
          <div>
            <label className="text-sm font-medium mb-2 block">项目名称</label>
            <input
              type="text"
              value={project.name}
              disabled
              className="w-full px-3 py-2 border rounded-md bg-muted"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">项目路径</label>
            <input
              type="text"
              value={project.path}
              disabled
              className="w-full px-3 py-2 border rounded-md bg-muted text-xs"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">项目描述</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入项目描述..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
