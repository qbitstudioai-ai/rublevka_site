import { z } from "zod";

import { mapPinPosition, type TerritoryObject } from "./territory-map-types";

const coordinate = z.number().min(-2000).max(3000);
const point = z.tuple([coordinate, coordinate]);
const illustration = z.strictObject({
  x: coordinate,
  y: coordinate,
  width: z.number().min(5).max(974),
});
const object = z.strictObject({
  shape: z.array(point).min(3).max(64).optional(),
  pin: point.optional(),
  entrances: z.array(z.strictObject({ tip: point, angle: z.number().min(0).max(360) })).max(32).optional(),
});
const id = z.string().regex(/^object-\d{2}$/);
const layout = z.strictObject({
  illustrations: z.record(id, illustration).optional(),
  objects: z.record(id, object).optional(),
});

export type TerritoryLayout = z.infer<typeof layout>;
export type IllustrationPlacement = z.infer<typeof illustration>;
export type ObjectPlacement = z.infer<typeof object>;

export function parseTerritoryLayout(input: unknown): TerritoryLayout {
  return layout.parse(input);
}

export function applyTerritoryLayout(objects: readonly TerritoryObject[], edits: TerritoryLayout): readonly TerritoryObject[] {
  if (!edits.objects) return objects;
  return objects.map((object) => {
    const edit = edits.objects?.[object.id];
    if (!edit) return object;
    const { shape, pin, entrances } = edit;
    const marker = shape ? [
      shape.reduce((sum, [x]) => sum + x, 0) / shape.length,
      shape.reduce((sum, [, y]) => sum + y, 0) / shape.length,
    ] as const : object.marker;
    return {
      ...object,
      marker,
      shape: shape ?? object.shape,
      pin: pin ?? mapPinPosition(object),
      entrances: entrances ?? object.entrances,
    };
  });
}
