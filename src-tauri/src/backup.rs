//! Backing up the Library to a zip, keeping only the newest few, and restoring one safely.
//! A backup holds only writing files (and each project's order file); nothing is ever overwritten on restore.
use crate::document::{is_supported, write_atomic_bytes};
use flate2::{read::DeflateDecoder, write::DeflateEncoder, Compression, Crc};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const MANIFEST: &str = ".a-good-page.json";
const MAX_FILES: usize = 20_000;
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_DEPTH: usize = 6;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct BackupSummary {
    pub path: String,
    pub files: u32,
    pub bytes: u64,
    pub pruned: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct RestoreSummary {
    pub restored: Vec<String>,
    pub files: u32,
}

fn wanted(name: &str) -> bool {
    name == MANIFEST || (!name.starts_with('.') && is_supported(Path::new(name)))
}

fn is_link(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(true)
}

fn collect(
    base: &Path,
    dir: &Path,
    depth: usize,
    out: &mut Vec<(String, PathBuf)>,
    total: &mut u64,
) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|e| format!("Cannot read {}: {e}", dir.display()))?;
    let mut paths: Vec<PathBuf> = entries.flatten().map(|e| e.path()).collect();
    paths.sort();
    for path in paths {
        if is_link(&path) {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if path.is_dir() {
            if !name.starts_with('.') {
                collect(base, &path, depth + 1, out, total)?;
            }
        } else if wanted(name) {
            let len = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            if len > MAX_FILE_BYTES {
                return Err(format!("{name} is larger than the 64 MB backup limit."));
            }
            *total += len;
            if *total > MAX_TOTAL_BYTES || out.len() >= MAX_FILES {
                return Err(
                    "The Library is larger than a backup can hold (512 MB or 20,000 files).".into(),
                );
            }
            let rel = path
                .strip_prefix(base)
                .map_err(|_| "Invalid path.")?
                .components()
                .map(|c| c.as_os_str().to_string_lossy().into_owned())
                .collect::<Vec<_>>()
                .join("/");
            out.push((rel, path));
        }
    }
    Ok(())
}

// ---------- zip ----------

fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (
        if m <= 2 {
            yoe + era * 400 + 1
        } else {
            yoe + era * 400
        },
        m,
        d,
    )
}

fn dos_datetime(secs: u64) -> (u16, u16) {
    let (year, month, day) = civil_from_days((secs / 86_400) as i64);
    let rem = secs % 86_400;
    let time = ((rem / 3600) << 11) | (((rem % 3600) / 60) << 5) | ((rem % 60) / 2);
    let date = (((year.clamp(1980, 2107) - 1980) as u64) << 9) | ((month as u64) << 5) | day as u64;
    (time as u16, date as u16)
}

fn crc_of(data: &[u8]) -> u32 {
    let mut crc = Crc::new();
    crc.update(data);
    crc.sum()
}

/// Builds a zip archive in memory. Each entry is deflated when that makes it smaller, stored otherwise.
pub fn zip_bytes(entries: &[(String, Vec<u8>)], now_secs: u64) -> Result<Vec<u8>, String> {
    let (time, date) = dos_datetime(now_secs);
    let mut out: Vec<u8> = Vec::new();
    let mut central: Vec<u8> = Vec::new();
    for (name, data) in entries {
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(data).map_err(|e| e.to_string())?;
        let deflated = encoder.finish().map_err(|e| e.to_string())?;
        let (method, body): (u16, &[u8]) = if deflated.len() < data.len() {
            (8, &deflated)
        } else {
            (0, data)
        };
        let crc = crc_of(data);
        let offset = u32::try_from(out.len()).map_err(|_| "The backup is too large.")?;
        let name_bytes = name.as_bytes();
        let sizes = (
            u32::try_from(body.len()).map_err(|_| "A file is too large.")?,
            u32::try_from(data.len()).map_err(|_| "A file is too large.")?,
        );
        out.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        out.extend_from_slice(&20u16.to_le_bytes());
        out.extend_from_slice(&0x0800u16.to_le_bytes());
        out.extend_from_slice(&method.to_le_bytes());
        out.extend_from_slice(&time.to_le_bytes());
        out.extend_from_slice(&date.to_le_bytes());
        out.extend_from_slice(&crc.to_le_bytes());
        out.extend_from_slice(&sizes.0.to_le_bytes());
        out.extend_from_slice(&sizes.1.to_le_bytes());
        out.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(name_bytes);
        out.extend_from_slice(body);
        central.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&0x0800u16.to_le_bytes());
        central.extend_from_slice(&method.to_le_bytes());
        central.extend_from_slice(&time.to_le_bytes());
        central.extend_from_slice(&date.to_le_bytes());
        central.extend_from_slice(&crc.to_le_bytes());
        central.extend_from_slice(&sizes.0.to_le_bytes());
        central.extend_from_slice(&sizes.1.to_le_bytes());
        central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        central.extend_from_slice(&[0u8; 8]); // extra, comment, disk, internal attrs
        central.extend_from_slice(&0u32.to_le_bytes()); // external attrs
        central.extend_from_slice(&offset.to_le_bytes());
        central.extend_from_slice(name_bytes);
    }
    let count = u16::try_from(entries.len()).map_err(|_| "Too many files for one backup.")?;
    let central_offset = u32::try_from(out.len()).map_err(|_| "The backup is too large.")?;
    let central_size = u32::try_from(central.len()).map_err(|_| "The backup is too large.")?;
    out.extend_from_slice(&central);
    out.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
    out.extend_from_slice(&[0u8; 4]);
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&count.to_le_bytes());
    out.extend_from_slice(&central_size.to_le_bytes());
    out.extend_from_slice(&central_offset.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    Ok(out)
}

struct Item {
    name: String,
    method: u16,
    crc: u32,
    compressed: usize,
    size: usize,
    local: usize,
}

fn u16_at(b: &[u8], at: usize) -> Result<u16, String> {
    b.get(at..at + 2)
        .map(|s| u16::from_le_bytes([s[0], s[1]]))
        .ok_or_else(|| "Damaged zip file.".to_string())
}
fn u32_at(b: &[u8], at: usize) -> Result<u32, String> {
    b.get(at..at + 4)
        .map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
        .ok_or_else(|| "Damaged zip file.".to_string())
}

fn read_directory(bytes: &[u8]) -> Result<Vec<Item>, String> {
    let bad = || "This is not a zip file made by A Good Page.".to_string();
    if bytes.len() < 22 {
        return Err(bad());
    }
    let mut end = bytes.len() - 22;
    loop {
        if u32_at(bytes, end)? == 0x0605_4b50 {
            break;
        }
        if end == 0 || bytes.len() - end > 66_000 {
            return Err(bad());
        }
        end -= 1;
    }
    let count = u16_at(bytes, end + 10)? as usize;
    let mut at = u32_at(bytes, end + 16)? as usize;
    if count > MAX_FILES {
        return Err("This backup has too many files.".into());
    }
    let mut items = Vec::with_capacity(count);
    for _ in 0..count {
        if u32_at(bytes, at)? != 0x0201_4b50 {
            return Err(bad());
        }
        let name_len = u16_at(bytes, at + 28)? as usize;
        let extra = u16_at(bytes, at + 30)? as usize;
        let comment = u16_at(bytes, at + 32)? as usize;
        let name = bytes
            .get(at + 46..at + 46 + name_len)
            .and_then(|n| std::str::from_utf8(n).ok())
            .ok_or_else(bad)?
            .to_owned();
        items.push(Item {
            name,
            method: u16_at(bytes, at + 10)?,
            crc: u32_at(bytes, at + 16)?,
            compressed: u32_at(bytes, at + 20)? as usize,
            size: u32_at(bytes, at + 24)? as usize,
            local: u32_at(bytes, at + 42)? as usize,
        });
        at += 46 + name_len + extra + comment;
    }
    Ok(items)
}

fn entry_data(bytes: &[u8], item: &Item) -> Result<Vec<u8>, String> {
    if item.size as u64 > MAX_FILE_BYTES {
        return Err(format!("{} is larger than the 64 MB limit.", item.name));
    }
    if u32_at(bytes, item.local)? != 0x0403_4b50 {
        return Err("Damaged zip file.".into());
    }
    let start = item.local
        + 30
        + u16_at(bytes, item.local + 26)? as usize
        + u16_at(bytes, item.local + 28)? as usize;
    let body = bytes
        .get(start..start + item.compressed)
        .ok_or("Damaged zip file.")?;
    let data = match item.method {
        0 => body.to_vec(),
        8 => {
            let mut out = Vec::with_capacity(item.size);
            DeflateDecoder::new(body)
                .take(item.size as u64 + 1)
                .read_to_end(&mut out)
                .map_err(|_| "Damaged zip file.")?;
            out
        }
        _ => return Err("This zip uses a compression A Good Page does not read.".into()),
    };
    if data.len() != item.size || crc_of(&data) != item.crc {
        return Err(format!("{} is damaged in the backup.", item.name));
    }
    Ok(data)
}

/// A safe relative path made of ordinary names, ending in a writing file or an order file; otherwise None.
fn safe_parts(name: &str) -> Option<Vec<&str>> {
    let parts: Vec<&str> = name.split('/').collect();
    if parts.is_empty() || parts.len() > MAX_DEPTH + 1 {
        return None;
    }
    let ok = parts.iter().enumerate().all(|(i, part)| {
        !part.is_empty()
            && *part != "."
            && *part != ".."
            && !part.contains(['\\', ':'])
            && !part.chars().any(char::is_control)
            && (i + 1 == parts.len() || !part.starts_with('.'))
    });
    (ok && wanted(parts[parts.len() - 1])).then_some(parts)
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn clean(text: &str, max: usize) -> String {
    let kept: String = text
        .chars()
        .filter(|c| c.is_alphanumeric() || " -_.".contains(*c))
        .take(max)
        .collect();
    let kept = kept.trim().to_owned();
    if kept.is_empty() {
        "backup".into()
    } else {
        kept
    }
}

// ---------- create ----------

/// Zips the Library into `dest_dir` as "<Library> backup <stamp>.zip", then keeps only the newest `keep`.
pub fn create_backup(
    root: &str,
    dest_dir: &str,
    stamp: &str,
    keep: u32,
) -> Result<BackupSummary, String> {
    let base = fs::canonicalize(root).map_err(|e| format!("Cannot open the Library: {e}"))?;
    if !base.is_dir() {
        return Err("The Library is not a folder.".into());
    }
    if dest_dir.trim().is_empty() {
        return Err("Choose a backup folder.".into());
    }
    fs::create_dir_all(dest_dir).map_err(|e| format!("Cannot create the backup folder: {e}"))?;
    let dest =
        fs::canonicalize(dest_dir).map_err(|e| format!("Cannot open the backup folder: {e}"))?;
    if dest.starts_with(&base) || base.starts_with(&dest) {
        return Err(
            "Choose a backup folder outside your Library (and not a folder that holds it).".into(),
        );
    }
    let library = clean(
        &base
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        60,
    );
    let prefix = format!("{library} backup ");
    let mut files = Vec::new();
    let mut total = 0u64;
    collect(&base, &base, 0, &mut files, &mut total)?;
    if files.is_empty() {
        return Err("There is nothing to back up yet.".into());
    }
    let mut entries = Vec::with_capacity(files.len());
    for (rel, path) in &files {
        entries.push((
            rel.clone(),
            fs::read(path).map_err(|e| format!("Cannot read {rel}: {e}"))?,
        ));
    }
    let zip = zip_bytes(&entries, now_secs())?;
    let target = dest.join(format!("{prefix}{}.zip", clean(stamp, 40)));
    write_atomic_bytes(&target, &zip).map_err(|e| format!("Could not save the backup: {e}"))?;
    let mut old: Vec<PathBuf> = fs::read_dir(&dest)
        .map(|rd| rd.flatten().map(|e| e.path()).collect())
        .unwrap_or_default();
    old.retain(|p| {
        p.file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.starts_with(&prefix) && n.ends_with(".zip"))
    });
    old.sort();
    let keep = keep.clamp(1, 200) as usize;
    let mut pruned = 0;
    while old.len() > keep {
        let victim = old.remove(0);
        if victim != target && fs::remove_file(&victim).is_ok() {
            pruned += 1;
        }
    }
    Ok(BackupSummary {
        path: target.to_string_lossy().into_owned(),
        files: files.len() as u32,
        bytes: zip.len() as u64,
        pruned,
    })
}

// ---------- restore ----------

fn unique_name(dir: &Path, name: &str) -> String {
    let path = Path::new(name);
    let (stem, ext) = match path.extension().and_then(|e| e.to_str()) {
        Some(ext) if is_supported(path) => (
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(name)
                .to_owned(),
            format!(".{ext}"),
        ),
        _ => (name.to_owned(), String::new()),
    };
    if !dir.join(name).exists() {
        return name.to_owned();
    }
    let first = format!("{stem} (restored){ext}");
    if !dir.join(&first).exists() {
        return first;
    }
    (2..10_000)
        .map(|n| format!("{stem} (restored {n}){ext}"))
        .find(|candidate| !dir.join(candidate).exists())
        .unwrap_or_else(|| format!("{stem} (restored {}){ext}", now_secs()))
}

/// Puts a backup's projects and pages back next to what is there, never over it: a name already in use is
/// restored as "<name> (restored)". Returns the names that were added to the Library.
pub fn restore_backup(root: &str, zip_path: &str) -> Result<RestoreSummary, String> {
    let base = fs::canonicalize(root).map_err(|e| format!("Cannot open the Library: {e}"))?;
    let bytes = fs::read(zip_path).map_err(|e| format!("Cannot read that backup: {e}"))?;
    if bytes.len() as u64 > MAX_TOTAL_BYTES {
        return Err("That backup is larger than 512 MB.".into());
    }
    let items = read_directory(&bytes)?;
    let mut plan = Vec::new();
    let mut total = 0u64;
    for item in &items {
        if item.name.ends_with('/') {
            continue;
        }
        let Some(parts) = safe_parts(&item.name) else {
            return Err(format!(
                "This zip holds something a backup should not: {}. Nothing was restored.",
                item.name
            ));
        };
        total += item.size as u64;
        if total > MAX_TOTAL_BYTES {
            return Err("That backup is larger than 512 MB.".into());
        }
        plan.push((item, parts));
    }
    if plan.is_empty() {
        return Err("That backup is empty.".into());
    }
    let temp = base.join(format!(".restoring-{}-{}", std::process::id(), now_secs()));
    let result = (|| {
        for (item, parts) in &plan {
            let data = entry_data(&bytes, item)?;
            let target = parts.iter().fold(temp.clone(), |p, part| p.join(part));
            fs::create_dir_all(target.parent().ok_or("Invalid path.")?)
                .map_err(|e| e.to_string())?;
            write_atomic_bytes(&target, &data)
                .map_err(|e| format!("Could not restore {}: {e}", item.name))?;
        }
        let mut tops: Vec<String> = fs::read_dir(&temp)
            .map_err(|e| e.to_string())?
            .flatten()
            .filter_map(|e| e.file_name().to_str().map(str::to_owned))
            .collect();
        tops.sort();
        let mut restored = Vec::new();
        for top in tops {
            let final_name = unique_name(&base, &top);
            fs::rename(temp.join(&top), base.join(&final_name))
                .map_err(|e| format!("Could not place {top}: {e}"))?;
            restored.push(final_name);
        }
        Ok::<_, String>(restored)
    })();
    let _ = fs::remove_dir_all(&temp);
    Ok(RestoreSummary {
        restored: result?,
        files: plan.len() as u32,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> PathBuf {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static N: AtomicUsize = AtomicUsize::new(0);
        let p = std::env::temp_dir().join(format!(
            "agp-backup-{}-{}-{}",
            std::process::id(),
            now_secs(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&p).unwrap();
        fs::canonicalize(p).unwrap()
    }
    fn s(p: &Path) -> &str {
        p.to_str().unwrap()
    }
    fn library() -> PathBuf {
        let root = temp().join("My Library");
        fs::create_dir_all(root.join("Novel")).unwrap();
        fs::create_dir_all(root.join(".trash/1")).unwrap();
        fs::write(root.join("Novel/01.md"), "# One\n\nWörds ".repeat(50)).unwrap();
        fs::write(
            root.join("Novel/.a-good-page.json"),
            r#"{"version":1,"chapters":["01.md"]}"#,
        )
        .unwrap();
        fs::write(root.join("Loose.txt"), "plain").unwrap();
        fs::write(root.join("picture.png"), "not writing").unwrap();
        fs::write(root.join(".secret.md"), "hidden").unwrap();
        fs::write(root.join(".trash/1/gone.md"), "trashed").unwrap();
        root
    }

    #[test]
    fn dates_are_right() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_000), (2024, 10, 4));
        let (t, d) = dos_datetime(1_790_000_000);
        assert_eq!(d >> 9, 2026 - 1980);
        assert!(t > 0);
    }

    #[test]
    fn backs_up_only_writing_files_and_orders_not_trash_or_hidden() {
        let root = library();
        let dest = temp();
        let summary = create_backup(s(&root), s(&dest), "2026-10-03 1432", 5).unwrap();
        assert_eq!(summary.files, 3);
        assert!(summary
            .path
            .ends_with("My Library backup 2026-10-03 1432.zip"));
        let bytes = fs::read(&summary.path).unwrap();
        let mut names: Vec<String> = read_directory(&bytes)
            .unwrap()
            .into_iter()
            .map(|i| i.name)
            .collect();
        names.sort();
        assert_eq!(
            names,
            vec!["Loose.txt", "Novel/.a-good-page.json", "Novel/01.md"]
        );
        for item in read_directory(&bytes).unwrap() {
            if item.name == "Novel/01.md" {
                assert_eq!(item.method, 8, "repeated text should compress");
                assert_eq!(
                    entry_data(&bytes, &item).unwrap(),
                    fs::read(root.join("Novel/01.md")).unwrap()
                );
            }
        }
        fs::remove_dir_all(root.parent().unwrap()).unwrap();
        fs::remove_dir_all(dest).unwrap();
    }

    #[test]
    fn keeps_only_the_newest_backups() {
        let root = library();
        let dest = temp();
        for stamp in ["2026-10-01 0900", "2026-10-02 0900", "2026-10-03 0900"] {
            create_backup(s(&root), s(&dest), stamp, 2).unwrap();
        }
        let mut left: Vec<String> = fs::read_dir(&dest)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        left.sort();
        assert_eq!(
            left,
            vec![
                "My Library backup 2026-10-02 0900.zip",
                "My Library backup 2026-10-03 0900.zip"
            ]
        );
        fs::write(dest.join("unrelated.zip"), "x").unwrap();
        create_backup(s(&root), s(&dest), "2026-10-04 0900", 1).unwrap();
        assert!(dest.join("unrelated.zip").exists());
        fs::remove_dir_all(root.parent().unwrap()).unwrap();
        fs::remove_dir_all(dest).unwrap();
    }

    #[test]
    fn refuses_a_backup_folder_inside_or_around_the_library_and_empty_libraries() {
        let root = library();
        assert!(create_backup(s(&root), s(&root.join("Novel")), "x", 3).is_err());
        assert!(create_backup(s(&root), s(root.parent().unwrap()), "x", 3).is_err());
        assert!(create_backup(s(&root), " ", "x", 3).is_err());
        let empty = temp();
        assert!(create_backup(s(&empty), s(&temp()), "x", 3)
            .unwrap_err()
            .contains("nothing"));
        fs::remove_dir_all(root.parent().unwrap()).unwrap();
    }

    #[test]
    fn restores_next_to_existing_work_and_never_over_it() {
        let root = library();
        let dest = temp();
        let backup = create_backup(s(&root), s(&dest), "2026-10-03 1432", 5).unwrap();
        fs::write(root.join("Novel/01.md"), "changed since").unwrap();
        let result = restore_backup(s(&root), &backup.path).unwrap();
        assert_eq!(result.files, 3);
        assert_eq!(
            result.restored,
            vec!["Loose (restored).txt", "Novel (restored)"]
        );
        assert_eq!(
            fs::read_to_string(root.join("Novel/01.md")).unwrap(),
            "changed since"
        );
        assert!(fs::read_to_string(root.join("Novel (restored)/01.md"))
            .unwrap()
            .starts_with("# One"));
        assert!(root.join("Novel (restored)/.a-good-page.json").exists());
        let again = restore_backup(s(&root), &backup.path).unwrap();
        assert!(again.restored.contains(&"Novel (restored 2)".to_string()));
        assert!(!fs::read_dir(&root)
            .unwrap()
            .flatten()
            .any(|e| e.file_name().to_string_lossy().starts_with(".restoring")));
        fs::remove_dir_all(root.parent().unwrap()).unwrap();
        fs::remove_dir_all(dest).unwrap();
    }

    #[test]
    fn restores_into_an_empty_library_with_the_original_names() {
        let root = library();
        let dest = temp();
        let backup = create_backup(s(&root), s(&dest), "x", 5).unwrap();
        let fresh = temp();
        let result = restore_backup(s(&fresh), &backup.path).unwrap();
        assert_eq!(result.restored, vec!["Loose.txt", "Novel"]);
        fs::remove_dir_all(root.parent().unwrap()).unwrap();
        fs::remove_dir_all(dest).unwrap();
        fs::remove_dir_all(fresh).unwrap();
    }

    #[test]
    fn refuses_unsafe_or_damaged_archives_without_restoring_anything() {
        let fresh = temp();
        let dest = temp();
        for evil in [
            "../escape.md",
            "/abs.md",
            "a/../../b.md",
            "C:/x.md",
            "dir\\x.md",
            "x.exe",
            "a/.hidden/x.md",
            "",
        ] {
            let zip = zip_bytes(
                &[
                    ("ok.md".into(), b"fine".to_vec()),
                    (evil.into(), b"bad".to_vec()),
                ],
                0,
            )
            .unwrap();
            let path = dest.join("evil.zip");
            fs::write(&path, zip).unwrap();
            assert!(restore_backup(s(&fresh), s(&path)).is_err(), "{evil}");
        }
        assert_eq!(fs::read_dir(&fresh).unwrap().count(), 0);
        let mut zip = zip_bytes(&[("a.md".into(), b"hello world".to_vec())], 0).unwrap();
        let at = 30 + 4; // inside the stored data
        zip[at] ^= 0xff;
        let path = dest.join("damaged.zip");
        fs::write(&path, &zip).unwrap();
        assert!(restore_backup(s(&fresh), s(&path)).is_err());
        fs::write(&path, b"not a zip at all").unwrap();
        assert!(restore_backup(s(&fresh), s(&path)).is_err());
        assert_eq!(fs::read_dir(&fresh).unwrap().count(), 0);
        fs::remove_dir_all(fresh).unwrap();
        fs::remove_dir_all(dest).unwrap();
    }
}
