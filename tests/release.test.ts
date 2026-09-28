import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('0.2.3 release files', () => {
  it('uses one version everywhere', () => {
    const version = JSON.parse(file('package.json')).version;
    expect(version).toBe('0.2.3');
    expect(JSON.parse(file('src-tauri/tauri.conf.json')).version).toBe(version);
    expect(file('src-tauri/Cargo.toml')).toContain('version = "' + version + '"');
  });
  it('records the release in the changelog', () => {
    expect(file('CHANGELOG.md')).toMatch(/^## \[0\.2\.3\] - \d{4}-\d{2}-\d{2}$/m);
  });
  it('keeps the Linux rendering fallback conditional and respects overrides', () => {
    const startup = file('src-tauri/src/main.rs');
    expect(startup).toContain('#[cfg(target_os = "linux")]');
    expect(startup).toContain('WEBKIT_DISABLE_DMABUF_RENDERER');
    expect(startup).toContain('needs_dmabuf_fallback');
  });
  it('ships the files GitHub expects', () => {
    for (const path of ['LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', '.github/workflows/ci.yml', '.github/workflows/release.yml']) {
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    }
  });
  it('ships the whole-manuscript project boundary and stale-export guard', () => {
    for (const path of ['src/core/project.ts','src/core/project-service.ts','src-tauri/src/project.rs',
      'src/ui/manuscript-panel.ts','src/export/project-pdf.ts','RELEASE_0.2.0.md'])
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    expect(file('src-tauri/src/lib.rs')).toContain('commands::read_project_order');
    expect(file('src/ui/manuscript-panel.ts')).toContain('this.service.verify(this.snapshot!)');
    expect(file('src/adapters/tauri.ts')).toContain('if (recheck) await recheck()');
  });
  it('ships an inventory and stale-preview refresh for 0.2.1', () => {
    for (const path of ['src/core/project-preview.ts', 'tests/project-preview.test.ts', 'RELEASE_0.2.1.md'])
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    expect(file('src/ui/manuscript-panel.ts')).toContain('previewInventory(');
    expect(file('src/ui/manuscript-panel.ts')).toContain('refreshPreview()');
    expect(file('src/ui/export-preview.ts')).toContain('this.bytes || this.blocked');
  });
  it('ships explicit chapter repair in 0.2.2', () => {
    for (const path of ['src/core/project-relink.ts','src/ui/project-relink.ts',
      'tests/project-relink.test.ts','RELEASE_0.2.2.md'])
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    expect(file('src/core/project-service.ts')).toContain('async relink(');
    expect(file('src/ui/manuscript-panel.ts')).toContain('Relink chapter');
  });
  it('ships the non-destructive project health check in 0.2.3', () => {
    for (const path of ['src/core/project-health.ts','tests/project-health.test.ts','RELEASE_0.2.3.md'])
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    expect(file('src/core/project-service.ts')).toContain('persistOrder = true');
    expect(file('src/ui/manuscript-panel.ts')).toContain('this.load(false)');
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
