import { describe, expect, it } from 'vitest';
import { friendly } from '../src/core/friendly';

describe('friendly errors', () => {
  it('drops prefixes and operating-system codes, and says what to do', () => {
    expect(friendly(new Error('Cannot open that folder: No such file or directory (os error 2)'))).toBe('Cannot open that folder: No such file or directory It may have been moved or renamed.');
    expect(friendly('Error: Permission denied (os error 13)')).toContain('Check that you may write');
    expect(friendly('No space left on device')).toContain('Free some disk space');
  });
  it('turns the "not chosen" refusal into a way forward', () => {
    expect(friendly('That place was not chosen in A Good Page, so it cannot be used.')).toContain('Choose your Library folder again');
  });
  it('never returns an empty message', () => {
    expect(friendly('')).toBe('Something went wrong.');
    expect(friendly(undefined)).toBe('undefined');
  });
});
