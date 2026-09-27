export type FocusChoice = 'off' | 'paragraph' | 'sentence' | 'fullscreen';
export interface FullscreenPort { set(active: boolean): Promise<void> }
/** Changes modes atomically; if fullscreen fails, the current mode remains. */
export class FocusChoices {
  private current: FocusChoice = 'off';
  constructor(private readonly port: FullscreenPort, private readonly render: (mode: FocusChoice) => void) {}
  get mode(): FocusChoice { return this.current; }
  async set(next: FocusChoice): Promise<void> {
    if (next === this.current) return;
    if (next === 'fullscreen') await this.port.set(true);
    else if (this.current === 'fullscreen') await this.port.set(false);
    this.current = next;
    this.render(next);
  }
  toggleParagraph(): Promise<void> { return this.set(this.current === 'paragraph' ? 'off' : 'paragraph'); }
}
