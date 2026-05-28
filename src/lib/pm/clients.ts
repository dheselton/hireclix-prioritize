import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: Set<string> | null = null;
let pending: Promise<Set<string>> | null = null;
const subs = new Set<(s: Set<string>) => void>();

async function fetchInternal(): Promise<Set<string>> {
  const { data } = await supabase.from("clients").select("id,is_internal");
  const set = new Set<string>(
    ((data ?? []) as { id: string; is_internal: boolean }[])
      .filter((r) => r.is_internal)
      .map((r) => r.id),
  );
  cache = set;
  subs.forEach((fn) => { try { fn(set); } catch {} });
  return set;
}

/** Returns a Set of client IDs flagged as internal (e.g. HireClix). Cached app-wide. */
export function useInternalClientIds(): Set<string> {
  const [set, setSet] = useState<Set<string>>(cache ?? new Set());
  useEffect(() => {
    let cancelled = false;
    if (cache) {
      setSet(cache);
    } else {
      pending = pending ?? fetchInternal();
      pending.then((s) => { if (!cancelled) setSet(s); });
    }
    const fn = (s: Set<string>) => { if (!cancelled) setSet(s); };
    subs.add(fn);
    return () => { cancelled = true; subs.delete(fn); };
  }, []);
  return set;
}

/** Force-refresh the internal-client cache (call after creating/updating a client). */
export function refreshInternalClients() {
  pending = fetchInternal();
  return pending;
}

// --- Project → internal lookup (cached) ---
let projCache: Set<string> | null = null;
let projPending: Promise<Set<string>> | null = null;
const projSubs = new Set<(s: Set<string>) => void>();

async function fetchInternalProjects(): Promise<Set<string>> {
  const internal = await (pending ?? fetchInternal());
  if (!internal.size) {
    projCache = new Set();
    projSubs.forEach((fn) => { try { fn(projCache!); } catch {} });
    return projCache;
  }
  const { data } = await supabase
    .from("pm_projects")
    .select("id,client_id")
    .in("client_id", Array.from(internal));
  const set = new Set<string>(((data ?? []) as { id: string }[]).map((r) => r.id));
  projCache = set;
  projSubs.forEach((fn) => { try { fn(set); } catch {} });
  return set;
}

/** Returns the set of project IDs that belong to an internal client (e.g. HireClix). */
export function useInternalProjectIds(): Set<string> {
  const [set, setSet] = useState<Set<string>>(projCache ?? new Set());
  useEffect(() => {
    let cancelled = false;
    if (projCache) {
      setSet(projCache);
    } else {
      projPending = projPending ?? fetchInternalProjects();
      projPending.then((s) => { if (!cancelled) setSet(s); });
    }
    const fn = (s: Set<string>) => { if (!cancelled) setSet(s); };
    projSubs.add(fn);
    return () => { cancelled = true; projSubs.delete(fn); };
  }, []);
  return set;
}

export function refreshInternalProjects() {
  projPending = fetchInternalProjects();
  return projPending;
}

// --- Project → Career Site request lookup (cached) ---
// Map<projectId, request_type> so consumers can also derive the subtype label.
let csCache: Map<string, string> | null = null;
let csPending: Promise<Map<string, string>> | null = null;
const csSubs = new Set<(m: Map<string, string>) => void>();

async function fetchCareerSiteProjects(): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("pm_projects")
    .select("id,custom_fields")
    .eq("work_type", "request");
  const map = new Map<string, string>();
  for (const r of ((data ?? []) as { id: string; custom_fields: any }[])) {
    const t = r.custom_fields?.request_type;
    if (typeof t === "string" && t.startsWith("careersite_")) map.set(r.id, t);
  }
  csCache = map;
  csSubs.forEach((fn) => { try { fn(map); } catch {} });
  return map;
}

/** Returns Map<projectId, request_type> for projects in the Career Site Support family. */
export function useCareerSiteProjects(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(csCache ?? new Map());
  useEffect(() => {
    let cancelled = false;
    if (csCache) {
      setMap(csCache);
    } else {
      csPending = csPending ?? fetchCareerSiteProjects();
      csPending.then((m) => { if (!cancelled) setMap(m); });
    }
    const fn = (m: Map<string, string>) => { if (!cancelled) setMap(m); };
    csSubs.add(fn);
    return () => { cancelled = true; csSubs.delete(fn); };
  }, []);
  return map;
}

export function refreshCareerSiteProjects() {
  csPending = fetchCareerSiteProjects();
  return csPending;
}

/** True when a project/task's custom_fields.request_type belongs to the Career Site Support family. */
export function isCareerSiteRequest(customFields: any): boolean {
  const t = customFields?.request_type;
  return typeof t === "string" && t.startsWith("careersite_");
}

/** Pretty sub-type label for a Career Site request (strips the "careersite_" prefix). */
export function careerSiteSubtype(customFields: any): string | null {
  const t = customFields?.request_type;
  if (typeof t !== "string" || !t.startsWith("careersite_")) return null;
  const sub = t.replace(/^careersite_/, "");
  const map: Record<string, string> = {
    bug: "Bug fix",
    content: "Content change",
    jobfeed: "API / Job feed",
    new_page: "New page",
    sow: "SOW project",
    support: "General support",
    update: "Update",
  };
  return map[sub] ?? sub.replace(/_/g, " ");
}
