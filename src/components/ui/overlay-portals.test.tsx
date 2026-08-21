import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

afterEach(() => cleanup());

describe("overlay portals", () => {
  it("TooltipContent escapes an overflow:hidden ancestor", async () => {
    const { container } = render(
      <TooltipProvider delayDuration={0}>
        <div data-testid="clipper" style={{ overflow: "hidden", width: 80, height: 40 }}>
          <Tooltip defaultOpen>
            <TooltipTrigger asChild>
              <button type="button">Flag</button>
            </TooltipTrigger>
            <TooltipContent>Priority: Medium</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>,
    );

    const clipper = container.querySelector('[data-testid="clipper"]')!;
    await waitFor(() => {
      const tip = document.body.querySelector('[role="tooltip"]');
      expect(tip).toBeTruthy();
      expect(clipper.contains(tip!)).toBe(false);
    });
  });

  it("HoverCardContent escapes an overflow:hidden ancestor", async () => {
    const { container } = render(
      <div data-testid="clipper" style={{ overflow: "hidden", width: 80, height: 40 }}>
        <HoverCard open>
          <HoverCardTrigger asChild>
            <button type="button">Hover me</button>
          </HoverCardTrigger>
          <HoverCardContent>Card details</HoverCardContent>
        </HoverCard>
      </div>,
    );

    const clipper = container.querySelector('[data-testid="clipper"]')!;
    await waitFor(() => {
      const content = Array.from(document.body.querySelectorAll("*")).find(
        (el) => el.textContent?.trim() === "Card details",
      );
      expect(content).toBeTruthy();
      expect(clipper.contains(content!)).toBe(false);
    });
  });
});
