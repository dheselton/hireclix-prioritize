import type { RequestType } from "@/components/pm/forms/useInternalRequestForm";

export type { RequestType };

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  web_edit: "Web edit",
  landing_page: "New landing page",
  careersite_update: "Career site update",
  careersite_bug: "Career site · Bug fix",
  careersite_content: "Career site · Content change",
  careersite_jobfeed: "Career site · API / Job feed",
  careersite_new_page: "Career site · New page",
  careersite_sow: "Career site · SOW project",
  careersite_support: "Career site · General support",
  banner_ads: "Banner ads",
  social: "Social post",
  email: "Email",
  copywriting: "Copywriting",
  job_description: "Job description",
  infographic: "Infographic",
  recruiter_collateral: "Recruiter collateral",
  event_collateral: "Event collateral",
  print_collateral: "Print collateral",
  swag_apparel: "Swag / apparel",
  video_edit: "Video edit",
  photo_retouch: "Photo retouch",
  presentation: "Presentation",
  brand_assets: "Brand assets",
  general: "General",
};

export const REQUEST_TYPE_GROUPS: { key: string; label: string; types: RequestType[] }[] = [
  { key: "career_site", label: "Career Site Support", types: ["careersite_bug", "careersite_content", "careersite_jobfeed", "careersite_new_page", "careersite_sow", "careersite_support", "careersite_update"] },
  { key: "web",                label: "Web",                types: ["web_edit", "landing_page"] },
  { key: "ads",                label: "Ads & Campaigns",    types: ["banner_ads", "social", "email"] },
  { key: "content",            label: "Content",            types: ["copywriting", "job_description", "infographic"] },
  { key: "print",              label: "Print & Collateral", types: ["recruiter_collateral", "event_collateral", "print_collateral", "swag_apparel"] },
  { key: "media",              label: "Media",              types: ["video_edit", "photo_retouch", "presentation"] },
  { key: "brand",              label: "Brand",              types: ["brand_assets"] },
  { key: "other",              label: "Other",              types: ["general"] },
];

export const REQUEST_TYPE_GROUP_KEYS = REQUEST_TYPE_GROUPS.map(g => g.key);

export function groupKeyForRequestType(slug: string | null | undefined): string {
  if (!slug) return "other";
  const hit = REQUEST_TYPE_GROUPS.find(g => (g.types as string[]).includes(slug));
  return hit?.key ?? "other";
}

export function requestTypeLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return (REQUEST_TYPE_LABELS as Record<string, string>)[slug] ?? slug;
}
