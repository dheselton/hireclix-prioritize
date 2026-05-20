import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPageGroups, fetchPagePresets, addPageToProject, type PageGroup, type PagePreset } from "@/lib/pm/pageGroups";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { toast } from "sonner";

export function AddPageDialog({
  projectId, templateId, open, onOpenChange,
}: { projectId: string; templateId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [groups, setGroups] = useState<PageGroup[]>([]);
  const [presets, setPresets] = useState<PagePreset[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !templateId) return;
    (async () => {
      const [g, p] = await Promise.all([fetchPageGroups(templateId), fetchPagePresets(templateId)]);
      setGroups(g); setPresets(p);
      if (g.length && !groupId) setGroupId(g[0].id);
    })();
  }, [open, templateId]);

  async function submit(label: string) {
    if (!templateId || !groupId || !label.trim()) return;
    setLoading(true);
    try {
      const { insertedCount } = await addPageToProject({
        projectId, templateId, pageGroupId: groupId, pageLabel: label.trim(),
      });
      if (insertedCount === 0) toast.error("Page group has no tasks defined yet");
      else { toast.success(`Added ${insertedCount} task(s) for "${label.trim()}"`); emitTasksChanged(); onOpenChange(false); setName(""); }
    } catch (e: any) {
      toast.error(e.message || "Failed to add page");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a page to this project</DialogTitle></DialogHeader>
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
              <div className="text-xs uppercase text-muted-foreground mb-1">Quick pick</div>
              <div className="flex flex-wrap gap-1.5">
                {groupPresets.map(p => (
                  <button key={p.id} type="button" onClick={() => submit(p.name)} disabled={loading}
                    className="h-7 px-2.5 rounded-full text-xs border border-border hover:bg-muted">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-1">Or custom page name</div>
            <div className="flex gap-2">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Apprenticeships"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(name); } }} />
              <Button onClick={() => submit(name)} disabled={loading || !name.trim()}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
