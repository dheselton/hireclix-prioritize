import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  liveSitesForClient,
  linkRequestToLiveSite,
  type LiveSiteSummary,
} from "@/lib/pm/liveSites";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { fmtDate } from "@/lib/pm/format";
import type { PmProject } from "@/types/pm";

/** Compact “Site: …” link + optional picker to attach an unlinked careersite request. */
export function ParentLiveSiteChip({
  project,
  onChanged,
}: {
  project: PmProject;
  onChanged?: () => void;
}) {
  const [parentTitle, setParentTitle] = useState<string | null>(null);
  const [sites, setSites] = useState<LiveSiteSummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const parentId = project.parent_project_id ?? null;
  const isCareerSiteReq =
    typeof (project.custom_fields as { request_type?: string } | null)?.request_type === "string"
    && ((project.custom_fields as { request_type?: string }).request_type ?? "").startsWith("careersite_");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (parentId) {
        const { data } = await supabase.from("pm_projects").select("title").eq("id", parentId).maybeSingle();
        if (!cancel) setParentTitle((data as { title?: string } | null)?.title ?? "Live site");
      } else {
        setParentTitle(null);
      }
      if (!parentId && isCareerSiteReq && project.client_id) {
        try {
          const list = await liveSitesForClient(project.client_id);
          if (!cancel) setSites(list);
        } catch {
          if (!cancel) setSites([]);
        }
      }
    })();
    return () => { cancel = true; };
  }, [parentId, isCareerSiteReq, project.client_id]);

  if (parentId && parentTitle) {
    return (
      <div className="text-sm">
        <span className="text-muted-foreground">Site: </span>
        <Link to={`/pm/projects/${parentId}`} className="font-medium text-primary hover:underline">
          {parentTitle}
        </Link>
      </div>
    );
  }

  if (!isCareerSiteReq || sites.length === 0) return null;

  if (!editing) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
        Link to live site
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label>Live career site</Label>
      <Select value={selected || undefined} onValueChange={setSelected}>
        <SelectTrigger>
          <SelectValue placeholder="Select site…" />
        </SelectTrigger>
        <SelectContent>
          {sites.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.title}{s.go_live_date ? ` · ${fmtDate(s.go_live_date)}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!selected || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await linkRequestToLiveSite(project.id, selected);
              toast.success("Linked to live career site");
              emitTasksChanged();
              onChanged?.();
              setEditing(false);
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : "Could not link");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}
