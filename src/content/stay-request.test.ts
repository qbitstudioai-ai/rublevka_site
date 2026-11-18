import test from "node:test";
import assert from "node:assert/strict";
import {
  readStay,
  localDay,
  nights,
  nextDay,
  stayParams,
  validate,
  requestText,
} from "./stay-request";
const stay = readStay(
  new URLSearchParams("arrival=2028-02-28&departure=2028-03-01&room=family"),
);
test("Volgograd calendar crosses midnight before UTC", () =>
  assert.equal(localDay(new Date("2028-02-28T21:01:00Z")), "2028-02-29"));
test("Leap nights, calendar rollover and shareable request", () => {
  assert.equal(nights(stay), 2);
  assert.equal(nextDay("2028-12-31"), "2029-01-01");
  assert.deepEqual(readStay(stayParams(stay)), stay);
  assert.match(requestText(stay), /Семейный дом/);
  assert.deepEqual(validate(stay, stay.arrival), {});
});
test("Reject invalid calendar dates, order, past dates, counts and category", () => {
  for (const arrival of ["2028-02-30", "2027-12-31", ""])
    assert.ok(validate({ ...stay, arrival }, "2028-01-01").arrival);
  for (const departure of [stay.arrival, "2028-02-27", ""])
    assert.ok(validate({ ...stay, departure }, stay.arrival).departure);
  for (const values of [
    { adults: "0" },
    { children: "-1" },
    { children: "1.5" },
    { room: "constructor" },
  ])
    assert.ok(
      Object.keys(validate({ ...stay, ...values }, stay.arrival)).length,
    );
});
