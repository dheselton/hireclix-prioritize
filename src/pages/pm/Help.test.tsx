import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { PmRole } from "@/types/pm";

const authState = vi.hoisted(() => ({
  roles: ["pm"] as PmRole[],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    roles: authState.roles,
    user: null,
    session: null,
    loading: false,
    access: "approved",
    pmUser: null,
    signInWithGoogle: async () => ({ error: null }),
    signOut: async () => undefined,
    refreshPmUser: async () => undefined,
  }),
}));

import Help from "@/pages/pm/Help";

function renderHelp(path = "/pm/help") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Help />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  authState.roles = ["pm"];
});

describe("Help hub", () => {
  it("opens Operators pack for PM with your-day content", () => {
    authState.roles = ["pm"];
    renderHelp();
    expect(screen.getByRole("heading", { name: /Help & Walkthroughs/i })).toBeTruthy();
    expect(screen.getByText(/Your day \(Operators\)/i)).toBeTruthy();
    expect(screen.getByText(/Triage Inbox/i)).toBeTruthy();
  });

  it("opens Production pack for designer", () => {
    authState.roles = ["designer"];
    renderHelp();
    expect(screen.getByText(/Your day \(Production\)/i)).toBeTruthy();
    expect(screen.getAllByText(/Snippets/i).length).toBeGreaterThan(0);
  });

  it("opens Submitter pack for submitter-only", () => {
    authState.roles = ["submitter"];
    renderHelp();
    expect(screen.getByText(/Your day \(Submitter\)/i)).toBeTruthy();
    expect(screen.getAllByText(/My Work/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Triage Inbox/i)).toBeNull();
  });

  it("honors ?guide= deep link", () => {
    authState.roles = ["pm"];
    renderHelp("/pm/help?guide=_shared/glossary");
    expect(screen.getByRole("heading", { name: /^Glossary$/i })).toBeTruthy();
    expect(screen.getByText(/Me mode vs All mode/i)).toBeTruthy();
  });

  it("lets users peek another pack", () => {
    authState.roles = ["pm"];
    renderHelp();
    fireEvent.click(screen.getByRole("button", { name: /^External/i }));
    const guideNav = screen.getByText(/^Guides$/i).parentElement!;
    fireEvent.click(within(guideNav).getByRole("button", { name: /Public form/i }));
    expect(screen.getByText(/Public form \(intake\)/i)).toBeTruthy();
  });
});
