# 0.3.1 Share selection acceptance

Status: staged in the workbook, not validated as an installed release. Do not publish based on the workbook edits alone. Complete the 0.3.0 acceptance checklist as well.

## Automated gate
- [ ] Extract all HearthCode rows to their relative paths and run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Confirm package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json all say 0.3.1; inspect the built installer version.

## Share selection regression
- [ ] Untick all chapters, press Refresh chapters: none are reticked; Share asks you to choose chapters.
- [ ] Tick one chapter, refresh the same folder: only that chapter stays ticked, provided it is readable.
- [ ] Switch to a different book folder containing a chapter with the same relative name: all readable chapters in the new book start selected, not the old selection.
- [ ] Cancel Change book folder: no reload, selection change, chapter order write or preview reset.
- [ ] A missing or unreadable chapter is never ticked automatically; the health report still blocks export where required.
- [ ] A changed source still blocks export before and after the native Save dialog; Refresh pages is required.

## Installed-app checks
- [ ] Verify Chapters → Write → Share shortcuts, focus and next-step copy with keyboard and screen reader.
- [ ] Exercise folder switching and cancellation on Linux, macOS and Windows; record commit, package hash, tester and outcome.
- [ ] Export and inspect a real multi-chapter PDF. Recheck conflicts, recovery and the scenarios in RELEASE_0.3.0.md.

No file format, project manifest, storage key or app identifier migration is intended. Keep backups of chapters and .a-good-page.json.
