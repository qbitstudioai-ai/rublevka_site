import { emitKeypressEvents } from "node:readline";
import { stdin, stderr } from "node:process";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/events/db";
import { normalizeSiteLogin } from "../src/server/cms/access";
import { cmsSiteStaff } from "../src/server/cms/auth-schema";
import {
  provisionSiteStaff,
  SiteAccessError,
  updateSiteStaff,
} from "../src/server/cms/staff";

async function readPassword(): Promise<string> {
  stdin.setEncoding("utf8");
  if (!stdin.isTTY) {
    let input = "";
    for await (const chunk of stdin) {
      input += chunk;
      if (Buffer.byteLength(input) > 74)
        throw new SiteAccessError("Слишком длинный пароль.");
    }
    return input.replace(/\r?\n$/, "");
  }

  stderr.write("Пароль администратора сайта (ввод скрыт): ");
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  try {
    return await new Promise<string>((resolve, reject) => {
      let input = "";
      const keypress = (
        char: string,
        key: { name: string; ctrl?: boolean },
      ) => {
        if (key.name === "return" || key.name === "enter") {
          stdin.off("keypress", keypress);
          resolve(input);
        } else if (key.ctrl && key.name === "c") {
          stdin.off("keypress", keypress);
          reject(new SiteAccessError("Создание учётной записи отменено."));
        } else if (key.name === "backspace") {
          input = Array.from(input).slice(0, -1).join("");
        } else if (!key.ctrl && char && !/[\u0000-\u001f\u007f]/.test(char)) {
          input += char;
        }
      };
      stdin.on("keypress", keypress);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
    stderr.write("\n");
  }
}

async function main() {
  const [argument, ...extra] = process.argv.slice(2);
  const fromEnv = argument === "--from-env";
  const login = fromEnv
    ? normalizeSiteLogin(process.env.SITE_ADMIN_USERNAME ?? "")
    : argument;
  if (!login || !normalizeSiteLogin(login) || extra.length)
    throw new SiteAccessError(
      "Укажите логин или задайте SITE_ADMIN_USERNAME и используйте --from-env.",
    );
  if (!process.env.DATABASE_URL)
    throw new SiteAccessError("Укажите DATABASE_URL для PostgreSQL.");
  const password = fromEnv
    ? process.env.SITE_ADMIN_PASSWORD
    : await readPassword();
  if (!password)
    throw new SiteAccessError("Укажите пароль администратора сайта.");
  if (fromEnv) {
    const [current] = await db
      .select()
      .from(cmsSiteStaff)
      .where(eq(cmsSiteStaff.login, login));
    if (current) {
      if (!current.active || current.role !== "admin")
        throw new SiteAccessError(
          "Этот логин занят другой или отключённой учётной записью.",
        );
      if (!(await compare(password, current.passwordHash))) {
        await updateSiteStaff(current.id, current.id, {
          role: "admin",
          active: true,
          password,
        });
        console.log("Пароль администратора сайта обновлён.");
      } else {
        console.log("Данные администратора сайта уже совпадают с .env.");
      }
      return;
    }
  }
  await provisionSiteStaff(null, login, password, "admin");
  console.log("Администратор сайта создан.");
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof SiteAccessError
        ? error.message
        : "Не удалось создать администратора сайта. Проверьте подключение и миграции.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
