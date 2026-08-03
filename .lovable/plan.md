# Add public request form redirect routes

## Goal
Make `/request` and `/pm/request` resolve to the public quick-request form at `/f/quick-request` instead of returning 404.

## What will change
Only `src/App.tsx`:
- Add two new `<Route>` declarations using `Navigate` from `react-router-dom`.
- Place them near the existing `/f/:slug` route and other `/pm` redirect routes.

## Implementation details

1. **Import**  
   `Navigate` is already imported in `src/App.tsx` (line 7), so no new import is needed.

2. **Add redirect routes**  
   Insert the following routes inside the `<Routes>` block, alongside the existing `/pm` redirects:

   ```tsx
   <Route path="/request" element={<Navigate to="/f/quick-request" replace />} />
   <Route path="/pm/request" element={<Navigate to="/f/quick-request" replace />} />
   ```

3. **No other changes**  
   - Do not modify `PublicForm.tsx` or the `/f/:slug` route.
   - Do not change the form component or any other routing logic.

## Verification
After the change:
- Navigating to `/request` redirects to `/f/quick-request` and renders the quick-request form.
- Navigating to `/pm/request` redirects to `/f/quick-request` and renders the quick-request form.
- The `/f/:slug` route continues to work as before.
