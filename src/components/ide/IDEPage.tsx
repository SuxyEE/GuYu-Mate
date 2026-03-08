// IDE 页面容器组件
import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { IDELayout } from "./IDELayout";
import { ideApi, type FileNode, type IdeProject } from "@/lib/api/ide";
import { toast } from "sonner";

interface OpenFile {
  path: string;
  content: string;
  name: string;
}

interface FileOperation {
  type: "create" | "modify" | "delete";
  path: string;
}

export function IDEPage() {
  const [project, setProject] = useState<IdeProject | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
  const [terminalOutput, setTerminalOutput] = useState("");

  const refreshFileTree = async () => {
    if (!projectPath) return;
    try {
      const tree = await ideApi.readFileTree(projectPath);
      setFileTree(tree);
    } catch (error) {
      console.error("刷新文件树失败:", error);
    }
  };

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        const proj = await ideApi.openProject(selected);
        setProject(proj);
        setProjectPath(proj.path);

        const tree = await ideApi.readFileTree(proj.path);
        setFileTree(tree);

        toast.success(`项目已打开: ${proj.name}`);
      }
    } catch (error) {
      toast.error(`打开项目失败: ${error}`);
    }
  };

  const handleFileClick = async (path: string) => {
    const existingIndex = openFiles.findIndex((f) => f.path === path);
    if (existingIndex !== -1) {
      setActiveFileIndex(existingIndex);
      return;
    }

    try {
      const content = await ideApi.readFile(path);
      const name = path.split(/[/\\]/).pop() || path;
      setOpenFiles([...openFiles, { path, content, name }]);
      setActiveFileIndex(openFiles.length);
    } catch (error) {
      toast.error(`读取文件失败: ${error}`);
    }
  };

  const handleFileChange = async (path: string, content: string) => {
    try {
      await ideApi.writeFile(path, content);
      setOpenFiles(
        openFiles.map((f) => (f.path === path ? { ...f, content } : f))
      );
      setTerminalOutput((prev) => prev + `\n已保存: ${path}`);
    } catch (error) {
      toast.error(`保存文件失败: ${error}`);
    }
  };

  const handleCloseFile = (index: number) => {
    const newFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(newFiles);
    if (activeFileIndex === index) {
      setActiveFileIndex(Math.max(0, index - 1));
    } else if (activeFileIndex > index) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  const handleFileOperations = (ops: FileOperation[]) => {
    if (ops.length > 0) {
      refreshFileTree();
      setTerminalOutput((prev) => {
        const opText = ops
          .map((op) => `${op.type === "create" ? "创建" : op.type === "modify" ? "修改" : "删除"}: ${op.path}`)
          .join("\n");
        return prev + "\n" + opText;
      });
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!projectPath) return;

    try {
      // 收集编辑器上下文
      const context = activeFileIndex >= 0 && openFiles[activeFileIndex] ? {
        currentFile: {
          path: openFiles[activeFileIndex].path,
          content: openFiles[activeFileIndex].content,
          language: openFiles[activeFileIndex].path.split('.').pop() || 'text'
        },
        openFiles: openFiles.map(f => f.path),
        projectPath
      } : undefined;

      await ideApi.sendMessage(projectPath, message, context);
    } catch (error) {
      toast.error(`发送消息失败: ${error}`);
    }
  };

  if (!projectPath || !project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">欢迎使用 GuYu IDE</h2>
          <p className="text-muted-foreground">
            打开一个项目开始使用 AI 辅助开发
          </p>
          <Button onClick={handleOpenProject} size="lg">
            <FolderOpen className="mr-2 h-5 w-5" />
            打开项目
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <IDELayout
        project={project}
        fileTree={fileTree}
        openFiles={openFiles}
        activeFileIndex={activeFileIndex}
        projectPath={projectPath}
        onFileClick={handleFileClick}
        onFileChange={handleFileChange}
        onTabChange={setActiveFileIndex}
        onCloseFile={handleCloseFile}
        onSendMessage={handleSendMessage}
        onFileOperations={handleFileOperations}
        onRefreshFileTree={refreshFileTree}
        onProjectUpdate={async () => {
          const proj = await ideApi.openProject(projectPath);
          setProject(proj);
        }}
        terminalOutput={terminalOutput}
      />
    </div>
  );
}
