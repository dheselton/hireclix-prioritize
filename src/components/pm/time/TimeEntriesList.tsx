import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Download } from "lucide-react";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { fmtDate } from "@/lib/pm/format";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { deleteTimeEntry, fmtDur, fmtEntryRange, type EnrichedEntry } from "@/lib/pm/time";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function TimeEntriesList({ entries, onChange }: { entries: EnrichedEntry[]; onChange?: () => void }) {
  const users = useMockUsers();
  const { user, role } = useCurrentUser();

  function exportCsv() {
    const rows = [
      ["Date", "User", "Client", "Project", "Task", "Type", "Minutes", "Hours", "Billable", "Note"],
      ...entries.map(e => {
        const u = users.find(x => x.id === e.user_id);
        return [
          fmtDate(e.logged_at.slice(0, 10)),
          u?.name ?? "",
          e.client_name ?? "",
          e.project_title,
          e.task_title,
          e.task_type ?? "",
          String(e.minutes),
          (e.minutes / 60).toFixed(2),
          e.billable ? "yes" : "no",
          (e.note ?? "").replace(/"/g, '""'),
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `time-entries-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = entries.reduce((s, e) => s + e.minutes, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-sm">
          <span className="font-medium">{entries.length}</span> entries ·{" "}
          <span className="font-medium">{fmtDur(total)}</span>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!entries.length}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground bg-muted/20">
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">User</th>
              <th className="text-left px-3 py-2 font-medium">Task</th>
              <th className="text-left px-3 py-2 font-medium">Project</th>
              <th className="text-right px-3 py-2 font-medium">Time</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground italic text-sm">No entries match the current filters.</td></tr>
            )}
            {entries.map(e => {
              const u = users.find(x => x.id === e.user_id);
              const canDelete = role === "pm" || e.user_id === user?.id;
              return (
                <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap text-xs leading-snug">{fmtEntryRange(e)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <UserAvatar userId={e.user_id} size="xs" />
                      <span className="text-xs">{u?.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 max-w-[280px]">
                    {e.is_activity ? (
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{e.activity_name ?? "Activity"}</span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 shrink-0">Activity</span>
                      </div>
                    ) : (
                      <Link to={`/pm/tasks/${e.task_id}`} className="hover:underline truncate block">{e.task_title}</Link>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">
                    {e.is_activity ? (
                      <span className="text-xs text-muted-foreground">{e.client_name ?? "Overhead"}</span>
                    ) : (
                      <Link to={`/pm/projects/${e.project_id}`} className="hover:underline truncate block text-xs text-muted-foreground">
                        {e.client_name ? `${e.client_name} · ` : ""}{e.project_title}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtDur(e.minutes)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[260px] truncate">{e.note}</td>
                  <td className="px-2 py-2">
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this time entry?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={async () => { await deleteTimeEntry(e.id); onChange?.(); }}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
