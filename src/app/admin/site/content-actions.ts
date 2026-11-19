"use server";

import { revalidatePath } from "next/cache";
import { sectionIds } from "@/content/sections";
import { CmsError, type SiteData, type SiteKey } from "@/server/cms/model";
import { requireSiteMutation, SiteAccessError } from "@/server/cms/auth";
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

export async function updateSiteContent(
  key: SiteKey,
  command: ContentCommand,
  revision: number,
  data?: unknown,
): Promise<{ snapshot: EditorSnapshot } | { error: string }> {
  try {
    const user = await requireSiteMutation(command === "publish" || command === "restore");
    if (![...sectionIds, "book", "contacts", "media"].includes(key)) return { error: "Раздел не найден." };
    if (!Number.isSafeInteger(revision) || revision < 0) return { error: "Обновите страницу редактора." };
    switch (command) {
      case "save":
        await saveDraft(key, data, revision, user.id);
        break;
      case "submit":
        await submitDraft(key, revision, user.id);
        break;
      case "publish":
        await publishDraft(key, revision, user.id);
        break;
      case "restore":
        await restorePublished(key, revision, user.id);
        break;
      default:
        return { error: "Неизвестное действие." };
    }
    if (command === "publish" || command === "restore") {
      if (key === "media" || key === "contacts") {
        revalidatePath("/", "layout");
      } else {
        revalidatePath(key === "book" ? "/" : `/${key}`);
      }
      revalidatePath("/sitemap.xml");
    }
    const { draft, revision: nextRevision, state, publishedAt, hasPrevious, previousAt } = await readDocument(key);
    return { snapshot: {
      draft, revision: nextRevision, state,
      publishedAt: publishedAt?.toISOString() ?? null,
      hasPrevious, previousAt: previousAt?.toISOString() ?? null,
    } };
  } catch (error) {
    if (error instanceof SiteAccessError || error instanceof CmsError) return { error: error.message };
    return { error: "Изменения не удалось сохранить. Повторите попытку." };
  }
}
