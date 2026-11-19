import assert from "node:assert/strict";
import test from "node:test";
import { servicePrice } from "./service-price";

test("formats the three legacy service price modes with their optional notes", () => {
  assert.equal(servicePrice(null), "По согласованию");
  assert.equal(
    servicePrice(null, "Уточните у администратора"),
    "По согласованию · Уточните у администратора",
  );
  assert.equal(
    servicePrice(0, "при регистрации"),
    "Бесплатно · при регистрации",
  );
  assert.match(
    servicePrice(100050, "за компанию"),
    /^1\s000,5\s₽ за компанию$/u,
  );
});
