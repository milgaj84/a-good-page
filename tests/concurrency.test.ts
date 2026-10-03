import { describe, expect, it, vi } from 'vitest';
import { mapLimit } from '../src/core/concurrency';
import { ProjectService } from '../src/core/project-service';

describe('mapLimit', () => {
  it('keeps results in order, never exceeds the limit, and uses every lane', async () => {
    vi.useFakeTimers();
    let running = 0;
    let peak = 0;
    const done = mapLimit([30, 10, 20, 5, 15, 25], 3, async (ms, i) => {
      running++; peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, ms));
      running--;
      return i + ':' + ms;
    });
    await vi.runAllTimersAsync();
    expect(await done).toEqual(['0:30', '1:10', '2:20', '3:5', '4:15', '5:25']);
    expect(peak).toBe(3);
    vi.useRealTimers();
  });
  it('handles no items, one item and a limit larger than the list', async () => {
    expect(await mapLimit([], 8, async () => 1)).toEqual([]);
    expect(await mapLimit([1], 8, async x => x * 2)).toEqual([2]);
    expect(await mapLimit([1, 2], 99, async x => x + 1)).toEqual([2, 3]);
  });
  it('passes a failure on rather than hiding it', async () => {
    await expect(mapLimit([1, 2, 3], 2, async x => { if (x === 2) throw new Error('boom'); return x; })).rejects.toThrow('boom');
  });
});

describe('reading a project', () => {
  it('reads pages several at a time, in project order, and is much faster than one by one', async () => {
    vi.useFakeTimers();
    const names = Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(2, '0') + '.md');
    let running = 0, peak = 0;
    const io = {
      list: async () => ({ root: '/p', directory: '/p', entries: names.map(n => ({ name: n, path: '/p/' + n, is_dir: false })) }),
      read: async (_r: string, path: string) => {
        running++; peak = Math.max(peak, running);
        await new Promise(r => setTimeout(r, 10)); // pretend each read takes 10 ms
        running--;
        return { content: '# ' + path.split('/').pop() };
      },
      order: async () => null,
      saveOrder: async (_r: string, _e: string | null, v: string) => v,
    };
    const service = new ProjectService(io);
    const started = Date.now();
    const loading = service.open('/p');
    await vi.runAllTimersAsync();
    await loading;
    expect(Date.now() - started).toBeLessThan(100); // 40 reads x 10 ms would be 400 ms one at a time
    expect(peak).toBe(8);
    expect(service.chapters.map(c => c.path)).toEqual(names);
    expect(service.chapters.every(c => c.file)).toBe(true);
    vi.useRealTimers();
  });
});
