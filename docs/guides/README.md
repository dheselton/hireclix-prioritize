# Persona training guides

Shareable markdown for HireClix Prioritize. The same files render in-app at **`/pm/help`**.

## Packs

| Pack | Roles | Folder |
|------|--------|--------|
| Operators | PM, BA | `operators/` |
| Tech lead | Tech lead | `tech-lead/` |
| Production | Designer, Developer | `production/` |
| Specialists | Strategist, Analyst, QA, CSM, Support | `specialists/` |
| Submitter | Submitter only | `submitter/` |
| External | Client portal & public forms | `external/` |
| Shared | Glossary + career-site deep-dive | `_shared/` |

Key operator Career Site guides: `operators/career-site-template.md`, `operators/career-site-project.md`, `_shared/career-site-build.md`.

## Guide format

1. **When to use this**
2. Numbered steps with **Go to [Screen](/route)** links
3. **Done when**
4. Optional **If this happens**

## Editing

1. Edit or add a `.md` file under this folder.
2. Register the guide in `src/lib/pm/helpRegistry.ts` (slug, title, minutes, surfaces).
3. Deep link: `https://prioritize.hireclix.com/pm/help?guide=operators/your-day`

No deploy is required to share a raw file from this folder in Slack; the in-app hub picks up changes on the next build.
