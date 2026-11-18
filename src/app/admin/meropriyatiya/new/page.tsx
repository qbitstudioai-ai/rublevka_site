import Link from "next/link";
import { requireAdmin } from "@/server/admin/session";
import { EventEditor } from "../editors";
export default async function NewEvent() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/meropriyatiya">← Все мероприятия</Link>
      <h1>Новое мероприятие</h1>
      <EventEditor />
    </>
  );
}
