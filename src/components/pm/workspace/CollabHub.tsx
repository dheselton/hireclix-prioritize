import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useCurrentUser, useMockUsers } from "@/lib/pm/mockUser";
import { MentionTextarea, MentionText } from "@/components/pm/drawer/MentionTextarea";
import { Trash2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { fmtDate } from "@/lib/pm/format";
import { uploadFilesToStorage, type UploadedFileRef } from "@/lib/pm/uploads";
import { AttachmentThumb } from "@/components/pm/attachments/AttachmentThumb";
import { usePreview } from "@/components/pm/attachments/PreviewProvider";

interface Comment {
  id: string; task_id: string; project_id: string | null;
  user_id: string | null; body: string; mentions: string[];
  created_at: string; pinned: boolean; attachments: UploadedFileRef[];
}


function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(iso);
}

export function CollabHub({ taskId, projectId, taskTitle }: { taskId: string; projectId: string; taskTitle: string }) {
  const [rows, setRows] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const users = useMockUsers();
  const { openPreview } = usePreview();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("pm_comments").select("*").eq("task_id", taskId).order("created_at");
    setRows((data || []).map((r: any) => ({
      ...r,
      attachments: Array.isArray(r.attachments) ? (r.attachments as UploadedFileRef[]) : [],
    })) as Comment[]);
  }
  useEffect(() => { load(); }, [taskId]);

  async function submit() {
    if ((!draft.trim() && !pendingFiles.length) || !user || sending) return;
    setSending(true);
    try {
      const body = draft.trim();
      let attachments: UploadedFileRef[] = [];
      if (pendingFiles.length) {
        const { uploaded, failed } = await uploadFilesToStorage({ files: pendingFiles, pathPrefix: `${taskId}/comments` });
        attachments = uploaded;
        for (const name of failed) toast.error(`Failed to upload: ${name}`);
      }
      const { error } = await supabase.from("pm_comments").insert({
        task_id: taskId, project_id: projectId, user_id: user.id,
        body, mentions, pinned: false, attachments: attachments as any,
      } as any);
      if (error) throw error;
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
      setDraft(""); setMentions([]); setPendingFiles([]);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not post comment");
    } finally {
      setSending(false);
    }
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
                      className="touch-action text-destructive"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {c.body && (
                  <div className="text-sm whitespace-pre-wrap break-words"><MentionText text={c.body} /></div>
                )}
                {c.attachments?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.attachments.map((a, i) => (
                      <div key={a.url} className="w-24">
                        <AttachmentThumb
                          item={{ id: `${c.id}-${i}`, name: a.name, url: a.url, type: "file" }}
                          onClick={() => openPreview(
                            c.attachments.map((x, j) => ({ id: `${c.id}-${j}`, name: x.name, url: x.url, type: "file" })),
                            i
                          )}
                        />
                        <div className="mt-1 text-[11px] truncate text-muted-foreground" title={a.name}>{a.name}</div>
                      </div>
                    ))}
                  </div>
                )}
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

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 max-w-[220px] px-2 py-1 rounded-md border border-border/70 bg-muted/40 text-[11px]">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) setPendingFiles(p => [...p, ...Array.from(e.target.files!)]);
              e.target.value = "";
            }}
          />

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5 mr-1" /> Attach
            </Button>
            <Button size="sm" onClick={submit} disabled={sending || (!draft.trim() && !pendingFiles.length)}>
              {sending ? "Posting…" : "Post Comment"}
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
