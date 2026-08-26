import { groupKeyForRequestType } from "@/lib/pm/requestTypes";
import type { PmUser } from "@/types/pm";

/** Request groups that fan out bell/email on new intake (excludes general/other). */
export const CREATIVE_PRODUCTION_GROUP_KEYS = [
  "web",
  "print",
  "media",
  "brand",
  "content",
  "ads",
  "career_site",
] as const;

export type CreativeProductionGroupKey = (typeof CREATIVE_PRODUCTION_GROUP_KEYS)[number];

const CREATIVE_PRODUCTION_EMAILS = new Set([
  "dan.heselton@hireclix.com",
  "lisa.thompson@hireclix.com",
]);

const PRODUCTION_ROLES = new Set(["designer", "developer", "tech_lead"]);

export function isCreativeProductionRequest(requestType: string | null | undefined): boolean {
  const key = groupKeyForRequestType(requestType);
  return (CREATIVE_PRODUCTION_GROUP_KEYS as readonly string[]).includes(key);
}

export function isCreativeProductionGroupKey(groupKey: string | null | undefined): boolean {
  return !!groupKey && (CREATIVE_PRODUCTION_GROUP_KEYS as readonly string[]).includes(groupKey);
}

export function rolesForUser(user: Pick<PmUser, "role" | "roles" | "secondary_role">): string[] {
  if (Array.isArray(user.roles) && user.roles.length) return user.roles;
  return [user.role, user.secondary_role].filter(Boolean) as string[];
}

/** Designers, developers, Lisa, and Dan — not PM-only staff. */
export function isCreativeProductionRecipient(
  user: Pick<PmUser, "role" | "roles" | "secondary_role" | "email" | "is_active">,
): boolean {
  if (user.is_active === false) return false;
  const email = (user.email ?? "").trim().toLowerCase();
  if (email && CREATIVE_PRODUCTION_EMAILS.has(email)) return true;
  return rolesForUser(user).some(r => PRODUCTION_ROLES.has(r));
}
