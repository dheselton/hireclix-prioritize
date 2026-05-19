# Plan — Updated Build Review v2

Refresh `/mnt/documents/review/REVIEW.md` and the `screens/` folder so it reflects every change shipped since the May 13 review, and add a proper end-to-end **workflow + user-flow diagram** alongside the screenshots.

## What's new since the last review (will be folded in)

1. **Clickable-callout rule** — every CTA / alert / stat tile is now a deep link into its filtered view via `buildQueueLink()` + URL-driven chip filters.
2. **Unclaimed banner ↔ lane reconciliation** — banner and "Unclaimed in my lane" both use the team concept (designer sees design + content, dev sees dev) so counts match.
3. **Quick Request vs Project split** — Work Queue + Projects headers now expose two distinct CTAs (`+ Quick Request`, `+ Project`) wired through `CreateWorkDialog`'s new `initialStep` prop.
4. **Embeddable Forms** — `/pm/forms/:id/edit` now has a Share & Embed panel (Direct link / Iframe / auto-resizing JS snippet via `public/embed/pm-form.js`). `PublicForm` supports `?embed=1` (transparent, no chrome, `postMessage` resize beacon).
5. **Seeded HireClix intake forms** — *General Creative* (`/f/creative-request-general`) and *Web / Email* (`/f/creative-request-web-email`) modeled on the HireClix Wix forms.
6. **Role-switcher / dev-mode caveats** still apply — auth disabled, PM tables permissive RLS.

## Deliverables

### 1. New screenshots (replace + add)
Re-capture at 1440×900 from the live preview, save to `/mnt/documents/review/screens/`:

- `01-work-queue-pm.png` — Work Queue showing the new split `+ Quick Request` / `+ Project` buttons, clickable stat tiles, unclaimed banner.
- `02-board-projects.png`, `03-board-kanban.png` — refresh.
- `04-projects.png` — show split create buttons.
- `05-project-detail-overview.png`, `06-project-detail-timeline.png`, `07-project-detail-tasks.png`, `08-task-drawer.png` — refresh.
- `09-team-workload.png`, `10-global-timeline.png` — refresh.
- `11-forms.png` — now populated with the 3 forms (Creative Request, General, Web/Email).
- `11b-form-builder-embed.png` — **new**: FormBuilder showing the Share & Embed panel (3 cards).
- `11c-public-form-general.png` — **new**: `/f/creative-request-general` rendered standalone.
- `11d-public-form-web-email.png` — **new**: `/f/creative-request-web-email` rendered standalone.
- `12-templates.png`, `13-template-builder.png`, `14-integrations.png` — refresh.
- `15-roadmap-dashboard.png`, `16-product-roadmap.png` — refresh (legacy section).

Capture via headed browser tool against the preview URL, using the TopBar role switcher to take the Work Queue shot as the **PM** role.

### 2. End-to-end flow diagram (new)
Add `/mnt/documents/review/flow.mmd` (Mermaid) referenced from REVIEW.md as a `lov-artifact`. Two sub-diagrams in one file:

- **User flow** — Submitter (public form) → Unclaimed queue → PM triage → Designer/Dev claim → Review → Approved → Go-Live.
- **System flow** — Form submit → `pm_form_submissions` + auto-create `pm_tasks` / `pm_projects` → activity log → webhooks (`pm_webhook_deliveries`) → realtime → UI.

### 3. Rewritten `REVIEW.md`
Same structure as v1, but:

- New **"What changed since v1"** section at the top.
- New **§7. Forms & Embeds** section covering the embed panel, JS snippet, iframe snippet, and the two seeded HireClix forms (with their public slugs).
- New **§2.1 Clickable callouts** callout block documenting the project-wide rule + `buildQueueLink` helper.
- Updated **§2 Work Queue** copy describing the split `+ Quick Request` / `+ Project` buttons and the lane-aligned unclaimed counts.
- New **§11. End-to-end workflow diagram** section embedding the Mermaid artifact.
- Updated **End-to-end user flow** narrative to include the embed/form intake path and the manual-create path.
- Functional-notes section updated: `pm_forms` slugs seeded, `public/embed/pm-form.js` loader, `?embed=1` `postMessage` contract (`{type:"lovable-pm-form", event:"resize", slug, height}`).

### 4. File layout after the refresh

```text
/mnt/documents/review/
  REVIEW.md            (rewritten)
  flow.mmd             (new mermaid artifact)
  screens/
    01..16 ...png      (refreshed)
    11b-form-builder-embed.png
    11c-public-form-general.png
    11d-public-form-web-email.png
```

## Technical notes

- Screenshots: use `browser--navigate_to_url` + `browser--set_viewport_size 1440×900` + `browser--screenshot` per route. Where the role matters (Work Queue), use `browser--act` to flip the TopBar role switcher to PM, then Designer for one alt shot (`01b-work-queue-designer.png`) so reviewers can see the lane logic.
- Mermaid: write to `/mnt/documents/review/flow.mmd`; render inline in chat via `<lov-artifact url="/__l5e/documents/review/flow.mmd" mime_type="text/vnd.mermaid"></lov-artifact>`.
- No source-code edits — this is pure documentation + screenshots.

## Out of scope

- Any UI/UX changes (this is a review, not a build).
- Tightening RLS or re-enabling auth.
- New embed themes / captcha / webhook signing (already noted as future work).

Reply **"go"** (or hit Implement) and I'll capture the screenshots, render the diagram, and publish the new `REVIEW.md`.
