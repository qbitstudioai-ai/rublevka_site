import { redirect } from "next/navigation";
import { currentSiteUser, siteAuthConfigured } from "@/server/cms/auth";
import { LoginForm } from "./form";

export const metadata = { title: "Вход в панель сайта" };

export default async function LoginPage() {
  if (await currentSiteUser()) redirect("/admin/site");
  return (
    <div className="site-admin site-admin-login">
      <main className="sa-panel">
        <h1>Вход в панель сайта</h1>
        {siteAuthConfigured() ? (
          <LoginForm />
        ) : (
          <p>Вход пока не настроен. Обратитесь к администратору сайта.</p>
        )}
      </main>
    </div>
  );
}
