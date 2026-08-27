/** Creation mechanism for tasks and projects (distinct from created_by actor). */
export type CreationSource =
  | "manual"
  | "intake"
  | "public_form"
  | "csv_import"
  | "qa_batch"
  | "template"
  | "page_generator"
  | "automation"
  | "unknown";

export const CREATION_SOURCES: CreationSource[] = [
  "manual",
  "intake",
  "public_form",
  "csv_import",
  "qa_batch",
  "template",
  "page_generator",
  "automation",
  "unknown",
];

export type CreationContext = Record<string, unknown>;

const SOURCE_LABELS: Record<CreationSource, string> = {
  manual: "Manual",
  intake: "Intake",
  public_form: "Public form",
  csv_import: "CSV import",
  qa_batch: "QA batch",
  template: "Template",
  page_generator: "Page generator",
  automation: "Automation",
  unknown: "Unknown source",
};

export function isCreationSource(value: unknown): value is CreationSource {
  return typeof value === "string" && (CREATION_SOURCES as string[]).includes(value);
}

export function normalizeCreationSource(value: unknown): CreationSource {
  return isCreationSource(value) ? value : "unknown";
}

export function creationSourceLabel(source: CreationSource | null | undefined): string {
  return SOURCE_LABELS[normalizeCreationSource(source)];
}

/** Short badge text suitable for compact cards. */
export function creationSourceBadge(source: CreationSource | null | undefined): string {
  const s = normalizeCreationSource(source);
  if (s === "unknown") return "Unknown";
  return SOURCE_LABELS[s];
}

export interface AttributionFields {
  created_by?: string | null;
  creation_source?: CreationSource | string | null;
  creation_context?: CreationContext | null;
  requested_by?: string | null;
}

export interface AttributionDisplay {
  /** Primary line, e.g. "Created by Alex · CSV import" */
  primary: string;
  /** Optional second line when requester differs from creator */
  secondary: string | null;
  /** Compact single-line for tight layouts */
  compact: string;
  creatorId: string | null;
  requesterId: string | null;
  source: CreationSource;
  sourceLabel: string;
  showRequesterSeparately: boolean;
}

function resolveName(
  userId: string | null | undefined,
  users: { id: string; name: string }[],
): string | null {
  if (!userId) return null;
  return users.find((u) => u.id === userId)?.name ?? null;
}

/**
 * Build human-readable attribution for a task or project.
 * Collapses requested-by into created-by when they match.
 */
export function formatAttribution(
  fields: AttributionFields,
  users: { id: string; name: string }[],
): AttributionDisplay {
  const source = normalizeCreationSource(fields.creation_source);
  const sourceLabel = creationSourceLabel(source);
  const creatorId = fields.created_by ?? null;
  const requesterId = fields.requested_by ?? null;
  const creatorName = resolveName(creatorId, users);
  const requesterName = resolveName(requesterId, users);
  const ctx = fields.creation_context ?? {};

  const submitterName =
    typeof ctx.submitter_name === "string" && ctx.submitter_name.trim()
      ? ctx.submitter_name.trim()
      : null;
  const reportedBy =
    typeof ctx.reported_by_name === "string" && ctx.reported_by_name.trim()
      ? ctx.reported_by_name.trim()
      : null;

  let actorLabel: string | null = null;
  if (creatorName) {
    actorLabel = `Created by ${creatorName}`;
  } else if (source === "public_form" && submitterName) {
    actorLabel = `Submitted by ${submitterName}`;
  } else if (source === "qa_batch" && reportedBy) {
    actorLabel = `Reported by ${reportedBy}`;
  }

  let primary: string;
  if (actorLabel) {
    // Always append mechanism so automation/import is visible even when a human is stamped.
    primary = source === "manual" ? actorLabel : `${actorLabel} · ${sourceLabel}`;
  } else if (source === "unknown") {
    primary = "Creator/source unknown";
  } else {
    primary = `Created via ${sourceLabel.toLowerCase()}`;
  }

  const samePerson = !!(creatorId && requesterId && creatorId === requesterId);
  const showRequesterSeparately = !!(requesterId && requesterName && !samePerson);
  const secondary = showRequesterSeparately ? `Requested by ${requesterName}` : null;

  let compact: string;
  if (creatorName) {
    compact =
      source === "manual"
        ? creatorName
        : source === "unknown"
          ? `${creatorName} · ?`
          : `${creatorName} · ${creationSourceBadge(source)}`;
  } else if (source === "unknown") {
    compact = "Unknown";
  } else {
    compact = creationSourceBadge(source);
  }

  return {
    primary,
    secondary,
    compact,
    creatorId,
    requesterId,
    source,
    sourceLabel,
    showRequesterSeparately,
  };
}

/** Payload helpers for inserts */
export function attributionPayload(
  source: CreationSource,
  opts?: {
    created_by?: string | null;
    context?: CreationContext;
  },
): {
  creation_source: CreationSource;
  creation_context: CreationContext;
  created_by?: string | null;
} {
  const out: {
    creation_source: CreationSource;
    creation_context: CreationContext;
    created_by?: string | null;
  } = {
    creation_source: source,
    creation_context: opts?.context ?? {},
  };
  if (opts && "created_by" in opts) {
    out.created_by = opts.created_by ?? null;
  }
  return out;
}
