import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

const temp = resolve(tmpdir());
const root = await mkdtemp(join(temp, "rublevka-events-"));
const reservation = createServer();
await new Promise((resolve, reject) =>
  reservation.once("error", reject).listen(0, "127.0.0.1", resolve),
);
const { port } = reservation.address();
await new Promise((resolve) => reservation.close(resolve));
const password = randomBytes(32).toString("hex");
const database = "rublevka_events_test";
const url = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
const server = new EmbeddedPostgres({
  databaseDir: join(root, "data"),
  port,
  user: "postgres",
  password,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  persistent: true,
  onLog: () => {},
});
await server.initialise();
await server.start();
try {
  await server.createDatabase(database);
  if (process.argv.includes("--serve")) {
    const settings = join(root, "database-url");
    await writeFile(settings, url, { mode: 0o600 });
    console.log(`Local QA database URL file: ${settings}`);
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
    const { unlink } = await import("node:fs/promises");
    await unlink(settings);
  } else {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "--test",
        "--test-concurrency=1",
        "src/server/events/registration.test.ts",
        "src/server/cms/model.test.ts",
        "src/server/cms/media-replacement.test.ts",
        "src/server/cms/store.test.ts",
        "src/server/cms/access.test.ts",
        "src/server/cms/staff.test.ts",
        "src/server/assistant/assistant.test.ts",
        "src/server/assistant/chat-store.test.ts",
      ],
      {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: url },
      },
    );
    const code = await new Promise((resolve, reject) =>
      child.once("error", reject).once("exit", resolve),
    );
    process.exitCode = code ?? 1;
  }
} finally {
  // The Windows runner can retain the embedded daemon's pipes after taskkill.
  const postgres = process.platform === "win32" ? server.process : undefined;
  await server.stop();
  postgres?.stdin?.destroy();
  postgres?.stdout?.destroy();
  postgres?.stderr?.destroy();

  // Only remove the directory created for this cluster, retrying Windows file locks.
  if (dirname(root) !== temp) throw new Error("Unexpected test database path.");
  await rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
