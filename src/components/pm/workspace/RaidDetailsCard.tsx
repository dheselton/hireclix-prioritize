import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  KIND_META, getTaskKind, getRaidDetails,
  RISK_SEVERITIES, LIKELIHOODS, SEVERITY_STYLE, type RaidDetails,
} from "@/lib/pm/taskKind";
import type { PmTask } from "@/types/pm";

interface Props {
  task: PmTask;
  patch: (p: Partial<PmTask>) => Promise<void>;
}

/** Extra fields for Decision or Risk kinds — hidden for plain tasks. */
export function RaidDetailsCard({ task, patch }: Props) {
  const kind = getTaskKind(task);
  if (kind === "task") return null;
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const initial = useMemo(() => getRaidDetails(task), [task]);
  const [details, setDetails] = useState<RaidDetails>(initial);
  useEffect(() => { setDetails(initial); }, [initial]);

  async function commit(next: RaidDetails) {
    setDetails(next);
    const cf = { ...(task.custom_fields ?? {}), raid: next };
    await patch({ custom_fields: cf } as any);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color: meta.dotHsl }} />
        {meta.label} details
      </h3>

      {kind === "decision" && (
        <DecisionFields details={details} onChange={commit} />
      )}
      {kind === "issue" && (
        <RiskFields details={details} onChange={commit} />
      )}
    </div>
  );
}

function DecisionFields({ details, onChange }: { details: RaidDetails; onChange: (d: RaidDetails) => void }) {
  const [draft, setDraft] = useState("");
  const options = details.options ?? [];
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <Label className="text-[11px]">Needed by</Label>
        <Input
          type="date"
          className="h-8 text-xs"
          value={details.decision_needed_by ?? ""}
          onChange={e => onChange({ ...details, decision_needed_by: e.target.value || null })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Options being weighed</Label>
        <div className="flex gap-1">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. www"
            className="h-8 text-xs"
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = draft.trim();
                if (v) { onChange({ ...details, options: [...options, v] }); setDraft(""); }
              }
            }}
          />
          <Button
            type="button" variant="outline" size="sm" className="h-8"
            onClick={() => {
              const v = draft.trim();
              if (v) { onChange({ ...details, options: [...options, v] }); setDraft(""); }
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {options.length > 0 && (
          <ul className="flex flex-wrap gap-1 mt-1">
            {options.map((o, i) => (
              <li key={i} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-muted text-[11px]">
                {o}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onChange({ ...details, options: options.filter((_, idx) => idx !== i) })}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Decision made</Label>
        <Textarea
          rows={2}
          className="text-xs"
          value={details.decision_made ?? ""}
          onChange={e => onChange({ ...details, decision_made: e.target.value })}
          placeholder="Fill in once decided"
        />
      </div>
    </div>
  );
}

function RiskFields({ details, onChange }: { details: RaidDetails; onChange: (d: RaidDetails) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Severity</Label>
          <Select
            value={details.severity ?? ""}
            onValueChange={v => onChange({ ...details, severity: v as any })}
          >
            <SelectTrigger className={cn("h-8 text-xs capitalize", details.severity && SEVERITY_STYLE[details.severity])}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {RISK_SEVERITIES.map(s => (
                <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Likelihood</Label>
          <Select
            value={details.likelihood ?? ""}
            onValueChange={v => onChange({ ...details, likelihood: v as any })}
          >
            <SelectTrigger className="h-8 text-xs capitalize">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {LIKELIHOODS.map(s => (
                <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Impact if it happens</Label>
        <Textarea
          rows={2} className="text-xs"
          value={details.impact ?? ""}
          onChange={e => onChange({ ...details, impact: e.target.value })}
          placeholder="What breaks or slips?"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Mitigation plan</Label>
        <Textarea
          rows={2} className="text-xs"
          value={details.mitigation ?? ""}
          onChange={e => onChange({ ...details, mitigation: e.target.value })}
          placeholder="What are we doing about it?"
        />
      </div>
    </div>
  );
}
