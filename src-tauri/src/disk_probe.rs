/** Snapshot of the open file on disk, without changing it. */
use crate::document::{normalize_text, MAX_DOCUMENT_BYTES};
use serde::Serialize;
use std::{fs, io, path::Path};

#[derive(Serialize)]
#[serde(tag = "kind", content = "content", rename_all = "lowercase")]
pub enum DiskProbe {
    Present(String),
    Missing,
    Unreadable,
}

pub fn probe(path: &str) -> DiskProbe {
    if path.trim().is_empty() {
        return DiskProbe::Unreadable;
    }
    if let Ok(metadata) = fs::metadata(path) {
        if metadata.len() > MAX_DOCUMENT_BYTES {
            return DiskProbe::Unreadable;
        }
    }
    match fs::read(Path::new(path)) {
        Ok(bytes) => match String::from_utf8(bytes) {
            Ok(text) => DiskProbe::Present(normalize_text(&text)),
            Err(_) => DiskProbe::Unreadable,
        },
        Err(error) if error.kind() == io::ErrorKind::NotFound => DiskProbe::Missing,
        Err(_) => DiskProbe::Unreadable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_and_blank_paths_have_distinct_states() {
        assert!(matches!(probe(""), DiskProbe::Unreadable));
        let path = std::env::temp_dir().join(format!("agp-probe-missing-{}", std::process::id()));
        assert!(matches!(probe(path.to_str().unwrap()), DiskProbe::Missing));
    }
}
