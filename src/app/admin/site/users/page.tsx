import { notFound } from "next/navigation";
import { requireSiteUser } from "@/server/cms/auth";
import { listSiteStaff } from "@/server/cms/staff";
import { SiteShell } from "@/components/site-admin/shell";
import { StaffForm } from "./form";

export const metadata = { title: "Сотрудники сайта" };

export default async function StaffPage() {
  const current = await requireSiteUser();
  if (current.role !== "admin") notFound();
  const staff = await listSiteStaff();

  return (
    <SiteShell active="users">
      <h1>Сотрудники сайта</h1>
      <section className="sa-panel" aria-labelledby="staff-create">
        <h2 id="staff-create">Добавить сотрудника</h2>
        <p>
          Редакторы готовят черновики. Администраторы публикуют изменения и
          управляют доступом.
        </p>
        <StaffForm currentId={current.id} />
      </section>
      <section className="sa-panel" aria-labelledby="staff-list">
        <h2 id="staff-list">Учётные записи</h2>
        {staff.map((account) => (
          <details key={account.id} className="sa-item">
            <summary>
              {account.login} ·{" "}
              {account.role === "admin" ? "администратор" : "редактор"}
              {!account.active && " · доступ отключён"}
            </summary>
            <StaffForm
              key={account.role + String(account.active)}
              staff={account}
              currentId={current.id}
            />
          </details>
        ))}
      </section>
    </SiteShell>
  );
}
