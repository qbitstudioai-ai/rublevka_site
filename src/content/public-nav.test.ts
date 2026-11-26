import assert from "node:assert/strict";
import test from "node:test";

import { bookingHref, publicNavigation } from "./public-nav";

test("public navigation keeps the approved guest journey order", () => {
  assert.deepEqual(
    publicNavigation.map(({ label, href }) => [label, href]),
    [
      ["Проживание", "/prozhivanie"],
      ["Беседки", "/besedki"],
      ["Банкетные залы", "/banketnye-zaly"],
      ["Баня", "/banya"],
      ["Услуги", "/uslugi"],
      ["Мероприятия", "/meropriyatiya"],
      ["Карта комплекса", "/karta"],
      ["Галерея", "/galereya"],
      ["Контакты", "/kontakty"],
    ],
  );
  assert.equal(bookingHref, "/bronirovanie");
});
