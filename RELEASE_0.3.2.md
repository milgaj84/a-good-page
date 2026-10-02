# 0.3.2 Share save-status acceptance

Status: staged in workbook; no build, full test suite, or installed-app verification claimed. Complete the 0.3.0 and 0.3.1 acceptance checklists too.

## Automated gate
- [ ] Extract all HearthCode rows to relative paths. Run npm install, npm run typecheck, npm test, npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Confirm package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json all say 0.3.2.

## Share state regression
- [ ] Compile a readable chapter, then edit the open chapter: the Export PDF step reads blocked and the next-step card asks to save. Export cannot write the stale file.
- [ ] While autosave is in progress the Export PDF step remains blocked.
- [ ] Simulate save failure: Save again outranks other suggestions and Export PDF remains blocked.
- [ ] After a successful save, the Export PDF step becomes current only with a ready preview; source/order rechecks still prevent stale export.
- [ ] With no selection, a missing chapter, or stale pages, earlier step states remain unchanged.

## Installed-app verification
- [ ] Exercise the Share flow on a real installed Linux, macOS and Windows build, including keyboard and screen-reader announcements.
- [ ] Export and inspect a multi-chapter PDF; record commit, package hash, tester and result before publishing.

No file format, manifest, storage key or app identifier change is intended.
