/**
 * What to tell a writer when something fails: the plain sentence, without "Error:" prefixes or operating-system
 * codes, and a next step when the cause is a common one.
 */
export function friendly(error: unknown): string {
  let text = (error instanceof Error ? error.message : String(error)).replace(/^(Error|TypeError|Uncaught)[:\s]+/i, '').trim();
  text = text.replace(/\s*\(os error \d+\)/gi, '').trim();
  if (/no such file|not found|cannot find/i.test(text)) text += ' It may have been moved or renamed.';
  else if (/permission denied|access is denied|read-only/i.test(text)) text += ' Check that you may write to that folder.';
  else if (/no space|disk full/i.test(text)) text += ' Free some disk space and try again.';
  else if (/not allowed|not granted|was not chosen/i.test(text)) text = 'A Good Page only works in folders you chose. Choose your Library folder again from the Library menu.';
  return text || 'Something went wrong.';
}
