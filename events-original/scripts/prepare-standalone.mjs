// После `next build`: дополняет .next/standalone тем, что нужно серверу во время работы
// (статика, public, SQL-миграции). Так standalone запускается так же, как в Docker-образе.
import fs from "node:fs";
import path from "node:path";
import { removeDir } from "../db/backup.mjs";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Нет .next/standalone/server.js — проверьте output: \"standalone\" в next.config.ts.");
  process.exit(1);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else if (entry.isFile()) fs.copyFileSync(source, target);
  }
}

// Трассировка файлов может захватить рабочие данные (пути по умолчанию data/...) и исходники.
// Им не место в артефакте сборки: код уже в серверных бандлах, данные живут в volume.
for (const name of ["data", ".e2e-data", "backups", "lib", "tests", "docs", "scripts", ".env", ".env.local"]) {
  const target = path.join(standalone, name);
  if (!fs.existsSync(target)) continue;
  if (fs.statSync(target).isDirectory()) removeDir(target);
  else fs.unlinkSync(target);
  console.log(`Из standalone удалено: ${name}`);
}

/**
 * Трассировка Next копирует нативные пакеты не полностью (например, @img/sharp-<платформа>
 * без libvips). Копируем пакет и все его установленные зависимости целиком.
 */
function copyPackage(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);
  const source = path.join(root, "node_modules", name);
  if (!fs.existsSync(source)) return; // необязательная зависимость для другой платформы
  const target = path.join(standalone, "node_modules", name);
  if (fs.existsSync(target)) removeDir(target);
  copyDir(source, target);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
  for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })) copyPackage(dependency, seen);
}

copyPackage("sharp");

copyDir(path.join(root, "public"), path.join(standalone, "public"));
copyDir(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copyDir(path.join(root, "db", "migrations"), path.join(standalone, "db", "migrations"));
console.log("Standalone-сборка дополнена: sharp (целиком), public, .next/static, db/migrations.");
