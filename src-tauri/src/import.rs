//! Bringing writing in: the parts of a Word file the page turns into pages, and a folder of pages copied into a new project.
use crate::{backup, document, library};
use serde::Serialize;
use std::{fs, path::Path};

const MAX_DOCX_BYTES: u64 = 256 * 1024 * 1024;
const MAX_PAGE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_PAGES: usize = 2_000;

#[derive(Serialize)]
pub struct DocxParts {
    document: String,
    rels: String,
    numbering: String,
}

/// The three XML parts a Word file needs to be read as writing. Nothing is written anywhere.
pub fn read_docx(path: &Path) -> Result<DocxParts, String> {
    let meta = fs::metadata(path).map_err(|e| format!("Cannot read that file: {e}"))?;
    if !meta.is_file() || meta.len() > MAX_DOCX_BYTES {
        return Err("That is not a Word document A Good Page can read.".into());
    }
    let bytes = fs::read(path).map_err(|e| format!("Cannot read that file: {e}"))?;
    let mut parts = backup::read_entries(
        &bytes,
        &[
            "word/document.xml",
            "word/_rels/document.xml.rels",
            "word/numbering.xml",
        ],
    )
    .map_err(|_| "That is not a Word (.docx) document.".to_string())?;
    let mut take = |name: &str| {
        parts
            .iter()
            .position(|(n, _)| n == name)
            .map(|i| String::from_utf8_lossy(&parts.swap_remove(i).1).into_owned())
    };
    let document = take("word/document.xml").ok_or("That is not a Word (.docx) document.")?;
    Ok(DocxParts {
        document,
        rels: take("word/_rels/document.xml.rels").unwrap_or_default(),
        numbering: take("word/numbering.xml").unwrap_or_default(),
    })
}

/// Copies the writing files directly inside `source` (not subfolders) into a new project in the Library.
/// Returns the new project's path. Files are copied, never moved.
pub fn import_folder(root: &str, source: &Path) -> Result<String, String> {
    let mut files: Vec<_> = fs::read_dir(source)
        .map_err(|e| format!("Cannot read that folder: {e}"))?
        .filter_map(Result::ok)
        .filter(|e| {
            let name = e.file_name();
            !name.to_string_lossy().starts_with('.')
                && document::is_supported(&e.path())
                && fs::symlink_metadata(e.path()).is_ok_and(|m| m.is_file())
        })
        .collect();
    if files.is_empty() {
        return Err("That folder has no .md, .markdown or .txt files.".into());
    }
    if files.len() > MAX_PAGES {
        return Err("That folder has too many files to import at once.".into());
    }
    files.sort_by_key(|e| e.file_name().to_string_lossy().to_lowercase());
    let name = source
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Imported".into());
    let project = library::create(root, None, &name, "folder")?;
    for entry in files {
        let bytes = fs::read(entry.path()).map_err(|e| format!("Cannot read a page: {e}"))?;
        if bytes.len() as u64 > MAX_PAGE_BYTES || std::str::from_utf8(&bytes).is_err() {
            continue;
        }
        let page = library::create(
            root,
            Some(&project),
            &entry.file_name().to_string_lossy(),
            "file",
        )?;
        document::write_atomic_bytes(Path::new(&page), &bytes)
            .map_err(|e| format!("Could not save a page: {e}"))?;
    }
    Ok(project)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir(tag: &str) -> std::path::PathBuf {
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let p = std::env::temp_dir().join(format!(
            "agp-import-{tag}-{}-{}",
            std::process::id(),
            N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        ));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn copies_writing_files_in_name_order_and_leaves_the_source() {
        let (lib, src) = (dir("lib"), dir("My Novel"));
        fs::write(src.join("02-b.md"), "# B").unwrap();
        fs::write(src.join("01-a.txt"), "A").unwrap();
        fs::write(src.join("notes.docx"), "x").unwrap();
        fs::write(src.join(".hidden.md"), "x").unwrap();
        fs::write(src.join("bad.md"), [0xff, 0xfe]).unwrap();
        let project = import_folder(lib.to_str().unwrap(), &src).unwrap();
        let mut names: Vec<_> = fs::read_dir(&project)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(names, ["01-a.txt", "02-b.md"]);
        assert_eq!(
            fs::read_to_string(Path::new(&project).join("02-b.md")).unwrap(),
            "# B"
        );
        assert!(src.join("02-b.md").exists());
        assert!(import_folder(lib.to_str().unwrap(), &dir("empty")).is_err());
    }

    #[test]
    fn reads_the_parts_of_a_word_file_and_refuses_other_files() {
        let d = dir("docx");
        let zip = backup::zip_bytes(
            &[
                ("word/document.xml".into(), b"<w:document/>".to_vec()),
                ("word/_rels/document.xml.rels".into(), b"<r/>".to_vec()),
            ],
            0,
        )
        .unwrap();
        fs::write(d.join("a.docx"), zip).unwrap();
        let parts = read_docx(&d.join("a.docx")).unwrap();
        assert_eq!(
            (
                parts.document.as_str(),
                parts.rels.as_str(),
                parts.numbering.as_str()
            ),
            ("<w:document/>", "<r/>", "")
        );
        fs::write(d.join("b.docx"), "not a zip").unwrap();
        assert!(read_docx(&d.join("b.docx")).is_err());
        let none = backup::zip_bytes(&[("x.txt".into(), b"x".to_vec())], 0).unwrap();
        fs::write(d.join("c.docx"), none).unwrap();
        assert!(read_docx(&d.join("c.docx")).is_err());
    }
}
