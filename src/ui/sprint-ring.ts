import { MAX_SPRINT_TARGET, ringGeometry, sprintProgress, type SprintStore } from '../core/sprint';

export interface SprintRingDeps {
  sprints: SprintStore;
  words(): number;
  docKey(): string;
  notify(message: string): void;
  restoreFocus(): void;
}

const RADIUS = 15;
const SVG = 'http://www.w3.org/2000/svg';

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

/** A small, muted ring in the lower-left corner. It fills with new words and glows once at the goal. */
export class SprintRing {
  readonly root = document.createElement('div');
  private readonly ring = document.createElement('button');
  private readonly arc = svg('circle', { cx: '20', cy: '20', r: String(RADIUS), class: 'sprint-arc' });
  private readonly count = document.createElement('span');
  private readonly form = document.createElement('form');
  private readonly input = document.createElement('input');
  private readonly error = document.createElement('p');
  private readonly end = document.createElement('button');

  constructor(host: HTMLElement, private readonly deps: SprintRingDeps) {
    this.root.className = 'sprint';
    this.root.id = 'sprint';
    this.ring.type = 'button';
    this.ring.className = 'sprint-ring';
    const icon = svg('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' });
    icon.append(svg('circle', { cx: '20', cy: '20', r: String(RADIUS), class: 'sprint-track' }), this.arc);
    const { circumference } = ringGeometry(0, RADIUS);
    this.arc.setAttribute('stroke-dasharray', String(circumference));
    this.count.className = 'sprint-count';
    this.ring.append(icon, this.count);

    this.form.className = 'sprint-form';
    this.form.hidden = true;
    const label = document.createElement('label');
    label.textContent = 'New words this sprint';
    label.htmlFor = 'sprint-target';
    this.input.id = 'sprint-target';
    this.input.type = 'number';
    this.input.min = '1';
    this.input.max = String(MAX_SPRINT_TARGET);
    this.input.step = '50';
    this.input.value = '500';
    const start = document.createElement('button');
    start.type = 'submit';
    start.className = 'sprint-start';
    start.textContent = 'Start';
    this.end.type = 'button';
    this.end.className = 'sprint-end';
    this.end.textContent = 'End sprint';
    this.error.className = 'sprint-error';
    this.error.setAttribute('role', 'alert');
    this.form.append(label, this.input, start, this.end, this.error);
    this.root.append(this.form, this.ring);
    host.append(this.root);

    this.ring.addEventListener('click', () => this.toggleForm());
    this.form.addEventListener('submit', (event) => { event.preventDefault(); this.start(); });
    this.form.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); this.closeForm(); } });
    this.end.addEventListener('click', () => {
      this.deps.sprints.clear();
      this.closeForm();
      this.update();
      this.deps.notify('Sprint ended.');
    });
    this.update();
  }

  get isOpen(): boolean { return !this.form.hidden; }

  toggleForm(): void { if (this.isOpen) this.closeForm(); else this.openForm(); }

  openForm(): void {
    this.error.textContent = '';
    const sprint = this.deps.sprints.current;
    if (sprint) this.input.value = String(sprint.target);
    this.end.hidden = !sprint;
    this.form.hidden = false;
    this.root.classList.add('is-editing');
    this.input.focus();
    this.input.select();
  }

  closeForm(restore = true): void {
    if (this.form.hidden) return;
    this.form.hidden = true;
    this.root.classList.remove('is-editing');
    if (restore) this.deps.restoreFocus();
  }

  /** Called with fresh word counts; cheap enough for the debounced stats pass. */
  update(): void {
    const progress = sprintProgress(this.deps.sprints.current, this.deps.words(), this.deps.docKey());
    const sprint = this.deps.sprints.current;
    const elsewhere = sprint !== null && progress === null;
    this.root.classList.toggle('is-active', progress !== null);
    this.root.classList.toggle('is-reached', progress?.reached === true);
    const { offset } = ringGeometry(progress?.ratio ?? 0, RADIUS);
    this.arc.setAttribute('stroke-dashoffset', String(offset));
    this.count.textContent = progress ? String(Math.round(progress.ratio * 100)) : '';
    const label = progress ? 'Sprint: ' + progress.label + '. Click to change or end.'
      : elsewhere ? 'A sprint is running in another document. Click to start one here.' : 'Start a word sprint';
    this.ring.title = label;
    this.ring.setAttribute('aria-label', label);
    if (progress?.reached && this.deps.sprints.markCelebrated()) {
      this.root.classList.add('is-glowing');
      window.setTimeout(() => this.root.classList.remove('is-glowing'), 2600);
      this.deps.notify('Sprint goal reached: ' + progress.label + '.');
    }
  }

  private start(): void {
    try {
      this.deps.sprints.start(Number(this.input.value), this.deps.words(), this.deps.docKey());
    } catch (error) {
      this.error.textContent = error instanceof Error ? error.message : String(error);
      return;
    }
    this.closeForm();
    this.update();
  }
}
