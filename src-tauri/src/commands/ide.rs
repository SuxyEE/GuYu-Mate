//! IDE Tauri 命令

use crate::error::AppError;
use crate::ide;
use crate::store::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager, State};

pub use crate::database::IdeProject;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[tauri::command]
pub async fn open_ide_project(
    state: State<'_, AppState>,
    path: String,
) -> Result<IdeProject, String> {
    ide::open_project(state.db.clone(), path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ide_projects(state: State<'_, AppState>) -> Result<Vec<IdeProject>, String> {
    state.db.get_all_ide_projects().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_file_tree(path: String) -> Result<Vec<FileNode>, String> {
    read_dir_recursive(&path, 0).map_err(|e| e.to_string())
}

fn read_dir_recursive(path: &str, depth: usize) -> Result<Vec<FileNode>, AppError> {
    if depth > 10 {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(path)
        .map_err(|e| AppError::Message(format!("读取目录失败: {}", e)))?;

    let mut nodes = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| AppError::Message(format!("读取条目失败: {}", e)))?;
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let is_dir = path.is_dir();
        let children = if is_dir {
            Some(read_dir_recursive(path.to_str().unwrap(), depth + 1)?)
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: path.to_str().unwrap().to_string(),
            is_dir,
            children,
        });
    }

    nodes.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(nodes)
}

#[tauri::command]
pub async fn read_ide_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[tauri::command]
pub async fn write_ide_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: i32,
    pub column: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectContext {
    #[serde(rename = "openFiles")]
    pub opened_files: Vec<String>,
    #[serde(rename = "selectedCode")]
    pub selected_text: Option<String>,
    #[serde(rename = "selectedFile")]
    pub current_file: Option<String>,
    pub cursor_position: Option<CursorPosition>,
    pub visible_files: Option<Vec<String>>,
}

#[tauri::command]
pub async fn send_claude_message(
    app: AppHandle,
    state: State<'_, AppState>,
    project_path: String,
    message: String,
    context: Option<ProjectContext>,
    resume_session_id: Option<String>,
) -> Result<(), String> {
    eprintln!("收到消息: {}", message);
    eprintln!("项目路径: {}", project_path);
    eprintln!("上下文: {:?}", context);

    // 获取当前激活的 Claude Provider 的 API Key 和 Base URL
    let current_provider_id = state
        .db
        .get_current_provider("claude")
        .map_err(|e| {
            eprintln!("获取 Provider 失败: {}", e);
            e.to_string()
        })?
        .ok_or_else(|| {
            eprintln!("未设置当前 Provider");
            "未设置当前 Provider".to_string()
        })?;

    let providers = state.db.get_all_providers("claude").map_err(|e| {
        eprintln!("获取所有 Provider 失败: {}", e);
        e.to_string()
    })?;

    let provider = providers
        .get(&current_provider_id)
        .ok_or_else(|| {
            eprintln!("未找到当前激活的 Provider");
            "未找到当前激活的 Provider".to_string()
        })?;

    // 从 env.ANTHROPIC_AUTH_TOKEN 或 env.ANTHROPIC_API_KEY 获取 API Key
    let env = provider
        .settings_config
        .get("env")
        .and_then(|v| v.as_object())
        .ok_or("Provider 配置格式错误")?;

    let api_key = env
        .get("ANTHROPIC_AUTH_TOKEN")
        .or_else(|| env.get("ANTHROPIC_API_KEY"))
        .and_then(|v| v.as_str())
        .ok_or("当前 Provider 未配置 API Key")?
        .to_string();

    // 获取 Base URL（清理路径，SDK 会自动添加 /v1/messages）
    let base_url = env
        .get("ANTHROPIC_BASE_URL")
        .and_then(|v| v.as_str())
        .map(|s| {
            let mut url = s.trim_end_matches('/').to_string();
            // 移除 /v1/messages 或 /v1 后缀，SDK 会自动添加
            if url.ends_with("/v1/messages") {
                url = url.trim_end_matches("/v1/messages").to_string();
            } else if url.ends_with("/v1") {
                url = url.trim_end_matches("/v1").to_string();
            }
            url
        });

    // 获取模型名称（默认使用 claude-haiku-4-5-20251001）
    let model = provider
        .settings_config
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("claude-haiku-4-5-20251001")
        .to_string();

    // Sidecar 路径
    let sidecar_path = if cfg!(debug_assertions) {
        // 开发环境：使用绝对路径
        let current = std::env::current_dir().unwrap_or_default();
        let path = if current.ends_with("src-tauri") {
            current.join("agent-bridge/index.js")
        } else {
            current.join("src-tauri/agent-bridge/index.js")
        };
        path.to_str().unwrap_or("agent-bridge/index.js").to_string()
    } else {
        // 生产环境从资源目录获取
        app.path()
            .resource_dir()
            .ok()
            .and_then(|p| p.join("agent-bridge/index.js").to_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "agent-bridge/index.js".to_string())
    };

    eprintln!("Sidecar 路径: {}", sidecar_path);

    // 创建 runtime 并执行（SDK 自动管理会话）
    let runtime = crate::agent::AgentRuntime::new(api_key, base_url, sidecar_path, app);
    runtime
        .execute(message, project_path, model, context, resume_session_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn clear_ide_session(
    project_path: String,
) -> Result<(), String> {
    // 清理官方 SDK 的会话文件
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "无法获取用户目录".to_string())?;

    // 生成项目 slug（与 SDK 保持一致，使用 - 分隔符）
    let project_slug = project_path
        .replace(['/', '\\', ':'], "-")
        .trim_matches('-')
        .to_string();

    let sessions_dir = format!("{}/.claude/projects/{}", home, project_slug);

    if std::path::Path::new(&sessions_dir).exists() {
        std::fs::remove_dir_all(&sessions_dir)
            .map_err(|e| format!("清理会话文件失败: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn create_ide_file(path: String) -> Result<(), String> {
    fs::write(&path, "").map_err(|e| format!("创建文件失败: {}", e))
}

#[tauri::command]
pub async fn create_ide_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("创建文件夹失败: {}", e))
}

#[tauri::command]
pub async fn delete_ide_path(path: String) -> Result<(), String> {
    let metadata = fs::metadata(&path).map_err(|e| format!("读取路径信息失败: {}", e))?;
    if metadata.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| format!("删除文件夹失败: {}", e))
    } else {
        fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))
    }
}

#[tauri::command]
pub async fn rename_ide_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("重命名失败: {}", e))
}

#[tauri::command]
pub async fn start_preview_server(project_path: String) -> Result<String, String> {
    use std::process::Command;
    use std::fs;

    let path = std::path::Path::new(&project_path);

    // 检查是否有 package.json
    if path.join("package.json").exists() {
        // 读取 package.json 检测脚本
        let package_json = fs::read_to_string(path.join("package.json"))
            .map_err(|e| format!("读取 package.json 失败: {}", e))?;

        let json: serde_json::Value = serde_json::from_str(&package_json)
            .map_err(|e| format!("解析 package.json 失败: {}", e))?;

        // 检测包管理器
        let has_pnpm_lock = path.join("pnpm-lock.yaml").exists();
        let has_yarn_lock = path.join("yarn.lock").exists();
        let pkg_manager = if has_pnpm_lock {
            "pnpm"
        } else if has_yarn_lock {
            "yarn"
        } else {
            "npm"
        };

        // 检测开发命令
        let scripts = json.get("scripts").and_then(|s| s.as_object());
        let dev_cmd = if scripts.and_then(|s| s.get("dev")).is_some() {
            "dev"
        } else if scripts.and_then(|s| s.get("start")).is_some() {
            "start"
        } else {
            return Err("未找到 dev 或 start 脚本".to_string());
        };

        // 在后台启动开发服务器
        let project_path_clone = project_path.clone();
        tauri::async_runtime::spawn(async move {
            let _ = Command::new(pkg_manager)
                .arg("run")
                .arg(dev_cmd)
                .current_dir(&project_path_clone)
                .spawn();
        });

        // 返回预览 URL（根据常见框架推测端口）
        let port = if json.get("dependencies")
            .and_then(|d| d.as_object())
            .map(|d| d.contains_key("vite"))
            .unwrap_or(false)
        {
            5173 // Vite
        } else if json.get("dependencies")
            .and_then(|d| d.as_object())
            .map(|d| d.contains_key("next"))
            .unwrap_or(false)
        {
            3000 // Next.js
        } else {
            3000 // 默认
        };

        return Ok(format!("http://localhost:{}", port));
    }

    // 静态 HTML 项目
    if path.join("index.html").exists() {
        return Ok(format!("file://{}/index.html", project_path));
    }

    Err("无法识别项目类型".to_string())
}

#[tauri::command]
pub async fn update_ide_project_settings(
    state: State<'_, AppState>,
    project_id: String,
    settings: String,
) -> Result<(), String> {
    state
        .db
        .update_ide_project_settings(&project_id, &settings)
        .map_err(|e| format!("更新项目设置失败: {}", e))?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IdeSession {
    pub session_id: String,
    pub project_path: String,
    pub created_at: i64,
    pub message_count: usize,
    pub title: String,
}

#[tauri::command]
pub async fn list_ide_sessions(project_path: String) -> Result<Vec<IdeSession>, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "无法获取用户目录".to_string())?;

    let project_slug = project_path
        .replace(['/', '\\', ':'], "-")
        .trim_matches('-')
        .to_string();

    let sessions_dir = format!("{}/.claude/projects/{}", home, project_slug);
    let path = std::path::Path::new(&sessions_dir);

    if !path.exists() {
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();
    let entries = std::fs::read_dir(path).map_err(|e| format!("读取会话目录失败: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let file_path = entry.path();

        if file_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            if let Some(session_id) = file_path.file_stem().and_then(|s| s.to_str()) {
                let metadata = std::fs::metadata(&file_path)
                    .map_err(|e| format!("读取文件元数据失败: {}", e))?;

                let created_at = metadata
                    .created()
                    .or_else(|_| metadata.modified())
                    .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64)
                    .unwrap_or(0);

                let content = std::fs::read_to_string(&file_path)
                    .map_err(|e| format!("读取会话文件失败: {}", e))?;
                let message_count = content.lines().count();

                // 提取第一条用户消息作为标题
                let mut title = String::from("未命名会话");
                for line in content.lines() {
                    if let Ok(entry) = serde_json::from_str::<serde_json::Value>(line) {
                        if entry.get("type").and_then(|v| v.as_str()) == Some("user") {
                            if let Some(message) = entry.get("message") {
                                if let Some(content_val) = message.get("content") {
                                    // content 可能是字符串或数组
                                    let text = if let Some(s) = content_val.as_str() {
                                        s.to_string()
                                    } else if let Some(arr) = content_val.as_array() {
                                        arr.iter()
                                            .filter_map(|item| {
                                                if item.get("type")?.as_str()? == "text" {
                                                    item.get("text")?.as_str()
                                                } else {
                                                    None
                                                }
                                            })
                                            .collect::<Vec<_>>()
                                            .join(" ")
                                    } else {
                                        String::new()
                                    };

                                    if !text.is_empty() {
                                        // 截取前50个字符作为标题
                                        title = if text.len() > 50 {
                                            format!("{}...", &text[..50])
                                        } else {
                                            text
                                        };
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                sessions.push(IdeSession {
                    session_id: session_id.to_string(),
                    project_path: project_path.clone(),
                    created_at,
                    message_count,
                    title,
                });
            }
        }
    }

    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(sessions)
}

#[tauri::command]
pub async fn load_ide_session_messages(project_path: String, session_id: String) -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "无法获取用户目录".to_string())?;

    let project_slug = project_path
        .replace(['/', '\\', ':'], "-")
        .trim_matches('-')
        .to_string();

    let session_file = format!("{}/.claude/projects/{}/{}.jsonl", home, project_slug, session_id);

    std::fs::read_to_string(&session_file)
        .map_err(|e| format!("读取会话文件失败: {}", e))
}
