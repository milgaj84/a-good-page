import type { ProjectService } from '../core/project-service';
import { DialogFocus } from './dialog-focus';
/** Explicit, keyboard-accessible repair; candidate text is shown as text, never HTML. */
export class ProjectRelinkDialog {
  readonly root=document.createElement('div');
  private readonly body=document.createElement('div');
  private readonly message=document.createElement('p');
  private readonly apply=document.createElement('button');
  private readonly closeButton=document.createElement('button');
  private readonly focus=new DialogFocus(this.root);
  private generation=0;
  private active=false;
  constructor(host: HTMLElement, private service: ProjectService,
    private readonly notify: (message:string)=>void, private readonly updated:()=>void) {
    this.root.className='overlay relink-overlay';this.root.setAttribute('aria-hidden','true');
    const sheet=document.createElement('section');sheet.className='relink-sheet';
    sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','relink-title');
    const title=document.createElement('h2');title.id='relink-title';title.textContent='Relink a missing chapter';
    this.message.setAttribute('role','status');this.body.className='relink-options';
    this.apply.type=this.closeButton.type='button';this.apply.textContent='Use selected file';this.closeButton.textContent='Cancel';this.apply.disabled=true;
    sheet.append(title,this.message,this.body,this.apply,this.closeButton);this.root.append(sheet);host.append(this.root);
    this.closeButton.addEventListener('click',()=>this.close());
    this.root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();this.close();}event.stopPropagation();});
  }
  get isOpen():boolean{return this.active;}
  setService(service: ProjectService):void { this.close();this.service=service; }
  close():void{if(!this.active)return;this.active=false;this.generation++;this.root.classList.remove('is-open');this.root.setAttribute('aria-hidden','true');this.focus.close();}
  async open(missing:string):Promise<void>{
    if(this.active)return;this.active=true;this.root.classList.add('is-open');this.root.setAttribute('aria-hidden','false');
    this.focus.open(this.closeButton);await this.populate(missing);
  }
  private async populate(missing:string):Promise<void>{
    const token=++this.generation;this.body.replaceChildren();this.apply.disabled=true;
    this.message.textContent='Looking for files inside this workspace for '+missing+'…';
    try{
      const found=await this.service.relinkCandidates(missing);
      if(token!==this.generation||!this.active)return;
      this.message.textContent=found.candidates.length
        ? 'Missing: '+missing+'. Suggestions are not automatic matches. Review a file, then confirm.'
        : 'No available writing files found. Restore or add a chapter, then refresh the project.';
      const name='relink-choice-'+token;
      for(const candidate of found.candidates){
        const label=document.createElement('label');label.className='relink-option';
        const radio=document.createElement('input');radio.type='radio';radio.name=name;radio.value=candidate.path;
        const file=found.files.get(candidate.path)!;
        const detail=document.createElement('span');
        detail.textContent=candidate.reason+' · '+candidate.path+' · '+candidate.title+' · '+candidate.words.toLocaleString()+' words';
        const excerpt=document.createElement('small');excerpt.textContent=file.text.slice(0,360)||'(empty chapter)';
        label.append(radio,detail,excerpt);this.body.append(label);
        radio.addEventListener('change',()=>{this.apply.disabled=false;});
      }
      this.apply.onclick=()=>{
        const selected=this.body.querySelector<HTMLInputElement>('input:checked')?.value;
        if(!selected)return;
        const expected=found.files.get(selected)?.text;
        if(expected===undefined)return;
        void this.commit(missing,selected,expected,token);
      };
    }catch(error){if(token===this.generation)this.message.textContent='Could not inspect candidates: '+String(error);}
  }
  private async commit(oldPath:string,newPath:string,expected:string,token:number):Promise<void>{
    this.apply.disabled=true;
    this.message.textContent='Checking '+newPath+' and saving project order…';
    try{
      await this.service.relink(oldPath,newPath,expected);
      if(token!==this.generation)return;
      this.close();this.updated();this.notify('Relinked '+oldPath+' to '+newPath+'. Chapter files were unchanged.');
    }catch(error){
      if(token!==this.generation)return;
      this.message.textContent='Relink not saved: '+String(error)+' The old entry remains. Refresh suggestions before trying again.';
      const button=document.createElement('button');button.type='button';button.textContent='Refresh suggestions';
      button.addEventListener('click',()=>void this.populate(oldPath));this.body.replaceChildren(button);
    }
  }
}
