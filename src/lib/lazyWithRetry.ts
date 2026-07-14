import { lazy, type ComponentType } from "react";

/**
 * lazy() wrapper that handles stale chunk errors after a redeploy.
 * Strategy:
 *  1. First failure → retry the import once after a short delay (handles transient network blips).
 *  2. Still failing → force a full page reload (once per session) so the browser fetches the fresh index.html
 *     with the new chunk hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const KEY = "lovable:chunk-reloaded";
    const isChunkError = (err: unknown) => {
      const msg = String((err as any)?.message ?? err);
      return /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module/i.test(
        msg
      );
    };

    try {
      return await factory();
    } catch (err) {
      if (!isChunkError(err)) throw err;

      // Retry once — sometimes a transient network hiccup.
      try {
        await new Promise((r) => setTimeout(r, 300));
        return await factory();
      } catch (err2) {
        if (!isChunkError(err2)) throw err2;

        const alreadyReloaded = sessionStorage.getItem(KEY);
        if (!alreadyReloaded) {
          sessionStorage.setItem(KEY, "1");
          // Force reload from server to pick up the new index.html + fresh chunk hashes.
          window.location.reload();
          return new Promise<never>(() => {});
        }
        // Already reloaded once — clear so a future deploy can retry, then surface the error.
        sessionStorage.removeItem(KEY);
        throw err2;
      }
    }
  });
}
