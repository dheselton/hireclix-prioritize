## Plan

1. **Wire Me Mode into the Project Detail Tasks tab**
   - Read the global `useMeMode()` state inside `ProjectDetail` / `TaskTabContent`.
   - When Me Mode is active, filter each phase’s task list to only tasks assigned to the selected current user.
   - Keep the existing role quick filters (`All | PM | Design | Dev | Review`) working together with Me Mode, so the result is: role/type filter first, then “Me” filter.

2. **Make the active context visible**
   - Add a small inline context label near the Tasks tab filter row when Me Mode is active, such as `Showing my tasks`, so users can tell why fewer rows appear.
   - Preserve the existing top-bar Me/All toggle and hotkey behavior.

3. **Handle empty phase results cleanly**
   - If a phase has no tasks after Me Mode filtering, avoid showing unrelated tasks.
   - Show the existing empty phase/add-task state normally, so users can still add tasks to that phase.

4. **Validate the behavior**
   - Confirm the Project Detail screen now hides tasks assigned to other users when `Me` is selected.
   - Confirm switching back to `All` restores the full role-filtered task list.