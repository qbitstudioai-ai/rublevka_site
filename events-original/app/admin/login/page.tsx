import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { BRAND_LOGO } from "@/lib/brand";
import { isAdmin } from "@/lib/server/admin-auth";
import { readAdminConfig } from "@/lib/server/session";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const { problem } = readAdminConfig();

  return (
    <main className="a-login">
      <div className="a-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="a-login-logo" src={BRAND_LOGO.src} alt={BRAND_LOGO.alt} />
        <h1>Вход в админпанель</h1>
        <p className="a-hint">Управление мероприятиями и регистрациями «Рублёвки».</p>
        {problem ? (
          <p className="a-message is-error" role="alert">
            Админпанель не настроена. {problem} Укажите значения в файле .env.local и перезапустите приложение.
          </p>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}
