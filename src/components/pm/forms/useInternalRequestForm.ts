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

const cache = new Map<RequestType, { formId: string; fields: FormFieldRow[] }>();

export function useInternalRequestForm(requestType: RequestType | null) {
  const [formId, setFormId] = useState<string | null>(null);
  const [fields, setFields] = useState<FormFieldRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!requestType) { setFormId(null); setFields([]); return; }
    const cached = cache.get(requestType);
    if (cached) { setFormId(cached.formId); setFields(cached.fields); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: form } = await supabase
        .from("pm_forms")
        .select("id")
        .eq("kind", "internal_request")
        .eq("request_type", requestType)
        .maybeSingle();
      if (!form || cancelled) { setLoading(false); return; }
      const { data: ff } = await supabase
        .from("pm_form_fields")
        .select("id,label,type,required,placeholder,options,sort_order")
        .eq("form_id", form.id)
        .order("sort_order");
      if (cancelled) return;
      const list = (ff || []) as FormFieldRow[];
      cache.set(requestType, { formId: form.id, fields: list });
      setFormId(form.id);
      setFields(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [requestType]);

  return { formId, fields, loading };
}

export function slugifyLabel(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
