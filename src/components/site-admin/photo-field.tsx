"use client";

import { useId, useState } from "react";
import type { CmsMedia } from "@/server/cms/model";
import { Photo } from "./fields";

export function PhotosField({
  label,
  value,
  onChange,
  items,
  draftMedia,
  onUpload,
  optional = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  items: readonly CmsMedia[];
  draftMedia: string[];
  onUpload: (file: File, currentId?: string) => Promise<string>;
  optional?: boolean;
}) {
  const id = useId();
  const uploadId = id + "-upload";
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const asset = items.find((photo) => photo.id === value);

  async function upload(file: File) {
    setUploading(true);
    setError(undefined);
    try {
      onChange(await onUpload(file, value));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить фотографию.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="sa-stack">
      <div className="sa-field">
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled={!optional}>
            {optional ? "Без фото" : "Выберите фото"}
          </option>
          {items.map((photo) => (
            <option key={photo.id} value={photo.id}>
              {photo.name}
              {draftMedia.includes(photo.id) ? " · черновик" : ""}
            </option>
          ))}
        </select>
      </div>
      {asset && <Photo asset={asset} small />}
      <div className="sa-actions">
        <label className="sa-button sa-file-button" htmlFor={uploadId}>
          <span aria-live="polite">
            {uploading ? "Загрузка…" : "Выбрать фото"}
          </span>
        </label>
        <input
          className="sa-file-input"
          id={uploadId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
        {optional && value && (
          <button className="sa-button" type="button" onClick={() => onChange("")}>
            Убрать фото
          </button>
        )}
      </div>
      {error && (
        <p className="sa-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
