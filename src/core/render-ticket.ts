/** Invalidates stale page renders after navigation, layout changes, or closing. */
export class RenderTicket {
  private value = 0;
  next(): number { return ++this.value; }
  valid(ticket: number): boolean { return ticket === this.value; }
  cancel(): void { this.value++; }
}
