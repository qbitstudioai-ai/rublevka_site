import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/server/events/schema.ts",
    "./src/server/cms/schema.ts",
    "./src/server/cms/auth-schema.ts",
    "./src/server/assistant/schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
