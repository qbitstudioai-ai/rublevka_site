import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Importing a route during the Next build must not establish a connection.
const globalPool = globalThis as typeof globalThis & {
  rublevkaEventPool?: Pool;
};
function createPool() {
  const connections = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://localhost:1/unconfigured",
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  // Idle PostgreSQL connections emit errors separately from an individual query.
  connections.on("error", () => console.error("Потеряно соединение с базой мероприятий."));
  return connections;
}
export const pool = globalPool.rublevkaEventPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalPool.rublevkaEventPool = pool;
export const db = drizzle(pool);
