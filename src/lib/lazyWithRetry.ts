import { lazy, type ComponentType } from "react";

/**
 * lazy() wrapper that handles stale chunk errors after a redeploy.
 * If a dynamic import fails (old hash no longer exists), reload the page once.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const KEY = "lovable:chunk-reloaded";
    try {
      return await factory();
    } catch (err) {
      const alreadyReloaded = sessionStorage.getItem(KEY);
      const msg = String((err as any)?.message ?? err);
      const isChunkError =
        /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg);
      if (isChunkError && !alreadyReloaded) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
        // Return a never-resolving promise so React doesn't render an error before reload.
        return new Promise<never>(() => {});
      }
      throw err;
    } finally {
      // Clear the flag on a successful load so future stale-chunks can still trigger one reload.
      setTimeout(() => sessionStorage.removeItem(KEY), 10_000);
    }
  });
}
