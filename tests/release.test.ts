// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = (path: string): boolean => existsSync(new URL('../' + path, import.meta.url));

describe('0.7.2 release files', () => {
  it('uses one version everywhere', () => {
    const version = JSON.parse(file('package.json')).version;
    expect(version).toBe('0.7.2');
    expect(JSON.parse(file('src-tauri/tauri.conf.json')).version).toBe(version);
    expect(file('src-tauri/Cargo.toml')).toContain('version = "' + version + '"');
    expect(file('src-tauri/Cargo.lock')).toContain('name = "a-good-page"\nversion = "' + version + '"');
  });
  it('records the release in the changelog', () => {
    expect(file('CHANGELOG.md')).toMatch(/^## \[0\.7\.2\] - \d{4}-\d{2}-\d{2}$/m);
  });
  it('keeps the Linux rendering fallback conditional and respects overrides', () => {
    const startup = file('src-tauri/src/main.rs');
    expect(startup).toContain('#[cfg(target_os = "linux")]');
    expect(startup).toContain('WEBKIT_DISABLE_DMABUF_RENDERER');
    expect(startup).toContain('needs_dmabuf_fallback');
  });
  it('ships the files GitHub expects', () => {
    for (const path of ['LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', '.github/workflows/ci.yml', '.github/workflows/release.yml'])
      expect(exists(path)).toBe(true);
  });
  it('ships the Library: one folder, sidebar, autosaved pages and books', () => {
    for (const path of ['src-tauri/src/library.rs', 'src/app/library.ts', 'src/core/library.ts', 'src/ui/sidebar.ts', 'src/ui/menu.ts', 'src/ui/trash.ts', 'src/core/view-memory.ts', 'RELEASE_0.6.0.md', 'RELEASE_0.6.1.md', 'RELEASE_0.6.2.md', 'RELEASE_0.7.0.md', 'RELEASE_0.7.1.md', 'RELEASE_0.7.2.md'])
      expect(exists(path)).toBe(true);
    const lib = file('src-tauri/src/lib.rs');
    for (const command of ['default_library', 'create_entry', 'rename_entry', 'trash_entry']) expect(lib).toContain('commands::' + command);
    expect(file('src/main.ts')).toContain('new LibraryController(');
  });
  it('keeps a one-click formatting bar that can be switched off', () => {
    const html = file('index.html');
    for (const cmd of ['h1', 'h2', 'h3', 'bold', 'italic', 'bullet', 'link', 'undo']) expect(html).toContain('data-cmd="' + cmd + '"');
    expect(html).toContain('id="toolbar-check"');
    expect(file('src/main.ts')).toContain("app.classList.toggle('no-toolbar', !next.toolbar)");
  });
  it('trashes at once with Undo, remembers where you were, and never autofocuses at the end', () => {
    expect(file('src/app/library.ts')).toContain('offerUndo(');
    expect(file('src/app/library.ts')).not.toContain('confirm(');
    expect(file('src/editor/editor.ts')).toContain('autofocus: false');
    expect(file('src/main.ts')).toContain('new ViewMemory(store)');
  });
  it('organises the Library into projects and pages, with a contents button instead of a sidebar outline', () => {
    const html = file('index.html');
    expect(html).toContain('id="btn-contents"');
    expect(html).toContain('id="outline-pop"');
    expect(html).not.toContain('id="onpage"');
    expect(file('src-tauri/src/lib.rs')).toContain('commands::move_entry');
    expect(file('src/ui/sidebar.ts')).toContain("'project' | 'file' | 'loose'");
    expect(file('src/core/commands.ts')).toContain("'newProject'");
  });
  it('works with many pages: selection, cross-project drops, restore in place, Library-wide search', () => {
    expect(file('index.html')).toContain('id="select-bar"');
    expect(file('src/ui/sidebar.ts')).toContain('moveInto(from: SidebarRow');
    expect(file('src-tauri/src/library.rs')).toContain('pub position: Option<u32>');
    expect(file('src/app/library.ts')).toContain('async trashSelected()');
    expect(file('src/app/library.ts')).toContain('looseText');
    expect(file('src/ui/export-picker.ts')).toContain('PICKS_KEY');
  });
  it('exports to PDF, Word and Markdown, with a title page, contents and page numbers', () => {
    for (const path of ['src/export/docx.ts', 'src/export/zip.ts', 'src/export/markdown.ts', 'src/core/export-options.ts', 'src-tauri/src/export.rs'])
      expect(exists(path)).toBe(true);
    expect(file('src-tauri/src/lib.rs')).toContain('commands::export_document');
    expect(file('index.html')).toContain('id="export-format"');
    expect(file('index.html')).toContain('id="opt-titlepage"');
    expect(file('src/export/pdf.ts')).toContain('tocItem');
    // The Word file is built without a third-party package and without compression.
    expect(JSON.parse(file('package.json')).dependencies).not.toHaveProperty('docx');
  });
  it('moves to the trash instead of deleting', () => {
    const rust = file('src-tauri/src/library.rs');
    expect(rust).toContain('.trash');
    expect(rust.split('#[cfg(test)]')[0]).not.toContain('remove_dir_all');
    // The only file ever removed is the trash's own note about where an item came from.
    for (const call of rust.split('#[cfg(test)]')[0].match(/remove_file\([^)]*\)+/g) ?? []) expect(call).toContain('ORIGIN');
    expect(rust).toContain('pub fn restore(');
  });
  it('uses three lean stylesheets with no blur, grain or blend modes', () => {
    expect(file('src/stylesheets.ts')).toContain("import './base.css';");
    for (const sheet of ['base', 'shell', 'dialogs', 'long-projects']) {
      const css = file('src/' + sheet + '.css');
      expect(css).not.toMatch(/backdrop-filter\s*:\s*blur/);
      expect(css).not.toContain('mix-blend-mode');
      expect(css).not.toContain('mask-image');
    }
  });
  it('builds tagged releases as drafts with the icons generated first', () => {
    const release = file('.github/workflows/release.yml');
    expect(release).toContain("tags: ['v*']");
    expect(release).toContain('tauri-apps/tauri-action');
    expect(release).toContain('releaseDraft: true');
    expect(release).toContain('needs: verify');
    expect(release).toContain('cargo fmt --check');
    expect(release).toContain('cargo test');
    expect(release.indexOf('npm run icons')).toBeLessThan(release.indexOf('tauri-apps/tauri-action'));
  });
  it('runs the same checks in CI that contributors run locally', () => {
    const ci = file('.github/workflows/ci.yml');
    for (const step of ['npm run typecheck', 'npm test', 'cargo test', 'cargo clippy']) expect(ci).toContain(step);
  });
});
