import { redirect } from "next/navigation";
import { currentAdmin } from "@/server/admin/session";
import { ActionForm } from "../form";
import { login } from "../session-actions";
export default async function Login() {
  if (await currentAdmin()) redirect("/admin/meropriyatiya");
  return (
    <section className="office-login">
      <h1>Вход для сотрудников</h1>
      <ActionForm action={login} submit="Войти">
        <label>
          Логин
          <input autoComplete="username" name="login" required maxLength={64} />
        </label>
        <label>
          Пароль
          <input
            autoComplete="current-password"
            type="password"
            name="password"
            required
            maxLength={72}
          />
        </label>
      </ActionForm>
    </section>
  );
}
