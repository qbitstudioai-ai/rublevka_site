import test from "node:test";
import assert from "node:assert/strict";
import { localRegistrationAllowed } from "../server/events/isolation";

test("test registration requires a loopback site, an isolated PostgreSQL database and explicit opt-in", () => {
  const db = "postgresql://guest@localhost:5454/rublevka_events_test";
  assert.equal(
    localRegistrationAllowed(
      "test",
      db,
      "localhost:3000",
      "http://localhost:3000",
    ),
    true,
  );
  for (const args of [
    ["off", db, "localhost:3000", "http://localhost:3000"],
    [
      "test",
      db.replace("localhost", "remote.example"),
      "localhost",
      "http://localhost",
    ],
    ["test", db.replace("_test", ""), "localhost", "http://localhost"],
    ["test", db, "public.example", "https://public.example"],
    ["test", db, "localhost:3000", "https://some.example"],
    ["test", db + "?host=remote.example", "localhost", "http://localhost"],
  ])
    assert.equal(
      localRegistrationAllowed(args[0], args[1], args[2], args[3]),
      false,
    );
});
