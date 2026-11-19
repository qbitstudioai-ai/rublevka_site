import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db";
import { activities, events, registrations } from "./schema";
import { registerGuest } from "./registration";
import { listPublishedEvents, loadPublicEvent } from "./public";

before(async () => {
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
      target.pathname === "/rublevka_events_test",
    "Tests require an isolated local rublevka_events_test database",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  await migrate(db, { migrationsFolder: "drizzle" });
});
after(() => pool.end());

async function setup(overrides: Partial<typeof events.$inferInsert> = {}) {
  const startsAt = new Date(Date.now() + 86400000);
  const [event] = await db
    .insert(events)
    .values({
      slug: randomUUID(),
      title: "Проверка",
      startsAt,
      endsAt: startsAt,
      status: "open",
      price: 0,
      termsVerifiedAt: new Date(),
      ...overrides,
    })
    .returning();
  const input = {
    eventId: event.id,
    requestId: randomUUID(),
    name: "Тестовый Участник",
    phone: "+7 (000) 000-00-00",
    consent: true,
    termsVersion: event.termsVerifiedAt?.getTime() ?? 0,
    activityIds: [] as string[],
  };
  return { event, input };
}

test("registration persists only valid, consented requests for open future events", async () => {
  for (const status of [
    "draft",
    "closed",
    "cancelled",
    "completed",
    "full",
  ] as const) {
    const { input } = await setup({ status });
    await assert.rejects(registerGuest(input));
  }
  await assert.rejects(
    registerGuest((await setup({ termsVerifiedAt: null })).input),
  );
  await assert.rejects(
    registerGuest((await setup({ reviewNote: "Проверить тариф" })).input),
  );
  const past = new Date(Date.now() - 1000);
  await assert.rejects(
    registerGuest((await setup({ startsAt: past, endsAt: past })).input),
  );
  const { input, event } = await setup();
  for (const fields of [
    { consent: false },
    { name: " " },
    { phone: "abc" },
    { activityIds: [randomUUID()] },
  ]) {
    await assert.rejects(registerGuest({ ...input, ...fields }));
  }
  assert.equal(
    (
      await db
        .select()
        .from(registrations)
        .where(eq(registrations.eventId, event.id))
    ).length,
    0,
  );
  const receipt = await registerGuest(input);
  assert.equal(receipt.total, 0);
  assert.equal(receipt.hasQuote, false);
  const [saved] = await db
    .select()
    .from(registrations)
    .where(eq(registrations.id, receipt.id));
  assert.equal(saved.status, "pending");
  assert.equal(saved.paymentStatus, "unpaid");
});

test("an event lock serializes the last place and binds idempotency to the original request", async () => {
  const { input } = await setup({ capacity: 1 });
  const [a, b] = await Promise.all([
    registerGuest(input),
    registerGuest(input),
  ]);
  assert.deepEqual(a, b);
  await assert.rejects(registerGuest({ ...input, name: "Другое Имя" }));
  const { input: other } = await setup({ capacity: 1 });
  const results = await Promise.allSettled([
    registerGuest(other),
    registerGuest({ ...other, requestId: randomUUID() }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});

test("activities honor required selections, capacities and server-side price snapshots", async () => {
  const { event, input } = await setup({ price: 250000 });
  const [paid, quote, free] = await db
    .insert(activities)
    .values([
      {
        eventId: event.id,
        title: "Мастерская",
        price: 55000,
        priceSuffix: "за заявку",
        startsAt: event.startsAt,
        position: 1,
        capacity: 1,
        required: true,
      },
      { eventId: event.id, title: "По запросу", price: null },
      { eventId: event.id, title: "Прогулка", price: 0 },
    ])
    .returning();
  await assert.rejects(registerGuest(input));
  const chosen = {
    ...input,
    activityIds: [paid.id, quote.id, free.id],
    total: 1,
  };
  const saved = await registerGuest(chosen);
  assert.equal(saved.total, 305000);
  assert.equal(saved.hasQuote, true);
  assert.equal(saved.eventPrice, 250000);
  assert.deepEqual(saved.services.at(-1), {
    title: "Мастерская",
    price: 55000,
    priceSuffix: "за заявку",
    startsAt: event.startsAt,
    position: 1,
  });
  await assert.rejects(registerGuest({ ...chosen, requestId: randomUUID() }));
  await db
    .update(activities)
    .set({
      price: 60000,
      priceSuffix: "за группу",
      startsAt: null,
      position: 0,
    })
    .where(eq(activities.id, paid.id));
  assert.deepEqual(await registerGuest(chosen), saved);
});

test("one optional activity place is allocated once and released on cancellation", async () => {
  const { event, input } = await setup({ price: null });
  const [activity] = await db
    .insert(activities)
    .values({
      eventId: event.id,
      title: "Прогулка",
      price: 0,
      capacity: 1,
    })
    .returning();
  const results = await Promise.allSettled(
    [randomUUID(), randomUUID()].map((requestId) =>
      registerGuest({ ...input, requestId, activityIds: [activity.id] }),
    ),
  );
  const successful = results.filter((result) => result.status === "fulfilled");
  assert.equal(successful.length, 1);
  assert.equal(successful[0].value.hasQuote, true);
  assert.equal(successful[0].value.total, 0);
  await db
    .update(registrations)
    .set({ status: "cancelled" })
    .where(eq(registrations.id, successful[0].value.id));
  const next = await registerGuest({ ...input, activityIds: [activity.id] });
  assert.notEqual(next.id, successful[0].value.id);
});

test("party size consumes event and activity capacity and participates in idempotency", async () => {
  const { event, input } = await setup({
    group: true,
    capacity: 5,
    price: 12500,
  });
  const [service] = await db
    .insert(activities)
    .values({
      eventId: event.id,
      title: "Мастерская",
      price: 2000,
      capacity: 4,
    })
    .returning();
  await assert.rejects(registerGuest(input));
  const first = { ...input, groupSize: 3, activityIds: [service.id] };
  const saved = await registerGuest(first);
  assert.equal(saved.groupSize, 3);
  assert.equal(saved.total, 14500);
  await assert.rejects(registerGuest({ ...first, groupSize: 2 }));
  const second = { ...first, requestId: randomUUID(), groupSize: 2 };
  await assert.rejects(registerGuest(second));
  await assert.rejects(
    registerGuest({ ...second, groupSize: 3, activityIds: [] }),
  );
  await registerGuest({ ...second, activityIds: [] });
  const individual = (await setup()).input;
  await assert.rejects(registerGuest({ ...individual, groupSize: 2 }));
});

test("the public read model hides unverified conditions and shows service exhaustion", async () => {
  const { event, input } = await setup({ group: true, capacity: 5 });
  const { event: unverified } = await setup({ termsVerifiedAt: null });
  const { event: needsReview } = await setup({
    reviewNote: "Проверить условия",
  });
  const [service] = await db
    .insert(activities)
    .values([
      { eventId: event.id, title: "Мастерская", capacity: 3, required: true },
      { eventId: event.id, title: "Скрытая услуга", available: false },
    ])
    .returning();
  assert.ok((await listPublishedEvents()).some(({ id }) => id === event.id));
  assert.ok(
    !(await listPublishedEvents()).some(({ id }) =>
      [unverified.id, needsReview.id].includes(id),
    ),
  );
  assert.equal(await loadPublicEvent(unverified.slug), null);
  await registerGuest({ ...input, groupSize: 3, activityIds: [service.id] });
  const view = await loadPublicEvent(event.slug);
  assert.equal(view?.status, "full");
  assert.deepEqual(
    view?.options.map(({ title, available }) => [title, available]),
    [["Мастерская", false]],
  );
});

test("a changed price requires an updated form, without invalidating a saved receipt", async () => {
  const verified = new Date();
  const { event, input } = await setup({
    termsVerifiedAt: verified,
    price: 6500,
  });
  const original = { ...input, termsVersion: verified.getTime() };
  const saved = await registerGuest(original);
  await db
    .update(events)
    .set({ price: 9000, termsVerifiedAt: new Date(verified.getTime() + 1) })
    .where(eq(events.id, event.id));
  assert.deepEqual(await registerGuest(original), saved);
  const retry = { ...original, requestId: randomUUID() };
  await assert.rejects(registerGuest(retry));
  assert.equal(
    (await registerGuest({ ...retry, termsVersion: verified.getTime() + 1 }))
      .total,
    9000,
  );
});
