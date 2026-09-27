use crate::document::{DocError, Document, DocumentService, FsStorage};
use tauri::State;
use crate::pdf::{DiskPdfStorage, PdfService};

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
pub fn export_pdf(path: String, bytes: Vec<u8>, state: State<'_, AppState>) -> Result<String, String> {
    state.pdf.export(&path, &bytes)
}

#[tauri::command]
pub fn open_workspace_file(root: String, path: String) -> Result<Document, String> {
    crate::workspace::open_file(&root, &path)
}

#[tauri::command]
pub fn list_workspace(root: String, directory: Option<String>) -> Result<crate::workspace::Listing, String> {
    crate::workspace::list_directory(&crate::workspace::DiskDirectoryReader, &root, directory.as_deref())
}
