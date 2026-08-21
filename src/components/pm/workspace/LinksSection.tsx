import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Trash2, Plus } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { getLinkProvider, hostnameOf } from "@/lib/pm/linkProvider";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";

interface TaskLink {
  id: string;
  task_id: string;
  url: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

export function LinksSection({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskLink[]>([]);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const { user, roles } = useCurrentUser();
  const [pendingDelete, setPendingDelete] = useState<TaskLink | null>(null);

  async function load() {
    const { data } = await supabase.from("pm_task_links").select("*").eq("task_id", taskId).order("created_at");
    setItems((data || []) as TaskLink[]);
  }
  useEffect(() => { load(); }, [taskId]);

  async function add() {
    if (!url.trim()) return;
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    const { error } = await supabase.from("pm_task_links").insert({
      task_id: taskId, url: normalized, label: label.trim() || null, created_by: user?.id ?? null,
    } as any);
    if (error) { toast.error(error.message); return; }
    setUrl(""); setLabel(""); setAdding(false);
    await load();
  }

  async function remove(id: string) {
    try {
      const { error } = await supabase.from("pm_task_links").delete().eq("id", id);
      if (error) throw error;
      await load();
      toast.success("Link removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove link");
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Reference Links
        </h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(s => !s)}>
          <Plus className="h-3 w-3 mr-1" /> Add link
        </Button>
      </div>

      {adding && (
        <div className="mb-2 p-2 border border-border rounded-lg bg-muted/30 space-y-2">
          <Input placeholder="https://figma.com/…" value={url} onChange={e => setUrl(e.target.value)} className="h-8" autoFocus />
          <Input placeholder="Label (optional, e.g. Figma file)" value={label} onChange={e => setLabel(e.target.value)} className="h-8" />
          <div className="flex gap-2">
            <Button size="sm" onClick={add}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setUrl(""); setLabel(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {items.map(l => {
          const p = getLinkProvider(l.url);
          const canDelete = roles.includes("pm") || (!!user && l.created_by === user.id);
          return (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-2 py-2 rounded-md border border-border bg-card hover:border-primary transition"
            >
              <span
                className="h-8 w-8 rounded-md flex items-center justify-center font-semibold text-sm shrink-0"
                style={{ backgroundColor: p.bg, color: p.fg }}
                aria-label={p.label}
              >
                {p.initial}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.label || p.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{hostnameOf(l.url)}{l.url.replace(/^https?:\/\/[^/]+/, "")}</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {canDelete && (
                <button
                  type="button"
                  className="touch-action text-destructive shrink-0"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setPendingDelete(l); }}
                  aria-label="Remove link"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </a>
          );
        })}
        {!items.length && !adding && (
          <div className="text-xs text-muted-foreground italic py-2">No links yet. Add Figma files, GitHub PRs, Loom recordings, Docs…</div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={o => { if (!o) setPendingDelete(null); }}
        title="Delete link?"
        description="Delete link? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => { if (pendingDelete) await remove(pendingDelete.id); setPendingDelete(null); }}
      />
    </section>
  );
}
