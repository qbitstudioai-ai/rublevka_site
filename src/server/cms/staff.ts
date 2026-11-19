import { compare, hash } from "bcryptjs";
import { createHash } from "node:crypto";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "../events/db";
import {
  acceptsSitePassword,
  normalizeSiteLogin,
  siteRoleAllows,
  type SiteRole,
} from "./access";
import {
  cmsSiteLoginLimits,
  cmsSiteSessions,
  cmsSiteStaff,
  cmsSiteStaffAudit,
} from "./auth-schema";

export const siteSessionTTL = 8 * 60 * 60;

export class SiteAccessError extends Error {}

export type SiteUser = { id: string; login: string; role: SiteRole };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Avoid timing-based disclosure of whether an account exists.
const dummyHash =
  "$2b$12$qi7twKqTo8zQr9faBt.t3ONMTe8QCaRvmV8WihTK/Xagcx/GHjBpe";
const loginWindowSeconds = 15 * 60;
const loginLimit = 8;

async function takeLoginAttempt(login: string) {
  const key = createHash("sha256").update(login).digest("hex");
  const nextExpiry = sql`now() + ${loginWindowSeconds} * interval '1 second'`;
  const [bucket] = await db
    .insert(cmsSiteLoginLimits)
    .values({ key, count: 1, expiresAt: nextExpiry })
    .onConflictDoUpdate({
      target: cmsSiteLoginLimits.key,
      set: {
        count: sql`case when ${cmsSiteLoginLimits.expiresAt} <= now() then 1 else ${cmsSiteLoginLimits.count} + 1 end`,
        expiresAt: sql`case when ${cmsSiteLoginLimits.expiresAt} <= now() then ${nextExpiry} else ${cmsSiteLoginLimits.expiresAt} end`,
      },
      setWhere: sql`${cmsSiteLoginLimits.expiresAt} <= now() or ${cmsSiteLoginLimits.count} < ${loginLimit}`,
    })
    .returning({ key: cmsSiteLoginLimits.key });
  return bucket?.key;
}

export async function startSiteLogin(rawLogin: string, password: string) {
  const login = normalizeSiteLogin(rawLogin);
  if (!login || !acceptsSitePassword(password)) return null;
  const bucketKey = await takeLoginAttempt(login);
  if (!bucketKey) return null;

  const [staff] = await db
    .select()
    .from(cmsSiteStaff)
    .where(eq(cmsSiteStaff.login, login));
  const matches = await compare(password, staff?.passwordHash ?? dummyHash);
  if (!matches || !staff?.active) return null;
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(cmsSiteStaff)
      .where(eq(cmsSiteStaff.id, staff.id))
      .for("update");
    if (!locked?.active || locked.passwordHash !== staff.passwordHash)
      return null;
    await tx
      .delete(cmsSiteSessions)
      .where(
        and(
          eq(cmsSiteSessions.staffId, staff.id),
          lte(cmsSiteSessions.expiresAt, new Date()),
        ),
      );
    const [session] = await tx
      .insert(cmsSiteSessions)
      .values({
        staffId: staff.id,
        expiresAt: new Date(Date.now() + siteSessionTTL * 1000),
      })
      .returning({ id: cmsSiteSessions.id });
    await tx
      .insert(cmsSiteStaffAudit)
      .values({
        actorId: staff.id,
        targetId: staff.id,
        action: "session.sign_in",
      });
    await tx
      .delete(cmsSiteLoginLimits)
      .where(eq(cmsSiteLoginLimits.key, bucketKey));
    return session.id;
  });
}

export async function findSiteUser(sessionId: string) {
  const [staff] = await db
    .select({
      id: cmsSiteStaff.id,
      login: cmsSiteStaff.login,
      role: cmsSiteStaff.role,
    })
    .from(cmsSiteSessions)
    .innerJoin(cmsSiteStaff, eq(cmsSiteStaff.id, cmsSiteSessions.staffId))
    .where(
      and(
        eq(cmsSiteSessions.id, sessionId),
        eq(cmsSiteStaff.active, true),
        gt(cmsSiteSessions.expiresAt, new Date()),
      ),
    );
  return staff ?? null;
}

export async function endSiteLogin(sessionId: string) {
  await db.transaction(async (tx) => {
    const [session] = await tx
      .delete(cmsSiteSessions)
      .where(eq(cmsSiteSessions.id, sessionId))
      .returning({ staffId: cmsSiteSessions.staffId });
    if (session)
      await tx.insert(cmsSiteStaffAudit).values({
        actorId: session.staffId,
        targetId: session.staffId,
        action: "session.sign_out",
      });
  });
}

async function requireCurrentAdmin(tx: Transaction, actorId: string) {
  const [actor] = await tx
    .select()
    .from(cmsSiteStaff)
    .where(eq(cmsSiteStaff.id, actorId))
    .for("update");
  if (!actor?.active || !siteRoleAllows(actor.role, true))
    throw new SiteAccessError("Доступно только администратору сайта.");
}

export async function provisionSiteStaff(
  actorId: string | null,
  rawLogin: string,
  password: string,
  role: SiteRole,
) {
  const login = normalizeSiteLogin(rawLogin);
  if (!login)
    throw new SiteAccessError(
      "Укажите логин из 2–64 латинских букв, цифр, точек, дефисов или подчёркиваний.",
    );
  if (!acceptsSitePassword(password))
    throw new SiteAccessError(
      "Пароль должен содержать от 14 символов до 72 байт.",
    );
  if (!siteRoleAllows(role, false) || (!actorId && role !== "admin"))
    throw new SiteAccessError("Выберите действительную роль.");
  const passwordHash = await hash(password, 12);
  return db.transaction(async (tx) => {
    if (actorId) await requireCurrentAdmin(tx, actorId);
    const [staff] = await tx
      .insert(cmsSiteStaff)
      .values({ login, passwordHash, role })
      .onConflictDoNothing()
      .returning({ id: cmsSiteStaff.id });
    if (!staff) throw new SiteAccessError("Такой логин уже используется.");
    await tx.insert(cmsSiteStaffAudit).values({
      actorId: actorId ?? staff.id,
      targetId: staff.id,
      action: actorId ? "staff.create" : "staff.bootstrap",
    });
    return staff.id;
  });
}

export async function updateSiteStaff(
  actorId: string,
  staffId: string,
  changes: { role: SiteRole; active: boolean; password?: string },
) {
  if (!siteRoleAllows(changes.role, false))
    throw new SiteAccessError("Выберите действительную роль.");
  if (changes.password && !acceptsSitePassword(changes.password))
    throw new SiteAccessError(
      "Пароль должен содержать от 14 символов до 72 байт.",
    );
  const passwordHash = changes.password
    ? await hash(changes.password, 12)
    : undefined;
  await db.transaction(async (tx) => {
    // Serialize staff edits so two admins cannot simultaneously demote or disable one another.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('rublevka.cms.staff.management'))`,
    );
    await requireCurrentAdmin(tx, actorId);
    const [staff] = await tx
      .select()
      .from(cmsSiteStaff)
      .where(eq(cmsSiteStaff.id, staffId))
      .for("update");
    if (!staff) throw new SiteAccessError("Учётная запись не найдена.");
    if (actorId === staffId && (changes.role !== staff.role || !changes.active))
      throw new SiteAccessError(
        "Изменение собственной роли и доступа выполняет другой администратор.",
      );
    if (
      staff.role === changes.role &&
      staff.active === changes.active &&
      !passwordHash
    )
      return;
    await tx
      .update(cmsSiteStaff)
      .set({
        role: changes.role,
        active: changes.active,
        ...(passwordHash ? { passwordHash } : {}),
      })
      .where(eq(cmsSiteStaff.id, staffId));
    await tx
      .delete(cmsSiteSessions)
      .where(eq(cmsSiteSessions.staffId, staffId));
    await tx.insert(cmsSiteStaffAudit).values({
      actorId,
      targetId: staffId,
      action: passwordHash ? "staff.update_password" : "staff.update_access",
    });
  });
}

export function listSiteStaff() {
  return db
    .select({
      id: cmsSiteStaff.id,
      login: cmsSiteStaff.login,
      role: cmsSiteStaff.role,
      active: cmsSiteStaff.active,
    })
    .from(cmsSiteStaff)
    .orderBy(asc(cmsSiteStaff.login));
}
