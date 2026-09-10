/**
 * Load persona guide markdown from docs/guides/ (Vite raw imports).
 */

const modules = import.meta.glob("../../../docs/guides/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function normalizeKey(path: string): string {
  // e.g. ../../../docs/guides/operators/your-day.md → operators/your-day
  const marker = "/docs/guides/";
  const idx = path.replace(/\\/g, "/").lastIndexOf(marker);
  const rest = idx >= 0 ? path.slice(idx + marker.length) : path;
  return rest.replace(/\.md$/i, "");
}

const BY_SLUG: Record<string, string> = {};
for (const [path, body] of Object.entries(modules)) {
  BY_SLUG[normalizeKey(path)] = typeof body === "string" ? body : String(body);
}

export function getGuideMarkdown(slug: string): string | null {
  return BY_SLUG[slug] ?? null;
}

export function listLoadedGuideSlugs(): string[] {
  return Object.keys(BY_SLUG).sort();
}
