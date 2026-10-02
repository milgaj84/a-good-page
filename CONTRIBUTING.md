# Contributing to A Good Page

Thanks for helping. A Good Page is a small, quiet writing app, so changes should
keep the page calm and the writer's files safe.

## Getting started

    npm install
    npm run icons
    npm run tauri dev

You need Node.js 20+, stable Rust and the Tauri 2 system packages for your OS
(https://v2.tauri.app/start/prerequisites/).

## Before opening a pull request

    npm run typecheck
    npm test
    cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test

CI runs the same checks on Linux, macOS and Windows.

## How the code is laid out

- `src/core/` holds plain TypeScript logic with no DOM or Tauri imports. Add tests in `tests/` first.
- `src/ui/` holds DOM components. They receive their dependencies through constructors.
- `src/adapters/` is the only place that talks to Tauri, localStorage or IndexedDB.
- `src/app/` wires features into `src/main.ts`, the composition root.
- Keep every file under 500 lines and 25,000 characters. Split a file before it reaches the limit.

## Ground rules

- Never change the `app.hearth.writer` identifier or `hearth.*` storage keys without a tested migration.
- Anything that writes to disk goes through the existing save queue.
- New screen elements respect reduced motion and full-screen writing.
- Update `README.md`, the in-app Help and `CHANGELOG.md` when behaviour changes.

## Releasing

1. Move the `Unreleased` notes in `CHANGELOG.md` under a new version heading.
2. Set the same version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
3. Commit, then tag: `git tag v0.6.1 && git push origin v0.6.1`.
4. The Release workflow builds installers and creates a draft GitHub release. Install and test each asset against `RELEASE_0.6.0.md`, `RELEASE_0.6.1.md` and `RELEASE_CHECKLIST.md` (and the 0.1.x recovery checklists) on its target platform. Publish only verified assets.
