import { isWritingFile } from './paths';
export interface ProjectManifest { version: 1; chapters: string[] }
export interface ProjectFile { path: string; title: string; text: string; words: number; headings: { title: string; line: number; level: number }[] }
export interface ProjectMatch { path: string; title: string; line: number; context: string }
export function safeChapter(path: string): boolean {
  return path.length > 0 && path.length <= 512 && !path.includes(String.fromCharCode(92)) && !path.startsWith('/') &&
    path.split('/').every(segment => !!segment && segment !== '.' && segment !== '..' && ![...segment].some(ch => ch.charCodeAt(0) < 32)) && isWritingFile(path);
}
export function manifest(value: unknown): ProjectManifest {
  if (!value || typeof value !== 'object') throw Error('Invalid project order file.');
  const v = value as Partial<ProjectManifest>;
  if (v.version !== 1 || !Array.isArray(v.chapters) || v.chapters.length > 200 ||
      v.chapters.some(p => typeof p !== 'string' || !safeChapter(p)) ||
      new Set(v.chapters).size !== v.chapters.length) throw Error('Invalid project order file.');
  return { version: 1, chapters: [...v.chapters] };
}
export function orderFiles(paths: readonly string[], existing: ProjectManifest | null): ProjectManifest {
  if (paths.length > 200) throw Error('This project has more than 200 chapters. Choose a smaller folder.');
  const set = new Set(paths);
  if (set.size !== paths.length || paths.some(p => !safeChapter(p))) throw Error('Invalid chapter path in workspace.');
  const old = existing?.chapters ?? [];
  const chapters = [...old, ...paths.filter(p => !old.includes(p))];
  if (chapters.length > 200) throw Error('Project order exceeds 200 chapters. Remove missing entries first.');
  return { version: 1, chapters };
}
export function moveChapter(order: ProjectManifest, path: string, direction: -1 | 1): ProjectManifest {
  const chapters = [...order.chapters], at = chapters.indexOf(path), to = at + direction;
  if (at < 0 || to < 0 || to >= chapters.length) return order;
  [chapters[at], chapters[to]] = [chapters[to], chapters[at]];
  return { version: 1, chapters };
}
/** Moves a chapter to an exact position in one step, for drag and drop. */
export function moveChapterTo(order: ProjectManifest, path: string, index: number): ProjectManifest {
  const chapters = [...order.chapters], at = chapters.indexOf(path);
  const to = Math.max(0, Math.min(chapters.length - 1, index));
  if (at < 0 || at === to) return order;
  chapters.splice(at, 1);
  chapters.splice(to, 0, path);
  return { version: 1, chapters };
}
/** Keeps a renamed chapter at the same place in the order. */
export function renameInOrder(order: ProjectManifest, from: string, to: string): ProjectManifest {
  if (!order.chapters.includes(from) || order.chapters.includes(to)) return order;
  return { version: 1, chapters: order.chapters.map(p => (p === from ? to : p)) };
}
export function chapterInfo(path: string, text: string): ProjectFile {
  const lines = text.split(String.fromCharCode(10)), headings: ProjectFile['headings'] = [];
  const plain = /\.txt$/i.test(path);
  let inCode = false;
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith(String.fromCharCode(96,96,96)) || line.trimStart().startsWith('~~~')) { inCode = !inCode; return; }
    const heading = !plain && !inCode && /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) headings.push({ title: heading[2], line: index + 1, level: heading[1].length });
  });
  const words = (text.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) ?? []).length;
  return { path, text, title: headings[0]?.title ?? path.split('/').pop()!.replace(/\.(md|markdown|txt)$/i, ''), words, headings };
}
export function searchProject(files: readonly ProjectFile[], query: string): ProjectMatch[] {
  const needle = query.trim().toLocaleLowerCase(); if (!needle) return [];
  const hits: ProjectMatch[] = [];
  for (const file of files) file.text.split(String.fromCharCode(10)).forEach((line, i) => {
    if (line.toLocaleLowerCase().includes(needle)) hits.push({ path: file.path, title: file.title, line: i + 1, context: line.trim().slice(0, 200) });
  });
  return hits;
}
