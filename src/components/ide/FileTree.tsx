// 文件树组件
import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, File, Folder, FilePlus, FolderPlus, Trash2, Edit, RefreshCw, ChevronsDownUp } from "lucide-react";
import type { FileNode } from "@/lib/api/ide";
import { ideApi } from "@/lib/api/ide";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick: (path: string) => void;
  onRefresh?: () => void;
  projectPath?: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
}

type EditMode = "rename" | "newFile" | "newFolder" | null;

interface EditState {
  mode: EditMode;
  parentPath: string;
  originalName?: string;
  isDir?: boolean;
}

export function FileTree({ nodes, onFileClick, onRefresh, projectPath }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [editState, setEditState] = useState<EditState | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // 折叠所有文件夹
  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
  };

  // 切换文件夹展开/折叠状态
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // 顶部快捷按钮：在选中文件夹或根目录创建文件
  const handleQuickCreateFile = () => {
    const targetPath = selectedFolder || projectPath || ".";
    setEditState({ mode: "newFile", parentPath: targetPath });
  };

  // 顶部快捷按钮：在选中文件夹或根目录创建文件夹
  const handleQuickCreateFolder = () => {
    const targetPath = selectedFolder || projectPath || ".";
    setEditState({ mode: "newFolder", parentPath: targetPath });
  };

  const handleCreateFile = () => {
    if (!contextMenu.node) return;
    const basePath = contextMenu.node.is_dir ? contextMenu.node.path : contextMenu.node.path.split(/[/\\]/).slice(0, -1).join("/");
    setEditState({ mode: "newFile", parentPath: basePath });
    closeContextMenu();
  };

  const handleCreateFolder = () => {
    if (!contextMenu.node) return;
    const basePath = contextMenu.node.is_dir ? contextMenu.node.path : contextMenu.node.path.split(/[/\\]/).slice(0, -1).join("/");
    setEditState({ mode: "newFolder", parentPath: basePath });
    closeContextMenu();
  };

  const handleRename = () => {
    if (!contextMenu.node) return;
    setEditState({
      mode: "rename",
      parentPath: contextMenu.node.path,
      originalName: contextMenu.node.name,
      isDir: contextMenu.node.is_dir
    });
    closeContextMenu();
  };

  const handleConfirmEdit = async (newName: string) => {
    if (!editState || !newName.trim()) {
      setEditState(null);
      return;
    }

    try {
      if (editState.mode === "rename") {
        const pathParts = editState.parentPath.split(/[/\\]/);
        pathParts[pathParts.length - 1] = newName;
        const newPath = pathParts.join("/");
        await ideApi.renamePath(editState.parentPath, newPath);
        toast.success("重命名成功");
      } else if (editState.mode === "newFile") {
        // 处理根目录和子目录
        const newPath = editState.parentPath === projectPath
          ? `${projectPath}/${newName}`
          : `${editState.parentPath}/${newName}`;
        await ideApi.createFile(newPath);
        toast.success("文件创建成功");
      } else if (editState.mode === "newFolder") {
        // 处理根目录和子目录
        const newPath = editState.parentPath === projectPath
          ? `${projectPath}/${newName}`
          : `${editState.parentPath}/${newName}`;
        await ideApi.createDirectory(newPath);
        toast.success("文件夹创建成功");
      }
      onRefresh?.();
    } catch (error) {
      toast.error(`操作失败: ${error}`);
    }
    setEditState(null);
  };

  const handleCancelEdit = () => {
    setEditState(null);
  };

  const handleDelete = async () => {
    if (!contextMenu.node) return;
    if (!confirm(`确定要删除 ${contextMenu.node.name} 吗？`)) return;

    try {
      await ideApi.deletePath(contextMenu.node.path);
      toast.success("删除成功");
      onRefresh?.();
    } catch (error) {
      toast.error(`删除失败: ${error}`);
    }
    closeContextMenu();
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-2 py-1 border-b bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">文件</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleQuickCreateFile}
              title="新建文件"
            >
              <FilePlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleQuickCreateFolder}
              title="新建文件夹"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              title="刷新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCollapseAll}
              title="折叠所有文件夹"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 文件树 */}
        <div className="flex-1 overflow-y-auto text-sm" onClick={closeContextMenu}>
          {/* 根目录新建项 */}
          {editState && (editState.mode === "newFile" || editState.mode === "newFolder") &&
           editState.parentPath === projectPath && (
            <div className="flex items-center gap-1 px-2 py-1 bg-muted/50">
              {editState.mode === "newFolder" ? (
                <Folder className="h-4 w-4 flex-shrink-0 text-blue-500" />
              ) : (
                <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <input
                type="text"
                autoFocus
                placeholder={editState.mode === "newFolder" ? "文件夹名称" : "文件名"}
                className="flex-1 px-1 py-0 text-sm bg-background border rounded outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirmEdit((e.target as HTMLInputElement).value);
                  } else if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
                onBlur={() => handleCancelEdit()}
              />
            </div>
          )}

          {nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              onFileClick={onFileClick}
              onContextMenu={handleContextMenu}
              editState={editState}
              onConfirmEdit={handleConfirmEdit}
              onCancelEdit={handleCancelEdit}
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
            />
          ))}
        </div>
      </div>

      {contextMenu.visible && (
        <div
          className="fixed bg-popover border rounded-md shadow-md py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={closeContextMenu}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
            onClick={handleCreateFile}
          >
            <FilePlus className="h-4 w-4" />
            新建文件
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
            onClick={handleCreateFolder}
          >
            <FolderPlus className="h-4 w-4" />
            新建文件夹
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
            onClick={handleRename}
          >
            <Edit className="h-4 w-4" />
            重命名
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>
        </div>
      )}
    </>
  );
}

interface TreeNodeProps {
  node: FileNode;
  onFileClick: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  editState: EditState | null;
  onConfirmEdit: (name: string) => void;
  onCancelEdit: () => void;
  selectedFolder: string | null;
  onSelectFolder: (path: string | null) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  depth?: number;
}

function TreeNode({ node, onFileClick, onContextMenu, editState, onConfirmEdit, onCancelEdit, selectedFolder, onSelectFolder, expandedFolders, onToggleFolder, depth = 0 }: TreeNodeProps) {
  const [inputValue, setInputValue] = useState("");

  const isExpanded = expandedFolders.has(node.path);

  // 当需要在此节点下创建新文件/文件夹时，自动展开
  useEffect(() => {
    if (editState &&
        (editState.mode === "newFile" || editState.mode === "newFolder") &&
        editState.parentPath === node.path &&
        node.is_dir &&
        !isExpanded) {
      onToggleFolder(node.path);
    }
  }, [editState, node.path, node.is_dir, isExpanded, onToggleFolder]);

  const isRenaming = editState?.mode === "rename" && editState.parentPath === node.path;
  const showNewItem = editState &&
    (editState.mode === "newFile" || editState.mode === "newFolder") &&
    editState.parentPath === node.path &&
    isExpanded;
  const isSelected = node.is_dir && selectedFolder === node.path;

  const handleClick = () => {
    if (node.is_dir) {
      onToggleFolder(node.path);
      onSelectFolder(node.path);
    } else {
      onFileClick(node.path);
      onSelectFolder(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onConfirmEdit(inputValue);
    } else if (e.key === "Escape") {
      onCancelEdit();
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 hover:bg-muted cursor-pointer ${isSelected ? "bg-muted" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={isRenaming ? undefined : handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.is_dir && (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        )}
        {node.is_dir ? (
          <Folder className="h-4 w-4 flex-shrink-0 text-blue-500" />
        ) : (
          <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
        {isRenaming ? (
          <input
            type="text"
            defaultValue={editState.originalName}
            autoFocus
            className="flex-1 px-1 py-0 text-sm bg-background border rounded outline-none"
            onKeyDown={handleKeyDown}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => onCancelEdit()}
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>
      {node.is_dir && isExpanded && (
        <div>
          {showNewItem && (
            <div
              className="flex items-center gap-1 px-2 py-1 bg-muted/50"
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
            >
              {editState.mode === "newFolder" ? (
                <Folder className="h-4 w-4 flex-shrink-0 text-blue-500" />
              ) : (
                <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <input
                type="text"
                autoFocus
                placeholder={editState.mode === "newFolder" ? "文件夹名称" : "文件名"}
                className="flex-1 px-1 py-0 text-sm bg-background border rounded outline-none"
                onKeyDown={handleKeyDown}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={() => onCancelEdit()}
              />
            </div>
          )}
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              editState={editState}
              onConfirmEdit={onConfirmEdit}
              onCancelEdit={onCancelEdit}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
