import { describe, expect, it } from 'vitest';
import { exportRecoveryCopyWith, isLiveManuscript, recoveryFileName } from '../src/core/recovery';

describe('recovery copy naming and safety', () => {
  const time = new Date(2026, 8, 27, 16, 5, 3).getTime();
  it('keeps the plain-text format and cleans unsafe names', () => {
    expect(recoveryFileName('Chapter: 1.md', time, false)).toBe('Chapter- 1-recovery-20260927-160503.md');
    expect(recoveryFileName('', time, true)).toBe('Untitled-recovery-20260927-160503.txt');
  });
  it('rejects invalid dates and refuses the live path', () => {
    expect(() => recoveryFileName('A', NaN, false)).toThrow(RangeError);
    expect(isLiveManuscript(['C:', 'Book', 'DRAFT.md'].join(String.fromCharCode(92)), 'c:/book/draft.md', true)).toBe(true);
    expect(isLiveManuscript('/book/copy.md', '/book/live.md', false)).toBe(false);
    expect(isLiveManuscript('/book/a.md', null, false)).toBe(false);
  });
});


describe('recovery export', () => {
  it('cancels without writing and never overwrites the open manuscript', async () => {
    const writes: string[] = [];
    const write = async (path: string, content: string) => { writes.push(path + ':' + content); };
    expect(await exportRecoveryCopyWith('copy.md', 'older', '/book/live.md', false, async () => null, write)).toBe(false);
    await expect(exportRecoveryCopyWith('copy.md', 'older', '/book/live.md', false, async () => '/book/live.md', write)).rejects.toThrow('cannot replace');
    expect(writes).toEqual([]);
  });
  it('exports exact text as a separate file and propagates a failed write', async () => {
    const writes: string[] = [];
    const write = async (path: string, content: string) => { writes.push(path + ':' + content); };
    expect(await exportRecoveryCopyWith('copy.md', 'older — text', '/book/live.md', false, async () => '/book/copy', write)).toBe(true);
    expect(writes).toEqual(['/book/copy.md:older — text']);
    await expect(exportRecoveryCopyWith('copy.md', 'older', null, false, async () => '/book/denied.md', async () => { throw new Error('read-only'); })).rejects.toThrow('read-only');
  });
});
