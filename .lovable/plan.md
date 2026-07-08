Refine the AppSidebar hierarchy so sections and counts read more clearly without increasing font size.

### What we'll change

1. **Section dividers**
   - Add a subtle `border-t` / `Separator` between major sections (Navigate → My Work → Configure → Resources → Roadmap).
   - Keep spacing compact; the line is the cue, not whitespace.

2. **Differentiated section labels**
   - **My Work** label becomes the strongest: use `text-foreground` with a small primary-colored indicator (e.g. a `bg-primary` pip or left accent) so the user's own content is the visual anchor.
   - **Navigate / Configure / Resources / Roadmap** labels stay muted but consistent: `text-[10px] uppercase tracking-wider text-muted-foreground`.

3. **Subtle "My Work" band**
   - Wrap the My Work content in a very light rounded container (`bg-card/60` or `bg-accent/25`) with a thin border. This separates personal work from global navigation without calling attention to itself.

4. **Count badge hierarchy**
   - Quick Tasks count: switch from tiny muted text to a compact pill (`bg-primary/10 text-primary text-[11px] font-semibold tabular-nums min-w-[1.25rem]`), mirroring the active project count.
   - Active Projects count: upgrade from `bg-muted text-muted-foreground` to the same primary-pill style when inactive, and a stronger filled/foreground variant when the project is active.
   - Unclaimed Work Queue badge stays as-is (amber pulse) — it already has enough hierarchy.

5. **Subsection header polish**
   - "Quick Tasks" and "Active Projects" headers get a slightly more deliberate row: icon + label left-aligned, count badge right-aligned, with consistent `text-[11px] font-semibold text-foreground/80`.
   - Empty state stays italic muted.

6. **Alignment and tabular numbers**
   - All counts use `tabular-nums` and equal minimum widths so rows with single-digit and double-digit counts align cleanly.

### Files to edit
- `src/components/AppSidebar.tsx` — layout, labels, counts, dividers.
- No new files; purely presentational refinements.

### Out of scope
- No font-size increases beyond 1px where noted.
- No new data or features.
- No sidebar collapse behavior changes.