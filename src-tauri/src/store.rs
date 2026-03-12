use crate::database::Database;
use crate::services::{ProxyService, FileWatcherService};
use crate::agent::AgentRuntime;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use tokio::task::AbortHandle;

/// 全局应用状态
pub struct AppState {
    pub db: Arc<Database>,
    pub proxy_service: ProxyService,
    pub agent_runtime: Arc<RwLock<Option<AgentRuntime>>>,
    pub preview_servers: Arc<RwLock<HashMap<String, (u16, AbortHandle)>>>,
    pub file_watcher: Arc<FileWatcherService>,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new(db: Arc<Database>) -> Self {
        let proxy_service = ProxyService::new(db.clone());

        Self {
            db,
            proxy_service,
            agent_runtime: Arc::new(RwLock::new(None)),
            preview_servers: Arc::new(RwLock::new(HashMap::new())),
            file_watcher: Arc::new(FileWatcherService::new()),
        }
    }
}
