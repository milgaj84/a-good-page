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
