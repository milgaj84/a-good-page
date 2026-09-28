# 0.1.2 release acceptance — external edits

Status: AUTOMATED CHECKS & CONFLICT MATRIX VERIFIED.

## Automated checks
- [x] From a clean checkout: npm install && npm run typecheck && npm test (352 tests) && npm run build.
- [x] In src-tauri: cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test (39 tests) on Linux, macOS and Windows.
- [x] Release draft builds generated and verified on GitHub Actions runners.

## Conflict scenarios verified on supported platforms
- [x] Open a named .md chapter, edit in A Good Page, edit the same path in another editor, then wait for autosave. Disk retains the outside version and A Good Page shows conflict dialog.
- [x] Review changes; verify the two copies are identified and no text is silently changed.
- [x] Choose "Keep writing": Autosave remains paused; explicit Save rechecks.
- [x] Choose "Reload from disk": Outside text loads, prior in-memory draft preserved in Time Machine.
- [x] Choose "Save my version as a copy": Outside file is untouched; new file contains full current draft and becomes active file.
- [x] Trying an already-existing Save As path is blocked; user chooses fresh path. Cancelled dialog leaves page intact.
- [x] External file deletion detected; autosave does not blindly recreate missing file without destination.
- [x] Literal .txt handling and Unicode preserved across round-trips.

## Platform notes & honest limitations
- Unsigned builds: macOS Gatekeeper and Windows SmartScreen show standard unsigned software warnings until codesigning certificates are attached.
- Linux Wayland: On modern Wayland compositors using WebKitGTK 4.1, hardware DMABUF acceleration can fail with protocol errors. A Good Page sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` automatically to guarantee reliable rendering out of the box.
- Concurrency limitation: Compare-and-write is immediate, but does not lock the file against non-cooperating processes that write in the millisecond before renaming. Writers are encouraged to keep independent backups of critical work.
