// Placement options for the floating formatting bubble.
// tippy wraps the bubble in a box capped at 350px by default; that cap squeezed the text
// buttons until their labels collided ("HeadingQuote"). The bubble sizes itself instead.
export interface BubblePlacement {
  duration: [number, number];
  placement: 'top';
  offset: [number, number];
  maxWidth: 'none';
  zIndex: number;
  moveTransition: string;
}

/** A fresh options object on every call, so tippy can never mutate a shared default. */
export function bubblePlacement(): BubblePlacement {
  return {
    duration: [140, 90],
    placement: 'top',
    offset: [0, 12],
    maxWidth: 'none',
    zIndex: 40,
    moveTransition: 'transform 0.12s ease-out',
  };
}
