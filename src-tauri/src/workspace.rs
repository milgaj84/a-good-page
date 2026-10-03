//! Bounded, on-demand browsing for writer-selected working directories.
use serde::Serialize;
use std::{
    fs, io,
    path::{Path, PathBuf},
};
const MAX_FOLDER_ENTRIES: usize = 2000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Listing {
    pub root: String,
    pub directory: String,
    pub entries: Vec<Entry>,
}

pub trait DirectoryReader {
    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf>;
    fn read_dir(&self, path: &Path) -> io::Result<Vec<PathBuf>>;
    fn is_directory(&self, path: &Path) -> bool;
    fn is_symlink(&self, path: &Path) -> bool;
}
pub struct DiskDirectoryReader;
impl DirectoryReader for DiskDirectoryReader {
    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf> {
        fs::canonicalize(path)
    }
    fn read_dir(&self, path: &Path) -> io::Result<Vec<PathBuf>> {
        let mut entries = Vec::new();
        for entry in fs::read_dir(path)? {
            let path = entry?.path();
            // Only what the listing would show counts toward the limit (a folder of images is fine).
            if !path.is_dir() && !writing_file(&path) {
                continue;
            }
            if entries.len() >= MAX_FOLDER_ENTRIES {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "Folder has too many items to display.",
                ));
            }
            entries.push(path);
        }
        Ok(entries)
    }
    fn is_directory(&self, path: &Path) -> bool {
        path.is_dir()
    }
    fn is_symlink(&self, path: &Path) -> bool {
        fs::symlink_metadata(path)
            .map(|meta| meta.file_type().is_symlink())
            .unwrap_or(true)
    }
}

pub fn list_directory<R: DirectoryReader>(
    reader: &R,
    root: &str,
    directory: Option<&str>,
) -> Result<Listing, String> {
    if root.trim().is_empty() {
        return Err("Choose a working directory.".into());
    }
    let root = reader
        .canonicalize(Path::new(root))
        .map_err(|e| format!("Cannot open working directory: {e}"))?;
    if !reader.is_directory(&root) {
        return Err("The selected path is not a directory.".into());
    }
    let requested = directory
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| root.clone());
    let current = reader
        .canonicalize(&requested)
        .map_err(|e| format!("Cannot open folder: {e}"))?;
    if !current.starts_with(&root) {
        return Err("That folder is outside the working directory.".into());
    }
    if directory.is_some() && requested != current {
        return Err("Symlinked folders cannot be browsed.".into());
    }
    if !reader.is_directory(&current) {
        return Err("The selected path is not a folder.".into());
    }
    let mut entries = Vec::new();
    for path in reader
        .read_dir(&current)
        .map_err(|e| format!("Cannot list folder: {e}"))?
    {
        if reader.is_symlink(&path) {
            continue;
        }
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(full_path) = path.to_str() else {
            continue;
        };
        // Hidden items (the Library trash, dot-folders) are never listed or scanned for chapters.
        if name.is_empty() || name.starts_with('.') {
            continue;
        }
        let is_dir = reader.is_directory(&path);
        if !is_dir && !writing_file(&path) {
            continue;
        }
        entries.push(Entry {
            name: name.to_owned(),
            path: full_path.to_owned(),
            is_dir,
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(Listing {
        root: root
            .to_str()
            .ok_or("The folder path is not UTF-8")?
            .to_owned(),
        directory: current
            .to_str()
            .ok_or("The folder path is not UTF-8")?
            .to_owned(),
        entries,
    })
}

/// Recheck the selected path at open time; never trust a path returned by a listing.
pub fn open_file(root: &str, selected: &str) -> Result<crate::document::Document, String> {
    let base = fs::canonicalize(root).map_err(|e| format!("Cannot open working directory: {e}"))?;
    if !base.is_dir() {
        return Err("Working directory is no longer available.".into());
    }
    let candidate = Path::new(selected);
    if !candidate.is_absolute() {
        return Err("Choose a file inside the working directory.".into());
    }
    let canonical = fs::canonicalize(candidate).map_err(|e| format!("Cannot open file: {e}"))?;
    if !canonical.starts_with(&base) || !writing_file(&canonical) || !canonical.is_file() {
        return Err("That writing file is outside the working directory or unavailable.".into());
    }
    // Every component below the root must remain a real directory/file, not a symlink.
    let mut walk = base.clone();
    for component in canonical
        .strip_prefix(&base)
        .map_err(|_| "Invalid file path")?
        .components()
    {
        walk.push(component);
        if fs::symlink_metadata(&walk)
            .map_err(|e| format!("Cannot check file: {e}"))?
            .file_type()
            .is_symlink()
        {
            return Err("Symlinked files and folders are not opened from a workspace.".into());
        }
    }
    // Reject a selected alias even if it canonicalizes inside the root.
    if candidate != canonical {
        return Err("Choose a file directly inside the workspace.".into());
    }
    let path = canonical.to_str().ok_or("The file path is not UTF-8")?;
    crate::document::DocumentService::new(crate::document::FsStorage)
        .open(path)
        .map_err(|e| e.to_string())
}

/// Single source of truth for writing-file extensions lives in document::SUPPORTED_EXTENSIONS.
fn writing_file(path: &Path) -> bool {
    crate::document::is_supported(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "hearth-workspace-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&p).unwrap();
        fs::canonicalize(p).unwrap()
    }

    #[test]
    fn lists_subfolders_first_and_only_writing_files() {
        let root = temp();
        fs::create_dir(root.join("Chapters")).unwrap();
        fs::write(root.join("z.MD"), "z").unwrap();
        fs::write(root.join("a.txt"), "a").unwrap();
        fs::write(root.join("cover.png"), "x").unwrap();
        let listing = list_directory(&DiskDirectoryReader, root.to_str().unwrap(), None).unwrap();
        assert_eq!(
            listing
                .entries
                .iter()
                .map(|e| e.name.as_str())
                .collect::<Vec<_>>(),
            vec!["Chapters", "a.txt", "z.MD"]
        );
        assert!(list_directory(
            &DiskDirectoryReader,
            root.to_str().unwrap(),
            Some(root.join("Chapters").to_str().unwrap())
        )
        .unwrap()
        .entries
        .is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn hides_dot_items_such_as_the_trash() {
        let root = temp();
        fs::create_dir(root.join(".trash")).unwrap();
        fs::write(root.join(".hidden.md"), "x").unwrap();
        fs::write(root.join("shown.md"), "x").unwrap();
        let listing = list_directory(&DiskDirectoryReader, root.to_str().unwrap(), None).unwrap();
        assert_eq!(listing.entries.len(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_parent_traversal_and_nonfolders() {
        let root = temp();
        let child = root.join("story.md");
        fs::write(&child, "x").unwrap();
        assert!(list_directory(
            &DiskDirectoryReader,
            root.to_str().unwrap(),
            Some(root.parent().unwrap().to_str().unwrap())
        )
        .is_err());
        assert!(list_directory(
            &DiskDirectoryReader,
            root.to_str().unwrap(),
            Some(child.to_str().unwrap())
        )
        .is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinked_directories_and_files() {
        use std::os::unix::fs::symlink;
        let root = temp();
        let external = temp();
        fs::write(external.join("outside.md"), "x").unwrap();
        symlink(&external, root.join("shortcut")).unwrap();
        symlink(external.join("outside.md"), root.join("alias.md")).unwrap();
        assert!(
            list_directory(&DiskDirectoryReader, root.to_str().unwrap(), None)
                .unwrap()
                .entries
                .is_empty()
        );
        assert!(list_directory(
            &DiskDirectoryReader,
            root.to_str().unwrap(),
            Some(root.join("shortcut").to_str().unwrap())
        )
        .is_err());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(external).unwrap();
    }

    #[test]
    fn workspace_open_rejects_outside_and_non_writing_files() {
        let root = temp();
        let external = temp();
        fs::write(root.join("inside.md"), "Hello").unwrap();
        fs::write(root.join("picture.png"), "not writing").unwrap();
        fs::write(external.join("outside.md"), "No").unwrap();
        assert_eq!(
            open_file(
                root.to_str().unwrap(),
                root.join("inside.md").to_str().unwrap()
            )
            .unwrap()
            .content,
            "Hello"
        );
        assert!(open_file(
            root.to_str().unwrap(),
            external.join("outside.md").to_str().unwrap()
        )
        .is_err());
        assert!(open_file(
            root.to_str().unwrap(),
            root.join("picture.png").to_str().unwrap()
        )
        .is_err());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(external).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn workspace_open_rejects_symlink_even_if_target_is_inside() {
        use std::os::unix::fs::symlink;
        let root = temp();
        fs::write(root.join("chapter.md"), "a").unwrap();
        let alias = root.join("alias.md");
        symlink(root.join("chapter.md"), &alias).unwrap();
        assert!(open_file(root.to_str().unwrap(), alias.to_str().unwrap()).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn limits_giant_directories_instead_of_silently_truncating() {
        let root = temp();
        for index in 0..=MAX_FOLDER_ENTRIES {
            fs::write(root.join(format!("file-{index}.md")), "a").unwrap();
        }
        assert!(
            list_directory(&DiskDirectoryReader, root.to_str().unwrap(), None)
                .unwrap_err()
                .contains("too many items")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_that_are_not_writing_do_not_count_toward_the_limit() {
        let root = temp();
        for index in 0..=MAX_FOLDER_ENTRIES {
            fs::write(root.join(format!("pic-{index}.png")), "a").unwrap();
        }
        fs::write(root.join("page.md"), "a").unwrap();
        let listing = list_directory(&DiskDirectoryReader, root.to_str().unwrap(), None).unwrap();
        assert_eq!(listing.entries.len(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn empty_and_missing_roots_fail_readably() {
        assert!(list_directory(&DiskDirectoryReader, "", None).is_err());
        assert!(list_directory(&DiskDirectoryReader, "/absent/hearth/folder", None).is_err());
    }
}
