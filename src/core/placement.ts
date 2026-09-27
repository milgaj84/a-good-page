export interface Anchor {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  above: boolean;
}

/**
 * Places a popover centred under its anchor, flipping above when there is no room
 * below and always keeping it inside the window with a small margin.
 */
export function placePopover(
  anchor: Anchor,
  size: Size,
  viewport: Size,
  gap = 8,
  margin = 12,
): Placement {
  const centred = (anchor.left + anchor.right) / 2 - size.width / 2;
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const left = Math.min(Math.max(centred, margin), maxLeft);

  const below = anchor.bottom + gap;
  const fitsBelow = below + size.height <= viewport.height - margin;
  const aboveTop = anchor.top - gap - size.height;
  const above = !fitsBelow && aboveTop >= margin;
  const top = above
    ? aboveTop
    : Math.max(margin, Math.min(below, viewport.height - size.height - margin));

  return { left: Math.round(left), top: Math.round(top), above };
}
