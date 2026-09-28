//! Small project order file in the selected workspace. Chapter files are never moved.
use serde_json::Value;
use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
const NAME: &str = ".a-good-page.json";
const LIMIT: usize = 32_768;
static LOCK: Mutex<()> = Mutex::new(());
static SEQUENCE: AtomicU64 = AtomicU64::new(0);
fn target(root: &str) -> Result<PathBuf, String> {
    let base = fs::canonicalize(root).map_err(|e| format!("Cannot open project folder: {e}"))?;
    if !base.is_dir() {
        return Err("Choose a project folder.".into());
    }
    let path = base.join(NAME);
    if fs::symlink_metadata(&path)
        .map(|v| v.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("A linked project order file cannot be used.".into());
    }
    Ok(path)
}
fn contents(path: &Path) -> Result<Option<String>, String> {
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > LIMIT as u64 {
            return Err("Project order is too large.".into());
        }
    }
    match fs::read(path) {
        Ok(bytes) if bytes.len() <= LIMIT => String::from_utf8(bytes)
            .map(Some)
            .map_err(|_| "Project order is not UTF-8.".into()),
        Ok(_) => Err("Project order is too large.".into()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Cannot read project order: {e}")),
    }
}
fn validate(raw: &str) -> Result<(), String> {
    let value: Value = serde_json::from_str(raw).map_err(|_| "Invalid project order JSON")?;
    let arr = value
        .get("chapters")
        .and_then(Value::as_array)
        .ok_or("Missing chapters in project order")?;
    if value.get("version").and_then(Value::as_u64) != Some(1) || arr.len() > 200 {
        return Err("Unsupported project order version or chapter count.".into());
    }
    let mut seen = std::collections::HashSet::new();
    for item in arr {
        let name = item.as_str().ok_or("Invalid chapter path")?;
        if name.is_empty()
            || name.len() > 512
            || name.starts_with('/')
            || name.contains(char::from(92u8))
            || name.chars().any(char::is_control)
            || !name
                .split('/')
                .all(|s| !s.is_empty() && s != "." && s != "..")
            || !["md", "markdown", "txt"].contains(
                &name
                    .rsplit('.')
                    .next()
                    .unwrap_or("")
                    .to_lowercase()
                    .as_str(),
            )
            || !seen.insert(name)
        {
            return Err("Invalid or repeated chapter path.".into());
        }
    }
    Ok(())
}
pub fn read(root: &str) -> Result<Option<String>, String> {
    let path = target(root)?;
    let raw = contents(&path)?;
    if let Some(value) = &raw {
        validate(value)?;
    }
    Ok(raw)
}
pub fn write(root: &str, expected: Option<&str>, value: &str) -> Result<String, String> {
    if value.len() > LIMIT {
        return Err("Project order is too large.".into());
    }
    validate(value)?;
    let _guard = LOCK
        .lock()
        .map_err(|_| "Project order writer is unavailable")?;
    let path = target(root)?;
    if contents(&path)?.as_deref() != expected {
        return Err("AGP_PROJECT_CHANGED".into());
    }
    if expected.is_none() {
        let temp = path.with_file_name(format!(
            "{NAME}.tmp-{}-{}",
            std::process::id(),
            SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        let result = (|| -> io::Result<()> {
            use io::Write;
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)?;
            file.write_all(value.as_bytes())?;
            file.sync_all()?;
            drop(file);
            fs::hard_link(&temp, &path)
        })();
        let _ = fs::remove_file(&temp);
        result.map_err(|e| {
            if e.kind() == io::ErrorKind::AlreadyExists {
                "AGP_PROJECT_CHANGED".into()
            } else {
                e.to_string()
            }
        })?;
    } else {
        crate::document::write_atomic_bytes(&path, value.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(value.to_owned())
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    fn temp() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "agp-project-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&p).unwrap();
        fs::canonicalize(p).unwrap()
    }
    #[test]
    fn guarded_order_does_not_overwrite_outside_changes() {
        let dir = temp();
        let root = dir.to_str().unwrap();
        let a = r#"{"version":1,"chapters":["one.md"]}"#;
        let b = r#"{"version":1,"chapters":["two.md"]}"#;
        assert_eq!(read(root).unwrap(), None);
        write(root, None, a).unwrap();
        assert!(write(root, None, b).is_err());
        assert!(write(root, Some(b), b).is_err());
        write(root, Some(a), b).unwrap();
        assert_eq!(read(root).unwrap().as_deref(), Some(b));
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn does_not_read_linked_manifest() {
        use std::os::unix::fs::symlink;
        let dir = temp();
        let outside = dir.join("outside.json");
        fs::write(&outside, r#"{"version":1,"chapters":[]}"#).unwrap();
        symlink(&outside, dir.join(NAME)).unwrap();
        assert!(read(dir.to_str().unwrap()).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn rejects_traversal_and_duplicate_paths() {
        for raw in [
            r#"{"version":1,"chapters":["../x.md"]}"#,
            r#"{"version":1,"chapters":["a.md","a.md"]}"#,
        ] {
            assert!(validate(raw).is_err());
        }
    }
}
