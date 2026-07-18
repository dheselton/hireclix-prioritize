import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, AlertTriangle, ExternalLink } from "lucide-react";
import { fetchPageGroups, fetchPagePresets, addPageToProject, type PageGroup, type PagePreset } from "@/lib/pm/pageGroups";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function AddPageDialog({
  projectId, templateId, open, onOpenChange, initialGroupId,
}: { projectId: string; templateId: string | null; open: boolean; onOpenChange: (v: boolean) => void; initialGroupId?: string | null }) {
  const [groups, setGroups] = useState<PageGroup[]>([]);
  const [presets, setPresets] = useState<PagePreset[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [groupId, setGroupId] = useState<string>("");
  const [bulk, setBulk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !templateId) return;
    (async () => {
      const [g, p, slotsRes] = await Promise.all([
        fetchPageGroups(templateId),
        fetchPagePresets(templateId),
        supabase.from("pm_template_tasks").select("page_group_id").eq("template_id", templateId),
      ]);
      const counts: Record<string, number> = {};
      for (const row of (slotsRes.data || []) as any[]) {
        if (row.page_group_id) counts[row.page_group_id] = (counts[row.page_group_id] || 0) + 1;
      }
      setGroups(g); setPresets(p); setSlotCounts(counts);
      const preferred = initialGroupId && g.find(x => x.id === initialGroupId) ? initialGroupId : null;
      if (preferred) setGroupId(preferred);
      else if (g.length && !groupId) setGroupId(g[0].id);
    })();
  }, [open, templateId, initialGroupId]);

  async function submitMany(labels: string[]) {
    if (!templateId || !groupId) return;
    const cleaned = Array.from(new Set(labels.map(l => l.trim()).filter(Boolean)));
    if (!cleaned.length) return;
    setLoading(true);
    let added = 0;
    try {
      for (const label of cleaned) {
        const { insertedCount } = await addPageToProject({
          projectId, templateId, pageGroupId: groupId, pageLabel: label,
        });
        if (insertedCount > 0) added++;
      }
      if (!added) toast.error("Page group has no task slots defined yet");
      else { toast.success(`Added ${added} page(s); reserved time consumed`); emitTasksChanged(); onOpenChange(false); setBulk(""); }
    } catch (e: any) {
      toast.error(e.message || "Failed to add pages");
    } finally {
      setLoading(false);
    }
  }

  if (!templateId) return null;
  if (!groups.length) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>No page groups</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This project's template has no page groups defined. Open the template editor to add one before stamping pages.
          </p>
          <DialogFooter>
            <Button asChild variant="outline">
              <Link to={`/pm/templates/${templateId}/edit`} target="_blank">
                <ExternalLink className="h-3 w-3 mr-1" /> Open template editor
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const groupPresets = presets.filter(p => p.page_group_id === groupId);
  const bulkLines = bulk.split("\n").map(l => l.trim()).filter(Boolean);
  const selectedGroup = groups.find(g => g.id === groupId);
  const selectedSlotCount = slotCounts[groupId] || 0;
  const isEmpty = selectedSlotCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add pages to this project</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Page group</div>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => {
                const count = slotCounts[g.id] || 0;
                const empty = count === 0;
                const active = groupId === g.id;
                return (
                  <button key={g.id} type="button" onClick={() => setGroupId(g.id)}
                    className={`h-7 px-2.5 rounded-full text-xs border inline-flex items-center gap-1.5 ${
                      active
                        ? (empty ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/50" : "bg-info/10 text-info border-info")
                        : `border-border bg-background hover:bg-muted ${empty ? "opacity-60" : ""}`
                    }`}>
                    {empty && <AlertTriangle className="h-3 w-3" />}
                    {g.name}
                    <span className={`text-[10px] ${empty ? "" : "text-muted-foreground"}`}>· {count} slot{count === 1 ? "" : "s"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isEmpty ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold">"{selectedGroup?.name}" has no task slots yet.</div>
                  <p className="text-muted-foreground text-xs mt-1">
                    Page groups stamp a bundle of tasks onto every page you add (e.g. Design → Dev → QA → Content review).
                    This group has none defined, so adding pages would create empty shells. Open the template editor, attach the task
                    slots you want repeated per page, then come back here.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={`/pm/templates/${templateId}/edit`} target="_blank">
                  <ExternalLink className="h-3 w-3 mr-1" /> Open template editor
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {groupPresets.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Quick add a preset</div>
                  <div className="flex flex-wrap gap-1.5">
                    {groupPresets.map(p => (
                      <button key={p.id} type="button" onClick={() => submitMany([p.name])} disabled={loading}
                        className="h-7 px-2.5 rounded-full text-xs border border-border hover:bg-muted">
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Bulk add (one page name per line)</div>
                <Textarea rows={6} value={bulk} onChange={e => setBulk(e.target.value)}
                  placeholder={"Benefits\nLife At\nLocations\nEngineering Persona"} className="text-sm font-mono" />
                <div className="text-[11px] text-muted-foreground mt-1">
                  {bulkLines.length} page{bulkLines.length === 1 ? "" : "s"} ready · each will stamp {selectedSlotCount} task slot{selectedSlotCount === 1 ? "" : "s"} and consume reserved time.
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => submitMany(bulkLines)}
            disabled={loading || !bulkLines.length || isEmpty}
            title={isEmpty ? "Add task slots to this page group in the template editor first" : undefined}
          >
            <Plus className="h-3 w-3 mr-1" /> Add {bulkLines.length || ""} page{bulkLines.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
