import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../events/db";
import {
  cmsSiteSessions,
  cmsSiteStaff,
  cmsSiteStaffAudit,
} from "./auth-schema";
import {
  endSiteLogin,
  findSiteUser,
  provisionSiteStaff,
  startSiteLogin,
  updateSiteStaff,
} from "./staff";

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(
    url.hostname === "127.0.0.1" && url.pathname === "/rublevka_events_test",
    "Use the isolated local test database.",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
});
after(() => pool.end());

const password = randomBytes(24).toString("hex");

test("the first administrator signs in with a hashed password and signs out through a revoked session", async () => {
  const login = randomUUID();
  const id = await provisionSiteStaff(null, login, password, "admin");
  const [record] = await db
    .select()
    .from(cmsSiteStaff)
    .where(eq(cmsSiteStaff.id, id));
  assert.notEqual(record.passwordHash, password);
  assert.equal(await startSiteLogin(login, password + "x"), null);
  const session = await startSiteLogin(login, password);
  assert.ok(session);
  assert.deepEqual(await findSiteUser(session), { id, login, role: "admin" });
  await endSiteLogin(session);
  assert.equal(await findSiteUser(session), null);
  const actions = await db
    .select({ action: cmsSiteStaffAudit.action })
    .from(cmsSiteStaffAudit)
    .where(eq(cmsSiteStaffAudit.actorId, id));
  assert.deepEqual(
    new Set(actions.map((row) => row.action)),
    new Set(["staff.bootstrap", "session.sign_in", "session.sign_out"]),
  );
});

test("an editor cannot create staff and staff changes revoke live sessions", async () => {
  const adminId = await provisionSiteStaff(
    null,
    randomUUID(),
    password,
    "admin",
  );
  const login = randomUUID();
  const editorId = await provisionSiteStaff(adminId, login, password, "editor");
  const editorSession = await startSiteLogin(login, password);
  assert.ok(editorSession);
  assert.equal((await findSiteUser(editorSession))?.role, "editor");
  await assert.rejects(
    provisionSiteStaff(editorId, randomUUID(), password, "admin"),
  );
  await assert.rejects(
    updateSiteStaff(editorId, editorId, { role: "admin", active: true }),
  );
  await assert.rejects(
    updateSiteStaff(adminId, adminId, { role: "editor", active: true }),
  );
  await updateSiteStaff(adminId, editorId, { role: "editor", active: false });
  assert.equal(await findSiteUser(editorSession), null);
  assert.equal(await startSiteLogin(login, password), null);
});

test("login throttling is per account and expired sessions grant no access", async () => {
  const limited = randomUUID();
  const unaffected = randomUUID();
  await provisionSiteStaff(null, limited, password, "admin");
  await provisionSiteStaff(null, unaffected, password, "admin");
  for (let attempt = 0; attempt < 8; attempt++) {
    assert.equal(await startSiteLogin(limited, password + "x"), null);
  }
  assert.equal(await startSiteLogin(limited, password), null);
  const session = await startSiteLogin(unaffected, password);
  assert.ok(session);
  await db
    .update(cmsSiteSessions)
    .set({ expiresAt: new Date(0) })
    .where(eq(cmsSiteSessions.id, session));
  assert.equal(await findSiteUser(session), null);
});
