import { seedSiteContent } from "../src/server/cms/store";
import { pool } from "../src/server/events/db";

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Укажите DATABASE_URL для импорта контента.");
  const count = await seedSiteContent();
  console.info(`Создано документов CMS: ${count}.`);
}

main()
  .catch(() => {
    console.error(
      "Не удалось импортировать контент CMS. Проверьте подключение и миграции PostgreSQL.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
