import type { ProjectEntry } from './project-service';
export type HealthKind = 'missing' | 'unreadable' | 'untracked' | 'empty';
export interface HealthIssue { kind: HealthKind; path: string; advice: string; blocking: boolean }
export interface ProjectHealth { total: number; readable: number; words: number; issues: HealthIssue[]; ready: boolean }
/** Read-only diagnosis: never relinks, drops, writes or silently excludes files. */
export function projectHealth(entries: readonly ProjectEntry[], available: readonly string[], recorded: ReadonlySet<string>): ProjectHealth {
  const issues: HealthIssue[] = [];
  for (const entry of entries) {
    if (entry.issue) {
      const missing = entry.issue === 'Missing from workspace';
      issues.push({ path: entry.path, kind: missing ? 'missing' : 'unreadable', blocking: true,
        advice: missing ? 'Relink this chapter or restore its file.' : 'Restore access, then refresh chapters.' });
    } else if (entry.file && !entry.file.text.trim()) {
      issues.push({ path: entry.path, kind: 'empty', blocking: false,
        advice: 'This chapter is empty. Keep it intentionally or add text.' });
    }
  }
  for (const path of available) if (!recorded.has(path)) issues.push({ path, kind: 'untracked', blocking: false,
    advice: 'New file found. It will be appended after missing entries are repaired or removed.' });
  return { total: entries.length, readable: entries.filter(e => e.file !== null).length,
    words: entries.reduce((sum,e)=>sum+(e.file?.words??0),0),issues,
    ready: entries.length>0 && !issues.some(issue=>issue.blocking) };
}
