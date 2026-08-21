import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WorkListSkeleton, WorkLoadError } from "./WorkLoadingState";

afterEach(cleanup);

describe("work loading states", () => {
  it("announces loading without rendering an empty-state message", () => {
    render(<WorkListSkeleton rows={4} />);

    expect(screen.getByLabelText("Loading work").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText(/no work|no tasks|no projects/i)).toBeNull();
  });

  it("offers a retry action for failed reads", () => {
    let retries = 0;
    render(<WorkLoadError retry={() => { retries += 1; }} />);

    screen.getByRole("button", { name: "Try again" }).click();
    expect(retries).toBe(1);
  });
});
