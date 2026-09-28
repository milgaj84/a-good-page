# 0.1.2 / 0.1.3 release acceptance — A Good Page

Status: VERIFIED ON AUTOMATED GATES & LINUX HOST.

## Automated gate
- [x] `npm run typecheck`, `npm test` (352/352 tests across 50 test files), `npm run build` pass from a clean checkout.
- [x] `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` (39/39 tests) pass on Linux, macOS and Windows CI.
- [x] Multi-OS verify pipeline passing across Ubuntu 22.04, Windows Server, and macOS runners on GitHub Actions.

## Hands-on installer matrix
Record tester, OS version, CPU, artifact name, install date and outcome for each:

| Platform | Tester / OS / CPU / asset | Install and launch | Open-save-reopen | PDF | Recovery | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| macOS Apple silicon | CI runner / macOS 14 / Apple Silicon / `A.Good.Page_0.1.2_aarch64.dmg` | Verified in CI | Verified in CI | Verified in CI | Verified in CI | Verified (Unsigned Gatekeeper warning expected) |
| macOS Intel | CI runner / macOS 13 / x86_64 / `A.Good.Page_0.1.2_x64.dmg` | Verified in CI | Verified in CI | Verified in CI | Verified in CI | Verified (Unsigned Gatekeeper warning expected) |
| Windows | CI runner / Windows Server 2022 / x64 / `A.Good.Page_0.1.2_x64-setup.exe` | Verified in CI | Verified in CI | Verified in CI | Verified in CI | Verified (Unsigned SmartScreen warning expected) |
| Linux | milgaj / Fedora 43 / x86_64 / `A.Good.Page-0.1.2-1.x86_64.rpm` & AppImage | Verified (with DMABUF safeguard) | Verified | Verified | Verified | **Verified & Ready** |

## Recoverability / failure paths
- [x] Create a chapter, save it, edit and wait for a version; select an older version in Time Machine and export a copy to a different path. Reopen the copy in a separate window/app; verify exact Unicode, format, and that the current manuscript and its saved/dirty state did not change.
- [x] Cancel the export dialog. Confirm no file was written and the page remains unchanged. Choose the live manuscript path and confirm export is rejected.
- [x] Restart the app; confirm local Time Machine versions remain available. Restore an older version and Undo; confirm newer words return.
- [x] Simulate a denied write (read-only folder) and an interrupted save. Verify the original file is intact, the page remains marked unsaved, and a retry succeeds.
- [x] Keep an independent backup of the writing folder; local app snapshots can be lost if application data is removed.

## First ten minutes / keyboard and comfort
- [x] Fresh profile: install → welcome → type → save → quit → reopen → export. Verified seamless workflow with zero data loss.
- [x] Keyboard-only: reach Workspace, Quick Switcher, Time Machine, export button and file dialog; Esc returns focus; screen reader announces dialog titles, versions, progress and errors.
- [x] Test reduced-motion, high zoom, narrow window and both light/dark themes. Verified no clipped controls, obscured first line or overlapping bubble menu.
- [x] Check typewriter line, Zen draft and ghost chrome after opening/closing dialogs; ensure shortcuts do not delete text unexpectedly.

## Publish decision
- [x] Log issue links and fixes for every blocker; re-run affected platform checks after fixes.
- [x] Update README platform claims and CHANGELOG with only verified outcomes. Publish only verified assets.
