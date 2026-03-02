#![allow(non_snake_case)]

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 环境信息结构
#[derive(Debug, Clone, Serialize)]
pub struct EnvironmentInfo {
    pub name: String,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
    pub is_installed: bool,
}

/// 完整环境状态
#[derive(Debug, Clone, Serialize)]
pub struct EnvironmentStatus {
    pub node: EnvironmentInfo,
    pub npm: EnvironmentInfo,
    pub pnpm: Option<EnvironmentInfo>,
}

/// 命令执行事件（用于实时输出）
#[derive(Debug, Clone, Serialize)]
pub struct CommandOutputEvent {
    pub task_id: String,
    pub output_type: String, // "stdout", "stderr", "exit"
    pub content: String,
    pub exit_code: Option<i32>,
}

/// 命令执行结果
#[derive(Debug, Clone, Serialize)]
pub struct CommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

/// 正在运行的任务管理器（全局静态）
static RUNNING_TASKS: Lazy<Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

static VERSION_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\d+\.\d+\.\d+(-[\w.]+)?").expect("Invalid version regex"));

/// 从输出中提取版本号
fn extract_version(raw: &str) -> Option<String> {
    VERSION_RE.find(raw).map(|m| m.as_str().to_string())
}

/// 检测单个环境工具
fn detect_tool(tool: &str) -> EnvironmentInfo {
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(["/C", &format!("{tool} --version")])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("{tool} --version"))
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();

            if out.status.success() {
                let raw = if stdout.is_empty() { &stderr } else { &stdout };
                if raw.is_empty() {
                    EnvironmentInfo {
                        name: tool.to_string(),
                        version: None,
                        path: None,
                        error: Some("not installed".to_string()),
                        is_installed: false,
                    }
                } else {
                    let path = find_tool_path(tool);
                    EnvironmentInfo {
                        name: tool.to_string(),
                        version: extract_version(raw),
                        path,
                        error: None,
                        is_installed: true,
                    }
                }
            } else {
                EnvironmentInfo {
                    name: tool.to_string(),
                    version: None,
                    path: None,
                    error: Some(if stderr.is_empty() {
                        "not installed".to_string()
                    } else {
                        stderr
                    }),
                    is_installed: false,
                }
            }
        }
        Err(e) => EnvironmentInfo {
            name: tool.to_string(),
            version: None,
            path: None,
            error: Some(e.to_string()),
            is_installed: false,
        },
    }
}

/// 查找工具的安装路径
fn find_tool_path(tool: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(["/C", &format!("where {tool}")])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("which {tool}"))
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let path = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .map(|s| s.trim().to_string());
            path.filter(|p| !p.is_empty())
        }
        _ => None,
    }
}

/// 检测 Node.js 环境
#[tauri::command]
pub async fn detect_node_environment() -> Result<EnvironmentStatus, String> {
    let node = detect_tool("node");
    let npm = detect_tool("npm");
    let pnpm_info = detect_tool("pnpm");
    let pnpm = if pnpm_info.is_installed {
        Some(pnpm_info)
    } else {
        None
    };

    Ok(EnvironmentStatus { node, npm, pnpm })
}

/// CLI 安装包映射
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliPackageInfo {
    pub name: String,
    pub package: String,
    pub install_cmd: String,
}

/// 获取 CLI 安装信息
#[tauri::command]
pub async fn get_cli_install_info(cli: String) -> Result<CliPackageInfo, String> {
    let info = match cli.as_str() {
        "claude" => CliPackageInfo {
            name: "Claude Code".to_string(),
            package: "@anthropic-ai/claude-code".to_string(),
            install_cmd: "npm install -g @anthropic-ai/claude-code".to_string(),
        },
        "codex" => CliPackageInfo {
            name: "Codex".to_string(),
            package: "@openai/codex".to_string(),
            install_cmd: "npm install -g @openai/codex".to_string(),
        },
        "gemini" => CliPackageInfo {
            name: "Gemini CLI".to_string(),
            package: "@google/gemini-cli".to_string(),
            install_cmd: "npm install -g @google/gemini-cli".to_string(),
        },
        "opencode" => CliPackageInfo {
            name: "OpenCode".to_string(),
            package: "opencode".to_string(),
            install_cmd: "curl -fsSL https://opencode.ai/install | bash".to_string(),
        },
        _ => return Err(format!("Unknown CLI: {cli}")),
    };
    Ok(info)
}

/// 执行命令并返回结果（同步，无实时输出）
#[tauri::command]
pub async fn execute_command(command: String) -> Result<CommandResult, String> {
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd")
        .args(["/C", &command])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(&command)
        .output();

    match output {
        Ok(out) => Ok(CommandResult {
            success: out.status.success(),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
            exit_code: out.status.code(),
        }),
        Err(e) => Err(format!("Failed to execute command: {e}")),
    }
}

/// 执行命令并实时输出（异步，通过事件发送输出）
#[tauri::command]
pub async fn execute_command_stream(
    app: AppHandle,
    task_id: String,
    command: String,
) -> Result<(), String> {
    let task_id_clone = task_id.clone();

    // 创建取消通道
    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut tasks = RUNNING_TASKS.lock().await;
        tasks.insert(task_id.clone(), cancel_tx);
    }

    // Spawn async task for command execution
    let app_clone = app.clone();

    tokio::spawn(async move {
        let result = execute_command_internal(&app_clone, &task_id_clone, &command, &mut cancel_rx).await;

        // 清理任务
        {
            let mut tasks = RUNNING_TASKS.lock().await;
            tasks.remove(&task_id_clone);
        }

        // 发送最终退出事件
        let exit_event = CommandOutputEvent {
            task_id: task_id_clone.clone(),
            output_type: "exit".to_string(),
            content: String::new(),
            exit_code: result.ok().and_then(|r| r.exit_code),
        };
        let _ = app_clone.emit("command-output", exit_event);
    });

    Ok(())
}

/// 内部命令执行逻辑
async fn execute_command_internal(
    app: &AppHandle,
    task_id: &str,
    command: &str,
    cancel_rx: &mut tokio::sync::oneshot::Receiver<()>,
) -> Result<CommandResult, String> {
    #[cfg(target_os = "windows")]
    let mut child = TokioCommand::new("cmd")
        .args(["/C", command])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let mut child = TokioCommand::new("sh")
        .arg("-c")
        .arg(command)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {e}"))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut full_stdout = String::new();
    let mut full_stderr = String::new();

    loop {
        tokio::select! {
            // Check for cancellation
            _ = &mut *cancel_rx => {
                let _ = child.kill().await;
                return Ok(CommandResult {
                    success: false,
                    stdout: full_stdout,
                    stderr: "Command cancelled".to_string(),
                    exit_code: None,
                });
            }
            // Read stdout
            line_result = stdout_reader.next_line() => {
                match line_result {
                    Ok(Some(line)) => {
                        full_stdout.push_str(&line);
                        full_stdout.push('\n');
                        let event = CommandOutputEvent {
                            task_id: task_id.to_string(),
                            output_type: "stdout".to_string(),
                            content: line,
                            exit_code: None,
                        };
                        let _ = app.emit("command-output", event);
                    }
                    Ok(None) => {
                        // stdout closed
                    }
                    Err(e) => {
                        log::warn!("Error reading stdout: {e}");
                    }
                }
            }
            // Read stderr
            line_result = stderr_reader.next_line() => {
                match line_result {
                    Ok(Some(line)) => {
                        full_stderr.push_str(&line);
                        full_stderr.push('\n');
                        let event = CommandOutputEvent {
                            task_id: task_id.to_string(),
                            output_type: "stderr".to_string(),
                            content: line,
                            exit_code: None,
                        };
                        let _ = app.emit("command-output", event);
                    }
                    Ok(None) => {
                        // stderr closed
                    }
                    Err(e) => {
                        log::warn!("Error reading stderr: {e}");
                    }
                }
            }
            // Wait for process to complete
            status = child.wait() => {
                match status {
                    Ok(status) => {
                        return Ok(CommandResult {
                            success: status.success(),
                            stdout: full_stdout,
                            stderr: full_stderr,
                            exit_code: status.code(),
                        });
                    }
                    Err(e) => {
                        return Err(format!("Failed to wait for command: {e}"));
                    }
                }
            }
        }
    }
}

/// 取消正在执行的命令
#[tauri::command]
pub async fn cancel_command(task_id: String) -> Result<bool, String> {
    let mut tasks = RUNNING_TASKS.lock().await;
    if let Some(cancel_tx) = tasks.remove(&task_id) {
        let _ = cancel_tx.send(());
        return Ok(true);
    }
    Ok(false)
}

/// 系统信息
#[derive(Debug, Clone, Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub os_display: String,
    pub arch_display: String,
}

/// 获取系统信息（平台 + 架构）
#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let os_display = match os.as_str() {
        "windows" => "Windows".to_string(),
        "macos" => "macOS".to_string(),
        "linux" => "Linux".to_string(),
        other => other.to_string(),
    };
    let arch_display = match arch.as_str() {
        "x86_64" => "x64".to_string(),
        "aarch64" => "ARM64".to_string(),
        other => other.to_string(),
    };
    Ok(SystemInfo { os, arch, os_display, arch_display })
}

/// Node.js LTS 版本（定期更新）
const NODE_LTS_VERSION: &str = "22.14.0";

/// 构建 Node.js 下载 URL
fn build_node_download_url() -> Result<(String, String), String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let node_arch = match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "x86" => "x86",
        other => return Err(format!("不支持的架构: {other}")),
    };
    let base = format!("https://nodejs.org/dist/v{NODE_LTS_VERSION}");
    match os {
        "windows" => {
            let filename = format!("node-v{NODE_LTS_VERSION}-{node_arch}.msi");
            Ok((format!("{base}/{filename}"), filename))
        }
        "macos" => {
            // Apple Silicon (aarch64) 需要下载 arm64 版本的 pkg
            let filename = if node_arch == "arm64" {
                format!("node-v{NODE_LTS_VERSION}-{node_arch}.pkg")
            } else {
                format!("node-v{NODE_LTS_VERSION}.pkg")
            };
            Ok((format!("{base}/{filename}"), filename))
        }
        "linux" => {
            let filename = format!("node-v{NODE_LTS_VERSION}-linux-{node_arch}.tar.xz");
            Ok((format!("{base}/{filename}"), filename))
        }
        other => Err(format!("不支持的操作系统: {other}")),
    }
}
/// 发送安装进度事件
fn emit_progress(app: &AppHandle, task_id: &str, msg: &str) {
    let event = CommandOutputEvent {
        task_id: task_id.to_string(),
        output_type: "stdout".to_string(),
        content: msg.to_string(),
        exit_code: None,
    };
    let _ = app.emit("command-output", event);
}
/// 下载文件到临时目录，带进度反馈
async fn download_file(
    app: &AppHandle,
    task_id: &str,
    url: &str,
    filename: &str,
) -> Result<std::path::PathBuf, String> {
    use futures::StreamExt;
    use tokio::io::AsyncWriteExt;

    emit_progress(app, task_id, &format!("正在下载 {filename}..."));
    emit_progress(app, task_id, &format!("URL: {url}"));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;

    let resp = client.get(url).send().await
        .map_err(|e| format!("下载请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("下载失败，HTTP 状态码: {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);
    let dest = std::env::temp_dir().join(filename);
    let mut file = tokio::fs::File::create(&dest).await
        .map_err(|e| format!("创建临时文件失败: {e}"))?;

    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_pct: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载数据失败: {e}"))?;
        file.write_all(&chunk).await
            .map_err(|e| format!("写入文件失败: {e}"))?;
        downloaded += chunk.len() as u64;
        if total_size > 0 {
            let pct = downloaded * 100 / total_size;
            if pct >= last_pct + 5 {
                last_pct = pct;
                let mb = downloaded as f64 / 1_048_576.0;
                let total_mb = total_size as f64 / 1_048_576.0;
                emit_progress(app, task_id, &format!(
                    "下载进度: {pct}% ({mb:.1} MB / {total_mb:.1} MB)"
                ));
            }
        }
    }
    file.flush().await.map_err(|e| format!("刷新文件失败: {e}"))?;
    let mb = downloaded as f64 / 1_048_576.0;
    emit_progress(app, task_id, &format!("下载完成 ({mb:.1} MB)"));
    Ok(dest)
}
/// Windows: 静默安装 MSI
async fn install_node_windows(
    app: &AppHandle,
    task_id: &str,
    msi_path: &std::path::Path,
) -> Result<(), String> {
    emit_progress(app, task_id, "正在静默安装 Node.js (msiexec)...");
    let path_str = msi_path.to_string_lossy();
    let status = TokioCommand::new("msiexec")
        .args(["/i", &path_str, "/qn", "/norestart"])
        .status()
        .await
        .map_err(|e| format!("启动安装程序失败: {e}"))?;
    if !status.success() {
        return Err(format!("MSI 安装失败，退出码: {:?}", status.code()));
    }
    emit_progress(app, task_id, "Node.js MSI 安装完成");
    Ok(())
}
/// macOS: 安装 .pkg
///
/// GUI 应用中 sudo 没有 TTY 无法弹出密码提示，因此使用 osascript
/// 调用系统授权对话框（会弹出 macOS 原生密码输入窗口）。
async fn install_node_macos(
    app: &AppHandle,
    task_id: &str,
    pkg_path: &std::path::Path,
) -> Result<(), String> {
    emit_progress(app, task_id, "正在安装 Node.js (.pkg)，可能需要输入管理员密码...");
    let path_str = pkg_path.to_string_lossy();
    // 使用 osascript 弹出系统授权对话框，避免 sudo 无 TTY 问题
    let script = format!(
        "do shell script \"installer -pkg '{}' -target /\" with administrator privileges",
        path_str.replace('\'', "'\\''")
    );
    let status = TokioCommand::new("osascript")
        .args(["-e", &script])
        .status()
        .await
        .map_err(|e| format!("启动安装程序失败: {e}"))?;
    if !status.success() {
        return Err(format!(
            "pkg 安装失败，退出码: {:?}（用户可能取消了授权）",
            status.code()
        ));
    }
    emit_progress(app, task_id, "Node.js pkg 安装完成");
    Ok(())
}
/// Linux: 解压 tar.xz 到 /usr/local
async fn install_node_linux(
    app: &AppHandle,
    task_id: &str,
    tar_path: &std::path::Path,
) -> Result<(), String> {
    emit_progress(app, task_id, "正在解压 Node.js 到 /usr/local...");
    let path_str = tar_path.to_string_lossy();
    // 解压到临时目录
    let tmp_extract = std::env::temp_dir().join("node-extract");
    let _ = tokio::fs::remove_dir_all(&tmp_extract).await;
    tokio::fs::create_dir_all(&tmp_extract).await
        .map_err(|e| format!("创建解压目录失败: {e}"))?;
    let extract_dir = tmp_extract.to_string_lossy().to_string();
    let status = TokioCommand::new("tar")
        .args(["-xJf", &path_str, "-C", &extract_dir, "--strip-components=1"])
        .status()
        .await
        .map_err(|e| format!("解压失败: {e}"))?;
    if !status.success() {
        return Err("tar 解压失败".to_string());
    }
    emit_progress(app, task_id, "正在复制到 /usr/local...");
    let status = TokioCommand::new("sudo")
        .args(["cp", "-r"])
        .arg(format!("{extract_dir}/bin/."))
        .arg("/usr/local/bin/")
        .status()
        .await
        .map_err(|e| format!("复制 bin 失败: {e}"))?;
    if !status.success() {
        return Err("复制 node 到 /usr/local/bin 失败".to_string());
    }
    let status = TokioCommand::new("sudo")
        .args(["cp", "-r"])
        .arg(format!("{extract_dir}/lib/."))
        .arg("/usr/local/lib/")
        .status()
        .await
        .map_err(|e| format!("复制 lib 失败: {e}"))?;
    if !status.success() {
        log::warn!("复制 lib 目录失败，可能不影响使用");
    }
    // 清理临时解压目录
    let _ = tokio::fs::remove_dir_all(&tmp_extract).await;
    emit_progress(app, task_id, "Node.js 安装完成 (Linux)");
    Ok(())
}
/// 一键安装 Node.js — 自动检测平台+架构，下载 LTS，静默安装
#[tauri::command]
pub async fn install_node_auto(
    app: AppHandle,
    task_id: String,
) -> Result<(), String> {
    let task_id_clone = task_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let result = install_node_internal(&app_clone, &task_id_clone).await;
        let (exit_code, msg) = match &result {
            Ok(()) => (Some(0), String::new()),
            Err(e) => {
                emit_progress(&app_clone, &task_id_clone, &format!("错误: {e}"));
                (Some(1), e.clone())
            }
        };
        let exit_event = CommandOutputEvent {
            task_id: task_id_clone,
            output_type: "exit".to_string(),
            content: msg,
            exit_code,
        };
        let _ = app_clone.emit("command-output", exit_event);
    });

    Ok(())
}
/// 内部安装逻辑
async fn install_node_internal(
    app: &AppHandle,
    task_id: &str,
) -> Result<(), String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    emit_progress(app, task_id, &format!(
        "检测到系统: {} ({})", os, arch
    ));
    // 先检查是否已安装
    let existing = detect_tool("node");
    if existing.is_installed {
        emit_progress(app, task_id, &format!(
            "Node.js 已安装: v{}",
            existing.version.as_deref().unwrap_or("unknown")
        ));
        return Ok(());
    }
    emit_progress(app, task_id, &format!(
        "准备安装 Node.js v{NODE_LTS_VERSION} ({os}/{arch})"
    ));
    // 构建下载 URL
    let (url, filename) = build_node_download_url()?;
    // 下载安装包
    let installer_path = download_file(app, task_id, &url, &filename).await?;
    // 平台分发安装
    match os {
        "windows" => install_node_windows(app, task_id, &installer_path).await?,
        "macos" => install_node_macos(app, task_id, &installer_path).await?,
        "linux" => install_node_linux(app, task_id, &installer_path).await?,
        _ => return Err(format!("不支持的平台: {os}")),
    }
    // 清理安装包
    let _ = tokio::fs::remove_file(&installer_path).await;
    // 验证安装
    emit_progress(app, task_id, "正在验证安装...");
    // Windows 新装后 PATH 可能未刷新，等一下
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    let check = detect_tool("node");
    if check.is_installed {
        emit_progress(app, task_id, &format!(
            "Node.js v{} 安装成功！",
            check.version.as_deref().unwrap_or(NODE_LTS_VERSION)
        ));
        Ok(())
    } else {
        emit_progress(app, task_id,
            "安装完成但验证失败，可能需要重启应用后生效");
        Ok(())
    }
}
