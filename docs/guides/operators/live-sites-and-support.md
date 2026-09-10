# Live sites & support

**When to use this** — A site is live (Support mode) and tickets, health alerts, or vendor issues need handling.

## Steps

1. Open [Live Career Sites](/pm/live-sites). Find the site by client or URL.
2. Check open tickets / queue health. Log a support request from the site when needed.
3. For outages synced from careersite-ops, open the urgent `[Site down]` ticket under that site and drive recovery.
4. Escalate third-party blockers on [Vendors](/pm/vendors) when Webflow / iPaaS / etc. owns the fix.
5. When support work is done, close the ticket; leave ops recovery comments in place if the alert auto-commented.

## Done when

Tickets have owners, site health is understood, and vendor escalations (if any) are tracked.

## If this happens

- **Site missing from Live Career Sites** — confirm the project is in Support mode and linked (ops sync / prod URL).
- **Duplicate down tickets** — Prefer the existing urgent ticket; ops dedupes on active alerts.
