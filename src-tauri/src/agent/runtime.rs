//! Agent Runtime - Sidecar Bridge

use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    Thinking { text: String },
    ToolCall { name: String, input: serde_json::Value },
    ToolResult { name: String, result: String },
    Response { text: String },
    FileOperation { operation: FileOperation },
    Error { message: String },
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FileOperation {
    Create { path: String },
    Modify { path: String },
    Delete { path: String },
}

pub struct AgentRuntime {
    sidecar_path: String,
    api_key: String,
    base_url: Option<String>,
    app: AppHandle,
}

impl AgentRuntime {
    pub fn new(api_key: String, base_url: Option<String>, sidecar_path: String, app: AppHandle) -> Self {
        Self { api_key, base_url, sidecar_path, app }
    }

    pub async fn execute(
        &self,
        user_message: String,
        project_path: String,
        model: String,
        context: Option<crate::commands::ProjectContext>,
        resume_session_id: Option<String>,
    ) -> Result<String, AppError> {
        let mut child = Command::new("node")
            .arg(&self.sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::Message(format!("启动 Sidecar 失败: {}", e)))?;

        let mut stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let mut reader = BufReader::new(stdout).lines();
        let mut err_reader = BufReader::new(stderr).lines();

        // 异步读取 stderr
        let app_clone = self.app.clone();
        tokio::spawn(async move {
            while let Ok(Some(line)) = err_reader.next_line().await {
                eprintln!("Agent stderr: {}", line);
                let _ = app_clone.emit("agent-event", AgentEvent::Error {
                    message: format!("进程错误: {}", line)
                });
            }
        });

        let mut prompt = user_message;
        if let Some(ctx) = context {
            let mut parts = Vec::new();
            if let Some(f) = ctx.current_file {
                parts.push(format!("当前文件: {}", f));
            }
            if let Some(s) = ctx.selected_text {
                if !s.is_empty() {
                    parts.push(format!("选中代码:\n```\n{}\n```", s));
                }
            }
            if !ctx.opened_files.is_empty() {
                parts.push(format!("打开文件: {}", ctx.opened_files.join(", ")));
            }
            if !parts.is_empty() {
                prompt = format!("{}\n\n[上下文]\n{}", prompt, parts.join("\n"));
            }
        }

        let request = serde_json::json!({
            "prompt": prompt,
            "projectPath": project_path,
            "apiKey": self.api_key,
            "model": model,
            "baseUrl": self.base_url,
            "systemPrompt": self.build_system_prompt(&project_path),
            "resumeSessionId": resume_session_id,
        });

        stdin.write_all(serde_json::to_string(&request)?.as_bytes()).await?;
        stdin.write_all(b"\n").await?;
        drop(stdin);

        let mut assistant_response = String::new();

        while let Some(line) = reader.next_line().await? {
            if let Ok(event) = serde_json::from_str::<AgentEvent>(&line) {
                if let AgentEvent::Response { text } = &event {
                    assistant_response.push_str(text);
                }
                self.emit_event(event)?;
            }
        }

        Ok(assistant_response)
    }

    fn emit_event(&self, event: AgentEvent) -> Result<(), AppError> {
        self.app.emit("agent-event", &event)
            .map_err(|e| AppError::Message(format!("推送事件失败: {}", e)))
    }

    fn build_system_prompt(&self, project_path: &str) -> String {
        let tech_stack = self.detect_tech_stack(project_path);
        format!(r#"你是专业的 AI 编程助手。

项目路径: {}
技术栈: {}

可用工具: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch

请主动使用工具获取上下文，给出专业建议。"#, project_path, tech_stack)
    }

    fn detect_tech_stack(&self, project_path: &str) -> String {
        use std::path::Path;
        let mut stack = Vec::new();
        let path = Path::new(project_path);

        if path.join("package.json").exists() {
            stack.push("Node.js");
            if path.join("tsconfig.json").exists() {
                stack.push("TypeScript");
            }
        }
        if path.join("Cargo.toml").exists() {
            stack.push("Rust");
            if path.join("src-tauri").exists() {
                stack.push("Tauri");
            }
        }
        if path.join("requirements.txt").exists() || path.join("pyproject.toml").exists() {
            stack.push("Python");
        }
        if path.join("go.mod").exists() {
            stack.push("Go");
        }

        if stack.is_empty() {
            "未检测到".to_string()
        } else {
            stack.join(", ")
        }
    }
}
