export function scoreMatch(text: string | null | undefined, term: string): number {
  if (!text || !term) return 0;
  const t = text.toLowerCase();
  const q = term.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 60;
  // word boundary
  if (new RegExp(`\\b${escapeRe(q)}`).test(t)) return 30;
  if (t.includes(q)) return 15;
  return 0;
}

export function scoreMulti(fields: Array<string | null | undefined>, term: string, weights: number[] = []): number {
  let best = 0;
  fields.forEach((f, i) => {
    const w = weights[i] ?? 1;
    const s = scoreMatch(f, term) * w;
    if (s > best) best = s;
  });
  return best;
}

export function recencyBoost(updatedAt: string | null | undefined): number {
  if (!updatedAt) return 0;
  const ms = Date.now() - new Date(updatedAt).getTime();
  const days = ms / 86_400_000;
  if (days < 1) return 8;
  if (days < 7) return 5;
  if (days < 30) return 2;
  return 0;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
