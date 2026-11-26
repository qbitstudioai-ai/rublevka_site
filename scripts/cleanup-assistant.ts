import { cleanupExpired } from "../src/server/assistant/chat-store";
import { pool } from "../src/server/events/db";

async function main() {
  try { await cleanupExpired(); }
  finally { await pool.end(); }
}

main().catch(() => {
  console.error("Assistant cleanup failed");
  process.exitCode = 1;
});
