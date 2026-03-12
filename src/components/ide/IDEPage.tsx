// IDE 页面容器组件
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { listen } from "@tauri-apps/api/event";
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
  lastModified?: number;
}

interface FileOperation {
  type: "create" | "modify" | "delete";
  path: string;
}

interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export const IDEPage = forwardRef<{ closeProject: () => void }>(function IDEPage(_, ref) {
  const [project, setProject] = useState<IdeProject | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
  const [terminalOutput, setTerminalOutput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useImperativeHandle(ref, () => ({
    closeProject: () => {
      setProject(null);
      setProjectPath(null);
      setOpenFiles([]);
      setActiveFileIndex(-1);
    }
  }));

  const refreshFileTree = async () => {
    if (!projectPath) return;
    try {
      const tree = await ideApi.readFileTree(projectPath);
      setFileTree(tree);
    } catch (error) {
      console.error("刷新文件树失败:", error);
    }
  };

  // 加载最近项目
  useEffect(() => {
    const saved = localStorage.getItem("ide-recent-projects");
    if (saved) {
      try {
        setRecentProjects(JSON.parse(saved));
      } catch (error) {
        console.error("加载最近项目失败:", error);
      }
    }
  }, []);

  // 保存项目到最近记录
  const saveToRecent = (path: string, name: string) => {
    const newRecent: RecentProject = { path, name, lastOpened: Date.now() };
    const updated = [newRecent, ...recentProjects.filter(p => p.path !== path)].slice(0, 5);
    setRecentProjects(updated);
    localStorage.setItem("ide-recent-projects", JSON.stringify(updated));
  };

  // 恢复上次打开的标签页
  useEffect(() => {
    if (!projectPath) return;

    const key = `ide-tabs-${projectPath}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;

    try {
      const { filePaths, activeIndex } = JSON.parse(saved);

      Promise.all(
        filePaths.map(async (path: string) => {
          try {
            const content = await ideApi.readFile(path);
            const name = path.split(/[/\\]/).pop() || path;
            return { path, content, name };
          } catch {
            return null;
          }
        })
      ).then((files) => {
        const validFiles = files.filter((f): f is OpenFile => f !== null);
        if (validFiles.length > 0) {
          setOpenFiles(validFiles);
          setActiveFileIndex(Math.min(activeIndex, validFiles.length - 1));
        }
      });
    } catch (error) {
      console.error("恢复标签页失败:", error);
    }
  }, [projectPath]);

  // 保存打开的标签页状态
  useEffect(() => {
    if (!projectPath || openFiles.length === 0) return;

    const key = `ide-tabs-${projectPath}`;
    const state = {
      filePaths: openFiles.map(f => f.path),
      activeIndex: activeFileIndex
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, [projectPath, openFiles, activeFileIndex]);

  // 监听文件变化
  useEffect(() => {
    if (!projectPath) return;

    const unlisten = listen<string[]>("file-changed", async (event) => {
      const changedPaths = event.payload;

      // 刷新文件树
      await refreshFileTree();

      // 刷新已打开的文件
      for (const changedPath of changedPaths) {
        const openFileIndex = openFiles.findIndex(f => f.path === changedPath);
        if (openFileIndex !== -1) {
          try {
            const content = await ideApi.readFile(changedPath);
            setOpenFiles(prev => prev.map((f, i) =>
              i === openFileIndex ? { ...f, content } : f
            ));
          } catch (error) {
            console.error("刷新文件内容失败:", error);
          }
        }
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [projectPath, openFiles]);

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        // 关闭旧项目的预览
        if (projectPath && previewUrl) {
          await ideApi.stopPreviewServer(projectPath);
        }
        setPreviewUrl(null);

        const proj = await ideApi.openProject(selected);
        setProject(proj);
        setProjectPath(proj.path);
        saveToRecent(proj.path, proj.name);

        const tree = await ideApi.readFileTree(proj.path);
        setFileTree(tree);

        toast.success(`项目已打开: ${proj.name}`);
      }
    } catch (error) {
      toast.error(`打开项目失败: ${error}`);
    }
  };

  const handleOpenRecentProject = async (path: string) => {
    try {
      // 关闭旧项目的预览
      if (projectPath && previewUrl) {
        await ideApi.stopPreviewServer(projectPath);
      }
      setPreviewUrl(null);

      const proj = await ideApi.openProject(path);
      setProject(proj);
      setProjectPath(proj.path);
      saveToRecent(proj.path, proj.name);

      const tree = await ideApi.readFileTree(proj.path);
      setFileTree(tree);

      toast.success(`项目已打开: ${proj.name}`);
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

  const handleFileDelete = (deletedPath: string) => {
    // 关闭被删除文件的标签页
    const deletedIndices = openFiles
      .map((file, index) => (file.path === deletedPath ? index : -1))
      .filter(index => index !== -1);

    if (deletedIndices.length > 0) {
      const newFiles = openFiles.filter(file => file.path !== deletedPath);
      setOpenFiles(newFiles);

      // 调整活动标签索引
      if (deletedIndices.includes(activeFileIndex)) {
        // 如果删除的是当前活动标签，切换到前一个或后一个
        setActiveFileIndex(Math.max(0, Math.min(activeFileIndex, newFiles.length - 1)));
      } else if (activeFileIndex > deletedIndices[0]) {
        // 如果删除的标签在当前活动标签之前，索引需要减1
        setActiveFileIndex(activeFileIndex - 1);
      }
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

  const handleSendMessage = async (message: string, chatContext?: {
    selectedFile?: string;
    selectedCode?: string;
    openFiles?: string[];
  }, resumeSessionId?: string, skillIds?: string[]) => {
    if (!projectPath) return;

    try {
      await ideApi.sendMessage(projectPath, message, chatContext, resumeSessionId, skillIds);
    } catch (error) {
      toast.error(`发送消息失败: ${error}`);
    }
  };

  const handleStartPreview = async () => {
    if (!projectPath) return;
    try {
      const url = await ideApi.startPreviewServer(projectPath);
      setPreviewUrl(url);
      toast.success("预览已启动");
    } catch (error) {
      toast.error(`启动预览失败: ${error}`);
    }
  };

  const handlePreviewRefresh = () => {
    // 刷新逻辑由 PreviewPanel 内部处理
  };

  const handleClosePreview = async () => {
    if (!projectPath) return;
    try {
      await ideApi.stopPreviewServer(projectPath);
      setPreviewUrl(null);
      toast.success("预览已停止");
    } catch (error) {
      console.error("停止预览失败:", error);
      setPreviewUrl(null);
    }
  };

  if (!projectPath || !project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-2xl">
          <h2 className="text-2xl font-semibold">欢迎使用谷雨助手</h2>
          <p className="text-muted-foreground">
            打开一个项目开始使用 AI 辅助开发
          </p>
          <Button onClick={handleOpenProject} size="lg">
            <FolderOpen className="mr-2 h-5 w-5" />
            打开项目
          </Button>

          {recentProjects.length > 0 && (
            <div className="mt-8 text-left">
              <h3 className="text-sm font-medium mb-3">最近打开</h3>
              <div className="space-y-2">
                {recentProjects.map((proj) => (
                  <button
                    key={proj.path}
                    onClick={() => handleOpenRecentProject(proj.path)}
                    className="w-full text-left px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">{proj.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{proj.path}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
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
        onFileDelete={handleFileDelete}
        onProjectUpdate={async () => {
          const proj = await ideApi.openProject(projectPath);
          setProject(proj);
        }}
        terminalOutput={terminalOutput}
        previewUrl={previewUrl}
        onStartPreview={handleStartPreview}
        onPreviewRefresh={handlePreviewRefresh}
        onClosePreview={handleClosePreview}
      />
    </div>
  );
});
