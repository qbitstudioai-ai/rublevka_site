import { z } from "zod";
import { redact } from "./security";

const ages = z.array(z.number().int().min(0).max(17)).max(100);
const dates = z.strictObject({ arrival: z.iso.date().optional(), departure: z.iso.date().optional() });
const budget = z.strictObject({
  amountMinor: z.number().int().positive().max(1_000_000_000).optional(),
  type: z.enum(["total", "per_night", "per_guest"]).optional(),
});
const needs = z.strictObject({
  dates: dates.optional(),
  adults: z.number().int().min(1).max(100).optional(),
  children: z.number().int().min(0).max(100).optional(),
  childAges: ages.optional(),
  bedrooms: z.number().int().min(0).max(100).optional(),
  categoryId: z.enum(["room", "cottage", "bedrooms", "family"]).optional(),
  budget: budget.optional(),
  purpose: z.enum(["holiday", "celebration", "event", "business", "other"]).optional(),
  preferences: z.array(z.enum(["quiet", "active", "family", "outdoors", "wellness", "culture"])).max(6).optional(),
  eventIds: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).max(20).optional(),
  serviceIds: z.array(z.enum(["banya", "besedki", "banketnye-zaly", "uslugi", "restaurant", "uslugi-pool",
    "uslugi-outdoor-games", "uslugi-children", "banya-steam-room", "banya-house-and-yard",
    "besedki-orange", "besedki-green", "besedki-beige", "banketnye-zaly-large-hall", "banketnye-zaly-small-hall"])).max(20).optional(),
  specialRequests: z.array(z.enum(["accessibility", "crib", "extra_bed", "pet", "parking", "kitchen",
    "early_check_in", "late_check_out", "dietary_options", "quiet_location", "adjacent_rooms", "other"])).max(12).optional(),
});
const needPatch = needs.extend({ childAges: ages.nullable().optional() });
export const memoryPatch = z.strictObject({
  salesStage: z.string().trim().min(1).max(80).nullable().optional(),
  summary: z.string().trim().max(1200).nullable().optional(),
  need: needPatch.optional(),
});
export type MemoryPatch = z.infer<typeof memoryPatch>;

export function mergeMemory(current: { need: Record<string, unknown> | null }, patch?: MemoryPatch) {
  if (!patch) return {};
  const { need, salesStage, summary } = patch;
  let merged;
  if (need) {
    const previous = needs.strip().parse(current.need ?? {});
    merged = needs.parse({
      ...previous, ...need,
      dates: need.dates ? { ...previous.dates, ...need.dates } : previous.dates,
      budget: need.budget ? { ...previous.budget, ...need.budget } : previous.budget,
      childAges: need.childAges === null ? undefined : (need.childAges ?? previous.childAges),
    });
    const { dates, children, childAges } = merged;
    if ((dates?.arrival && dates.departure && dates.arrival >= dates.departure) ||
        (children !== undefined && childAges && childAges.length !== children))
      throw new z.ZodError([{ code: "custom", path: ["need"], message: "Inconsistent stay or guest details" }]);
  }
  return {
    need: merged,
    salesStage: salesStage === undefined || salesStage === null ? salesStage : redact(salesStage),
    summary: summary === undefined || summary === null ? summary : redact(summary),
  };
}
export function publicNeed(value: Record<string, unknown> | null) {
  if (!value) return null;
  const result = needs.strip().safeParse(value);
  return result.success ? result.data : null;
}
