## Goal
Add more creative-team request types to the Quick Request flow, and visually distinguish internal HireClix requests from client work.

## New request types

Keep existing 5 and add the following (recruitment-marketing creative team common asks):

- `landing_page` — **New landing page** (URL slug, audience, goal/CTA, copy doc link, brand assets link, due date, priority)
- `careersite_update` — Career site page update (URL, change description, asset link, priority)
- `job_description` — Job description rewrite (role title, current JD link, tone, deadline)
- `recruiter_collateral` — Recruiter one-pager / sell sheet (audience, key messages, brand assets, format)
- `event_collateral` — Career fair / event collateral (event name + date, deliverables checklist, brand assets)
- `presentation` — Slide deck / pitch deck (audience, slide count est., source content link, due date)
- `video_edit` — Video edit / motion (source footage link, length, captions y/n, due date)
- `photo_retouch` — Photo edit / retouch (asset link, edits needed, output specs)
- `print_collateral` — Print piece (flyer/brochure/postcard) (dimensions, bleed/no-bleed, quantity, ship date)
- `swag_apparel` — Swag / apparel design (item type, qty, colors, vendor link)
- `infographic` — Infographic / data viz (data source, key stats, format)
- `brand_assets` — Logo / brand asset request (use case, formats needed)
- `copywriting` — Copywriting (channel, audience, word count, tone, deadline)
- Keep: `web_edit`, `banner_ads`, `social`, `email`, `general`

That gives ~18 types. Grouped in the dropdown for scanability:
- **Web** — Web edit, New landing page, Career site update
- **Ads & Campaigns** — Banner ads, Social post, Email
- **Content** — Copywriting, Job description, Infographic
- **Print & Collateral** — Recruiter collateral, Event collateral, Print collateral, Swag/apparel
- **Media** — Video edit, Photo retouch, Presentation
- **Brand** — Brand assets
- **Other** — General

(Implemented as `<SelectGroup>` sections inside the existing `<Select>`.)

## Internal HireClix flagging

The cleanest signal is the client. Approach:

1. Seed a single canonical **HireClix** client row (if not present) with a known slug/flag — add `clients.is_internal boolean default false` and set true on the HireClix row. Internal flag is a property of the client, not a separate concept, so any future internal entity could be flagged similarly.
2. **Visual treatment for internal requests/projects**:
   - Dedicated purple accent (`--internal` token in `index.css`, HSL-based) used for left border + small **"Internal"** pill badge next to the title.
   - Applied on: `RequestTaskCard`, `ProjectTaskCard`, `BoardTaskCard`, `ProjectBriefingCard`, project header, and the Quick Request dialog header (shows "Internal HireClix Request" when client = HireClix).
   - In `ClientSelect`, the HireClix option gets a small purple "Internal" tag so it's obvious at pick time.
3. **Auto-detect on create**: if user picks the HireClix client in `CreateWorkDialog` / `PublicForm`, the dialog title swaps to "New Internal Request" and the accent preview appears. No new toggle for the user.

## Field schemas

Each new `request_type` gets a `pm_form_fields` seed (similar to existing). For brevity, fields listed under each type above. All seeds idempotent (matching pattern in `20260519150803_*.sql`).

## Files to touch

**Migration**
- New migration: add `clients.is_internal`, upsert HireClix client row with `is_internal=true`, insert new `pm_forms` rows (kind=`internal_request`) for each new type, insert `pm_form_fields` rows.

**Code**
- `src/components/pm/forms/useInternalRequestForm.ts` — extend `RequestType` union with all new keys.
- `src/components/pm/CreateWorkDialog.tsx` — replace flat `REQUEST_TYPES` with grouped list; render `<SelectGroup>`s; show internal banner when selected client is internal.
- `src/components/pm/ClientSelect.tsx` — read `is_internal`, render purple "Internal" tag on those options.
- `src/index.css` + `tailwind.config.ts` — add `--internal` HSL token (purple, ~270 70% 55%) and `internal` color alias.
- `src/components/pm/collections/RequestTaskCard.tsx`, `ProjectTaskCard.tsx`, `project/board/BoardTaskCard.tsx`, `workqueue/ProjectBriefingCard.tsx`, `project/ProjectHeader.tsx` — when project's client `is_internal`, show purple left border + "Internal" pill.
- `src/lib/pm/briefing.ts` / `projectTeam.ts` — include `clients.is_internal` in project fetch so cards can read it without extra round trips.
- `src/integrations/supabase/types.ts` regenerates after migration.

## Out of scope
- Per-type custom routing rules / SLAs (can come later — types are just metadata for now).
- Reporting/filtering by request type on Work Queue (separate request).
- Changing how legacy 5 types behave.
