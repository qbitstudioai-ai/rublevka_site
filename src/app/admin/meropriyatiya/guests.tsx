"use client";
import { useState, useTransition } from "react";
import { ActionForm, type FormState } from "../form";
import type { ParticipantRow } from "@/server/admin/participants";
import { searchParticipants, updateParticipant } from "./actions";
import { servicePrice } from "@/components/events/service-price";
import { guestStates, payStates } from "./labels";

export function Guests({
  initial,
  eventId,
  isAdmin,
}: {
  initial: ParticipantRow[];
  eventId: string;
  isAdmin: boolean;
}) {
  const [rows, setRows] = useState(initial),
    [query, setQuery] = useState(""),
    [applied, setApplied] = useState(""),
    [page, setPage] = useState(0),
    [pending, start] = useTransition(),
    [notice, setNotice] = useState("");
  function search(term: string, number: number) {
    start(async () => {
      try {
        const next = await searchParticipants(eventId, term, number);
        setRows(next);
        setApplied(term);
        setPage(number);
        setNotice("");
      } catch {
        setNotice("Не удалось загрузить список.");
      }
    });
  }
  async function save(previous: FormState, form: FormData) {
    const result = await updateParticipant(previous, form);
    if (result.ok) {
      setRows(await searchParticipants(eventId, applied, page));
    }
    return result;
  }
  return (
    <>
      <form
        className="office-search"
        onSubmit={(e) => {
          e.preventDefault();
          search(query, 0);
        }}
      >
        <label>
          Поиск по имени или телефону
          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button disabled={pending}>Найти</button>
      </form>
      <p role="status">{notice}</p>
      <div className="office-guests" aria-busy={pending}>
        {rows.map((row) => (
          <article key={row.id}>
            <h3>{row.name}</h3>
            <p>
              {row.phone}
              {row.messenger && " · " + row.messenger}
            </p>
            <p>Заявка № {row.id}</p>
            <p>Участников: {row.groupSize}</p>
            {row.activities.length > 0 ? (
              <ul aria-label="Выбранные услуги">
                {row.activities.map((activity, index) => (
                  <li key={index}>
                    {activity.title} ·{" "}
                    {servicePrice(activity.price, activity.priceSuffix)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Основная программа</p>
            )}
            <p>
              Предварительно{" "}
              {new Intl.NumberFormat("ru-RU", {
                style: "currency",
                currency: "RUB",
              }).format(row.total / 100)}
              {row.hasQuote && " + по запросу"}
            </p>
            <ActionForm
              key={row.id + row.status + row.paymentStatus}
              action={save}
              submit="Сохранить статусы"
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="beforeStatus" value={row.status} />
              <input
                type="hidden"
                name="beforePayment"
                value={row.paymentStatus}
              />
              <div className="office-grid">
                <label>
                  Статус участия
                  <select name="status" defaultValue={row.status}>
                    {Object.entries(guestStates).map(([k, v]) => (
                      <option
                        key={k}
                        value={k}
                        disabled={
                          row.status === "cancelled" && k !== "cancelled"
                        }
                      >
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                {isAdmin ? (
                  <label>
                    Статус оплаты
                    <select
                      name="paymentStatus"
                      defaultValue={row.paymentStatus}
                    >
                      {Object.entries(payStates).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <small>Изменяйте только по подтверждённым сведениям.</small>
                  </label>
                ) : (
                  <p>{payStates[row.paymentStatus]}</p>
                )}
              </div>
            </ActionForm>
          </article>
        ))}
      </div>
      {!rows.length && <p>Заявок по выбранным условиям нет.</p>}
      {(page > 0 || rows.length === 50) && (
        <nav className="office-pager" aria-label="Страницы участников">
          <button
            disabled={pending || page === 0}
            onClick={() => search(applied, page - 1)}
          >
            Назад
          </button>
          <span>{page + 1}</span>
          <button
            disabled={pending || rows.length < 50}
            onClick={() => search(applied, page + 1)}
          >
            Дальше
          </button>
        </nav>
      )}
    </>
  );
}
