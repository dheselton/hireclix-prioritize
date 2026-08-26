import { supabase } from "@/integrations/supabase/client";
import type { ClientOption } from "@/components/pm/intake/ClientSearchCombobox";
import type { FormFieldRow } from "@/components/pm/forms/FormFieldRenderer";
import type { PmUser } from "@/types/pm";

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

async function readInvokeError(error: { message: string; context?: Response }, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in (data as object)) {
    return formatApiError((data as { error: unknown }).error);
  }
  try {
    if (error.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body && typeof body === "object" && "error" in body) {
        return formatApiError((body as { error: unknown }).error);
      }
      return formatApiError(body);
    }
  } catch {
    // fall through to generic message
  }
  return error.message;
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("public-form-api", { body: payload });
  if (error) throw new Error(await readInvokeError(error, data));
  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new Error(formatApiError((data as { error: unknown }).error));
  }
  return data as T;
}

export function publicFormBootstrap(slug: string) {
  return call<{
    form: Record<string, any>;
    fields: FormFieldRow[];
    clients: ClientOption[];
    users: Pick<PmUser, "id" | "name" | "role">[];
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
