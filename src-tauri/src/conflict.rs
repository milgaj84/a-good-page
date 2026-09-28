//! Protect a named manuscript against outside edits before an autosave or explicit save.
use crate::document::{
    ensure_markdown_path, normalize_text, DocumentService, FsStorage, MAX_DOCUMENT_BYTES,
};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const CHANGED: &str = "AGP_FILE_CHANGED";
static WRITE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
static NEW_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn disk_text(path: &Path) -> Result<Option<String>, String> {
    match fs::read(path) {
        Ok(bytes) => String::from_utf8(bytes)
            .map(|text| Some(normalize_text(&text)))
            .map_err(|_| "File on disk is not UTF-8; it was not overwritten.".into()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not check the file before saving: {error}")),
    }
}

/// The last known contents are compared, not timestamps, which may have coarse precision.
/// The process lock serializes this app's writes; unrelated programs cannot be locked by us.
pub fn guarded_save(path: &str, content: &str, expected: Option<&str>) -> Result<String, String> {
    let target: PathBuf =
        ensure_markdown_path(PathBuf::from(path.trim())).map_err(|error| error.to_string())?;
    if path.trim().is_empty() {
        return Err("No file was chosen.".into());
    }
    if content.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("This document is too large to save.".into());
    }
    let _lock = WRITE_LOCK
        .lock()
        .map_err(|_| "Could not lock the document writer")?;
    let actual = disk_text(&target)?;
    match (expected, actual.as_deref()) {
        (Some(before), Some(now)) if before == now => {}
        (None, None) => return create_new(&target, content),
        _ => return Err(CHANGED.into()),
    }
    DocumentService::new(FsStorage)
        .save(target.to_string_lossy().as_ref(), content)
        .map_err(|error| error.to_string())
}

fn create_new(path: &Path, content: &str) -> Result<String, String> {
    let mut name = path
        .file_name()
        .ok_or("No file name was chosen")?
        .to_os_string();
    name.push(format!(
        ".agp-new-{}-{}",
        std::process::id(),
        NEW_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ));
    let temp = path.with_file_name(name);
    let written = (|| -> io::Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
        drop(file);
        // A hard link publishes the fully written file only if the destination does not exist.
        fs::hard_link(&temp, path)
    })();
    let _ = fs::remove_file(&temp);
    written.map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            CHANGED.to_owned()
        } else {
            format!("Could not create the file: {error}")
        }
    })?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);
    fn temp() -> PathBuf {
        let count = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "agp-conflict-{}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            count
        ));
        fs::create_dir_all(&dir).unwrap();
        fs::canonicalize(dir).unwrap()
    }
    #[test]
    fn outside_change_and_missing_file_never_get_overwritten() {
        let dir = temp();
        let path = dir.join("story_outside.md");
        let name = path.to_str().unwrap();
        guarded_save(name, "original", None).unwrap();
        fs::write(&path, "outside").unwrap();
        assert_eq!(
            guarded_save(name, "mine", Some("original")),
            Err(CHANGED.into())
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), "outside");
        fs::remove_file(&path).unwrap();
        assert_eq!(
            guarded_save(name, "mine", Some("original")),
            Err(CHANGED.into())
        );
        assert!(!path.exists());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn new_file_does_not_replace_existing_and_matching_save_succeeds() {
        let dir = temp();
        let path = dir.join("story_new.md");
        let name = path.to_str().unwrap();
        guarded_save(name, "old", None).unwrap();
        assert_eq!(guarded_save(name, "new", None), Err(CHANGED.into()));
        assert_eq!(guarded_save(name, "new", Some("old")).unwrap(), name);
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1);
        assert!(guarded_save(
            name,
            &"x".repeat(MAX_DOCUMENT_BYTES as usize + 1),
            Some("new")
        )
        .is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
