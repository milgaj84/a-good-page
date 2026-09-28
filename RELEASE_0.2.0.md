# 0.2.0 whole-manuscript release acceptance

Status: source table staged; full CI, native installers and actual book PDFs have NOT been verified for this version. Earlier green runs concerned previous releases.

## Build gate
- [ ] Extract all HearthCode files; npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings, cargo test on Linux, macOS and Windows.
- [ ] Build and install each release asset on its target platform; record commit, tester, OS, hash and outcome.

## Project journey
- [ ] Choose a folder with Markdown, text, nested chapters and non-writing assets. Only writing chapters appear; no source files move or change when reordered.
- [ ] Reorder chapters and quit/reopen; check .a-good-page.json persists order and new chapters append. Simulate an outside manifest edit; reject stale reorder without overwriting it.
- [ ] Verify project outline jumps to a heading and search opens the correct chapter/result, with total hits across the complete scanned set.
- [ ] Test missing, unreadable and symlinked chapter files, an unreadable subfolder, over-200 chapters and over-four-level nesting; do not silently compile a partial book.
- [ ] Select a subset, compile read-only view, preview actual A4 pages in both layouts and export PDF. Confirm chapter breaks, word-count/title display, UTF-8 and .txt literal text. Reopen the original chapters and confirm no modifications.
- [ ] Modify a selected chapter, delete one, or change project order after preview; export must refuse and request a refresh. Repeat while the native Save dialog is open.
- [ ] Cancel export destination; nothing written and preview remains. A failed PDF save must not mark any chapter saved.
- [ ] Check keyboard access, screen-reader labels, small window, dark/light themes and reduced motion.

## Scope
This release deliberately does not add cloud sync, automatic merges, or a workspace-wide editor. The project order manifest lives beside the writer's files and is limited to 200 chapters; keep backups.
