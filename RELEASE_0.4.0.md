# 0.4.0 Live Share readiness acceptance

Status: staged source in workbook, not a verified installer. Complete previous 0.3.x release gates before publishing.

## Automated gate
- [ ] Extract all HearthCode files; run npm install, npm run typecheck, npm test and npm run build.
- [ ] Run cargo fmt --check, cargo clippy --all-targets -- -D warnings and cargo test on Linux, macOS and Windows.
- [ ] Confirm package.json, Cargo.toml, tauri.conf.json and installed package all report 0.4.0.

## Share readiness
- [ ] With no book, an empty book, no selected chapters or missing files, show truthful counts and guidance; never count an unreadable chapter as selected.
- [ ] Tick and untick titles, Select all and Clear: selected chapter and word totals update immediately; no arbitrary page count is claimed.
- [ ] Read it through with unchanged disk files: preview includes selected chapters in book order and the overview shows export-ready status.
- [ ] Edit or remove a selected chapter, or edit project order after loading: Read it through refuses stale content, names the issue, clears any old reading view and prompts Refresh chapters.
- [ ] Change selection while disk verification is pending: older result never overwrites the newer selection or preview.
- [ ] Failed source recheck and failed save do not export a PDF; PDF pages and native Save dialog retain independent source rechecks.
- [ ] Refresh pages after a changed chapter: selected totals, reading view and exported PDF agree.

## Accessibility and platforms
- [ ] Inspect keyboard flow, screen reader summary, narrow layouts, all themes and reduced motion on installed Linux, macOS and Windows packages.
- [ ] Export and inspect a real multi-chapter PDF. Record commit, package hash, platform, tester and outcome.

No project manifest, manuscript file format, storage key or app identifier migration is intended.
