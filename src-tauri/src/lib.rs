mod commands;
pub mod document;
mod pdf;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::open_document,
            commands::save_document,
            commands::export_pdf,
            commands::list_workspace,
            commands::open_workspace_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running A Good Page");
}
