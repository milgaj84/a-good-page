# 0.2.3 project health acceptance

Status: workbook code staged, full application build and installed-app checks NOT verified for 0.2.3. Do not use earlier CI runs as proof of this release.

## Automated gate
- [ ] Extract every HearthCode file; run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Install actual packages; record commit, platform, package hash, tester and result.

## Project health scenarios
- [ ] Empty folder: no false errors; project is not ready to compile.
- [ ] Healthy folder: correct total/readable chapters and numeric word count, no false warnings.
- [ ] Missing and unreadable chapters: separate named blocking issues. Compilation remains blocked; neither chapter is silently dropped.
- [ ] Empty chapter: advisory only. Decide whether it belongs in the manuscript.
- [ ] Rename a chapter and leave a new untracked file: Check project health must report both without writing the manifest. Relink explicitly and confirm the health report updates without modifying prose.
- [ ] Add a new chapter to an otherwise healthy project: Check project health does not change .a-good-page.json; Refresh chapters may append it safely. Reopen and confirm order.
- [ ] Disconnect a folder or fail a scan: show an error rather than a partial healthy report. Repeat at four-level and 200-folder/chapter boundaries.
- [ ] Verify keyboard navigation, screen-reader health announcements, narrow viewport, reduced motion and both themes.
- [ ] Compile and export after repairs. Confirm selected chapters and order in preview/PDF, and that stale-source checks still block changed input.

Health diagnostics are hints, not automatic file repair. Keep independent backups of chapters and .a-good-page.json.
