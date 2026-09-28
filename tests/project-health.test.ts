import { describe, expect, it } from 'vitest';
import { chapterInfo } from '../src/core/project';
import { projectHealth } from '../src/core/project-health';
describe('project health',()=>{
  it('treats empty project as not ready without inventing an issue',()=>{
    expect(projectHealth([],[],new Set())).toEqual({total:0,readable:0,words:0,issues:[],ready:false});
  });
  it('names missing, unreadable, new and empty chapters without editing any entry',()=>{
    const entries=[
      {path:'missing.md',file:null,issue:'Missing from workspace'},
      {path:'blocked.md',file:null,issue:'Cannot read: permission denied'},
      {path:'blank.md',file:chapterInfo('blank.md',''),issue:null},
      {path:'good.md',file:chapterInfo('good.md','# Good\nA paragraph'),issue:null},
    ];
    const before=JSON.stringify(entries);
    const report=projectHealth(entries,['blank.md','good.md','new.md'],new Set(['missing.md','blocked.md','blank.md','good.md']));
    expect(report.issues.map(i=>[i.kind,i.path])).toEqual([
      ['missing','missing.md'],['unreadable','blocked.md'],['empty','blank.md'],['untracked','new.md']]);
    expect(report.issues.filter(i=>i.blocking)).toHaveLength(2);
    expect(report.ready).toBe(false);expect(report.readable).toBe(2);
    expect(JSON.stringify(entries)).toBe(before);
  });
  it('reports a healthy ordered book and exact word total',()=>{
    const file=chapterInfo('one.md','# One\nTwo words');
    const result=projectHealth([{path:'one.md',file,issue:null}],['one.md'],new Set(['one.md']));
    expect(result.ready).toBe(true);expect(result.words).toBe(file.words);
    expect(result.issues).toEqual([]);
  });
});
