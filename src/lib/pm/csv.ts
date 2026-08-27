/** Minimal RFC4180-ish CSV helpers (quoted fields, commas, newlines). */

export const CSV_IMPORT_MAX_ROWS = 200;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(cell);
      cell = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
      if (ch === "\r" && s[i + 1] === "\n") i += 2;
      else i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Lowercase + strip punctuation/spaces so "Due Date", "due_date", "duedate" match. */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_\-./]+/g, "");
}

export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map(cells => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

export function pickField(row: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) {
    const key = normalizeHeader(a);
    const v = row[key];
    if (v != null && v !== "") return v;
  }
  return "";
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map(r => r.map(c => escapeCsvCell(String(c ?? ""))).join(",")).join("\n") + "\n";
}

export function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
