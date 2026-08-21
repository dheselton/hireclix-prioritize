import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const EVENTS = ["task.created","task.claimed","task.status_changed","task.completed","project.go_live_changed","comment.added"];

export default function Integrations() {
  const [hooks, setHooks] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [envs, setEnvs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [name, setName] = useState(""); const [url, setUrl] = useState("");

  const reload = async () => {
    setHooks((await supabase.from("pm_webhooks").select("*").order("created_at",{ascending:false})).data || []);
    setDeliveries((await supabase.from("pm_webhook_deliveries").select("*").order("attempted_at",{ascending:false}).limit(50)).data || []);
    setEnvs((await supabase.from("pm_client_environments").select("*")).data || []);
    setClients((await supabase.from("clients").select("*")).data || []);
  };
  useEffect(() => { reload(); }, []);

  async function createHook() {
    if (!name.trim() || !url.trim()) return;
    await supabase.from("pm_webhooks").insert({ name, target_url: url, events: ["task.created"] } as any);
    setName(""); setUrl(""); reload();
  }
  async function toggleEvent(h: any, ev: string) {
    const has = (h.events || []).includes(ev);
    const events = has ? h.events.filter((e: string) => e !== ev) : [...(h.events || []), ev];
    await supabase.from("pm_webhooks").update({ events }).eq("id", h.id);
    reload();
  }
  async function delHook(id: string) { await supabase.from("pm_webhooks").delete().eq("id", id); reload(); }

  return (
    <div className="page-shell max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold font-unbounded">Integrations</h1>
      <Tabs defaultValue="outbound">
        <div className="tab-strip">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="outbound">Outbound Webhooks</TabsTrigger>
            <TabsTrigger value="deliveries">Delivery Log</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="outbound" className="space-y-4">
          <Card><CardContent className="p-4 flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="flex-[2] min-w-0"><Label>Target URL</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." /></div>
            <Button onClick={createHook} className="shrink-0"><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </CardContent></Card>
          {hooks.map(h => (
            <Card key={h.id}><CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{h.name}</div>
                  <div className="text-xs text-muted-foreground break-all">{h.target_url}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={h.enabled} onCheckedChange={async (v) => { await supabase.from("pm_webhooks").update({ enabled: v }).eq("id", h.id); reload(); }} />
                  <Button size="icon" variant="ghost" onClick={() => delHook(h.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {EVENTS.map(ev => {
                  const on = (h.events || []).includes(ev);
                  return <Badge key={ev} variant={on ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleEvent(h, ev)}>{ev}</Badge>;
                })}
              </div>
            </CardContent></Card>
          ))}
          {!hooks.length && <div className="text-sm text-muted-foreground italic">No webhooks yet.</div>}
        </TabsContent>

        <TabsContent value="deliveries">
          <Card><CardContent className="p-0">
            <div className="touch-scroll-x">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-2">When</th><th className="p-2">Event</th><th className="p-2">Status</th>
                </tr></thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="p-2 text-xs whitespace-nowrap">{new Date(d.attempted_at).toLocaleString()}</td>
                      <td className="p-2"><Badge variant="outline">{d.event}</Badge></td>
                      <td className="p-2 text-xs">{d.response_status ?? "—"}</td>
                    </tr>
                  ))}
                  {!deliveries.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No deliveries yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
