"use client";

import { useState } from "react";

/** Копирует номер для перевода: на телефоне его удобно вставить в приложение банка. */
export function CopyPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);
  const digits = phone.replace(/[^\d+]/g, "");
  return (
    <button
      className="button-secondary payment-copy"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(digits);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Скопируйте номер:", digits);
        }
      }}
    >
      <span aria-live="polite">{copied ? "Номер скопирован" : "Скопировать номер"}</span>
    </button>
  );
}
