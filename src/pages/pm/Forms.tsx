import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useViewMode } from "@/hooks/useViewMode";
import { fmtDate } from "@/lib/pm/format";
import { CollectionToolbar } from "@/components/pm/CollectionToolbar";
import { useCurrentUser } from "@/lib/pm/mockUser";

export default function Forms() {
  const { role } = useCurrentUser();
  const isSubmitter = role === "submitter";
  const [forms, setForms] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const [mode, setMode] = useViewMode("forms", "grid");

  const reload = async () => {
    const { data } = await supabase.from("pm_forms").select("*")
      .or("kind.is.null,kind.eq.public")
      .order("created_at", { ascending: false });
    setForms(data || []);
  };
  useEffect(() => { reload(); }, []);

  async function create() {
    if (!name.trim()) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const { data, error } = await supabase.from("pm_forms").insert({ name, shareable_slug: slug } as any).select().single();
    if (error) return toast.error(error.message);
    setOpen(false); setName("");
    navigate(`/pm/forms/${data.id}/edit`);
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`);
    toast.success("Link copied");
  }

  function fallbackDescription(name: string): string | null {
    const n = (name ?? "").toLowerCase();
    if (n.includes("web / email") || n.includes("web/email")) return "Use for web page builds, email campaigns, and landing pages";
    if (n.includes("general")) return "Use for print, social, brand, and all other creative requests";
    if (n === "creative request") return "General intake for all creative work requests";
    return null;
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <CollectionToolbar
        title="Forms"
        mode={mode}
        onModeChange={(m) => setMode(m as any)}
        actions={isSubmitter ? null : <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Form</Button>}
      />

      {!forms.length && <div className="text-sm text-muted-foreground italic py-8 text-center">No forms yet.</div>}

      {!!forms.length && mode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {forms.map(f => {
            const desc = f.description || fallbackDescription(f.name);
            return (
              <Card key={f.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{f.name}</div>
                    <Badge variant="outline">{(f.submit_action?.creates) || "task"}</Badge>
                  </div>
                  {desc && <div className="text-xs text-muted-foreground leading-snug">{desc}</div>}
                  <div className="text-xs text-muted-foreground break-all">/f/{f.shareable_slug}</div>
                  <div className="flex gap-2">
                    {!isSubmitter && <Button asChild size="sm" variant="outline"><Link to={`/pm/forms/${f.id}/edit`}>Edit</Link></Button>}
                    <Button size="sm" variant="ghost" onClick={() => copyLink(f.shareable_slug)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy link
                    </Button>
                    <Button asChild size="sm" variant="ghost"><a href={`/f/${f.shareable_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!!forms.length && mode === "list" && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-left">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium hidden md:table-cell">Slug</th>
                <th className="p-3 font-medium">Creates</th>
                <th className="p-3 font-medium hidden md:table-cell">Created</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(f => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="p-3">{isSubmitter ? <span className="font-medium">{f.name}</span> : <Link to={`/pm/forms/${f.id}/edit`} className="font-medium hover:underline">{f.name}</Link>}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">/f/{f.shareable_slug}</td>
                  <td className="p-3"><Badge variant="outline">{(f.submit_action?.creates) || "task"}</Badge></td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{fmtDate(f.created_at?.slice(0,10))}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => copyLink(f.shareable_slug)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button asChild size="sm" variant="ghost"><a href={`/f/${f.shareable_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Form</DialogTitle></DialogHeader>
          <Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Quick Creative Request" />
          <DialogFooter><Button onClick={create}>Create & open builder</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
