import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, readAdminConfig, SESSION_TTL_SECONDS, verifySessionToken } from "./session";

export const SESSION_COOKIE = "rublevka_events_admin";

/** Secure — в production; ADMIN_COOKIE_SECURE=false только для временной работы без HTTPS. */
const secureCookie = () => process.env.NODE_ENV === "production" && process.env.ADMIN_COOKIE_SECURE !== "false";

export async function isAdmin(): Promise<boolean> {
  // cookies() читается первым: это делает страницы админки динамическими,
  // и результат проверки никогда не попадает в статическую сборку.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const { config } = readAdminConfig();
  if (!config) return false;
  return verifySessionToken(token, config.secret);
}

/** Обязательная проверка в каждой странице и каждом server action админпанели. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function startAdminSession() {
  const { config } = readAdminConfig();
  if (!config) throw new Error("Админпанель не настроена.");
  (await cookies()).set(SESSION_COOKIE, createSessionToken(config.secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/meropriyatiya",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endAdminSession() {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secureCookie(), path: "/meropriyatiya", maxAge: 0 });
}
