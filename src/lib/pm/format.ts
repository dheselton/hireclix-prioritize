import { format, parseISO } from "date-fns";

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MM/dd/yyyy"); } catch { return d; }
}

export function fmtDateShort(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d"); } catch { return d; }
}

/* ---------------------------------------------------------------------------
 * Date-key helpers (YYYY-MM-DD)
 *
 * NEVER use `new Date().toISOString().slice(0, 10)` (or `.split("T")[0]`) to
 * get "today". `toISOString()` converts to UTC, so users in timezones behind
 * UTC get YESTERDAY's date after their local evening. Always use the local
 * helpers below.
 * ------------------------------------------------------------------------- */

/** Local calendar date as YYYY-MM-DD (no UTC shift). */
export function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayISO(): string {
  return localDateISO(new Date());
}

/** Today's local date offset by N days, as YYYY-MM-DD. */
export function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}
