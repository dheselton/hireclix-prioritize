import { format, parseISO } from "date-fns";

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MM/dd/yyyy"); } catch { return d; }
}

export function fmtDateShort(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d"); } catch { return d; }
}
