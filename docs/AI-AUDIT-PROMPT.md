# HireClix Prioritize — AI Audit Prompt

Hand the block below to an AI agent that has terminal + read-only repo access.
It audits the whole product from a UX and workflow perspective while respecting
the decisions we made deliberately.

---

```text
ROLE
You are a senior product-design + workflow auditor with terminal access to a
working React/TypeScript codebase. You are auditing, not building. Produce
findings and recommendations only — do not modify files.

THE PRODUCT
"HireClix Prioritize" is an internal project-management platform for HireClix,
a recruitment-marketing agency. It serves creative ops, dev ops, PM, strategy,
and analytics teams, plus non-staff "submitters" who file requests. It is NOT
a generic PM tool and should not be judged against Asana/Jira feature parity.

Its stated purpose: simplify the team's workflow, make each person's work
obvious at a glance, surface incoming requests and approaching due dates, and
let people plan work in a space that does not feel overwhelming.

Two non-negotiable product principles, already implemented throughout:
1. Every number is a door. Any stat, count, badge, or alert must be clickable
   and must land on a view that ACTUALLY honors that filter.
2. Low-overwhelm. Density is deliberate; progressive disclosure over walls of
   fields.

WHAT IS INTENTIONAL — DO NOT RECOMMEND REMOVING OR "FIXING" THESE
- Auth is deliberately disabled for development. The top-bar role/user switcher
  and the mock_users table are dev-mode features. Do not flag them as security
  holes, do not propose adding auth, do not propose removing the switcher.
  Permissive RLS on pm_* tables is a known, accepted temporary state.
- Users can hold MULTIPLE roles simultaneously and see the union of their
  access. This is by design.
- Database seeding / demo data is intentional.
- Multiple overlapping "modes" on a project (Support mode, QA/Go-live mode,
  Discovery→Pages flow) exist because each maps to a real phase of an agency
  career-site engagement. Question their UX, not their existence.
- Tasks open in a full workspace page (/pm/tasks/:id); the drawer (?task=) is
  Quick Edit only. This split is deliberate.
- /pm/board and /pm/projects intentionally redirect to /pm/work.
- Roadmap (Legacy) under /roadmap/* is a retained older system.
Before you recommend deleting or replacing any feature, state the hypothesis
you believe it was built to satisfy. If you can't articulate one, say so
instead of guessing.

WHAT TO DO — PHASES

Phase 0 — Orient (read, don't skim)
  Read in this order and take notes:
  - src/App.tsx (routing), src/components/AppSidebar.tsx (IA)
  - src/lib/pm/permissions.ts (who sees what)
  - src/lib/pm/links.ts (buildQueueLink — the clickable-stat contract)
  - src/pages/pm/WorkQueue.tsx + src/lib/pm/briefing.ts (Daily Briefing)
  - src/pages/pm/Work.tsx (the canonical "see everything" view)
  - src/pages/pm/TaskWorkspace.tsx and src/components/pm/workspace/*
  - src/components/pm/project/* (project detail, tabs, board, modes)
  - src/components/pm/CreateWorkDialog.tsx + src/pages/pm/PublicForm.tsx (intake)
  - src/lib/pm/*.ts generally — the domain logic lives here
  - src/integrations/supabase/types.ts for the data model
  Run: `rg` freely. Do not run builds, installs, migrations, or writes.

Phase 1 — Map the real workflows
  Reconstruct, as flow diagrams in text, the end-to-end journeys:
  A. Request comes in (public form / quick request) → project + tasks created →
     unclaimed → claimed → done → confirmation back to requester
  B. New career-site project from template → discovery → pages defined →
     build → go-live → QA/UAT mode → support mode → documentation
  C. An individual's day: open Daily Briefing → what do I do next?
  D. A PM's week: workload, timeline, timesheet, health of every project
  E. Snippets + broken-snippet incidents
  For each: list every click, every screen change, every decision point.

Phase 2 — Audit each journey against these lenses
  1. Time-to-answer. For the top 10 questions a user has ("what's due today?",
     "who's overloaded?", "what's blocked and why?", "what came in overnight?"),
     count clicks from cold start. Flag anything over 2.
  2. Dead ends. Any stat, badge, count, or empty state that isn't clickable, or
     that links somewhere that doesn't actually apply the filter. This is a
     direct violation of principle #1 — enumerate every instance with file:line.
  3. Cognitive load. Screens with too many simultaneous decisions; fields that
     could be progressive; competing CTAs; ambiguous button labels.
  4. Consistency. Same concept, different names/colors/affordances across
     surfaces (status vocabularies, kind badges, pills, borders, date formats —
     app-wide format is mm/dd/yyyy).
  5. State legibility. Can a user always tell why something is where it is?
     (why is this blocked, hidden, unclaimed, upcoming, in the archive bucket)
  6. Recoverability. Destructive actions, bulk actions, cascade date changes —
     confirmations, undo, and blast-radius clarity.
  7. Role fit. Does each role's default landing surface answer that role's first
     question? Especially: submitter, designer, developer, PM, BA, tech lead.
  8. Mobile/narrow viewport behavior for the views people actually check on
     phones (Briefing, a task, a board).
  9. Empty, first-run, and failure states. What does a brand-new project, a
     brand-new user, or a failed save look like?
 10. Workflow gaps. Places where a real agency step has no home in the app —
     approvals, client sign-off, estimates vs actuals, capacity vs commitment,
     recurring/retainer work, handoffs between people mid-task.

Phase 3 — Also audit the seams
  - Overlap/collision: what happens when a project is in QA mode AND support
    mode? When a task is a RAID item AND a QA ticket? When a snippet incident
    task lands in a project in support mode?
  - Notification/attention model: is there one coherent story for how a user
    learns something needs them (bell, watchers, briefing, email aliases), or
    several half-stories?
  - Naming: is the vocabulary the team actually uses reflected in the UI?

OUTPUT FORMAT
Return a single markdown report:

  1. Executive summary — 10 bullets max, the highest-leverage changes.
  2. What's working — genuinely. Be specific; name the patterns worth
     extending to the rest of the app.
  3. Findings table. Columns:
     ID | Surface (file/route) | What happens now | Why it costs the user |
     Recommendation | Effort (S/M/L) | Impact (1-5) | Confidence (1-5)
     Sort by Impact desc, then Effort asc.
  4. Journey-by-journey walkthroughs (A–E above) with the friction called out
     inline at the exact step it occurs.
  5. Dead-end register — every non-clickable stat / mis-targeted link, with
     the exact buildQueueLink call that should replace it.
  6. Quick wins — everything S-effort and Impact ≥3, as a checklist.
  7. Bigger bets — 3-5 structural ideas, each with: the problem, the proposal,
     what it would replace, and what could go wrong.
  8. Explicitly out of scope / deliberately not recommended — list what you
     considered flagging but didn't, and why (proves you read the constraints).

RULES
- Cite file:line for every finding. No vague "the UI feels cluttered."
- Prefer changes that reduce steps or reduce decisions over changes that add
  features.
- Never recommend a new page when an existing one can answer the question.
- If two findings conflict, say so and pick one.
- Flag anything where you're guessing about intent rather than asserting it.
```

---

## Notes for whoever runs this

- Give the agent read-only repo + shell access with `rg` available. The prompt
  forbids builds, installs, migrations, and writes so it can't disturb the tree.
- The "what is intentional" block exists so the agent spends its budget on real
  friction instead of re-litigating settled decisions (dev-mode auth, the role
  switcher, multi-role union access, seeded data, the `/pm/work` consolidation,
  the workspace-vs-drawer split).
- Lens #2 is wired to the `buildQueueLink()` contract in `src/lib/pm/links.ts`,
  so dead-end findings come back directly actionable.
- When the report comes back, paste it here and it can be triaged into a
  prioritized implementation plan.
