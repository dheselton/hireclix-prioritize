import { useMemo, useState } from "react";
import { Headphones, Link2, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
import { getCurrentUserId } from "@/lib/pm/mockUser";
import {
  createEscalation,
  linkTaskToEscalation,
  unlinkTask,
  useEscalationForTask,
  useEscalations,
  useVendors,
  type EscalationSeverity,
} from "@/lib/pm/vendors";
import type { PmTask } from "@/types/pm";

interface Props {
  task: PmTask;
  patch: (p: Partial<PmTask>) => Promise<void>;
}

export function VendorWaitCard({ task }: Props) {
  const qc = useQueryClient();
  const { data: linked } = useEscalationForTask(task.id);
  const { data: vendors = [] } = useVendors();
  const { data: openEscalations = [] } = useEscalations({ includeResolved: false });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<"attach" | "create">("attach");
  const [busy, setBusy] = useState(false);

  // Attach form
  const [attachEscalationId, setAttachEscalationId] = useState<string>("");

  // Create form
  const [vendorId, setVendorId] = useState("");
  const [title, setTitle] = useState(task.title);
  const [vendorRef, setVendorRef] = useState("");
  const [severity, setSeverity] = useState<EscalationSeverity>("high");
  const [description, setDescription] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pm-vendor-escalation-for-task", task.id] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-escalations"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-blocked-task-ids"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-scorecards"] });
    qc.invalidateQueries({ queryKey: ["pm-vendor-follow-ups-due"] });
  };

  const openPicker = () => {
    setMode(openEscalations.length ? "attach" : "create");
    setAttachEscalationId(openEscalations[0]?.id ?? "");
    setVendorId(vendors[0]?.id ?? "");
    setTitle(task.title);
    setVendorRef("");
    setSeverity("high");
    setDescription("");
    setPickerOpen(true);
  };

  const handleAttach = async () => {
    if (!attachEscalationId) return;
    setBusy(true);
    try {
      const esc = openEscalations.find((e) => e.id === attachEscalationId);
      await linkTaskToEscalation(attachEscalationId, task.id, {
        block: true,
        vendorName: esc?.vendor.name,
      });
      invalidate();
      toast.success("Linked to vendor escalation");
      setPickerOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to link");
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!vendorId || !title.trim()) return;
    setBusy(true);
    try {
      await createEscalation({
        vendorId,
        title: title.trim(),
        description: description.trim() || undefined,
        vendorRef: vendorRef.trim() || null,
        severity,
        ownerId: getCurrentUserId(),
        linkTaskId: task.id,
        blockLinkedTasks: true,
      });
      invalidate();
      toast.success("Vendor escalation created");
      setPickerOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create escalation");
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!linked) return;
    setBusy(true);
    try {
      await unlinkTask(linked.id, task.id);
      invalidate();
      toast.success("Unlinked from vendor escalation");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to unlink");
    } finally {
      setBusy(false);
    }
  };

  const attachOptions = useMemo(
    () =>
      openEscalations.map((e) => ({
        id: e.id,
        label: `${e.vendor.name}: ${e.title}`,
      })),
    [openEscalations],
  );

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Headphones className="h-3 w-3" />
          Waiting on vendor
        </h3>

        {linked ? (
          <div className="space-y-2">
            <div className="text-[12px] font-medium">{linked.vendor.name}</div>
            <div className="text-[11px] text-muted-foreground line-clamp-2">{linked.title}</div>
            {linked.vendor_ref && (
              <div className="text-[11px] text-muted-foreground">Case {linked.vendor_ref}</div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs w-full gap-1.5"
              disabled={busy}
              onClick={handleUnlink}
            >
              <Unlink className="h-3 w-3" /> Unlink
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full gap-1.5"
            onClick={openPicker}
          >
            <Link2 className="h-3 w-3" /> Attach to escalation
          </Button>
        )}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Waiting on vendor</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "attach" ? "default" : "outline"}
              className="flex-1"
              disabled={!attachOptions.length}
              onClick={() => setMode("attach")}
            >
              Attach existing
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "create" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("create")}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New escalation
            </Button>
          </div>

          {mode === "attach" ? (
            <div className="space-y-2">
              <Label className="text-[11px]">Open escalation</Label>
              <Select value={attachEscalationId} onValueChange={setAttachEscalationId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {attachOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                This task will be marked blocked and linked to the shared vendor issue.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-[11px]">Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={vendors.length ? "Select…" : "Add a vendor first"} />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!vendors.length && (
                  <p className="text-[11px] text-muted-foreground">
                    No vendors yet — create one on the{" "}
                    <a href="/pm/vendors" className="underline">
                      Vendors
                    </a>{" "}
                    page.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Title</Label>
                <Input
                  className="h-9 text-xs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Vendor case #</Label>
                  <Input
                    className="h-9 text-xs"
                    value={vendorRef}
                    onChange={(e) => setVendorRef(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Severity</Label>
                  <Select
                    value={severity}
                    onValueChange={(v) => setSeverity(v as EscalationSeverity)}
                  >
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
              <div className="space-y-1">
                <Label className="text-[11px]">Notes</Label>
                <Textarea
                  rows={2}
                  className="text-xs"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are we waiting on them for?"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                (mode === "attach" ? !attachEscalationId : !vendorId || !title.trim())
              }
              onClick={mode === "attach" ? handleAttach : handleCreate}
            >
              {busy ? "Saving…" : mode === "attach" ? "Attach" : "Create & attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
