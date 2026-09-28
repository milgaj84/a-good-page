# 0.1.4 release acceptance — outside changes without surprises

Status: workbook source staged, NOT built or installed for 0.1.4. Maintainer-reported green run 36386040057 and commit e051a37 concern 0.1.3, not these changes.

## Build and CI
- [ ] Extract every row of HearthCode, then npm install && npm run typecheck && npm test && npm run build.
- [ ] From src-tauri: cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test on Linux, Windows and macOS.
- [ ] Install actual new release assets; distinguish CI from real machine coverage.

## Outside-file behavior
- [ ] Edit the open file in another editor and return to A Good Page. One persistent notice identifies it; no automatic reload or disk write occurs.
- [ ] Refresh Workspace and confirm the same check runs. Repeated focus and refresh events produce no stacked dialogs.
- [ ] Remove the open file: notice says missing. Deny reads or disconnect a drive: notice says unreadable, not deleted. Once reachable again, recheck and clear the notice if unchanged.
- [ ] Open Review; inspect both versions; change the disk file again before choosing Reload or Save a copy. The stale choice must cancel and prompt another review. Type while reviewing: Reload must not discard the new words.
- [ ] Keep writing leaves autosave paused. Queued autosaves do not write after detection. Explicit Save rechecks; a separately named copy never overwrites a pre-existing destination.
- [ ] Confirm safety snapshot before Reload, correct .md/.txt copy names, UTF-8 preservation, keyboard focus, narrow window, and reduced-motion presentation.

## Honesty and residual risk
- [ ] Note that the app's pre-write check is not a cross-application compare-and-swap. Verify README platform claims and unsigned-installer notice; record tester, commit, OS, asset hash and outcome.
