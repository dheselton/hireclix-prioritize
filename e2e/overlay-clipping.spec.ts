import { test, expect } from "@playwright/test";
import { expectNotClipped, expectNoDocumentOverflow } from "./helpers";

/**
 * Guards against hover-lift / tooltip clipping regressions.
 *
 * Anonymous runs often redirect protected routes to /auth — in that case we
 * skip cleanly. Pass PW_STORAGE_STATE=/path/to/storage.json to exercise the
 * authenticated dashboard (Quick Tasks card-lift + PriorityFlag tooltips).
 */
test.describe("Overlay / hover clipping", () => {
  test.use({
    storageState: process.env.PW_STORAGE_STATE || undefined,
  });

  test("tooltips and card-lift hover are not clipped when present", async ({ page }, testInfo) => {
    // Prefer desktop for hover interactions
    test.skip(testInfo.project.name.startsWith("mobile"), "Hover-focused; desktop/tablet only");

    await page.goto("/pm", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    // Auth gate — nothing to assert
    if (page.url().includes("/auth")) {
      test.skip(true, "Authenticated session required (set PW_STORAGE_STATE)");
      return;
    }

    await expectNoDocumentOverflow(page);

    const cards = page.locator(".card-lift");
    const cardCount = await cards.count();
    if (cardCount === 0) {
      test.skip(true, "No .card-lift elements on this route");
      return;
    }

    const card = cards.first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(250);
    // Shadow/ring margin: lift paints ~1–2px outside the box
    await expectNotClipped(page, card, { margin: 2 });

    // PriorityFlag tooltip (aria-label="Priority: …")
    const flag = page.locator('[aria-label^="Priority:"]').first();
    if (await flag.count() === 0) {
      return;
    }
    await flag.hover();
    await page.waitForTimeout(300);
    const tip = page.locator('[role="tooltip"]').first();
    if (await tip.isVisible().catch(() => false)) {
      await expect(tip).toContainText(/Priority:/i);
      // Tooltips are portaled — still assert they aren't viewport-clipped oddly
      const box = await tip.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual((await page.viewportSize())!.width + 1);
      }
    }
  });
});
