use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub struct FileWatcherService {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

impl FileWatcherService {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn watch_project(&self, app: AppHandle, project_path: String) -> Result<(), String> {
        let mut watcher_guard = self.watcher.lock().await;

        let app_clone = app.clone();
        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(
                        event.kind,
                        notify::EventKind::Create(_)
                            | notify::EventKind::Modify(_)
                            | notify::EventKind::Remove(_)
                    ) {
                        let _ = app_clone.emit("file-changed", event.paths);
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| e.to_string())?;

        *watcher_guard = Some(watcher);

        if let Some(w) = watcher_guard.as_mut() {
            w.watch(Path::new(&project_path), RecursiveMode::Recursive)
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub async fn stop_watching(&self) {
        let mut watcher_guard = self.watcher.lock().await;
        *watcher_guard = None;
    }
}
