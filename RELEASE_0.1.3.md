# 0.1.3 release check — conflict clarity and Linux startup

Status: source changes staged in the Excel code table. No 0.1.3 build or installer launch is claimed here. The maintainer reported earlier CI run 36383730904 and Fedora 43 physical testing; those results predate this workbook's 0.1.3 changes.

## Automated gate (record command, commit and result)
- [ ] Extract the full table and run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test in src-tauri on Linux, macOS and Windows.
- [ ] Inspect the draft release assets; do not publish a platform without testing its actual installer.

## Conflict and recovery walk-through
- [ ] Open a chapter, edit it in another app, then queue two autosaves before the first settles. Confirm one conflict prompt, no overwrite and no second queued disk write; deliberate Save may retry.
- [ ] Check that the dialog identifies the correct file and offers a side-by-side review. On a missing or unreadable file, it says "unavailable" rather than claiming it was deleted. For an occupied Save As filename, it says nothing was replaced and prompts for another name.
- [ ] Check that Keep safety snapshot & reload actually preserves the draft in Time Machine before replacing the page. If snapshot storage fails or the writer types new words while the dialog is open, confirm those words are not discarded.
- [ ] Check keyboard focus, Escape, reduced motion, narrow widths, .md and .txt, Unicode, and unchanged dirty-state behavior after cancellation or failed Save.

## Linux startup and platform claims
- [ ] On Fedora 43 Wayland and X11, test the actual new installer: launch and write a document. With WEBKIT_DISABLE_DMABUF_RENDERER unset, confirm the default is applied; when explicitly set, confirm it is respected. Check X11/Wayland behavior with display logs.
- [ ] Test macOS Apple silicon, macOS Intel and Windows installer assets on machines before labeling them hardware-verified; CI passing is a different claim.
- [ ] Retain the comparison-and-write race caveat and unsigned-installer warning in README. Record tester, OS, asset hash, commit, date and pass/fail in this document when performed.
