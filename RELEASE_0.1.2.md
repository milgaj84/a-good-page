# 0.1.2 acceptance — external edits

Status: historical checklist retained. The maintainer reports CI and a full writing-journey check; this workbook does not independently certify each item or a new 0.1.3 installer.

## Automated checks
- [ ] From a clean checkout: npm install && npm run typecheck && npm test && npm run build.
- [ ] In src-tauri: cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test on Linux, macOS and Windows.
- [ ] Run release draft builds; publish only tested installers. Code stored in Excel is not a compiled installer.

## Conflict scenarios on each supported platform
- [ ] Open a named .md chapter, edit in A Good Page, edit the same path in another editor, then wait for autosave. Disk must retain the outside version and A Good Page must show a conflict.
- [ ] Review changes; verify the two copies are identified and no text is silently changed. Long comparison may show only 300 paragraphs per side; original files retain full content.
- [ ] Choose Keep writing. Autosave remains paused; explicit Save rechecks. Restore the original disk contents externally, save explicitly, then reopen and verify the complete current draft.
- [ ] Reproduce the conflict and choose Reload from disk. Confirm the external text opens, the prior draft remains in Time Machine, and the writer was warned that in-memory edits will be replaced. Simulate a snapshot-storage failure and ensure Reload is cancelled. Confirm recovery snapshots remain accessible as applicable.
- [ ] Reproduce and choose Save my version as a copy. Confirm the outside file is unchanged; the new file contains the full current draft and becomes the open file.
- [ ] Try an already-existing Save As path. It must not be replaced; choose a fresh name and retry. A cancelled native dialog must leave the page intact.
- [ ] Delete or move the open file from another app. Autosave must not recreate it. Reload should be unavailable; saving a copy must work.
- [ ] Race two queued autosaves with another editor and retest a failed/restarted save. Report any loss of data or duplicate prompt as a blocker.
- [ ] Verify .txt saves remain literal and Unicode round-trips. Check keyboard-only access, screen reader labels and focus restoration in the conflict dialog, narrow window and reduced motion.

## Limitation
The compare-and-write check is immediate but is not a transaction agreed to by other editors. A non-cooperating process can write in the narrow gap before this app renames its file. Keep independent backups and report cross-app race findings before release.

## Maintainer report (not independently reproduced in this workbook)
The maintainer reported 352/352 frontend tests, 39/39 Rust tests, clean typecheck/build/fmt/clippy and multi-OS CI run 36383730904; physical Linux Fedora 43 Wayland/X11 was reported tested. This historical report does not verify a new 0.1.3 build or macOS/Windows installer launch. Record asset-level results separately.
