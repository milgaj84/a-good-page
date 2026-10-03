use crate::document::{DocError, Document, DocumentService, FsStorage};
use crate::pdf::{DiskPdfStorage, PdfService};
use tauri::State;

/// Shared application state. The storage backend is injected into the
/// service, so the command layer stays a thin adapter.
pub struct AppState {
    pub documents: DocumentService<FsStorage>,
    pub pdf: PdfService<DiskPdfStorage>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            documents: DocumentService::new(FsStorage),
            pdf: PdfService::new(DiskPdfStorage),
        }
    }
}

#[tauri::command]
pub fn open_document(path: String, state: State<'_, AppState>) -> Result<Document, DocError> {
    state.documents.open(&path)
}

#[tauri::command]
pub fn save_document(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<String, DocError> {
    state.documents.save(&path, &content)
}

#[tauri::command]
pub fn probe_document(path: String) -> crate::disk_probe::DiskProbe {
    crate::disk_probe::probe(&path)
}

#[tauri::command]
pub fn guarded_save_document(
    path: String,
    content: String,
    expected: Option<String>,
) -> Result<String, String> {
    crate::conflict::guarded_save(&path, &content, expected.as_deref())
}

#[tauri::command]
pub fn export_pdf(
    path: String,
    bytes: Vec<u8>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.pdf.export(&path, &bytes)
}

/// Saves a finished export in any supported format (`kind` is "pdf", "docx" or "md").
#[tauri::command]
pub fn export_document(path: String, bytes: Vec<u8>, kind: String) -> Result<String, String> {
    crate::export::export_document(&path, &bytes, &kind)
}

#[tauri::command]
pub fn open_workspace_file(root: String, path: String) -> Result<Document, String> {
    crate::workspace::open_file(&root, &path)
}

#[tauri::command]
pub fn list_workspace(
    root: String,
    directory: Option<String>,
) -> Result<crate::workspace::Listing, String> {
    crate::workspace::list_directory(
        &crate::workspace::DiskDirectoryReader,
        &root,
        directory.as_deref(),
    )
}

#[tauri::command]
pub fn read_project_order(root: String) -> Result<Option<String>, String> {
    crate::project::read(&root)
}
#[tauri::command]
pub fn write_project_order(
    root: String,
    expected: Option<String>,
    value: String,
) -> Result<String, String> {
    crate::project::write(&root, expected.as_deref(), &value)
}

#[tauri::command]
pub fn default_library(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let docs = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| format!("Cannot find your Documents folder: {e}"))?;
    crate::library::ensure_folder(&docs.join("A Good Page"))
}

#[tauri::command]
pub fn create_entry(
    root: String,
    parent: Option<String>,
    name: String,
    kind: String,
) -> Result<String, String> {
    crate::library::create(&root, parent.as_deref(), &name, &kind)
}

#[tauri::command]
pub fn rename_entry(root: String, path: String, new_name: String) -> Result<String, String> {
    crate::library::rename(&root, &path, &new_name)
}

#[tauri::command]
pub fn trash_entry(root: String, path: String, position: Option<u32>) -> Result<String, String> {
    crate::library::trash(&root, &path, position)
}

#[tauri::command]
pub fn list_trash(root: String) -> Result<Vec<crate::library::TrashItem>, String> {
    crate::library::list_trash(&root)
}

#[tauri::command]
pub fn restore_entry(root: String, path: String) -> Result<String, String> {
    crate::library::restore(&root, &path)
}

#[tauri::command]
pub fn move_entry(root: String, path: String, to: Option<String>) -> Result<String, String> {
    crate::library::move_into(&root, &path, to.as_deref())
}

#[tauri::command]
pub fn create_backup(
    root: String,
    dest: String,
    stamp: String,
    keep: u32,
) -> Result<crate::backup::BackupSummary, String> {
    crate::backup::create_backup(&root, &dest, &stamp, keep)
}

#[tauri::command]
pub fn restore_backup(root: String, zip: String) -> Result<crate::backup::RestoreSummary, String> {
    crate::backup::restore_backup(&root, &zip)
}

/// The suggested backup folder: a sibling of the Library, never inside it.
#[tauri::command]
pub fn default_backup_dir(root: String) -> Result<String, String> {
    let path = std::path::PathBuf::from(&root);
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Library".into());
    let parent = path.parent().ok_or("The Library has no parent folder.")?;
    Ok(parent
        .join(format!("{name} backups"))
        .to_string_lossy()
        .into_owned())
}
