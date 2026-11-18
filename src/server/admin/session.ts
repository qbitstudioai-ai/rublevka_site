import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../events/db";
import { adminSessions, adminUsers } from "../events/schema";

export const sessionTTL = 8 * 3600;

export async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      ["https:", "http:"].includes(url.protocol) && url.host === h.get("host")
    );
  } catch {
    return false;
  }
}

export async function sessionCookie() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password || password.length < 32)
    throw new Error("Настройте ADMIN_SESSION_SECRET.");
  return getIronSession<{ id?: string }>(await cookies(), {
    password,
    cookieName: "rublevka_admin",
    ttl: sessionTTL,
    cookieOptions: {
      path: "/admin",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
  });
}

export async function currentAdmin() {
  if (!(await cookies()).has("rublevka_admin")) return null;
  const { id } = await sessionCookie();
  if (!id) return null;
  const [user] = await db
    .select({
      id: adminUsers.id,
      role: adminUsers.role,
      login: adminUsers.login,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminId))
    .where(
      and(
        eq(adminSessions.id, id),
        gt(adminSessions.expiresAt, new Date()),
        eq(adminUsers.active, true),
      ),
    );
  return user ?? null;
}

export async function requireAdmin() {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  return user;
}
