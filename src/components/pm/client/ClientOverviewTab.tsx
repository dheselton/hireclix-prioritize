import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CalendarClock, Clock, FolderKanban, Hand, Link2, ListTodo, Mail } from "lucide-react";
import { clientWorkLink } from "@/lib/pm/links";
import { fmtDate } from "@/lib/pm/format";
import type { ClientContact, ClientProjectRow, ClientStats } from "@/lib/pm/clientHub";
import { cn } from "@/lib/utils";

interface Props {
  clientId: string;
  stats: ClientStats | null;
  projects: ClientProjectRow[];
  contacts: ClientContact[];
  loading: boolean;
  error: string | null;
  onOpenPortal: () => void;
}

function StatTile({
  to, label, value, icon: Icon, tone, onClick, hint,
}: {
  to?: string;
  label: string;
  value: string | number;
  icon: any;
  tone?: "warning" | "info" | "default";
  onClick?: () => void;
  hint?: string;
}) {
  const zero = value === 0 || value === "0";
  const body = (
    <Card
      className={cn(
        "p-3 h-full transition-colors",
        zero ? "opacity-60" : "hover:border-primary/50",
        !zero && tone === "warning" && "border-warning/40",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", !zero && tone === "warning" && "text-warning")} />
        {label}
      </div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", !zero && tone === "warning" && "text-warning")}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );

  if (zero) return body;
  if (onClick) return <button type="button" onClick={onClick} className="text-left">{body}</button>;
  if (to) return <Link to={to}>{body}</Link>;
  return body;
}

export function ClientOverviewTab({ clientId, stats, projects, contacts, loading, error, onOpenPortal }: Props) {
  if (loading) {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[74px]" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4 border-destructive/40">
        <p className="text-sm text-destructive">Couldn't load this client's activity.</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </Card>
    );
  }

  if (!stats) return null;

  const recent = projects.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
        <StatTile
          label="Active projects"
          value={stats.activeProjects}
          icon={FolderKanban}
          to={clientWorkLink(clientId)}
          hint={`${stats.totalProjects} total`}
        />
        <StatTile label="Open tasks" value={stats.openTasks} icon={ListTodo} to={clientWorkLink(clientId)} />
        <StatTile
          label="Overdue"
          value={stats.overdueTasks}
          icon={AlertTriangle}
          tone="warning"
          to={clientWorkLink(clientId, ["overdue"])}
        />
        <StatTile
          label="Unclaimed requests"
          value={stats.unclaimedTasks}
          icon={Hand}
          tone="warning"
          to={clientWorkLink(clientId, ["unclaimed"])}
        />
        <StatTile label="Hours logged (30d)" value={stats.hours30d} icon={Clock} to="/pm/time" />
        <StatTile label="Portal invites" value={stats.portalInvites} icon={Link2} onClick={onOpenPortal} />
      </div>

      {stats.nextGoLive && (
        <Card className="p-3 flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4 text-info" />
          Next go-live <span className="font-medium">{fmtDate(stats.nextGoLive)}</span>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Recent projects</h2>
        {recent.length === 0 && <p className="text-sm text-muted-foreground">No projects for this client yet.</p>}
        {recent.map(p => (
          <Link key={p.id} to={`/pm/projects/${p.id}`}>
            <Card className="p-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{p.title}</span>
                <Badge variant="outline" className="capitalize">{p.status.replace(/_/g, " ")}</Badge>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {p.go_live_date ? `Go-live ${fmtDate(p.go_live_date)}` : "No go-live date"}
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Key contacts</h2>
        {contacts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No contacts recorded. Contacts come from each project's client contact fields.
          </p>
        )}
        {contacts.map(c => (
          <Card key={`${c.projectId}-${c.name}`} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground truncate">via {c.projectTitle}</div>
            </div>
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="text-xs text-primary inline-flex items-center gap-1 shrink-0 hover:underline"
              >
                <Mail className="h-3.5 w-3.5" /> {c.email}
              </a>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
