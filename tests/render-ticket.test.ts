import { describe, expect, it } from 'vitest';
import { RenderTicket } from '../src/core/render-ticket';
describe('render ticket', () => {
  it('accepts only the most recent page request', () => {
    const ticket = new RenderTicket();
    const first = ticket.next(), second = ticket.next();
    expect(ticket.valid(first)).toBe(false);
    expect(ticket.valid(second)).toBe(true);
  });
  it('ignores an older page that resolves after the latest page', async () => {
    const ticket = new RenderTicket();
    const shown: string[] = [];
    let completeOld: () => void = () => undefined;
    const delayed = new Promise<void>(resolve => { completeOld = resolve; });
    const first = ticket.next();
    const oldRender = delayed.then(() => { if (ticket.valid(first)) shown.push('old'); });
    const second = ticket.next();
    if (ticket.valid(second)) shown.push('new');
    completeOld(); await oldRender;
    expect(shown).toEqual(['new']);
  });
  it('invalidates in-flight work on close or layout change', () => {
    const ticket = new RenderTicket();
    const first = ticket.next(); ticket.cancel();
    expect(ticket.valid(first)).toBe(false);
  });
});
