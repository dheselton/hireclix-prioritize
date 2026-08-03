# Fix claimed status hardcoded color in boardStyles.ts

## Goal
Replace the hardcoded `sky-500` Tailwind color used for the `claimed` status group in `src/components/pm/project/board/boardStyles.ts` with the project's semantic design token, so the claimed column responds to theme/brand changes like the other status groups.

## Current state
- `src/components/pm/project/board/boardStyles.ts` defines three style maps keyed by `StatusGroupId`.
- `STATUS_PILL_CLASS["claimed"]` uses `bg-sky-500/15 text-sky-600 dark:text-sky-400`.
- `STATUS_DOT_CLASS["claimed"]` uses `bg-sky-500`.
- All other status groups use semantic tokens (`bg-muted`, `bg-info`, `bg-warning`, `bg-success`).
- The canonical blue-family semantic token in the project is `bg-info` / `text-info`.

## Change
In `src/components/pm/project/board/boardStyles.ts`:
- `STATUS_PILL_CLASS.claimed`: change to `"bg-info/15 text-info"` (matching the `in_progress` pattern).
- `STATUS_DOT_CLASS.claimed`: change to `"bg-info"`.

No other status groups or the file structure will be changed.

## Verification
- Run a TypeScript check to confirm no broken class references.
- Visually confirm in the running app that the claimed column uses the info-blue color instead of sky-500.
