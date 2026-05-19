# Manual requests + embeddable intake forms

## 1. Manual "New Request" — make it obvious

Today: only `+ New` → dialog → pick Quick Request. Fine but buried.

Changes:
- **WorkQueue header**: split the single `+ New` into two buttons — `+ Quick Request` (opens dialog pre-stepped to `request`) and `+ Project` (pre-stepped to `project`). Keeps one combined dialog under the hood.
- **CreateWorkDialog**: accept an optional `initialStep` prop so callers can skip the chooser.
- **Empty states** in Unclaimed sections: add a "Add a request manually" inline CTA that opens the dialog in request mode.
- **Keyboard shortcut**: `N` anywhere in `/pm/*` opens the dialog (request step by default).

## 2. Embeddable public forms

`pm_forms` already has `shareable_slug` and `/f/:slug` (`PublicForm.tsx`) renders the public form. We extend this surface with embed options.

### A. Iframe embed (no code changes needed on host page)

In `FormBuilder.tsx` add an **Embed** panel that generates:

```html
<iframe
  src="https://<app-host>/f/<slug>?embed=1"
  width="100%"
  height="720"
  style="border:0;max-width:640px;"
  loading="lazy"
  title="<Form name>"
></iframe>
```

`PublicForm.tsx` reads `?embed=1` and:
- hides the page chrome (header, footer, background gradients)
- uses transparent background
- posts a `postMessage({ type: 'lovable-pm-form', event: 'resize', height })` on mount + on resize so a companion JS snippet (below) can auto-size

### B. JS snippet embed (auto-resizing, no fixed height)

```html
<div data-pmform="<slug>"></div>
<script async src="https://<app-host>/embed/pm-form.js"></script>
```

Add a tiny static script at `public/embed/pm-form.js` that:
- finds every `[data-pmform]`
- injects an iframe pointing at `/f/<slug>?embed=1`
- listens for the `resize` postMessage and updates iframe height
- supports `data-pmform-theme="light|dark"` passed via query string

### C. Direct link + QR

Already have the link; add a "Copy link" button and a small QR (use `qrcode` lib, ~3kb) for printable handoffs.

### D. Embed panel UI

New tab in `FormBuilder.tsx` → **Share & Embed** with three cards:
1. **Direct link** — copy button + Open
2. **Iframe** — code block + copy
3. **JS snippet** — code block + copy

All snippets use the project's preview/published origin (`window.location.origin`).

## 3. Security / hygiene

- Public form submits already work via anon key against `pm_form_submissions` (permissive RLS). Keep as-is.
- Add basic per-slug rate limiting later (out of scope here).
- `?embed=1` only changes presentation; no auth bypass.

## Files

**New**
- `public/embed/pm-form.js` — auto-resize loader script

**Modified**
- `src/components/pm/CreateWorkDialog.tsx` — add `initialStep` prop
- `src/pages/pm/WorkQueue.tsx` — split header CTAs, wire empty-state CTA, keyboard shortcut
- `src/pages/pm/ProjectList.tsx` — same dual-CTA treatment
- `src/pages/pm/PublicForm.tsx` — `?embed=1` mode + postMessage resize beacon
- `src/pages/pm/FormBuilder.tsx` — new "Share & Embed" panel with iframe/JS/link snippets + copy buttons

## Out of scope
- Hosted form themes / custom CSS
- Captcha / spam protection
- Webhook signing for form submissions (already partially in `pm_webhooks`)

Want me to ship all of this, or just the embed pieces first?
