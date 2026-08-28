import type { ClientOption } from "@/components/pm/intake/ClientSearchCombobox";
import type { FormFieldRow } from "@/components/pm/forms/FormFieldRenderer";
import type { PmUser } from "@/types/pm";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/public-form-api`;
const REQUEST_TIMEOUT_MS = 60_000;
const ERROR_BODY_TIMEOUT_MS = 5_000;

function formatApiError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    if (flat.fieldErrors) {
      const parts = Object.entries(flat.fieldErrors).flatMap(([field, msgs]) =>
        (msgs ?? []).map((m) => `${field}: ${m}`),
      );
      if (parts.length) return parts.join("; ");
    }
    if (flat.formErrors?.length) return flat.formErrors.join("; ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err ?? "Request failed");
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Anonymous intake bypasses supabase.functions.invoke to avoid auth lock stalls. */
async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: unknown;
    try {
      data = await withTimeout(res.json(), ERROR_BODY_TIMEOUT_MS, "Request failed");
    } catch {
      throw new Error(`Request failed (${res.status})`);
    }

    if (!res.ok) {
      if (data && typeof data === "object" && "error" in (data as object)) {
        throw new Error(formatApiError((data as { error: unknown }).error));
      }
      throw new Error(`Request failed (${res.status})`);
    }

    if (data && typeof data === "object" && "error" in (data as object)) {
      throw new Error(formatApiError((data as { error: unknown }).error));
    }

    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out — check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function publicFormBootstrap(slug: string) {
  return call<{
    form: Record<string, any>;
    fields: FormFieldRow[];
    clients: ClientOption[];
    users: Pick<PmUser, "id" | "name" | "role">[];
    liveSites?: Array<{ id: string; title: string; client_id: string; go_live_date: string | null }>;
  }>({ action: "bootstrap", slug });
}

export async function publicFormSubmit(payload: Record<string, unknown>) {
  return call<{
    projectId: string;
    taskId: string | null;
    watcherIds: string[];
    alias: string;
    requestTypeLabel: string | null;
    emailSent: boolean;
    emailPending?: boolean;
    failedFiles?: string[];
  }>({ action: "submit", ...payload });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
