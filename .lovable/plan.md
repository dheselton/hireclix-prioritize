## Goal
Stop forcing downloads / new-tab hops for attachments and links. Click anything → opens an in-app preview modal. Links on cards get rich-ish thumbs (favicon + title) instead of bare URLs.

## Scope (UI-only, no schema changes)
Surfaces touched:
- `RequestContextPanel` (request files + reference links)
- `FilesTab` (Project → Files: project files + per-task files + links)
- `AssetHub` (Task workspace uploads grid)
- `AttachmentsSection` (TaskDrawer quick edit)

Behavior elsewhere (intake upload, delete, etc.) stays untouched.

## New shared pieces

1. `src/components/pm/attachments/AttachmentPreviewModal.tsx`
   Single Dialog-based viewer. Props: `{ open, onOpenChange, items: PreviewItem[], index, onIndexChange }`.
   - Header: filename / link label, kind pill, `Open in new tab` + `Download` (files only) + close.
   - Prev / Next arrows + keyboard ← → when `items.length > 1`.
   - Body renders by detected kind:
     - **image** (`png|jpe?g|gif|webp|svg|avif`) → `<img>` fit-contain, dark backdrop.
     - **pdf** → `<iframe src={url}#toolbar=1>` full-height.
     - **video** (`mp4|webm|mov|m4v`) → `<video controls>`.
     - **audio** (`mp3|wav|m4a|ogg`) → `<audio controls>`.
     - **office** (`docx?|xlsx?|pptx?`) → `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encoded}">`.
     - **text** (`txt|md|csv|json|log`) → fetch then `<pre>` (csv → simple table parse).
     - **link** → try `<iframe src=url>`; on `load` timeout/error fall back to Microlink-style card (favicon via `https://www.google.com/s2/favicons?domain=…&sz=64`, hostname, "Open in new tab").
     - **fallback** → big file icon + Open / Download buttons.

2. `src/lib/pm/previewKind.ts`
   `detectKind(nameOrUrl, type): PreviewKind` + extension regex constants (moved out of FilesTab/AssetHub).

3. `src/components/pm/attachments/AttachmentThumb.tsx`
   Small square/rounded tile used in card-like surfaces. Image → real thumb; PDF/Office/video/audio → extension chip with kind icon; link → favicon + hostname. Click triggers `openPreview(items, i)`.

4. `src/components/pm/attachments/PreviewProvider.tsx`
   Context exposing `openPreview(items, startIndex)`. Mounted once near the PM app root (next to existing `TaskDrawer`/`FloatingTimerTray`) so any surface can open the modal without prop-drilling. Hook: `usePreview()`.

## Surface changes

- **AssetHub**: replace the current `<a href target=_blank>` wrapper with a button that calls `openPreview(items, i)`. Hover Download icon → real `<a download>` (kept). Grid layout unchanged.
- **FilesTab → Row**: same swap — name link & thumbnail click → `openPreview`. Build `items` from `[...filteredProject, ...filteredTask]` so the modal can page through. Download icon stays as a true `<a download>`.
- **RequestContextPanel**:
  - Files list → render as a small thumb row using `AttachmentThumb` (2–4 across), click opens preview.
  - Links list → use `AttachmentThumb` link variant (favicon + label/host), click opens preview (iframe-or-card).
- **AttachmentsSection (TaskDrawer)**: file rows + link rows → click name or thumb → `openPreview`. Existing download/delete buttons stay.

## Edge cases
- Supabase `task-attachments` bucket is public → direct URLs work in iframe/img/video.
- Office viewer needs a publicly reachable URL (we have one). If user is offline / iframe blocked → fallback panel shows Open + Download.
- Links that block embedding (X-Frame-Options/CSP): detect via 2.5 s `load` timeout → swap to favicon card automatically. No server calls required.
- Keep all existing delete/upload logic intact.

## Non-goals
- No server-side thumbnailing, no new tables, no Microlink API key, no PDF.js bundle (native `<iframe>` is enough for the Supabase public URLs we serve).
- No changes to upload, drag-drop, or RLS.

## Files
- new: `src/components/pm/attachments/AttachmentPreviewModal.tsx`
- new: `src/components/pm/attachments/AttachmentThumb.tsx`
- new: `src/components/pm/attachments/PreviewProvider.tsx`
- new: `src/lib/pm/previewKind.ts`
- edit: `src/components/pm/workspace/AssetHub.tsx`
- edit: `src/components/pm/project/FilesTab.tsx`
- edit: `src/components/pm/workspace/RequestContextPanel.tsx`
- edit: `src/components/pm/drawer/AttachmentsSection.tsx`
- edit: PM app shell (where `TaskDrawer`/`FloatingTimerTray` mount) to wrap children in `PreviewProvider`.
- update `mem://index.md` Core line about attachments → "All attachment/link surfaces use PreviewProvider + AttachmentPreviewModal; never link out to new tab as the primary action."
