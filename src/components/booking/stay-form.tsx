"use client";
import { useEffect, useState } from "react";
import {
  fields,
  initialStay,
  localDay,
  nextDay,
  readStay,
  requestText,
  type Room,
  stayParams,
  validate,
  type Stay,
} from "@/content/stay-request";
import type { MediaAsset } from "@/content/media";
import { MediaFrame } from "../ui/media-frame";
import { bookingAdapters, type ProviderMode } from "./provider";

const storageKey = "rublevka-stay-v1";
const labels: Record<keyof Stay, string> = {
  arrival: "Дата заезда",
  departure: "Дата выезда",
  adults: "Взрослые",
  children: "Дети",
  room: "Тип размещения",
};
export function StayForm({
  mode,
  contact,
  photo,
  roomLabels,
}: {
  mode: ProviderMode;
  contact: { tel: string; email: string };
  photo: MediaAsset;
  roomLabels: Record<Room, string>;
}) {
  const [stay, setStay] = useState(initialStay),
    [submitted, setAttempt] = useState(false),
    [copied, setCopied] = useState(""),
    [today, setDay] = useState("");
  useEffect(() => {
    function restore() {
      let saved = "";
      try {
        saved = sessionStorage.getItem(storageKey) ?? "";
      } catch {}
      const params = new URLSearchParams(location.search);
      const draft = readStay(
        params,
        params.has("arrival") || params.has("departure")
          ? initialStay
          : readStay(new URLSearchParams(saved)),
      );
      if (
        saved &&
        (draft.arrival || draft.departure) &&
        !params.has("arrival") &&
        !params.has("departure")
      ) {
        history.replaceState(history.state, "", "?" + stayParams(draft));
      }
      setCopied("");
      setStay(draft);
      setDay(localDay());
      try {
        sessionStorage.setItem(storageKey, stayParams(draft).toString());
      } catch {}
    }
    restore();
    const clock = setInterval(() => setDay(localDay()), 30000);
    window.addEventListener("popstate", restore);
    return () => {
      clearInterval(clock);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  const errors = validate(stay, today),
    valid = !!today && !Object.keys(errors).length,
    text = valid ? requestText(stay, roomLabels) : "",
    Adapter = bookingAdapters[mode];
  function update(field: keyof Stay, value: string) {
    const next = { ...stay, [field]: value };
    if (field === "arrival" && next.departure && next.departure <= value)
      next.departure = "";
    setStay(next);
    setCopied("");
    setDay(localDay());
    const search = stayParams(next).toString();
    history.replaceState(history.state, "", "?" + search);
    try {
      sessionStorage.setItem(storageKey, search);
    } catch {}
  }
  return (
    <div className="stay-layout">
      <form
        className="stay-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setAttempt(true);
          setDay(localDay());
          const firstError = fields.find(
            (field) => validate(stay, localDay())[field],
          );
          document.getElementById(firstError ?? "stay-summary")?.focus();
        }}
      >
        <h2>Параметры поездки</h2>
        <div className="stay-fields">
          {fields.map((field) => (
            <label key={field} htmlFor={field}>
              {labels[field]}
              {field === "room" ? (
                <select
                  aria-invalid={submitted && !!errors[field]}
                  aria-describedby={
                    submitted && errors[field] ? field + "-error" : undefined
                  }
                  id={field}
                  value={stay[field]}
                  onChange={(e) => update(field, e.target.value)}
                >
                  <option value="">Любой вариант</option>
                  {Object.entries(roomLabels).map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field}
                  type={
                    field === "arrival" || field === "departure"
                      ? "date"
                      : "number"
                  }
                  required
                  min={
                    field === "arrival"
                      ? today
                      : field === "departure"
                        ? nextDay(stay.arrival >= today ? stay.arrival : today)
                        : field === "adults"
                          ? 1
                          : 0
                  }
                  value={stay[field]}
                  aria-invalid={submitted && !!errors[field]}
                  aria-describedby={
                    submitted && errors[field] ? field + "-error" : undefined
                  }
                  onChange={(e) => update(field, e.target.value)}
                />
              )}
              {submitted && errors[field] && (
                <small role="alert" id={field + "-error"}>
                  {errors[field]}
                </small>
              )}
            </label>
          ))}
        </div>
        <button className="guide-action" type="submit">
          Проверить параметры →
        </button>
      </form>
      <section className="stay-aside" aria-labelledby="stay-summary">
        <MediaFrame asset={photo} sizes="(max-width:700px) 94vw, 36vw" eager />
        <div>
          <h2 id="stay-summary" tabIndex={-1}>
            Ваша поездка
          </h2>
          {valid ? (
            <p className="stay-result">{text}</p>
          ) : (
            <p>Укажите даты и состав гостей, чтобы подготовить обращение.</p>
          )}
          <p>
            Онлайн-бронирование готовится к подключению. Наличие мест и
            стоимость на выбранные даты уточнит администратор.
          </p>
          {valid && Adapter ? (
            <Adapter stay={stay} />
          ) : (
            <>
              <a href={contact.tel}>Позвонить администратору</a>
              {valid && (
                <>
                  <a
                    href={`mailto:${contact.email}?subject=${encodeURIComponent("Запрос на проживание")}&body=${encodeURIComponent("Здравствуйте! Подскажите наличие и стоимость.\n" + text)}`}
                  >
                    Написать администратору
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(text);
                        setCopied("Параметры скопированы.");
                      } catch {
                        setCopied("Выделите и скопируйте резюме выше.");
                      }
                    }}
                  >
                    Скопировать параметры
                  </button>
                  <span role="status">{copied}</span>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
