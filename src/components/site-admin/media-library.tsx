import { useState, type Dispatch, type SetStateAction } from "react";
import type { CmsMedia, SiteData } from "@/server/cms/model";
import { Field, moveAt, MoveButtons, Photo } from "./fields";

export function MediaLibrary({
  value, change, publishedMedia, uploading, setUploading,
}: {
  value: SiteData["media"];
  change: Dispatch<SetStateAction<SiteData["media"]>>;
  publishedMedia: string[];
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
}) {
  const [selected, setSelected] = useState(value.items[0]?.id);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ text: string; error?: true }>();
  const asset = value.items.find(({ id }) => id === selected);
  const selectedIndex = value.items.findIndex(({ id }) => id === selected);
  function patch(changes: Partial<CmsMedia>) {
    change((current) => ({
      ...current,
      items: current.items.map((photo) => photo.id === selected ? { ...photo, ...changes } : photo),
    }));
  }
  async function upload(file: File) {
    setNotice(undefined);
    setUploading(true);
    try {
      const response = await fetch("/admin/site/media/upload", { method: "POST", body: file });
      const payload = await response.json() as { asset?: CmsMedia; error?: string };
      if (!response.ok || !payload.asset) {
        setNotice({ text: payload.error ?? "Не удалось загрузить файл.", error: true });
        return;
      }
      const newAsset = payload.asset;
      setSelected(newAsset.id);
      if (value.items.some(({ id }) => id === newAsset.id)) {
        setNotice({ text: "Эта фотография уже есть в медиатеке." });
      } else {
        change((current) => current.items.some(({ id }) => id === newAsset.id)
          ? current : { ...current, items: [...current.items, newAsset] });
        setNotice({ text: "Файл загружен. Укажите название и alt-текст, затем сохраните черновик." });
      }
    } catch {
      setNotice({ text: "Загрузка прервалась. Повторите попытку.", error: true });
    } finally {
      setUploading(false);
    }
  }
  const normalized = query.trim().toLocaleLowerCase("ru");
  return (
    <>
      <section className="sa-panel">
        <h2>Фотографии комплекса</h2>
        <div className="sa-fields">
          <Field label="Поиск по названию" value={query} onChange={setQuery} />
          <label className="sa-field">
            {uploading ? "Загрузка…" : "Загрузить фотографию"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }} />
          </label>
        </div>
        {notice && <p className={notice.error ? "sa-error" : "sa-success"}
          role={notice.error ? "alert" : "status"}>{notice.text}</p>}
        <div className="sa-gallery">
          {value.items.filter((item) => item.name.toLocaleLowerCase("ru").includes(normalized)).map((photo) => (
            <button className="sa-media-card sa-media-select" type="button" key={photo.id}
              aria-pressed={selected === photo.id} onClick={() => setSelected(photo.id)}>
              <Photo asset={photo} />
              <strong>{photo.name}</strong>
              {!publishedMedia.includes(photo.id) && <span className="sa-hint">Черновик</span>}
            </button>
          ))}
        </div>
      </section>
      {asset && (
        <section className="sa-panel">
          <div className="sa-item-head">
            <h2>Сведения о фотографии</h2>
            <MoveButtons name={asset.name} index={selectedIndex} count={value.items.length}
              move={(step) => change({ ...value, items: moveAt(value.items, selectedIndex, step) })} />
          </div>
          <Photo asset={asset} small />
          <Field label="Название изображения" value={asset.name} onChange={(name) => patch({ name })} />
          <Field label="Описание изображения" multiline value={asset.description}
            onChange={(description) => patch({ description })} />
          <Field label="Alt-текст" value={asset.alt} onChange={(alt) => patch({ alt })}
            hint="Опишите, что видно на фотографии." />
        </section>
      )}
    </>
  );
}
