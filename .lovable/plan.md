
## Goal

Turn the "General" request form (currently just a Notes field) into a proper creative intake driven by a **Creative Type** dropdown. Selecting a type reveals a focused set of fields tailored to that deliverable. Types come from last year's request mix (screenshot provided).

## How it will feel

1. Submitter picks Creative Type.
2. The form instantly swaps in only the fields relevant to that type (plus a small always-visible common section).
3. No wall of irrelevant questions — thorough per type but nothing extra.

## Creative Types (dropdown)

Career Site · General Web/Email design · Display ad · Creative for social · Video/Animation · Flyer · Marketing Campaign · Business card/post card · Offline advertising for event · Offline advertising for facility

## Always-visible common fields

- Deadline (date, required)
- Purpose / goal (textarea, required)
- Target audience (text)
- Reference links or examples (text)
- Brand guidelines / assets link (text)
- Additional notes (textarea)

## Per-type field packs (concise but complete)

- **Display ad** — Ad sizes (multi: 300×250, 728×90, 160×600, 300×600, 320×50, 970×250, other), Static/Animated, Platform (Google Ads, LinkedIn, Programmatic, Other), Headline copy, CTA text, Landing page URL
- **General Web/Email design** — Sub-type (Web page / HTML email / Landing page); if email: Subject line, Preheader, From name, CTA text + URL, List / segment, Send date; if web: Page URL, Section
- **Career Site** — Site URL, Page / section, Change type (Bug / Content / New page / Other), Detailed description
- **Creative for social** — Platforms (multi: IG, FB, LinkedIn, TikTok, X, YouTube), Format (Feed, Story, Reel, Carousel), Post copy, Hashtags
- **Video/Animation** — Target length, Aspect ratio (16:9, 9:16, 1:1), Voiceover needed (Y/N), Script / storyboard link, Source footage link, Music preference
- **Flyer** — Size (Letter, A4, Half-page, Custom), Sided (Single / Double), Print or Digital, Quantity (if print), Copy, Imagery direction
- **Marketing Campaign** — Campaign name, Channels (multi: Email, Social, Ads, Print, Web), Start date, End date, KPI / goal, Deliverables list
- **Business card / post card** — Quantity, Size, Sided (Single / Double), Names / titles / contact info to include
- **Offline advertising for event** — Event name, Event date, Venue, Deliverable types (multi: Banner, Signage, Handouts, Backdrop), Size(s), Quantity
- **Offline advertising for facility** — Facility name, Install location, Size / dimensions, Material preference, Install date

## Technical

`pm_form_fields.conditionals` (jsonb) already exists — repurpose it to hold visibility rules of the shape:

```json
[{ "field": "creative_type", "in": ["display_ad", "email"] }]
```

Empty/missing = always visible. Multiple rules = AND.

1. **Extend `FormFieldRow`** (`src/components/pm/forms/FormFieldRenderer.tsx`) with `conditionals?: any` and export a helper `isFieldVisible(field, values, fieldsBySlug)` that resolves rules against current form values (matched by `slugifyLabel(label)`).
2. **Filter in both consumers**:
   - `src/components/pm/CreateWorkDialog.tsx` around line 434 — wrap the `fields.map` in a `useMemo` that filters by `isFieldVisible`.
   - `src/pages/pm/PublicForm.tsx` line 160 — same filter.
3. **Migration** — one seed migration that:
   - Wipes existing fields for the General form.
   - Inserts the Creative Type dropdown first (label "Creative Type", type `dropdown`, required, options = the 10 types with slug values).
   - Inserts common fields (no conditionals).
   - Inserts per-type field packs, each row's `conditionals` gating on `creative_type`.
   - Uses spaced `sort_order` values so common fields render before conditional ones inside the natural flow.
4. **FormBuilder UI** — leave as-is for this task (rules edited by migration). No new builder UI right now; call out as a follow-up.

## Out of scope

- No changes to `FormBuilder.tsx` conditional editor.
- No changes to task auto-creation logic; submitted values continue to flow into `pm_form_submissions.values` and get mirrored onto the task description as they do today.
- No visual redesign of the form beyond the dynamic reveal.

## Files touched

- `supabase/migrations/<new>.sql` (seed)
- `src/components/pm/forms/FormFieldRenderer.tsx` (add `conditionals` to type + export `isFieldVisible`)
- `src/components/pm/CreateWorkDialog.tsx` (filter render loop)
- `src/pages/pm/PublicForm.tsx` (filter render loop)
