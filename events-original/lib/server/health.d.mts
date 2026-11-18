export type HealthCheckValue = "ok" | "error" | "pending";
export type HealthResult = {
  status: "ok" | "degraded";
  checks: { database: HealthCheckValue; migrations: HealthCheckValue; uploads: HealthCheckValue };
};
export function checkHealth(options: { databasePath: string; uploadsDir: string; migrationsDir?: string }): HealthResult;
