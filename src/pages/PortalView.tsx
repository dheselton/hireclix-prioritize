/**
 * PORTAL-4 — the public, token-authenticated client portal at `/portal/:token`.
 *
 * Deliberately standalone: no AppLayout, no sidebar, no session. All data comes
 * from the `portal-api` edge function keyed by the URL token.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Paperclip, Send, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { fmtDate } from "@/lib/pm/format";
import {
  portalBootstrap,
  portalPostMessage,
  portalProject,
  portalSignedUrl,
  portalUpload,
  type PortalAccessInfo,
  type PortalMsg,
  type PortalPhase,
  type PortalProjectSummary,
  type PortalTask,
} from "@/lib/pm/portalClient";

const DONE = new Set(["complete", "approved"]);

function StatusChip({ status }: { status: string }) {
  const done = DONE.has(status);
  const active = status === "in_progress" || status === "in_review";
  return (
    <Badge
      variant="outline"
      className={
        done
          ? "border-success/40 bg-success/10 text-success"
          : active
            ? "border-info/40 bg-info/10 text-info"
            : "text-muted-foreground"
      }
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function PortalView() {
  const { token = "" } = useParams();
  const [access, setAccess] = useState<PortalAccessInfo | null>(null);
  const [projects, setProjects] = useState<PortalProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    portalBootstrap(token)
      .then(res => {
        if (cancelled) return;
        setAccess(res.access);
        setProjects(res.projects);
        setError(null);
      })
      .catch(e => !cancelled && setError(String(e.message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <Shell>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-28 w-full" />
        <Skeleton className="mt-3 h-28 w-full" />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <div className="text-lg font-semibold">This portal link isn't valid</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              The link may have been revoked or mistyped. Reach out to your HireClix project manager for a fresh
              invite.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (openId) {
    return <ProjectPane token={token} projectId={openId} onBack={() => setOpenId(null)} />;
  }

  return (
    <Shell client={access?.clientName} email={access?.email}>
      <h1 className="text-2xl font-semibold tracking-tight">Your projects</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live status straight from the HireClix team. Open a project to see progress and send us a message.
      </p>

      {projects.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No projects are shared with you yet.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {projects.map(p => {
            const pct = p.counts.total ? Math.round((p.counts.done / p.counts.total) * 100) : 0;
            return (
              <Card
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(p.id)}
                onKeyDown={e => e.key === "Enter" && setOpenId(p.id)}
                className="cursor-pointer transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.go_live_date ? `Go live ${fmtDate(p.go_live_date)}` : "No go-live date set"}
                      </div>
                    </div>
                    <StatusChip status={p.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {p.counts.done}/{p.counts.total} done
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, client, email }: { children: React.ReactNode; client?: string | null; email?: string }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-3 sm:px-4 py-3 sm:py-4 safe-top">
          <div className="font-semibold tracking-tight">HireClix Prioritize</div>
          <div className="text-right text-xs text-muted-foreground">
            {client && <div className="font-medium text-foreground">{client}</div>}
            {email}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-3 sm:px-4 py-4 sm:py-8 safe-bottom">{children}</main>
    </div>
  );
}

function ProjectPane({ token, projectId, onBack }: { token: string; projectId: string; onBack: () => void }) {
  const [data, setData] = useState<{
    project: Record<string, any>;
    phases: PortalPhase[];
    tasks: PortalTask[];
    messages: PortalMsg[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    portalProject(token, projectId)
      .then(setData)
      .catch(e => toast.error(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const byPhase = new Map<string, PortalTask[]>();
    for (const t of data.tasks) {
      const key = t.phase_id ?? "none";
      byPhase.set(key, [...(byPhase.get(key) ?? []), t]);
    }
    const out = data.phases
      .filter(ph => byPhase.has(ph.id))
      .map(ph => ({ name: ph.name, tasks: byPhase.get(ph.id)! }));
    if (byPhase.has("none")) out.push({ name: "Other work", tasks: byPhase.get("none")! });
    return out;
  }, [data]);

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const uploaded = [];
      for (const f of files) {
        try {
          uploaded.push(await portalUpload(token, projectId, f));
        } catch {
          toast.warning(`Couldn't attach ${f.name}`);
        }
      }
      const res = await portalPostMessage(token, projectId, body.trim(), uploaded);
      setData(d => (d ? { ...d, messages: [...d.messages, res.message] } : d));
      setBody("");
      setFiles([]);
      toast.success("Message sent");
    } catch (e: any) {
      toast.error(String(e.message ?? e));
    }
    setSending(false);
  }

  async function openAttachment(path: string) {
    const url = await portalSignedUrl(token, path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Couldn't open that file");
  }

  return (
    <Shell>
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> All projects
      </Button>

      {loading || !data ? (
        <>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-4 h-40 w-full" />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{data.project.title}</h1>
            <StatusChip status={data.project.status} />
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {data.project.go_live_date ? `Target go live ${fmtDate(data.project.go_live_date)}` : "Timeline TBD"}
          </div>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Progress</h2>
          <div className="mt-3 space-y-5">
            {grouped.map(g => (
              <div key={g.name}>
                <div className="mb-2 text-sm font-medium">{g.name}</div>
                <Card>
                  <CardContent className="divide-y p-0">
                    {g.tasks.map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${DONE.has(t.status) ? "text-success" : "text-muted-foreground/40"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-sm ${DONE.has(t.status) ? "text-muted-foreground line-through" : ""}`}>
                            {t.title}
                          </div>
                          {t.due_date && (
                            <div className="text-xs text-muted-foreground">Due {fmtDate(t.due_date)}</div>
                          )}
                        </div>
                        {t.needs_client_update && (
                          <Badge className="bg-warning/15 text-warning" variant="outline">Needs your input</Badge>
                        )}
                        <StatusChip status={t.status} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
            {grouped.length === 0 && (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No work items yet.</CardContent></Card>
            )}
          </div>

          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Messages</h2>
          <Card className="mt-3">
            <CardContent className="space-y-4 p-4">
              {data.messages.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No messages yet — say hello or ask a question below.
                </p>
              )}
              {data.messages.map(m => {
                const mine = !!m.author_portal_id;
                return (
                  <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                        <span className="font-medium">{m.author_name}</span>
                        <span>{fmtDate(m.created_at)}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      {m.attachments?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.attachments.map(a => (
                            <button
                              key={a.path}
                              onClick={() => openAttachment(a.path)}
                              className="inline-flex items-center gap-1 rounded border border-current/30 px-2 py-0.5 text-xs underline-offset-2 hover:underline"
                            >
                              <Paperclip className="h-3 w-3" /> {a.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="border-t pt-3">
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write a message to the HireClix team…"
                  rows={3}
                />
                {files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {files.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                        {f.name}
                        <button onClick={() => setFiles(prev => prev.filter((_, x) => x !== i))} aria-label={`Remove ${f.name}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="mr-1.5 h-4 w-4" /> Attach
                  </Button>
                  <Button size="sm" onClick={send} disabled={!body.trim() || sending}>
                    {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </Shell>
  );
}
