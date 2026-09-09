# Careersite-ops ↔ Prioritize API contract

Prioritize treats [careersite-ops site-health](https://careersite-ops.hireclix.com/site-health) as the source of truth for live career sites. This doc is the contract for APIs you implement on ops.

## 1. Sites catalog (Prioritize pulls)

**Endpoint (live):** `GET https://gvpfkwauercdbsiscaew.supabase.co/functions/v1/ops-sites-catalog`  
**Auth:** `x-api-key: <OPS_SITES_API_KEY>` (same value stored in Prioritize function secrets)

Set Prioritize secret `OPS_SITES_API_URL` to that full URL.

**Response** — either a bare array or `{ "sites": [ ... ] }` / `{ "data": [ ... ] }`:

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

| Field | Required | Notes |
|-------|----------|--------|
| `id` | yes | Stable forever; used as `pm_ops_sites.ops_site_id` |
| `name` | yes | Display name |
| `client_name` | no | Used to match Prioritize `clients.name` |
| `prod_url` | strongly recommended | Used for auto-link by URL |
| `platform` | no | e.g. webflow, wordpress |
| `status` | no | `up` \| `down` \| `degraded` \| `unknown` (aliases: ok/healthy → up, offline/outage → down) |
| `last_checked_at` | no | ISO-8601 |

**Prioritize consumer:** edge function `sync-ops-sites`  
- Env: `OPS_SITES_API_URL`, `OPS_SITES_API_KEY`  
- Cron: hourly + **Sync now** on Live Career Sites  
- Upserts `pm_ops_sites`; auto-links when URL or `custom_fields.ops_site_id` matches a live Support-mode project

---

## 2. Health alert webhook (ops pushes)

When a site goes down or recovers, POST to Prioritize:

```
POST https://naazebxkoyuxbcmcwytc.supabase.co/functions/v1/ops-site-alert
Content-Type: application/json
x-api-key: <OPS_SITE_ALERT_API_KEY>
```

**Body:**

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

| `event` | Behavior |
|---------|----------|
| `site.down` | Create a career-site support request + unclaimed urgent task under the linked live site (deduped if an open ops alert already exists — adds a comment instead) |
| `site.up` / `site.recovered` | Comment on the open alert request and clear `ops_alert_active` (does **not** auto-complete) |

**Prioritize consumer:** edge function `ops-site-alert`  
- Env: `OPS_SITE_ALERT_API_KEY`  
- `verify_jwt = false` (API key only)

Unmapped sites (no linked project/client) return `202` with `action: unmapped_no_client` so ops can retry after mapping.

---

## 3. Secrets to set (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Used by |
|--------|---------|
| `OPS_SITES_API_URL` | `sync-ops-sites` — full URL to your catalog endpoint |
| `OPS_SITES_API_KEY` | `sync-ops-sites` — sent as `x-api-key` |
| `OPS_SITE_ALERT_API_KEY` | `ops-site-alert` — expected inbound key |

---

## 4. Manual sync from Prioritize UI

Live Career Sites → **Sync from ops** calls `supabase.functions.invoke('sync-ops-sites')`.
