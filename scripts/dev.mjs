import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const events = resolve(root, "events-original");
const next = "node_modules/next/dist/bin/next";
const settings = resolve(root, ".env");
if (existsSync(settings)) {
  process.loadEnvFile(settings);
  // The local site's publishing mode belongs to this checkout, even when the
  // terminal previously ran a static preview with CMS_ENABLED=false.
  const { CMS_ENABLED } = parseEnv(readFileSync(settings, "utf8"));
  if (CMS_ENABLED !== undefined) process.env.CMS_ENABLED = CMS_ENABLED;
}
if (!existsSync(resolve(events, next))) {
  console.error(
    "Установите зависимости оригинальной афиши: npm ci --prefix events-original --ignore-scripts",
  );
  process.exit(1);
}

const env = {
  ...process.env,
  EVENTS_MOUNT_LOCAL: "1",
  EVENTS_ORIGINAL_ORIGIN: "http://127.0.0.1:3271",
};
const originalEnv = { ...env, EVENTS_ASSISTANT_MOUNTED: "true" };
for (const key of [
  "DATABASE_URL",
  "SITE_ADMIN_USERNAME",
  "SITE_ADMIN_PASSWORD",
  "SITE_ADMIN_SESSION_SECRET",
  "CMS_ENABLED",
  "CMS_MEDIA_DIR",
  "DATABASE_PATH",
  "UPLOADS_DIR",
  "APP_URL",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TRUST_PROXY",
  "EVENTS_ORIGINAL_TEST",
  ...Object.keys(env).filter((key) => key.startsWith("ASSISTANT_") && key !== "ASSISTANT_EVENTS_KEY"),
]) {
  delete originalEnv[key];
}

for (const key of [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
  "APP_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TRUST_PROXY",
]) {
  const value = env[`EVENTS_${key}`];
  if (value !== undefined) originalEnv[key] = value;
}

function nextProcess(cwd, args, env) {
  return spawn(process.execPath, [next, "dev", ...args], {
    cwd,
    env,
    stdio: "inherit",
  });
}

originalEnv.DATABASE_PATH = resolve(
  root,
  env.EVENTS_DATABASE_PATH || "events-original/data/mounted.sqlite",
);
originalEnv.UPLOADS_DIR = resolve(
  root,
  env.EVENTS_UPLOADS_DIR || "events-original/data/uploads",
);
const migration = spawn(process.execPath, ["scripts/init-mounted.mjs"], {
  cwd: events,
  env: originalEnv,
  stdio: "inherit",
});
const status = await new Promise((resolveStatus) =>
  migration.on("exit", resolveStatus),
);
if (status !== 0) process.exit(status ?? 1);

const children = [
  nextProcess(
    events,
    ["--hostname", "127.0.0.1", "--port", "3271"],
    originalEnv,
  ),
  nextProcess(root, ["--hostname", "127.0.0.1", ...process.argv.slice(2)], env),
];
function stop() {
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.once("exit", (code) => {
    if (code) process.exitCode = code;
    stop();
  });
