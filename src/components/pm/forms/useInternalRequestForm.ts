import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FormFieldRow } from "./FormFieldRenderer";

export type RequestType =
  | "web_edit"
  | "banner_ads"
  | "social"
  | "email"
  | "general"
  | "landing_page"
  | "careersite_update"
  | "careersite_bug"
  | "careersite_content"
  | "careersite_jobfeed"
  | "careersite_new_page"
  | "careersite_sow"
  | "careersite_support"
  | "job_description"
  | "recruiter_collateral"
  | "event_collateral"
  | "presentation"
  | "video_edit"
  | "photo_retouch"
  | "print_collateral"
  | "swag_apparel"
  | "infographic"
  | "brand_assets"
  | "copywriting";

const RESERVED_SLUGS = new Set(["request_type", "title", "ship_by_date", "description"]);

let cachedFormId: string | null = null;
let cachedAllFields: FormFieldRow[] | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded() {
  if (cachedAllFields) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const { data: form } = await supabase
        .from("pm_forms")
        .select("id")
        .eq("shareable_slug", "quick-request")
        .maybeSingle();
      if (!form) return;
      cachedFormId = (form as any).id;
      const { data: ff } = await supabase
        .from("pm_form_fields")
        .select("id,label,type,required,placeholder,options,sort_order,conditionals")
        .eq("form_id", cachedFormId!)
        .order("sort_order");
      cachedAllFields = (ff || []) as FormFieldRow[];
    })();
  }
  await loadPromise;
}

/**
 * Returns the per-request-type fields sourced from the canonical Quick Request form,
 * filtering by conditionals that gate on `request_type`.
 */
export function useInternalRequestForm(requestType: RequestType | null) {
  const [formId, setFormId] = useState<string | null>(null);
  const [fields, setFields] = useState<FormFieldRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!requestType) { setFormId(null); setFields([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      await ensureLoaded();
      if (cancelled) return;
      const all = cachedAllFields || [];
      // Include only fields conditionally gated on this request_type, skipping reserved fields.
      const gated = all.filter(f => {
        const slug = slugifyLabel(f.label);
        if (RESERVED_SLUGS.has(slug)) return false;
        const rules: any[] = Array.isArray((f as any).conditionals) ? (f as any).conditionals : [];
        if (rules.length === 0) return true;
        return rules.every(r =>
          r && r.field === "request_type" && Array.isArray(r.in) && r.in.includes(requestType)
        );
      });
      setFormId(cachedFormId);
      setFields(gated);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [requestType]);

  return { formId, fields, loading };
}

export function slugifyLabel(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
