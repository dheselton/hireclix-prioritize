import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, Check } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import {
  useActivityDigest, groupByProject, fmtRelative, DIGEST_FILTERS,
  type DigestFilter,
} from "@/lib/pm/digest";
import { cn } from "@/lib/utils";

const MAX_PER_GROUP = 5;

export function ActivityDigest({ userId }: { userId: string }) {
  const { events, projectNames, clientNames, since, loading, markSeen } = useActivityDigest(userId);
  const users = useMockUsers();
  const [filter, setFilter] = useState<DigestFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const userNames = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter(e => e.categories.includes(filter))),
    [events, filter],
  );
  const groups = useMemo(() => groupByProject(filtered), [filtered]);

  const counts = useMemo(() => {
    const c: Record<DigestFilter, number> = { all: events.length, mentions: 0, due: 0, blocked: 0, files: 0 };
    for (const e of events) for (const cat of e.categories) c[cat] += 1;
    return c;
  }, [events]);

  const sinceLabel = new Date(since).toLocaleString(undefined, {
    month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Since you last checked
            </h2>
            <p className="text-xs text-muted-foreground">Updates on your work since {sinceLabel}</p>
          </div>
          {events.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markSeen}>
              <Check className="h-3.5 w-3.5 mr-1" /> Mark as seen
            </Button>
          )}
        </div>

        {events.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {DIGEST_FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                disabled={counts[f.id] === 0 && f.id !== "all"}
                className={cn(
                  "h-7 px-2.5 rounded-full border text-xs transition disabled:opacity-40 disabled:cursor-not-allowed",
                  f.id === filter
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                <span className="ml-1 tabular-nums">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You're all caught up. <span className="text-xs">Last checked {sinceLabel}.</span>
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map(({ projectId, events: rows }) => {
              const key = projectId ?? "none";
              const isOpen = expanded.has(key);
              const shown = isOpen ? rows : rows.slice(0, MAX_PER_GROUP);
              const rest = rows.length - shown.length;
              return (
                <div key={key} className="space-y-1">
                  <div className="text-xs font-medium flex items-center gap-2">
                    {projectId ? (
                      <Link to={`/pm/projects/${projectId}`} className="hover:underline">
                        {projectNames.get(projectId) ?? "Project"}
                      </Link>
                    ) : (
                      <span>Other</span>
                    )}
                    {projectId && clientNames.get(projectId) && (
                      <span className="text-muted-foreground font-normal">{clientNames.get(projectId)}</span>
                    )}
                  </div>

                  {shown.map(e => (
                    <div key={e.id} className="flex items-start gap-2 text-xs pl-0.5">
                      <UserAvatar userId={e.actorId} size="xs" className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium">{(e.actorId && userNames.get(e.actorId)) || "Someone"}</span>{" "}
                        <span className="text-muted-foreground">{e.verb}</span>{" "}
                        {e.objectHref ? (
                          <Link to={e.objectHref} className="hover:underline font-medium break-words">{e.objectLabel}</Link>
                        ) : (
                          <span className="font-medium">{e.objectLabel}</span>
                        )}
                        <span className="text-muted-foreground"> · {fmtRelative(e.at)}</span>
                        {e.detail && (
                          <div className="text-muted-foreground/80 truncate">{e.detail}</div>
                        )}
                      </div>
                    </div>
                  ))}

                  {rest > 0 && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline pl-7"
                      onClick={() => setExpanded(prev => new Set(prev).add(key))}
                    >
                      and {rest} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
