import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Rocket } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_TYPES } from "@/types/pm";
import { TimelineSetupWizard } from "@/components/pm/TimelineSetupWizard";

export default function Templates() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [type, setType] = useState("career_site");
  const [wizardId, setWizardId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  const reload = async () => {
    const { data } = await supabase.from("pm_project_templates").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (params.get("new") === "1") {
      setOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  async function create() {
    const { data } = await supabase.from("pm_project_templates").insert({ name, type } as any).select().single();
    setOpen(false); setName("");
    if (data) window.location.href = `/pm/templates/${data.id}/edit`;
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-unbounded">Project Templates</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(t => (
          <Card key={t.id}>
            <CardContent className="p-4 space-y-2">
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.type}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setWizardId(t.id)}><Rocket className="h-3 w-3 mr-1" /> Use</Button>
                <Button asChild size="sm" variant="outline"><Link to={`/pm/templates/${t.id}/edit`}>Edit</Link></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!items.length && <div className="text-sm text-muted-foreground italic col-span-full">No templates yet.</div>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} />
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter><Button onClick={create} disabled={!name.trim()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <TimelineSetupWizard templateId={wizardId} open={!!wizardId} onOpenChange={(v) => !v && setWizardId(null)} />
    </div>
  );
}
