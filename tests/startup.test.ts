import { describe, expect, it } from 'vitest';
import { restoreLastDocument } from '../src/core/startup';
describe('startup restore', () => {
  it('prioritizes an untitled draft over a last file', async () => {
    let opened = false; const messages: string[]=[];
    const result=await restoreLastDocument({ restoreDraft:()=>true,openPath:async()=>{opened=true;return true;},snapshot:()=>({name:'Other',path:null,state:'saved'}) },'other.md',m=>messages.push(m));
    expect(result).toBe(true);expect(opened).toBe(false);expect(messages[0]).toContain('draft');
  });
  it('treats a missing file as a blank start', async () => {
    expect(await restoreLastDocument({ restoreDraft:()=>false,openPath:async()=>false,snapshot:()=>({name:'Untitled',path:null,state:'saved'}) },'gone.md',()=>undefined)).toBe(false);
  });
});
