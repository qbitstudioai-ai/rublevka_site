export type Point = readonly [number, number];
export type MapView = { x: number; y: number; width: number; height: number };

export const fullView: MapView = { x: -34, y: -20, width: 974, height: 902 };

export function transformView(
  initial: MapView,
  scale: number,
  anchor: Point,
  shift: Point,
): MapView {
  const width = Math.min(fullView.width, Math.max(fullView.width / 4, initial.width / scale));
  const ratio = width / initial.width;
  const height = initial.height * ratio;
  const x = anchor[0] + (initial.x + shift[0] - anchor[0]) * ratio;
  const y = anchor[1] + (initial.y + shift[1] - anchor[1]) * ratio;

  return {
    width,
    height,
    x: Math.min(fullView.x + fullView.width - width, Math.max(fullView.x, x)),
    y: Math.min(fullView.y + fullView.height - height, Math.max(fullView.y, y)),
  };
}
