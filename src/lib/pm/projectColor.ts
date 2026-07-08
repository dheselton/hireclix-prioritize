/**
 * Deterministic per-project color used for sidebar dots, project chips, etc.
 * Uses HSL variables so it plays nicely with light/dark theming.
 * Special client types (internal, career site) override the auto color.
 */

const PALETTE: string[] = [
  "0 72% 51%",     // red
  "24 90% 55%",    // orange
  "38 92% 50%",    // amber
  "142 70% 42%",   // green
  "173 80% 40%",   // teal
  "199 89% 48%",   // sky
  "217 91% 60%",   // blue
  "258 75% 62%",   // violet
  "292 65% 55%",   // fuchsia
  "330 78% 55%",   // pink
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface ProjectColorOpts {
  isInternal?: boolean;
  isCareerSite?: boolean;
}

/** Returns an HSL string like "217 91% 60%" suitable for `hsl(...)`. */
export function projectColorHsl(projectId: string, opts: ProjectColorOpts = {}): string {
  if (opts.isCareerSite) return "188 70% 42%";  // --careersite
  if (opts.isInternal)   return "270 70% 55%";  // --internal
  return PALETTE[hashStr(projectId) % PALETTE.length];
}
