# Careersite-ops → Prioritize integration

Build two machine-to-machine APIs on **careersite-ops** so **Prioritize** (HireClix PM app) can treat careersite-ops as the source of truth for live career sites and site health.

**Do not scrape HTML.** Expose real HTTP endpoints. Prioritize already has the consumer code deployed — you only need to implement the ops side.

---

## Architecture

```
careersite-ops (source of truth)
  ├── GET /api/v1/sites          ← Prioritize pulls catalog (hourly + manual)
  └── POST site.down / site.up   → Prioritize webhook (on health change)

Prioritize (work system)
  ├── sync-ops-sites edge fn     ← reads catalog, caches in pm_ops_sites
  └── ops-site-alert edge fn     ← creates support tickets on down, comments on recovery
```

**Division of responsibility:**

- **careersite-ops:** what live sites exist, current health status, when they go down/up
- **Prioritize:** support tickets, vendor escalations, ownership — linked to ops sites by stable ID + prod URL

---

## Critical rule: stable site IDs

Every monitored site needs a **stable `id` that never changes** (not a row number, not a URL that might change).

- Catalog field: `id`
- Webhook field: `ops_site_id`
- These must be the **same value** for a given site

Prioritize stores this as `ops_site_id` and uses it for linking, dedupe, and alert matching.

---

## API 1 — Sites catalog (Prioritize pulls)

### Endpoint

```
GET /api/v1/sites
```

**Live catalog URL** (set as Prioritize secret `OPS_SITES_API_URL`):

```
https://gvpfkwauercdbsiscaew.supabase.co/functions/v1/ops-sites-catalog
```

### Auth

```
x-api-key: <OPS_SITES_API_KEY>
```

- Validate on every request
- Missing or wrong key → `401 Unauthorized`
- No Google/session auth — server-to-server only

### Response

JSON array **or** wrapped object (`{ "sites": [...] }` or `{ "data": [...] }` — Prioritize accepts all three):

```json
[
  {
    "id": "ops_stable_id",
    "name": "Brightspring Career Site",
    "client_name": "Brightspring",
    "prod_url": "https://careers.example.com",
    "platform": "webflow",
    "status": "up",
    "last_checked_at": "2026-09-09T15:00:00.000Z"
  }
]
```

### Field spec

| Field | Required | Notes |
|-------|----------|-------|
| `id` | **yes** | Stable forever. Same value used in webhooks as `ops_site_id` |
| `name` | **yes** | Display name |
| `client_name` | no | Helps Prioritize match to client records |
| `prod_url` | strongly recommended | Production careers URL; used for auto-linking |
| `platform` | no | e.g. `webflow`, `wordpress`, `custom` |
| `status` | no | Current health. See status mapping below |
| `last_checked_at` | no | ISO-8601 timestamp of last health check |

### Status values

Preferred: `up`, `down`, `degraded`, `unknown`

Aliases Prioritize also accepts:

- → `up`: `ok`, `healthy`
- → `down`: `offline`, `outage`
- → `degraded`: `partial`

### Data source

Return **all monitored live career sites** from your existing site-health monitoring — the same inventory shown on `/site-health`.

### How Prioritize uses this

- Edge function `sync-ops-sites` calls this endpoint
- Runs **hourly** (cron) + manual **"Sync from ops"** button on Live Career Sites
- Upserts into `pm_ops_sites` cache table
- Auto-links to Prioritize projects when `prod_url` matches an existing live career site

---

## API 2 — Health alert webhook (careersite-ops pushes)

When a monitored site **goes down** or **recovers**, POST to Prioritize immediately (don't wait for the hourly sync).

### Endpoint

```
POST https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/ops-site-alert
Content-Type: application/json
x-api-key: <OPS_SITE_ALERT_API_KEY>
```

Use a **different secret** from the catalog API.

### Request body

```json
{
  "event": "site.down",
  "ops_site_id": "ops_stable_id",
  "prod_url": "https://careers.example.com",
  "site_name": "Brightspring Career Site",
  "detected_at": "2026-09-09T15:01:00.000Z",
  "alert_id": "unique-per-incident-or-check"
}
```

### Field spec

| Field | Required | Notes |
|-------|----------|-------|
| `event` | **yes** | `site.down`, `site.up`, or `site.recovered` |
| `ops_site_id` | **yes** | Must match catalog `id` |
| `prod_url` | recommended | Production URL |
| `site_name` | recommended | Display name |
| `detected_at` | recommended | ISO-8601 when state changed |
| `alert_id` | recommended | Unique per **incident** (not per site forever). Used for dedupe |

### When to send each event

| Event | Trigger |
|-------|---------|
| `site.down` | Site fails health check (transition to down) |
| `site.up` or `site.recovered` | Site passes health check again (transition to up) |

**Send recovery events.** Prioritize uses them to comment on the open alert ticket.

**Do not spam:** if site is already down, don't send duplicate `site.down` on every poll unless you want Prioritize to append a comment (it dedupes open tickets, but still logs repeats). Best practice: fire webhook on **state transitions** only.

### What Prioritize does on receive

| Event | Prioritize behavior |
|-------|---------------------|
| `site.down` | Creates urgent support request + unclaimed task under linked live site. Title: `[Site down] {site_name}`. **Deduped** — if open alert exists for this site, adds comment instead of new ticket |
| `site.up` / `site.recovered` | Comments on open alert ticket, clears active flag. Does **NOT** auto-close — human confirms |

### Response codes (from Prioritize)

| Status | Meaning |
|--------|---------|
| `200` | Success — ticket created, deduped, recovery commented, or no open alert to close |
| `202` | Site not mapped to Prioritize project/client yet (`unmapped_no_client`). Fix mapping in Prioritize Live Sites, then retry |
| `400` | Bad payload (e.g. missing `ops_site_id`) |
| `401` | Invalid `x-api-key` |
| `500` | Prioritize error |

Example success responses:

```json
{ "ok": true, "action": "created", "project_id": "...", "linked": true }
{ "ok": true, "action": "deduped", "project_id": "..." }
{ "ok": true, "action": "commented_recovery", "project_id": "..." }
{ "ok": false, "action": "unmapped_no_client", "message": "..." }
```

---

## Secrets to generate and share

Generate **two independent secrets**:

| Secret name | Used on | Stored in Prioritize as |
|-------------|---------|-------------------------|
| Catalog read key | `GET /api/v1/sites` auth | `OPS_SITES_API_KEY` |
| Alert write key | Prioritize webhook auth | `OPS_SITE_ALERT_API_KEY` |

Also set the catalog URL in Prioritize:

```
OPS_SITES_API_URL = https://gvpfkwauercdbsiscaew.supabase.co/functions/v1/ops-sites-catalog
```

Prioritize sets these in Supabase Dashboard → Edge Functions → Secrets.

---

## Example curl commands

### Test catalog

```bash
curl -sS "https://gvpfkwauercdbsiscaew.supabase.co/functions/v1/ops-sites-catalog" \
  -H "x-api-key: YOUR_OPS_SITES_API_KEY" \
  -H "Accept: application/json" | jq .
```

### Test down alert

```bash
curl -sS -X POST \
  "https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/ops-site-alert" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_OPS_SITE_ALERT_API_KEY" \
  -d '{
    "event": "site.down",
    "ops_site_id": "test-site-001",
    "prod_url": "https://careers.example.com",
    "site_name": "Test Career Site",
    "detected_at": "2026-09-09T15:01:00.000Z",
    "alert_id": "test-incident-001"
  }'
```

### Test recovery

```bash
curl -sS -X POST \
  "https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/ops-site-alert" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_OPS_SITE_ALERT_API_KEY" \
  -d '{
    "event": "site.up",
    "ops_site_id": "test-site-001",
    "prod_url": "https://careers.example.com",
    "site_name": "Test Career Site",
    "detected_at": "2026-09-09T16:00:00.000Z",
    "alert_id": "test-incident-001"
  }'
```

---

## Implementation checklist

### Catalog API

- [ ] `GET /api/v1/sites` returns all monitored live career sites
- [ ] Each site has stable `id` (never changes)
- [ ] `x-api-key` validation; 401 on failure
- [ ] Returns JSON array (or `{ sites: [...] }` / `{ data: [...] }`)
- [ ] Includes `prod_url`, `status`, `last_checked_at` where available
- [ ] Data matches what's on `/site-health` (same inventory)

### Alert webhook

- [ ] On down transition → POST `site.down` to Prioritize webhook
- [ ] On recovery transition → POST `site.up` or `site.recovered`
- [ ] `ops_site_id` matches catalog `id`
- [ ] `alert_id` is unique per incident
- [ ] Includes `detected_at` (ISO-8601)
- [ ] Uses `x-api-key` header (different secret from catalog)
- [ ] Fire on state change, not every poll while already down

### Coordination

- [ ] Generate and share `OPS_SITES_API_KEY`, `OPS_SITE_ALERT_API_KEY`, and catalog URL with Prioritize team
- [ ] Document any non-standard status values you use

---

## Out of scope (already built on Prioritize — do not rebuild)

- Prioritize UI (Live Career Sites health badges, vendor site picker, unmapped mapping)
- Prioritize database (`pm_ops_sites` cache table)
- Prioritize edge functions (`sync-ops-sites`, `ops-site-alert`)
- Auto-closing support tickets on recovery (humans confirm)
- Scraping `/site-health` HTML

---

## Rollout order

1. Ship `GET /api/v1/sites` — Prioritize can sync and link sites
2. Share secrets → Prioritize team configures Supabase + runs first sync
3. Map any unlinked sites in Prioritize Live Career Sites UI
4. Ship down/up webhook firing from health monitor
5. Test end-to-end: force a down on a mapped site → verify support ticket in Prioritize

---

## Questions / edge cases

**Q: Site exists in ops but not in Prioritize yet?**  
A: Webhook returns `202 unmapped_no_client`. Prioritize team maps it on Live Career Sites, then alerts work.

**Q: Same site down twice before recovery?**  
A: Prioritize dedupes — second `site.down` adds a comment to existing open alert, not a new ticket.

**Q: Can we use a different path than `/api/v1/sites`?**  
A: Yes — just tell Prioritize team the final URL for `OPS_SITES_API_URL`.

**Q: Do we need CORS?**  
A: No for these endpoints — only server-to-server calls.
