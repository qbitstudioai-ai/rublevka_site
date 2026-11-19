import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { sameOrigin } from "../admin/session";
import { siteRoleAllows } from "./access";
import { findSiteUser, siteSessionTTL, SiteAccessError } from "./staff";

export { SiteAccessError };

const cookieName = "rublevka_site_staff";
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function siteAuthConfigured() {
  return (
    (process.env.SITE_ADMIN_SESSION_SECRET?.trim().length ?? 0) >= 32 &&
    Boolean(process.env.DATABASE_URL)
  );
}

export async function siteSessionCookie() {
  if (!siteAuthConfigured())
    throw new SiteAccessError("Вход в панель сайта не настроен.");
  return getIronSession<{ id?: string }>(await cookies(), {
    cookieName,
    password: process.env.SITE_ADMIN_SESSION_SECRET!.trim(),
    ttl: siteSessionTTL,
    cookieOptions: {
      path: "/admin/site",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export function validSiteSessionId(value: string | undefined): value is string {
  return typeof value === "string" && uuid.test(value);
}

export async function currentSiteUser() {
  const cookieStore = await cookies();
  if (!siteAuthConfigured() || !cookieStore.has(cookieName)) return null;
  const { id } = await siteSessionCookie();
  return validSiteSessionId(id) ? findSiteUser(id) : null;
}

export async function requireSiteUser() {
  const user = await currentSiteUser();
  if (!user) redirect("/admin/site/login");
  return user;
}

export async function requireSiteMutation(adminOnly = false) {
  if (!(await sameOrigin()))
    throw new SiteAccessError("Запрос должен выполняться из панели сайта.");
  const user = await currentSiteUser();
  if (!user || !siteRoleAllows(user.role, adminOnly))
    throw new SiteAccessError("Доступ запрещён.");
  return user;
}
