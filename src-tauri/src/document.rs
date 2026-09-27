//! Document persistence for A Good Page.
//! Storage is abstracted behind a trait so the service is deterministic under test.

use serde::Serialize;
use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

pub const MAX_DOCUMENT_BYTES: u64 = 10 * 1024 * 1024;
pub const SUPPORTED_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];
const TEMP_SUFFIX: &str = ".hearth-tmp";
static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub trait Storage: Send + Sync {
    fn size(&self, path: &Path) -> io::Result<u64>;
    fn read(&self, path: &Path) -> io::Result<String>;
    fn write_atomic(&self, path: &Path, contents: &str) -> io::Result<()>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct FsStorage;

impl Storage for FsStorage {
    fn size(&self, path: &Path) -> io::Result<u64> {
        Ok(fs::metadata(path)?.len())
    }

    fn read(&self, path: &Path) -> io::Result<String> {
        fs::read_to_string(path)
    }

    fn write_atomic(&self, path: &Path, contents: &str) -> io::Result<()> {
        write_atomic_bytes(path, contents.as_bytes())
    }
}

/// Write to a unique sibling temp file, fsync, then rename over the target.
/// Shared by manuscript saves and PDF export so both get the same crash safety.
pub fn write_atomic_bytes(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let file_name = path
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "path has no file name"))?;
    let (tmp_path, mut file) = loop {
        let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let mut name = file_name.to_os_string();
        name.push(format!("{TEMP_SUFFIX}-{}-{sequence}", std::process::id()));
        let candidate = path.with_file_name(name);
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(file) => break (candidate, file),
            Err(err) if err.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(err) => return Err(err),
        }
    };
    let result = (|| {
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&tmp_path, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp_path);
    }
    result
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocError {
    EmptyPath,
    UnsupportedExtension(String),
    TooLarge(u64),
    InvalidUtf8,
    Io(String),
}

impl fmt::Display for DocError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DocError::EmptyPath => write!(f, "No file was chosen."),
            DocError::UnsupportedExtension(ext) if ext.is_empty() => {
                write!(f, "A Good Page opens Markdown (.md) and text (.txt) files.")
            }
            DocError::UnsupportedExtension(ext) => {
                write!(
                    f,
                    "A Good Page opens Markdown and text files, not .{ext} files."
                )
            }
            DocError::TooLarge(bytes) => write!(
                f,
                "This file is too large to open ({:.1} MB).",
                *bytes as f64 / 1_048_576.0
            ),
            DocError::InvalidUtf8 => write!(f, "This file is not readable UTF-8 text."),
            DocError::Io(msg) => write!(f, "Could not access the file: {msg}"),
        }
    }
}

impl std::error::Error for DocError {}

impl Serialize for DocError {
    fn serialize<Ser: serde::Serializer>(&self, serializer: Ser) -> Result<Ser::Ok, Ser::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<io::Error> for DocError {
    fn from(err: io::Error) -> Self {
        if err.kind() == io::ErrorKind::InvalidData {
            DocError::InvalidUtf8
        } else {
            DocError::Io(err.to_string())
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Document {
    pub path: String,
    pub name: String,
    pub content: String,
}

pub struct DocumentService<S: Storage> {
    storage: S,
}

impl<S: Storage> DocumentService<S> {
    pub fn new(storage: S) -> Self {
        Self { storage }
    }

    pub fn open(&self, raw_path: &str) -> Result<Document, DocError> {
        let path = parse_path(raw_path)?;
        ensure_supported(&path)?;
        let size = self.storage.size(&path)?;
        if size > MAX_DOCUMENT_BYTES {
            return Err(DocError::TooLarge(size));
        }
        let content = self.storage.read(&path)?;
        Ok(Document {
            name: display_name(&path),
            path: path.to_string_lossy().into_owned(),
            content: normalize_text(&content),
        })
    }

    pub fn save(&self, raw_path: &str, content: &str) -> Result<String, DocError> {
        let path = ensure_markdown_path(parse_path(raw_path)?)?;
        let size = content.len() as u64;
        if size > MAX_DOCUMENT_BYTES {
            return Err(DocError::TooLarge(size));
        }
        self.storage.write_atomic(&path, content)?;
        Ok(path.to_string_lossy().into_owned())
    }
}

fn parse_path(raw: &str) -> Result<PathBuf, DocError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        Err(DocError::EmptyPath)
    } else {
        Ok(PathBuf::from(trimmed))
    }
}

fn extension_of(path: &Path) -> Option<String> {
    path.extension().map(|e| e.to_string_lossy().to_lowercase())
}

pub(crate) fn is_supported(path: &Path) -> bool {
    extension_of(path)
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

fn ensure_supported(path: &Path) -> Result<(), DocError> {
    if is_supported(path) {
        Ok(())
    } else {
        Err(DocError::UnsupportedExtension(
            extension_of(path).unwrap_or_default(),
        ))
    }
}

/// Appends ".md" when the path has no supported extension, so writers never
/// lose a file to an odd name like "chapter.1".
pub fn ensure_markdown_path(path: PathBuf) -> Result<PathBuf, DocError> {
    if is_supported(&path) {
        return Ok(path);
    }
    let mut renamed = path.file_name().ok_or(DocError::EmptyPath)?.to_os_string();
    renamed.push(".md");
    Ok(path.with_file_name(renamed))
}

pub fn display_name(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Untitled".to_string())
}

pub fn normalize_text(raw: &str) -> String {
    raw.strip_prefix('\u{feff}')
        .unwrap_or(raw)
        .replace("\r\n", "\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MemoryStorage {
        files: Mutex<HashMap<PathBuf, String>>,
        fail_writes: bool,
    }

    impl Storage for MemoryStorage {
        fn size(&self, path: &Path) -> io::Result<u64> {
            self.files
                .lock()
                .unwrap()
                .get(path)
                .map(|c| c.len() as u64)
                .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "missing"))
        }

        fn read(&self, path: &Path) -> io::Result<String> {
            self.files
                .lock()
                .unwrap()
                .get(path)
                .cloned()
                .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "missing"))
        }

        fn write_atomic(&self, path: &Path, contents: &str) -> io::Result<()> {
            if self.fail_writes {
                return Err(io::Error::new(io::ErrorKind::PermissionDenied, "read-only"));
            }
            self.files
                .lock()
                .unwrap()
                .insert(path.to_path_buf(), contents.to_string());
            Ok(())
        }
    }

    fn service_with(files: &[(&str, &str)]) -> DocumentService<MemoryStorage> {
        let storage = MemoryStorage::default();
        for (path, content) in files {
            storage
                .files
                .lock()
                .unwrap()
                .insert(PathBuf::from(path), content.to_string());
        }
        DocumentService::new(storage)
    }

    #[test]
    fn opens_markdown_file() {
        let svc = service_with(&[("notes.md", "# Hello")]);
        let doc = svc.open("notes.md").unwrap();
        assert_eq!(doc.name, "notes");
        assert_eq!(doc.content, "# Hello");
        assert_eq!(doc.path, "notes.md");
    }

    #[test]
    fn open_trims_surrounding_whitespace_in_path() {
        let svc = service_with(&[("notes.md", "x")]);
        assert!(svc.open("  notes.md  ").is_ok());
    }

    #[test]
    fn open_rejects_empty_path() {
        let svc = service_with(&[]);
        assert_eq!(svc.open("   "), Err(DocError::EmptyPath));
    }

    #[test]
    fn open_rejects_unsupported_extension() {
        let svc = service_with(&[("photo.png", "x")]);
        assert_eq!(
            svc.open("photo.png"),
            Err(DocError::UnsupportedExtension("png".into()))
        );
    }

    #[test]
    fn open_rejects_path_without_extension() {
        let svc = service_with(&[("README", "x")]);
        assert_eq!(
            svc.open("README"),
            Err(DocError::UnsupportedExtension(String::new()))
        );
    }

    #[test]
    fn open_accepts_uppercase_extension() {
        let svc = service_with(&[("NOTES.MD", "x")]);
        assert!(svc.open("NOTES.MD").is_ok());
    }

    #[test]
    fn open_reports_missing_file_as_io_error() {
        let svc = service_with(&[]);
        assert!(matches!(svc.open("ghost.md"), Err(DocError::Io(_))));
    }

    #[test]
    fn open_rejects_files_over_the_size_limit() {
        let big = "a".repeat(MAX_DOCUMENT_BYTES as usize + 1);
        let svc = service_with(&[("big.md", big.as_str())]);
        assert_eq!(
            svc.open("big.md"),
            Err(DocError::TooLarge(MAX_DOCUMENT_BYTES + 1))
        );
    }

    #[test]
    fn open_accepts_file_exactly_at_the_size_limit() {
        let edge = "a".repeat(MAX_DOCUMENT_BYTES as usize);
        let svc = service_with(&[("edge.md", edge.as_str())]);
        assert!(svc.open("edge.md").is_ok());
    }

    #[test]
    fn open_normalizes_crlf_and_bom() {
        let svc = service_with(&[("win.md", "\u{feff}line one\r\nline two")]);
        assert_eq!(svc.open("win.md").unwrap().content, "line one\nline two");
    }

    #[test]
    fn open_empty_file_returns_empty_content() {
        let svc = service_with(&[("empty.md", "")]);
        assert_eq!(svc.open("empty.md").unwrap().content, "");
    }

    #[test]
    fn save_appends_md_when_extension_missing() {
        let svc = service_with(&[]);
        assert_eq!(svc.save("notes", "x").unwrap(), "notes.md");
    }

    #[test]
    fn save_appends_md_to_unsupported_extension() {
        let svc = service_with(&[]);
        assert_eq!(svc.save("chapter.1", "x").unwrap(), "chapter.1.md");
    }

    #[test]
    fn save_keeps_supported_extension() {
        let svc = service_with(&[]);
        assert_eq!(svc.save("a.txt", "x").unwrap(), "a.txt");
    }

    #[test]
    fn save_rejects_empty_path() {
        let svc = service_with(&[]);
        assert_eq!(svc.save("", "x"), Err(DocError::EmptyPath));
    }

    #[test]
    fn save_allows_empty_content() {
        let svc = service_with(&[]);
        svc.save("blank.md", "").unwrap();
        assert_eq!(svc.open("blank.md").unwrap().content, "");
    }

    #[test]
    fn save_rejects_oversized_content() {
        let svc = service_with(&[]);
        let big = "a".repeat(MAX_DOCUMENT_BYTES as usize + 1);
        assert!(matches!(
            svc.save("big.md", &big),
            Err(DocError::TooLarge(_))
        ));
    }

    #[test]
    fn save_propagates_write_failure() {
        let svc = DocumentService::new(MemoryStorage {
            fail_writes: true,
            ..Default::default()
        });
        assert!(matches!(svc.save("a.md", "x"), Err(DocError::Io(_))));
    }

    #[test]
    fn save_then_open_round_trip() {
        let svc = service_with(&[]);
        let path = svc
            .save("story.md", "It was a dark and cozy night.")
            .unwrap();
        assert_eq!(
            svc.open(&path).unwrap().content,
            "It was a dark and cozy night."
        );
    }

    #[test]
    fn display_name_falls_back_to_untitled() {
        assert_eq!(display_name(Path::new("/")), "Untitled");
    }

    #[test]
    fn invalid_data_maps_to_invalid_utf8() {
        let err = DocError::from(io::Error::new(io::ErrorKind::InvalidData, "bad"));
        assert_eq!(err, DocError::InvalidUtf8);
    }

    #[test]
    fn errors_serialize_as_readable_messages() {
        let json = serde_json::to_string(&DocError::EmptyPath).unwrap();
        assert_eq!(json, "\"No file was chosen.\"");
    }

    fn unique_temp_dir() -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir =
            std::env::temp_dir().join(format!("hearth-test-{}-{}", std::process::id(), nanos));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn fs_storage_writes_atomically_and_overwrites() {
        let dir = unique_temp_dir();
        let path = dir.join("chapter.md");
        let storage = FsStorage;
        storage.write_atomic(&path, "first").unwrap();
        storage.write_atomic(&path, "second draft").unwrap();
        assert_eq!(storage.read(&path).unwrap(), "second draft");
        assert_eq!(storage.size(&path).unwrap(), 12);
        let leftovers = fs::read_dir(&dir)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.file_name().to_string_lossy().contains(TEMP_SUFFIX))
            .count();
        assert_eq!(leftovers, 0);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn parallel_writes_do_not_share_a_temporary_file() {
        let dir = unique_temp_dir();
        let first = dir.join("one.md");
        let second = dir.join("two.md");
        let a = first.clone();
        let b = second.clone();
        let left = std::thread::spawn(move || FsStorage.write_atomic(&a, "first"));
        let right = std::thread::spawn(move || FsStorage.write_atomic(&b, "second"));
        left.join().unwrap().unwrap();
        right.join().unwrap().unwrap();
        assert_eq!(FsStorage.read(&first).unwrap(), "first");
        assert_eq!(FsStorage.read(&second).unwrap(), "second");
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 2);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn fs_storage_rejects_path_without_file_name() {
        assert!(FsStorage.write_atomic(Path::new("/"), "x").is_err());
    }

    #[test]
    fn shared_atomic_writer_keeps_binary_bytes_exactly() {
        let dir = unique_temp_dir();
        let path = dir.join("book.pdf");
        let bytes = [0u8, 159, 146, 150, 255, b'\n'];
        write_atomic_bytes(&path, &bytes).unwrap();
        assert_eq!(fs::read(&path).unwrap(), bytes);
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1);
        fs::remove_dir_all(&dir).unwrap();
    }
}
