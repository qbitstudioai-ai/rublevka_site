import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-admin/shell";
import { requireSiteUser } from "@/server/cms/auth";
import { readSettings } from "@/server/assistant/settings";
import { updateAssistant } from "./actions";

export default async function AssistantSettings({ searchParams }: {
  searchParams: Promise<{ saved?: string; invalid?: string }>;
}) {
  const user = await requireSiteUser();
  if (user.role !== "admin") notFound();
  const [settings, query] = await Promise.all([readSettings(), searchParams]);
  return (
    <SiteShell active="assistant">
      <div className="sa-heading"><h1>Ассистент</h1></div>
      <form action={updateAssistant} className="sa-panel sa-stack">
        {query.saved && <p role="status">Настройки сохранены.</p>}
        {query.invalid && <p role="alert">Проверьте длину полей и формат телефона.</p>}
        <label className="sa-check"><input name="enabled" type="checkbox" defaultChecked={settings.enabled} /> Включить чат</label>
        <label className="sa-field">Приветствие
          <textarea name="greeting" maxLength={1800} defaultValue={settings.greeting ?? ""} placeholder="Стандартное приветствие сайта" />
        </label>
        <label className="sa-field">Сообщение при недоступности
          <input name="unavailable" required maxLength={300} defaultValue={settings.unavailable} />
        </label>
        <label className="sa-field">Телефон администратора
          <input name="phone" type="tel" maxLength={24} defaultValue={settings.phone ?? ""} placeholder="Телефон из контактов сайта" />
        </label>
        <div><button className="sa-button" type="submit">Сохранить</button></div>
      </form>
    </SiteShell>
  );
}
