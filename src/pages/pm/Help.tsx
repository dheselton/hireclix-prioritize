import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Help() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-info" />
        <h1 className="text-2xl font-bold">Help & Walkthroughs</h1>
      </div>

      <Card>
        <CardContent className="p-6 prose prose-sm dark:prose-invert max-w-none">
          <h2>Career Site project — end-to-end walkthrough</h2>
          <p className="text-muted-foreground">
            From finalizing the template to editing dates so the whole schedule cascades.
          </p>

          <Section title="1 · Finalize the Career Site template">
            <ol>
              <li>Go to <strong>Templates</strong> in the sidebar.</li>
              <li>Find <em>Career Site</em> and click <strong>Edit</strong>.</li>
              <li>For every task, confirm:
                <ul>
                  <li><strong>Duration (days)</strong> is realistic.</li>
                  <li><strong>Role</strong> is set (Designer / Developer / PM / etc.) — new projects use this to suggest assignees.</li>
                  <li><strong>Phase</strong> is set so tasks group correctly in the project.</li>
                </ul>
              </li>
              <li>Lock anchor tasks:
                <ul>
                  <li>Mark <em>Kickoff</em> as <strong>Locked to kickoff</strong>.</li>
                  <li>Mark <em>Launch</em> as <strong>Locked to go-live</strong>.</li>
                </ul>
              </li>
              <li>Add <strong>dependencies</strong> so each task lists what it waits on. Without these the timeline cannot cascade.</li>
              <li>Set <strong>Default go-live offset</strong> (the panel at the top of the template editor) — this is how far out new projects start.</li>
            </ol>
          </Section>

          <Section title="2 · Start a new Career Site project">
            <ol>
              <li><strong>Projects → New Project</strong>.</li>
              <li>Pick the <strong>Career Site</strong> template.</li>
              <li>Pick a <strong>Client</strong> and a <strong>Go-live date</strong>.</li>
              <li>Click <strong>Create</strong>. The system copies every template task, dependency, and snippet link onto the new project, and seeds dates from the template offsets.</li>
              <li>Open the project → <strong>Tasks</strong> tab. Verify the phases and tasks landed.</li>
            </ol>
          </Section>

          <Section title="3 · Set the real schedule">
            <ol>
              <li>On the project header click <strong>Configure Timeline</strong>.</li>
              <li>Enter the <strong>Kickoff date</strong>.</li>
              <li>If the project has no dependencies yet, click <strong>Auto-link tasks in order</strong> — this builds a finish-to-start chain from the current sort order so the cascade has something to follow.</li>
              <li>Click <strong>Recalculate from Kickoff</strong>. A confirmation modal lists every task that will move. Review and <strong>Apply</strong>.</li>
              <li>If you already know the go-live, set both dates and click <strong>Recalculate from Go-Live</strong> — flexible tasks compress to fit the window.</li>
              <li>If you see <em>"Schedule already up to date"</em>, the dates are already valid; nothing needs to change.</li>
              <li>Use <strong>Diagnose timeline</strong> if a button seems to do nothing — it tells you whether you have dependencies, dates, and a kickoff set.</li>
            </ol>
          </Section>

          <Section title="4 · Edit one task and let the rest cascade">
            <ol>
              <li>Open <strong>Timeline</strong> (Gantt) on the project, or open a task workspace from the Tasks tab.</li>
              <li>Drag the bar in the Gantt, or change <strong>Start / Due</strong> in the workspace.</li>
              <li>The <strong>Cascade Confirm</strong> modal opens, listing every downstream task that will shift and by how many days.</li>
              <li>Click <strong>Apply</strong> — every dependent task updates at once.</li>
              <li>Tasks on the <strong>critical path</strong> (longest chain to go-live) are highlighted red on the Gantt.</li>
            </ol>
            <p className="text-muted-foreground text-xs">
              Tip: cascading only pushes tasks <em>later</em>. If you pull a task earlier, downstream tasks stay put unless you recalc from kickoff.
            </p>
          </Section>

          <Section title="5 · Add / remove people">
            <ul>
              <li><strong>Project members:</strong> Project → <em>Overview</em> → <strong>Team</strong> card → <em>Add</em> to invite a user with a project role; the <em>×</em> button removes them.</li>
              <li><strong>Assign a task:</strong> click the <strong>avatar</strong> on any board card or list row — a search popover lets you assign, change, or unassign inline.</li>
              <li><strong>Bulk reassign:</strong> on the Board (List view) select multiple rows → use the <em>Reassign</em> dropdown in the bulk actions bar.</li>
            </ul>
          </Section>

          <Section title="6 · All mode vs Me mode">
            <p>
              The toggle in the top bar controls visibility. In <strong>All</strong> mode every user sees every project and task across all teams — designers, devs, strategists, analysts, and PMs. In <strong>Me</strong> mode the view narrows to tasks assigned to you and projects you belong to, filtered by your team lane.
            </p>
          </Section>

          <Section title="7 · Page groups (Benefits, Life At, Locations…)">
            <p>
              Career site projects vary in page count (5–20+). Define a <strong>Page Group</strong> once in the template (e.g. "Content Page" → Wireframe → Design → Build → QA), then assign template tasks to that group. Add <strong>page presets</strong> (Home, Benefits, Life At, Locations, Persona…) so PMs can one-click them.
            </p>
            <ol>
              <li><strong>In the template editor</strong>: add a Page Group, then in the Tasks list set the <em>Page Group</em> column on each slot task.</li>
              <li><strong>When creating a project</strong>: the wizard adds a "Pages" step — pick presets and/or add custom names. Each page stamps out the full bundle and parallel-schedules them.</li>
              <li><strong>Mid-project</strong>: on the Tasks tab click <strong>+ Add page</strong> to stamp another page anytime. The trash icon next to a page header removes all its tasks at once.</li>
              <li>Page tasks appear under a <strong>Pages</strong> section grouped by page name, in addition to their normal status columns.</li>
            </ol>
          </Section>

        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="!mt-0">{title}</h3>
      {children}
    </section>
  );
}
