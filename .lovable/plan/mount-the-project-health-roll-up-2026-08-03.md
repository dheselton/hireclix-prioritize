# Mount the Project Health roll-up

`ProjectHealthList` (src/components/pm/workqueue/ProjectHealthList.tsx) is fully functional but never rendered. It shows one card per active project with overdue / blocked / in-review / active counts, a red-amber-green dot, and a deep link to the project.

## Where it goes

Add it as a "Project health" section at the top of the **Team Workload** page (`/pm/workload`). That page already loads every project and task and is the existing "how is the team doing" roll-up, so no new route, no new data fetching, and no sidebar entry is needed. Health of projects sits naturally above capacity of people.

## Behavior

- Section header "Project health" with a count of at-risk projects (overdue or blocked), collapsible and remembered per user in localStorage so it can be tucked away.
- Scope follows the page's existing "Me" toggle:
  - Me mode on: only projects the current user is a member of (via project members), matching the component's PM-focused intent.
  - Me mode off: all active projects.
- Visible to PM / CSM / BA / tech-lead roles (multi-role union check via the existing permissions helper); hidden for individual contributors so their Workload view stays uncluttered.
- Component internals are untouched — it only receives `projects`, `tasks`, and a `projectIds` set.

## Technical notes

- Edit `src/pages/pm/Workload.tsx` only: import `ProjectHealthList`, build the `projectIds` set from the already-cached project-members data (`useProjectTeam` / project members helper in `src/lib/pm/projectTeam.ts`), pass the tasks already in state.
- Role check uses the roles[] union pattern already used elsewhere (`canSee` / roles from `useCurrentUser`).
- Collapse state key: `pm.workload.health.open`.
