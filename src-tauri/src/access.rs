//! What the app may touch. The web page cannot be trusted with raw paths, so Rust keeps a list of the places
//! you chose (your Library folders, backup folders, files you opened or saved) and refuses everything else.
//! Every check works on canonical paths, so `..` and symlinks cannot lead out of a granted place.
use crate::document::write_atomic_bytes;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};

/// The message the page recognises when something it asked for was never granted.
pub const NOT_GRANTED: &str = "That place was not chosen in A Good Page, so it cannot be used.";
const MAX_LIBRARIES: usize = 8;
const MAX_FILES: usize = 100;

#[derive(Default, Serialize, Deserialize)]
struct Saved {
    current: Option<String>,
    libraries: Vec<String>,
    #[serde(default)]
    dirs: Vec<String>,
    files: Vec<String>,
}

#[derive(Default)]
struct Inner {
    current: Option<PathBuf>,
    libraries: Vec<PathBuf>,
    dirs: Vec<PathBuf>,
    files: Vec<PathBuf>,
    session_files: Vec<PathBuf>,
}

pub struct Access {
    inner: Mutex<Inner>,
    store: Option<PathBuf>,
}

fn canonical_dir(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("No folder was chosen.".into());
    }
    let canonical =
        fs::canonicalize(trimmed).map_err(|e| format!("Cannot open that folder: {e}"))?;
    if canonical.is_dir() {
        Ok(canonical)
    } else {
        Err("That is not a folder.".into())
    }
}

/// An existing path, or the future path of a file in an existing folder (for saving a new file).
fn canonical_target(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("No file was chosen.".into());
    }
    let p = Path::new(trimmed);
    if let Ok(existing) = fs::canonicalize(p) {
        return Ok(existing);
    }
    let name = p.file_name().ok_or("That is not a file name.")?;
    if p.components().any(|c| matches!(c, Component::ParentDir))
        || Path::new(name).components().count() != 1
    {
        return Err(NOT_GRANTED.into());
    }
    let parent = p
        .parent()
        .filter(|x| !x.as_os_str().is_empty())
        .ok_or("Use a full path.")?;
    Ok(fs::canonicalize(parent)
        .map_err(|e| format!("Cannot open that folder: {e}"))?
        .join(name))
}

impl Access {
    pub fn new(store: Option<PathBuf>) -> Self {
        let mut inner = Inner::default();
        if let Some(saved) = store
            .as_ref()
            .and_then(|p| fs::read(p).ok())
            .and_then(|bytes| serde_json::from_slice::<Saved>(&bytes).ok())
        {
            inner.libraries = saved
                .libraries
                .iter()
                .filter_map(|p| canonical_dir(p).ok())
                .take(MAX_LIBRARIES)
                .collect();
            inner.current = saved
                .current
                .and_then(|p| canonical_dir(&p).ok())
                .filter(|p| inner.libraries.contains(p));
            inner.dirs = saved
                .dirs
                .iter()
                .filter_map(|p| canonical_dir(p).ok())
                .take(MAX_LIBRARIES)
                .collect();
            inner.files = saved
                .files
                .iter()
                .filter_map(|p| canonical_target(p).ok())
                .take(MAX_FILES)
                .collect();
        }
        Self {
            inner: Mutex::new(inner),
            store,
        }
    }

    fn save(&self, inner: &Inner) {
        let Some(path) = &self.store else { return };
        let saved = Saved {
            current: inner
                .current
                .as_ref()
                .and_then(|p| p.to_str())
                .map(str::to_owned),
            libraries: inner
                .libraries
                .iter()
                .filter_map(|p| p.to_str())
                .map(str::to_owned)
                .collect(),
            dirs: inner
                .dirs
                .iter()
                .filter_map(|p| p.to_str())
                .map(str::to_owned)
                .collect(),
            files: inner
                .files
                .iter()
                .filter_map(|p| p.to_str())
                .map(str::to_owned)
                .collect(),
        };
        if let (Some(dir), Ok(bytes)) = (path.parent(), serde_json::to_vec_pretty(&saved)) {
            let _ = fs::create_dir_all(dir);
            let _ = write_atomic_bytes(path, &bytes);
        }
    }

    /// Makes a folder a Library and the current one. Called only after you chose it (or for the default folder).
    pub fn grant_library(&self, path: &str) -> Result<PathBuf, String> {
        let dir = canonical_dir(path)?;
        let mut inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        inner.libraries.retain(|p| p != &dir);
        inner.libraries.insert(0, dir.clone());
        inner.libraries.truncate(MAX_LIBRARIES);
        inner.current = Some(dir.clone());
        self.save(&inner);
        Ok(dir)
    }

    /// A folder you chose for backups. Remembered, so automatic backups keep working after a restart.
    pub fn grant_dir(&self, path: &str) -> Result<PathBuf, String> {
        let dir = canonical_dir(path)?;
        let mut inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        inner.dirs.retain(|p| p != &dir);
        inner.dirs.insert(0, dir.clone());
        inner.dirs.truncate(MAX_LIBRARIES);
        self.save(&inner);
        Ok(dir)
    }

    /// A file you chose. `remember` keeps it across launches (a document you opened), otherwise it lasts until the app closes.
    pub fn grant_file(&self, path: &str, remember: bool) -> Result<PathBuf, String> {
        let file = canonical_target(path)?;
        let mut inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        if remember {
            inner.files.retain(|p| p != &file);
            inner.files.insert(0, file.clone());
            inner.files.truncate(MAX_FILES);
            self.save(&inner);
        } else if !inner.session_files.contains(&file) {
            inner.session_files.push(file.clone());
        }
        Ok(file)
    }

    pub fn current(&self) -> Option<PathBuf> {
        self.inner.lock().ok().and_then(|i| i.current.clone())
    }

    /// Switches to a Library you used before.
    pub fn set_current(&self, path: &str) -> Result<PathBuf, String> {
        let dir = canonical_dir(path)?;
        let mut inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        if !inner.libraries.contains(&dir) {
            return Err(NOT_GRANTED.into());
        }
        inner.current = Some(dir.clone());
        self.save(&inner);
        Ok(dir)
    }

    #[cfg(test)]
    pub fn libraries(&self) -> Vec<String> {
        self.inner
            .lock()
            .map(|i| {
                i.libraries
                    .iter()
                    .filter_map(|p| p.to_str())
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default()
    }

    /// A folder inside one of your Libraries (or a Library itself): where pages and projects live.
    pub fn library_dir(&self, path: &str) -> Result<PathBuf, String> {
        let dir = canonical_dir(path).map_err(|_| NOT_GRANTED.to_string())?;
        let inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        if inner.libraries.iter().any(|lib| dir.starts_with(lib)) {
            Ok(dir)
        } else {
            Err(NOT_GRANTED.into())
        }
    }

    /// A Library folder itself (not just somewhere inside one).
    pub fn library_root(&self, path: &str) -> Result<PathBuf, String> {
        let dir = canonical_dir(path).map_err(|_| NOT_GRANTED.to_string())?;
        let inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        if inner.libraries.contains(&dir) {
            Ok(dir)
        } else {
            Err(NOT_GRANTED.into())
        }
    }

    /// A folder you chose for backups or exports.
    pub fn granted_dir(&self, path: &str) -> Result<PathBuf, String> {
        let dir = canonical_dir(path).map_err(|_| NOT_GRANTED.to_string())?;
        let inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        if inner.dirs.contains(&dir) {
            Ok(dir)
        } else {
            Err(NOT_GRANTED.into())
        }
    }

    /// A file inside a Library, or one you chose.
    pub fn file(&self, path: &str) -> Result<PathBuf, String> {
        let target = canonical_target(path)?;
        let inner = self.inner.lock().map_err(|_| "Access is locked.")?;
        let inside = inner.libraries.iter().any(|lib| target.starts_with(lib));
        if inside || inner.files.contains(&target) || inner.session_files.contains(&target) {
            Ok(target)
        } else {
            Err(NOT_GRANTED.into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static N: AtomicUsize = AtomicUsize::new(0);
        let p = std::env::temp_dir().join(format!(
            "agp-access-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&p).unwrap();
        fs::canonicalize(p).unwrap()
    }
    fn s(p: &Path) -> &str {
        p.to_str().unwrap()
    }

    #[test]
    fn nothing_is_allowed_until_you_choose_it() {
        let a = Access::new(None);
        let dir = temp();
        fs::write(dir.join("a.md"), "x").unwrap();
        assert_eq!(a.file(s(&dir.join("a.md"))).unwrap_err(), NOT_GRANTED);
        assert_eq!(a.library_dir(s(&dir)).unwrap_err(), NOT_GRANTED);
        assert_eq!(a.library_root(s(&dir)).unwrap_err(), NOT_GRANTED);
        assert!(a.current().is_none());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_library_allows_itself_and_what_is_inside_and_nothing_else() {
        let a = Access::new(None);
        let lib = temp();
        let outside = temp();
        fs::create_dir_all(lib.join("Novel")).unwrap();
        fs::write(lib.join("Novel/01.md"), "x").unwrap();
        fs::write(outside.join("secret.md"), "s").unwrap();
        a.grant_library(s(&lib)).unwrap();
        assert!(a.library_root(s(&lib)).is_ok());
        assert!(a.library_dir(s(&lib.join("Novel"))).is_ok());
        assert!(a.library_root(s(&lib.join("Novel"))).is_err());
        assert!(a.file(s(&lib.join("Novel/01.md"))).is_ok());
        assert!(
            a.file(s(&lib.join("Novel/new-page.md"))).is_ok(),
            "a new file in the Library"
        );
        assert!(a.file(s(&outside.join("secret.md"))).is_err());
        assert!(a.library_dir(s(&outside)).is_err());
        fs::remove_dir_all(lib).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn dot_dot_and_symlinks_cannot_lead_out() {
        let a = Access::new(None);
        let lib = temp();
        let outside = temp();
        fs::write(outside.join("secret.md"), "s").unwrap();
        a.grant_library(s(&lib)).unwrap();
        let sneaky = format!(
            "{}/../{}/secret.md",
            s(&lib),
            outside.file_name().unwrap().to_str().unwrap()
        );
        assert!(a.file(&sneaky).is_err());
        assert!(a.file(&format!("{}/../new.md", s(&lib))).is_err());
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            symlink(&outside, lib.join("door")).unwrap();
            symlink(outside.join("secret.md"), lib.join("alias.md")).unwrap();
            assert!(a.file(s(&lib.join("alias.md"))).is_err());
            assert!(a.file(s(&lib.join("door/secret.md"))).is_err());
            assert!(a.library_dir(s(&lib.join("door"))).is_err());
        }
        fs::remove_dir_all(lib).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn a_chosen_file_is_allowed_alone_and_a_sibling_is_not() {
        let a = Access::new(None);
        let dir = temp();
        fs::write(dir.join("chosen.md"), "x").unwrap();
        fs::write(dir.join("other.md"), "y").unwrap();
        a.grant_file(s(&dir.join("chosen.md")), false).unwrap();
        assert!(a.file(s(&dir.join("chosen.md"))).is_ok());
        assert!(a.file(s(&dir.join("other.md"))).is_err());
        a.grant_file(s(&dir.join("export.pdf")), false).unwrap();
        assert!(
            a.file(s(&dir.join("export.pdf"))).is_ok(),
            "a save target that does not exist yet"
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn backup_folders_are_separate_from_libraries() {
        let a = Access::new(None);
        let lib = temp();
        let backups = temp();
        a.grant_library(s(&lib)).unwrap();
        assert!(a.granted_dir(s(&backups)).is_err());
        a.grant_dir(s(&backups)).unwrap();
        assert!(a.granted_dir(s(&backups)).is_ok());
        assert!(
            a.library_dir(s(&backups)).is_err(),
            "a backup folder is not a Library"
        );
        assert!(a.file(s(&backups.join("x.md"))).is_err());
        fs::remove_dir_all(lib).unwrap();
        fs::remove_dir_all(backups).unwrap();
    }

    #[test]
    fn libraries_and_remembered_files_survive_a_restart_but_session_grants_do_not() {
        let dir = temp();
        let store = dir.join("config/access.json");
        let lib = temp();
        let other = temp();
        fs::write(other.join("doc.md"), "x").unwrap();
        fs::write(other.join("temp.pdf"), "x").unwrap();
        {
            let a = Access::new(Some(store.clone()));
            a.grant_library(s(&lib)).unwrap();
            a.grant_file(s(&other.join("doc.md")), true).unwrap();
            a.grant_file(s(&other.join("temp.pdf")), false).unwrap();
        }
        let b = Access::new(Some(store));
        assert_eq!(b.current().unwrap(), lib);
        assert!(b.library_root(s(&lib)).is_ok());
        assert!(b.file(s(&other.join("doc.md"))).is_ok());
        assert!(b.file(s(&other.join("temp.pdf"))).is_err());
        let backups = temp();
        Access::new(Some(dir.join("config/access.json")))
            .grant_dir(s(&backups))
            .unwrap();
        assert!(Access::new(Some(dir.join("config/access.json")))
            .granted_dir(s(&backups))
            .is_ok());
        fs::remove_dir_all(backups).unwrap();
        fs::remove_dir_all(dir).unwrap();
        fs::remove_dir_all(lib).unwrap();
        fs::remove_dir_all(other).unwrap();
    }

    #[test]
    fn switching_between_libraries_needs_one_you_chose_before_and_damaged_storage_is_ignored() {
        let dir = temp();
        let store = dir.join("access.json");
        let one = temp();
        let two = temp();
        let a = Access::new(Some(store.clone()));
        a.grant_library(s(&one)).unwrap();
        a.grant_library(s(&two)).unwrap();
        assert_eq!(a.current().unwrap(), two);
        a.set_current(s(&one)).unwrap();
        assert_eq!(a.current().unwrap(), one);
        assert!(a.set_current(s(&temp())).is_err());
        assert_eq!(a.libraries().len(), 2);
        fs::write(&store, b"{broken").unwrap();
        assert!(Access::new(Some(store)).current().is_none());
        fs::remove_dir_all(dir).unwrap();
        fs::remove_dir_all(one).unwrap();
        fs::remove_dir_all(two).unwrap();
    }
}
