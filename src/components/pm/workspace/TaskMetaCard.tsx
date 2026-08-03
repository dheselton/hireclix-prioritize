import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, FolderKanban, Tag, Layers, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkTypeBadge } from "@/components/pm/WorkTypeBadge";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { useInternalClientIds, isCareerSiteRequest } from "@/lib/pm/clients";
import { clientTag } from "@/lib/pm/tags";

interface Props {
  projectId: string;
  phaseName?: string | null;
}

interface Meta {
  title: string | null;
  work_type: string | null;
  custom_fields: any;
  client_id: string | null;
  requested_by: string | null;
  client_name: string | null;
}

function prettyType(v?: string | null) {
  if (!v) return null;
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Row({
  icon: Icon, label, children,
}: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </div>
        <div className="text-sm text-foreground mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}

export function TaskMetaCard({ projectId, phaseName }: Props) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const users = useMockUsers();
  const internalClients = useInternalClientIds();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pm_projects")
        .select("title, work_type, custom_fields, client_id, requested_by, clients(name)")
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled || !data) return;
      const d: any = data;
      setMeta({
        title: d.title ?? null,
        work_type: d.work_type ?? null,
        custom_fields: d.custom_fields ?? {},
        client_id: d.client_id ?? null,
        requested_by: d.requested_by ?? null,
        client_name: d.clients?.name ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (!meta) return null;

  const requestType = meta.work_type === "request"
    ? prettyType(meta.custom_fields?.request_type)
    : null;
  const isInternal = !!meta.client_id && internalClients.has(meta.client_id);
  const requester = users.find((u) => u.id === meta.requested_by);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">
        At a glance
      </div>
      <div className="divide-y divide-border/60">
        {meta.client_name && (
          <Row icon={Building2} label="Client">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/pm/work?tags=${encodeURIComponent(clientTag(meta.client_name) ?? "")}`}
                className="font-medium hover:underline truncate"
              >
                {meta.client_name}
              </Link>
              {isInternal && <span className="internal-pill shrink-0">Internal</span>}
            </div>
          </Row>
        )}
        {meta.title && (
          <Row icon={FolderKanban} label="Project">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/pm/projects/${projectId}`}
                className="hover:underline truncate"
              >
                {meta.title}
              </Link>
              <WorkTypeBadge workType={(meta.work_type as any) ?? "project"} compact />
            </div>
          </Row>
        )}
        {requestType && (
          <Row icon={Tag} label="Request type">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex text-[11px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {requestType}
              </span>
              {isCareerSiteRequest(meta.custom_fields) && (
                <span className="careersite-pill">Career Site</span>
              )}
            </div>
          </Row>
        )}
        {phaseName && (
          <Row icon={Layers} label="Phase">
            <span>{phaseName}</span>
          </Row>
        )}
        {requester && (
          <Row icon={UserCheck} label="Requested by">
            <div className="flex items-center gap-2">
              <UserAvatar userId={requester.id} size="xs" />
              <span className="truncate">{requester.name}</span>
            </div>
          </Row>
        )}
      </div>
    </div>
  );
}
