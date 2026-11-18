const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function localRegistrationAllowed(
  mode: string | undefined,
  database: string | undefined,
  host: string | null,
  origin: string | null,
) {
  if (mode !== "test" || !database || !host) return false;
  try {
    const db = new URL(database);
    const site = new URL("http://" + host);
    return (
      /^postgres(ql)?:$/.test(db.protocol) &&
      loopback.has(db.hostname) &&
      db.pathname === "/rublevka_events_test" &&
      !db.search &&
      !db.hash &&
      site.host === host &&
      loopback.has(site.hostname) &&
      (!origin || new URL(origin).host === host)
    );
  } catch {
    return false;
  }
}
