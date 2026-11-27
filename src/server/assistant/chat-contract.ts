import { z } from "zod";
import { objectId, validMapObject } from "./booking";
import { accommodations, events, serviceId, serviceSections, services, siteLink } from "./knowledge";
import { publishedSite } from "../cms/public";
import { sectionIds } from "@/content/sections";
import { ApiError } from "./security";
import { localDay } from "@/content/stay-request";
import { publicSettings } from "./settings";
import type { Card } from "./schema";
import { memoryPatch } from "./memory";

const messageId = z.uuid();
const path = z.string().max(140).regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?)?$/);
export const guestMessage = z.strictObject({
  id: messageId, text: z.string().trim().min(1).max(2000),
  context: z.strictObject({
    path, mapObjectId: objectId.optional(),
    stay: z.strictObject({
      arrival: z.iso.date().optional(), departure: z.iso.date().optional(),
      adults: z.number().int().min(1).max(100).optional(), children: z.number().int().min(0).max(100).optional(),
      categoryId: objectId.optional(),
    }).refine(({ arrival, departure }) => !arrival || !departure || arrival < departure).optional(),
  }),
});
const cardReference = z.discriminatedUnion("type", [
  z.strictObject({ type: z.enum(["accommodation", "event", "registration", "booking"]), id: objectId }),
  z.strictObject({ type: z.literal("service"), id: serviceId }),
  z.strictObject({ type: z.literal("contact") }),
]);
const command = {
  dialogId: messageId, id: messageId, version: z.number().int().positive(),
};
const answer = {
  text: z.string().trim().max(3500).default(""),
  cards: z.array(cardReference).max(6).default([]),
};
const hasAnswer = ({ text, cards }: { text: string; cards: unknown[] }) => Boolean(text || cards.length);
export const callback = z.strictObject({
  ...command, ...answer, requestId: messageId.nullable(),
  source: z.enum(["assistant", "staff"]), status: z.enum(["completed", "failed"]),
  memory: memoryPatch.optional(),
  consultation: z.strictObject({ id: messageId, question: z.string().trim().min(1).max(1200) }).optional(),
}).refine((input) => {
  if (input.memory || input.consultation) {
    if (input.source !== "assistant" || input.status !== "completed") return false;
  }
  if (input.consultation && (!input.requestId || !input.text)) return false;
  return input.status === "failed" || hasAnswer(input);
});
export const operator = z.strictObject({ ...command, action: z.enum(["takeover", "release", "close"]) });
export const dialogLookup = z.strictObject({ dialogId: messageId });
export const updateMemory = z.strictObject({ ...command, memory: memoryPatch });
export const bindTopic = z.strictObject({ ...command, telegramTopic: z.string().regex(/^[1-9]\d{0,19}$/) });
export const consultationResult = z.strictObject({
  ...command, consultationId: messageId, result: z.string().trim().min(1).max(3500),
});
export const consultationDelivery = z.strictObject({
  ...command, ...answer, consultationId: messageId, memory: memoryPatch.optional(),
}).refine(hasAnswer);

export async function pageContext(input: z.infer<typeof guestMessage>["context"]) {
  let route = input.path.replace(/\/$/, "") || "/";
  let type = "other";
  let id: string | null = null;
  if (route === "/") type = "home";
  else if (route === "/bronirovanie") type = "booking";
  else if (route === "/prozhivanie") type = "accommodations";
  else if (route === "/karta") {
    type = "map";
    if (input.mapObjectId && validMapObject(input.mapObjectId)) id = input.mapObjectId;
  }
  else if (route === "/meropriyatiya") type = "events";
  else if (route.startsWith("/meropriyatiya/event/")) {
    try {
      const event = await events(route.split("/")[3]);
      if ("item" in event && event.item && route === "/meropriyatiya/event/" + event.item.slug) {
        type = "event";
        id = String(event.item.id);
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
  } else {
    const section = sectionIds.find((section) => route === "/" + section);
    if (section) {
      type = serviceSections.some((service) => service === section) ? "service" : "page";
      if (type === "service") id = section;
    }
  }
  const stay = type === "booking" && input.stay && (!input.stay.arrival || input.stay.arrival >= localDay()) ? input.stay : undefined;
  if (stay?.categoryId) {
    const item = accommodations(await publishedSite()).find((row) => row.id === stay.categoryId);
    if (!item) throw new ApiError(400, "invalid_category");
    id = item.id;
  }
  if (type === "other") route = "/";
  return { route, type, id, stay: stay ?? null };
}

export async function resolveCards(references: z.infer<typeof cardReference>[]): Promise<Card[]> {
  let catalog: ReturnType<typeof publishedSite> | undefined;
  return Promise.all(references.map(async (reference) => {
    if (reference.type === "contact") {
      const { contact } = await publicSettings();
      return { title: "Связаться с администратором", url: contact.url };
    }
    if (reference.type === "event" || reference.type === "registration") {
      const data = await events(reference.id);
      if (!("item" in data) || !data.item?.active) throw new ApiError(400, "invalid_card");
      const item = data.item;
      const url = reference.type === "registration" ? item.registrationUrl : item.url;
      if (!url) throw new ApiError(400, "invalid_card");
      return { title: reference.type === "registration" ? "Регистрация · " + item.title : item.title,
        url, photo: item.photo ?? undefined };
    }
    const site = await (catalog ??= publishedSite());
    if (reference.type === "service") {
      const item = services(site).find(({ id }) => id === reference.id);
      if (!item) throw new ApiError(400, "invalid_card");
      return { title: item.title, url: item.url, photo: item.photo ?? undefined };
    }
    const item = accommodations(site).find(({ id }) => id === reference.id);
    if (!item) throw new ApiError(400, "invalid_card");
    if (reference.type === "booking") return { title: "Оставить заявку · " + item.title,
      url: item.enquiryUrl ?? siteLink("/bronirovanie") };
    return { title: item.title, url: item.url, photo: item.photos[0] };
  }));
}
