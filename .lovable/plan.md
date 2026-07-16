## Problem

Submitting the Career Site · New page quick request errors "Missing required: Page purpose", but the Page purpose field isn't rendered. It's a conditional field hidden by the current answers, yet validation still requires it.

Same bug in two intake surfaces:
- `src/components/pm/CreateWorkDialog.tsx` (Quick Request)
- `src/pages/pm/PublicForm.tsx` (public intake link)

Both render fields via `isFieldVisible(...)` but validate against the full `internalFields` / `fields` array.

## Fix

Build the same slug→value map used for rendering, then only require fields that are currently visible.

**`CreateWorkDialog.tsx` (submitRequest, ~line 124)**

```ts
const bySlug: Record<string, any> = {};
for (const f of internalFields as FormFieldRow[]) {
  bySlug[slugifyLabel(f.label)] = reqFieldValues[f.id];
}
const missing = (internalFields as FormFieldRow[]).filter((f) => {
  if (!f.required) return false;
  if (!isFieldVisible(f, bySlug)) return false;
  const v = reqFieldValues[f.id];
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || v === "";
});
```

Also strip hidden-field answers out of `requestCustomFields` (the useMemo at ~line 107) so stale answers from a previously-visible branch don't get saved into `custom_fields`.

**`PublicForm.tsx` (~line 138)** — mirror the same visibility gate before the `missing.length` check, reusing the existing `valuesBySlug` it already computes for rendering.

## Non-goals

- No schema changes, no new fields, no changes to `FormFieldRenderer` or conditionals logic.
- No changes to RAID work.
