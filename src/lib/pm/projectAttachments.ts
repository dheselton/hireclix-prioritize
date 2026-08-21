/**
 * Merged project + task attachments for a single project.
 * Used by FilesTab (full library) and Overview (recent preview).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectFileRow {
  id: string;
  type: string; // 'file' | 'link'
  name: string;
  url: string;
  label: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  task_id: string | null;
  /** True when the row lives in pm_project_attachments (not a task attachment). */
  is_project_level: boolean;
}

export async function fetchProjectAttachments(projectId: string): Promise<ProjectFileRow[]> {
  const [{ data: pa }, { data: ta }] = await Promise.all([
    supabase
      .from("pm_project_attachments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pm_attachments")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false }),
  ]);

  const projectRows: ProjectFileRow[] = ((pa as any[]) || []).map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    url: r.url,
    label: r.label,
    file_size: r.file_size,
    uploaded_by: r.uploaded_by,
    created_at: r.created_at,
    task_id: null,
    is_project_level: true,
  }));

  const taskRows: ProjectFileRow[] = ((ta as any[]) || []).map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    url: r.url,
    label: r.label,
    file_size: r.file_size,
    uploaded_by: r.uploaded_by,
    created_at: r.uploaded_at,
    task_id: r.task_id,
    is_project_level: false,
  }));

  return [...projectRows, ...taskRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function useProjectAttachments(projectId: string | null | undefined) {
  const [files, setFiles] = useState<ProjectFileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!projectId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setFiles(await fetchProjectAttachments(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { files, loading, reload };
}
