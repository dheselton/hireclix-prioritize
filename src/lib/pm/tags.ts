/**
 * Tag system — a small, curated vocabulary across three namespaces:
 *   client:<slug>    — auto-applied from the project's client (never user-typed)
 *   type:<slug>      — project shape / delivery model (managed on the project, inherited by tasks)
 *   feature:<slug>   — the thing the work touches (chosen from a curated catalog)
 *
 * Internal system flags (e.g. "support", the legacy "type:dev" secondary-type marker) are stored in
 * `custom_fields.system_tags` and are never surfaced in the visible tag UI.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TagNamespace = "client" | "type" | "feature";

export interface ParsedTag {
  namespace: TagNamespace | null;
  slug: string;
  raw: string;
}

export interface CatalogEntry {
  id: string;
  namespace: "type" | "feature";
  slug: string;
  label: string;
  color: string | null;
}

const NAMESPACES: TagNamespace[] = ["client", "type", "feature"];

export function parseTag(raw: string): ParsedTag {
  const idx = raw.indexOf(":");
  if (idx <= 0) return { namespace: null, slug: raw, raw };
  const ns = raw.slice(0, idx) as TagNamespace;
  const slug = raw.slice(idx + 1);
  if (!NAMESPACES.includes(ns)) return { namespace: null, slug: raw, raw };
  return { namespace: ns, slug, raw };
}

/** Filter to only namespaced tags belonging to one of the three visible namespaces. */
export function visibleTags(tags: string[] | null | undefined): ParsedTag[] {
  if (!tags?.length) return [];
  return tags.map(parseTag).filter(t => t.namespace !== null);
}

export function groupTags(tags: string[] | null | undefined) {
  const out: Record<TagNamespace, ParsedTag[]> = { client: [], type: [], feature: [] };
  for (const t of visibleTags(tags)) {
    if (t.namespace) out[t.namespace].push(t);
  }
  return out;
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Build a client:<slug> tag from a client name. */
export function clientTag(clientName: string | null | undefined): string | null {
  if (!clientName) return null;
  const slug = slugify(clientName);
  return slug ? `client:${slug}` : null;
}

/** Merge inherited (client + type) tags from a project into a task's own tags,
 *  preserving the task's feature: tags and dropping any duplicates. */
export function mergeInheritedTags(taskTags: string[] | null | undefined, projectTags: string[] | null | undefined): string[] {
  const inherit = (projectTags ?? []).filter(t => {
    const p = parseTag(t);
    return p.namespace === "client" || p.namespace === "type";
  });
  return Array.from(new Set([...(taskTags ?? []), ...inherit]));
}

/** Remove any client:/type: tags from a task's tags — used when only the feature:*
 *  set is user-editable and the rest are inherited fresh each save. */
export function stripInheritedTags(taskTags: string[] | null | undefined): string[] {
  return (taskTags ?? []).filter(t => {
    const p = parseTag(t);
    return p.namespace !== "client" && p.namespace !== "type";
  });
}

// ---------- Catalog ----------

let catalogCache: CatalogEntry[] | null = null;
const catalogListeners = new Set<() => void>();

export async function fetchTagCatalog(force = false): Promise<CatalogEntry[]> {
  if (catalogCache && !force) return catalogCache;
  const { data, error } = await supabase
    .from("pm_tag_catalog" as any)
    .select("id, namespace, slug, label, color")
    .order("namespace")
    .order("label");
  if (error) throw error;
  catalogCache = (data as any[] as CatalogEntry[]) ?? [];
  catalogListeners.forEach(fn => fn());
  return catalogCache;
}

export function useTagCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>(catalogCache ?? []);
  const [loading, setLoading] = useState(!catalogCache);

  useEffect(() => {
    let mounted = true;
    fetchTagCatalog().then(r => { if (mounted) { setEntries(r); setLoading(false); } });
    const fn = () => { if (catalogCache) setEntries([...catalogCache]); };
    catalogListeners.add(fn);
    return () => { mounted = false; catalogListeners.delete(fn); };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetchTagCatalog(true);
    setEntries(r);
    setLoading(false);
  }, []);

  return { entries, loading, reload };
}

/** Insert a new catalog entry. Returns the resulting tag string. */
export async function createCatalogEntry(namespace: "type" | "feature", label: string): Promise<string> {
  const slug = slugify(label);
  if (!slug) throw new Error("Tag label required");
  const { error } = await supabase
    .from("pm_tag_catalog" as any)
    .insert({ namespace, slug, label: label.trim() } as any);
  if (error && !`${error.message}`.includes("duplicate")) throw error;
  await fetchTagCatalog(true);
  return `${namespace}:${slug}`;
}

// ---------- Label lookup ----------

/** Best-effort human label for any tag string. Falls back to slug-cased text. */
export function tagLabel(raw: string, catalog: CatalogEntry[] = catalogCache ?? []): string {
  const p = parseTag(raw);
  if (p.namespace === "client") return titleCase(p.slug);
  const hit = catalog.find(c => c.namespace === p.namespace && c.slug === p.slug);
  if (hit) return hit.label;
  return titleCase(p.slug || p.raw);
}

function titleCase(s: string) {
  return s.split(/[-_ ]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}

// ---------- System tags (hidden internal flags) ----------

export function systemTags(cf: any): string[] {
  const arr = cf?.system_tags;
  return Array.isArray(arr) ? arr as string[] : [];
}

export function hasSystemTag(cf: any, flag: string): boolean {
  return systemTags(cf).includes(flag);
}
