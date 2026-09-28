import { safeChapter, type ProjectFile } from './project';
export interface RelinkCandidate { path: string; title: string; words: number; reason: string; score: number }
function stem(path: string): string { return path.split('/').pop()!.replace(/\.(md|markdown|txt)$/i,'').toLocaleLowerCase().trim(); }
/** Hints only. A writer must always choose a replacement and confirm its preview. */
export function rankRelinks(missing: string, files: readonly ProjectFile[]): RelinkCandidate[] {
  if (!safeChapter(missing)) throw Error('Invalid missing chapter path.');
  return files.filter(file => safeChapter(file.path) && file.path !== missing).map(file => {
    const same = stem(file.path) === stem(missing);
    const prefix = file.path.split('/').slice(0,-1).join('/') === missing.split('/').slice(0,-1).join('/');
    return { path:file.path,title:file.title,words:file.words,
      reason:same?'Same filename':prefix?'Same folder':'Other workspace file',
      score:(same?100:0)+(prefix?10:0) };
  }).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
}
export function relinkOrder(chapters: readonly string[], oldPath: string, newPath: string): string[] {
  if (!safeChapter(oldPath)||!safeChapter(newPath)||!chapters.includes(oldPath)||oldPath===newPath||chapters.includes(newPath))
    throw Error('Choose an unused writing file inside this project.');
  return chapters.map(path=>path===oldPath?newPath:path);
}
