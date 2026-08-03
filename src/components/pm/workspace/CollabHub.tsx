import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { MentionTextarea, MentionText } from "@/components/pm/drawer/MentionTextarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";

interface Comment {
  id: string; task_id: string; project_id: string | null;
  user_id: string | null; body: string; mentions: string[];
  created_at: string; pinned: boolean;
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CollabHub({ taskId, projectId, taskTitle }: { taskId: string; projectId: string; taskTitle: string }) {
  const [rows, setRows] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const { user } = useCurrentUser();
  const users = useMockUsers();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("pm_comments").select("*").eq("task_id", taskId).order("created_at");
    setRows((data || []) as Comment[]);
  }
  useEffect(() => { load(); }, [taskId]);

  async function submit() {
    if (!draft.trim() || !user) return;
    const body = draft.trim();
    await supabase.from("pm_comments").insert({
      task_id: taskId, project_id: projectId, user_id: user.id,
      body, mentions, pinned: false,
    } as any);
    if (mentions.length) {
      const notifs = mentions.filter(id => id !== user.id).map(uid => ({
        user_id: uid, type: "mention",
        title: `${user.name} mentioned you in ${taskTitle}`,
        body: body.slice(0, 200),
        link: `/pm/tasks/${taskId}`,
        read: false,
      }));
      if (notifs.length) await supabase.from("pm_notifications").insert(notifs as any);
    }
    setDraft(""); setMentions([]);
    await load();
  }

  async function remove(id: string) {
    try {
      const { error } = await supabase.from("pm_comments").delete().eq("id", id);
      if (error) throw error;
      await load();
      toast.success("Comment deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete comment");
    }
  }

  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Collab Hub
      </h3>

      <div className="space-y-3 mb-4">
        {rows.map(c => {
          const u = users.find(x => x.id === c.user_id);
          const mine = user?.id === c.user_id;
          return (
            <div key={c.id} className="flex gap-2 group">
              <UserAvatar userId={c.user_id} size="sm" />
              <div className="flex-1 min-w-0 rounded-lg bg-muted/50 px-3 py-2">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-sm font-semibold">{u?.name ?? "Unknown"}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto">{timeAgo(c.created_at)}</span>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap break-words"><MentionText text={c.body} /></div>
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <div className="text-xs text-muted-foreground italic">No comments yet. Start the conversation below.</div>
        )}
      </div>

      <div className="flex gap-2">
        <UserAvatar userId={user?.id} size="sm" />
        <div className="flex-1 space-y-2">
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onMentionsChange={setMentions}
            users={users}
            placeholder="Write a comment or tag @team…"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={!draft.trim()}>
              Post Comment
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={o => { if (!o) setPendingDelete(null); }}
        title="Delete comment?"
        description="Delete comment? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => { if (pendingDelete) await remove(pendingDelete); setPendingDelete(null); }}
      />
    </section>
  );
}
