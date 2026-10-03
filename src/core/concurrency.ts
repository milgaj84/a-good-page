/**
 * Runs `work` over `items` with at most `limit` at a time, returning results in the original order.
 * Reading a project's pages one after another waits for every round trip in turn; a few at once is much faster
 * and still gentle on the disk.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}
