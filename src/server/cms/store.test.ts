import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../events/db";
import { cmsSiteStaff } from "./auth-schema";
import { siteDefaults } from "./defaults";
import { CmsError } from "./model";
import { cmsSiteContentAudit } from "./schema";
import {
  publishDraft,
  readDocument,
  readPublished,
  restorePublished,
  saveDraft,
  seedSiteContent,
  submitDraft,
} from "./store";

let admin: string;
let editor: string;

before(async () => {
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
      target.pathname === "/rublevka_events_test" &&
      !target.search &&
      !target.hash,
    "CMS tests require an isolated local PostgreSQL database",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  await migrate(db, { migrationsFolder: "drizzle" });
  assert.equal(await seedSiteContent(), 10);
  assert.equal(await seedSiteContent(), 0);

  const staff = await db
    .insert(cmsSiteStaff)
    .values([
      {
        login: "site-test-admin",
        role: "admin",
        passwordHash: "disabled-test-fixture",
      },
      {
        login: "site-test-editor",
        role: "editor",
        passwordHash: "disabled-test-fixture",
      },
    ])
    .returning();
  admin = staff.find((user) => user.role === "admin")!.id;
  editor = staff.find((user) => user.role === "editor")!.id;
});
after(() => pool.end());

test("editing and review preserve the public page until an administrator publishes, with rollback", async () => {
  const current = await readDocument("prozhivanie");
  const content = structuredClone(current.draft);
  content.title = "Тестовый SEO-заголовок раздела проживания";
  content.items[0].description = "Тестовое описание дома.";
  content.items[0].photo = "cottage";

  const draft = await saveDraft(
    "prozhivanie",
    content,
    current.revision,
    editor,
  );
  assert.deepEqual(
    await readPublished("prozhivanie"),
    siteDefaults.prozhivanie,
  );
  await assert.rejects(
    publishDraft("prozhivanie", draft.revision, editor),
    CmsError,
  );
  const review = await submitDraft("prozhivanie", draft.revision, editor);
  await assert.rejects(
    publishDraft("prozhivanie", draft.revision, admin),
    CmsError,
  );
  const published = await publishDraft("prozhivanie", review.revision, admin);
  assert.deepEqual(await readPublished("prozhivanie"), content);
  assert.equal((await readDocument("prozhivanie")).hasPrevious, true);
  assert.equal(await seedSiteContent(), 0);
  assert.deepEqual(await readPublished("prozhivanie"), content);

  const pending = { ...content, body: "Следующая редакция ещё готовится." };
  const nextDraft = await saveDraft(
    "prozhivanie",
    pending,
    published.revision,
    editor,
  );
  await restorePublished("prozhivanie", nextDraft.revision, admin);
  assert.deepEqual(
    await readPublished("prozhivanie"),
    siteDefaults.prozhivanie,
  );
  const restored = await readDocument("prozhivanie");
  assert.equal(restored.state, "draft");
  assert.deepEqual(restored.draft, pending);
});

test("concurrent saves reject stale revisions and contact publications are audited", async () => {
  const current = await readDocument("contacts");
  const candidates = await Promise.allSettled([
    saveDraft(
      "contacts",
      { ...current.draft, phone: "+7 (999) 000-00-01" },
      current.revision,
      editor,
    ),
    saveDraft(
      "contacts",
      { ...current.draft, phone: "+7 (999) 000-00-02" },
      current.revision,
      editor,
    ),
  ]);
  assert.equal(
    candidates.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.deepEqual(await readPublished("contacts"), siteDefaults.contacts);
  const next = await readDocument("contacts");
  await publishDraft("contacts", next.revision, admin);
  assert.equal((await readPublished("contacts")).phone, next.draft.phone);
  const audit = await db
    .select()
    .from(cmsSiteContentAudit)
    .where(
      and(
        eq(cmsSiteContentAudit.documentKey, "contacts"),
        eq(cmsSiteContentAudit.action, "publish"),
      ),
    );
  assert.equal(audit[0].actorId, admin);
});

test("duplicate SEO titles and missing media references fail publication", async () => {
  const current = await readDocument("galereya");
  const duplicate = await saveDraft(
    "galereya",
    { ...current.draft, title: siteDefaults.kontakty.title },
    current.revision,
    editor,
  );
  await assert.rejects(
    publishDraft("galereya", duplicate.revision, admin),
    /SEO-заголовок/,
  );
  const invalidMedia = await saveDraft(
    "galereya",
    { ...current.draft, photo: "absent-cms-image" },
    duplicate.revision,
    editor,
  );
  await assert.rejects(
    publishDraft("galereya", invalidMedia.revision, admin),
    /фотографи/,
  );
  assert.deepEqual(await readPublished("galereya"), siteDefaults.galereya);
});

test("a fabricated upload cannot be published and published references cannot be removed", async () => {
  const document = await readDocument("media");
  const missing = "7".repeat(64);
  const src = "/cms-media/" + missing + ".webp";
  const draft = await saveDraft(
    "media",
    {
      items: [
        ...document.draft.items,
        {
          id: "upload-" + missing,
          name: "Отсутствующая фотография",
          alt: "Отсутствующая фотография",
          description: "Описание к тестовой записи",
          sourceUrl: src,
          src,
          width: 100,
          height: 100,
          focalPoint: "50% 50%",
        },
      ],
    },
    document.revision,
    editor,
  );
  await assert.rejects(
    publishDraft("media", draft.revision, admin),
    /файлов отсутствует/,
  );
  const broken = await saveDraft(
    "media",
    { items: document.draft.items.filter((item) => item.id !== "house-oaks") },
    draft.revision,
    editor,
  );
  await assert.rejects(
    publishDraft("media", broken.revision, admin),
    /фотографи/,
  );
  assert.deepEqual(await readPublished("media"), document.published);
});
