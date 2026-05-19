import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface Sub {
  id: string;
  form_id: string;
  payload: Record<string, any>;
  submitter_name: string | null;
  submitter_email: string | null;
  created_at: string;
}
interface Field { id: string; label: string; sort_order: number; }

export function FormSubmissionBlock({ taskId }: { taskId: string }) {
  const [sub, setSub] = useState<Sub | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("pm_form_submissions").select("*").eq("created_task_id", taskId).maybeSingle();
      if (!data) { setSub(null); return; }
      setSub(data as Sub);
      const { data: f } = await supabase.from("pm_forms").select("name").eq("id", (data as any).form_id).maybeSingle();
      setFormName((f as any)?.name ?? "Form submission");
      const { data: ff } = await supabase.from("pm_form_fields").select("id,label,sort_order").eq("form_id", (data as any).form_id).order("sort_order");
      setFields((ff || []) as Field[]);
    })();
  }, [taskId]);

  if (!sub) return null;

  // Map payload keys to ordered field labels when available, fall back to raw key order
  const ordered = fields.length
    ? fields.map(f => ({ label: f.label, value: sub.payload?.[f.id] ?? sub.payload?.[f.label] ?? "" }))
    : Object.entries(sub.payload || {}).map(([k, v]) => ({ label: k, value: v }));

  return (
    <div className="border border-border rounded-lg bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">{formName}</div>
        <Badge variant="secondary" className="ml-auto">Form intake</Badge>
      </div>
      {(sub.submitter_name || sub.submitter_email) && (
        <div className="text-xs text-muted-foreground">
          From {sub.submitter_name ?? "—"} {sub.submitter_email && <span>· {sub.submitter_email}</span>}
        </div>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-sm">
        {ordered.filter(o => o.value !== undefined && o.value !== "" && o.value !== null).map((o, i) => (
          <div key={i} className="contents">
            <dt className="text-xs font-medium text-muted-foreground pt-0.5">{o.label}</dt>
            <dd className="whitespace-pre-wrap break-words">{typeof o.value === "string" ? o.value : JSON.stringify(o.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
