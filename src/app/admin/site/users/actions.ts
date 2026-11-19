"use server";

import { revalidatePath } from "next/cache";
import {
  requireSiteMutation,
  SiteAccessError,
  validSiteSessionId,
} from "@/server/cms/auth";
import { provisionSiteStaff, updateSiteStaff } from "@/server/cms/staff";

type StaffState = { error?: string; message?: string };

export async function saveStaff(
  _previous: StaffState,
  form: FormData,
): Promise<StaffState> {
  try {
    const actor = await requireSiteMutation(true);
    const role = form.get("role");
    if (role !== "admin" && role !== "editor")
      return { error: "Выберите роль." };
    const id = form.get("id");
    const password = form.get("password");
    if (typeof password !== "string") return { error: "Введите пароль." };

    if (id === null) {
      const login = form.get("login");
      if (typeof login !== "string") return { error: "Введите логин." };
      await provisionSiteStaff(actor.id, login, password, role);
    } else {
      if (typeof id !== "string" || !validSiteSessionId(id))
        return { error: "Сотрудник не найден." };
      await updateSiteStaff(actor.id, id, {
        role,
        active: form.get("active") === "on",
        password,
      });
    }

    revalidatePath("/admin/site/users");
    return {
      message:
        id === null
          ? "Доступ сотрудника создан."
          : "Доступ сотрудника обновлён.",
    };
  } catch (error) {
    return {
      error:
        error instanceof SiteAccessError
          ? error.message
          : "Не удалось сохранить доступ.",
    };
  }
}
