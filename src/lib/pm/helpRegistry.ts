/**
 * Persona training packs for /pm/help.
 * Markdown lives in docs/guides/; this registry maps packs → guides + surfaces.
 */

import type { PmRole } from "@/types/pm";
import type { Surface } from "@/lib/pm/permissions";
import { canSee, toRoles, type RoleOrRoles } from "@/lib/pm/permissions";

export type HelpPackId =
  | "operators"
  | "tech-lead"
  | "production"
  | "specialists"
  | "submitter"
  | "external";

export type HelpGuide = {
  /** Path relative to docs/guides/, without .md — e.g. "operators/your-day" */
  slug: string;
  title: string;
  minutes: number;
  /** Surfaces this guide references; filtered when the user lacks access */
  surfaces?: Surface[];
  /** Shown to everyone even if surfaces are blocked (e.g. glossary, external) */
  alwaysShow?: boolean;
};

export type HelpPack = {
  id: HelpPackId;
  label: string;
  description: string;
  roles: PmRole[];
  /** Match when user has only these roles (submitter-only) */
  submitterOnly?: boolean;
  /** Always listable (client portal / public form guides) */
  alwaysAvailable?: boolean;
  guides: HelpGuide[];
};

export const HELP_PACKS: HelpPack[] = [
  {
    id: "operators",
    label: "Operators",
    description: "PM & BA — full app, intake, team, clients",
    roles: ["pm", "ba"],
    guides: [
      { slug: "operators/your-day", title: "Your day", minutes: 4, surfaces: ["queue", "inbox", "work", "report"] },
      { slug: "operators/intake-and-triage", title: "Intake & triage", minutes: 5, surfaces: ["inbox", "forms"] },
      { slug: "operators/career-site-template", title: "Career site template", minutes: 8, surfaces: ["templates"] },
      { slug: "operators/career-site-project", title: "Start career site project", minutes: 7, surfaces: ["templates", "work"] },
      { slug: "operators/live-sites-and-support", title: "Live sites & support", minutes: 5, surfaces: ["clients"] },
      { slug: "operators/team-and-access", title: "Team & access", minutes: 3, surfaces: ["team"] },
      { slug: "operators/clients-forms-portal", title: "Clients, forms & portal", minutes: 4, surfaces: ["clients", "forms"] },
      { slug: "_shared/career-site-build", title: "Career site deep-dive", minutes: 12, surfaces: ["templates", "work"] },
      { slug: "_shared/glossary", title: "Glossary", minutes: 2, alwaysShow: true },
    ],
  },
  {
    id: "tech-lead",
    label: "Tech lead",
    description: "Ops surfaces, vendors, snippets — not Inbox/Team/Templates",
    roles: ["tech_lead"],
    guides: [
      { slug: "tech-lead/your-day", title: "Your day", minutes: 4, surfaces: ["queue", "work", "workload"] },
      { slug: "tech-lead/vendors-and-snippets", title: "Vendors & snippets", minutes: 3, surfaces: ["vendors", "snippets"] },
      { slug: "_shared/career-site-build", title: "Career site deep-dive", minutes: 10, surfaces: ["work"] },
      { slug: "_shared/glossary", title: "Glossary", minutes: 2, alwaysShow: true },
    ],
  },
  {
    id: "production",
    label: "Production",
    description: "Designers & developers — tasks, time, snippets",
    roles: ["designer", "developer"],
    guides: [
      { slug: "production/your-day", title: "Your day", minutes: 4, surfaces: ["queue", "work", "time"] },
      { slug: "production/task-workspace", title: "Task workspace", minutes: 4, surfaces: ["taskWorkspace"] },
      { slug: "production/snippets-and-loom", title: "Snippets & Loom", minutes: 3, surfaces: ["snippets", "loomLibrary"] },
      { slug: "_shared/career-site-build", title: "Career site deep-dive", minutes: 10, surfaces: ["work"] },
      { slug: "_shared/glossary", title: "Glossary", minutes: 2, alwaysShow: true },
    ],
  },
  {
    id: "specialists",
    label: "Specialists",
    description: "Strategist, analyst, QA, CSM, support",
    roles: ["strategist", "analyst", "qa", "csm", "support"],
    guides: [
      { slug: "specialists/your-day", title: "Your day", minutes: 4, surfaces: ["queue", "work", "time"] },
      { slug: "_shared/glossary", title: "Glossary", minutes: 2, alwaysShow: true },
    ],
  },
  {
    id: "submitter",
    label: "Submitter",
    description: "Request work and track it in My Work",
    roles: ["submitter"],
    submitterOnly: true,
    guides: [
      { slug: "submitter/your-day", title: "Your day", minutes: 3, surfaces: ["myWork", "forms"] },
      { slug: "_shared/glossary", title: "Glossary", minutes: 2, alwaysShow: true },
    ],
  },
  {
    id: "external",
    label: "External",
    description: "Client portal & public intake forms",
    roles: [],
    alwaysAvailable: true,
    guides: [
      { slug: "external/client-portal", title: "Client portal", minutes: 3, alwaysShow: true },
      { slug: "external/public-form", title: "Public form", minutes: 2, alwaysShow: true },
      { slug: "_shared/glossary", title: "Glossary", minutes: 2, alwaysShow: true },
    ],
  },
];

const PACK_BY_ID = Object.fromEntries(HELP_PACKS.map((p) => [p.id, p])) as Record<HelpPackId, HelpPack>;

/** Packs that match the signed-in user's roles (not including External peek). */
export function matchedPacks(role: RoleOrRoles): HelpPack[] {
  const roles = toRoles(role);
  const submitterOnly = roles.every((r) => r === "submitter");
  const matched: HelpPack[] = [];

  for (const pack of HELP_PACKS) {
    if (pack.alwaysAvailable) continue;
    if (pack.submitterOnly) {
      if (submitterOnly) matched.push(pack);
      continue;
    }
    if (pack.roles.some((r) => roles.includes(r))) matched.push(pack);
  }
  return matched;
}

/** Matched packs first, then other packs for peeking (submitter pack hidden unless submitter-only). */
export function packsForRoles(role: RoleOrRoles): HelpPack[] {
  const roles = toRoles(role);
  const submitterOnly = roles.every((r) => r === "submitter");
  const matched = matchedPacks(role);

  const peek = HELP_PACKS.filter((p) => {
    if (matched.includes(p)) return false;
    if (p.submitterOnly && !submitterOnly) return false;
    return true;
  });

  return [...matched, ...peek];
}

/** Default pack for the signed-in user. */
export function defaultPackId(role: RoleOrRoles): HelpPackId {
  const roles = toRoles(role);
  if (roles.every((r) => r === "submitter")) return "submitter";
  if (roles.some((r) => r === "pm" || r === "ba")) return "operators";
  if (roles.some((r) => r === "tech_lead")) return "tech-lead";
  if (roles.some((r) => r === "designer" || r === "developer")) return "production";
  if (roles.some((r) => r === "strategist" || r === "analyst" || r === "qa" || r === "csm" || r === "support")) {
    return "specialists";
  }
  return "external";
}

export function getPack(id: HelpPackId): HelpPack {
  return PACK_BY_ID[id];
}

/** Guides visible for this pack given the user's surfaces. */
export function visibleGuides(pack: HelpPack, role: RoleOrRoles): HelpGuide[] {
  return pack.guides.filter((g) => {
    if (g.alwaysShow) return true;
    if (!g.surfaces?.length) return true;
    return g.surfaces.some((s) => canSee(role, s));
  });
}

export function findGuide(slug: string): { pack: HelpPack; guide: HelpGuide } | null {
  for (const pack of HELP_PACKS) {
    const guide = pack.guides.find((g) => g.slug === slug);
    if (guide) return { pack, guide };
  }
  return null;
}

/** Parse ?guide=operators/your-day into pack + slug. */
export function parseGuideParam(param: string | null): { packId: HelpPackId; slug: string } | null {
  if (!param) return null;
  const found = findGuide(param);
  if (found) return { packId: found.pack.id, slug: found.guide.slug };
  // Allow pack-only: ?guide=operators
  if (param in PACK_BY_ID) {
    const pack = PACK_BY_ID[param as HelpPackId];
    return { packId: pack.id, slug: pack.guides[0]?.slug ?? "_shared/glossary" };
  }
  return null;
}
