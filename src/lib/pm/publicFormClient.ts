import { supabase } from "@/integrations/supabase/client";
import type { ClientOption } from "@/components/pm/intake/ClientSearchCombobox";
import type { FormFieldRow } from "@/components/pm/forms/FormFieldRenderer";

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("public-form-api", { body: payload });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

export function publicFormBootstrap(slug: string) {
  return call<{
    form: Record<string, any>;
    fields: FormFieldRow[];
    clients: ClientOption[];
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
