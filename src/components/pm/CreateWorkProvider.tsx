import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CreateWorkDialog } from "@/components/pm/CreateWorkDialog";

export type CreateWorkStep = "select" | "request" | "project";

export type CreateWorkOptions = {
  clientId?: string;
  onCreated?: () => void;
};

type CreateWorkContextValue = {
  openCreateWork: (step?: CreateWorkStep, options?: CreateWorkOptions) => void;
  closeCreateWork: () => void;
};

const CreateWorkContext = createContext<CreateWorkContextValue | null>(null);

/**
 * App-level host for CreateWorkDialog so the form stays mounted across
 * in-app navigation (Daily Briefing ↔ All Work, etc.).
 */
export function CreateWorkProvider({ children }: { children: ReactNode }) {
  const [openStep, setOpenStep] = useState<CreateWorkStep | null>(null);
  const [presetClientId, setPresetClientId] = useState<string | null>(null);
  const onCreatedRef = useRef<(() => void) | undefined>();

  const clearOpenState = useCallback(() => {
    setOpenStep(null);
    setPresetClientId(null);
    onCreatedRef.current = undefined;
  }, []);

  const openCreateWork = useCallback((step: CreateWorkStep = "select", options?: CreateWorkOptions) => {
    setPresetClientId(options?.clientId ?? null);
    onCreatedRef.current = options?.onCreated;
    setOpenStep(step);
  }, []);

  const closeCreateWork = useCallback(() => {
    clearOpenState();
  }, [clearOpenState]);

  const value = useMemo(
    () => ({ openCreateWork, closeCreateWork }),
    [openCreateWork, closeCreateWork],
  );

  return (
    <CreateWorkContext.Provider value={value}>
      {children}
      <CreateWorkDialog
        open={openStep !== null}
        onOpenChange={(v) => { if (!v) clearOpenState(); }}
        initialStep={openStep ?? "select"}
        presetClientId={presetClientId}
        onCreated={() => onCreatedRef.current?.()}
      />
    </CreateWorkContext.Provider>
  );
}

export function useCreateWork() {
  const ctx = useContext(CreateWorkContext);
  if (!ctx) {
    throw new Error("useCreateWork must be used within CreateWorkProvider");
  }
  return ctx;
}
