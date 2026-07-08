import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function Help() {
  return (
    <div className="p-3 md:p-6 max-w-3xl mx-auto space-y-6">
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

          <Section title="7 · Page groups & reserved time (Benefits, Life At, Locations…)">
            <p>
              Most career site projects don't know their final page list until Discovery wraps. The platform handles that by
              <strong> reserving time across every phase your page tasks touch </strong>
              (Design, Build, QA, etc.) at project creation, then <strong>consuming</strong> that reservation as you add real pages.
            </p>
            <ol>
              <li><strong>In the template editor</strong>: define one or more Page Groups (e.g. "Content Page"). Assign the slot tasks (Wireframe, Design, Build, QA) to that group. Set the group's <em>Expected pages</em> (default 5) and <em>Parallel cap</em> (default 3 — how many pages your team can work on at once in a single phase).</li>
              <li><strong>Per-phase reserved days</strong> auto-compute as <em>(sum of slot task days in that phase × expected pages ÷ parallel cap)</em>. Override any phase manually in the template editor if your team works differently.</li>
              <li><strong>Creating a project</strong>: the wizard skips the Pages step by default and shows a reservation summary. The schedule includes one <em>reservation placeholder task per group per phase</em>, sized to your formula — so Go-Live already accounts for the work.</li>
              <li>If you already know the pages, tick <strong>"I already know the pages"</strong> in the wizard and pick them — the system stamps them immediately and skips reservations.</li>
              <li><strong>After Discovery</strong>: open the project's <strong>Pages</strong> tab, click <strong>Add pages</strong>, paste your page list (one per line), and pick the group. Each page stamps the full bundle and <strong>shrinks the matching reservation tasks</strong> in each phase. If you go over the reservation, normal cascade rules push downstream tasks (Go-Live moves with confirmation).</li>
              <li>Remove a page anytime from the Pages tab — all its tasks delete together; reserved time is <em>not</em> auto-refunded so the schedule stays stable.</li>
            </ol>
            <p className="text-muted-foreground text-xs">
              Tip: the Pages tab shows defined-vs-expected count and remaining reserved days per group, so you can see at a glance whether your group is still within budget.
            </p>
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
