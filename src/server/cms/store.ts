import { eq, sql } from "drizzle-orm";
import { db } from "../events/db";
import { cmsSiteStaff } from "./auth-schema";
import { siteDefaults } from "./defaults";
import { hasCmsImage } from "./image";
import {
  CmsError,
  hasSiteKey,
  parseSiteData,
  photoReferences,
  type SiteData,
  type SiteKey,
} from "./model";
import { cmsSiteContentAudit, cmsSiteDocuments } from "./schema";

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
      item.id.startsWith("upload-"),
    );
    const present = await Promise.all(
      uploads.map((item) => hasCmsImage(item.src.slice("/cms-media/".length))),
    );
    if (present.includes(false))
      throw new CmsError(
        "Часть загруженных файлов отсутствует. Загрузите фотографии повторно.",
      );
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
      const data = parseSiteData(key, input);
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
    return updated;
  });
}

export function saveDraft(
  key: SiteKey,
  input: unknown,
  revision: number,
  actorId: string,
) {
  return change(key, revision, actorId, "save", input);
}

export function submitDraft(key: SiteKey, revision: number, actorId: string) {
  return change(key, revision, actorId, "submit");
}

export function publishDraft(key: SiteKey, revision: number, actorId: string) {
  return change(key, revision, actorId, "publish");
}

export function restorePublished(
  key: SiteKey,
  revision: number,
  actorId: string,
) {
  return change(key, revision, actorId, "restore");
}
