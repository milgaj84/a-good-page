/** Name a separate, portable copy without changing the manuscript path. */
export function recoveryFileName(name: string, at: number, plain: boolean): string {
  const stem = name.replace(/[.](md|markdown|txt)$/i, '').replace(/[<>:"|?*]/g, '-')
    .split(String.fromCharCode(92)).join('-').split('/').join('-')
    .trim().replace(/[. ]+$/g, '').slice(0, 80) || 'Untitled';
  const d = new Date(at);
  if (!Number.isFinite(d.getTime())) throw new RangeError('Invalid recovery time');
  const stamp = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('') + '-' +
    [d.getHours(), d.getMinutes(), d.getSeconds()].map(v => String(v).padStart(2, '0')).join('');
  return stem + '-recovery-' + stamp + (plain ? '.txt' : '.md');
}

/** Never offer to replace the live manuscript with a recovery copy. */
export function isLiveManuscript(target: string, current: string | null, windows: boolean): boolean {
  if (!current) return false;
  const normalize = (path: string) => {
    let value = path.split(String.fromCharCode(92)).join('/');
    while (value.endsWith('/')) value = value.slice(0, -1);
    return windows ? value.toLowerCase() : value;
  };
  return normalize(target) === normalize(current);
}

/** Injectable dialog and writer keep cancellation and failed writes testable. */
export async function exportRecoveryCopyWith(
  name: string, content: string, livePath: string | null, windows: boolean,
  pick: (suggestedName: string) => Promise<string | null>,
  write: (path: string, content: string) => Promise<unknown>,
): Promise<boolean> {
  const path = await pick(name);
  if (!path) return false;
  const target = /[.](md|markdown|txt)$/i.test(path) ? path : path + (name.endsWith('.txt') ? '.txt' : '.md');
  if (isLiveManuscript(target, livePath, windows)) {
    throw new Error('Choose a different file: a recovery copy cannot replace your open manuscript.');
  }
  await write(target, content);
  return true;
}
