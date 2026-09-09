import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateProject } from "@/lib/pm/api";
import { useClientBrandMap } from "@/lib/pm/clients";
import { ClientLogo } from "@/components/pm/client/ClientLogo";
import type { PmProject } from "@/types/pm";

export function ClientCard({ project, onChange }: { project: PmProject & { client_contact_name?: string | null; client_contact_email?: string | null }; onChange: () => void }) {
  const [clientName, setClientName] = useState<string>("");
  const [name, setName] = useState(project.client_contact_name ?? "");
  const [email, setEmail] = useState(project.client_contact_email ?? "");
  const brands = useClientBrandMap();
  const logoUrl = project.client_id ? brands.get(project.client_id)?.logoUrl ?? null : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!project.client_id) { setClientName(""); return; }
      const { data } = await supabase.from("clients").select("name").eq("id", project.client_id).maybeSingle();
      if (!cancelled) setClientName(data?.name ?? "");
    })();
    return () => { cancelled = true; };
  }, [project.client_id]);

  async function save(patch: Partial<PmProject>) {
    await updateProject(project.id, patch);
    onChange();
  }

  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="text-xs uppercase text-muted-foreground mb-1">Client</div>
      <div className="flex items-center gap-2 min-w-0">
        {clientName ? (
          <ClientLogo name={clientName} logoUrl={logoUrl} size="xs" />
        ) : null}
        <div className="text-sm font-medium truncate">
          {clientName || <span className="text-muted-foreground italic">No client linked</span>}
        </div>
      </div>
      <div className="space-y-1.5 pt-1">
        <div>
          <label className="text-[11px] text-muted-foreground">Primary contact</label>
          <Input className="h-8" value={name} onChange={e => setName(e.target.value)} onBlur={() => save({ client_contact_name: name } as any)} placeholder="Name" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Contact email</label>
          <Input className="h-8" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => save({ client_contact_email: email } as any)} placeholder="name@example.com" />
        </div>
      </div>
    </CardContent></Card>
  );
}
