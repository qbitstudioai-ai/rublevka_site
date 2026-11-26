"use server";

import { revalidatePath } from "next/cache";
import { sectionIds } from "@/content/sections";
import { CmsError, type SiteData, type SiteKey } from "@/server/cms/model";
import { requireSiteMutation, SiteAccessError } from "@/server/cms/auth";
import { cmsEnabled } from "@/server/cms/public";
import {
  publishDraft,
  readDocument,
  restorePublished,
  saveDraft,
  submitDraft,
} from "@/server/cms/store";

export type ContentCommand = "save" | "submit" | "publish" | "restore";
export type EditorSnapshot = {
  draft: SiteData[SiteKey];
  revision: number;
  state: "draft" | "review" | "published";
  publishedAt: string | null;
  hasPrevious: boolean;
  previousAt: string | null;
};
export type RelatedMediaInput = {
  revision: number;
  data?: SiteData["media"];
};

function snapshot(record: Awaited<ReturnType<typeof readDocument>>): EditorSnapshot {
  return {
    draft: record.draft,
    revision: record.revision,
    state: record.state,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    hasPrevious: record.hasPrevious,
    previousAt: record.previousAt?.toISOString() ?? null,
  };
}

export async function updateSiteContent(
  key: SiteKey,
  command: ContentCommand,
  revision: number,
  data?: unknown,
  relatedMedia?: RelatedMediaInput,
): Promise<
  | { snapshot: EditorSnapshot; mediaSnapshot?: EditorSnapshot }
  | { error: string }
> {
  try {
    const user = await requireSiteMutation(command === "publish" || command === "restore");
    if ((command === "publish" || command === "restore") && !cmsEnabled()) {
      return { error: "Публикация отключена. Включите CMS_ENABLED=true и перезапустите сайт. Черновик сохранён." };
    }
    if (![...sectionIds, "book", "contacts", "media"].includes(key)) return { error: "Раздел не найден." };
    if (!Number.isSafeInteger(revision) || revision < 0) return { error: "Обновите страницу редактора." };
    let mediaChanged = false;
    switch (command) {
      case "save":
        mediaChanged = Boolean((await saveDraft(
          key,
          data,
          revision,
          user.id,
          relatedMedia && key !== "media"
            ? { revision: relatedMedia.revision, input: relatedMedia.data }
            : undefined,
        )).mediaRevision);
        break;
      case "submit":
        mediaChanged = Boolean((await submitDraft(
          key,
          revision,
          user.id,
          relatedMedia && key !== "media"
            ? { revision: relatedMedia.revision }
            : undefined,
        )).mediaRevision);
        break;
      case "publish":
        mediaChanged = Boolean((await publishDraft(
          key,
          revision,
          user.id,
          relatedMedia && key !== "media"
            ? { revision: relatedMedia.revision }
            : undefined,
        )).mediaRevision);
        break;
      case "restore":
        await restorePublished(key, revision, user.id);
        break;
      default:
        return { error: "Неизвестное действие." };
    }
    if (command === "publish" || command === "restore") {
      // Always invalidate the edited public page explicitly. The root layout
      // invalidation below covers shared media, but does not reliably evict an
      // already-rendered dynamic section in every Next.js runtime.
      if (key !== "media") {
        revalidatePath(
          key === "book" ? "/" : key === "contacts" ? "/kontakty" : `/${key}`,
        );
      }
      if (key === "media" || key === "contacts" || relatedMedia || mediaChanged) {
        revalidatePath("/", "layout");
      }
      revalidatePath("/sitemap.xml");
    }
    const [record, mediaRecord] = await Promise.all([
      readDocument(key),
      (relatedMedia || mediaChanged) && key !== "media" ? readDocument("media") : undefined,
    ]);
    return {
      snapshot: snapshot(record),
      mediaSnapshot: mediaRecord ? snapshot(mediaRecord) : undefined,
    };
  } catch (error) {
    if (error instanceof SiteAccessError || error instanceof CmsError) return { error: error.message };
    return { error: "Изменения не удалось сохранить. Повторите попытку." };
  }
}
