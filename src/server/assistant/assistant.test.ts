import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingRequest, bookingProvider } from "./booking";
import { authorized, redact } from "./security";
import { accommodations } from "./knowledge";
import { guestMessage, pageContext } from "./chat-contract";
import { siteDefaults } from "../cms/defaults";

test("booking validates dates and never invents inventory", async () => {
  const input = { arrival: "2099-02-27", departure: "2099-03-02", adults: 2, children: 0 };
  assert.equal(bookingRequest.safeParse({ ...input, arrival: "2099-02-30" }).success, false);
  assert.equal(bookingRequest.safeParse({ ...input, children: 1, childAges: [] }).success, false);
  assert.deepEqual(await bookingProvider.availability(bookingRequest.parse(input)), { status: "provider_not_configured" });
});

test("internal credentials fail closed and common contact identifiers are redacted", () => {
  const request = new Request("http://localhost", { headers: { authorization: "Bearer example" } });
  assert.equal(authorized(request, undefined), false);
  assert.equal(authorized(request, "different"), false);
  assert.equal(redact("Позвоните +7 (927) 555-55-55 или a@example.com @example"), "Позвоните [скрыто] или [скрыто] [скрыто]");
});

test("accommodations omit hidden records and preserve booking IDs", () => {
  const site = structuredClone(siteDefaults);
  site.prozhivanie.items[0].visible = false;
  const items = accommodations(site);
  assert.deepEqual(items.map(({ id }) => id), ["cottage", "bedrooms", "family"]);
  assert.equal(items[0].providerCategoryId, null);
  assert.equal(items[0].mapObjectId, null);
});

test("booking context validates partial dates and published categories", async () => {
  process.env.CMS_ENABLED = "false";
  const base = { id: "68012265-400f-4edb-be2a-896de907f84d", text: "Подскажите" };
  const { context } = guestMessage.parse({ ...base, context: { path: "/bronirovanie", stay: { adults: 2, categoryId: "family" } } });
  assert.deepEqual(await pageContext(context), {
    route: "/bronirovanie", type: "booking", id: "family", stay: { adults: 2, categoryId: "family" },
  });
  assert.equal(guestMessage.safeParse({ ...base, context: { path: "/bronirovanie", stay: { arrival: "2099-02-30" } } }).success, false);
  assert.deepEqual(await pageContext({ path: "/admin/site" }), { route: "/", type: "other", id: null, stay: null });
});
