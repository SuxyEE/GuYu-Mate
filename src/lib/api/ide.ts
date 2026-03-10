// IDE API 封装
import { invoke } from "@tauri-apps/api/core";

export interface IdeProject {
  id: string;
  name: string;
  path: string;
  created_at: number;
  last_opened_at: number | null;
  description: string | null;
  settings: string | null;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface EditorContext {
  selectedFile?: string;
  selectedCode?: string;
  openFiles?: string[];
}

export interface IdeSession {
  session_id: string;
  project_path: string;
  created_at: number;
  message_count: number;
  title: string;
}

export const ideApi = {
  // 打开项目
  async openProject(path: string): Promise<IdeProject> {
    return invoke("open_ide_project", { path });
  },

  // 获取所有项目
  async getProjects(): Promise<IdeProject[]> {
    return invoke("get_ide_projects");
  },

  // 读取文件树
  async readFileTree(path: string): Promise<FileNode[]> {
    return invoke("read_file_tree", { path });
  },

  // 读取文件
  async readFile(path: string): Promise<string> {
    return invoke("read_ide_file", { path });
  },

  // 写入文件
  async writeFile(path: string, content: string): Promise<void> {
    return invoke("write_ide_file", { path, content });
  },

  // 发送消息到 Claude
  async sendMessage(
    projectPath: string,
    message: string,
    context?: EditorContext,
    resumeSessionId?: string
  ): Promise<void> {
    return invoke("send_claude_message", { projectPath, message, context, resumeSessionId });
  },

  // 清空会话
  async clearSession(projectPath: string): Promise<void> {
    return invoke("clear_ide_session", { projectPath });
  },

  // 获取会话列表
  async listSessions(projectPath: string): Promise<IdeSession[]> {
    return invoke("list_ide_sessions", { projectPath });
  },

  // 加载会话消息
  async loadSessionMessages(projectPath: string, sessionId: string): Promise<string> {
    return invoke("load_ide_session_messages", { projectPath, sessionId });
  },

  // 创建文件
  async createFile(path: string): Promise<void> {
    return invoke("create_ide_file", { path });
  },

  // 创建文件夹
  async createDirectory(path: string): Promise<void> {
    return invoke("create_ide_directory", { path });
  },

  // 删除文件或文件夹
  async deletePath(path: string): Promise<void> {
    return invoke("delete_ide_path", { path });
  },

  // 重命名文件或文件夹
  async renamePath(oldPath: string, newPath: string): Promise<void> {
    return invoke("rename_ide_path", { oldPath, newPath });
  },

  // 更新项目设置
  async updateProjectSettings(projectId: string, settings: string): Promise<void> {
    return invoke("update_ide_project_settings", { projectId, settings });
  },

  // 启动预览服务器
  async startPreviewServer(projectPath: string): Promise<string> {
    return invoke("start_preview_server", { projectPath });
  },
};
