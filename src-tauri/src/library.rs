//! The writer's Library: create, rename and remove pages and books inside one chosen folder.
//! Every path is checked against the canonical Library root; nothing outside it is touched,
//! symlinks are refused, and removal moves items into a hidden `.trash` folder instead of deleting.
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const TRASH: &str = ".trash";
const ORIGIN: &str = "origin.txt";
const MAX_NAME: usize = 80;

/// Turns a title into a safe single path segment. Never empty.
pub fn clean_name(raw: &str) -> String {
    let mut out: String = raw
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    out = out.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = out.trim_matches(|c: char| c == '.' || c == ' ' || c == '-');
    let limited: String = trimmed.chars().take(MAX_NAME).collect();
    let limited = limited.trim_end().to_owned();
    if limited.is_empty() {
        "Untitled".into()
    } else {
        limited
    }
}

fn has_writing_extension(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "md" | "markdown" | "txt"))
        .unwrap_or(false)
}

fn split_extension(name: &str) -> (String, String) {
    if has_writing_extension(name) {
        let p = Path::new(name);
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or(name);
        let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("md");
        (stem.to_owned(), format!(".{ext}"))
    } else {
        (name.to_owned(), ".md".into())
    }
}

fn canonical_root(root: &str) -> Result<PathBuf, String> {
    if root.trim().is_empty() {
        return Err("Choose your Library folder first.".into());
    }
    let base = fs::canonicalize(root).map_err(|e| format!("Cannot open the Library: {e}"))?;
    if !base.is_dir() {
        return Err("The Library is not a folder.".into());
    }
    Ok(base)
}

/// A directory inside the Library (or the Library itself), reached without symlinks.
fn inside_dir(base: &Path, requested: Option<&str>) -> Result<PathBuf, String> {
    let Some(requested) = requested.filter(|v| !v.trim().is_empty()) else {
        return Ok(base.to_path_buf());
    };
    let canonical = fs::canonicalize(requested).map_err(|e| format!("Cannot open folder: {e}"))?;
    if !canonical.starts_with(base) || !canonical.is_dir() {
        return Err("That folder is outside the Library.".into());
    }
    no_symlinks(base, &canonical)?;
    Ok(canonical)
}

fn no_symlinks(base: &Path, target: &Path) -> Result<(), String> {
    let mut walk = base.to_path_buf();
    let rest = target.strip_prefix(base).map_err(|_| "Invalid path.")?;
    for part in rest.components() {
        walk.push(part);
        if fs::symlink_metadata(&walk)
            .map_err(|e| format!("Cannot check path: {e}"))?
            .file_type()
            .is_symlink()
        {
            return Err("Symlinked items are not managed by the Library.".into());
        }
    }
    Ok(())
}

/// An existing page or book inside the Library, never the Library root or the trash.
fn inside_item(base: &Path, selected: &str) -> Result<PathBuf, String> {
    let candidate = Path::new(selected);
    if !candidate.is_absolute() {
        return Err("Choose an item inside the Library.".into());
    }
    let canonical =
        fs::canonicalize(candidate).map_err(|e| format!("Cannot find that item: {e}"))?;
    if canonical == *base || !canonical.starts_with(base) {
        return Err("That item is not inside the Library.".into());
    }
    if candidate != canonical {
        return Err("Choose the item directly, not through a shortcut.".into());
    }
    no_symlinks(base, &canonical)?;
    let first = canonical
        .strip_prefix(base)
        .ok()
        .and_then(|p| p.components().next());
    if first.map(|c| c.as_os_str() == TRASH).unwrap_or(false) {
        return Err("That item is already in the trash.".into());
    }
    Ok(canonical)
}

fn unique(parent: &Path, stem: &str, ext: &str) -> PathBuf {
    let first = parent.join(format!("{stem}{ext}"));
    if !first.exists() {
        return first;
    }
    (2..10_000)
        .map(|n| parent.join(format!("{stem} {n}{ext}")))
        .find(|p| !p.exists())
        .unwrap_or_else(|| parent.join(format!("{stem} {}{ext}", now_millis())))
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn to_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(str::to_owned)
        .ok_or_else(|| "The path is not UTF-8.".into())
}

/// Creates an empty page (`kind` = "file") or a book folder (`kind` = "folder"); returns its path.
pub fn create(root: &str, parent: Option<&str>, name: &str, kind: &str) -> Result<String, String> {
    let base = canonical_root(root)?;
    let dir = inside_dir(&base, parent)?;
    let cleaned = clean_name(name);
    let target = match kind {
        "folder" => {
            let path = unique(&dir, &cleaned, "");
            fs::create_dir(&path).map_err(|e| format!("Could not create the book: {e}"))?;
            path
        }
        "file" => {
            let (stem, ext) = split_extension(&cleaned);
            let path = unique(&dir, &stem, &ext);
            fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(|e| format!("Could not create the page: {e}"))?;
            path
        }
        _ => return Err("Choose page or book.".into()),
    };
    to_string(&target)
}

/// Renames in place. A page keeps its extension; nothing is ever overwritten.
pub fn rename(root: &str, selected: &str, new_name: &str) -> Result<String, String> {
    let base = canonical_root(root)?;
    let item = inside_item(&base, selected)?;
    let parent = item.parent().ok_or("Cannot rename that item.")?;
    let cleaned = clean_name(new_name);
    let target = if item.is_dir() {
        parent.join(&cleaned)
    } else {
        let (_, ext) = split_extension(item.file_name().and_then(|n| n.to_str()).unwrap_or(""));
        let (stem, _) = split_extension(&cleaned);
        parent.join(format!("{stem}{ext}"))
    };
    if target == item {
        return to_string(&item);
    }
    let same_ignoring_case =
        target.to_string_lossy().to_lowercase() == item.to_string_lossy().to_lowercase();
    if target.exists() && !same_ignoring_case {
        return Err("Something with that name already exists here.".into());
    }
    fs::rename(&item, &target).map_err(|e| format!("Could not rename: {e}"))?;
    to_string(&target)
}

/// Moves a page into another project (a folder in the Library), or back to the Library itself (`to` = None).
/// Never overwrites: a name clash gets a number. A project cannot be moved into itself or into another project.
pub fn move_into(root: &str, selected: &str, to: Option<&str>) -> Result<String, String> {
    let base = canonical_root(root)?;
    let item = inside_item(&base, selected)?;
    let destination = inside_dir(&base, to)?;
    if destination.starts_with(base.join(TRASH)) {
        return Err("Use the trash to remove things.".into());
    }
    if item.is_dir() {
        if destination != base {
            return Err("A project can only live directly in the Library.".into());
        }
    } else if destination != base && destination.parent() != Some(base.as_path()) {
        return Err("Pages can live in the Library or directly in a project.".into());
    }
    if item.parent() == Some(destination.as_path()) {
        return to_string(&item);
    }
    let name = item
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Cannot move that item.")?;
    let (stem, ext) = if item.is_dir() {
        (name.to_owned(), String::new())
    } else {
        split_extension(name)
    };
    let target = unique(&destination, &stem, &ext);
    fs::rename(&item, &target).map_err(|e| format!("Could not move it: {e}"))?;
    to_string(&target)
}

/// Moves a page or book into `<Library>/.trash/<stamp>/`, remembering where it came from so it can be restored.
pub fn trash(root: &str, selected: &str) -> Result<String, String> {
    let base = canonical_root(root)?;
    let item = inside_item(&base, selected)?;
    let relative = item
        .strip_prefix(&base)
        .map_err(|_| "That item is not inside the Library.")?
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/");
    let stamp = base.join(TRASH).join(now_millis().to_string());
    fs::create_dir_all(&stamp).map_err(|e| format!("Could not prepare the trash: {e}"))?;
    let name = item.file_name().ok_or("Cannot move that item.")?;
    let target = stamp.join(name);
    fs::write(stamp.join(ORIGIN), &relative)
        .map_err(|e| format!("Could not note where it came from: {e}"))?;
    if let Err(e) = fs::rename(&item, &target) {
        let _ = fs::remove_file(stamp.join(ORIGIN));
        let _ = fs::remove_dir(&stamp);
        return Err(format!("Could not move to the trash: {e}"));
    }
    to_string(&target)
}

/// One thing in the trash, newest first.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct TrashItem {
    pub item: String,
    pub name: String,
    pub original: String,
    pub trashed_at: u64,
    pub is_dir: bool,
}

pub fn list_trash(root: &str) -> Result<Vec<TrashItem>, String> {
    let base = canonical_root(root)?;
    let bin = base.join(TRASH);
    let Ok(stamps) = fs::read_dir(&bin) else {
        return Ok(Vec::new());
    };
    let mut items = Vec::new();
    for stamp in stamps.flatten() {
        let dir = stamp.path();
        if !dir.is_dir()
            || fs::symlink_metadata(&dir)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(true)
        {
            continue;
        }
        let Some(trashed_at) = dir
            .file_name()
            .and_then(|n| n.to_str())
            .and_then(|n| n.parse::<u64>().ok())
        else {
            continue;
        };
        let Ok(original) = fs::read_to_string(dir.join(ORIGIN)) else {
            continue;
        };
        let Some(found) = fs::read_dir(&dir).ok().and_then(|rd| {
            rd.flatten()
                .map(|e| e.path())
                .find(|p| p.file_name().map(|n| n != ORIGIN).unwrap_or(false))
        }) else {
            continue;
        };
        if fs::symlink_metadata(&found)
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(true)
        {
            continue;
        }
        let (Some(name), Some(path)) = (found.file_name().and_then(|n| n.to_str()), found.to_str())
        else {
            continue;
        };
        items.push(TrashItem {
            item: path.to_owned(),
            name: name.to_owned(),
            original: original.trim().to_owned(),
            trashed_at,
            is_dir: found.is_dir(),
        });
    }
    items.sort_by_key(|a| std::cmp::Reverse(a.trashed_at));
    items.truncate(200);
    Ok(items)
}

/// Puts a trashed item back where it was, recreating its book if needed. Never overwrites: a clash gets a new name.
pub fn restore(root: &str, item_path: &str) -> Result<String, String> {
    let base = canonical_root(root)?;
    let bin = base.join(TRASH);
    let item = fs::canonicalize(item_path).map_err(|e| format!("Cannot find that item: {e}"))?;
    let stamp = item
        .parent()
        .ok_or("Cannot restore that item.")?
        .to_path_buf();
    if stamp.parent() != Some(bin.as_path())
        || fs::symlink_metadata(&item)
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(true)
    {
        return Err("That item is not in the trash.".into());
    }
    let original = fs::read_to_string(stamp.join(ORIGIN))
        .map_err(|_| "This item has no record of where it came from.")?;
    let rel: Vec<&str> = original.trim().split('/').collect();
    if rel.is_empty()
        || rel.iter().any(|part| {
            part.is_empty()
                || *part == "."
                || *part == ".."
                || part.starts_with('.')
                || part.contains('\\')
        })
    {
        return Err("The saved location is not valid.".into());
    }
    let mut parent = base.clone();
    for part in &rel[..rel.len() - 1] {
        parent.push(part);
        if parent.exists()
            && (fs::symlink_metadata(&parent)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(true)
                || !parent.is_dir())
        {
            return Err("The original folder is no longer a normal folder.".into());
        }
    }
    fs::create_dir_all(&parent).map_err(|e| format!("Could not recreate the folder: {e}"))?;
    let last = rel[rel.len() - 1];
    let (stem, ext) = if item.is_dir() {
        (last.to_owned(), String::new())
    } else {
        split_extension(last)
    };
    let target = unique(&parent, &stem, &ext);
    fs::rename(&item, &target).map_err(|e| format!("Could not restore: {e}"))?;
    let _ = fs::remove_file(stamp.join(ORIGIN));
    let _ = fs::remove_dir(&stamp);
    to_string(&target)
}

/// Creates the folder if it does not exist yet and returns its canonical path.
pub fn ensure_folder(path: &Path) -> Result<String, String> {
    fs::create_dir_all(path).map_err(|e| format!("Could not create {}: {e}", path.display()))?;
    to_string(&fs::canonicalize(path).map_err(|e| e.to_string())?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let p = std::env::temp_dir().join(format!(
            "agp-library-{}-{}-{}",
            std::process::id(),
            now_millis(),
            COUNTER.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&p).unwrap();
        fs::canonicalize(p).unwrap()
    }
    fn s(p: &Path) -> &str {
        p.to_str().unwrap()
    }

    #[test]
    fn cleans_names_into_one_safe_segment() {
        assert_eq!(clean_name("  Chapter 1: The /Fog? "), "Chapter 1- The -Fog");
        assert_eq!(clean_name("..."), "Untitled");
        assert_eq!(clean_name(""), "Untitled");
        assert_eq!(clean_name("a\u{0}b\nc"), "a b c");
        assert_eq!(clean_name(&"x".repeat(200)).chars().count(), MAX_NAME);
    }

    #[test]
    fn creates_unique_pages_and_books() {
        let root = temp();
        let a = create(s(&root), None, "Untitled", "file").unwrap();
        let b = create(s(&root), None, "Untitled", "file").unwrap();
        assert!(a.ends_with("Untitled.md") && b.ends_with("Untitled 2.md"));
        let book = create(s(&root), None, "My Novel", "folder").unwrap();
        let chapter = create(s(&root), Some(&book), "Ch 1.txt", "file").unwrap();
        assert!(chapter.ends_with("My Novel/Ch 1.txt") || chapter.ends_with("My Novel\\Ch 1.txt"));
        assert!(create(s(&root), None, "x", "other").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_parents_outside_the_library() {
        let root = temp();
        let outside = temp();
        assert!(create(s(&root), Some(s(&outside)), "x", "file").is_err());
        assert!(create("", None, "x", "file").is_err());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn renames_keep_extension_and_never_overwrite() {
        let root = temp();
        let a = create(s(&root), None, "Draft", "file").unwrap();
        create(s(&root), None, "Taken", "file").unwrap();
        let renamed = rename(s(&root), &a, "Opening").unwrap();
        assert!(renamed.ends_with("Opening.md") && Path::new(&renamed).exists());
        assert!(rename(s(&root), &renamed, "Taken").is_err());
        assert!(rename(s(&root), s(&root), "x").is_err());
        let again = rename(s(&root), &renamed, "opening").unwrap();
        assert!(again.ends_with("opening.md"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn moves_pages_into_a_project_and_back_without_overwriting() {
        let root = temp();
        let project = create(s(&root), None, "Novel", "folder").unwrap();
        let other = create(s(&root), None, "Poems", "folder").unwrap();
        let loose = create(s(&root), None, "Draft", "file").unwrap();
        fs::write(&loose, "words").unwrap();
        let clash = create(s(&root), Some(&project), "Draft", "file").unwrap();
        let moved = move_into(s(&root), &loose, Some(&project)).unwrap();
        assert!(moved.ends_with("Novel/Draft 2.md") || moved.ends_with("Novel\\Draft 2.md"));
        assert_eq!(fs::read_to_string(&moved).unwrap(), "words");
        assert!(Path::new(&clash).exists());
        let over = move_into(s(&root), &moved, Some(&other)).unwrap();
        assert!(over.contains("Poems"));
        let home = move_into(s(&root), &over, None).unwrap();
        assert_eq!(Path::new(&home).parent().unwrap(), root.as_path());
        assert_eq!(move_into(s(&root), &home, None).unwrap(), home);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn projects_cannot_nest_and_nothing_moves_outside_the_library() {
        let root = temp();
        let outside = temp();
        let a = create(s(&root), None, "A", "folder").unwrap();
        let b = create(s(&root), None, "B", "folder").unwrap();
        assert!(move_into(s(&root), &a, Some(&b)).is_err());
        assert!(move_into(s(&root), &a, Some(&a)).is_err());
        let page = create(s(&root), None, "P", "file").unwrap();
        assert!(move_into(s(&root), &page, Some(s(&outside))).is_err());
        assert!(move_into(s(&root), s(&root), Some(&a)).is_err());
        fs::create_dir_all(root.join(TRASH)).unwrap();
        assert!(move_into(s(&root), &page, Some(s(&root.join(TRASH)))).is_err());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn trash_moves_instead_of_deleting_and_refuses_root_and_trash() {
        let root = temp();
        let a = create(s(&root), None, "Old", "file").unwrap();
        fs::write(&a, "words").unwrap();
        let moved = trash(s(&root), &a).unwrap();
        assert!(!Path::new(&a).exists());
        assert_eq!(fs::read_to_string(&moved).unwrap(), "words");
        assert!(root.join(TRASH).exists());
        assert!(trash(s(&root), s(&root)).is_err());
        assert!(trash(s(&root), &moved).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restores_to_the_original_place_even_when_the_book_is_gone() {
        let root = temp();
        let book = create(s(&root), None, "Novel", "folder").unwrap();
        let chapter = create(s(&root), Some(&book), "Ch 1", "file").unwrap();
        fs::write(&chapter, "chapter words").unwrap();
        let moved = trash(s(&root), &chapter).unwrap();
        let listed = list_trash(s(&root)).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "Ch 1.md");
        assert_eq!(listed[0].original, "Novel/Ch 1.md");
        assert_eq!(listed[0].item, moved);
        fs::remove_dir_all(&book).unwrap();
        let back = restore(s(&root), &moved).unwrap();
        assert!(back.ends_with("Novel/Ch 1.md") || back.ends_with("Novel\\Ch 1.md"));
        assert_eq!(fs::read_to_string(&back).unwrap(), "chapter words");
        assert!(list_trash(s(&root)).unwrap().is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restore_never_overwrites_and_lists_newest_first() {
        let root = temp();
        let a = create(s(&root), None, "Draft", "file").unwrap();
        fs::write(&a, "old").unwrap();
        let first = trash(s(&root), &a).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(3));
        let again = create(s(&root), None, "Draft", "file").unwrap();
        fs::write(&again, "new").unwrap();
        trash(s(&root), &again).unwrap();
        let fresh = create(s(&root), None, "Draft", "file").unwrap();
        fs::write(&fresh, "live").unwrap();
        let listed = list_trash(s(&root)).unwrap();
        assert_eq!(listed.len(), 2);
        assert!(listed[0].trashed_at >= listed[1].trashed_at);
        let back = restore(s(&root), &first).unwrap();
        assert!(back.ends_with("Draft 2.md"));
        assert_eq!(fs::read_to_string(&fresh).unwrap(), "live");
        assert_eq!(fs::read_to_string(&back).unwrap(), "old");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restore_refuses_anything_outside_the_trash() {
        let root = temp();
        let a = create(s(&root), None, "Keep", "file").unwrap();
        assert!(restore(s(&root), &a).is_err());
        assert!(restore(s(&root), s(&root)).is_err());
        assert!(list_trash(s(&root)).unwrap().is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn refuses_symlinks() {
        use std::os::unix::fs::symlink;
        let root = temp();
        let outside = temp();
        fs::write(outside.join("o.md"), "x").unwrap();
        symlink(outside.join("o.md"), root.join("alias.md")).unwrap();
        symlink(&outside, root.join("door")).unwrap();
        assert!(trash(s(&root), s(&root.join("alias.md"))).is_err());
        assert!(create(s(&root), Some(s(&root.join("door"))), "x", "file").is_err());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }
}
