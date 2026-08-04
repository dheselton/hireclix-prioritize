import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionShell } from "./SectionShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { canPostClientVisible } from "@/lib/pm/permissions";
import { MentionTextarea, MentionText } from "./MentionTextarea";
import { Pencil, Trash2, Send, X, Eye } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string; task_id: string; project_id: string | null;
  user_id: string | null; body: string; mentions: string[];
  created_at: string; pinned: boolean; visibility?: string | null;
}

export function CommentsThread({ taskId, projectId, taskTitle }: { taskId: string; projectId: string; taskTitle: string }) {
  const [rows, setRows] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [clientVisible, setClientVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { user, roles } = useCurrentUser();
  const users = useMockUsers();
  const canShareWithClient = canPostClientVisible(roles);

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
      visibility: canShareWithClient && clientVisible ? "client" : "internal",
    } as any);

    if (mentions.length) {
      const { createNotification } = await import("@/lib/pm/notifications");
      for (const uid of mentions) {
        if (uid === user.id) continue;
        await createNotification({
          user_id: uid,
          event_type: "mention",
          title: `${user.name} mentioned you in ${taskTitle}`,
          body: body.slice(0, 200),
          link: `/pm/tasks/${taskId}`,
        });
      }
    }
    setDraft(""); setMentions([]);
    await load();
  }

  async function saveEdit(c: Comment) {
    await supabase.from("pm_comments").update({ body: editValue } as any).eq("id", c.id);
    setEditingId(null);
    await load();
  }
  async function remove(id: string) {
    await supabase.from("pm_comments").delete().eq("id", id);
    await load();
  }

  function canEdit(c: Comment) {
    if (!user || c.user_id !== user.id) return false;
    return Date.now() - new Date(c.created_at).getTime() < 15 * 60 * 1000;
  }

  return (
    <SectionShell
      title="Comments"
      badge={<Badge variant="secondary" className="ml-1">{rows.length}</Badge>}
    >
      <div className="space-y-3 mb-3">
        {rows.map(c => {
          const u = users.find(x => x.id === c.user_id);
          return (
            <div key={c.id} className="flex gap-2">
              <UserAvatar userId={c.user_id} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">{u?.name ?? "Unknown"}</span>
                  {c.visibility === "client" && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">
                      <Eye className="h-2.5 w-2.5" /> Client visible
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>

                  {canEdit(c) && (
                    <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto"
                      onClick={() => { setEditingId(c.id); setEditValue(c.body); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {user?.id === c.user_id && (
                    <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {editingId === c.id ? (
                  <div className="space-y-1">
                    <MentionTextarea value={editValue} onChange={setEditValue} users={users} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(c)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap"><MentionText text={c.body} /></div>
                )}
              </div>
            </div>
          );
        })}
        {!rows.length && <div className="text-xs text-muted-foreground italic">No comments yet.</div>}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <MentionTextarea
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          onMentionsChange={setMentions}
          users={users}
          placeholder="Write a comment… use @ to mention someone"
        />
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="text-[11px] text-muted-foreground">
            {mentions.length > 0 && `Mentions: ${mentions.length}`}
            {" "}Enter to send · Shift+Enter for newline
          </div>
          <div className="flex items-center gap-3">
            {canShareWithClient && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <Switch checked={clientVisible} onCheckedChange={setClientVisible} />
                Visible to client
              </label>
            )}
            <Button size="sm" onClick={submit} disabled={!draft.trim()}>
              <Send className="h-3 w-3 mr-1" /> Send
            </Button>
          </div>
        </div>

      </div>
    </SectionShell>
  );
}
