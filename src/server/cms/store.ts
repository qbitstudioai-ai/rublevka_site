import { eq, sql } from "drizzle-orm";
import { db } from "../events/db";
import { cmsSiteStaff } from "./auth-schema";
import { siteDefaults } from "./defaults";
import { cmsImageMetadata, hasCmsImage } from "./image";
import {
  CmsError,
  hasSiteKey,
  parseSiteData,
  photoReferences,
  type SiteData,
  type SiteKey,
} from "./model";
import {
  cmsSiteContentAudit,
  cmsSiteDocumentMediaDrafts,
  cmsSiteDocuments,
} from "./schema";

export { CmsError } from "./model";

type DocumentRow = typeof cmsSiteDocuments.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Change = "save" | "submit" | "publish" | "restore";

function requireDocument(
  row: DocumentRow | undefined,
): asserts row is DocumentRow {
  if (!row) {
    throw new CmsError(
      "Документ не найден. Выполните первоначальный импорт контента.",
    );
  }
}

export async function seedSiteContent() {
  const records = Object.entries(siteDefaults).map(([key, value]) => {
    if (!hasSiteKey(key)) throw new CmsError("Неизвестный раздел CMS.");
    const content = parseSiteData(key, value);
    return { key, draft: content, published: content };
  });
  const rows = await db
    .insert(cmsSiteDocuments)
    .values(records)
    .onConflictDoNothing()
    .returning({ key: cmsSiteDocuments.key });
  return rows.length;
}

export async function readPublished<K extends SiteKey>(
  key: K,
): Promise<SiteData[K]> {
  const [row] = await db
    .select({ published: cmsSiteDocuments.published })
    .from(cmsSiteDocuments)
    .where(eq(cmsSiteDocuments.key, key));
  if (!row) throw new CmsError("Опубликованный документ CMS отсутствует.");
  return parseSiteData(key, row.published);
}

export async function readDocument<K extends SiteKey>(key: K) {
  const [row] = await db
    .select()
    .from(cmsSiteDocuments)
    .where(eq(cmsSiteDocuments.key, key));
  requireDocument(row);

  return {
    key,
    draft: parseSiteData(key, row.draft),
    published: parseSiteData(key, row.published),
    revision: row.revision,
    state: row.state,
    publishedAt: row.publishedAt,
    previousAt: row.previousAt,
    updatedAt: row.updatedAt,
    hasPrevious: row.previous !== null,
  };
}

export async function readPublishedSite(): Promise<SiteData> {
  const rows = await db
    .select({
      key: cmsSiteDocuments.key,
      published: cmsSiteDocuments.published,
    })
    .from(cmsSiteDocuments);
  const byKey = new Map(rows.map((row) => [row.key, row.published]));
  return Object.fromEntries(
    Object.keys(siteDefaults).map((key) => {
      if (!hasSiteKey(key) || !byKey.has(key))
        throw new CmsError("Опубликованный документ CMS отсутствует.");
      return [key, parseSiteData(key, byKey.get(key))];
    }),
  ) as SiteData;
}

export async function listDocuments() {
  return db
    .select({
      key: cmsSiteDocuments.key,
      revision: cmsSiteDocuments.revision,
      state: cmsSiteDocuments.state,
      publishedAt: cmsSiteDocuments.publishedAt,
      updatedAt: cmsSiteDocuments.updatedAt,
    })
    .from(cmsSiteDocuments);
}

async function checkPublication(
  tx: Transaction,
  key: SiteKey,
  content: SiteData[SiteKey],
) {
  const all = await tx
    .select({
      key: cmsSiteDocuments.key,
      published: cmsSiteDocuments.published,
    })
    .from(cmsSiteDocuments);
  const published = Object.fromEntries(
    all.map((row) => [row.key, row.published]),
  ) as Partial<SiteData>;
  const currentMedia = published.media;
  Object.assign(published, { [key]: content });
  if (!published.media) throw new CmsError("Медиатека CMS отсутствует.");

  if (key === "media") {
    const uploads = published.media.items.filter((item) =>
      item.src.startsWith("/cms-media/"),
    );
    const present = await Promise.all(
      uploads.map((item) => hasCmsImage(item.src.slice("/cms-media/".length))),
    );
    if (present.includes(false))
      throw new CmsError(
        "Часть загруженных файлов отсутствует. Загрузите фотографии повторно.",
      );
    const metadata = await Promise.all(
      uploads.map((item) =>
        cmsImageMetadata(item.src.slice("/cms-media/".length)),
      ),
    );
    if (
      metadata.some(
        (value, index) =>
          !value ||
          value.width !== uploads[index].width ||
          value.height !== uploads[index].height,
      )
    ) {
      throw new CmsError(
        "Размеры файла фотографии не совпадают с данными медиатеки. Загрузите фотографию повторно.",
      );
    }
  }
  const media = new Set(published.media.items.map((item) => item.id));
  if (
    key === "media" &&
    currentMedia?.items.some((item) => !media.has(item.id))
  ) {
    throw new CmsError(
      "Сохраните ранее опубликованные фотографии для восстановления предыдущих версий.",
    );
  }
  const titles = new Set<string>();
  for (const documentKey of Object.keys(siteDefaults)) {
    if (
      !hasSiteKey(documentKey) ||
      documentKey === "contacts" ||
      documentKey === "media"
    )
      continue;
    const data = published[documentKey];
    if (!data) throw new CmsError("Опубликованный раздел CMS отсутствует.");
    const title = data.title.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
    if (titles.has(title))
      throw new CmsError("SEO-заголовок уже используется на другой странице.");
    titles.add(title);
    if (photoReferences(documentKey, data).some((ref) => !media.has(ref))) {
      throw new CmsError(
        "Сначала опубликуйте выбранные фотографии. Фотографии, используемые на сайте, должны оставаться в медиатеке.",
      );
    }
  }
}

function assertStableItems(
  key: SiteKey,
  before: SiteData[SiteKey],
  after: SiteData[SiteKey],
) {
  if (key === "book" || key === "media" || key === "contacts") return;
  const existing = new Set(
    (before as SiteData[typeof key]).items.map((item) => item.id),
  );
  const newIds = new Set(
    (after as SiteData[typeof key]).items.map((item) => item.id),
  );
  if ([...existing].some((id) => !newIds.has(id))) {
    throw new CmsError(
      "Сохраните идентификаторы существующих объектов. Чтобы убрать карточку с сайта, снимите её с публикации.",
    );
  }
}

async function change(
  key: SiteKey,
  revision: number,
  actorId: string,
  action: Change,
  input?: unknown,
) {
  return db.transaction(async (tx) => {
    const publication = action === "publish" || action === "restore";
    if (publication) {
      // Serialise publication across documents to enforce unique SEO titles and media references.
      await tx.execute(sql`select pg_advisory_xact_lock(6217417, 1)`);
    }

    const [actor] = await tx
      .select({ role: cmsSiteStaff.role, active: cmsSiteStaff.active })
      .from(cmsSiteStaff)
      .where(eq(cmsSiteStaff.id, actorId))
      .for("share");
    if (!actor?.active || (publication && actor.role !== "admin")) {
      throw new CmsError("У этой учётной записи нет прав на действие.");
    }

    const [row] = await tx
      .select()
      .from(cmsSiteDocuments)
      .where(eq(cmsSiteDocuments.key, key))
      .for("update");
    requireDocument(row);
    if (row.revision !== revision) {
      throw new CmsError(
        "Документ изменился в другом окне. Обновите страницу перед сохранением.",
      );
    }

    const now = new Date();
    const next: Partial<DocumentRow> = {
      revision: row.revision + 1,
      updatedAt: now,
    };
    if (action === "save") {
      const data = parseSiteData(key, input, { allowLegacyBook: false });
      assertStableItems(key, row.draft, data);
      next.draft = data;
      next.state = "draft";
    } else if (action === "submit") {
      if (row.state !== "draft")
        throw new CmsError("Для проверки нужен сохранённый черновик.");
      next.state = "review";
    } else {
      if (action === "publish" && row.state === "published") {
        throw new CmsError("Сначала сохраните изменения как черновик.");
      }
      if (action === "restore" && row.previous === null) {
        throw new CmsError("Предыдущая опубликованная версия отсутствует.");
      }

      let content = parseSiteData(
        key,
        action === "publish" ? row.draft : row.previous,
      );
      if (action === "restore" && key === "media") {
        // Already published IDs can be used by other documents and previous versions.
        const old = content as SiteData["media"];
        const current = parseSiteData("media", row.published);
        const known = new Set(old.items.map((item) => item.id));
        content = {
          items: [
            ...old.items,
            ...current.items.filter((item) => !known.has(item.id)),
          ],
        };
      }
      const hasPendingDraft = action === "restore" && row.state !== "published";
      await checkPublication(tx, key, content);
      Object.assign(next, {
        draft: hasPendingDraft ? row.draft : content,
        published: content,
        previous: row.published,
        previousAt: row.publishedAt,
        publishedAt: now,
        state: hasPendingDraft ? row.state : "published",
      } satisfies Partial<DocumentRow>);
    }

    const [updated] = await tx
      .update(cmsSiteDocuments)
      .set(next)
      .where(eq(cmsSiteDocuments.key, key))
      .returning({ revision: cmsSiteDocuments.revision });
    await tx.insert(cmsSiteContentAudit).values({
      actorId,
      documentKey: key,
      action,
      revision: updated.revision,
    });
    if (key === "media" && (action === "publish" || action === "restore")) {
      // Publishing the media document publishes every pending asset at once,
      // so no page may keep pointing at an obsolete media revision.
      await tx.delete(cmsSiteDocumentMediaDrafts);
    }
    return { ...updated, mediaRevision: undefined };
  });
}

export type RelatedMediaChange = {
  revision: number;
  input?: SiteData["media"];
};

async function changeRelated(
  key: Exclude<SiteKey, "media">,
  revision: number,
  actorId: string,
  action: Exclude<Change, "restore">,
  input: unknown,
  relatedMedia: RelatedMediaChange,
) {
  return db.transaction(async (tx) => {
    const publication = action === "publish";
    if (publication) {
      await tx.execute(sql`select pg_advisory_xact_lock(6217417, 1)`);
    }

    const [actor] = await tx
      .select({ role: cmsSiteStaff.role, active: cmsSiteStaff.active })
      .from(cmsSiteStaff)
      .where(eq(cmsSiteStaff.id, actorId))
      .for("share");
    if (!actor?.active || (publication && actor.role !== "admin")) {
      throw new CmsError("У этой учётной записи нет прав на действие.");
    }

    const lock = async (documentKey: SiteKey, expectedRevision: number) => {
      const [row] = await tx
        .select()
        .from(cmsSiteDocuments)
        .where(eq(cmsSiteDocuments.key, documentKey))
        .for("update");
      requireDocument(row);
      if (row.revision !== expectedRevision) {
        throw new CmsError(
          "Документ изменился в другом окне. Обновите страницу перед сохранением.",
        );
      }
      return row;
    };

    // Always lock media first so every coupled operation uses the same order.
    const mediaRow = await lock("media", relatedMedia.revision);
    const contentRow = await lock(key, revision);

    const apply = async (
      documentKey: SiteKey,
      row: DocumentRow,
      documentInput: unknown,
    ) => {
      const now = new Date();
      const next: Partial<DocumentRow> = {
        revision: row.revision + 1,
        updatedAt: now,
      };
      if (action === "save") {
        const data = parseSiteData(documentKey, documentInput, {
          allowLegacyBook: false,
        });
        assertStableItems(documentKey, row.draft, data);
        next.draft = data;
        next.state = "draft";
      } else if (action === "submit") {
        if (row.state !== "draft") {
          throw new CmsError(
            "Для проверки нужен сохранённый черновик.",
          );
        }
        next.state = "review";
      } else {
        if (row.state === "published") {
          throw new CmsError(
            "Сначала сохраните изменения как черновик.",
          );
        }
        const content = parseSiteData(documentKey, row.draft);
        await checkPublication(tx, documentKey, content);
        Object.assign(next, {
          draft: content,
          published: content,
          previous: row.published,
          previousAt: row.publishedAt,
          publishedAt: now,
          state: "published",
        } satisfies Partial<DocumentRow>);
      }

      const [updated] = await tx
        .update(cmsSiteDocuments)
        .set(next)
        .where(eq(cmsSiteDocuments.key, documentKey))
        .returning({ revision: cmsSiteDocuments.revision });
      await tx.insert(cmsSiteContentAudit).values({
        actorId,
        documentKey,
        action,
        revision: updated.revision,
      });
      return updated.revision;
    };

    const mediaRevision = await apply(
      "media",
      mediaRow,
      relatedMedia.input,
    );
    const nextRevision = action === "publish" && contentRow.state === "published"
      ? contentRow.revision
      : await apply(key, contentRow, input);
    if (action === "publish") {
      // Media is one document: this operation has just published all of its
      // draft assets, including changes linked from any other page.
      await tx.delete(cmsSiteDocumentMediaDrafts);
    } else {
      await tx
        .insert(cmsSiteDocumentMediaDrafts)
        .values({ documentKey: key, mediaRevision })
        .onConflictDoUpdate({
          target: cmsSiteDocumentMediaDrafts.documentKey,
          set: { mediaRevision, updatedAt: new Date() },
        });
    }
    return { revision: nextRevision, mediaRevision };
  });
}

async function linkedMediaChange(key: SiteKey) {
  if (key === "media") return undefined;
  const [links, media, document] = await Promise.all([
    db
      .select({ revision: cmsSiteDocumentMediaDrafts.mediaRevision })
      .from(cmsSiteDocumentMediaDrafts)
      .where(eq(cmsSiteDocumentMediaDrafts.documentKey, key)),
    readDocument("media"),
    readDocument(key),
  ]);
  // A standalone media publication may have consumed an older link. Ignore
  // it even on databases created before link cleanup was introduced.
  if (media.state === "published") return undefined;
  if (links[0]) return { revision: media.revision };

  // Backward-compatible recovery for media drafts saved before linkage was
  // persisted: infer the relation from changed media IDs used by the page.
  const published = new Map(
    media.published.items.map((item) => [item.id, JSON.stringify(item)]),
  );
  const changed = new Set(
    media.draft.items
      .filter((item) => published.get(item.id) !== JSON.stringify(item))
      .map((item) => item.id),
  );
  if (
    photoReferences(key, document.draft).some((id) => changed.has(id))
  ) {
    return { revision: media.revision };
  }
  return undefined;
}

export function saveDraft(
  key: SiteKey,
  input: unknown,
  revision: number,
  actorId: string,
  relatedMedia?: RelatedMediaChange,
) {
  if (relatedMedia && key !== "media") {
    return changeRelated(
      key,
      revision,
      actorId,
      "save",
      input,
      relatedMedia,
    );
  }
  return change(key, revision, actorId, "save", input);
}

export async function submitDraft(
  key: SiteKey,
  revision: number,
  actorId: string,
  relatedMedia?: RelatedMediaChange,
) {
  const mediaChange = relatedMedia ?? await linkedMediaChange(key);
  if (mediaChange && key !== "media") {
    return changeRelated(
      key,
      revision,
      actorId,
      "submit",
      undefined,
      mediaChange,
    );
  }
  return change(key, revision, actorId, "submit");
}

export async function publishDraft(
  key: SiteKey,
  revision: number,
  actorId: string,
  relatedMedia?: RelatedMediaChange,
) {
  const mediaChange = relatedMedia ?? await linkedMediaChange(key);
  if (mediaChange && key !== "media") {
    return changeRelated(
      key,
      revision,
      actorId,
      "publish",
      undefined,
      mediaChange,
    );
  }
  return change(key, revision, actorId, "publish");
}

export function restorePublished(
  key: SiteKey,
  revision: number,
  actorId: string,
) {
  return change(key, revision, actorId, "restore");
}
