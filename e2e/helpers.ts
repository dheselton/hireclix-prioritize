import { expect, type Locator, type Page } from "@playwright/test";

/** Assert the document itself does not scroll horizontally (intentional inner strips OK). */
export async function expectNoDocumentOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0),
    };
  });
  expect(
    metrics.scrollWidth,
    `Document horizontal overflow: scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

/**
 * Assert an element (plus optional margin for shadows/rings) is not clipped by
 * any ancestor with a non-visible overflow.
 */
export async function expectNotClipped(
  page: Page,
  target: Locator | string,
  opts: { margin?: number } = {},
) {
  const margin = opts.margin ?? 2;
  const locator = typeof target === "string" ? page.locator(target).first() : target;
  await expect(locator).toBeVisible();

  const result = await locator.evaluate((el, m) => {
    const rect = el.getBoundingClientRect();
    const expanded = {
      top: rect.top - m,
      left: rect.left - m,
      bottom: rect.bottom + m,
      right: rect.right + m,
    };

    let clip = {
      top: 0,
      left: 0,
      bottom: window.innerHeight,
      right: window.innerWidth,
    };

    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const ox = style.overflowX;
      const oy = style.overflowY;
      const clips =
        ox === "hidden" || ox === "auto" || ox === "scroll" ||
        oy === "hidden" || oy === "auto" || oy === "scroll";
      if (clips) {
        const r = node.getBoundingClientRect();
        clip = {
          top: Math.max(clip.top, r.top),
          left: Math.max(clip.left, r.left),
          bottom: Math.min(clip.bottom, r.bottom),
          right: Math.min(clip.right, r.right),
        };
      }
      node = node.parentElement;
    }

    const fullyInside =
      expanded.top >= clip.top - 0.5 &&
      expanded.left >= clip.left - 0.5 &&
      expanded.bottom <= clip.bottom + 0.5 &&
      expanded.right <= clip.right + 0.5;

    return {
      fullyInside,
      expanded,
      clip,
      text: (el.textContent || "").slice(0, 40),
    };
  }, margin);

  expect(
    result.fullyInside,
    `Clipped "${result.text}": element ${JSON.stringify(result.expanded)} vs clip ${JSON.stringify(result.clip)}`,
  ).toBe(true);
}

export async function openSidebarIfMobile(page: Page) {
  const trigger = page.getByRole("button", { name: /toggle sidebar|open sidebar|sidebar/i }).first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
  }
}

export const CORE_ROUTES = [
  "/auth",
  "/",
  "/pm",
  "/pm/my-work",
  "/pm/work",
  "/pm/inbox",
  "/pm/workload",
  "/pm/timeline",
  "/pm/time",
  "/pm/clients",
  "/pm/report",
  "/pm/forms",
  "/pm/templates",
  "/pm/integrations",
  "/snippets",
  "/pm/help",
  "/pm/settings",
  "/pm/settings/profile",
  "/pm/settings/notifications",
  "/roadmap",
  "/roadmap/dashboard",
  "/f/quick-request",
] as const;

export const DEEP_LINK_ROUTES = [
  "/pm/projects/00000000-0000-0000-0000-000000000000",
  "/pm/tasks/00000000-0000-0000-0000-000000000000",
  "/pm/clients/00000000-0000-0000-0000-000000000000",
] as const;
