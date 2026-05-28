import { useState, useMemo } from "react";
import { StickyNote, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/pm/format";
import { useMyNotes, type PmNote } from "@/lib/pm/briefing";
import { NoteDialog } from "./NoteDialog";

interface Props {
  userId: string;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysFromToday(iso: string): number {
  const today = new Date(todayIso());
  const d = new Date(iso);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function noteBadge(note: PmNote) {
  if (!note.due_date) {
    return { label: "No date", cls: "bg-muted text-muted-foreground" };
  }
  const today = todayIso();
  if (note.due_date < today) {
    return { label: "Overdue", cls: "bg-destructive/15 text-destructive" };
  }
  if (note.due_date === today) {
    return { label: "Today", cls: "bg-amber-500/20 text-amber-700 dark:text-amber-300" };
  }
  const delta = daysFromToday(note.due_date);
  if (delta <= 7) {
    return { label: fmtDate(note.due_date), cls: "bg-primary/15 text-primary" };
  }
  return { label: fmtDate(note.due_date), cls: "bg-muted text-muted-foreground" };
}

function rank(n: PmNote) {
  if (!n.due_date) return 3;
  const today = todayIso();
  if (n.due_date < today) return 0;
  if (n.due_date === today) return 1;
  return 2;
}

export function NotesSection({ userId }: Props) {
  const { notes } = useMyNotes(userId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PmNote | null>(null);
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    });
  }, [notes]);

  const visible = expanded ? sorted : sorted.slice(0, 10);
  const hidden = Math.max(0, sorted.length - visible.length);

  return (
    <section className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" /> MY NOTES & REMINDERS
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-full px-3 text-xs"
          onClick={() => { setEditing(null); setDialogOpen(true); }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add note
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3">
          No notes yet. Add reminders or follow-ups here.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((n) => {
            const badge = noteBadge(n);
            return (
              <button
                key={n.id}
                onClick={() => { setEditing(n); setDialogOpen(true); }}
                className="group inline-flex items-center gap-2 max-w-full rounded-full border border-border bg-background hover:border-primary/50 px-3 py-1.5 transition-colors"
              >
                <span className="text-xs truncate max-w-[20rem] text-left">{n.content}</span>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </button>
            );
          })}
          {hidden > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="inline-flex items-center rounded-full px-3 py-1.5 text-xs text-primary hover:underline"
            >
              + {hidden} more
            </button>
          )}
        </div>
      )}

      <NoteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        userId={userId}
        note={editing}
      />
    </section>
  );
}
