import assert from "node:assert/strict";
import { test } from "node:test";
import { redact } from "./security";

test("redaction preserves dates, ranges, budgets, guest counts, times and house numbers", () => {
  const text = "С 2027-01-02 по 2027-01-05, 02.01.2027–05.01.2027, 2 взрослых и 1 ребёнок, дом №12, в 14:30, 150 000 ₽, бюджет 100000–200000 руб.";
  assert.equal(redact(text), text);
});
test("redaction covers phones, emails, personal names and addresses", () => {
  for (const value of ["+7 (927) 555-55-55", "8 927 555 55 55", "89275555555", "927-555-55-55", "927 555 55 55", "a@example.com",
    "ФИО: Иванов Иван Иванович", "фио: иванов иван иванович", "Иванов Иван Иванович", "г. Москва, ул. Лесная, д. 4",
    "Адрес: Москва, Лесная 5", "Добрый вечер, меня зовут Иванов Иван"]) {
    assert.match(redact(value), /\[скрыто\]/, value);
    assert.doesNotMatch(redact(value), /927|Иванов|Лесная|example/i);
  }
  assert.equal(redact("ФИО: Иванов Иван Иванович, заезд 2027-01-02, 50 000 ₽"), "[скрыто], заезд 2027-01-02, 50 000 ₽");
});
