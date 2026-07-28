const SHELF_SPACING = 0.78;

export function shelfXFor(index, total) {
  return (index - (total - 1) / 2) * SHELF_SPACING;
}

export function stagePosition(progress, fromX) {
  const remaining = 1 - progress;
  const arc = 4 * progress * remaining * 0.36;

  return [
    fromX * remaining,
    1.2 * remaining + arc,
    -1.5 + progress,
  ];
}
