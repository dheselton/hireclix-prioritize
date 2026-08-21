import { test, expect } from "@playwright/test";
import {
  CORE_ROUTES,
  DEEP_LINK_ROUTES,
  expectNoDocumentOverflow,
} from "./helpers";

test.describe("Mobile shell", () => {
  test("auth page fits viewport and has no document overflow", async ({ page }, testInfo) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /HireClix Prioritize/i })).toBeVisible();
    await expectNoDocumentOverflow(page);
    if (testInfo.project.name.startsWith("mobile")) {
      await page.screenshot({
        path: `test-results/screenshots/${testInfo.project.name}-auth.png`,
        fullPage: false,
      });
    }
  });

  test("public quick-request form does not overflow", async ({ page }, testInfo) => {
    await page.goto("/f/quick-request");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await expectNoDocumentOverflow(page);
    if (testInfo.project.name === "mobile") {
      await page.screenshot({
        path: `test-results/screenshots/mobile-public-form.png`,
        fullPage: false,
      });
    }
  });
});

test.describe("Core routes — no document overflow", () => {
  for (const route of CORE_ROUTES) {
    test(`${route}`, async ({ page }, testInfo) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      // Unauthenticated users may land on /auth?next=… — still must fit viewport
      await expectNoDocumentOverflow(page);

      if (
        testInfo.project.name === "mobile" &&
        ["/", "/auth", "/pm", "/pm/work", "/f/quick-request", "/roadmap"].includes(route)
      ) {
        const slug = route.replace(/\W+/g, "_").replace(/^_/, "");
        await page.screenshot({
          path: `test-results/screenshots/mobile-${slug}.png`,
          fullPage: false,
        });
      }
    });
  }
});

test.describe("Deep links render without layout blowout", () => {
  for (const route of DEEP_LINK_ROUTES) {
    test(`${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      await expectNoDocumentOverflow(page);
    });
  }
});

test.describe("Mobile navigation", () => {
  test("auth CTA is touch-sized on phone widths", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only");
    await page.goto("/auth");
    const cta = page.getByRole("button").first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    await expectNoDocumentOverflow(page);
  });
});

test.describe("Auth gate", () => {
  test("protected inbox redirects anonymous users to auth", async ({ page }) => {
    await page.goto("/pm/inbox");
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/\/auth/);
    await expectNoDocumentOverflow(page);
  });
});
