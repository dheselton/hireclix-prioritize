# ProjectDetail tab deep-linking

## Goal
Make the project detail page honor and maintain the `?tab=` URL query parameter so users can land directly on a specific tab and share/bookmark deep links.

## What will change
Only `src/pages/pm/ProjectDetail.tsx`:
- Replace the current `window.location.search` + `?section=` initialization with `useSearchParams()` from React Router.
- Read `?tab=` on mount and initialize the active tab if it matches a real tab key.
- Update the URL with `setSearchParams({ tab: newTabKey })` whenever the user clicks a tab.
- Keep the existing tab list, labels, visibility rules, and tab content rendering untouched.

## Valid tab keys
Validate against the existing `ProjectTabId` union, which already defines the renderable tabs: `overview`, `tasks`, `qa`, `timeline`, `pages`, `files`, `snippets`, `documentation`. Any other `?tab=` value falls back to the default `tasks` tab.

## Implementation details

1. **Imports**  
   Add `useSearchParams` from `react-router-dom` alongside the existing `useParams` import.

2. **Read `?tab=` on mount**  
   - Replace the current `useState<ProjectTabId>(() => { ... })` initializer that reads `?section=` via `window.location`.
   - Use `useSearchParams()` to get `[searchParams, setSearchParams]`.
   - On first render, read `searchParams.get("tab")`.
   - If it is a valid `ProjectTabId`, use it as the initial state; otherwise default to `"tasks"`.

3. **Sync tab clicks to the URL**  
   - Wrap the tab setter so that calling `setTab(newTab)` also calls `setSearchParams({ tab: newTab })`.
   - Keep the existing `ProjectTabs value={tab} onChange={...}` API intact.
   - Preserve other query params if any exist (e.g., `?taskFilter=...`) by merging rather than overwriting the whole search string.

4. **No other changes**  
   - Do not modify `ProjectTabs.tsx`, tab labels, or which tabs are shown for request/support/qa/template modes.
   - Do not touch routing for any other page.

## Verification
After the change, the following URLs should behave correctly:
- `/pm/projects/123` → lands on **Tasks** tab.
- `/pm/projects/123?tab=pages` → lands on **Pages** tab.
- `/pm/projects/123?tab=files` → lands on **Files** tab.
- `/pm/projects/123?tab=qa` → lands on **QA** tab (if QA mode is active; otherwise falls back to Tasks).
- Clicking any tab updates the URL to `?tab=<tabKey>` without a full page reload.
- Existing query params like `?taskFilter=...` are preserved when switching tabs.
