import { test, expect } from "@playwright/test";
import { expectNoDocumentOverflow } from "./helpers";

test.describe("Critical mobile interactions", () => {
  test("task deep link lands without document overflow", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile") && testInfo.project.name !== "tablet", "Phone/tablet focus");
    await page.goto("/pm/tasks/00000000-0000-0000-0000-000000000000?task=00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);
    await expectNoDocumentOverflow(page);
  });

  test("project deep link with tab query stays within viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile/tablet focus");
    for (const tab of ["overview", "tasks", "files", "timeline"]) {
      await page.goto(`/pm/projects/00000000-0000-0000-0000-000000000000?tab=${tab}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(400);
      await expectNoDocumentOverflow(page);
    }
  });

  test("project route without tab defaults toward overview hierarchy", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile/tablet focus");
    await page.goto("/pm/projects/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);
    await expect(page.locator("body")).toBeVisible();
    await expectNoDocumentOverflow(page);
    // Auth gate or loaded project — either way the document must fit.
  });

  test("timesheet project filter query stays within viewport", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile") && testInfo.project.name !== "tablet", "Phone/tablet focus");
    await page.goto("/pm/time?project=00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    await expectNoDocumentOverflow(page);
  });

  test("notifications settings route does not overflow", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only");
    await page.goto("/pm/settings/notifications");
    await page.waitForTimeout(400);
    // May redirect to auth when anonymous
    await expectNoDocumentOverflow(page);
  });

  test("work route fits viewport (or auth gate)", async ({ page }) => {
    await page.goto("/pm/work");
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
});
