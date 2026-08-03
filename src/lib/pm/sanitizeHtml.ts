import DOMPurify from "dompurify";

/**
 * Shared sanitizer for all rich-text HTML that gets stored and re-rendered.
 * Strips inline event handlers and `javascript:` URIs so pasted markup can
 * never execute for a later viewer.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    FORBID_ATTR: ["onerror", "onload"],
    ALLOWED_URI_REGEXP: /^(?!javascript:)/i,
  });
}
