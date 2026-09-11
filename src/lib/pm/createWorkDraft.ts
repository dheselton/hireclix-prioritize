import type { RequestType } from "@/lib/pm/requestTypes";
import type { StagedLink } from "@/components/pm/intake/IntakeAttachmentsField";

export const CREATE_WORK_DRAFT_VERSION = 1 as const;

export type CreateWorkDraftStep = "select" | "request" | "project-entry" | "project-blank";

export type CreateWorkDraft = {
  v: typeof CREATE_WORK_DRAFT_VERSION;
  userId: string;
  updatedAt: string;
  step: CreateWorkDraftStep;
  requestType: RequestType;
  reqForm: { title: string; client_id: string; description: string };
  reqFieldValues: Record<string, unknown>;
  quickTasks: string[];
  reqRequestedBy: string | null;
  reqLinks: StagedLink[];
  parentProjectId: string | null;
  projForm: {
    title: string;
    type: string;
    status: string;
    client_id: string;
    kickoff_date: string;
    go_live_date: string;
  };
  projRequestedBy: string | null;
  projLinks: StagedLink[];
};

const STORAGE_PREFIX = "pm.createWork.draft.v1";

export function draftStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeLinks(value: unknown): StagedLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is StagedLink => {
      if (!isPlainObject(item)) return false;
      return typeof item.url === "string" && typeof item.label === "string";
    })
    .map((item) => ({
      url: item.url,
      label: item.label,
    }));
}

/**
 * True when the draft has something worth restoring (beyond defaults).
 * The current step is deliberately not content — otherwise merely opening the
 * dialog on a step would persist a draft that hijacks the next entry point.
 */
export function draftHasContent(draft: CreateWorkDraft): boolean {
  if (draft.reqForm.title.trim() || draft.reqForm.client_id || draft.reqForm.description.trim()) return true;
  if (Object.keys(draft.reqFieldValues).length > 0) return true;
  if (draft.quickTasks.some((t) => t.trim())) return true;
  if (draft.reqLinks.length > 0) return true;
  if (draft.parentProjectId) return true;
  if (draft.projForm.title.trim() || draft.projForm.client_id) return true;
  if (draft.projForm.kickoff_date || draft.projForm.go_live_date) return true;
  if (draft.projLinks.length > 0) return true;
  return false;
}

export function parseCreateWorkDraft(raw: string | null, userId: string): CreateWorkDraft | null {
  if (!raw || !userId) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) return null;
    if (parsed.v !== CREATE_WORK_DRAFT_VERSION) return null;
    if (parsed.userId !== userId) return null;
    if (typeof parsed.step !== "string") return null;
    if (!isPlainObject(parsed.reqForm) || !isPlainObject(parsed.projForm)) return null;

    const draft: CreateWorkDraft = {
      v: CREATE_WORK_DRAFT_VERSION,
      userId,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      step: parsed.step as CreateWorkDraftStep,
      requestType: (typeof parsed.requestType === "string" ? parsed.requestType : "web_edit") as RequestType,
      reqForm: {
        title: String(parsed.reqForm.title ?? ""),
        client_id: String(parsed.reqForm.client_id ?? ""),
        description: String(parsed.reqForm.description ?? ""),
      },
      reqFieldValues: isPlainObject(parsed.reqFieldValues) ? parsed.reqFieldValues : {},
      quickTasks: Array.isArray(parsed.quickTasks)
        ? parsed.quickTasks.map((t) => String(t ?? ""))
        : [""],
      reqRequestedBy: typeof parsed.reqRequestedBy === "string" ? parsed.reqRequestedBy : null,
      reqLinks: sanitizeLinks(parsed.reqLinks),
      parentProjectId: typeof parsed.parentProjectId === "string" ? parsed.parentProjectId : null,
      projForm: {
        title: String(parsed.projForm.title ?? ""),
        type: String(parsed.projForm.type ?? "career_site"),
        status: String(parsed.projForm.status ?? "active"),
        client_id: String(parsed.projForm.client_id ?? ""),
        kickoff_date: String(parsed.projForm.kickoff_date ?? ""),
        go_live_date: String(parsed.projForm.go_live_date ?? ""),
      },
      projRequestedBy: typeof parsed.projRequestedBy === "string" ? parsed.projRequestedBy : null,
      projLinks: sanitizeLinks(parsed.projLinks),
    };

    return draftHasContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function readCreateWorkDraft(userId: string | null | undefined): CreateWorkDraft | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return parseCreateWorkDraft(sessionStorage.getItem(draftStorageKey(userId)), userId);
  } catch {
    return null;
  }
}

export function writeCreateWorkDraft(
  userId: string | null | undefined,
  draft: Omit<CreateWorkDraft, "v" | "userId" | "updatedAt">,
): void {
  if (!userId || typeof window === "undefined") return;
  const payload: CreateWorkDraft = {
    ...draft,
    v: CREATE_WORK_DRAFT_VERSION,
    userId,
    updatedAt: new Date().toISOString(),
  };
  if (!draftHasContent(payload)) {
    clearCreateWorkDraft(userId);
    return;
  }
  try {
    sessionStorage.setItem(draftStorageKey(userId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearCreateWorkDraft(userId: string | null | undefined): void {
  if (!userId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(draftStorageKey(userId));
  } catch {
    // ignore
  }
}
