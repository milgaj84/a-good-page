import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('0.3.5 contextual chapter rows', () => {
  const panel = source('src/ui/manuscript-panel.ts');
  it('rebuilds rows whenever an already loaded book switches places', () => {
    expect(panel).toContain('if(this.loaded&&this.selectionRoot===this.deps.root())this.draw();');
    expect(panel).not.toContain('if(wasOpen&&this.loaded)this.draw();');
  });
  it('uses a real checkbox label in Share and an open button in Chapters', () => {
    expect(panel).toContain("if(this.place==='share'){");
    expect(panel).toContain("make('label','manuscript-name'");
    expect(panel).toContain('label.htmlFor=check.id');
    expect(panel).toContain("make('button','manuscript-name'");
    expect(panel).toContain('this.deps.openChapter(root,entry.path)');
  });
  it('does not select unavailable chapters or invalidate preview on a no-op', () => {
    expect(panel).toContain('check.disabled=!entry.file');
    expect(panel).toContain('if(check.checked===this.selection.has(entry.path))return;');
  });
});
