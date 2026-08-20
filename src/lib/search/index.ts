import { supabase } from "@/integrations/supabase/client";
import { parseQuery, type ParsedQuery, type SearchScope } from "./parseQuery";
import { scoreMulti, recencyBoost } from "./score";

export type ResultKind = "client" | "project" | "task" | "snippet" | "form" | "person";

export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  sub?: string;
  meta?: string;
  href: string;
  score: number;
  extra?: Record<string, any>;
}

export interface SearchBundle {
  parsed: ParsedQuery;
  groups: Partial<Record<ResultKind, SearchResult[]>>;
  totals: Partial<Record<ResultKind, number>>;
  cascadedClientIds: string[];
}

const PER_GROUP = 8;

export async function runGlobalSearch(rawQuery: string, opts: { meId?: string | null } = {}): Promise<SearchBundle> {
  const parsed = parseQuery(rawQuery);
  const term = parsed.term;
  const bundle: SearchBundle = { parsed, groups: {}, totals: {}, cascadedClientIds: [] };

  if (!term && !parsed.tag && !parsed.assignee) return bundle;

  const like = term ? `%${term}%` : "%";
  const scope = parsed.scope;

  const wants = (k: SearchScope) => scope === "all" || scope === k;

  // Fire parallel primary queries
  const [clientsRes, projectsRes, tasksRes, snippetsRes, formsRes, peopleRes] = await Promise.all([
    wants("clients") && term
      ? supabase.from("clients").select("id,name,is_internal").ilike("name", like).limit(20)
      : Promise.resolve({ data: [] as any[] }),
    wants("projects") && term
      ? supabase.from("pm_projects")
          .select("id,title,client_id,status,work_type,updated_at,tags,description")
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(30)
      : Promise.resolve({ data: [] as any[] }),
    wants("tasks") && (term || parsed.tag || parsed.assignee)
      ? buildTasksQuery(like, parsed)
      : Promise.resolve({ data: [] as any[] }),
    wants("snippets") && term
      ? supabase.from("pm_snippets")
          .select("id,title,description,tags,updated_at")
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(15)
      : Promise.resolve({ data: [] as any[] }),
    wants("forms") && term
      ? supabase.from("pm_forms").select("id,name,description,kind").ilike("name", like).limit(10)
      : Promise.resolve({ data: [] as any[] }),
    wants("people") && term
      ? supabase.from("pm_users").select("id,name,email,role").or(`name.ilike.${like},email.ilike.${like}`).limit(10)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Cascade: if any clients matched, pull their projects + top open tasks
  const matchedClientIds = (clientsRes.data ?? []).map((c: any) => c.id);
  bundle.cascadedClientIds = matchedClientIds;

  let cascadeProjects: any[] = [];
  let cascadeTasks: any[] = [];
  if (matchedClientIds.length && (scope === "all" || scope === "projects" || scope === "tasks")) {
    const cp = await supabase.from("pm_projects")
      .select("id,title,client_id,status,work_type,updated_at,tags,description")
      .in("client_id", matchedClientIds)
      .order("updated_at", { ascending: false })
      .limit(20);
    cascadeProjects = cp.data ?? [];
    const pids = cascadeProjects.map(p => p.id);
    if (pids.length && (scope === "all" || scope === "tasks")) {
      const ct = await supabase.from("pm_tasks")
        .select("id,title,project_id,status,type,tags,assignee_id,due_date,updated_at")
        .in("project_id", pids)
        .neq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(20);
      cascadeTasks = ct.data ?? [];
    }
  }

  // Merge projects (dedupe by id)
  const projectMap = new Map<string, any>();
  [...(projectsRes.data ?? []), ...cascadeProjects].forEach(p => { if (!projectMap.has(p.id)) projectMap.set(p.id, p); });

  // Merge tasks
  const taskMap = new Map<string, any>();
  [...(tasksRes.data ?? []), ...cascadeTasks].forEach(t => { if (!taskMap.has(t.id)) taskMap.set(t.id, t); });

  // Hydrate lookup tables
  const allClientIds = new Set<string>(matchedClientIds);
  projectMap.forEach(p => p.client_id && allClientIds.add(p.client_id));
  const projectIdsForLookup = new Set<string>();
  taskMap.forEach(t => t.project_id && projectIdsForLookup.add(t.project_id));

  const [clientLookup, projectLookup] = await Promise.all([
    allClientIds.size
      ? supabase.from("clients").select("id,name,is_internal").in("id", Array.from(allClientIds))
      : Promise.resolve({ data: [] as any[] }),
    projectIdsForLookup.size
      ? supabase.from("pm_projects").select("id,title,client_id").in("id", Array.from(projectIdsForLookup))
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const clientNameMap = new Map<string, string>((clientLookup.data ?? []).map((c: any) => [c.id, c.name]));
  const projectNameMap = new Map<string, { title: string; client_id: string }>(
    (projectLookup.data ?? []).map((p: any) => [p.id, { title: p.title, client_id: p.client_id }])
  );

  // Score & format
  const clientsOut: SearchResult[] = (clientsRes.data ?? []).map((c: any) => ({
    kind: "client" as const,
    id: c.id,
    title: c.name,
    sub: c.is_internal ? "Internal" : undefined,
    href: `/pm/work?client=${c.id}`,
    score: scoreMulti([c.name], term, [1.2]) + 20,
  }));

  const projectsOut: SearchResult[] = Array.from(projectMap.values()).map((p: any) => {
    const isCascade = !term || (!textMatches(p.title, term) && !textMatches(p.description, term));
    const s = scoreMulti([p.title, p.description], term, [1.2, 0.5])
      + recencyBoost(p.updated_at)
      + (p.status === "active" ? 10 : 0)
      + (isCascade && matchedClientIds.includes(p.client_id) ? 25 : 0);
    return {
      kind: "project" as const,
      id: p.id,
      title: p.title,
      sub: p.client_id ? clientNameMap.get(p.client_id) : undefined,
      meta: p.status,
      href: `/pm/projects/${p.id}`,
      score: s,
    };
  });

  const tasksOut: SearchResult[] = Array.from(taskMap.values())
    .filter((t: any) => {
      if (parsed.tag) return Array.isArray(t.tags) && t.tags.some((x: string) => (x || "").toLowerCase().includes(parsed.tag!));
      return true;
    })
    .map((t: any) => {
      const proj = t.project_id ? projectNameMap.get(t.project_id) : undefined;
      const clientName = proj?.client_id ? clientNameMap.get(proj.client_id) : undefined;
      const idRef = String(t.id).replace(/-/g, "").slice(-6).toUpperCase();
      const inMatch = parsed.inProject && proj?.title
        ? proj.title.toLowerCase().includes(parsed.inProject) ? 20 : -1000
        : 0;
      const s = scoreMulti([t.title, t.description, idRef], term, [1.2, 0.4, 2])
        + recencyBoost(t.updated_at)
        + (t.status !== "done" ? 10 : -20)
        + (opts.meId && t.assignee_id === opts.meId ? 15 : 0)
        + inMatch;
      return {
        kind: "task" as const,
        id: t.id,
        title: t.title,
        sub: [clientName, proj?.title].filter(Boolean).join(" · ") || undefined,
        meta: t.type,
        href: `/pm/tasks/${t.id}`,
        score: s,
      };
    })
    .filter(r => r.score > -100);

  const snippetsOut: SearchResult[] = (snippetsRes.data ?? []).map((s: any) => ({
    kind: "snippet" as const,
    id: s.id,
    title: s.title,
    sub: s.description || undefined,
    href: `/snippets?snippet=${s.id}`,
    score: scoreMulti([s.title, s.description], term, [1.2, 0.5]) + recencyBoost(s.updated_at),
  }));

  const formsOut: SearchResult[] = (formsRes.data ?? []).map((f: any) => ({
    kind: "form" as const,
    id: f.id,
    title: f.name,
    sub: f.description || f.kind || undefined,
    href: `/pm/forms/${f.id}/edit`,
    score: scoreMulti([f.name, f.description], term, [1.2, 0.5]),
  }));

  const peopleOut: SearchResult[] = (peopleRes.data ?? []).map((u: any) => ({
    kind: "person" as const,
    id: u.id,
    title: u.name,
    sub: u.role || u.email,
    href: `/pm/work?assignee=${u.id}`,
    score: scoreMulti([u.name, u.email], term, [1.2, 0.8]),
  }));

  const groups: Array<[ResultKind, SearchResult[]]> = [
    ["client", clientsOut],
    ["project", projectsOut],
    ["task", tasksOut],
    ["snippet", snippetsOut],
    ["form", formsOut],
    ["person", peopleOut],
  ];

  for (const [k, list] of groups) {
    const sorted = list.filter(r => r.score > 0 || (k === "task" && matchedClientIds.length))
      .sort((a, b) => b.score - a.score);
    bundle.totals[k] = sorted.length;
    bundle.groups[k] = sorted.slice(0, PER_GROUP);
  }

  return bundle;
}

function textMatches(text: string | null | undefined, term: string): boolean {
  if (!text || !term) return false;
  return text.toLowerCase().includes(term.toLowerCase());
}

async function buildTasksQuery(like: string, parsed: ParsedQuery) {
  let q = supabase.from("pm_tasks")
    .select("id,title,project_id,status,type,tags,assignee_id,due_date,updated_at,description")
    .order("updated_at", { ascending: false })
    .limit(30);
  const filters: string[] = [];
  if (parsed.term) {
    filters.push(`title.ilike.${like}`);
    filters.push(`description.ilike.${like}`);
  }
  if (filters.length) q = q.or(filters.join(","));
  if (parsed.tag) q = q.contains("tags", [parsed.tag]);
  return q;
}
