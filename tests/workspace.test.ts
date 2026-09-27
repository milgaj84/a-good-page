import { describe, expect, it } from 'vitest';
import { WorkspaceHistory, ACTIVE_WORKSPACE_KEY, RECENT_WORKSPACES_KEY, suggestedSavePath, filterWorkspaceItems, nextWorkspaceIndex } from '../src/core/workspace';
import type { KeyValueStore } from '../src/core/ports';
function store(): KeyValueStore & { data: Map<string,string> } {
  const data = new Map<string,string>();
  return { data, get: key => data.get(key) ?? null, set: (key,value) => { data.set(key,value); }, remove: key => { data.delete(key); } };
}
describe('recent working directories', () => {
  it('keeps five most recent unique successful selections', () => {
    const s=store(), history=new WorkspaceHistory(s);
    ['a','b','c','d','e','f','b'].forEach(path => history.select(path));
    expect(history.recent).toEqual(['b','f','e','d','c']);
    expect(history.active).toBe('b');
    expect(new WorkspaceHistory(s).recent).toEqual(history.recent);
  });
  it('places a new file in the current Unix or Windows subfolder', () => {
    expect(suggestedSavePath('/books/chapters', 'New.md')).toBe('/books/chapters/New.md');
    expect(suggestedSavePath('C:\\Books\\Drafts', 'New.md')).toBe('C:\\Books\\Drafts\\New.md');
    expect(suggestedSavePath(null, 'New.md')).toBe('New.md');
  });
  it('filters one visible folder case-insensitively without changing the source', () => {
    const items=[{name:'Chapter One.md'},{name:'ideas.txt'},{name:'chapter two.MD'}];
    expect(filterWorkspaceItems(items,' CHAPTER ')).toEqual([items[0],items[2]]);
    expect(filterWorkspaceItems(items,'')).toHaveLength(3);
    expect(items).toHaveLength(3);
  });
  it('wraps keyboard navigation within visible file rows', () => {
    expect(nextWorkspaceIndex(2,3,1)).toBe(0);
    expect(nextWorkspaceIndex(0,3,-1)).toBe(2);
    expect(nextWorkspaceIndex(0,0,1)).toBe(-1);
  });
  it('removes a stale recent folder without touching other locations', () => {
    const s=store(),h=new WorkspaceHistory(s);h.select('/a');h.select('/b');
    h.forget('/b');expect(h.recent).toEqual(['/a']);expect(h.active).toBeNull();
  });
  it('starts empty and rejects blank selections', () => {
    const h=new WorkspaceHistory(store());
    expect(h.active).toBeNull(); expect(h.recent).toEqual([]);
    expect(() => h.select('  ')).toThrow(RangeError);
  });
  it('recovers from malformed stored history and strips non-string entries', () => {
    const s=store();s.set(RECENT_WORKSPACES_KEY,'not-json');
    expect(new WorkspaceHistory(s).recent).toEqual([]);
    s.set(RECENT_WORKSPACES_KEY,JSON.stringify(['one',0,'one','',null,'two']));
    s.set(ACTIVE_WORKSPACE_KEY,'');
    expect(new WorkspaceHistory(s).recent).toEqual(['one','two']);
    expect(new WorkspaceHistory(s).active).toBeNull();
  });
});
