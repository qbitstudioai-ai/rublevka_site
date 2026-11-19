export type SiteRole = "admin" | "editor";

export function normalizeSiteLogin(value: string) {
  const login = value.trim().toLowerCase();
  return /^[a-z0-9_.-]{2,64}$/.test(login) ? login : null;
}

export function acceptsSitePassword(password: string) {
  return (
    Array.from(password).length >= 14 &&
    Buffer.byteLength(password) <= 72 &&
    !/[\u0000-\u001f\u007f]/.test(password)
  );
}

export function siteRoleAllows(role: string, adminOnly: boolean) {
  return role === "admin" || (!adminOnly && role === "editor");
}
