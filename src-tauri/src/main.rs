// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // On Linux Wayland compositors with WebKitGTK 4.1, hardware DMABUF renderers
        // can fail with protocol errors or blank displays. Disable DMABUF by default if unset.
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    a_good_page_lib::run()
}
