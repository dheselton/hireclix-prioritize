/**
 * Shared helpers for identity uniqueness (clients, roster, portal contacts).
 * Database unique indexes are the race-safe source of truth; these helpers
 * normalize names/emails and map Postgres 23505 into clear UI messages.
 */

export function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Match key used by clients_name_normalized_unique (case-insensitive). */
export function clientNameKey(name: string): string {
  return normalizeClientName(name).toLowerCase();
}

/**
 * Brand stem for Careers/Jobs aliases.
 * "Parsons Careers" → "parsons"; "CHS" stays "chs" (does not match Community Health Systems).
 * Empty after strip keeps the original key.
 */
export function clientNameStem(name: string): string {
  const key = clientNameKey(name);
  if (!key) return key;
  const stripped = key
    .replace(/\s+career\s+sites?$/i, "")
    .replace(/\s+(careers|jobs)$/i, "")
    .trim();
  return stripped || key;
}

export function namesMatchClient(a: string, b: string): boolean {
  const ka = clientNameKey(a);
  const kb = clientNameKey(b);
  return !!ka && !!kb && ka === kb;
}

/** True when two names share the same Careers/Jobs brand stem. */
export function namesMatchClientStem(a: string, b: string): boolean {
  const sa = clientNameStem(a);
  const sb = clientNameStem(b);
  return !!sa && !!sb && sa === sb;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "23505") return true;
  const msg = `${e.message ?? ""}`.toLowerCase();
  return msg.includes("duplicate") || msg.includes("unique");
}

export function uniqueViolationMessage(
  error: unknown,
  fallback: string,
): string {
  if (!isUniqueViolation(error)) {
    const e = error as { message?: string } | null;
    return e?.message || fallback;
  }
  const msg = `${(error as { message?: string }).message ?? ""}`.toLowerCase();
  if (msg.includes("clients_name_stem") || msg.includes("clients_name_normalized") || msg.includes("clients")) {
    return "A client with this name already exists";
  }
  if (msg.includes("pm_users_email") || msg.includes("pm_users")) {
    return "A user with this email already exists";
  }
  if (msg.includes("pm_portal_access") || msg.includes("portal")) {
    return "This email already has portal access for this client";
  }
  return "This record already exists";
}
