import type { RequestType } from "@/components/pm/forms/useInternalRequestForm";

/**
 * Per-request-type sender alias, shown on the submission confirmation screen so
 * submitters know which inbox handles their request. Automated confirmation and
 * completion emails are sent by the `send-request-email` edge function from
 * prioritize@hireclix.com.
 */
export const REQUEST_TYPE_ALIASES: Record<RequestType, string> = {
  careersite_bug:      "careersite@hireclix.com",
  careersite_content:  "careersite@hireclix.com",
  careersite_jobfeed:  "careersite@hireclix.com",
  careersite_new_page: "careersite@hireclix.com",
  careersite_sow:      "careersite@hireclix.com",
  careersite_support:  "careersite@hireclix.com",
  careersite_update:   "careersite@hireclix.com",
  web_edit:            "web@hireclix.com",
  landing_page:        "web@hireclix.com",
  banner_ads:          "ads@hireclix.com",
  social:              "ads@hireclix.com",
  email:               "ads@hireclix.com",
  copywriting:         "content@hireclix.com",
  job_description:     "content@hireclix.com",
  infographic:         "content@hireclix.com",
  recruiter_collateral:"creative@hireclix.com",
  event_collateral:    "creative@hireclix.com",
  print_collateral:    "creative@hireclix.com",
  swag_apparel:        "creative@hireclix.com",
  video_edit:          "media@hireclix.com",
  photo_retouch:       "media@hireclix.com",
  presentation:        "media@hireclix.com",
  brand_assets:        "brand@hireclix.com",
  general:             "requests@hireclix.com",
};

export const DEFAULT_ALIAS = "requests@hireclix.com";

export function aliasFor(requestType: RequestType | string | null | undefined): string {
  if (!requestType) return DEFAULT_ALIAS;
  return (REQUEST_TYPE_ALIASES as Record<string, string>)[requestType] ?? DEFAULT_ALIAS;
}
