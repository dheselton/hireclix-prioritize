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

export default function Forms() {
  const [forms, setForms] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const reload = async () => {
    const { data } = await supabase.from("pm_forms").select("*").order("created_at", { ascending: false });
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-unbounded">Forms</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Form</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {forms.map(f => (
          <Card key={f.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{f.name}</div>
                <Badge variant="outline">{(f.submit_action?.creates) || "task"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground break-all">/f/{f.shareable_slug}</div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline"><Link to={`/pm/forms/${f.id}/edit`}>Edit</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/f/${f.shareable_slug}`); toast.success("Link copied"); }}>
                  <Copy className="h-3 w-3 mr-1" /> Copy link
                </Button>
                <Button asChild size="sm" variant="ghost"><a href={`/f/${f.shareable_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!forms.length && <div className="text-sm text-muted-foreground italic col-span-full">No forms yet.</div>}
      </div>
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
