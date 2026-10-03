//! Saving a finished export (PDF, Word, EPUB or Markdown). The bytes are checked for the format they claim,
//! then written next to the target and renamed into place, like every other write in the app.
use crate::document::write_atomic_bytes;
use std::path::PathBuf;

pub const MAX_EXPORT_BYTES: usize = 60 * 1024 * 1024;

/// The formats an export can have, and the extension each one must carry.
fn extension_for(kind: &str) -> Option<&'static str> {
    match kind {
        "pdf" => Some("pdf"),
        "docx" => Some("docx"),
        "epub" => Some("epub"),
        "md" => Some("md"),
        _ => None,
    }
}

fn looks_like(kind: &str, bytes: &[u8]) -> bool {
    match kind {
        "pdf" => bytes.starts_with(b"%PDF-") && bytes.windows(5).any(|part| part == b"%%EOF"),
        // A .docx is a zip file: it begins with a local file header.
        "docx" => bytes.starts_with(b"PK\x03\x04"),
        // An .epub is a zip whose first entry is the stored "mimetype" file.
        "epub" => {
            bytes.starts_with(b"PK\x03\x04")
                && bytes
                    .get(30..)
                    .is_some_and(|b| b.starts_with(b"mimetypeapplication/epub+zip"))
        }
        "md" => std::str::from_utf8(bytes).is_ok(),
        _ => false,
    }
}

pub fn export_document(raw_path: &str, bytes: &[u8], kind: &str) -> Result<String, String> {
    let Some(extension) = extension_for(kind) else {
        return Err("Choose PDF, Word, EPUB or Markdown.".into());
    };
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("Choose where to save the file.".into());
    }
    let path = PathBuf::from(trimmed);
    if !path
        .extension()
        .is_some_and(|ext| ext.to_string_lossy().eq_ignore_ascii_case(extension))
    {
        return Err(format!("Choose a .{extension} file."));
    }
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err("The export is larger than the 60 MB limit.".into());
    }
    if !looks_like(kind, bytes) {
        return Err("The generated file is not valid, so nothing was saved.".into());
    }
    write_atomic_bytes(&path, bytes).map_err(|err| format!("Could not save the export: {err}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn dir() -> PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static N: AtomicUsize = AtomicUsize::new(0);
        let p = std::env::temp_dir().join(format!(
            "agp-export-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&p).unwrap();
        p
    }

    const PDF: &[u8] = b"%PDF-1.4\ncontent\n%%EOF";
    const DOCX: &[u8] = b"PK\x03\x04rest of a zip";
    const EPUB: &[u8] = b"PK\x03\x04aaaaaaaaaaaaaaaaaaaaaaaaaamimetypeapplication/epub+zipPK";

    #[test]
    fn saves_each_format_unchanged_to_its_own_extension() {
        let d = dir();
        for (kind, name, bytes) in [
            ("pdf", "a.PDF", PDF),
            ("docx", "b.docx", DOCX),
            ("md", "c.md", "# Title\n\nWörds".as_bytes()),
            ("epub", "d.epub", EPUB),
        ] {
            let target = d.join(name);
            assert_eq!(
                export_document(target.to_str().unwrap(), bytes, kind).unwrap(),
                target.to_str().unwrap()
            );
            assert_eq!(fs::read(&target).unwrap(), bytes);
        }
        assert_eq!(fs::read_dir(&d).unwrap().count(), 4);
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn refuses_a_wrong_extension_bad_bytes_and_unknown_kinds() {
        let d = dir();
        let p = |n: &str| d.join(n).to_str().unwrap().to_owned();
        assert!(export_document(&p("a.txt"), PDF, "pdf").is_err());
        assert!(export_document(&p("a.pdf"), DOCX, "pdf").is_err());
        assert!(export_document(&p("a.docx"), PDF, "docx").is_err());
        assert!(export_document(&p("a.epub"), DOCX, "epub").is_err());
        assert!(export_document(&p("a.md"), &[0xff, 0xfe, 0xfd], "md").is_err());
        assert!(export_document(&p("a.rtf"), PDF, "rtf").is_err());
        assert!(export_document(" ", PDF, "pdf").is_err());
        assert_eq!(fs::read_dir(&d).unwrap().count(), 0);
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn refuses_oversized_exports() {
        let big = vec![b'a'; MAX_EXPORT_BYTES + 1];
        assert!(export_document("big.md", &big, "md").is_err());
    }
}
