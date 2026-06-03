import { useQuery } from "@tanstack/react-query";
import { FileCode, FolderKanban, LayoutTemplate } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

type ProjectUsage = {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectTitle: string;
};

type TemplateUsage = {
  templateTaskId: string;
  templateTaskTitle: string;
  templateId: string;
  templateName: string;
};

type Usage = { projects: ProjectUsage[]; templates: TemplateUsage[] };

async function fetchUsage(snippetId: string): Promise<Usage> {
  const [taskRes, tplRes] = await Promise.all([
    supabase
      .from("pm_task_snippets")
      .select("task:pm_tasks(id, title, project_id, pm_projects(title))")
      .eq("snippet_id", snippetId),
    supabase
      .from("pm_template_task_snippets")
      .select("template_task:pm_template_tasks(id, title, template_id, pm_project_templates(name))")
      .eq("snippet_id", snippetId),
  ]);

  const projects: ProjectUsage[] = ((taskRes.data ?? []) as any[])
    .map(r => r.task)
    .filter(Boolean)
    .map(t => ({
      taskId: t.id,
      taskTitle: t.title,
      projectId: t.project_id,
      projectTitle: t.pm_projects?.title ?? "Project",
    }));

  const templates: TemplateUsage[] = ((tplRes.data ?? []) as any[])
    .map(r => r.template_task)
    .filter(Boolean)
    .map(t => ({
      templateTaskId: t.id,
      templateTaskTitle: t.title,
      templateId: t.template_id,
      templateName: t.pm_project_templates?.name ?? "Template",
    }));

  return { projects, templates };
}

export function SnippetUsageFooter({ snippetId }: { snippetId: string }) {
  const { data } = useQuery({
    queryKey: ["snippet-usage", snippetId],
    queryFn: () => fetchUsage(snippetId),
    staleTime: 30_000,
  });

  const projects = data?.projects ?? [];
  const templates = data?.templates ?? [];
  const total = projects.length + templates.length;

  if (total === 0) {
    return <span className="text-[12px] text-muted-foreground">Not used yet</span>;
  }

  const summary = [
    projects.length > 0 && `${projects.length} project${projects.length === 1 ? "" : "s"}`,
    templates.length > 0 && `${templates.length} template${templates.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline">
          <FileCode className="h-3.5 w-3.5" />
          Used in {summary}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2 max-h-80 overflow-y-auto">
        {projects.length > 0 && (
          <div className="mb-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-2 py-1">
              Projects
            </div>
            {projects.map(p => (
              <Link
                key={p.taskId}
                to={`/pm/tasks/${p.taskId}`}
                className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-accent text-[13px]"
              >
                <FolderKanban className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p.taskTitle}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {p.projectTitle}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {templates.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-2 py-1">
              Templates
            </div>
            {templates.map(t => (
              <Link
                key={t.templateTaskId}
                to={`/pm/templates/${t.templateId}/edit`}
                className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-accent text-[13px]"
              >
                <LayoutTemplate className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.templateTaskTitle}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {t.templateName}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
