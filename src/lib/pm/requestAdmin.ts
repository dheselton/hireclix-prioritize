import type { PmProject } from '@/types/pm';

export type RequestProjectRef = {
  projectId: string;
  workType: string | null | undefined;
  title?: string | null;
};

/** Deduplicate selected inbox rows down to unique request projects only. */
export function dedupeRequestProjects(rows: RequestProjectRef[]): RequestProjectRef[] {
  const seen = new Set<string>();
  const out: RequestProjectRef[] = [];
  for (const row of rows) {
    if (!row.projectId || row.projectId === '_no_project') continue;
    if ((row.workType ?? 'project') !== 'request') continue;
    if (seen.has(row.projectId)) continue;
    seen.add(row.projectId);
    out.push(row);
  }
  return out;
}

export function requestProjectsFromInboxRows(
  rows: { project?: PmProject | undefined }[],
): RequestProjectRef[] {
  return dedupeRequestProjects(
    rows.map(r => ({
      projectId: r.project?.id ?? '_no_project',
      workType: r.project?.work_type,
      title: r.project?.title,
    })),
  );
}
