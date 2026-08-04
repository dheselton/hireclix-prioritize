/**
 * PORTAL-3: reusable client-facing conversation thread for a project.
 *
 * Used by the internal app (PM/BA talking to the client) and, later, by the
 * external token portal — the only difference is who the author is, passed in
 * via props.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  usePortalMessages, postPortalMessage, uploadPortalAttachment, signedPortalUrl,
  type PortalAttachment,
} from "@/lib/pm/portalMessages";
import { fmtDate } from "@/lib/pm/format";

function AttachmentChip({ att }: { att: PortalAttachment }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    const url = await signedPortalUrl(att.path);
    setBusy(false);
    if (!url) { toast.error("Couldn't open that file."); return; }
    window.open(url, "_blank", "noopener");
  }
  return (
    <button
      type="button" onClick={open} disabled={busy}
      className="inline-flex items-center gap-1.5 max-w-[220px] px-2 py-1 rounded-md border border-border/70 bg-muted/40 text-[11px] hover:bg-accent/40 transition"
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate">{att.name}</span>
    </button>
  );
}

export function PortalMessageThread({
  projectId,
  authorName,
  authorUserId = null,
  authorPortalId = null,
  emptyHint = "No messages yet. Start the conversation.",
  canPost = true,
  className = "",
}: {
  projectId: string;
  authorName: string;
  authorUserId?: string | null;
  authorPortalId?: string | null;
  emptyHint?: string;
  canPost?: boolean;
  className?: string;
}) {
  const { messages, loading, failed } = usePortalMessages(projectId);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function send() {
    const body = draft.trim();
    if (!body && !pending.length) return;
    setSending(true);
    const uploaded: PortalAttachment[] = [];
    const failedFiles: string[] = [];
    for (const f of pending) {
      const res = await uploadPortalAttachment(projectId, f);
      if (res) uploaded.push(res); else failedFiles.push(f.name);
    }
    try {
      await postPortalMessage({ projectId, body, authorName, authorUserId, authorPortalId, attachments: uploaded });
      setDraft(""); setPending([]);
      if (failedFiles.length) toast.warning(`Message sent, but ${failedFiles.length} file(s) failed to upload.`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send that message.");
    }
    setSending(false);
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        ) : failed ? (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Couldn't load this conversation.
          </p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{emptyHint}</p>
        ) : messages.map(m => {
          const mine = !!authorUserId && m.author_user_id === authorUserId;
          return (
            <div key={m.id} className={`rounded-lg border px-3 py-2 ${mine ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card"}`}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-medium">{m.author_name}</span>
                {!m.author_user_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">Client</span>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {fmtDate(m.created_at)} · {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              {m.body && <div className="text-sm whitespace-pre-wrap">{m.body}</div>}
              {m.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.attachments.map(a => <AttachmentChip key={a.path} att={a} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canPost && (
        <div className="border-t border-border pt-3 space-y-2">
          <Textarea
            value={draft} onChange={e => setDraft(e.target.value)} rows={3}
            placeholder="Write a message to the client…"
          />
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pending.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/70 text-[11px]">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-[160px]">{f.name}</span>
                  <button type="button" onClick={() => setPending(p => p.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5 mr-1" /> Attach
            </Button>
            <input
              ref={fileRef} type="file" multiple className="hidden"
              onChange={e => { setPending(p => [...p, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }}
            />
            <Button size="sm" onClick={send} disabled={sending || (!draft.trim() && !pending.length)}>
              <Send className="h-3.5 w-3.5 mr-1" /> {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
