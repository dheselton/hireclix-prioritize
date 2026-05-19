import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "@/components/pm/drawer/SectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Trash2, Plus, Link as LinkIcon } from "lucide-react";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { toast } from "sonner";

interface TaskLink {
  id: string;
  task_id: string;
  url: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

function favicon(url: string) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch { return null; }
}
function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function LinksSection({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskLink[]>([]);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const { user } = useCurrentUser();

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
    await supabase.from("pm_task_links").delete().eq("id", id);
    await load();
  }

  return (
    <SectionShell
      title="Links"
      badge={<Badge variant="secondary" className="ml-1">{items.length}</Badge>}
      right={
        <Button size="sm" variant="ghost" onClick={() => setAdding(s => !s)}>
          <Plus className="h-3 w-3 mr-1" /> Add link
        </Button>
      }
    >
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

      <div className="space-y-1">
        {items.map(l => {
          const fav = favicon(l.url);
          return (
            <div key={l.id} className="group flex items-center gap-3 px-2 py-2 rounded hover:bg-muted/40 border border-transparent hover:border-border">
              {fav ? (
                <img src={fav} alt="" className="h-5 w-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <LinkIcon className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.label || hostname(l.url)}</div>
                <div className="text-[11px] text-muted-foreground truncate">{l.url}</div>
              </div>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="ghost" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
              </a>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => remove(l.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {!items.length && !adding && (
          <div className="text-xs text-muted-foreground italic py-2">No links yet. Add Figma files, GitHub PRs, Loom recordings, Docs…</div>
        )}
      </div>
    </SectionShell>
  );
}
