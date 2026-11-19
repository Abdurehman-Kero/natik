interface Edges {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * Where the tour card goes so that it is always fully on screen and never covers the part it points at.
 *
 * It prefers below the highlighted part, then above it. When the highlighted part is as tall as the
 * screen (the side menu on a large screen) neither fits, so the card goes beside it, to the right, then
 * to the left. Only if nothing fits at all (the highlight fills the screen) does it float at the bottom.
 * The result is always clamped inside the window, so the "Next" button can never be pushed off screen.
 */
export function placeCard(
  target: Edges,
  card: { width: number; height: number },
  view: { width: number; height: number },
  gap = 16,
  margin = 12,
): { top: number; left: number } {
  const clamp = (value: number, size: number, room: number) =>
    Math.min(Math.max(value, margin), Math.max(room - size - margin, margin));
  const clampX = (x: number) => clamp(x, card.width, view.width);
  const clampY = (y: number) => clamp(y, card.height, view.height);
  const centreX = (target.left + target.right) / 2 - card.width / 2;

  if (target.bottom + gap + card.height + margin <= view.height) {
    return { top: target.bottom + gap, left: clampX(centreX) };
  }
  if (target.top - gap - card.height - margin >= 0) {
    return { top: target.top - gap - card.height, left: clampX(centreX) };
  }
  if (target.right + gap + card.width + margin <= view.width) {
    return { top: clampY(target.top), left: target.right + gap };
  }
  if (target.left - gap - card.width - margin >= 0) {
    return { top: clampY(target.top), left: target.left - gap - card.width };
  }
  return { top: clampY(view.height), left: clampX(centreX) };
}
