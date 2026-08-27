import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Share2, Plus, MoreHorizontal, Trash2, Pencil, LifeBuoy,
  RotateCcw, Headphones, Bug, ListPlus, Building2, Calendar,
} from "lucide-react";
import { EditProjectDialog } from "./EditProjectDialog";
import { ProjectAssignmentsBar } from "./ProjectAssignmentsBar";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { useInternalClientIds, useCareerSiteProjects } from "@/lib/pm/clients";
import { deleteProject } from "@/lib/pm/api";
import { emitTasksChanged } from "@/lib/pm/refresh";
import { useEnterSupportMode } from "@/lib/pm/supportMode";
import { isInQaMode, useEnterQaMode, useExitQaMode } from "@/lib/pm/qaMode";
import { fmtDate } from "@/lib/pm/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/pm/ConfirmDialog";
import { SharePortalDialog } from "@/components/pm/portal/SharePortalDialog";
import { AttributionChip } from "@/components/pm/AttributionChip";
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

export function ProjectHeader({ project, onAddTask, onLogSupportRequest, onLogQaBatch }: {
  project: PmProject; onAddTask: () => void;
  onLogSupportRequest?: () => void;
  onLogQaBatch?: () => void;
}) {
  const [clientName, setClientName] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [confirmExitSupport, setConfirmExitSupport] = useState(false);
  const [confirmExitQa, setConfirmExitQa] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const internalIds = useInternalClientIds();
  const careerSiteMap = useCareerSiteProjects();
  const isInternal = !!project.client_id && internalIds.has(project.client_id);
  const isCareerSite = careerSiteMap.has(project.id);
  const supportModeAt = (project.custom_fields as any)?.support_mode_at as string | undefined;
  const inSupport = !!supportModeAt;
  const inQa = isInQaMode(project);
  const { roles } = useCurrentUser();
  const isPM = roles.includes("pm");
  const navigate = useNavigate();
  const { enter: enterSupport, busy: enteringSupport } = useEnterSupportMode(project);
  const { enter: enterQa, busy: enteringQa } = useEnterQaMode(project);
  const { exit: exitQa, busy: exitingQa } = useExitQaMode(project);

  const contactName = (project as any).client_contact_name as string | null | undefined;
  const contactEmail = (project as any).client_contact_email as string | null | undefined;

  useEffect(() => {
    (async () => {
      if (project.client_id) {
        const { data } = await supabase.from("clients").select("name").eq("id", project.client_id).maybeSingle();
        setClientName((data as any)?.name ?? "");
      } else setClientName("");
    })();
  }, [project.id, project.client_id]);

  const canManagePortal = roles.some(r => r === "pm" || r === "ba" || r === "tech_lead");

  return (
    <header className="space-y-3">
      <nav className="text-xs text-muted-foreground">
        <Link to="/pm/work" className="hover:text-foreground">Projects</Link>
        {clientName && (
          <>
            <span className="mx-1">/</span>
            {project.client_id ? (
              <Link to={`/pm/clients/${project.client_id}`} className="hover:text-foreground">
                {clientName}
              </Link>
            ) : (
              <span>{clientName}</span>
            )}
          </>
        )}
      </nav>

      <div className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${isInternal ? "internal-border-l pl-3 -ml-3" : ""}`}>
        <div className="min-w-0 space-y-2 flex-1">
          {/* Client — primary context, not buried in breadcrumb */}
          <div className="flex items-center gap-2 flex-wrap">
            {project.client_id && clientName ? (
              <Link
                to={`/pm/clients/${project.client_id}`}
                className="inline-flex items-center gap-1.5 text-base sm:text-lg font-semibold text-foreground hover:text-primary transition-colors"
              >
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                <span className="truncate">{clientName}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-base sm:text-lg font-semibold text-muted-foreground">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                No client
              </span>
            )}
            {isInternal && <span className="internal-pill">Internal · HireClix</span>}
            {(contactName || contactEmail) && (
              <span className="text-sm text-muted-foreground truncate">
                {contactName || contactEmail}
                {contactName && contactEmail ? ` · ${contactEmail}` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {isPM ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="text-xl sm:text-2xl font-semibold leading-tight truncate text-left hover:text-primary transition-colors max-w-full"
                title="Click to edit project"
              >
                {project.title}
              </button>
            ) : (
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight truncate max-w-full">{project.title}</h1>
            )}
            {inQa ? (
              <Badge variant="outline" className="bg-[hsl(345_80%_55%/0.15)] text-[hsl(345_80%_45%)] border-[hsl(345_80%_55%/0.4)] gap-1">
                <Bug className="h-3 w-3" /> QA / Go-live testing
              </Badge>
            ) : inSupport ? (
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
            <AttributionChip
              created_by={project.created_by}
              creation_source={project.creation_source}
              creation_context={project.creation_context}
              requested_by={project.requested_by}
              variant="badge"
              hideManualSource={false}
            />
          </div>

          {/* Key dates — always visible, large enough to scan */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            <MetaDate label="Kickoff" value={project.kickoff_date} />
            <MetaDate label="Client review" value={project.start_date} />
            <MetaDate label="Go-live" value={project.go_live_date} emphasize />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
          {inSupport && onLogSupportRequest && (
            <Button size="sm" onClick={onLogSupportRequest} className="flex-1 sm:flex-none">
              <LifeBuoy className="h-4 w-4 mr-1" /> <span className="truncate">Log support request</span>
            </Button>
          )}
          {inQa && onLogQaBatch && (
            <Button size="sm" onClick={onLogQaBatch} className="flex-1 sm:flex-none">
              <ListPlus className="h-4 w-4 mr-1" /> <span className="truncate">Log QA batch</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAddTask} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
          <Button size="sm" variant={inSupport ? "outline" : "default"} onClick={() => setShareOpen(true)} className="flex-1 sm:flex-none">
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
                    disabled={enteringSupport}
                    onSelect={(e) => { e.preventDefault(); enterSupport(); }}
                  >
                    <Headphones className="h-4 w-4 mr-2" /> Enter Support mode
                  </DropdownMenuItem>
                )}
                {inSupport && (
                  <DropdownMenuItem
                    disabled={supportBusy}
                    onSelect={(e) => { e.preventDefault(); setConfirmExitSupport(true); }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Exit Support mode
                  </DropdownMenuItem>
                )}
                {!inQa ? (
                  <DropdownMenuItem
                    disabled={enteringQa}
                    onSelect={(e) => { e.preventDefault(); enterQa(); }}
                  >
                    <Bug className="h-4 w-4 mr-2" /> Enter QA / Go-live mode
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={exitingQa}
                    onSelect={(e) => { e.preventDefault(); setConfirmExitQa(true); }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Exit QA mode
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

      <ProjectAssignmentsBar projectId={project.id} />

      <SharePortalDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        clientId={project.client_id ?? null}
        canManagePortal={canManagePortal}
      />

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

      <ConfirmDialog
        open={confirmExitSupport}
        onOpenChange={setConfirmExitSupport}
        title="Exit Support mode?"
        description="Build tasks will return to the main board. Support tickets are not deleted."
        confirmLabel="Exit Support mode"
        destructive={false}
        onConfirm={async () => {
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
      />

      <ConfirmDialog
        open={confirmExitQa}
        onOpenChange={setConfirmExitQa}
        title="Exit QA mode?"
        description="QA tickets stay in the project, but the QA tab will be hidden."
        confirmLabel="Exit QA mode"
        destructive={false}
        onConfirm={async () => { await exitQa(); }}
      />

      {isPM && (
        <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      )}
    </header>
  );
}

function MetaDate({ label, value, emphasize }: { label: string; value: string | null; emphasize?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5 min-w-0">
      <Calendar className={`h-3.5 w-3.5 shrink-0 ${emphasize ? "text-primary" : "text-muted-foreground"}`} />
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${emphasize ? "text-foreground" : "text-foreground/90"}`}>
        {fmtDate(value)}
      </span>
    </div>
  );
}
