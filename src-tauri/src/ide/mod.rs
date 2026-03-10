//! IDE 核心逻辑模块

pub mod config_sync;

use crate::database::{Database, IdeProject};
use crate::error::AppError;
use std::path::Path;
use std::sync::Arc;

pub async fn open_project(db: Arc<Database>, path: String) -> Result<IdeProject, AppError> {
    if !Path::new(&path).exists() {
        return Err(AppError::InvalidInput(format!("路径不存在: {}", path)));
    }

    let now = chrono::Utc::now().timestamp();

    let project = if let Some(mut project) = db.get_ide_project_by_path(&path)? {
        db.update_ide_project_last_opened(&project.id, now)?;
        project.last_opened_at = Some(now);
        project
    } else {
        let project_name = Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Untitled")
            .to_string();

        let project = IdeProject {
            id: uuid::Uuid::new_v4().to_string(),
            name: project_name,
            path: path.clone(),
            created_at: now,
            last_opened_at: Some(now),
            description: None,
            settings: None,
        };

        db.upsert_ide_project(&project)?;
        project
    };

    // 同步配置到项目 .claude 目录
    config_sync::sync_config_to_project(db, &path).await?;

    Ok(project)
}
