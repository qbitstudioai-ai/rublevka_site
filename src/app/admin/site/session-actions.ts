"use server";

import { redirect } from "next/navigation";
import { sameOrigin } from "@/server/admin/session";
import {
  siteAuthConfigured,
  siteSessionCookie,
  validSiteSessionId,
} from "@/server/cms/auth";
import { endSiteLogin, startSiteLogin } from "@/server/cms/staff";

export type SignInState = { error?: string };

export async function signInSite(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  if (!(await sameOrigin()))
    return { error: "Откройте форму входа на этом сайте." };
  if (!siteAuthConfigured())
    return { error: "Вход в панель пока не настроен." };
  const login = form.get("login");
  const password = form.get("password");
  const invalid = {
    error: "Не удалось войти. Проверьте данные или повторите попытку позже.",
  };
  if (typeof login !== "string" || typeof password !== "string") return invalid;

  try {
    const id = await startSiteLogin(login, password);
    if (!id) return invalid;
    const session = await siteSessionCookie();
    const previous = session.id;
    session.id = id;
    await session.save();
    if (validSiteSessionId(previous)) await endSiteLogin(previous);
  } catch {
    return { error: "Вход временно недоступен." };
  }
  redirect("/admin/site");
}

export async function signOutSite(): Promise<void> {
  if (!(await sameOrigin())) return;
  if (siteAuthConfigured()) {
    const session = await siteSessionCookie();
    if (validSiteSessionId(session.id)) await endSiteLogin(session.id);
    session.destroy();
  }
  redirect("/admin/site/login");
}
