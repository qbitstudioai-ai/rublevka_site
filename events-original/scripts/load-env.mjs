// Загружает .env.local и .env, если они есть. Уже заданные переменные окружения не перезаписываются.
import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
