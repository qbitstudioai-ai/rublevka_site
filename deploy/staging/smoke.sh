#!/usr/bin/env bash
set -euo pipefail

config=/opt/rublevka-staging-config
export RUBLEVKA_RELEASE=${RUBLEVKA_RELEASE:-$(cat /opt/rublevka-staging/current-commit)}
docker compose -f "$config/compose.yml" exec -T site node --input-type=module - <<'JS'
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:3000";
const key = { Authorization: "Bearer " + process.env.ASSISTANT_KNOWLEDGE_KEY };
const browser = {
  Cookie: "rublevka_cookie_preference_v2=declined",
};
for (const path of ["/", "/prozhivanie", "/banya", "/besedki", "/banketnye-zaly", "/uslugi",
  "/galereya", "/karta", "/kontakty", "/bronirovanie", "/admin/site/login", "/meropriyatiya",
  "/meropriyatiya/admin/login", "/meropriyatiya/art/assistant.webp", "/meropriyatiya/api/health"]) {
  const response = await fetch(origin + path, { headers: browser, redirect: "manual", signal: AbortSignal.timeout(12000) });
  assert.equal(response.status, 200, path);
  if (path === "/" || path === "/meropriyatiya") assert.match(await response.text(), /name="robots" content="noindex/i, path);
  else if (response.body) await response.body.cancel();
}
const knowledge = await fetch(origin + "/api/assistant/v1/complex", { headers: key });
assert.equal(knowledge.status, 200);
assert.equal((await knowledge.json()).source, "cms/published");
const events = await fetch(origin + "/api/assistant/v1/events", { headers: key });
assert.equal(events.status, 200);
const catalog = await events.json();
assert.equal(catalog.source, "events-original/sqlite");
if (catalog.data.items.length) {
  const next = new URL(catalog.data.items[0].url);
  assert.equal(next.origin, process.env.SITE_URL);
  const detail = await fetch(origin + next.pathname, { headers: browser, redirect: "manual" });
  assert.equal(detail.status, 200);
  if (detail.body) await detail.body.cancel();
}
const denied = await fetch(origin + "/api/assistant/v1/complex");
assert.equal(denied.status, 401);
const internal = await fetch(origin + "/meropriyatiya/api/internal/assistant/events");
assert.equal(internal.status, 404);
assert.equal(process.env.ASSISTANT_CHAT_ENABLED, "false");
console.log("Staging routes, CMS, event adapter, access boundaries and noindex verified");
JS
