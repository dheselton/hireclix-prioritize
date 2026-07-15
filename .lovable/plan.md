
## What search does today

`src/components/GlobalSearch.tsx` runs three parallel `ilike` queries on:
- `pm_projects.name`
- `pm_tasks.title`
- `clients.name`

Then flat-lists them. Typing "resideo" surfaces only the client row because there's no project literally named "Resideo" — the search never traverses **client → projects → tasks**, never looks at descriptions/tags/pages/snippets/forms, and has no fuzzy matching, recents, or scoping.

## Goals

1. Type a client name and immediately see that client's projects and open tasks.
2. Cover every navigable entity users think about.
3. Rank intelligently, group by type, and make keyboard flow effortless.
4. Stay fast (<150ms perceived) with cheap Postgres queries — no new infra.

## New search surface (UX)

Replace the current dropdown with a **command-palette style panel** opened from the header input or `⌘K`:

```text
┌───────────────────────────────────────────────────────────┐
│  🔍  resideo                                    esc  ⏎    │
├───────────────────────────────────────────────────────────┤
│  RECENT                                                   │
│    • Resideo — Careers Refresh          project           │
│    • Update job feed mapping            task              │
├───────────────────────────────────────────────────────────┤
│  CLIENTS (1)                                              │
│    🏢 Resideo                          3 projects · 12 open│
├───────────────────────────────────────────────────────────┤
│  PROJECTS (3)   ← auto-expanded when a client matches     │
│    📁 Resideo — Careers Refresh        Active · 08/12     │
│    📁 Resideo — Job Feed Rebuild       Support mode       │
│    📁 Resideo — Q3 Content             Planning           │
├───────────────────────────────────────────────────────────┤
│  TASKS (8 shown · 24 total →)                             │
│    ✅ Update job feed mapping          Resideo · Dev      │
│    ✅ QA new careers hero              Resideo · Design   │
│    …                                                      │
├───────────────────────────────────────────────────────────┤
│  PAGES · SNIPPETS · FORMS · PEOPLE  (collapsed if empty)  │
├───────────────────────────────────────────────────────────┤
│  Tip: type  p:  t:  c:  @  #  to scope                    │
└───────────────────────────────────────────────────────────┘
```

Key UX behaviors:
- **Grouped sections** with counts; each group has a "See all N →" that deep-links to `/pm/work?q=…` or `/pm/projects?client=…`.
- **Client → cascade**: when a client matches, its projects and open tasks are auto-fetched and shown even if they don't textually match the query. This is the fix for the reported "only shows the client" issue.
- **Scoping prefixes** in the input:
  - `c:acme` clients only
  - `p:careers` projects only
  - `t:qa` tasks only
  - `#tag` tag filter
  - `@user` assignee filter
  - `in:resideo qa hero` = tasks in projects matching "resideo" that also contain "qa hero"
- **Recents** (localStorage, last 8) shown when input is empty on focus.
- **Keyboard**: ↑/↓ traverses across groups, `⏎` opens, `⌘⏎` opens in new tab, `Tab` cycles group focus, `esc` closes. Selected row shows subtle right-side hint text.
- **Empty state**: "No matches — try `c:`, `p:`, `t:`, `#tag`, `@user`" plus quick chips to broaden the search.
- **Loading**: shimmer rows per group instead of a single spinner so layout doesn't jump.
- **Highlight** matched substring in bold within each row.

## Data sources (all existing tables)

| Group | Source | Fields matched |
|---|---|---|
| Clients | `clients` | name |
| Projects | `pm_projects` | name, description, tags |
| Tasks | `pm_tasks` | title, description, tags, REQ-ref (last6 of id) |
| Pages | `pm_project_pages` | page_label |
| Snippets | `pm_snippets` | title, description, tags |
| Forms | `pm_forms` | name |
| People | `mock_users` | name, email |

Cascade rule: if a client matches, also pull `pm_projects` where `client_id in (matchedClientIds)` and top open `pm_tasks` where `project_id in (thoseProjects)`.

## Ranking

Simple client-side score per row:
- +100 exact match on primary field
- +60 starts-with
- +30 contains (word boundary)
- +15 contains (substring)
- +20 if entity is active/open (project active, task not done)
- +10 if user is assignee/member
- +5 if updated in last 7d
- −20 if archived/done
Break ties by `updated_at desc`.

## Technical plan

New files:
- `src/components/search/GlobalSearchPanel.tsx` — the palette UI (replaces the dropdown in `GlobalSearch.tsx`; `GlobalSearch.tsx` becomes a thin trigger wrapper).
- `src/components/search/SearchGroup.tsx`, `SearchRow.tsx`, `SearchHighlight.tsx`, `SearchEmpty.tsx`.
- `src/lib/search/index.ts` — `runGlobalSearch(query, { scope, meId })` orchestrates parallel Supabase queries + cascade + scoring. Debounced 180ms, aborts in-flight on new keystroke.
- `src/lib/search/parseQuery.ts` — parses `c:` `p:` `t:` `#` `@` prefixes.
- `src/lib/search/recents.ts` — localStorage recents (`lovable:pm:search:recents`).
- `src/lib/search/score.ts` — ranking helpers.

Edited:
- `src/components/GlobalSearch.tsx` — keep the input; mount `<GlobalSearchPanel />` in a portal on focus/⌘K; remove inline three-query logic.
- `src/components/TopBar.tsx` — no visual change; just still renders `<GlobalSearch />`.

Not changed: backend schema, RLS, routes. All new queries are read-only against existing tables and use existing indices (`ilike` on the same short-text columns already queried today, plus one additional `in()` cascade per matched client).

## Out of scope (call out for follow-up)

- Server-side full-text (`tsvector`) — worth adding once dataset grows; not needed for v1.
- Fuzzy typo tolerance (trigram) — can layer `pg_trgm` later without UI changes.
- Search analytics / "no result" logging.
