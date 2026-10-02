# 0.3.3 PDF preview source preflight

Status: staged in workbook; no build, automated-test run, or installer verification claimed. Complete the 0.3.0–0.3.2 checklists too.

## Automated gate
- [ ] Extract every HearthCode row to its relative path. Run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Confirm all three version manifests and built installers identify 0.3.3.

## Preview and export
- [ ] Compile selected chapters; change one on disk, then press See PDF pages: stale PDF pages do not open; the chapter is identified and Refresh pages is offered.
- [ ] Repeat using the Share next-step card rather than the See PDF pages button.
- [ ] Edit .a-good-page.json after compiling: PDF pages do not open from the stale selection.
- [ ] Save an unsaved open chapter first; an in-progress or failed save cannot open the PDF pages.
- [ ] Refresh pages after a changed source: the updated selection renders and can export only after rechecks.
- [ ] Change a chapter after opening the preview: export remains blocked by the existing guard; test changes during the native Save dialog too.
- [ ] A cancelled native Save dialog does not write a PDF or change chapter files.

## Installed-app gate
- [ ] On Linux, macOS and Windows, verify keyboard navigation, the error announcement and a real multi-chapter PDF. Record commit, package hash, platform, tester and outcome before publishing.

No file format, order manifest, storage key or app identifier migration is intended.
