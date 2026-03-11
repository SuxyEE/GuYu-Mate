use crate::database::Database;
use crate::services::ProxyService;
use crate::agent::AgentRuntime;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 全局应用状态
pub struct AppState {
    pub db: Arc<Database>,
    pub proxy_service: ProxyService,
    pub agent_runtime: Arc<RwLock<Option<AgentRuntime>>>,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new(db: Arc<Database>) -> Self {
        let proxy_service = ProxyService::new(db.clone());

        Self {
            db,
            proxy_service,
            agent_runtime: Arc::new(RwLock::new(None)),
        }
    }
}
