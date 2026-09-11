# Team & access

**When to use this** — A HireClix teammate signed in with Google and is waiting for approval, or their role needs to change.

## Steps

1. Open [Team](/pm/team).
2. Find pending users (`is_active` off / waiting for approval).
3. Activate them and set the right **job role(s)** (PM, BA, designer, developer, submitter, etc.). Multi-role users get the **union** of permissions — e.g. designer + developer sees both design tools and vendor escalations.
4. Optionally mark **Admin** (admins only can grant this). Admin is an overlay, not a job: it grants full surface visibility and roster/timesheet operator privileges on top of whatever jobs the person holds. A developer-admin stays a developer for assignment and track.
5. Deactivate people who should no longer access Prioritize.

## Done when

New hires can reach the app with the correct pack of screens; leavers are deactivated.

## If this happens

- **Non-@hireclix.com account** — they are denied by design; they need a HireClix Google account.
- **Submitter stuck on My Work only** — expected until you add a staff job role.
- **Need someone to see everything without making them a PM** — grant Admin; keep their production job(s).
- **Cannot toggle Admin** — only existing admins can grant or revoke the overlay (bootstrap the first admin in SQL if needed).
