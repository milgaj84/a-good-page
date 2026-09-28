# 0.1.1 release acceptance — A Good Page

Status: historical checklist retained. The maintainer reports the automated gates and Fedora hardware checks passed; the checkboxes below are not independently evidenced by this workbook. A green build is not an installer launch test.

## Automated gate
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass from a clean checkout.
- [ ] `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` pass on Linux, macOS and Windows.
- [ ] Draft installers appear only after the three-OS verify job passes; inspect each artifact name and size.

## Hands-on installer matrix
Record tester, OS version, CPU, artifact name, install date and outcome for each:

| Platform | Tester / OS / CPU / asset | Install and launch | Open-save-reopen | PDF | Recovery | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| macOS Apple silicon | Not tested | Pending | Pending | Pending | Pending | Hold |
| macOS Intel | Not tested | Pending | Pending | Pending | Pending | Hold |
| Windows | Not tested | Pending | Pending | Pending | Pending | Hold |
| Linux | Not tested | Pending | Pending | Pending | Pending | Hold |

For each row: install the actual downloaded asset; start the app; create a Markdown file; type Unicode; save, quit, relaunch and reopen it; export and open a PDF. Repeat with a `.txt` file, confirming punctuation stays literal and Markdown styling is not introduced. Note unsigned-installer warnings honestly; do not tell users to bypass warnings from untrusted downloads. Hold any asset whose checks fail.

## Recoverability / failure paths
- [ ] Create a chapter, save it, edit and wait for a version; select an older version in Time Machine and export a copy to a different path. Reopen the copy in a separate window/app; verify exact Unicode, format, and that the current manuscript and its saved/dirty state did not change.
- [ ] Cancel the export dialog. Confirm no file was written and the page remains unchanged. Choose the live manuscript path and confirm export is rejected.
- [ ] Restart the app; confirm local Time Machine versions remain available. Restore an older version and Undo; confirm newer words return.
- [ ] Simulate a denied write (read-only folder) and an interrupted save. Verify the original file is intact, the page remains marked unsaved, and a retry succeeds. Do not claim power-loss durability from CI alone.
- [ ] Keep an independent backup of the writing folder; local app snapshots can be lost if application data is removed.

## First ten minutes / keyboard and comfort
- [ ] Fresh profile: install → welcome → type → save → quit → reopen → export. Record any confusing wording or dead end and fix it before publication.
- [ ] Keyboard-only: reach Workspace, Quick Switcher, Time Machine, export button and file dialog; Esc returns focus; screen reader announces dialog titles, versions, progress and errors.
- [ ] Test reduced-motion, high zoom, narrow window and both light/dark themes. Verify no clipped controls, obscured first line or overlapping bubble menu.
- [ ] Check typewriter line, Zen draft and ghost chrome after opening/closing dialogs; ensure shortcuts do not delete text unexpectedly.

## Publish decision
- [ ] Log issue links and fixes for every blocker; re-run affected platform checks after fixes.
- [ ] Update README platform claims and CHANGELOG with only verified outcomes. Publish only verified assets; leave the release as draft otherwise.

## Maintainer report (not independently reproduced in this workbook)
The maintainer reported 352/352 frontend tests, 39/39 Rust tests, clean typecheck/build/fmt/clippy and multi-OS CI run 36383730904; physical Linux Fedora 43 Wayland/X11 was reported tested. This historical report does not verify a new 0.1.3 build or macOS/Windows installer launch. Record asset-level results separately.
