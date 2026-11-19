import { connection } from "next/server";
import { resolveDatabasePath } from "@/db/migrator.mjs";
import { checkHealth } from "@/lib/server/health.mjs";
import { uploadsDir } from "@/lib/server/paths";

/** Состояние приложения для мониторинга и Docker healthcheck. Без секретов и путей. */
export async function GET() {
  await connection();
  const result = checkHealth({ databasePath: resolveDatabasePath(), uploadsDir: uploadsDir() });
  return Response.json(
    { ...result, time: new Date().toISOString() },
    { status: result.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
