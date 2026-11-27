import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import sharp from "sharp";
import { db, pool } from "../events/db";
import { cmsSiteStaff } from "./auth-schema";
import { siteDefaults } from "./defaults";
import { storeCmsImage } from "./image";
import { CmsError } from "./model";
import {
  cmsSiteContentAudit,
  cmsSiteDocumentMediaDrafts,
  cmsSiteDocuments,
} from "./schema";
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
let mediaDirectory: string;

before(async () => {
  mediaDirectory = await mkdtemp(join(tmpdir(), "rublevka-cms-media-"));
  process.env.CMS_MEDIA_DIR = mediaDirectory;
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
after(async () => {
  await pool.end();
  await rm(mediaDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});

test("a three-chapter PostgreSQL record keeps existing edits and publishes chapter V through review", async () => {
  const published = {
    ...siteDefaults.book,
    chapters: structuredClone([
      siteDefaults.book.chapters[0],
      siteDefaults.book.chapters[2],
      siteDefaults.book.chapters[3],
    ]),
  };
  published.chapters[0].title = "Старая обложка";
  const draft = structuredClone(published);
  draft.chapters[0].title = "Обложка в черновике";
  const key = eq(cmsSiteDocuments.key, "book");
  await db.update(cmsSiteDocuments).set({ published, draft, state: "draft" }).where(key);

  const legacy = await readDocument("book");
  assert.deepEqual(legacy.draft.chapters.map((chapter) => chapter.layout), [
    "opening", "events", "index", "closing", "manifesto",
  ]);
  assert.equal(legacy.draft.chapters[0].title, "Обложка в черновике");
  assert.equal(legacy.published.chapters[0].title, "Старая обложка");
  assert.deepEqual(legacy.draft.chapters.slice(2, 4).map((chapter) => chapter.layout), ["index", "closing"]);
  assert.deepEqual(legacy.published.chapters.slice(2, 4).map((chapter) => chapter.layout), ["index", "closing"]);
  const [untouched] = await db.select().from(cmsSiteDocuments).where(key);
  assert.deepEqual(untouched.published, published);
  assert.deepEqual(untouched.draft, draft);
  assert.equal(untouched.state, "draft");
  assert.equal(untouched.revision, legacy.revision);
  await assert.rejects(saveDraft("book", draft, legacy.revision, admin), CmsError);

  const chapter = legacy.draft.chapters[4];
  assert.ok(chapter.layout === "manifesto");
  chapter.subtitle = "Тепло и внимание к каждому Гостю!";
  const saved = await saveDraft("book", legacy.draft, legacy.revision, admin);
  assert.deepEqual(await readPublished("book"), legacy.published);
  const review = await submitDraft("book", saved.revision, admin);
  const live = await publishDraft("book", review.revision, admin);
  assert.deepEqual(await readPublished("book"), legacy.draft);

  await restorePublished("book", live.revision, admin);
  assert.deepEqual(await readPublished("book"), legacy.published);
});

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

test("a page and its stable media replacement publish atomically", async () => {
  const page = await readDocument("prozhivanie");
  const media = await readDocument("media");
  const digest = "c".repeat(64);
  const replacementSrc = `/cms-media/${digest}.webp`;
  await storeCmsImage(
    `${digest}.webp`,
    await sharp({
      create: {
        width: 16,
        height: 9,
        channels: 3,
        background: "#6b4b2a",
      },
    }).webp().toBuffer(),
  );
  const replacementMedia = structuredClone(media.published);
  const replacement = replacementMedia.items.find(
    (item) => item.id === "house-oaks",
  );
  assert.ok(replacement);
  Object.assign(replacement, {
    src: replacementSrc,
    sourceUrl: replacementSrc,
    width: 16,
    height: 9,
  });

  const saved = await saveDraft(
    "prozhivanie",
    page.draft,
    page.revision,
    editor,
    { revision: media.revision, input: replacementMedia },
  );
  assert.equal(
    (await readPublished("media")).items.find(
      (item) => item.id === "house-oaks",
    )?.src,
    media.published.items.find((item) => item.id === "house-oaks")?.src,
  );
  assert.ok(saved.mediaRevision);
  const [link] = await db
    .select()
    .from(cmsSiteDocumentMediaDrafts)
    .where(eq(cmsSiteDocumentMediaDrafts.documentKey, "prozhivanie"));
  assert.equal(link.mediaRevision, saved.mediaRevision);

  // Emulate a replacement saved before the linkage migration was deployed.
  await db
    .delete(cmsSiteDocumentMediaDrafts)
    .where(eq(cmsSiteDocumentMediaDrafts.documentKey, "prozhivanie"));

  // Publishing can happen after a reload or by another administrator, so the
  // server must remember the media draft without a client-supplied revision.
  await publishDraft("prozhivanie", saved.revision, admin);
  assert.equal(
    (await readPublished("media")).items.find(
      (item) => item.id === "house-oaks",
    )?.src,
    replacementSrc,
  );
  assert.equal((await readPublished("prozhivanie")).photo, "house-oaks");
});

test("publishing media separately clears linked page revisions", async () => {
  const page = await readDocument("prozhivanie");
  const media = await readDocument("media");
  const digest = "e".repeat(64);
  const replacementSrc = `/cms-media/${digest}.webp`;
  await storeCmsImage(
    `${digest}.webp`,
    await sharp({
      create: {
        width: 18,
        height: 10,
        channels: 3,
        background: "#345f87",
      },
    }).webp().toBuffer(),
  );
  const replacementMedia = structuredClone(media.published);
  const replacement = replacementMedia.items.find(
    (item) => item.id === "house-oaks",
  );
  assert.ok(replacement);
  Object.assign(replacement, {
    src: replacementSrc,
    sourceUrl: replacementSrc,
    width: 18,
    height: 10,
  });

  const saved = await saveDraft(
    "prozhivanie",
    page.draft,
    page.revision,
    editor,
    { revision: media.revision, input: replacementMedia },
  );
  assert.ok(saved.mediaRevision);
  await publishDraft("media", saved.mediaRevision, admin);
  assert.equal(
    (await db.select().from(cmsSiteDocumentMediaDrafts)).length,
    0,
  );

  await publishDraft("prozhivanie", saved.revision, admin);
  assert.equal(
    (await readPublished("media")).items.find(
      (item) => item.id === "house-oaks",
    )?.src,
    replacementSrc,
  );
});

test("publishing checks CMS dimensions against the stored image", async () => {
  const media = await readDocument("media");
  const digest = "d".repeat(64);
  const src = `/cms-media/${digest}.webp`;
  await storeCmsImage(
    `${digest}.webp`,
    await sharp({
      create: {
        width: 20,
        height: 10,
        channels: 3,
        background: "#24452d",
      },
    }).webp().toBuffer(),
  );
  const draft = structuredClone(media.published);
  const asset = draft.items.find((item) => item.id === "house-oaks");
  assert.ok(asset);
  Object.assign(asset, { src, sourceUrl: src, width: 2000, height: 1000 });
  const saved = await saveDraft("media", draft, media.revision, editor);

  await assert.rejects(
    publishDraft("media", saved.revision, admin),
    /размеры файла/i,
  );
});

test("guest rules, FAQ and restaurant reach the API only after contacts publication", async () => {
  const { knowledge } = await import("../assistant/knowledge");
  const previous = process.env.CMS_ENABLED;
  process.env.CMS_ENABLED = "true";
  try {
    const contacts = await readDocument("contacts");
    const guestInformation = { description: "Описание из CMS", visitingTerms: "Правила посещения из CMS",
      stayRules: "Правила проживания из CMS", checkIn: "14:30", checkOut: "11:00",
      faq: [{ question: "Вопрос из CMS?", answer: "Ответ из CMS." }], restaurant: "Сведения о ресторане из CMS" };
    const saved = await saveDraft("contacts", { ...contacts.published, guestInformation }, contacts.revision, editor);
    assert.notDeepEqual((await knowledge("faq", undefined, new URLSearchParams())).data,
      { items: guestInformation.faq, status: "published" });
    await submitDraft("contacts", saved.revision, editor);
    const ready = await readDocument("contacts");
    await publishDraft("contacts", ready.revision, admin);
    const complex = await knowledge("complex", undefined, new URLSearchParams());
    assert.equal((complex.data as { checkIn: string }).checkIn, "14:30");
    assert.equal((complex.data as { description: string }).description, guestInformation.description);
    assert.deepEqual((await knowledge("faq", undefined, new URLSearchParams())).data,
      { items: guestInformation.faq, status: "published" });
    const restaurant = await knowledge("services", "restaurant", new URLSearchParams());
    assert.equal((restaurant.data as { description: string }).description, guestInformation.restaurant);
  } finally {
    if (previous === undefined) delete process.env.CMS_ENABLED;
    else process.env.CMS_ENABLED = previous;
  }
});
