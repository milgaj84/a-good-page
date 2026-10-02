# 0.3.4 Calm navigation acceptance

Status: staged in the workbook. No automated run or installed-app validation claimed. Complete the earlier release checklists before publishing.

## Build and source checks
- [ ] Extract all HearthCode rows to their relative paths; run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Verify package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json and the installer all identify 0.3.4.

## First-time writer journey
- [ ] New installation: choose book folder in Chapters without an unsolicited picker; open one chapter, type and save.
- [ ] Chapters next-step Choose a chapter focuses the first enabled chapter title, never silently opens or changes the page.
- [ ] Share: Select all or Clear, choose chapters, read through, see PDF pages and export. Single-page PDF lives under Page PDF; book PDF remains in Share.
- [ ] No folder, empty folder, untitled draft, failed save, missing chapter and stale preview each show a truthful single next step.

## Navigation and accessibility
- [ ] Top bar shows Chapters, Write, Share and Save; More groups New page, Open file, Page PDF and Browse files.
- [ ] Footer keeps Find, Outline, Focus, Aa and More; More offers writing session, theme, all commands and help.
- [ ] Open each menu by keyboard; Escape restores focus to summary, outside click closes, and choosing a button closes the menu while performing the action.
- [ ] Existing shortcuts and command palette entries still work from the editor and appropriate text fields.
- [ ] Leaving and returning to the same book retains selection and the compiled reading view; Refresh chapters invalidates it. Changing folders resets selection.
- [ ] When save status updates, focused next-step action remains focused. Confirm keyboard and screen-reader announcements.
- [ ] Inspect at narrow window widths and all five themes; menus must not be clipped or cover a destructive confirmation.
- [ ] Check quiet screen and full-screen writing, Windows/Linux/macOS click and keyboard behavior, and a real single-page and whole-book PDF.

Record commit, package hash, platform, tester, outcome and any known regressions before publishing. No file format or storage migration is intended.
