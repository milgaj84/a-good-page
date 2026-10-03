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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState::default())
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
