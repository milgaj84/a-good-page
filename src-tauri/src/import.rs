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
    styles: String,
    footnotes: String,
    comments: String,
}

/// The XML parts a Word file needs to be read as writing. Nothing is written anywhere.
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
            "word/styles.xml",
            "word/footnotes.xml",
            "word/comments.xml",
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
        styles: take("word/styles.xml").unwrap_or_default(),
        footnotes: take("word/footnotes.xml").unwrap_or_default(),
        comments: take("word/comments.xml").unwrap_or_default(),
    })
}

/// What a folder import did: the new project, and the files that were left out or converted.
#[derive(Debug, Serialize)]
pub struct FolderImport {
    pub project: String,
    pub pages: usize,
    pub skipped: Vec<String>,
    pub converted: Vec<String>,
}

/// Orders names the way people count: "Chapter 2" before "Chapter 10", ignoring case.
pub fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    let (mut x, mut y) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (x.peek().copied(), y.peek().copied()) {
            (None, None) => return a.cmp(b),
            (None, _) => return Ordering::Less,
            (_, None) => return Ordering::Greater,
            (Some(p), Some(q)) if p.is_ascii_digit() && q.is_ascii_digit() => {
                let run = |it: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut n = String::new();
                    while let Some(d) = it.next_if(char::is_ascii_digit) {
                        n.push(d);
                    }
                    n.trim_start_matches('0').to_owned()
                };
                let (m, n) = (run(&mut x), run(&mut y));
                let order = m.len().cmp(&n.len()).then_with(|| m.cmp(&n));
                if order != Ordering::Equal {
                    return order;
                }
            }
            (Some(p), Some(q)) => {
                let order = p.to_lowercase().cmp(q.to_lowercase());
                if order != Ordering::Equal {
                    return order;
                }
                x.next();
                y.next();
            }
        }
    }
}

/// Windows-1252 text, for older files that are not UTF-8. Refuses anything with NUL bytes (not text).
fn decode_windows_1252(bytes: &[u8]) -> Option<String> {
    const HIGH: [char; 32] = [
        '\u{20AC}', '\u{81}', '\u{201A}', '\u{192}', '\u{201E}', '\u{2026}', '\u{2020}',
        '\u{2021}', '\u{2C6}', '\u{2030}', '\u{160}', '\u{2039}', '\u{152}', '\u{8D}', '\u{17D}',
        '\u{8F}', '\u{90}', '\u{2018}', '\u{2019}', '\u{201C}', '\u{201D}', '\u{2022}', '\u{2013}',
        '\u{2014}', '\u{2DC}', '\u{2122}', '\u{161}', '\u{203A}', '\u{153}', '\u{9D}', '\u{17E}',
        '\u{178}',
    ];
    if bytes.contains(&0) {
        return None;
    }
    Some(
        bytes
            .iter()
            .map(|&b| match b {
                0x80..=0x9F => HIGH[(b - 0x80) as usize],
                b => b as char,
            })
            .collect(),
    )
}

/// Copies the writing files directly inside `source` (not subfolders) into a new project in the Library.
/// Files are copied, never moved. Files that cannot be imported are listed; if nothing could be, no project is left behind.
pub fn import_folder(root: &str, source: &Path) -> Result<FolderImport, String> {
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
    files.sort_by(|a, b| {
        natural_cmp(
            &a.file_name().to_string_lossy(),
            &b.file_name().to_string_lossy(),
        )
    });
    let name = source
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Imported".into());
    let project = library::create(root, None, &name, "folder")?;
    let mut done = FolderImport {
        project: project.clone(),
        pages: 0,
        skipped: Vec::new(),
        converted: Vec::new(),
    };
    let result = (|| -> Result<(), String> {
        for entry in files {
            let file_name = entry.file_name().to_string_lossy().into_owned();
            let Ok(bytes) = fs::read(entry.path()) else {
                done.skipped.push(file_name);
                continue;
            };
            let bytes = if bytes.len() as u64 > MAX_PAGE_BYTES {
                None
            } else if std::str::from_utf8(&bytes).is_ok() {
                Some(bytes)
            } else {
                decode_windows_1252(&bytes).map(|text| {
                    done.converted.push(file_name.clone());
                    text.into_bytes()
                })
            };
            let Some(bytes) = bytes else {
                done.skipped.push(file_name);
                continue;
            };
            let page = library::create(root, Some(&project), &file_name, "file")?;
            document::write_atomic_bytes(Path::new(&page), &bytes)
                .map_err(|e| format!("Could not save a page: {e}"))?;
            done.pages += 1;
        }
        if done.pages == 0 {
            return Err(
                "None of those files could be imported (they are too large or not text).".into(),
            );
        }
        Ok(())
    })();
    if let Err(e) = result {
        let _ = fs::remove_dir_all(&project);
        return Err(e);
    }
    Ok(done)
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
        fs::write(src.join("bad.md"), [0xff, 0x00, 0xfe]).unwrap();
        let done = import_folder(lib.to_str().unwrap(), &src).unwrap();
        assert_eq!(
            (done.pages, done.skipped.as_slice()),
            (2, ["bad.md".to_string()].as_slice())
        );
        let project = done.project;
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
    fn natural_order_counts_numbers_as_numbers() {
        let mut v = ["Chapter 10", "chapter 2", "Chapter 1", "a02", "a1", "B"];
        v.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(
            v,
            ["a1", "a02", "B", "Chapter 1", "chapter 2", "Chapter 10"]
        );
    }

    #[test]
    fn imports_in_natural_order_converts_old_text_and_cleans_up_failures() {
        let (lib, src) = (dir("lib2"), dir("Old"));
        fs::write(src.join("Ch 10.md"), "ten").unwrap();
        fs::write(src.join("Ch 2.md"), [b'c', b'a', b'f', 0xe9]).unwrap();
        let done = import_folder(lib.to_str().unwrap(), &src).unwrap();
        assert_eq!(done.converted, ["Ch 2.md"]);
        assert!(done.skipped.is_empty());
        assert_eq!(
            fs::read_to_string(Path::new(&done.project).join("Ch 2.md")).unwrap(),
            "caf\u{e9}"
        );
        // Nothing importable: no half-made project is left in the Library.
        let (lib, src) = (dir("lib3"), dir("Bin"));
        fs::write(src.join("x.md"), [0u8, 0xff]).unwrap();
        assert!(import_folder(lib.to_str().unwrap(), &src).is_err());
        assert_eq!(fs::read_dir(&lib).unwrap().count(), 0);
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
        assert_eq!(
            (
                parts.styles.as_str(),
                parts.footnotes.as_str(),
                parts.comments.as_str()
            ),
            ("", "", "")
        );
        let full = backup::zip_bytes(
            &[
                ("word/document.xml".into(), b"<d/>".to_vec()),
                ("word/styles.xml".into(), b"<s/>".to_vec()),
                ("word/footnotes.xml".into(), b"<f/>".to_vec()),
                ("word/comments.xml".into(), b"<c/>".to_vec()),
            ],
            0,
        )
        .unwrap();
        fs::write(d.join("full.docx"), full).unwrap();
        let p = read_docx(&d.join("full.docx")).unwrap();
        assert_eq!(
            (p.styles.as_str(), p.footnotes.as_str(), p.comments.as_str()),
            ("<s/>", "<f/>", "<c/>")
        );
        fs::write(d.join("b.docx"), "not a zip").unwrap();
        assert!(read_docx(&d.join("b.docx")).is_err());
        let none = backup::zip_bytes(&[("x.txt".into(), b"x".to_vec())], 0).unwrap();
        fs::write(d.join("c.docx"), none).unwrap();
        assert!(read_docx(&d.join("c.docx")).is_err());
    }
}
