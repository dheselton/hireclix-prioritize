# Distinguish "empty" from "failed" in request context panels

Two task-workspace panels currently return `null` when their data fetch fails, so a load error looks identical to "there's nothing here."

## What changes

**Original Request panel** (`RequestContextPanel.tsx`)
- Track whether the project/attachments/links fetch returned an error.
- On error, render a small bordered card with muted text: "Couldn't load request details — try refreshing." No error details, no stack.
- Everything else stays as-is: loading still renders nothing, non-request projects still render nothing, and a successful-but-empty request still renders nothing.

**Form intake block** (`FormSubmissionBlock.tsx`)
- Track an error flag on the submission lookup (the follow-up form-name and field-label fetches are cosmetic and stay silent).
- On error, render the same muted "Couldn't load the submitted form — try refreshing." line in a matching lightweight container.
- No submission found still renders nothing, as today.

## Technical notes

- Only additive: a `error` state variable per component, set from the existing Supabase response objects that are already destructured. Query shapes, ordering, and dependency arrays are untouched.
- Styling uses existing tokens (`border-border`, `text-muted-foreground`, `bg-muted/30`) — no new dependency and no shadcn `Alert` import needed for a single line of text.
- Happy-path JSX is unchanged in both files.
