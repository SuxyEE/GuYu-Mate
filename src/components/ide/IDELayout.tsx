// IDE 主布局组件
import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { X, Settings, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { AIChatPanel } from "./AIChatPanel";
import { TerminalPanel } from "./TerminalPanel";
import { PreviewPanel } from "./PreviewPanel";
import { ProjectSettings } from "./ProjectSettings";
import type { FileNode, IdeProject } from "@/lib/api/ide";

interface OpenFile {
  path: string;
  content: string;
  name: string;
}

interface FileOperation {
  type: "create" | "modify" | "delete";
  path: string;
}

interface IDELayoutProps {
  project: IdeProject;
  fileTree: FileNode[];
  openFiles: OpenFile[];
  activeFileIndex: number;
  projectPath: string;
  onFileClick: (path: string) => void;
  onFileChange: (path: string, content: string) => void;
  onTabChange: (index: number) => void;
  onCloseFile: (index: number) => void;
  onSendMessage: (message: string) => Promise<void>;
  onFileOperations?: (ops: FileOperation[]) => void;
  onRefreshFileTree?: () => void;
  onProjectUpdate?: () => void;
  terminalOutput: string;
  previewUrl: string | null;
  onStartPreview: () => void;
  onPreviewRefresh: () => void;
  onClosePreview: () => void;
}

export function IDELayout({
  project,
  fileTree,
  openFiles,
  activeFileIndex,
  projectPath,
  onFileClick,
  onFileChange,
  onTabChange,
  onCloseFile,
  onSendMessage,
  onFileOperations,
  onRefreshFileTree,
  onProjectUpdate,
  terminalOutput,
  previewUrl,
  onStartPreview,
  onPreviewRefresh,
  onClosePreview,
}: IDELayoutProps) {
  const activeFile = openFiles[activeFileIndex];
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>("");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 flex-shrink-0">
        <span className="text-sm font-medium">{project.name}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onStartPreview}>
            <Eye className="h-4 w-4 mr-1" />
            预览
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={15}>
          <div className="h-full border-r">
            <FileTree nodes={fileTree} onFileClick={onFileClick} onRefresh={onRefreshFileTree} projectPath={projectPath} />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

        <Panel defaultSize={50} minSize={30}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={70} minSize={40}>
              <div className="h-full flex flex-col">
                {openFiles.length > 0 ? (
                  <>
                    <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
                      {openFiles.map((file, index) => (
                        <div
                          key={file.path}
                          className={`flex items-center gap-2 px-3 py-2 border-r cursor-pointer hover:bg-muted ${
                            index === activeFileIndex ? "bg-background" : ""
                          }`}
                          onClick={() => onTabChange(index)}
                        >
                          <span className="text-sm">{file.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseFile(index);
                            }}
                            className="hover:bg-muted-foreground/20 rounded p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex-1">
                      {activeFile && (
                        <CodeEditor
                          value={activeFile.content}
                          onChange={(content) =>
                            onFileChange(activeFile.path, content)
                          }
                          filePath={activeFile.path}
                          onSelectionChange={setSelectedCode}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    选择一个文件开始编辑
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />

            <Panel defaultSize={30} minSize={20}>
              <TerminalPanel output={terminalOutput} />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

        <Panel defaultSize={30} minSize={25}>
          <div className="h-full border-l">
            <AIChatPanel
              projectPath={projectPath}
              onSendMessage={onSendMessage}
              onFileOperations={onFileOperations}
              onAutoPreview={onStartPreview}
              context={{
                selectedFile: activeFile?.path,
                selectedCode: selectedCode || undefined,
                openFiles: openFiles.map(f => f.path)
              }}
            />
          </div>
        </Panel>
      </PanelGroup>
      </div>

      {showSettings && (
        <ProjectSettings
          project={project}
          onClose={() => setShowSettings(false)}
          onSave={() => onProjectUpdate?.()}
        />
      )}

      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) onClosePreview(); }}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] h-[90vh]" zIndex="top">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>预览</DialogTitle>
                <Button variant="ghost" size="sm" onClick={onClosePreview}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 h-full overflow-hidden">
              <PreviewPanel previewUrl={previewUrl} onRefresh={onPreviewRefresh} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
