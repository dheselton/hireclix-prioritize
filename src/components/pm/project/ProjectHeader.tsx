import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Plus, UserCheck, MoreHorizontal, Trash2, Pencil, LifeBuoy, RotateCcw, Headphones } from "lucide-react";
import { EditProjectDialog } from "./EditProjectDialog";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { useMockUsers, useCurrentUser } from "@/lib/pm/mockUser";
import { useInternalClientIds, useCareerSiteProjects } from "@/lib/pm/clients";
import { deleteProject } from "@/lib/pm/api";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { useEnterSupportMode } from "@/lib/pm/supportMode";
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

export function ProjectHeader({ project, onAddTask, onLogSupportRequest }: {
  project: PmProject; onAddTask: () => void;
  onLogSupportRequest?: () => void;
}) {
  const [clientName, setClientName] = useState<string>("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const internalIds = useInternalClientIds();
  const careerSiteMap = useCareerSiteProjects();
  const isInternal = !!project.client_id && internalIds.has(project.client_id);
  const isCareerSite = careerSiteMap.has(project.id);
  const supportModeAt = (project.custom_fields as any)?.support_mode_at as string | undefined;
  const inSupport = !!supportModeAt;
  const { user } = useCurrentUser();
  const isPM = user?.role === "pm";
  const navigate = useNavigate();
  const { enter: enterSupport, busy: enteringSupport } = useEnterSupportMode(project);

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
          {isPM ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-[20px] font-medium leading-tight truncate text-left hover:text-primary transition-colors"
              title="Click to edit project"
            >
              {project.title}
            </button>
          ) : (
            <h1 className="text-[20px] font-medium leading-tight truncate">{project.title}</h1>
          )}
          {isInternal && <span className="internal-pill">Internal · HireClix</span>}
          {inSupport ? (
            <Badge variant="outline" className="bg-info/15 text-info border-info/30 gap-1">
              <Headphones className="h-3 w-3" /> Support mode
            </Badge>
          ) : (
            <Badge variant="outline" className={`capitalize ${STATUS_STYLE[project.status] ?? ""}`}>
              {project.status.replace(/_/g, " ")}
            </Badge>
          )}
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
          {inSupport && onLogSupportRequest && (
            <Button size="sm" onClick={onLogSupportRequest}>
              <LifeBuoy className="h-4 w-4 mr-1" /> Log support request
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAddTask}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
          <Button size="sm" variant={inSupport ? "outline" : "default"} onClick={share}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
          {isPM && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2" aria-label="Project actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditOpen(true); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit project
                </DropdownMenuItem>
                {isCareerSite && !inSupport && (
                  <DropdownMenuItem
                    disabled={supportBusy}
                    onSelect={async (e) => {
                      e.preventDefault();
                      setSupportBusy(true);
                      try {
                        const next = { ...(project.custom_fields ?? {}), support_mode_at: new Date().toISOString() };
                        const { error } = await supabase.from("pm_projects")
                          .update({ custom_fields: next }).eq("id", project.id);
                        if (error) throw error;
                        toast.success("Project is now in Support mode");
                        emitTasksChanged();
                      } catch (err: any) {
                        toast.error(err?.message ?? "Could not enter Support mode");
                      } finally {
                        setSupportBusy(false);
                      }
                    }}
                  >
                    <Headphones className="h-4 w-4 mr-2" /> Enter Support mode
                  </DropdownMenuItem>
                )}
                {inSupport && (
                  <DropdownMenuItem
                    disabled={supportBusy}
                    onSelect={async (e) => {
                      e.preventDefault();
                      if (!confirm("Exit Support mode? Build tasks will return to the main board.")) return;
                      setSupportBusy(true);
                      try {
                        const next = { ...(project.custom_fields ?? {}) };
                        delete next.support_mode_at;
                        const { error } = await supabase.from("pm_projects")
                          .update({ custom_fields: next }).eq("id", project.id);
                        if (error) throw error;
                        toast.success("Exited Support mode");
                        emitTasksChanged();
                      } catch (err: any) {
                        toast.error(err?.message ?? "Could not exit Support mode");
                      } finally {
                        setSupportBusy(false);
                      }
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Exit Support mode
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => { e.preventDefault(); setConfirmDelete(true); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{project.title}</span> and all of its
              tasks, dependencies, comments, attachments, time entries, and activity will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try {
                  await deleteProject(project.id);
                  toast.success("Project deleted");
                  setConfirmDelete(false);
                  navigate("/pm/work");
                } catch (err: any) {
                  toast.error(err?.message ?? "Could not delete project");
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isPM && (
        <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      )}
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
