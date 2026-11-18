import { hash } from "bcryptjs";
import { emitKeypressEvents } from "node:readline";
import { stdin, stderr } from "node:process";
import { db, pool } from "../src/server/events/db";
import { adminUsers, auditLogs } from "../src/server/events/schema";

async function readPassword(): Promise<string> {
  stdin.setEncoding("utf8");
  if (!stdin.isTTY) {
    let input = "";
    for await (const chunk of stdin) {
      input += chunk;
      if (input.length > 128) throw new Error("Слишком длинный пароль.");
    }
    return input.replace(/\r?\n$/, "");
  }
  stderr.write("Пароль (ввод скрыт): ");
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  try {
    return await new Promise<string>((resolve, reject) => {
      let input = "";
      const handle = (char: string, key: { name: string; ctrl?: boolean }) => {
        if (key.name === "return" || key.name === "enter") {
          stdin.off("keypress", handle);
          resolve(input);
        } else if (key.ctrl && key.name === "c") {
          stdin.off("keypress", handle);
          reject(new Error("Отменено."));
        } else if (key.name === "backspace")
          input = Array.from(input).slice(0, -1).join("");
        else if (!key.ctrl && char && !/[\x00-\x1f\x7f]/.test(char))
          input += char;
      };
      stdin.on("keypress", handle);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
    stderr.write("\n");
  }
}
async function main() {
  const [login, role = "admin"] = process.argv.slice(2);
  if (
    !/^[a-z0-9_.-]{2,64}$/.test(login ?? "") ||
    (role !== "admin" && role !== "manager")
  )
    throw new Error("Использование: create-admin <логин> [admin|manager]");
  const password = await readPassword();
  if (password.length < 14 || Buffer.byteLength(password) > 72)
    throw new Error("Требуется от 14 символов до 72 байт.");
  const passwordHash = await hash(password, 12);
  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(adminUsers)
      .values({ login, role, passwordHash })
      .onConflictDoNothing()
      .returning({ id: adminUsers.id });
    if (!user) throw new Error("Логин уже используется.");
    await tx
      .insert(auditLogs)
      .values({
        adminId: user.id,
        action: "account.provision",
        targetId: user.id,
      });
  });
  console.log("Учётная запись создана.");
}
main()
  .catch((error: Error) => {
    console.error(
      [
        "Отменено.",
        "Логин уже используется.",
        "Требуется от 14 символов до 72 байт.",
        "Использование: create-admin <логин> [admin|manager]",
      ].includes(error.message)
        ? error.message
        : "Не удалось создать учётную запись.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
