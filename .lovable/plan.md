# Request confirmation + completion emails

Requesters who submit through the public Quick Request form currently get no email at all. This adds two automatic emails, both sent from `prioritize@hireclix.com` via Resend (the key already in the project).

## 1. Submit confirmation

When a request is submitted (public form at `/f/quick-request`, and the internal Quick Request dialog), the requester gets an immediate "We got your request" email containing:

- Reference number (REQ-xxxxxx), request title and request type
- Client and submitted date
- A note about who will follow up

No change to the form UI, the fields, or what gets stored.

## 2. Completion notification

When the task created from a request is moved to a done status, the original requester gets a "Your request [title] has been completed" email. This fires automatically from the database, so it works no matter where the status was changed from — task page, board drag, or bulk edit — with no changes to any status transition logic.

Each request is emailed at most once on completion, so re-opening and re-closing a task will not spam the requester.

## Technical detail

- **New edge function `send-request-email`**: takes `{ kind: 'received' | 'completed', to, refId, title, requestType, clientName, projectId }`, renders a branded HTML email (reusing the styling conventions of the existing `send-reminder-email` function) and sends via Resend from `HireClix Prioritize <prioritize@hireclix.com>`. Validates input with Zod, returns provider status/body on failure, CORS enabled, `verify_jwt` left at the project default so the public form can call it.
  - Note: `prioritize@hireclix.com`'s domain must be verified in Resend or sends will 403. If it isn't yet, the function will log the failure and the app still submits successfully.
- **Submit trigger (client)**: after the successful `pm_form_submissions` insert in `src/pages/pm/PublicForm.tsx` and `src/components/pm/CreateWorkDialog.tsx`, fire-and-forget `supabase.functions.invoke('send-request-email', ...)` inside a try/catch so an email failure never blocks submission. Alias display on `SubmissionSuccess` stays as-is; `requestAliases.ts` placeholder comment updated.
- **Completion trigger (database)**: migration adding
  - `pm_form_submissions.completion_emailed_at timestamptz` (idempotency guard)
  - an `AFTER UPDATE OF status ON pm_tasks` trigger that, when the new status is terminal and the old one wasn't, finds the `pm_form_submissions` row via `created_task_id` or `created_project_id`, and if it has a `submitter_email` and no `completion_emailed_at`, calls the edge function through `pg_net` (service-role key from Vault, same pattern as existing infrastructure) and stamps `completion_emailed_at`.
  - Terminal statuses in SQL mirror `TERMINAL_STATUSES` in `src/types/pm.ts`.
- Enables the `pg_net` extension if not already present.
