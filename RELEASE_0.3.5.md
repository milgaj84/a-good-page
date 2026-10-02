# 0.3.5 Contextual chapter selection acceptance

Status: staged in the workbook; source edits are not an installed-app validation. Complete 0.3.0–0.3.4 release gates as well.

## Automated gate
- [ ] Extract all HearthCode rows to relative paths; run npm install, npm run typecheck, npm test, npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Confirm the three version manifests and the built installer report 0.3.5.

## Chapters versus Share
- [ ] In Chapters, selecting an enabled title opens that file; the Share checkbox is not visible. A missing chapter cannot be opened.
- [ ] In Share, clicking a chapter title toggles its associated checkbox without opening the file or leaving Share. Space on the checkbox does the same.
- [ ] Missing or unreadable chapters cannot be selected by label, pointer or keyboard; project health still reports them.
- [ ] Switching Chapters → Write → Share rebuilds Share rows as selection labels and retains the same-book selection and preview. Switching back restores open-title buttons.
- [ ] Changing the selection invalidates the compiled preview; checking an already-checked state does not. Select all and Clear remain consistent.
- [ ] Folder change and refresh still reconcile selections without silently reticking an explicitly empty selection.
- [ ] Stale chapter text or order still blocks PDF pages and export until refresh; test before and after native Save dialog.

## Installed-app review
- [ ] Inspect each of five themes, narrow window, keyboard tab order and screen-reader labels on Linux, macOS and Windows.
- [ ] Export and inspect a real multi-chapter PDF. Record commit, package hash, platform, tester and outcome before publishing.

No file format, project manifest, storage key or identifier migration is intended.
