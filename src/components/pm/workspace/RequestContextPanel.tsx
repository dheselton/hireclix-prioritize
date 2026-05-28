import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Paperclip, Link as LinkIcon, Sparkles, ExternalLink } from "lucide-react";

interface Props {
  projectId: string;
}

interface ProjectMeta {
  description: string | null;
  custom_fields: any;
  work_type: string | null;
}

interface ProjAttachment { id: string; name: string; url: string }
interface ProjLink { id: string; url: string; label: string | null }

export function RequestContextPanel({ projectId }: Props) {
  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [attachments, setAttachments] = useState<ProjAttachment[]>([]);
  const [links, setLinks] = useState<ProjLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pm, at, ln] = await Promise.all([
        supabase.from("pm_projects").select("description, custom_fields, work_type").eq("id", projectId).maybeSingle(),
        supabase.from("pm_project_attachments").select("id, name, url").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("pm_project_links" as any).select("id, url, label").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setMeta((pm.data as any) ?? null);
      setAttachments(((at.data as any[]) ?? []) as ProjAttachment[]);
      setLinks(((ln.data as any[]) ?? []) as ProjLink[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading || !meta) return null;
  // Only show for requests
  if (meta.work_type !== "request") return null;

  const cf = (meta.custom_fields ?? {}) as Record<string, any>;
  const requestType: string | undefined = cf.request_type;
  const fieldEntries = Object.entries(cf).filter(([k]) => k !== "request_type")
    .map(([k, v]) => v && typeof v === "object" && "label" in v
      ? { key: k, label: (v as any).label as string, value: (v as any).value, type: (v as any).type as string }
      : { key: k, label: k, value: v, type: "text" });

  const hasAny = !!meta.description || fieldEntries.length > 0 || attachments.length > 0 || links.length > 0 || !!requestType;
  if (!hasAny) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Original Request
        </h3>
        {requestType && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
            {requestType.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {meta.description && (
        <div className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
          {meta.description}
        </div>
      )}

      {fieldEntries.length > 0 && (() => {
        const isLong = (f: typeof fieldEntries[number]) =>
          f.type === "textarea" ||
          /description|notes|details|copy|content/i.test(f.key) ||
          (typeof f.value === "string" && f.value.length > 120);
        const shortFields = fieldEntries.filter((f) => !isLong(f));
        const longFields = fieldEntries.filter(isLong);
        return (
          <>
            {shortFields.length > 0 && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {shortFields.map((f) => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{f.label}</dt>
                    <dd className="text-sm text-foreground break-words">
                      {Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "")}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {longFields.map((f) => (
              <div key={f.key} className="min-w-0">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{f.label}</div>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                  {Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "")}
                </div>
              </div>
            ))}
          </>
        );
      })()}

      {(attachments.length > 0 || links.length > 0) && (
        <div className="pt-2 border-t border-border/60 space-y-2">
          {attachments.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <Paperclip className="h-3 w-3" /> Files ({attachments.length})
              </div>
              <ul className="space-y-1">
                {attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <FileText className="h-3.5 w-3.5" /> {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {links.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <LinkIcon className="h-3 w-3" /> Reference links ({links.length})
              </div>
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      {l.label || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
