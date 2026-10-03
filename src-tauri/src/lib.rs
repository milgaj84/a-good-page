mod access;
mod backup;
mod commands;
mod conflict;
mod disk_probe;
pub mod document;
mod export;
mod library;
mod pdf;
mod project;
mod workspace;

/// The page may only stay inside the app: no link, redirect or drop can replace it with another site.
fn navigation_allowed(url: &tauri::Url) -> bool {
    match url.scheme() {
        "tauri" => true,
        "http" | "https" => {
            matches!(url.host_str(), Some("tauri.localhost"))
                || (cfg!(debug_assertions)
                    && matches!(url.host_str(), Some("localhost" | "127.0.0.1")))
        }
        "about" => url.as_str() == "about:blank",
        _ => false,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState::default())
        .setup(|app| {
            // What the app may touch is decided here, in Rust, and remembered between launches.
            let store = app
                .path()
                .app_config_dir()
                .ok()
                .map(|dir| dir.join("access.json"));
            app.manage(access::Access::new(store));
            if let Some(config) = app.config().app.windows.first() {
                tauri::WebviewWindowBuilder::from_config(app.handle(), config)?
                    .on_navigation(navigation_allowed)
                    .build()?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // A writing file dropped on the window is a file you chose.
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                if let Some(access) = window.try_state::<access::Access>() {
                    for path in paths.iter().filter(|p| document::is_supported(p)) {
                        if let Some(text) = path.to_str() {
                            let _ = access.grant_file(text, true);
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_document,
            commands::save_document,
            commands::guarded_save_document,
            commands::probe_document,
            commands::read_project_order,
            commands::write_project_order,
            commands::export_pdf,
            commands::export_document,
            commands::list_workspace,
            commands::open_workspace_file,
            commands::default_library,
            commands::current_library,
            commands::use_library,
            commands::adopt_library,
            commands::pick_open_file,
            commands::pick_save_file,
            commands::pick_folder,
            commands::create_entry,
            commands::rename_entry,
            commands::trash_entry,
            commands::list_trash,
            commands::restore_entry,
            commands::move_entry,
            commands::create_backup,
            commands::restore_backup,
            commands::default_backup_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running A Good Page");
}

#[cfg(test)]
mod tests {
    use super::navigation_allowed;

    fn allowed(url: &str) -> bool {
        navigation_allowed(&url.parse().unwrap())
    }

    #[test]
    fn the_app_may_navigate_within_itself_only() {
        assert!(allowed("tauri://localhost/index.html"));
        assert!(allowed("http://tauri.localhost/"));
        assert!(allowed("about:blank"));
        for evil in [
            "https://example.com/",
            "http://localhost.evil.com/",
            "http://tauri.localhost.evil.com/",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,<script>1</script>",
            "ftp://example.com/",
            "about:srcdoc",
        ] {
            assert!(!allowed(evil), "{evil}");
        }
    }
}
