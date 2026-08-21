/**
 * Client identity line for task/project cards — who the work is for.
 */
import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ClientContextSize = "sm" | "md";

/**
 * Primary context label: client name (linked when possible) + optional project title.
 * Hides redundant project text when it matches the task title or client name.
 */
export function ClientContext({
  clientName,
  clientId,
  projectTitle,
  taskTitle,
  size = "sm",
  className,
}: {
  clientName?: string | null;
  clientId?: string | null;
  projectTitle?: string | null;
  /** When project title equals task title, project is omitted. */
  taskTitle?: string | null;
  size?: ClientContextSize;
  className?: string;
}) {
  const client = (clientName ?? "").trim();
  const project = (projectTitle ?? "").trim();
  const task = (taskTitle ?? "").trim();

  const showProject =
    !!project &&
    project !== client &&
    (!task || project.toLowerCase() !== task.toLowerCase());

  if (!client && !showProject) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground", size === "md" ? "text-sm" : "text-xs", className)}>
        <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="italic">No client</span>
      </span>
    );
  }

  const nameClass = cn(
    "font-semibold text-foreground truncate",
    size === "md" ? "text-sm" : "text-xs",
  );
  const projectClass = cn(
    "text-muted-foreground truncate",
    size === "md" ? "text-xs" : "text-[11px]",
  );

  const clientNode = client ? (
    clientId ? (
      <Link
        to={`/pm/clients/${clientId}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(nameClass, "hover:text-primary hover:underline")}
      >
        {client}
      </Link>
    ) : (
      <span className={nameClass}>{client}</span>
    )
  ) : null;

  return (
    <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
      <Building2 className={cn("shrink-0 text-muted-foreground", size === "md" ? "h-4 w-4" : "h-3.5 w-3.5")} />
      <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
        {clientNode}
        {clientNode && showProject && <span className="text-muted-foreground/50 shrink-0">·</span>}
        {showProject && <span className={projectClass}>{project}</span>}
      </div>
    </div>
  );
}
