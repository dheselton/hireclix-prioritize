I’ll update the Work Queue dashboard layout so the Project Work column has a real bounded height and scrolls internally.

Plan:
1. Update the dashboard grid wrapper to reserve viewport height for the hero/actions/notes area instead of allowing the project cards to stretch the page.
2. Make `ProjectWorkColumn` a flex column with `min-h-0` and put only the project card list inside an `overflow-y-auto` container.
3. Give the scroll area a viewport-based max height at desktop sizes, with a smaller mobile-safe max height, so Notes & Reminders remains visible below the two-column section.
4. Apply the same `min-h-0`/bounded behavior to the Quick Tasks card only if needed for alignment, without changing its content or business logic.