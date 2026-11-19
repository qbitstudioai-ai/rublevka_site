import Image from "next/image";
import { useId } from "react";
import type { CmsMedia } from "@/server/cms/model";

export function Field({
  label, value, onChange, multiline, hint, type = "text",
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: string;
  type?: "text" | "email" | "number" | "url" | "tel";
}) {
  const id = useId();
  const advice = hint ? id + "-hint" : undefined;
  return (
    <div className="sa-field">
      <label htmlFor={id}>{label}</label>
      {multiline
        ? <textarea id={id} aria-describedby={advice} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} aria-describedby={advice} type={type} step={type === "number" ? "any" : undefined}
            value={value ?? ""} onChange={(e) => onChange(e.target.value)} />}
      {hint && <small id={advice}>{hint}</small>}
    </div>
  );
}

export function Status({ state }: { state: "draft" | "review" | "published" }) {
  const labels = { draft: "Черновик", review: "На проверке", published: "Опубликовано" };
  return <span className="sa-status" data-state={state}>{labels[state]}</span>;
}

export function Photo({
  asset, small = false,
}: { asset: CmsMedia; small?: boolean }) {
  const source = asset.src.startsWith("/cms-media/")
    ? asset.src.replace("/cms-media/", "/admin/site/media-file/")
    : asset.src;
  return <Image src={source} alt={asset.alt} width={asset.width} height={asset.height}
    unoptimized className={small ? "sa-photo sa-photo-small" : "sa-photo"}
    style={{ objectPosition: asset.focalPoint }} />;
}

export function PhotosField({
  label, value, onChange, items, publishedMedia, optional = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  items: readonly CmsMedia[];
  publishedMedia: string[];
  optional?: boolean;
}) {
  const id = useId();
  const asset = items.find((photo) => photo.id === value);
  return (
    <div className="sa-stack">
      <div className="sa-field">
        <label htmlFor={id}>{label}</label>
        <select id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
          <option value="" disabled={!optional}>{optional ? "Без фото" : "Выберите фото"}</option>
          {items.map((photo) => (
            <option key={photo.id} value={photo.id}>
              {photo.name}{publishedMedia.includes(photo.id) ? "" : " · черновик"}
            </option>
          ))}
        </select>
      </div>
      {asset && <Photo asset={asset} small />}
    </div>
  );
}

export function MoveButtons({
  index, count, name, move,
}: {
  index: number;
  count: number;
  name: string;
  move: (step: -1 | 1) => void;
}) {
  return (
    <div className="sa-actions">
      <button className="sa-button" type="button" disabled={index === 0}
        aria-label={`Переместить «${name}» вверх`} onClick={() => move(-1)}>↑</button>
      <button className="sa-button" type="button" disabled={index === count - 1}
        aria-label={`Переместить «${name}» вниз`} onClick={() => move(1)}>↓</button>
    </div>
  );
}

export function moveAt<T>(items: readonly T[], index: number, step: -1 | 1) {
  const result = [...items];
  const target = index + step;
  if (target < 0 || target >= result.length) return result;
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
