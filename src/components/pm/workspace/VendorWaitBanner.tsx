import { useMemo, useState } from "react";
import { Headphones, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { fmtDateShort } from "@/lib/pm/format";
import {
  daysWaiting,
  isFollowUpDue,
  isLinkedTaskDone,
  useEscalationForTask,
  type EscalationSeverity,
} from "@/lib/pm/vendors";
import { VendorEscalationDrawer } from "@/components/pm/vendors/VendorEscalationDrawer";

interface Props {
  taskId: string;
}

const SEVERITY_STYLE: Record<EscalationSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info/15 text-info border-info/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function VendorWaitBanner({ taskId }: Props) {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: escalation } = useEscalationForTask(taskId);

  const { done, total, others, waitingDays, followUpDue } = useMemo(() => {
    if (!escalation) {
      return { done: 0, total: 0, others: [], waitingDays: 0, followUpDue: false };
    }
    const others = escalation.linkedTasks.filter((s) => s.taskId !== taskId);
    return {
      done: escalation.linkedTasks.filter(isLinkedTaskDone).length,
      total: escalation.linkedTasks.length,
      others,
      waitingDays: daysWaiting(escalation),
      followUpDue: isFollowUpDue(escalation),
    };
  }, [escalation, taskId]);

  if (!escalation) return null;

  return (
    <>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Headphones className="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-amber-900 dark:text-amber-100">
              Waiting on <span className="font-semibold">{escalation.vendor.name}</span>
              {escalation.vendor_ref ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · case {escalation.vendor_ref}
                </span>
              ) : null}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              “{escalation.title}” · open since {fmtDateShort(escalation.opened_at)} ({waitingDays}{" "}
              {waitingDays === 1 ? "day" : "days"})
              {escalation.next_follow_up_on && (
                <>
                  {" "}
                  · next follow-up{" "}
                  <span className={followUpDue ? "text-destructive font-medium" : ""}>
                    {fmtDateShort(escalation.next_follow_up_on)}
                    {followUpDue ? " (due)" : ""}
                  </span>
                </>
              )}
            </div>
            {total > 1 && (
              <div className="text-[12px] text-muted-foreground mt-0.5">
                {done} of {total} client site{total === 1 ? "" : "s"} resolved
              </div>
            )}
          </div>
          <span
            className={
              "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide border shrink-0 " +
              SEVERITY_STYLE[escalation.severity]
            }
          >
            {escalation.severity}
          </span>
        </div>

        {others.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-6">
            {others.slice(0, 8).map((s) => {
              const fixed = isLinkedTaskDone(s);
              const label = s.clientName ?? s.projectTitle;
              return (
                <button
                  key={s.taskId}
                  type="button"
                  onClick={() => navigate(`/pm/tasks/${s.taskId}`)}
                  title={`${label} — ${s.taskTitle}`}
                  className={
                    "text-[11px] px-1.5 py-0.5 rounded border " +
                    (fixed
                      ? "bg-success/15 text-success border-success/30"
                      : "bg-muted text-muted-foreground border-border hover:bg-accent")
                  }
                >
                  {fixed ? "✓ " : ""}
                  {label}
                </button>
              );
            })}
            {others.length > 8 && (
              <span className="text-[11px] text-muted-foreground px-1.5 py-0.5">
                +{others.length - 8} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pl-6">
          <Button size="sm" variant="outline" onClick={() => setDrawerOpen(true)}>
            View escalation
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" asChild>
            <a href={`/pm/vendors?escalation=${escalation.id}`}>
              <ExternalLink className="h-3.5 w-3.5" /> Vendor hub
            </a>
          </Button>
        </div>
      </div>

      <VendorEscalationDrawer
        escalationId={drawerOpen ? escalation.id : null}
        onOpenChange={(v) => setDrawerOpen(v)}
      />
    </>
  );
}
