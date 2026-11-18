import assert from "node:assert/strict";
import test from "node:test";
import { dayPlan, displayPrice, stayLink } from "./presentation";

test("overnight stays use the two Volgograd calendar dates", () => {
  assert.equal(
    stayLink(new Date("2027-12-31T20:00Z"), new Date("2027-12-31T22:00Z")),
    "/bronirovanie?arrival=2027-12-31&departure=2028-01-01",
  );
  assert.equal(
    stayLink(new Date("2027-12-31T22:00Z"), new Date("2027-12-31T23:00Z")),
    "/bronirovanie?arrival=2028-01-01&departure=2028-01-02",
  );
});

test("a quoted activity does not inflate the known total; unscheduled items follow timed activities", () => {
  const result = dayPlan(
    {
      title: "Открытие",
      startsAt: new Date("2027-12-01T15:00Z"),
      price: 120050,
    },
    [
      { id: "later", title: "По договорённости", startsAt: null, price: null },
      {
        id: "early",
        title: "Встреча",
        startsAt: new Date("2027-12-01T14:55Z"),
        price: 20000,
      },
    ],
  );
  assert.equal(result.total, 140050);
  assert.equal(result.hasQuote, true);
  assert.deepEqual(
    result.entries.map((entry) => entry.title),
    ["Встреча", "Открытие", "По договорённости"],
  );
  assert.equal(displayPrice(null), "По запросу");
  assert.equal(displayPrice(0), "Бесплатно");
});
