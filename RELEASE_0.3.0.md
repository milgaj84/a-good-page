# 0.3.0 Chapters · Write · Share acceptance

Status: workbook code staged; full application build and installed-app checks NOT verified for 0.3.0. Do not use earlier CI runs as proof of this release.

## Automated gate
- [ ] Extract every HearthCode file; run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Install actual packages; record commit, platform, package hash, tester and result.

## Places
- [ ] The top bar shows Chapters · Write · Share; the current place is highlighted and announced (aria-current).
- [ ] Ctrl/Cmd+Shift+1/2/3 switch places from the page, from a text field and while the project page is open. No other shortcut fires twice.
- [ ] Esc, Back to writing and the Write tab all return to the page with the editor focused; the top tabs follow.
- [ ] The Chapters tab, Ctrl/Cmd+Shift+1 and the palette entries (Chapters, Write, Share your book) open the right place.

## Next step card
- [ ] Fresh install, no folder: "Choose your book folder" opens the native picker only when pressed; cancelling leaves nothing changed.
- [ ] Empty folder: "Start your first chapter". Folder with a missing chapter: "Fix 1 chapter" scrolls to project health; nothing is relinked automatically.
- [ ] Unsaved untitled draft: "Name this draft" runs the normal Save dialog.
- [ ] A failed save outranks every other suggestion.

## Share
- [ ] Steps move from Choose chapters → Read it through → Export PDF, and show blocked for missing chapters or changed sources.
- [ ] Unsaved open chapter: Share asks to save first; compile and export still refuse dirty input.
- [ ] Edit a chapter elsewhere after reading it through: export is blocked, the card says "A chapter changed" and Refresh pages restores export.
- [ ] Exported PDF contains only ticked chapters, in book order.

## Save words
- [ ] Beside the title: Saved, Saving soon, Saving…, Not saved yet, Kept on this device, Save failed · press Save. Hidden under 760px width.

## Regression (all previous hardening)
- [ ] Conflict dialog, outside-change notice, named recovery (eight records), Save As refusal of existing files, Time Machine restore/export, DMABUF fallback on Linux.
- [ ] Manifest limits, symlink rejection, explicit relink, read-only health check, stale-export rechecks before and after the Save dialog.
- [ ] Keyboard-only navigation, screen reader, narrow viewport, reduced motion and every theme.

The new places are navigation only; no file format, manifest or storage key changed. Keep independent backups of chapters and .a-good-page.json.
