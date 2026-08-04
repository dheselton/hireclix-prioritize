import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Copy, Link2, Mail, Plus, RotateCcw, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { fmtDate } from "@/lib/pm/format";
import { useCurrentUser } from "@/lib/pm/mockUser";
import {
  useClientPortalAccess, createPortalAccess, setPortalAccessActive,
  deletePortalAccess, queueInvite, portalUrl, type PortalAccess,
} from "@/lib/pm/portalAccess";

function copy(text: string, label = "Portal link copied") {
  try {
    navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Could not copy link");
  }
}

function AccessRow({ row, onChanged }: { row: PortalAccess; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function act(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try { await fn(); toast.success(msg); onChanged(); }
    catch (e) { console.error(e); toast.error("Something went wrong"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{row.label || row.email}</span>
          {row.is_active
            ? <Badge variant="outline" className="bg-success/15 text-success border-success/30">Active</Badge>
            : <Badge variant="outline" className="bg-muted text-muted-foreground">Revoked</Badge>}
        </div>
        <div className="text-xs text-muted-foreground truncate">{row.email}</div>
        <div className="text-xs text-muted-foreground">
          {row.invite_sent_at ? `Invited ${fmtDate(row.invite_sent_at)}` : "Not invited yet"}
          {" · "}
          {row.last_accessed_at ? `Last opened ${fmtDate(row.last_accessed_at)}` : "Never opened"}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {row.is_active && (
          <>
            <Button variant="ghost" size="sm" title="Copy portal link"
              onClick={() => copy(portalUrl(row.token))}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" title="Resend invite" disabled={busy}
              onClick={() => act(() => queueInvite(row), "Invite queued")}>
              <Mail className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" title="Revoke access" disabled={busy}
              onClick={() => setConfirmRevoke(true)}>
              <Ban className="h-4 w-4" />
            </Button>
          </>
        )}
        {!row.is_active && (
          <>
            <Button variant="ghost" size="sm" title="Restore access" disabled={busy}
              onClick={() => act(() => setPortalAccessActive(row.id, true), "Access restored")}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" title="Delete invite" disabled={busy}
              onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Revoke portal access?"
        description={`${row.email} will immediately lose access to their portal link.`}
        confirmLabel="Revoke"
        destructive
        onConfirm={() => act(() => setPortalAccessActive(row.id, false), "Access revoked")}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this invite?"
        description="This permanently removes the invite record."
        confirmLabel="Delete"
        destructive
        onConfirm={() => act(() => deletePortalAccess(row.id), "Invite deleted")}
      />
    </div>
  );
}

/** Invite / copy / resend / revoke portal access for one client. */
export function PortalAccessPanel({ clientId, compact }: { clientId: string; compact?: boolean }) {
  const { user } = useCurrentUser();
  const { rows, loading, error, reload } = useClientPortalAccess(clientId);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function invite() {
    const e = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast.error("Enter a valid email address"); return; }
    setSaving(true);
    try {
      const row = await createPortalAccess({ clientId, email: e, label, createdBy: user?.id ?? null });
      setEmail(""); setLabel("");
      copy(portalUrl(row.token), "Invite created — link copied");
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Could not create the invite");
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="client@company.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Input placeholder="Name / role (optional)" value={label} onChange={e => setLabel(e.target.value)} />
        <Button onClick={invite} disabled={saving} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Invite
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading portal access…</p>}
      {error && <p className="text-sm text-destructive">Couldn't load portal access. Try again.</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No one has portal access yet. Invite a client contact to give them a login-free view of their projects.
        </p>
      )}
      {rows.map(r => <AccessRow key={r.id} row={r} onChanged={reload} />)}
    </div>
  );

  if (compact) return body;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Client portal access</h2>
      </div>
      {body}
    </Card>
  );
}
