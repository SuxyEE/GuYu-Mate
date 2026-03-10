//! IDE 项目数据访问对象

use crate::database::{lock_conn, Database};
use crate::error::AppError;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: i64,
    pub last_opened_at: Option<i64>,
    pub description: Option<String>,
    pub settings: Option<String>,
}

impl Database {
    /// 创建或更新 IDE 项目
    pub fn upsert_ide_project(&self, project: &IdeProject) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "INSERT OR REPLACE INTO ide_projects
             (id, name, path, created_at, last_opened_at, description, settings)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                project.id,
                project.name,
                project.path,
                project.created_at,
                project.last_opened_at,
                project.description,
                project.settings,
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    /// 根据路径获取项目
    pub fn get_ide_project_by_path(&self, path: &str) -> Result<Option<IdeProject>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT id, name, path, created_at, last_opened_at, description, settings FROM ide_projects WHERE path = ?1")
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut rows = stmt
            .query(params![path])
            .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(row) = rows.next().map_err(|e| AppError::Database(e.to_string()))? {
            Ok(Some(IdeProject {
                id: row.get(0).map_err(|e| AppError::Database(e.to_string()))?,
                name: row.get(1).map_err(|e| AppError::Database(e.to_string()))?,
                path: row.get(2).map_err(|e| AppError::Database(e.to_string()))?,
                created_at: row.get(3).map_err(|e| AppError::Database(e.to_string()))?,
                last_opened_at: row.get(4).map_err(|e| AppError::Database(e.to_string()))?,
                description: row.get(5).map_err(|e| AppError::Database(e.to_string()))?,
                settings: row.get(6).map_err(|e| AppError::Database(e.to_string()))?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 更新项目最后打开时间
    pub fn update_ide_project_last_opened(&self, id: &str, timestamp: i64) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "UPDATE ide_projects SET last_opened_at = ?1 WHERE id = ?2",
            params![timestamp, id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    /// 获取所有项目（按最后打开时间排序）
    pub fn get_all_ide_projects(&self) -> Result<Vec<IdeProject>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT id, name, path, created_at, last_opened_at, description, settings FROM ide_projects ORDER BY last_opened_at DESC NULLS LAST")
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(IdeProject {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    created_at: row.get(3)?,
                    last_opened_at: row.get(4)?,
                    description: row.get(5)?,
                    settings: row.get(6)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut projects = Vec::new();
        for row in rows {
            projects.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }
        Ok(projects)
    }

    /// 更新项目设置
    pub fn update_ide_project_settings(&self, id: &str, settings: &str) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "UPDATE ide_projects SET settings = ?1 WHERE id = ?2",
            params![settings, id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}
