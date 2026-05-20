import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { updateTask } from "@/lib/pm/api";
import { toast } from "sonner";
import { UserX } from "lucide-react";

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
}

export function AssigneePopover({
  taskId, assigneeId, size = "xs", controlled, onPick, onChanged, trigger,
}: Props) {
  const users = useMockUsers();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = users
    .filter(u => u.role !== "submitter")
    .filter(u => !q || u.name.toLowerCase().includes(q.toLowerCase()));

  async function pick(userId: string | null) {
    setOpen(false);
    if (controlled || !taskId) {
      await onPick?.(userId);
      return;
    }
    const { error } = await (await import("@/integrations/supabase/client")).supabase
      .from("pm_tasks").update({ assignee_id: userId }).eq("id", taskId);
    if (error) { toast.error("Couldn't reassign"); return; }
    toast.success(userId ? "Reassigned" : "Unassigned");
    onChanged?.();
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
        className="w-64 p-2 z-50 bg-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          autoFocus
          placeholder="Search user…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="max-h-56 overflow-auto">
          {filtered.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u.id)}
              className={`w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 text-sm ${assigneeId === u.id ? "bg-muted" : ""}`}
            >
              <UserAvatar userId={u.id} size="sm" />
              <span className="flex-1 truncate">{u.name}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{u.role}</span>
            </button>
          ))}
          {!filtered.length && (
            <div className="px-2 py-3 text-xs text-muted-foreground italic">No matches</div>
          )}
        </div>
        {(assigneeId || controlled) && (
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
