"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { SectionId } from "@/content/sections";
import { updateSiteContent, type ContentCommand, type EditorSnapshot } from "@/app/admin/site/content-actions";
import type { CmsMedia, SiteData, SiteKey } from "@/server/cms/model";
import { replaceMediaFile } from "@/server/cms/media-replacement";
import { BookFields, ContactFields, GuideFields, SeoFields } from "./content-fields";
import { Status } from "./fields";
import { MediaLibrary } from "./media-library";
import { ContentPreview } from "./preview";

const messages: Record<ContentCommand, string> = {
  save: "Черновик сохранён.",
  submit: "Черновик отправлен на проверку.",
  publish: "Изменения опубликованы.",
  restore: "Предыдущая версия восстановлена.",
};
const date = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Volgograd",
});

export function ContentEditor({
  documentKey, initial, mediaInitial, initialMediaLinked, draftMedia, canPublish, canonical, seoOnly, selectedItem,
}: {
  documentKey: SiteKey;
  initial: EditorSnapshot;
  mediaInitial: EditorSnapshot;
  initialMediaLinked: boolean;
  draftMedia: string[];
  canPublish: boolean;
  canonical: string;
  seoOnly: boolean;
  selectedItem?: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial.draft);
  const [savedMedia, setSavedMedia] = useState(mediaInitial);
  const [mediaValue, setMediaValue] = useState(
    () => mediaInitial.draft as SiteData["media"],
  );
  const [mediaLinked, setMediaLinked] = useState(initialMediaLinked);
  const [draftMediaIds, setDraftMediaIds] = useState(draftMedia);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const previewRegion = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ text: string; error?: true }>();
  const [pending, startTransition] = useTransition();
  const mediaDirty = documentKey !== "media" &&
    JSON.stringify(mediaValue) !== JSON.stringify(savedMedia.draft);
  const isDirty = JSON.stringify(value) !== JSON.stringify(saved.draft) || mediaDirty;
  useEffect(() => {
    if (preview) previewRegion.current?.focus();
  }, [preview]);
  useEffect(() => {
    if (!isDirty) return;

    function warnUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }
    function warnNavigation(event: MouseEvent) {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (target && (!target.target || target.target === "_self") &&
          !target.getAttribute("href")?.startsWith("#") &&
          !window.confirm("Изменения ещё не сохранены. Покинуть редактор?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function warnSignOut(event: SubmitEvent) {
      if (event.target instanceof HTMLFormElement && event.target.closest(".sa-account") &&
          !window.confirm("Изменения ещё не сохранены. Выйти из панели?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", warnUnload);
    window.document.addEventListener("click", warnNavigation, true);
    window.document.addEventListener("submit", warnSignOut, true);
    return () => {
      window.removeEventListener("beforeunload", warnUnload);
      window.document.removeEventListener("click", warnNavigation, true);
      window.document.removeEventListener("submit", warnSignOut, true);
    };
  }, [isDirty]);

  function run(command: ContentCommand) {
    if (command === "restore" && !window.confirm(
      saved.state === "published"
        ? "Вернуть предыдущую опубликованную версию на сайт?"
        : "Вернуть предыдущую версию на сайт? Сохранённый черновик останется в редакторе.",
    )) return;
    setMessage(undefined);
    startTransition(async () => {
      try {
        const relatedMedia = documentKey !== "media" && (mediaDirty || mediaLinked)
          ? {
              revision: savedMedia.revision,
              data: command === "save" ? mediaValue : undefined,
            }
          : undefined;
        const response = await updateSiteContent(
          documentKey,
          command,
          saved.revision,
          command === "save" ? value : undefined,
          relatedMedia,
        );
        if ("error" in response) {
          setMessage({ text: response.error, error: true });
          return;
        }
        setSaved(response.snapshot);
        setValue(response.snapshot.draft);
        if (response.mediaSnapshot) {
          setSavedMedia(response.mediaSnapshot);
          setMediaValue(response.mediaSnapshot.draft as SiteData["media"]);
          setMediaLinked(command !== "publish" && command !== "restore");
          if (command === "publish" || command === "restore") {
            setDraftMediaIds([]);
          }
        }
        setMessage({ text: messages[command] });
      } catch {
        setMessage({ text: "Не удалось связаться с сервером. Повторите попытку.", error: true });
      }
    });
  }

  const currentMedia = documentKey === "media"
    ? value as SiteData["media"]
    : mediaValue;
  async function uploadPhoto(file: File, currentId?: string) {
    setUploading(true);
    try {
      const response = await fetch("/admin/site/media/upload", {
        method: "POST",
        body: file,
      });
      const payload = await response.json() as {
        asset?: CmsMedia;
        error?: string;
      };
      if (!response.ok || !payload.asset) {
        throw new Error(payload.error ?? "Не удалось загрузить фотографию.");
      }
      const existing = currentId
        ? currentMedia.items.find((item) => item.id === currentId)
        : undefined;
      const asset = existing
        ? replaceMediaFile(existing, payload.asset)
        : payload.asset;
      const update = (media: SiteData["media"]): SiteData["media"] => ({
        ...media,
        items: existing
          ? media.items.map((item) => item.id === existing.id ? asset : item)
          : media.items.some((item) => item.id === asset.id)
            ? media.items
            : [...media.items, asset],
      });
      if (documentKey === "media") {
        setValue((current) => update(current as SiteData["media"]));
      } else {
        setMediaValue(update);
        setMediaLinked(true);
      }
      setDraftMediaIds((current) => current.includes(asset.id)
        ? current
        : [...current, asset.id]);
      return asset.id;
    } finally {
      setUploading(false);
    }
  }

  const currentDraftMedia = new Set(draftMediaIds);
  for (const item of currentMedia.items) {
    const savedItem = (savedMedia.draft as SiteData["media"]).items.find(
      (candidate) => candidate.id === item.id,
    );
    if (!savedItem || JSON.stringify(savedItem) !== JSON.stringify(item)) {
      currentDraftMedia.add(item.id);
    }
  }
  const photos = {
    items: currentMedia.items,
    draftMedia: [...currentDraftMedia],
    uploadPhoto,
  };
  const metadata = documentKey === "book" || documentKey === "contacts" || documentKey === "media"
    ? null : value as SiteData[SectionId];
  const currentStatus = saved.state;
  return (
    <div className="sa-grid">
      <div className="sa-stack">
        <a className="sa-button sa-mobile-jump" href="#site-publish">К публикации ↓</a>
        {preview && (
          <div ref={previewRegion} tabIndex={-1}>
            <ContentPreview document={documentKey} data={value} media={currentMedia.items} seoOnly={seoOnly} />
          </div>
        )}
        <fieldset className="sa-editor-fields sa-stack" disabled={pending}>
          {!seoOnly && documentKey === "book" && (
            <BookFields value={value as SiteData["book"]} change={setValue} {...photos} />
          )}
          {!seoOnly && documentKey === "contacts" && (
            <ContactFields value={value as SiteData["contacts"]} change={setValue} />
          )}
          {!seoOnly && documentKey === "media" && (
            <MediaLibrary value={value as SiteData["media"]} draftMedia={[...currentDraftMedia]}
              uploading={uploading} setUploading={setUploading}
              uploadPhoto={uploadPhoto}
              change={(update) => setValue((current) =>
                typeof update === "function" ? update(current as SiteData["media"]) : update
              )} />
          )}
          {!seoOnly && metadata && (
            <GuideFields value={metadata} change={setValue} selectedItem={selectedItem} {...photos} />
          )}
          {(metadata || documentKey === "book") && (
            <SeoFields canonical={canonical} value={metadata ?? value as SiteData["book"]}
              change={(fields) => setValue({ ...value, ...fields })} />
          )}
        </fieldset>
      </div>
      <aside id="site-publish" className="sa-panel sa-publish sa-stack" aria-label="Публикация">
        <h2>Публикация</h2>
        <Status state={currentStatus} />
        {saved.publishedAt && <p className="sa-hint">На сайте с {date.format(new Date(saved.publishedAt))}</p>}
        {isDirty && <p className="sa-warning" role="status">Есть несохранённые изменения</p>}
        {!isDirty && mediaLinked && <p className="sa-warning" role="status">Есть неопубликованные изменения фотографий</p>}
        {message && <p role={message.error ? "alert" : "status"} className={message.error ? "sa-error" : "sa-success"}>
          {message.text}
        </p>}
        {!!metadata?.items.length && !seoOnly && <a href="#site-objects" className="sa-button">К карточкам объектов</a>}
        {documentKey !== "media" && <button className="sa-button" type="button"
          aria-pressed={preview} onClick={() => setPreview(!preview)}>
          {preview ? "Скрыть предпросмотр" : "Предпросмотр"}
        </button>}
        <button className={canPublish && !isDirty && currentStatus !== "published" ? "sa-button" : "sa-button sa-button-primary"}
          type="button" disabled={pending || uploading || !isDirty} onClick={() => run("save")}>Сохранить черновик</button>
        {!canPublish && <button className="sa-button" type="button"
          disabled={pending || uploading || isDirty || currentStatus !== "draft"} onClick={() => run("submit")}>Отправить на проверку</button>}
        {canPublish && <>
          <button className="sa-button sa-button-primary" type="button"
            disabled={pending || uploading || isDirty || (currentStatus === "published" && !mediaLinked)} onClick={() => run("publish")}>Опубликовать</button>
          {saved.hasPrevious && <button className="sa-button" type="button"
            disabled={pending || uploading || isDirty} onClick={() => run("restore")}>
            Восстановить предыдущую версию
          </button>}
        </>}
        {!canPublish && <p className="sa-hint">Публикацию выполняет администратор.</p>}
      </aside>
    </div>
  );
}
