// 文件树组件
import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FilePlus, FolderPlus, Trash2, Edit } from "lucide-react";
import type { FileNode } from "@/lib/api/ide";
import { ideApi } from "@/lib/api/ide";
import { toast } from "sonner";

interface FileTreeProps {
  nodes: FileNode[];
  onFileClick: (path: string) => void;
  onRefresh?: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
}

export function FileTree({ nodes, onFileClick, onRefresh }: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

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

  const handleCreateFile = async () => {
    if (!contextMenu.node) return;
    const fileName = prompt("输入文件名:");
    if (!fileName) return;

    const basePath = contextMenu.node.is_dir ? contextMenu.node.path : contextMenu.node.path.split(/[/\\]/).slice(0, -1).join("/");
    const newPath = `${basePath}/${fileName}`;

    try {
      await ideApi.createFile(newPath);
      toast.success("文件创建成功");
      onRefresh?.();
    } catch (error) {
      toast.error(`创建文件失败: ${error}`);
    }
    closeContextMenu();
  };

  const handleCreateFolder = async () => {
    if (!contextMenu.node) return;
    const folderName = prompt("输入文件夹名:");
    if (!folderName) return;

    const basePath = contextMenu.node.is_dir ? contextMenu.node.path : contextMenu.node.path.split(/[/\\]/).slice(0, -1).join("/");
    const newPath = `${basePath}/${folderName}`;

    try {
      await ideApi.createDirectory(newPath);
      toast.success("文件夹创建成功");
      onRefresh?.();
    } catch (error) {
      toast.error(`创建文件夹失败: ${error}`);
    }
    closeContextMenu();
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

  const handleRename = async () => {
    if (!contextMenu.node) return;
    const newName = prompt("输入新名称:", contextMenu.node.name);
    if (!newName || newName === contextMenu.node.name) return;

    const pathParts = contextMenu.node.path.split(/[/\\]/);
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join("/");

    try {
      await ideApi.renamePath(contextMenu.node.path, newPath);
      toast.success("重命名成功");
      onRefresh?.();
    } catch (error) {
      toast.error(`重命名失败: ${error}`);
    }
    closeContextMenu();
  };

  return (
    <>
      <div className="text-sm" onClick={closeContextMenu}>
        {nodes.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            onFileClick={onFileClick}
            onContextMenu={handleContextMenu}
          />
        ))}
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
  depth?: number;
}

function TreeNode({ node, onFileClick, onContextMenu, depth = 0 }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (node.is_dir) {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(node.path);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-muted cursor-pointer"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
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
        <span className="truncate">{node.name}</span>
      </div>
      {node.is_dir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
