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
