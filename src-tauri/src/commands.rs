//! The commands the page can call. Every path the page sends is checked against `Access` first: it may only name
//! places inside your Libraries, folders and files you picked in a native dialog, or files you dropped on the window.
use crate::access::Access;
use crate::document::{DocError, Document, DocumentService, FsStorage};
use crate::pdf::{DiskPdfStorage, PdfService};
use tauri::State;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

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

fn text(path: &std::path::Path) -> String {
    path.to_string_lossy().into_owned()
}

// ---------- documents ----------

#[tauri::command]
pub fn open_document(
    path: String,
    state: State<'_, AppState>,
    access: State<'_, Access>,
) -> Result<Document, String> {
    let allowed = access.file(&path)?;
    state
        .documents
        .open(&text(&allowed))
        .map_err(|e: DocError| e.to_string())
}

#[tauri::command]
pub fn save_document(
    path: String,
    content: String,
    state: State<'_, AppState>,
    access: State<'_, Access>,
) -> Result<String, String> {
    let allowed = access.file(&path)?;
    state
        .documents
        .save(&text(&allowed), &content)
        .map_err(|e: DocError| e.to_string())
}

#[tauri::command]
pub fn probe_document(path: String, access: State<'_, Access>) -> crate::disk_probe::DiskProbe {
    match access.file(&path) {
        Ok(allowed) => crate::disk_probe::probe(&text(&allowed)),
        Err(_) => crate::disk_probe::DiskProbe::Unreadable,
    }
}

#[tauri::command]
pub fn guarded_save_document(
    path: String,
    content: String,
    expected: Option<String>,
    access: State<'_, Access>,
) -> Result<String, String> {
    let allowed = access.file(&path)?;
    crate::conflict::guarded_save(&text(&allowed), &content, expected.as_deref())
}

#[tauri::command]
pub fn export_pdf(
    path: String,
    bytes: Vec<u8>,
    state: State<'_, AppState>,
    access: State<'_, Access>,
) -> Result<String, String> {
    let allowed = access.file(&path)?;
    state.pdf.export(&text(&allowed), &bytes)
}

/// Saves a finished export in any supported format (`kind` is "pdf", "docx" or "md").
#[tauri::command]
pub fn export_document(
    path: String,
    bytes: Vec<u8>,
    kind: String,
    access: State<'_, Access>,
) -> Result<String, String> {
    let allowed = access.file(&path)?;
    crate::export::export_document(&text(&allowed), &bytes, &kind)
}

// ---------- inside a Library ----------

#[tauri::command]
pub fn open_workspace_file(
    root: String,
    path: String,
    access: State<'_, Access>,
) -> Result<Document, String> {
    let allowed = access.library_dir(&root)?;
    crate::workspace::open_file(&text(&allowed), &path)
}

#[tauri::command]
pub fn list_workspace(
    root: String,
    directory: Option<String>,
    access: State<'_, Access>,
) -> Result<crate::workspace::Listing, String> {
    let allowed = access.library_dir(&root)?;
    crate::workspace::list_directory(
        &crate::workspace::DiskDirectoryReader,
        &text(&allowed),
        directory.as_deref(),
    )
}

#[tauri::command]
pub fn read_project_order(
    root: String,
    access: State<'_, Access>,
) -> Result<Option<String>, String> {
    crate::project::read(&text(&access.library_dir(&root)?))
}

#[tauri::command]
pub fn write_project_order(
    root: String,
    expected: Option<String>,
    value: String,
    access: State<'_, Access>,
) -> Result<String, String> {
    crate::project::write(
        &text(&access.library_dir(&root)?),
        expected.as_deref(),
        &value,
    )
}

#[tauri::command]
pub fn create_entry(
    root: String,
    parent: Option<String>,
    name: String,
    kind: String,
    access: State<'_, Access>,
) -> Result<String, String> {
    crate::library::create(
        &text(&access.library_root(&root)?),
        parent.as_deref(),
        &name,
        &kind,
    )
}

#[tauri::command]
pub fn rename_entry(
    root: String,
    path: String,
    new_name: String,
    access: State<'_, Access>,
) -> Result<String, String> {
    crate::library::rename(&text(&access.library_root(&root)?), &path, &new_name)
}

#[tauri::command]
pub fn trash_entry(
    root: String,
    path: String,
    position: Option<u32>,
    access: State<'_, Access>,
) -> Result<String, String> {
    crate::library::trash(&text(&access.library_root(&root)?), &path, position)
}

#[tauri::command]
pub fn list_trash(
    root: String,
    access: State<'_, Access>,
) -> Result<Vec<crate::library::TrashItem>, String> {
    crate::library::list_trash(&text(&access.library_root(&root)?))
}

#[tauri::command]
pub fn restore_entry(
    root: String,
    path: String,
    access: State<'_, Access>,
) -> Result<String, String> {
    crate::library::restore(&text(&access.library_root(&root)?), &path)
}

#[tauri::command]
pub fn move_entry(
    root: String,
    path: String,
    to: Option<String>,
    access: State<'_, Access>,
) -> Result<String, String> {
    crate::library::move_into(&text(&access.library_root(&root)?), &path, to.as_deref())
}

// ---------- choosing places (the only way to be granted one) ----------

/// The default Library folder (Documents/A Good Page): created if needed, granted and made current.
#[tauri::command]
pub fn default_library(app: tauri::AppHandle, access: State<'_, Access>) -> Result<String, String> {
    use tauri::Manager;
    let docs = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| format!("Cannot find your Documents folder: {e}"))?;
    let folder = crate::library::ensure_folder(&docs.join("A Good Page"))?;
    Ok(text(&access.grant_library(&folder)?))
}

/// The Library chosen last time, if any (remembered by this program, not by the page).
#[tauri::command]
pub fn current_library(access: State<'_, Access>) -> Option<String> {
    access.current().map(|p| text(&p))
}

/// Switches to a Library used before.
#[tauri::command]
pub fn use_library(path: String, access: State<'_, Access>) -> Result<String, String> {
    Ok(text(&access.set_current(&path)?))
}

/// One-time carry-over from earlier versions, which remembered the Library in the page itself: a native question
/// asks you to confirm the folder before it is trusted. The default folder needs no question.
#[tauri::command]
pub async fn adopt_library(
    app: tauri::AppHandle,
    path: String,
    access: State<'_, Access>,
) -> Result<String, String> {
    use tauri::Manager;
    if access.current().is_some() {
        return Err(crate::access::NOT_GRANTED.into());
    }
    let canonical =
        std::fs::canonicalize(path.trim()).map_err(|e| format!("Cannot open that folder: {e}"))?;
    let default = app
        .path()
        .document_dir()
        .ok()
        .and_then(|d| std::fs::canonicalize(d.join("A Good Page")).ok());
    if default.as_ref() != Some(&canonical) {
        let ok = app
            .dialog()
            .message(format!(
                "Keep using this folder as your Library?\n\n{}",
                canonical.display()
            ))
            .title("A Good Page")
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Keep using it".into(),
                "Choose another".into(),
            ))
            .blocking_show();
        if !ok {
            return Err("You chose not to keep that folder.".into());
        }
    }
    Ok(text(&access.grant_library(&text(&canonical))?))
}

/// Opens a native "Open" dialog. `kind` is "writing" (md, markdown, txt) or "zip". The chosen file is granted.
#[tauri::command]
pub async fn pick_open_file(
    app: tauri::AppHandle,
    kind: String,
    access: State<'_, Access>,
) -> Result<Option<String>, String> {
    let dialog = app.dialog().file();
    let dialog = if kind == "zip" {
        dialog.add_filter("Backup", &["zip"])
    } else if kind == "docx" {
        dialog.add_filter("Word document", &["docx"])
    } else {
        dialog.add_filter("Writing", &["md", "markdown", "txt"])
    };
    let Some(picked) = dialog.blocking_pick_file() else {
        return Ok(None);
    };
    let path = text(&picked.into_path().map_err(|e| e.to_string())?);
    access.grant_file(&path, kind == "writing")?;
    Ok(Some(path))
}

/// Opens a native "Save" dialog. `kind` is "writing", "pdf", "docx" or "md". The chosen file is granted:
/// a document stays granted across launches, an export only until the app closes.
#[tauri::command]
pub async fn pick_save_file(
    app: tauri::AppHandle,
    suggested: String,
    kind: String,
    access: State<'_, Access>,
) -> Result<Option<String>, String> {
    let (label, extensions): (&str, &[&str]) = match kind.as_str() {
        "pdf" => ("PDF", &["pdf"]),
        "docx" => ("Word document", &["docx"]),
        "epub" => ("E-book", &["epub"]),
        "md" => ("Markdown", &["md"]),
        _ => ("Writing", &["md", "txt"]),
    };
    let Some(picked) = app
        .dialog()
        .file()
        .set_file_name(suggested)
        .add_filter(label, extensions)
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = text(&picked.into_path().map_err(|e| e.to_string())?);
    access.grant_file(&path, kind == "writing")?;
    Ok(Some(path))
}

/// Opens a native folder dialog. `purpose` is "library" (becomes your Library) or "backup" (a backup folder).
#[tauri::command]
pub async fn pick_folder(
    app: tauri::AppHandle,
    purpose: String,
    access: State<'_, Access>,
) -> Result<Option<String>, String> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = text(&picked.into_path().map_err(|e| e.to_string())?);
    let granted = if purpose == "backup" {
        access.grant_dir(&path)?
    } else {
        access.grant_library(&path)?
    };
    Ok(Some(text(&granted)))
}

// ---------- import ----------

/// The parts of a picked or dropped Word file, ready to be turned into pages. Nothing is changed on disk.
#[tauri::command]
pub fn read_docx_file(
    path: String,
    access: State<'_, Access>,
) -> Result<crate::import::DocxParts, String> {
    crate::import::read_docx(&access.file(&path)?)
}

/// Asks for a folder of .md / .txt pages and copies them into a new project in the Library.
/// The folder is only read, and is not remembered. Returns the new project, or None if cancelled.
#[tauri::command]
pub async fn import_folder(
    app: tauri::AppHandle,
    root: String,
    access: State<'_, Access>,
) -> Result<Option<String>, String> {
    let root = text(&access.library_root(&root)?);
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let source = picked.into_path().map_err(|e| e.to_string())?;
    crate::import::import_folder(&root, &source).map(Some)
}

// ---------- backups ----------

#[tauri::command]
pub fn create_backup(
    root: String,
    dest: String,
    stamp: String,
    keep: u32,
    access: State<'_, Access>,
) -> Result<crate::backup::BackupSummary, String> {
    let library = access.library_root(&root)?;
    let folder = access.granted_dir(&dest)?;
    crate::backup::create_backup(&text(&library), &text(&folder), &stamp, keep)
}

#[tauri::command]
pub fn restore_backup(
    root: String,
    zip: String,
    access: State<'_, Access>,
) -> Result<crate::backup::RestoreSummary, String> {
    let library = access.library_root(&root)?;
    let file = access.file(&zip)?;
    crate::backup::restore_backup(&text(&library), &text(&file))
}

/// The suggested backup folder, a sibling of the Library: created and granted here, by the program.
#[tauri::command]
pub fn default_backup_dir(root: String, access: State<'_, Access>) -> Result<String, String> {
    let library = access.library_root(&root)?;
    let name = library
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Library".into());
    let parent = library
        .parent()
        .ok_or("The Library has no parent folder.")?;
    let folder = crate::library::ensure_folder(&parent.join(format!("{name} backups")))?;
    Ok(text(&access.grant_dir(&folder)?))
}
