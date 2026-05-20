import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { fetchPageGroups, fetchPagePresets, addPageToProject, type PageGroup, type PagePreset } from "@/lib/pm/pageGroups";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { toast } from "sonner";

export function AddPageDialog({
  projectId, templateId, open, onOpenChange,
}: { projectId: string; templateId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [groups, setGroups] = useState<PageGroup[]>([]);
  const [presets, setPresets] = useState<PagePreset[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [bulk, setBulk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !templateId) return;
    (async () => {
      const [g, p] = await Promise.all([fetchPageGroups(templateId), fetchPagePresets(templateId)]);
      setGroups(g); setPresets(p);
      if (g.length && !groupId) setGroupId(g[0].id);
    })();
  }, [open, templateId]);

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
        </DialogContent>
      </Dialog>
    );
  }

  const groupPresets = presets.filter(p => p.page_group_id === groupId);
  const bulkLines = bulk.split("\n").map(l => l.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add pages to this project</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Page group</div>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
                <button key={g.id} type="button" onClick={() => setGroupId(g.id)}
                  className={`h-7 px-2.5 rounded-full text-xs border ${groupId === g.id ? "bg-info/10 text-info border-info" : "border-border bg-background hover:bg-muted"}`}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>

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
              {bulkLines.length} page{bulkLines.length === 1 ? "" : "s"} ready · each will stamp the full task bundle and consume reserved time.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submitMany(bulkLines)} disabled={loading || !bulkLines.length}>
            <Plus className="h-3 w-3 mr-1" /> Add {bulkLines.length || ""} page{bulkLines.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
