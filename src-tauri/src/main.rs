// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn needs_dmabuf_fallback(value: Option<&std::ffi::OsStr>) -> bool {
    value.is_none()
}

#[cfg(target_os = "linux")]
fn configure_webkit() {
    // Work around WebKitGTK DMABUF crashes/blank windows on affected Wayland systems.
    // Respect an explicit override from the writer or their desktop environment.
    if needs_dmabuf_fallback(std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").as_deref()) {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_webkit();
    a_good_page_lib::run()
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    #[test]
    fn fallback_only_when_no_override_exists() {
        assert!(needs_dmabuf_fallback(None));
        assert!(!needs_dmabuf_fallback(Some(OsStr::new("0"))));
        assert!(!needs_dmabuf_fallback(Some(OsStr::new("1"))));
        assert!(!needs_dmabuf_fallback(Some(OsStr::new(""))));
    }
}
