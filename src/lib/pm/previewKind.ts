export type PreviewKind =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "office"
  | "text"
  | "link"
  | "other";

export const IMG_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|$)/i;
export const PDF_RE = /\.pdf(\?|$)/i;
export const VID_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i;
export const AUD_RE = /\.(mp3|wav|m4a|ogg|aac|flac)(\?|$)/i;
export const OFFICE_RE = /\.(docx?|xlsx?|pptx?)(\?|$)/i;
export const TEXT_RE = /\.(txt|md|csv|tsv|json|log|xml|yml|yaml)(\?|$)/i;

export function detectKind(nameOrUrl: string, type?: string): PreviewKind {
  if (type === "link") return "link";
  const s = nameOrUrl || "";
  if (IMG_RE.test(s)) return "image";
  if (PDF_RE.test(s)) return "pdf";
  if (VID_RE.test(s)) return "video";
  if (AUD_RE.test(s)) return "audio";
  if (OFFICE_RE.test(s)) return "office";
  if (TEXT_RE.test(s)) return "text";
  return "other";
}

export function extOf(nameOrUrl: string): string {
  const m = (nameOrUrl || "").match(/\.([a-z0-9]+)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "";
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function faviconFor(url: string, size = 64): string {
  const host = hostOf(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}
