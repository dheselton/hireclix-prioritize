import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Plus, UserCheck, MoreHorizontal, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { useInternalClientIds } from "@/lib/pm/clients";
import { deleteProject } from "@/lib/pm/api";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { PmProject, ProjectStatus } from "@/types/pm";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/15 text-success border-success/30",
  on_hold: "bg-warning/15 text-warning border-warning/30",
  in_review: "bg-info/15 text-info border-info/30",
  complete: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

export function ProjectHeader({ project, onAddTask }: {
  project: PmProject; onAddTask: () => void;
}) {
  const [clientName, setClientName] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const internalIds = useInternalClientIds();
  const isInternal = !!project.client_id && internalIds.has(project.client_id);
  const { user } = useCurrentUser();
  const isPM = user?.role === "pm";
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      if (project.client_id) {
        const { data } = await supabase.from("clients").select("name").eq("id", project.client_id).maybeSingle();
        setClientName((data as any)?.name ?? "");
      } else setClientName("");
      const { data: m } = await supabase.from("pm_project_members").select("user_id").eq("project_id", project.id);
      setMemberIds(((m as any[]) ?? []).map(r => r.user_id));
    })();
  }, [project.id, project.client_id]);

  function share() {
    try {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch { toast.error("Could not copy link"); }
  }

  return (
    <header className="space-y-2">
      <nav className="text-xs text-muted-foreground">
        <Link to="/pm/projects" className="hover:text-foreground">Projects</Link>
        {clientName && <> <span className="mx-1">/</span><span>{clientName}</span></>}
      </nav>
      <div className={`flex items-start justify-between gap-4 ${isInternal ? "internal-border-l pl-3 -ml-3" : ""}`}>
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h1 className="text-[20px] font-medium leading-tight truncate">{project.title}</h1>
          {isInternal && <span className="internal-pill">Internal · HireClix</span>}
          <Badge variant="outline" className={`capitalize ${STATUS_STYLE[project.status] ?? ""}`}>
            {project.status.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="bg-muted text-muted-foreground capitalize">
            {(project.work_type ?? "project")}
          </Badge>
          <RequesterBadge requestedBy={(project as any).requested_by ?? null} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {memberIds.length > 0 && (
            <div className="flex items-center">
              {memberIds.slice(0, 3).map((uid, i) => (
                <div key={uid} className="ring-2 ring-background rounded-full" style={{ marginLeft: i === 0 ? 0 : -6 }}>
                  <UserAvatar userId={uid} size="sm" />
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onAddTask}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
          <Button size="sm" onClick={share}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>
      </div>
    </header>
  );
}

function RequesterBadge({ requestedBy }: { requestedBy: string | null }) {
  const users = useMockUsers();
  if (!requestedBy) return null;
  const u = users.find(x => x.id === requestedBy);
  if (!u) return null;
  return (
    <Badge variant="outline" className="bg-info/10 text-info border-info/30 gap-1">
      <UserCheck className="h-3 w-3" /> Requested by {u.name}
    </Badge>
  );
}
