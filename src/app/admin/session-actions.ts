"use server";
import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/server/events/db";
import { adminUsers, adminSessions, auditLogs } from "@/server/events/schema";
import {
  sameOrigin,
  sessionCookie,
  sessionTTL,
  currentAdmin,
} from "@/server/admin/session";
import { takeRateLimit } from "@/server/admin/limits";
import type { FormState } from "./form";

export async function login(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  if (!(await sameOrigin()))
    return { message: "Откройте форму входа на этом сайте." };
  const username = String(form.get("login") ?? "")
      .trim()
      .toLowerCase(),
    password = String(form.get("password") ?? "");
  const denied = {
    message: "Вход не выполнен. Проверьте данные или попробуйте позже.",
  };
  if (
    !/^[a-z0-9_.-]{2,64}$/.test(username) ||
    !password ||
    Buffer.byteLength(password) > 72
  )
    return denied;
  try {
    const digest = createHash("sha256").update(username).digest("hex");
    if (!(await takeRateLimit("login-" + digest, 8, 900))) return denied;
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.login, username));
    const match = await compare(
      password,
      user?.passwordHash ??
        "$2b$12$qi7twKqTo8zQr9faBt.t3ONMTe8QCaRvmV8WihTK/Xagcx/GHjBpe",
    );
    if (!match || !user?.active) return denied;
    const cookie = await sessionCookie();
    const session = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(adminSessions)
        .values({
          adminId: user.id,
          expiresAt: new Date(Date.now() + sessionTTL * 1000),
        })
        .returning({ id: adminSessions.id });
      await tx
        .insert(auditLogs)
        .values({
          adminId: user.id,
          action: "session.login",
          targetId: user.id,
        });
      return row;
    });
    cookie.id = session.id;
    await cookie.save();
  } catch {
    return {
      message: "Вход временно недоступен. Обратитесь к администратору.",
    };
  }
  redirect("/admin/meropriyatiya");
}
export async function logout() {
  if (!(await sameOrigin())) return;
  const user = await currentAdmin(),
    cookie = await sessionCookie();
  if (cookie.id) {
    await db.transaction(async (tx) => {
      await tx.delete(adminSessions).where(eq(adminSessions.id, cookie.id!));
      if (user)
        await tx
          .insert(auditLogs)
          .values({
            adminId: user.id,
            action: "session.logout",
            targetId: user.id,
          });
    });
  }
  cookie.destroy();
  redirect("/admin/login");
}
