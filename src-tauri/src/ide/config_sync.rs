//! IDE 配置同步服务 - 将 GuYu 配置同步到项目 .claude 目录

use crate::database::Database;
use crate::error::AppError;
use serde_json::json;
use std::fs;
use std::path::Path;
use std::sync::Arc;

/// 同步 GuYu 配置到项目 .claude 目录
pub async fn sync_config_to_project(
    db: Arc<Database>,
    project_path: &str,
) -> Result<(), AppError> {
    let claude_dir = Path::new(project_path).join(".claude");
    let settings_dir = claude_dir.join("settings");

    // 创建目录
    fs::create_dir_all(&settings_dir)
        .map_err(|e| AppError::Message(format!("创建 .claude/settings 目录失败: {}", e)))?;

    // 同步 MCP 配置
    sync_mcp_config(db.clone(), &settings_dir).await?;

    Ok(())
}

async fn sync_mcp_config(db: Arc<Database>, settings_dir: &Path) -> Result<(), AppError> {
    let servers = db
        .get_all_mcp_servers()
        .map_err(|e| AppError::Message(format!("读取 MCP 服务器失败: {}", e)))?;

    let mut mcp_servers = serde_json::Map::new();

    for (name, server) in servers {
        // 检查是否启用（任一应用启用即可）
        if !server.apps.claude && !server.apps.codex && !server.apps.gemini {
            continue;
        }

        // 直接使用 server.server 字段（已经是 JSON Value）
        mcp_servers.insert(name, server.server);
    }

    let config = json!({
        "mcpServers": mcp_servers
    });

    let mcp_path = settings_dir.join("mcp.json");
    fs::write(&mcp_path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| AppError::Message(format!("写入 mcp.json 失败: {}", e)))?;

    Ok(())
}
