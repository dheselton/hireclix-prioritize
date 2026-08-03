# Guard the task "kind" value

Task kind lives in an untyped JSON column (`custom_fields.kind`). Today an unexpected value would fall through the status-label helpers and produce the wrong wording with no signal. This adds a validation guard around it without changing any kind values or label wording.

## Changes

### 1. `src/lib/pm/taskKind.ts`
- Export `VALID_TASK_KINDS` as a readonly tuple and derive `TaskKind` from it, so the union and the runtime array can never drift. Keep the existing `TASK_KINDS` export as an alias so current imports keep working.
- Add `isValidTaskKind(v: unknown): v is TaskKind` and `assertTaskKind(v)` (throws with a clear message) plus `coerceTaskKind(v)` (returns `"task"` and logs a `console.warn` when the value is unrecognized and non-empty).
- Rewrite `getTaskKind()` to use `coerceTaskKind()` instead of the hardcoded `if (raw === "decision" || ...)` check — unknown values now warn once per value rather than silently degrading.
- Make `getKindStatusLabel()` and `getKindGroupLabel()` fall back to the default vocabulary (empty string / `null`, i.e. the standard status labels) for any kind not in the map, via an explicit lookup on the label record rather than the chained `if`s.

### 2. Write sites — validate before saving
- `src/components/pm/project/NewTaskDialog.tsx` (line ~241, `custom.kind = kind`): run `assertTaskKind(kind)` before assigning; on failure show a `toast.error` and abort the save.
- `src/components/pm/project/QaBatchPasteDialog.tsx` (line ~107, `kind: "qa"`): route the literal through the validated constant so a typo becomes a type error.
- `src/components/pm/workspace/RaidDetailsCard.tsx` merges `custom_fields` — confirm it never overwrites `kind`, and preserve the existing value on merge.

## Notes
- No kind values, label text, or vocabulary maps change.
- No database or schema change; the column stays JSON.
