import type { Point } from "@/content/territory-view";

export function CoordinateField({ label, value, min = -2000, max = 3000, change }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  change: (value: number) => void;
}) {
  const rounded = Math.round(value * 100) / 100;
  return (
    <label>
      {label}
      <input
        key={rounded}
        type="number"
        min={min}
        max={max}
        step="any"
        defaultValue={rounded}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={({ currentTarget }) => {
          const next = currentTarget.valueAsNumber;
          if (!Number.isFinite(next) || next < min || next > max) {
            currentTarget.value = String(rounded);
          } else if (next !== rounded) {
            change(next);
          }
        }}
      />
    </label>
  );
}

export function PointFields({ point, change }: { point: Point; change: (point: [number, number]) => void }) {
  return (
    <>
      <CoordinateField label="X" value={point[0]} change={(x) => change([x, point[1]])} />
      <CoordinateField label="Y" value={point[1]} change={(y) => change([point[0], y])} />
    </>
  );
}
