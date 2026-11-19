import { isAdmin } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { participantsFileName, participantsXlsx, XLSX_MIME } from "@/lib/server/excel";
import { getEventById } from "@/lib/server/repo/events";
import { listRegistrations } from "@/lib/server/repo/registrations";
import { idSchema } from "@/lib/server/validation";

/**
 * Скачивание Excel со всеми регистрациями мероприятия.
 * Route handler не защищён layout админки, поэтому сессия проверяется здесь.
 * Файл формируется в памяти и на сервере не сохраняется.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.redirect(new URL("/meropriyatiya/admin/login", request.url), 303);

  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) return new Response("Not found", { status: 404 });
  const db = getDb();
  const event = getEventById(db, parsedId.data);
  if (!event) return new Response("Not found", { status: 404 });

  // Полный список: поиск в админке на выгрузку не влияет.
  const buffer = await participantsXlsx(listRegistrations(db, event.id), event.title);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${participantsFileName(event)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
