import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PortalAccessPanel } from "./PortalAccessPanel";

/**
 * Project "Share" surface: internal link for teammates, plus the client-portal
 * invite list when the project belongs to a client and the viewer is PM/BA.
 */
export function SharePortalDialog({ open, onOpenChange, clientId, canManagePortal }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | null;
  canManagePortal: boolean;
}) {
  function copyInternal() {
    try {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Internal link copied");
    } catch { toast.error("Could not copy link"); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Share this project</DialogTitle>
          <DialogDescription>
            Teammates use the internal link. Clients get a login-free portal link scoped to their company.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Internal link</div>
              <div className="text-xs text-muted-foreground truncate">Requires app access</div>
            </div>
            <Button variant="outline" size="sm" onClick={copyInternal}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </div>

          {!clientId ? (
            <p className="text-sm text-muted-foreground">
              Link a client to this project to invite them to the portal.
            </p>
          ) : !canManagePortal ? (
            <p className="text-sm text-muted-foreground">
              Only PMs and BAs can manage client portal access.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Client portal access</h3>
                <Link to={`/pm/clients/${clientId}`} className="text-xs text-primary hover:underline">
                  Manage client
                </Link>
              </div>
              <PortalAccessPanel clientId={clientId} compact />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
