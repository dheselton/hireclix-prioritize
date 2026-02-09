

## Add GitHub Repo and Versioned Code Snippets to Technical Tab

This plan adds two new sections to the existing **Technical** tab in the Feature Detail drawer: a GitHub repository link field, and a comprehensive versioned code snippets manager.

### What You Will Get

1. **GitHub Repository Field** -- A dedicated input at the top of the Technical tab to link a GitHub repo URL (clickable via the existing SmartTextarea/linkified text system).

2. **Code Snippets Manager** -- A full-featured section for storing code snippets with:
   - Title/label for each snippet
   - Language selector (JavaScript, TypeScript, HTML, CSS, Python, SQL, JSON, etc.)
   - Syntax-highlighted code block display (using a `<pre><code>` styled block with monospace font)
   - Version history per snippet: each snippet tracks an array of versions with version label, code content, timestamp, and optional notes
   - Ability to add a new version to an existing snippet (previous versions are preserved and viewable)
   - Collapse/expand to browse older versions
   - Delete individual snippets

### Technical Approach

**1. Update `TechnicalData` type** (`src/types/featureDetail.ts`)

Add new interfaces and fields:

```typescript
interface CodeSnippetVersion {
  id: string;
  versionLabel: string;   // e.g. "v1.0", "v2.1"
  code: string;
  language: string;
  notes: string;
  createdAt: string;      // ISO timestamp
}

interface CodeSnippet {
  id: string;
  title: string;
  language: string;
  versions: CodeSnippetVersion[];
}
```

Add to `TechnicalData`:
- `githubRepoUrl: string`
- `codeSnippets: CodeSnippet[]`

**2. Update default data** (`src/components/roadmap/FeatureDetailDrawer.tsx`)

Add `githubRepoUrl: ''` and `codeSnippets: []` to `defaultTechnicalData`.

**3. Build Code Snippets UI** (`src/components/roadmap/feature-detail/TechnicalTab.tsx`)

Add two new sections after the existing "Implementation Tasks" section:

- **GitHub Repository**: A single input field with a GitHub icon, using SmartTextarea so the URL is clickable.
- **Code Snippets**: Using the RepeatableList pattern for snippets. Each snippet card shows:
  - Title input and language dropdown
  - The latest version's code in a styled monospace `<pre>` block
  - An "Add Version" button that appends a new version entry
  - A collapsible section showing version history (version label, date, notes, and code)
  - Edit mode for the current/new version's code via a `<textarea>` with monospace font

All data is persisted in the existing `technical_notes` JSON field -- no database migration needed since it's already a flexible JSON blob.

### Files to Change

| File | Change |
|------|--------|
| `src/types/featureDetail.ts` | Add `CodeSnippetVersion`, `CodeSnippet` interfaces; add fields to `TechnicalData` |
| `src/components/roadmap/FeatureDetailDrawer.tsx` | Update `defaultTechnicalData` with new fields |
| `src/components/roadmap/feature-detail/TechnicalTab.tsx` | Add GitHub repo input and Code Snippets manager UI |

