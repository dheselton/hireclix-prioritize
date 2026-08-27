# HireClix Prioritize

Build a visually stunning internal intranet called “Career Site Dev & Design Ops” using Tailwind with semantic tokens from the HireClix Style Guide, Unbounded for headings, and Roboto for body. Use a left sidebar for primary navigation and a dashboard home that summarizes everything with drill-down pages. Authentication uses Google OAuth for approved `@hireclix.com` roster members.

#### Branding and Theme
- Implement CSS variables and semantic tokens exactly as specified below. Do not use raw hex values in components; only use tokens.
- Typography:
  - Unbounded (700) for H1–H3 and key titles
  - Roboto (400/500) for body, buttons, inputs, UI
- Visual system:
  - Glassmorphism on cards (bg-gradient-glass + backdrop-blur), subtle borders, elegant gradients, and smooth transitions
  - Shadows: use provided shadow tokens via utility classes (shadow-card, shadow-modal, shadow-lg, shadow-glass)
  - Gradients: gradient-primary, gradient-accent, gradient-card, gradient-hero, gradient-glass
  - Border radius: base 0.75rem, use rounded-2xl for cards
- Accessibility: Meet WCAG AA, clear focus states, semantic HTML, aria attributes, keyboard navigable

Define these tokens in a global CSS layer and map to Tailwind utility classes (bg-primary, text-primary-foreground, text-muted-foreground, border-border, etc.). Use tokens only.

CSS variables (use exactly):
```css
:root {
  /* Backgrounds */
  --background: 0 0% 100%;
  --card: 0 0% 100%;
  --popover: 0 0% 100%;

  /* Text */
  --foreground: 0 0% 13%;
  --card-foreground: 0 0% 13%;
  --muted-foreground: 210 9% 46%;

  /* Primary */
  --primary: 209 75% 19%;
  --primary-foreground: 0 0% 100%;
  --primary-hover: 209 75% 15%;

  /* Accent */
  --accent: 209 61% 58%;
  --accent-foreground: 0 0% 100%;
  --accent-hover: 209 61% 50%;

  /* Success */
  --success: 39 96% 54%;
  --success-foreground: 0 0% 13%;

  /* Borders */
  --border: 210 9% 79%;
  --input: 210 9% 79%;
  --ring: 209 61% 58%;

  /* Shadows */
  --shadow-card: 0px 4px 16px rgba(11, 53, 85, 0.08), 0px 1px 4px rgba(11, 53, 85, 0.04);
  --shadow-modal: 0px 8px 32px rgba(11, 53, 85, 0.15), 0px 2px 8px rgba(11, 53, 85, 0.08);
  --shadow-lg: 0px 12px 48px rgba(11, 53, 85, 0.12), 0px 4px 16px rgba(11, 53, 85, 0.06);
  --shadow-glass: 0px 8px 32px rgba(84, 163, 218, 0.12), 0px 2px 8px rgba(84, 163, 218, 0.08);

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, hsl(209 75% 19%), hsl(209 61% 58%));
  --gradient-accent: linear-gradient(135deg, hsl(39 96% 54%), hsl(209 61% 58%));
  --gradient-card: linear-gradient(145deg, hsl(0 0% 100%) 0%, hsl(210 22% 99%) 50%, hsl(0 0% 100%) 100%);
  --gradient-hero: linear-gradient(135deg, hsl(210 22% 98%) 0%, hsl(209 61% 95%) 50%, hsl(210 22% 98%) 100%);
  --gradient-glass: linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(244, 246, 248, 0.8) 100%);

  /* Radius */
  --radius: 0.75rem;
}
```

Tailwind usage conventions:
- Use semantic tokens:
  - Example: bg-primary text-primary-foreground, hover:bg-accent-hover, text-muted-foreground, border-border, ring-accent
- Glassmorphism and shadows:
  - Cards: rounded-2xl border border-white/20 bg-gradient-glass backdrop-blur-sm shadow-glass hover:shadow-lg hover:scale-[1.02] transition-all duration-300
- Typography utilities:
  - Headings: font-unbounded font-bold
  - Body: font-roboto (default for body text)

#### Layout and Navigation
- Left Sidebar Navigation (collapsible on mobile; active item has bg-primary/5 and an accent left border):
  - Dashboard (default)
  - Customers
  - Docs
  - Integrations
  - Design System
  - FAQ
  - Admin
- Top bar:
  - Global search with scope toggles (Customers, Docs, Integrations)
  - Quick actions: Add Customer, Add Doc, Add Integration

- Page container:
  - Max width 1400px, centered, padding 2rem
  - Header height 64px

#### Dashboard (Overview)
- Hero header (bg using --gradient-hero):
  - Title (Unbounded): “Career Site Dev & Design Ops”
  - Subtitle: “A hub for quick answers, resources, and live project context.”
- KPI strip (minimal stats in card tiles):
  - Total Live Sites: sum of Customer.live_sites where status = "Live"
  - Integration Health: % Integrations with health = "Healthy"
  - Total Docs: count of Doc
- Quick Links (card grid):
  - “Add Customer”, “Add Doc”, “Add Integration”, “Design Tokens”, “Client-First Guide”
- Highlights:
  - Top Docs (by views_30d)
  - Active Integrations (Status GA/Beta) with chips for directionality and notable capabilities (e.g., RaaS)
  - Recently Live customers (last 90 days)
- Recent Activity feed: last 10 Activity items (entity, action, summary, timestamp)

#### Customers
- Purpose: manage Career Site customers and JobFlow SEO clients.
- Data table with:
  - Tabs: All | Career Sites | JobFlow SEO
  - Search (typeahead on name)
  - Filters: Status (Prospect, In Progress, Live, Paused), ATS, Segment, Owner, Region
  - Columns: Name, Type, Status (badge), ATS, Go-Live Date, Live Sites, Region, Owner, Links (site_url, dashboard_url), Notes
  - Row click opens Detail Drawer
- Detail Drawer:
  - Overview with status badge, links, core fields
  - Mini-stats: live_sites, last update, ATS health
  - Related Docs (chips/cards), Related Integrations, Activity timeline
  - Actions: Edit, Add Note, Add Link
- Inline CRUD with toasts and optimistic updates
- Seed data:
  - Career Sites (status Live by default; live_sites can default to 1; ATS guessed/editable):
    - Peraton; Parsons Careers; 99 Restaurant Jobs; Cora Health; Penfed Careers; O’Charleys Careers; Penfed; Public Storage; CHS; Underground Chucks; Shepard Pratt
  - JobFlow SEO (status Live):
    - LKQ; TPG; Ignite Medical; The Container Store

Customer model:
- Customer {
  id, name, type: "Career Site" | "JobFlow SEO",
  status: "Prospect" | "In Progress" | "Live" | "Paused",
  ats: string, go_live_date: date | null, live_sites: number,
  region: string | null, segment: string | null, owner: string | null,
  site_url: string | null, dashboard_url: string | null,
  notes: text, updated_at: datetime
}

#### Docs
- Purpose: curated repository of links (Google Docs, Sheets, Notion, PDFs, etc.) with tags and filters.
- Features:
  - Search across title, url, description
  - Filters: tags, owner, last_updated, type
  - Grid/List toggle; sort by last_updated or views_30d
  - Quick-add drawer (fields validated; URL required)
  - Doc card shows tag chips, owner initials avatar, external link icon
  - Optional embed preview if URL is embeddable (Drive/YouTube/Figma if allowed)
- Categories/tags: one-pager, implementation, how-to, integration, design, sales, product

Doc model:
- Doc {
  id, title, url, description, tags: string[],
  owner: string | null,
  type: "one-pager" | "implementation" | "how-to" | "integration" | "design" | "other",
  last_updated: datetime, views_30d: number
}

Seed Docs:
- “Client-First Quickstart” (tags: ["design","how-to"])
- “ATS Integration Playbook” (tags: ["integration"])
- “Career Site Launch Checklist” (tags: ["implementation"])

#### Integrations
- Purpose: inventory and health of ATS and related integrations.
- Filters: status, vendor, category, health, directionality, capabilities
- Cards show: name, vendor, status badge (GA/Beta/Planned/Deprecated), health badge (Healthy/Degraded/Down), directionality chip, key capabilities, docs_link button
- Detail Drawer: overview, known_limitations, version, owner, last_updated, change log (notes array)
- Sub-tabs:
  - Catalog (cards)
  - Capability Matrix (table with integrations x capabilities; checkmarks where supported)
  - Incidents (list where health != Healthy or known_limitations not empty; quick filter)

Integration model:
- Integration {
  id, name, vendor,
  category: "ATS" | "Analytics" | "SEO" | "SSO" | "CDN" | "Other",
  status: "GA" | "Beta" | "Planned" | "Deprecated",
  version: string | null, docs_link: string | null,
  owner: string | null, known_limitations: text,
  last_updated: datetime,
  health: "Healthy" | "Degraded" | "Down",
  directionality: "Unidirectional" | "Bidirectional" | "Mixed",
  capabilities: string[]  /* e.g., ["RaaS","Job Sync","Candidate Sync","Apply API","Webhooks"] */
}

Seed Integrations (use these exact entries):
- iCIMS
  - vendor: iCIMS
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Bidirectional
  - capabilities: ["Candidate Sync","Job Sync","Webhooks"]
- Workday
  - vendor: Workday
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Bidirectional
  - capabilities: ["RaaS","Job Sync","Candidate Sync"]
- Greenhouse
  - vendor: Greenhouse
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Unidirectional
  - capabilities: ["Job Sync","Apply API"]
- UKG
  - vendor: UKG
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Unidirectional
  - capabilities: ["Job Sync"]
- Crelate
  - vendor: Crelate
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Bidirectional
  - capabilities: ["Job Sync","Candidate Sync"]
- SmartRecruiters
  - vendor: SmartRecruiters
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Unidirectional
  - capabilities: ["Job Sync","Apply API"]
- Hirebridge
  - vendor: Hirebridge
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Unidirectional
  - capabilities: ["Job Sync"]
- Jobvite
  - vendor: Jobvite
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Unidirectional
  - capabilities: ["Job Sync"]
- Eightfold
  - vendor: Eightfold
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Unidirectional
  - capabilities: ["Job Sync"]
- SuccessFactors (SAP)
  - name: SuccessFactors
  - vendor: SAP
  - category: ATS
  - status: GA
  - health: Healthy
  - directionality: Unidirectional
  - capabilities: ["Job Sync"]

Capability Matrix (render)
- Columns: Capabilities set union across all integrations
- Rows: Each integration; show check icon if capability present
- Controls: filter by capability, export CSV

#### Design System
- Purpose: centralize Client-First approach and brand tokens.
- Sections:
  - Client-First Overview (short explainer, link slot)
  - Figma Embeds: three iframes/placeholders for “Design Tokens”, “Component Library”, “Templates”
  - Tokens Panel:
    - Colors (swatches with HSL values), Shadows (preview boxes), Gradients (preview strips), Radius, Typography
    - Copy-to-clipboard for each token value
  - Accessibility checklist (WCAG AA) with links to resources
  - “Design Docs” list auto-filtered from Docs tagged “design”

#### FAQ
- Accordion with common Q&A:
  - Where to find one-pagers?
  - How to add a new customer?
  - How to request a new integration?
  - What is Client-First?
  - Who owns ATS integrations?
- Allow quick-add FAQ (Admin only later)

#### Admin
- Source settings:
  - ClickUp API base URL (text)
  - ClickUp API token (text, masked)
  - Google Drive root folder IDs (string array)
- Sync buttons (stub functions):
  - Sync Customers, Sync Docs, Sync Integrations
- Data import:
  - CSV upload for Customers, Docs with field mapping step
- Roles (UI only for now): Admin, Editor, Viewer

#### Data Layer and Stubs
- Service functions (stub now, easily swapped to real API):
  - fetchCustomers(), fetchDocs(), fetchIntegrations(), fetchActivity()
  - create/update/delete for each entity type with optimistic UI and toasts
  - syncFromClickUp({ baseUrl, token }): fetch arrays for customers/docs/integrations (no-op stub)
  - notifyChange(entity, action): placeholder for Slack/webhook
- Seed local data on first load with provided customers, docs, and integrations; allow full CRUD.

#### Activity Model and Feed
- Activity {
  id, type: "customer" | "doc" | "integration",
  entity_id, action: "created" | "updated" | "status_changed" | "note_added",
  summary: string, timestamp: datetime, actor: string
}
- Generate mock recent activities:
  - e.g., “Peraton marked Live”, “Added ‘ATS Integration Playbook’ doc”, “iCIMS known limitations updated”

#### Search and UX
- Global search bar supports scope toggles (Customers, Docs, Integrations) and typeahead.
- Per-page search and filters with saved views (persist to local storage).
- Tables:
  - Sticky headers, subtle zebra, row hover, row click opens detail drawer
- Empty states:
  - Friendly illustration placeholder, concise copy, and CTA buttons
- Transitions:
  - transition-all duration-300 on interactive components

#### Responsive Behavior
- Mobile-first; sidebar collapses to icon rail on small screens; cards stack; tables show responsive card rows.

#### Deliverables
- Fully functional frontend implementing:
  - Sidebar + Dashboard + Customers + Docs + Integrations (with Capability Matrix) + Design System + FAQ + Admin
  - Semantic tokens, glassmorphism, gradients, shadows, transitions
  - Seeded data and full inline CRUD
  - Data service stubs ready for ClickUp API substitution via Admin settings
- Aim for a beautiful, modern, accessible UI consistent with the HireClix style.

Seed content specifics to include immediately:
- Customers (Career Sites): Peraton; Parsons Careers; 99 Restaurant Jobs; Cora Health; Penfed Careers; O’Charleys Careers; Penfed; Public Storage; CHS; Underground Chucks; Shepard Pratt
- Customers (JobFlow SEO): LKQ; TPG; Ignite Medical; The Container Store
- Docs: “Client-First Quickstart”; “ATS Integration Playbook”; “Career Site Launch Checklist”
- Integrations: iCIMS, Workday, Greenhouse, UKG, Crelate, SmartRecruiters, Hirebridge, Jobvite, Eightfold, SuccessFactors (SAP) with fields as defined above.

## Stack

- **Frontend**: Vite + React + TypeScript (hosted on Netlify)
- **Backend**: HireClix Supabase project `naazebxkoyuxbcmcwytc`

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
cp .env.example .env   # add anon/publishable key from Supabase dashboard (project naazebxkoyuxbcmcwytc)
npm i
npm run dev
```

## Deploy (Netlify)

Site: https://prioritize.hireclix.com (Netlify team: `dheselton`, also `hc-prioritize.netlify.app`)

```sh
npm run build
# Netlify uses netlify.toml (publish=dist, SPA fallback to index.html)
# Set site env vars (project naazebxkoyuxbcmcwytc):
#   VITE_SUPABASE_PROJECT_ID=naazebxkoyuxbcmcwytc
#   VITE_SUPABASE_URL=https://naazebxkoyuxbcmcwytc.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=<anon or publishable key from dashboard>
```

### Edge function secrets (Supabase)

Required for request confirmation / completion / portal / reminder emails (Resend).

**Preferred:** set in Dashboard → Edge Functions → Secrets (project `naazebxkoyuxbcmcwytc`):

```sh
supabase secrets set RESEND_API_KEY=re_xxx APP_URL=https://prioritize.hireclix.com --project-ref naazebxkoyuxbcmcwytc
```

**Fallback used in production today:** the same values live in Supabase Vault (`RESEND_API_KEY`, `APP_URL`) and are resolved at runtime via `public.get_edge_secret` (service_role only) when Deno env secrets are unset.

- Sender for request emails: `prioritize@product.hireclix.com` (verified Resend domain)
- Per-type Reply-To aliases (e.g. `careersite@hireclix.com`) are set by the app / completion trigger
