import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Headphones,
  CheckCircle2,
  RotateCcw,
  Plus,
  Send,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/pm/StatusPill";
import { useMockUsers } from "@/lib/pm/mockUser";
import { fmtDate, fmtDateShort, todayISO } from "@/lib/pm/format";
import { useProjectsQuery } from "@/lib/pm/queries";
import {
  addAffectedSites,
  daysWaiting,
  isFollowUpDue,
  isLinkedTaskDone,
  logTouchpoint,
  reopenEscalation,
  resolveEscalation,
  updateEscalation,
  useEscalation,
  type EscalationSeverity,
  type TouchpointChannel,
  type TouchpointDirection,
  TOUCHPOINT_CHANNELS,
} from "@/lib/pm/vendors";
import { cn } from "@/lib/utils";

interface Props {
  escalationId: string | null;
  onOpenChange: (v: boolean) => void;
}

const SEVERITY_STYLE: Record<EscalationSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/15 text-info border-info/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function VendorEscalationDrawer({ escalationId, onOpenChange }: Props) {
  const open = !!escalationId;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const users = useMockUsers();
  const { data: escalation, refetch } = useEscalation(escalationId);
  const projectsQuery = useProjectsQuery();

  const [direction, setDirection] = useState<TouchpointDirection>("outbound");
  const [channel, setChannel] = useState<TouchpointChannel>("email");
  const [summary, setSummary] = useState("");
  const [logging, setLogging] = useState(false);

  const [sitesOpen, setSitesOpen] = useState(false);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [addingSites, setAddingSites] = useState(false);

  const [vendorRefDraft, setVendorRefDraft] = useState("");

  useEffect(() => {
    setVendorRefDraft(escalation?.vendor_ref ?? "");
  }, [escalation?.id, escalation?.vendor_ref]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pm-vendor-escalation", escalationId] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-escalations"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-escalation-for-task"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-blocked-task-ids"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-scorecards"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-follow-ups-due"] });
    void refetch();
  };

  const linkedIds = useMemo(
    () => new Set(escalation?.linkedTasks.map((t) => t.projectId) ?? []),
    [escalation],
  );

  const siteOptions = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    return projects
      .filter((p) => !linkedIds.has(p.id))
      .map((p) => ({
        id: p.id,
        title: p.title,
        clientId: p.client_id,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 200);
  }, [projectsQuery.data, linkedIds]);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const handleLog = async () => {
    if (!escalation || !summary.trim()) return;
    setLogging(true);
    try {
      await logTouchpoint({
        escalationId: escalation.id,
        direction,
        channel,
        summary: summary.trim(),
      });
      setSummary("");
      invalidate();
      toast.success(direction === "outbound" ? "Outbound contact logged" : "Vendor reply logged");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to log touchpoint");
    } finally {
      setLogging(false);
    }
  };

  const handleResolve = async (unresolved = false) => {
    if (!escalation) return;
    try {
      await resolveEscalation(escalation.id, {
        unresolved,
        advanceLinkedTasks: !unresolved,
      });
      invalidate();
      toast.success(unresolved ? "Closed unresolved" : "Escalation resolved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to resolve");
    }
  };

  const handleReopen = async () => {
    if (!escalation) return;
    try {
      await reopenEscalation(escalation.id);
      invalidate();
      toast.success("Escalation reopened");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reopen");
    }
  };

  const saveVendorRef = async () => {
    if (!escalation) return;
    const next = vendorRefDraft.trim() || null;
    if (next === (escalation.vendor_ref ?? null)) return;
    try {
      await updateEscalation(escalation.id, { vendor_ref: next });
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save case #");
    }
  };

  const handleAddSites = async () => {
    if (!escalation || !selectedSites.size) return;
    setAddingSites(true);
    try {
      const sites = siteOptions
        .filter((s) => selectedSites.has(s.id))
        .map((s) => ({ projectId: s.id, projectTitle: s.title }));
      await addAffectedSites(escalation.id, sites);
      setSelectedSites(new Set());
      setSitesOpen(false);
      invalidate();
      toast.success(`Added ${sites.length} site${sites.length === 1 ? "" : "s"}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add sites");
    } finally {
      setAddingSites(false);
    }
  };

  const isOpen =
    escalation &&
    (escalation.status === "awaiting_vendor" || escalation.status === "awaiting_us");
  const followUpDue = escalation ? isFollowUpDue(escalation) : false;
  const waiting = escalation ? daysWaiting(escalation) : 0;
  const touchpoints = escalation?.touchpoints ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-amber-600" />
              Vendor escalation
            </SheetTitle>
          </SheetHeader>

          {!escalation ? (
            <div className="text-sm text-muted-foreground py-6">Loading…</div>
          ) : (
            <div className="space-y-5 mt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-medium">{escalation.title}</h3>
                  <span
                    className={
                      "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border " +
                      SEVERITY_STYLE[escalation.severity]
                    }
                  >
                    {escalation.severity}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border",
                      escalation.status === "awaiting_vendor" &&
                        "bg-amber-500/15 text-amber-800 border-amber-500/30",
                      escalation.status === "awaiting_us" &&
                        "bg-info/15 text-info border-info/30",
                      escalation.status === "resolved" &&
                        "bg-success/15 text-success border-success/30",
                      escalation.status === "closed_unresolved" &&
                        "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {escalation.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">{escalation.vendor.name}</span>
                  {" · "}
                  open {fmtDateShort(escalation.opened_at)} ({waiting}d)
                  {escalation.next_follow_up_on && (
                    <>
                      {" · "}
                      follow-up{" "}
                      <span className={followUpDue ? "text-destructive font-medium" : ""}>
                        {fmtDateShort(escalation.next_follow_up_on)}
                        {followUpDue ? " due" : ""}
                      </span>
                    </>
                  )}
                  {escalation.chaseCount > 0 && (
                    <> · {escalation.chaseCount} chase{escalation.chaseCount === 1 ? "" : "s"}</>
                  )}
                </div>
                {escalation.description && (
                  <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">
                    {escalation.description}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Vendor case / ticket #</Label>
                <Input
                  className="h-8 text-xs"
                  value={vendorRefDraft}
                  onChange={(e) => setVendorRefDraft(e.target.value)}
                  onBlur={saveVendorRef}
                  placeholder="e.g. WF-12345"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {isOpen ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleResolve(false)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleResolve(true)}>
                      Close unresolved
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleReopen}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reopen
                  </Button>
                )}
              </div>

              {/* Linked client tickets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Affected sites ({escalation.linkedTasks.length})
                  </h4>
                  {isOpen && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setSitesOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add site
                    </Button>
                  )}
                </div>
                {escalation.linkedTasks.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No client tickets linked yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {escalation.linkedTasks.map((t) => (
                      <li key={t.taskId}>
                        <button
                          type="button"
                          className="w-full text-left rounded-md border border-border px-2.5 py-2 hover:bg-accent/50 transition-colors"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/pm/tasks/${t.taskId}`);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-medium truncate">
                              {t.clientName ?? t.projectTitle}
                            </span>
                            <StatusPill status={t.status} />
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t.taskTitle}
                            {isLinkedTaskDone(t) ? " · done" : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Log contact */}
              {isOpen && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Log contact
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={direction}
                      onValueChange={(v) => setDirection(v as TouchpointDirection)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-popover">
                        <SelectItem value="outbound" className="text-xs">
                          We contacted them
                        </SelectItem>
                        <SelectItem value="inbound" className="text-xs">
                          They replied
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={channel}
                      onValueChange={(v) => setChannel(v as TouchpointChannel)}
                    >
                      <SelectTrigger className="h-8 text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-popover">
                        {TOUCHPOINT_CHANNELS.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs capitalize">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    rows={2}
                    className="text-xs"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder={
                      direction === "outbound"
                        ? "What did you ask / send?"
                        : "What did they say / promise?"
                    }
                  />
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={logging || !summary.trim()}
                    onClick={handleLog}
                  >
                    {direction === "outbound" ? (
                      <Send className="h-3.5 w-3.5" />
                    ) : (
                      <Inbox className="h-3.5 w-3.5" />
                    )}
                    {logging ? "Saving…" : "Log touchpoint"}
                  </Button>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Touchpoint timeline
                </h4>
                {touchpoints.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    No contacts logged yet. Log outbound when you email them so the follow-up
                    clock starts.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {[...touchpoints]
                      .sort(
                        (a, b) =>
                          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
                      )
                      .map((tp) => {
                        const who = tp.logged_by ? userById.get(tp.logged_by)?.name : null;
                        return (
                          <li
                            key={tp.id}
                            className="rounded-md border border-border px-2.5 py-2 text-[12px]"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide",
                                  tp.direction === "outbound"
                                    ? "bg-amber-500/15 text-amber-800"
                                    : "bg-success/15 text-success",
                                )}
                              >
                                {tp.direction}
                              </span>
                              <span className="text-muted-foreground capitalize">{tp.channel}</span>
                              <span className="text-muted-foreground">
                                {fmtDate(tp.occurred_at.slice(0, 10))}
                              </span>
                              {who && <span className="text-muted-foreground">· {who}</span>}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap">{tp.summary}</p>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={sitesOpen} onOpenChange={setSitesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add affected sites</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
            {siteOptions.length === 0 ? (
              <p className="text-[12px] text-muted-foreground p-2">No more projects to add.</p>
            ) : (
              siteOptions.map((s) => {
                const on = selectedSites.has(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-[12px]"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        setSelectedSites((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                    />
                    <span className="truncate">{s.title}</span>
                  </label>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Creates a blocked ticket under each selected project and links it here. Today:{" "}
            {todayISO()}
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSitesOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={addingSites || !selectedSites.size}
              onClick={handleAddSites}
            >
              {addingSites ? "Adding…" : `Add ${selectedSites.size || ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
