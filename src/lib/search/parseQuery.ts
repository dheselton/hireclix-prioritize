export type SearchScope = "all" | "clients" | "projects" | "tasks" | "snippets" | "forms" | "people";

export interface ParsedQuery {
  raw: string;
  term: string;           // main text after prefixes stripped
  scope: SearchScope;
  tag?: string;           // #tag
  assignee?: string;      // @user
  inProject?: string;     // in:foo
}

const SCOPE_MAP: Record<string, SearchScope> = {
  c: "clients", client: "clients", clients: "clients",
  p: "projects", project: "projects", projects: "projects",
  t: "tasks", task: "tasks", tasks: "tasks",
  s: "snippets", snippet: "snippets", snippets: "snippets",
  f: "forms", form: "forms", forms: "forms",
  u: "people", user: "people", people: "people", who: "people",
};

export function parseQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = { raw, term: raw.trim(), scope: "all" };
  if (!out.term) return out;

  const parts = out.term.split(/\s+/);
  const rest: string[] = [];
  for (const p of parts) {
    if (p.startsWith("#") && p.length > 1) { out.tag = p.slice(1).toLowerCase(); continue; }
    if (p.startsWith("@") && p.length > 1) { out.assignee = p.slice(1).toLowerCase(); continue; }
    const colon = p.indexOf(":");
    if (colon > 0) {
      const key = p.slice(0, colon).toLowerCase();
      const val = p.slice(colon + 1);
      if (SCOPE_MAP[key]) {
        out.scope = SCOPE_MAP[key];
        if (val) rest.push(val);
        continue;
      }
      if (key === "in" && val) { out.inProject = val.toLowerCase(); continue; }
    }
    rest.push(p);
  }
  out.term = rest.join(" ").trim();
  return out;
}
