## Career Site Template — Mapped to HireClix ClickUp Plan (~90 days)

Re-seed the built-in **Career Site** template using the actual phases from the HireClix ClickUp "Career Site Project Plan (Core)" CSV: Pre-Kickoff → Kickoff → Discovery → Integration (parallel) → Concept → Design → Build → GLAAT → Go Live → Transition. Target window ~90 days, compressible to ~60 and expandable to ~120 via the existing `fitToWindow` algorithm. Dependencies are task-level (not phase-wide gates), so safe overlap is allowed where it actually happens.

**Realistic client scheduling lag is baked in.** Most client-attended meetings (discovery calls, kickoff, presentations, review meetings, UAT kickoff) get 3–7 days of `lag_days` on their incoming dependency to model the reality that calendars rarely align same-week. Lags live on the dependency rows so PMs can shorten them per-project in `ConfigureTimelinePanel` without touching the template.

---

### 1. Migration — re-seed the Career Site template

A single migration that:

1. Looks up the built-in template by `name = 'Career Site'` in `pm_project_templates`.
2. Sets `default_go_live_offset_days = 90`.
3. Deletes existing rows in `pm_template_tasks` and `pm_template_dependencies` for that `template_id` (idempotent re-seed; `pm_projects.template_id` references stay intact).
4. Inserts the task list below into `pm_template_tasks` and the dependency list into `pm_template_dependencies` (all `finish_start`, `lag_days = 0` unless noted).

Lag legend on dependencies:
- **+5d client-sched** — client meeting, allow ~1 calendar week to find a slot
- **+3d client-sched** — internal-or-light meeting, allow a few days
- **+2d prep** — internal prep / async handoff buffer

#### Phase 1 — Pre-Kickoff Activities (≈ 12 days)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| pk_email_finance | Email Finance | pm | 1 | 1 | yes (`locked_to_kickoff`) |
| pk_sow | Statement of Work / Proposal | pm | 5 | 3 | no |
| pk_assign | Assign Account Manager & Implementation team | pm | 1 | 1 | yes |
| pk_reqs | Finalize client requirements | pm | 3 | 2 | no |
| pk_rates | Negotiate rates and schedule | pm | 2 | 1 | no |
| pk_sign | Sign contract | pm | 2 | 1 | yes |
| pk_handoff_sched | Internal handoff — schedule | pm | 1 | 1 | yes |
| pk_handoff_meet | Internal handoff — conduct meeting | pm | 1 | 1 | yes |
| pk_pmintro_sched | PM Introduction — schedule | pm | 1 | 1 | yes |
| pk_pmintro_meet | PM Introduction — conduct meeting | pm | 1 | 1 | yes |
| pk_evp | Client provides EVP documentation | submitter | 5 | 2 | no |
| pk_brand | Client provides brand guidelines / fonts / logo | submitter | 5 | 2 | no |
| pk_inspo | Client provides inspiration sites & feedback | submitter | 5 | 2 | no |
| pk_currentfb | Current career site feedback | submitter | 3 | 2 | no |
| pk_setup_cu, pk_setup_plan, pk_setup_raid, pk_setup_chat, pk_setup_drive | Workspace / RAID / Chat / Drive setup (5 tasks) | pm | 1 | 1 | yes |

Deps (lag in parens):
- pk_email_finance → pk_sow
- pk_sow → pk_assign, pk_sow → pk_reqs
- pk_reqs → pk_rates → pk_sign
- pk_sign → pk_handoff_sched → pk_handoff_meet **(+3d client-sched)**
- pk_handoff_meet → pk_pmintro_sched → pk_pmintro_meet **(+5d client-sched)**
- pk_pmintro_meet → {pk_evp, pk_brand, pk_inspo, pk_currentfb}
- pk_sign → 5 setup tasks

#### Phase 2 — Project Kickoff (≈ 7 days incl. lag)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| ko_sched | Schedule kickoff call | pm | 2 | 1 | yes |
| ko_call | Kickoff call | pm | 1 | 1 | yes |

Deps: pk_pmintro_meet → ko_sched, ko_sched → ko_call **(+5d client-sched)**

#### Phase 3 — Discovery (≈ 14 days incl. inter-call lags; "Concept R1 cannot start until all 3 calls done")

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| dc1 | Discovery Call #1 — Current site / brand alignment | pm | 1 | 1 | yes |
| dc2 | Discovery Call #2 — Inspiration site review | pm | 1 | 1 | yes |
| dc3 | Discovery Call #3 — Pages, assets & copy | pm | 1 | 1 | yes |

Deps: ko_call → dc1 **(+5d client-sched)**, dc1 → dc2 **(+5d client-sched)**, dc2 → dc3 **(+5d client-sched)**

#### Phase 4 — Integration (parallel track, ≈ 25 days)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| in_kickoff | Integration kick-off | developer | 1 | 1 | yes |
| in_mapping | Integration mapping meeting | developer | 2 | 1 | yes |
| in_build | Integration build | developer | 12 | 7 | no |
| in_test | Integration testing | developer | 5 | 3 | no |

Deps: dc3 → in_kickoff **(+5d client-sched)**, in_kickoff → in_mapping **(+3d client-sched)**, in_mapping → in_build, in_build → in_test

#### Phase 5 — Concept (≈ 18 days incl. lags)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| cn_create | Create concept | designer | 7 | 5 | no |
| cn_present | Present concept mock-up (R1) | designer | 1 | 1 | yes |
| cn_clientfb | Client provides concept feedback (R1) | submitter | 4 | 3 | no |
| cn_review | Feedback review meeting (R1) | pm | 1 | 1 | yes |

Deps: dc3 → cn_create, cn_create → cn_present **(+5d client-sched)**, cn_present → cn_clientfb, cn_clientfb → cn_review **(+3d client-sched)**

(Concept gates on all three discovery calls because dc3 is the last in the chain.)

#### Phase 6 — Design (≈ 20 days incl. lags)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| dz_mockup | Design mock-up | designer | 8 | 5 | no |
| dz_present | Present mock-up (R1) | designer | 1 | 1 | yes |
| dz_clientfb | Client provides mock-up feedback (R1) | submitter | 4 | 3 | no |
| dz_review | Feedback review meeting (R1) | pm | 1 | 1 | yes |

Deps: cn_review → dz_mockup, dz_mockup → dz_present **(+5d client-sched)**, dz_present → dz_clientfb, dz_clientfb → dz_review **(+3d client-sched)**

#### Phase 7 — Build (≈ 15 days)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| bd_build | Career site build | developer | 14 | 8 | no |
| bd_analytics | Submit analytics ticket — events | developer | 2 | 1 | no |

Deps: dz_review → bd_build, dz_review → bd_analytics

#### Phase 8 — GLAAT (≈ 14 days incl. lags)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| gl_kickoff | GLAAT kick-off meeting | pm | 1 | 1 | yes |
| gl_uat | User Acceptance Testing (UAT) | pm | 5 | 5 | yes |
| gl_signoff | GLAAT sign-off | pm | 2 | 1 | yes |
| gl_dashboard | Submit analytics dashboard ticket | developer | 1 | 1 | no |
| gl_transitionprep | Schedule internal transition prep meeting | pm | 1 | 1 | yes |

Deps: bd_build → gl_kickoff **(+5d client-sched)**, in_test → gl_kickoff (build + integration must both finish), gl_kickoff → gl_uat, gl_uat → gl_signoff **(+3d client-sched)**, gl_signoff → {gl_dashboard, gl_transitionprep}

#### Phase 9 — Go Live (≈ 3 days)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| go_dns | Technical resource completes DNS updates | developer | 1 | 1 | yes |
| go_push | Push site to production | developer | 1 | 1 | yes |
| go_live | Go Live! | pm | 1 | 1 | yes (`locked_to_go_live`) |

Deps: gl_signoff → go_dns → go_push → go_live

#### Phase 10 — Transition (post go-live, ≈ 5 days)

| temp_id | Title | Role | Dur | Min | Locked |
|---|---|---|---|---|---|
| tr_support | Post go-live support calls | pm | 5 | 3 | no |

Deps: go_live → tr_support

---

### Targets after lag

- **Minimum** (locked at min, flexible compressed, lags preserved) ≈ 65 days.
- **Recommended** (durations as stated, all client-sched lags applied) ≈ 90 days.
- **Maximum** (flexible expanded) ≈ 120 days.

Lags are stored on `pm_task_dependencies.lag_days`, so a PM with a tight client can lower individual lags inside ConfigureTimelinePanel and recompute through the existing CascadeConfirmModal — no template change required.

---

### 2. Scheduler — handle lag + lock anchors

`scheduleForwardFromKickoff` and `fitToWindow` already use `start = max(predecessor.end + lag)`. Verify:

- `lag_days` from `pm_task_dependencies` is read and applied (not just zero).
- `locked_to_kickoff` short-circuits start to kickoff.
- `locked_to_go_live` short-circuits end to go-live.
- When `fitToWindow` compresses, **lags are preserved** (not scaled) — they represent calendar reality, not work content. Only `duration_days` should scale on flexible tasks.

If any of those is missing in `src/lib/pm/scheduler.ts`, add it; otherwise no engine change.

---

### 3. UI — surface the lag

Small additions so PMs understand why a task starts later than its predecessor ends:

- **GanttChart** — when an arrow has `lag_days > 0`, label it `+Nd` near the arrowhead in muted text.
- **ConfigureTimelinePanel** — for each task, list its incoming deps as `← Depends on {predecessor title} (+Nd wait)` with the `+Nd` editable inline.
- **TimelineSetupWizard step 3** — under the mini-Gantt, add a one-line legend: *"Gaps between bars include realistic client-scheduling time (typically 3–5 days). Adjust later in Configure Timeline."*

---

### 4. Files

**Modified**
- `supabase/migrations/<ts>_career_site_clickup_seed.sql` — delete-then-insert seed.
- `src/lib/pm/scheduler.ts` — verify lag handling and lock anchors; touch only if missing.
- `src/components/pm/GanttChart.tsx` — `+Nd` arrow labels.
- `src/components/pm/ConfigureTimelinePanel.tsx` — show + edit incoming-dep lag.
- `src/components/pm/TimelineSetupWizard.tsx` — one-line legend.

**Untouched**
- Templates list, TemplateBuilder, ProjectDetail — generic readers, pick up new seed automatically.

---

### 5. Validation after migration

1. Wizard with today as kickoff → suggested go-live ≈ kickoff + 90.
2. Mini-Gantt: dc2 starts ~5 days after dc1 ends, dc3 ~5 days after dc2, cn_create the day after dc3.
3. Hover an arrow between dc1→dc2 — should show `+5d`.
4. Wizard go-live = kickoff + 55 → amber warning, earliest-allowed ≈ kickoff + 65.
5. ConfigureTimelinePanel — drop the dc1→dc2 lag from 5 to 1, recompute, CascadeConfirmModal shows downstream date shifts.

---

### Open questions

1. Should client-scheduling lags be **calendar days** (current assumption — matches existing scheduler) or **business days** (more accurate but requires new scheduler logic)?
2. Want me to also add **placeholder Round 2 / Round 3** tasks under Concept and Design (locked = false, default duration 0) so PMs can enable extra rounds without manually adding tasks?
3. Should `tr_support` push the project end date past `go_live`, or stay inside the window?
