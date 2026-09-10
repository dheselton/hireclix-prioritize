import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Headphones, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentUserId } from "@/lib/pm/mockUser";
import { fmtDateShort, todayISO } from "@/lib/pm/format";
import { cn } from "@/lib/utils";
import { VendorEscalationDrawer } from "@/components/pm/vendors/VendorEscalationDrawer";
import {
  createEscalation,
  daysWaiting,
  ESCALATION_CATEGORIES,
  isEscalationOpen,
  isFollowUpDue,
  isResolveBreached,
  isResponseBreached,
  upsertVendor,
  useEscalations,
  useVendorScorecards,
  useVendors,
  VENDOR_CATEGORIES,
  type EscalationCategory,
  type EscalationSeverity,
  type EscalationWithRollup,
  type PmVendor,
  type VendorCategory,
  type VendorScorecard,
} from "@/lib/pm/vendors";

type EscalationGroup =
  | "follow_up_due"
  | "awaiting_vendor"
  | "awaiting_us"
  | "resolved";

const GROUP_ORDER: { id: EscalationGroup; label: string }[] = [
  { id: "follow_up_due", label: "Follow-up due" },
  { id: "awaiting_vendor", label: "Awaiting vendor" },
  { id: "awaiting_us", label: "Awaiting us" },
  { id: "resolved", label: "Recently resolved" },
];

function groupEscalation(e: EscalationWithRollup, today: string): EscalationGroup {
  if (!isEscalationOpen(e.status)) return "resolved";
  if (isFollowUpDue(e, today)) return "follow_up_due";
  if (e.status === "awaiting_us") return "awaiting_us";
  return "awaiting_vendor";
}

export default function Vendors() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("escalations");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [includeResolved, setIncludeResolved] = useState(true);

  const { data: escalations = [], isLoading: escLoading } = useEscalations({
    includeResolved,
  });
  const { data: scorecards = [], isLoading: scoreLoading } = useVendorScorecards();
  const { data: vendors = [] } = useVendors();

  // Deep-link ?escalation=
  useEffect(() => {
    const id = params.get("escalation");
    if (id) {
      setDrawerId(id);
      setTab("escalations");
    }
  }, [params]);

  const today = todayISO();
  const grouped = useMemo(() => {
    const map: Record<EscalationGroup, EscalationWithRollup[]> = {
      follow_up_due: [],
      awaiting_vendor: [],
      awaiting_us: [],
      resolved: [],
    };
    for (const e of escalations) {
      map[groupEscalation(e, today)].push(e);
    }
    for (const g of GROUP_ORDER) {
      map[g.id].sort((a, b) => daysWaiting(b, today) - daysWaiting(a, today));
    }
    // Cap resolved to last 20
    map.resolved = map.resolved.slice(0, 20);
    return map;
  }, [escalations, today]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pm-vendor-escalations"] });
    qc.invalidateQueries({ queryKey: ["pm-vendors"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-scorecards"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-follow-ups-due"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-blocked-task-ids"] });
  };

  const openDrawer = (id: string) => {
    setDrawerId(id);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("escalation", id);
      return next;
    });
  };

  const closeDrawer = (v: boolean) => {
    if (!v) {
      setDrawerId(null);
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("escalation");
        return next;
      });
      invalidate();
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
            <Headphones className="h-6 w-6 text-amber-600" />
            Vendor escalations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track tickets blocked on Webflow, iPaaS partners, and other vendors — one escalation
            can cover many client sites.
          </p>
        </div>
        <div className="flex gap-2">
          <NewVendorDialog onCreated={invalidate} />
          <NewEscalationDialog vendors={vendors} onCreated={(id) => { invalidate(); openDrawer(id); }} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="escalations">Escalations</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>

        <TabsContent value="escalations" className="space-y-4 mt-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
            />
            Include recently resolved
          </label>

          {escLoading ? (
            <div className="text-sm text-muted-foreground py-8">Loading…</div>
          ) : escalations.length === 0 ? (
            <EmptyEscalations />
          ) : (
            GROUP_ORDER.map((g) => {
              const rows = grouped[g.id];
              if (!rows.length) return null;
              return (
                <section key={g.id} className="space-y-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.label} ({rows.length})
                  </h2>
                  <div className="space-y-2">
                    {rows.map((e) => (
                      <EscalationRow
                        key={e.id}
                        escalation={e}
                        today={today}
                        onClick={() => openDrawer(e.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="vendors" className="mt-4">
          {scoreLoading ? (
            <div className="text-sm text-muted-foreground py-8">Loading…</div>
          ) : scorecards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No vendors yet. Add Webflow, your iPaaS partner, or any vendor you escalate to.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {scorecards.map((sc) => (
                <VendorScorecardCard key={sc.vendor.id} scorecard={sc} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <VendorEscalationDrawer escalationId={drawerId} onOpenChange={closeDrawer} />
    </div>
  );
}

function EscalationRow({
  escalation: e,
  today,
  onClick,
}: {
  escalation: EscalationWithRollup;
  today: string;
  onClick: () => void;
}) {
  const waiting = daysWaiting(e, today);
  const followUpDue = isFollowUpDue(e, today);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border border-border bg-card px-3 py-3 hover:bg-accent/40 transition-colors",
        followUpDue && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium truncate">{e.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
              {e.vendor.name}
            </span>
            {(isResponseBreached(e) || isResolveBreached(e)) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive uppercase tracking-wide">
                SLA
              </span>
            )}
          </div>
          {e.summary && (
            <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{e.summary}</p>
          )}
          <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            <span>
              {waiting}d waiting
              {e.vendor_ref ? ` · ${e.vendor_ref}` : ""}
            </span>
            {e.chaseCount > 0 && (
              <span>
                {e.chaseCount} chase{e.chaseCount === 1 ? "" : "s"}
              </span>
            )}
            {e.next_follow_up_on && (
              <span className={followUpDue ? "text-destructive font-medium" : ""}>
                follow-up {fmtDateShort(e.next_follow_up_on)}
                {followUpDue ? " (due)" : ""}
              </span>
            )}
          </div>
          {e.clientNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {e.clientNames.slice(0, 6).map((name) => (
                <span
                  key={name}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/50"
                >
                  {name}
                </span>
              ))}
              {e.clientNames.length > 6 && (
                <span className="text-[10px] text-muted-foreground px-1">
                  +{e.clientNames.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 text-[11px] text-muted-foreground">
          <div>
            {e.openTaskCount} open / {e.openTaskCount + e.doneTaskCount} sites
          </div>
          <div className="capitalize mt-0.5">{e.severity}</div>
        </div>
      </div>
    </button>
  );
}

function VendorScorecardCard({ scorecard: sc }: { scorecard: VendorScorecard }) {
  const sla = sc.vendor.expected_first_response_days;
  const responseMiss =
    sla != null &&
    sc.medianFirstResponseDays != null &&
    sc.medianFirstResponseDays > sla;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-[14px] font-medium truncate">{sc.vendor.name}</div>
          <div className="text-[11px] text-muted-foreground capitalize">
            {sc.vendor.category}
            {!sc.vendor.active && " · inactive"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <Stat label="Open escalations" value={String(sc.openEscalations)} />
        <Stat label="Blocked tickets" value={String(sc.blockedClientTickets)} />
        <Stat
          label="Median 1st response"
          value={
            sc.medianFirstResponseDays == null
              ? "—"
              : `${sc.medianFirstResponseDays}d${sla != null ? ` / ${sla}d SLA` : ""}`
          }
          warn={!!responseMiss}
        />
        <Stat
          label="Median resolution"
          value={sc.medianResolutionDays == null ? "—" : `${sc.medianResolutionDays}d`}
        />
        <Stat
          label="Avg chases / esc."
          value={sc.avgChasesPerEscalation == null ? "—" : String(sc.avgChasesPerEscalation)}
          warn={(sc.avgChasesPerEscalation ?? 0) >= 3}
        />
        <Stat
          label="Unresolved 30d+"
          value={String(sc.unresolvedPast30d)}
          warn={sc.unresolvedPast30d > 0}
        />
        <Stat
          label="Response breach (90d)"
          value={sc.responseBreachRate == null ? "—" : `${sc.responseBreachRate}%`}
          warn={(sc.responseBreachRate ?? 0) > 0}
        />
        <Stat
          label="Resolve breach (90d)"
          value={sc.resolveBreachRate == null ? "—" : `${sc.resolveBreachRate}%`}
          warn={(sc.resolveBreachRate ?? 0) > 0}
        />
      </div>

      {sc.oldestOpenAgeDays != null && (
        <div className="text-[11px] text-muted-foreground">
          Oldest open: {sc.oldestOpenAgeDays} day{sc.oldestOpenAgeDays === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn("text-[13px] font-semibold mt-0.5", warn && "text-destructive")}>
        {value}
      </div>
    </div>
  );
}

function EmptyEscalations() {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
      <Headphones className="h-8 w-8 text-muted-foreground mx-auto" />
      <p className="text-sm text-muted-foreground">
        No open vendor escalations. When a ticket is stuck waiting on Webflow or a partner, create
        an escalation and link every affected client site.
      </p>
    </div>
  );
}

function NewVendorDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<VendorCategory>("platform");
  const [cadence, setCadence] = useState(3);
  const [sla, setSla] = useState<string>("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await upsertVendor({
        name: name.trim(),
        category,
        follow_up_cadence_days: cadence,
        expected_first_response_days: sla ? Number(sla) : null,
        support_email: email.trim() || null,
        support_url: url.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Vendor added");
      setOpen(false);
      setName("");
      onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add vendor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Building2 className="h-3.5 w-3.5 mr-1.5" /> Add vendor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label className="text-[11px]">Name</Label>
              <Input className="h-9 text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Webflow" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as VendorCategory)}>
                  <SelectTrigger className="h-9 text-xs capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {VENDOR_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Follow-up cadence (days)</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 text-xs"
                  value={cadence}
                  onChange={(e) => setCadence(Number(e.target.value) || 3)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Expected 1st response (days)</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 text-xs"
                  value={sla}
                  onChange={(e) => setSla(e.target.value)}
                  placeholder="Optional SLA"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Support email</Label>
                <Input
                  className="h-9 text-xs"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Support URL</Label>
              <Input className="h-9 text-xs" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Notes</Label>
              <Textarea rows={2} className="text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !name.trim()} onClick={submit}>
              {busy ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewEscalationDialog({
  vendors,
  onCreated,
}: {
  vendors: PmVendor[];
  onCreated: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [vendorRef, setVendorRef] = useState("");
  const [severity, setSeverity] = useState<EscalationSeverity>("high");
  const [category, setCategory] = useState<EscalationCategory | "">("");
  const [impactSummary, setImpactSummary] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  useEffect(() => {
    if (open && !vendorId && vendors[0]) setVendorId(vendors[0].id);
  }, [open, vendors, vendorId]);

  const submit = async () => {
    if (!vendorId || !title.trim() || !summary.trim()) return;
    setBusy(true);
    try {
      const { escalation } = await createEscalation({
        vendorId,
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim() || undefined,
        vendorRef: vendorRef.trim() || null,
        severity,
        category: category || null,
        impactSummary: impactSummary.trim() || null,
        vendorContactName: contactName.trim() || null,
        vendorContactEmail: contactEmail.trim() || null,
        ownerId: getCurrentUserId(),
      });
      toast.success("Escalation created");
      setOpen(false);
      setTitle("");
      setSummary("");
      setDescription("");
      setVendorRef("");
      setCategory("");
      setImpactSummary("");
      setContactName("");
      setContactEmail("");
      onCreated(escalation.id);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={!vendors.length}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> New escalation
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New vendor escalation</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label className="text-[11px]">Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Title</Label>
              <Input
                className="h-9 text-xs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Blurry images on client sites"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Short description *</Label>
              <Textarea
                rows={2}
                className="text-xs"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="1–2 sentences: what’s broken and what you need from the vendor"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Vendor case #</Label>
                <Input
                  className="h-9 text-xs"
                  value={vendorRef}
                  onChange={(e) => setVendorRef(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as EscalationSeverity)}>
                  <SelectTrigger className="h-9 text-xs capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {(["low", "medium", "high", "critical"] as EscalationSeverity[]).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Category</Label>
                <Select
                  value={category || "__none__"}
                  onValueChange={(v) => setCategory(v === "__none__" ? "" : (v as EscalationCategory))}
                >
                  <SelectTrigger className="h-9 text-xs capitalize">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="__none__" className="text-xs">
                      —
                    </SelectItem>
                    {ESCALATION_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs capitalize">
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedVendor && selectedVendor.contacts.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Pick vendor contact</Label>
                  <Select
                    value="__none__"
                    onValueChange={(idx) => {
                      if (idx === "__none__") return;
                      const c = selectedVendor.contacts[Number(idx)];
                      if (!c) return;
                      setContactName(c.name ?? "");
                      setContactEmail(c.email ?? "");
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Fill from vendor…" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      <SelectItem value="__none__" className="text-xs">
                        Choose…
                      </SelectItem>
                      {selectedVendor.contacts.map((c, i) => (
                        <SelectItem key={i} value={String(i)} className="text-xs">
                          {c.name || c.email || `Contact ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Vendor contact name</Label>
                <Input
                  className="h-9 text-xs"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Vendor contact email</Label>
                <Input
                  className="h-9 text-xs"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Impact</Label>
              <Textarea
                rows={2}
                className="text-xs"
                value={impactSummary}
                onChange={(e) => setImpactSummary(e.target.value)}
                placeholder="Which clients/sites are affected?"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Longer notes</Label>
              <Textarea
                rows={2}
                className="text-xs"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              After creating, open the escalation and use “Add site” to attach every affected client
              ticket.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={busy || !vendorId || !title.trim() || !summary.trim()}
              onClick={submit}
            >
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
