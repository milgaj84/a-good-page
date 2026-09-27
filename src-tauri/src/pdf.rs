//! Guarded PDF persistence. Export does not modify the open manuscript.
use crate::document::write_atomic_bytes;
use std::{
    io,
    path::{Path, PathBuf},
};

pub const MAX_PDF_BYTES: usize = 40 * 1024 * 1024;

pub trait PdfStorage: Send + Sync {
    fn write_pdf(&self, path: &Path, bytes: &[u8]) -> io::Result<()>;
}

pub struct DiskPdfStorage;
impl PdfStorage for DiskPdfStorage {
    fn write_pdf(&self, path: &Path, bytes: &[u8]) -> io::Result<()> {
        write_atomic_bytes(path, bytes)
    }
}

pub struct PdfService<S: PdfStorage> {
    storage: S,
}
impl<S: PdfStorage> PdfService<S> {
    pub fn new(storage: S) -> Self {
        Self { storage }
    }

    pub fn export(&self, raw_path: &str, bytes: &[u8]) -> Result<String, String> {
        let trimmed = raw_path.trim();
        if trimmed.is_empty() {
            return Err("Choose where to save the PDF.".into());
        }
        let path = PathBuf::from(trimmed);
        if !path
            .extension()
            .is_some_and(|ext| ext.to_string_lossy().eq_ignore_ascii_case("pdf"))
        {
            return Err("Choose a .pdf file.".into());
        }
        if bytes.len() > MAX_PDF_BYTES {
            return Err("PDF exceeds the 40 MB export limit.".into());
        }
        if !bytes.starts_with(b"%PDF-") || !bytes.windows(5).any(|part| part == b"%%EOF") {
            return Err("The generated PDF is invalid.".into());
        }
        self.storage
            .write_pdf(&path, bytes)
            .map_err(|err| format!("Could not export PDF: {err}"))?;
        Ok(path.to_string_lossy().into_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::Mutex;
    #[derive(Default)]
    struct Memory {
        saved: Mutex<Vec<(PathBuf, Vec<u8>)>>,
        fail: bool,
    }
    impl PdfStorage for Memory {
        fn write_pdf(&self, path: &Path, bytes: &[u8]) -> io::Result<()> {
            if self.fail {
                return Err(io::Error::other("disk full"));
            }
            self.saved
                .lock()
                .unwrap()
                .push((path.to_owned(), bytes.to_vec()));
            Ok(())
        }
    }
    const PDF: &[u8] = b"%PDF-1.4\ncontent\n%%EOF";
    #[test]
    fn accepts_pdf_without_changing_bytes() {
        let service = PdfService::new(Memory::default());
        assert_eq!(service.export("book.PDF", PDF).unwrap(), "book.PDF");
        assert_eq!(service.storage.saved.lock().unwrap()[0].1, PDF);
    }
    #[test]
    fn rejects_empty_wrong_extension_and_corruption() {
        let svc = PdfService::new(Memory::default());
        assert!(svc.export(" ", PDF).is_err());
        assert!(svc.export("book.txt", PDF).is_err());
        assert!(svc.export("book.pdf", b"not a pdf").is_err());
        assert!(svc.export("book.pdf", b"%PDF-1.4").is_err());
        assert!(svc.storage.saved.lock().unwrap().is_empty());
    }
    #[test]
    fn concurrent_exports_do_not_collide_on_temporary_files() {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("hearth-pdf-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let a = dir.join("first.pdf");
        let b = dir.join("second.pdf");
        let left = std::thread::spawn(move || DiskPdfStorage.write_pdf(&a, PDF));
        let right = std::thread::spawn(move || DiskPdfStorage.write_pdf(&b, PDF));
        left.join().unwrap().unwrap();
        right.join().unwrap().unwrap();
        assert_eq!(fs::read(dir.join("first.pdf")).unwrap(), PDF);
        assert_eq!(fs::read(dir.join("second.pdf")).unwrap(), PDF);
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 2);
        fs::remove_dir_all(&dir).unwrap();
    }
    #[test]
    fn rejects_oversized_and_write_failure() {
        let svc = PdfService::new(Memory {
            fail: true,
            ..Default::default()
        });
        assert!(svc.export("a.pdf", PDF).is_err());
        let big = vec![b'a'; MAX_PDF_BYTES + 1];
        assert!(svc.export("a.pdf", &big).is_err());
    }
}
