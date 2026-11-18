import type Database from "better-sqlite3";

export const DEMO_EVENT_SLUG: string;
export function seedDemo(db: Database.Database): { event: "created" | "skipped"; settings: "updated" | "skipped" };
