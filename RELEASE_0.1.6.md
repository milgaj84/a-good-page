# 0.1.6 recovery hardening acceptance

Status: workbook code staged; full CI, Rust and installer testing NOT independently run for 0.1.6. Do not tag solely on focused tests.

## Automated gate
- [ ] Extract all HearthCode paths. Run npm install, npm run typecheck, npm test, npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings, cargo test on Linux, Windows and macOS.
- [ ] Install each release asset on its target OS and verify launch, write, save, restart and recovery. Record commit, asset hash, OS and tester.

## Fourteen reliability scenarios
1. [ ] Two named files recover separately; opening one never erases the other.
2. [ ] A 0.1.5 single-record draft migrates; verify exact UTF-8 words and baseline.
3. [ ] Invalid path, timestamp or text is ignored, not restored into an editor.
4. [ ] Corrupt current or legacy storage is not overwritten by a new recovery write; warn the writer.
5. [ ] Quota failure, unavailable local storage, oversize text and nine documents preserve older entries and show a warning.
6. [ ] A burst of edits resets the 500 ms timer; the latest words, not an intermediate draft, are stored.
7. [ ] Document switch, blur and normal close flush pending named edits before changing editor content.
8. [ ] Esc postpones recovery for one file without blocking backup of a second named file.
9. [ ] Restart offers each pending recovery separately; no automatic overwrite or surprise navigation.
10. [ ] Cancel or fail the Save a copy dialog: no repeated picker loop, exact draft remains locally.
11. [ ] Change disk again while reviewing: Resume is cancelled and latest disk contents appear before another choice.
12. [ ] Pick the original recovery path as copy destination: reject it even when a different file is open.
13. [ ] Close app while recovery dialog is open: it is postponed, never implicitly discarded.
14. [ ] Confirmed save/copy or explicit discard removes only its own recovery record; failed save retains it.

Keep Markdown and .txt behavior distinct, review keyboard focus, high zoom, reduced motion and Unicode. The recovery ledger is local and bounded, not a backup; a crash before the debounce fires can still lose the last keystrokes.
