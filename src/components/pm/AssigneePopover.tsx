import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { updateTask } from "@/lib/pm/api";
import { toast } from "sonner";
import { UserX, Check, Star } from "lucide-react";
import {
  addAssignee,
  removeAssignee,
  setPrimaryAssignee,
  useInvalidateAssignees,
  useTaskCoAssignees,
} from "@/lib/pm/assignees";
import { cn } from "@/lib/utils";

interface Props {
  taskId?: string;
  assigneeId?: string | null;
  size?: "xs" | "sm" | "md";
  /** Disable persistence — used in bulk mode where caller handles writes. */
  controlled?: boolean;
  onPick?: (userId: string | null) => void | Promise<void>;
  onChanged?: () => void;
  /** Custom trigger; defaults to the user avatar. */
  trigger?: React.ReactNode;
  /** "multi" lets users add/remove multiple assignees. Defaults to "single". */
  mode?: "single" | "multi";
}

export function AssigneePopover({
  taskId, assigneeId, size = "xs", controlled, onPick, onChanged, trigger,
  mode = "single",
}: Props) {
  const users = useMockUsers();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const co = useTaskCoAssignees(mode === "multi" ? taskId : undefined);
  const invalidate = useInvalidateAssignees();
  const { user: me } = useCurrentUser();

  const filtered = users
    .filter(u => u.role !== "submitter")
    .filter(u => !q || u.name.toLowerCase().includes(q.toLowerCase()));

  async function pick(userId: string | null) {
    if (mode !== "multi") setOpen(false);
    if (controlled || !taskId) {
      await onPick?.(userId);
      return;
    }
    if (mode === "single") {
      try {
        await updateTask(taskId, { assignee_id: userId });
        toast.success(userId ? "Reassigned" : "Unassigned");
        onChanged?.();
      } catch {
        toast.error("Couldn't reassign");
      }
    }
  }

  async function toggleMulti(userId: string) {
    if (!taskId) return;
    const isAssigned = assigneeId === userId || co.includes(userId);
    if (isAssigned) {
      await removeAssignee(taskId, userId);
      toast.success("Removed");
    } else {
      await addAssignee(taskId, userId);
      toast.success("Added");
    }
    invalidate();
    onChanged?.();
  }

  async function makePrimary(userId: string) {
    if (!taskId) return;
    await setPrimaryAssignee(taskId, userId);
    invalidate();
    onChanged?.();
    toast.success("Primary updated");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full hover:ring-2 hover:ring-info/40 transition"
          aria-label="Assign user"
        >
          {trigger ?? <UserAvatar userId={assigneeId} size={size} />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-2 z-50 bg-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          autoFocus
          placeholder={mode === "multi" ? "Search to add or remove…" : "Search user…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 mb-2"
        />
        {mode === "multi" && me && !filtered.some(u => u.id === me.id && (assigneeId === me.id || co.includes(me.id))) && (
          <button
            type="button"
            onClick={() => toggleMulti(me.id)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 text-sm mb-1 border border-dashed border-border"
          >
            <UserAvatar userId={me.id} size="sm" />
            <span className="flex-1 truncate">Assign me</span>
          </button>
        )}
        <div className="max-h-64 overflow-auto">
          {filtered.map(u => {
            const isPrimary = assigneeId === u.id;
            const isCo = co.includes(u.id);
            const isAssigned = isPrimary || isCo;
            if (mode === "multi") {
              return (
                <div key={u.id} className={cn("group flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted", isAssigned && "bg-muted/60")}>
                  <button type="button" onClick={() => toggleMulti(u.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    <UserAvatar userId={u.id} size="sm" />
                    <span className="flex-1 truncate">{u.name}</span>
                    {isPrimary && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                    {isAssigned && !isPrimary && <Check className="h-3.5 w-3.5 text-success" />}
                  </button>
                  {isCo && !isPrimary && (
                    <button
                      type="button"
                      onClick={() => makePrimary(u.id)}
                      title="Make primary owner"
                      className="text-[10px] uppercase text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border touch-action"
                    >
                      Primary
                    </button>
                  )}
                </div>
              );
            }
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => pick(u.id)}
                className={`w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 text-sm ${isPrimary ? "bg-muted" : ""}`}
              >
                <UserAvatar userId={u.id} size="sm" />
                <span className="flex-1 truncate">{u.name}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{u.role}</span>
              </button>
            );
          })}
          {!filtered.length && (
            <div className="px-2 py-3 text-xs text-muted-foreground italic">No matches</div>
          )}
        </div>
        {mode === "single" && (assigneeId || controlled) && (
          <>
            <div className="h-px bg-border my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-8 text-xs"
              onClick={() => pick(null)}
            >
              <UserX className="h-3.5 w-3.5 mr-2" /> Unassign
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
