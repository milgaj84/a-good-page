// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('0.5.0 release files', () => {
  it('uses one version everywhere', () => {
    const version = JSON.parse(file('package.json')).version;
    expect(version).toBe('0.5.0');
    expect(JSON.parse(file('src-tauri/tauri.conf.json')).version).toBe(version);
    expect(file('src-tauri/Cargo.toml')).toContain('version = "' + version + '"');
  });
  it('records the release in the changelog', () => {
    expect(file('CHANGELOG.md')).toMatch(/^## \[0\.5\.0\] - \d{4}-\d{2}-\d{2}$/m);
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
  it('organises 0.3.0 around Chapters, Write and Share', () => {
    for (const path of ['src/core/workflow.ts','src/ui/project-guide.ts','src/workflow.css','tests/workflow.test.ts','RELEASE_0.3.0.md'])
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    expect(file('src/ui/manuscript-panel.ts')).toContain('nextStep(');
    expect(file('src/app/manuscript.ts')).toContain('placeShortcut(');
    expect(file('src/stylesheets.ts')).toContain("import './workflow.css';");
  });
  it('keeps the 0.3.1 chapter selection guard and checklist', () => {
    expect(existsSync(new URL('../RELEASE_0.3.1.md', import.meta.url))).toBe(true);
    expect(file('src/ui/manuscript-panel.ts')).toContain('chapterSelection(paths,readable,this.selection,this.selectionRoot===root)');
    expect(file('src/ui/manuscript-panel.ts')).toContain('if(ask&&!root)');
  });
  it('ships 0.3.2 Share status and release checklist', () => {
    expect(existsSync(new URL('../RELEASE_0.3.2.md', import.meta.url))).toBe(true);
    expect(file('src/core/workflow.ts')).toContain('s.save');
  });
  it('ships 0.3.3 preflight and acceptance checklist', () => {
    expect(existsSync(new URL('../RELEASE_0.3.3.md', import.meta.url))).toBe(true);
    const panel = file('src/ui/manuscript-panel.ts');
    expect(panel).toContain('await this.service.verify(snapshot)');
    expect(panel).toContain("this.pdfButton.addEventListener('click',()=>void this.openCheckedPreview())");
    expect(panel).toContain("if(action==='export'){void this.openCheckedPreview();return;}");
  });
  it('ships the 0.3.4 usability checklist and navigation checks', () => {
    expect(existsSync(new URL('../RELEASE_0.3.4.md', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../tests/navigation-surface.test.ts', import.meta.url))).toBe(true);
  });
  it('ships the 0.3.5 chapter row UX checks and release gate', () => {
    expect(existsSync(new URL('../tests/chapter-row-ux.test.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../RELEASE_0.3.5.md', import.meta.url))).toBe(true);
  });
  it('ships the 0.4.0 live Share overview and verified reading gate', () => {
    for (const path of ['src/core/share-overview.ts','tests/share-overview.test.ts','RELEASE_0.4.0.md'])
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    expect(file('src/ui/manuscript-panel.ts')).toContain('this.service.previewVerified(selected)');
  });
  it('ships the 0.5.0 interface fixes', () => {
    for (const path of ['src/ui-fixes.css','tests/ui-fixes.test.ts','RELEASE_0.5.0.md'])
      expect(existsSync(new URL('../' + path, import.meta.url))).toBe(true);
    expect(file('src/stylesheets.ts')).toContain("import './ui-fixes.css';");
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
