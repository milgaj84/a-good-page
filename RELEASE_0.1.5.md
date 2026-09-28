# 0.1.5 acceptance — resume safely

Status: code staged in workbook; full build and installer checks NOT YET VERIFIED. Earlier maintainer-reported green CI results relate to 0.1.3, not 0.1.5.

## Automated checks
- [ ] Extract every code row. Run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on all release targets.
- [ ] Verify platform installers on actual machines; record commit, package hash, OS and date.

## Forced-restart journey
- [ ] Open a named .md file, type Unicode and force-quit after the 500 ms pause but before autosave. Relaunch. Review must show the exact recovered words and disk version; disk remains unchanged until a deliberate save.
- [ ] Reopen after the disk file was changed externally. Resume must leave external disk text intact and autosave paused. Review, Save as a copy or explicit Save must retain both versions without silent overwrite.
- [ ] Force-close again, delete/unmount the manuscript, relaunch and Save as a copy. Cancel the native dialog: recovery remains. Complete the copy: original path is not recreated and recovery clears only after successful write.
- [ ] Press Escape on recovery: record persists through another restart. Explicit Discard removes only the recovery record, never the disk manuscript.
- [ ] Confirm successful save clears the matching recovery record; a failed save, quota error or disabled storage leaves unsaved status and shows a warning. Verify one-slot limitation for two different named manuscripts and pre-existing untitled draft priority.
- [ ] Try .txt, long text, empty document, malformed storage, changes while review is open, keyboard-only focus, narrow window, screen reader labels and reduced motion.

## Caveat
The local recovery record is one named manuscript at a time and is not a backup. A crash before the debounce timer fires may lose the last keystrokes. Keep independent folder backups.
