# Clarify the templates "open create dialog" URL param

## What the search found

There is no `?n=1` anywhere in `src/` — a full sweep of every `searchParams.get(...)` call turns up only these params: `action`, `task`, `chips`, `feature`, `workType`, `user`, `taskFilter`, `tags`, `tab`, `section`, `new`, `embed`, `client`.

The param the audit is describing is now `?new=1`, with exactly one producer and one consumer:

- Producer: `src/components/pm/CreateWorkDialog.tsx:281` — `navigate("/pm/templates?new=1")`
- Consumer: `src/pages/pm/Templates.tsx:29-35` — reads `new`, opens the create-template dialog, then strips the param from the URL

## What changes

- Rename the param from `new` to `newTemplate` in both places, so the name says what it opens rather than a generic "new".
- Add a one-line comment at the consumer: opening `/pm/templates?newTemplate=1` auto-opens the "New template" dialog on arrival, and the param is removed afterward so a refresh doesn't reopen it.

Behavior is unchanged — same dialog, same auto-open, same URL cleanup. Nothing else in the app links to `?new=1`, so there are no other call sites to update.
