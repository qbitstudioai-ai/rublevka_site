import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db";
import { activities, events, registrations } from "./schema";
import { registerGuest } from "./registration";

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
      ...overrides,
    })
    .returning();
  const input = {
    eventId: event.id,
    requestId: randomUUID(),
    name: "Тестовый Участник",
    phone: "+7 (000) 000-00-00",
    consent: true,
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
  await assert.rejects(registerGuest({ ...chosen, requestId: randomUUID() }));
  await db
    .update(activities)
    .set({ price: 60000 })
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
