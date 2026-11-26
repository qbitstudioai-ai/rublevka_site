import { z } from "zod";
import { territoryObjects } from "@/content/territory-map";

export const objectId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
export const bookingRequest = z.strictObject({
  arrival: z.iso.date(),
  departure: z.iso.date(),
  adults: z.number().int().min(1).max(100),
  children: z.number().int().min(0).max(100),
  childAges: z.array(z.number().int().min(0).max(17)).max(100).optional(),
  categoryId: objectId.optional(),
  objectId: objectId.optional(),
}).refine(({ arrival, departure, children, childAges }) =>
  arrival < departure && (!childAges || childAges.length === children));

export type BookingRequest = z.infer<typeof bookingRequest>;
type Failure = { status: "provider_not_configured" | "provider_error" | "no_availability" };
type Offer = { id: string; categoryId: string; amountMinor: number; currency: string };

export interface BookingProvider {
  availability(input: BookingRequest): Promise<Failure | { status: "available"; offers: Offer[] }>;
  bookingLink(input: BookingRequest): Promise<Failure | { status: "available"; url: string }>;
}

export const bookingProvider: BookingProvider = {
  async availability() { return { status: "provider_not_configured" }; },
  async bookingLink() { return { status: "provider_not_configured" }; },
};

export function validMapObject(id: string, lodgingOnly = false) {
  return territoryObjects.some((object) => object.id === id && (!lodgingOnly || object.filter === "lodging"));
}
