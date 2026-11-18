import { headers } from "next/headers";
import { localRegistrationAllowed } from "./isolation";

export async function testRegistrationEnabled() {
  const request = await headers();
  return localRegistrationAllowed(
    process.env.EVENT_REGISTRATION_MODE,
    process.env.DATABASE_URL,
    request.get("host"),
    request.get("origin"),
  );
}
