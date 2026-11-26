import assert from "node:assert/strict";
import { test } from "@playwright/test";
import { assistantEvents } from "../../lib/server/assistant-events";
import { createEvent, setEventStatus, updateEvent } from "../../lib/server/repo/events";
import { setActivityActive } from "../../lib/server/repo/activities";
import { makeActivity } from "./helpers";
import { openDatabase } from "../../db/migrator.mjs";
import { runMigrations } from "../../db/migrator.mjs";

test("assistant API reads current published SQLite details and overlapping dates", () => {
  const db = openDatabase(":memory:");
  try {
    runMigrations(db);
    const event = {
      slug: "assistant-test", title: "Поход", eventDate: "2099-04-01", endDate: "2099-04-03",
      startTime: "10:00", endTime: "12:00", shortDescription: "Кратко",
      longDescription: "Полное описание", extraInfo: "", heroFit: "cover" as const,
      locationText: null, priceKopecks: null, status: "draft" as const,
    };
    const id = createEvent(db, event, null);
    const query = new URLSearchParams("from=2099-04-02&to=2099-04-02&q=поход");
    assert.equal(assistantEvents(db, null, query).total, 0);
    setEventStatus(db, id, "published");
    assert.equal(assistantEvents(db, null, query).total, 1);
    assert.equal(assistantEvents(db, String(id), new URLSearchParams()).item?.longDescription, event.longDescription);
    const activityId = makeActivity(db, id, { title: "Активная услуга", longDescription: "Условия участия" });
    makeActivity(db, id, { title: "Скрытая услуга", isActive: false });
    assert.deepEqual(assistantEvents(db, String(id), new URLSearchParams()).item?.activities.map(({ description }) => description), ["Условия участия"]);
    setActivityActive(db, id, activityId, false);
    assert.deepEqual(assistantEvents(db, String(id), new URLSearchParams()).item?.activities, []);
    assert.equal(assistantEvents(db, String(id), new URLSearchParams()).items, undefined);
    updateEvent(db, id, { ...event, status: "published", longDescription: "Обновлено" }, undefined);
    assert.equal(assistantEvents(db, String(id), new URLSearchParams()).item?.longDescription, "Обновлено");
    setEventStatus(db, id, "draft");
    assert.equal(assistantEvents(db, String(id), new URLSearchParams()).item, null);
  } finally { db.close(); }
});
