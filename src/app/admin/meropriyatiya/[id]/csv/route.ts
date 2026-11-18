import { eq } from "drizzle-orm";
import { currentAdmin, sameOrigin } from "@/server/admin/session";
import { csvCell, uuidPattern } from "@/server/admin/input";
import { participants } from "@/server/admin/participants";
import { db } from "@/server/events/db";
import { events, auditLogs } from "@/server/events/schema";
import { guestStates, payStates } from "../../labels";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sameOrigin()))
    return new Response(null, { status: 403, headers });
  const user = await currentAdmin();
  if (!user || user.role !== "admin")
    return new Response(null, { status: 403, headers });
  const { id } = await params;
  if (!uuidPattern.test(id))
    return new Response(null, { status: 404, headers });
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, id));
  if (!event) return new Response(null, { status: 404, headers });
  const rows = await participants(id, "", 0, 2147483647);
  const csv = [
    [
      "Номер",
      "ФИО",
      "Телефон",
      "Мессенджер",
      "Активности",
      "Стоимость, коп.",
      "Также по запросу",
      "Статус участия",
      "Статус оплаты",
    ],
    ...rows.map((r) => [
      r.id,
      r.name,
      r.phone,
      r.messenger,
      r.activities.join(", "),
      r.total,
      r.hasQuote ? "да" : "нет",
      guestStates[r.status],
      payStates[r.paymentStatus],
    ]),
  ]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
  await db
    .insert(auditLogs)
    .values({ adminId: user.id, action: "registrations.export", targetId: id });
  return new Response("\uFEFF" + csv, {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="participants-' + id + '.csv"',
    },
  });
}
