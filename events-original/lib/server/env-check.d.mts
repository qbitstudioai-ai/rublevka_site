export const REQUIRED_IN_PRODUCTION: string[];
export function validateEnvironment(
  env?: Record<string, string | undefined>,
  options?: { cwd?: string; production?: boolean },
): { errors: string[]; warnings: string[] };
