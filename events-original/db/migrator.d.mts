import type Database from "better-sqlite3";

export const MIGRATIONS_DIR: string;
export const DEFAULT_DATABASE_PATH: string;
export function resolveDatabasePath(value?: string): string;
export function openDatabase(filePath?: string): Database.Database;
export function listMigrationFiles(dir?: string): string[];
export function runMigrations(db: Database.Database, dir?: string): { applied: string[]; skipped: string[] };
export function pendingMigrations(db: Database.Database, dir?: string): string[];
