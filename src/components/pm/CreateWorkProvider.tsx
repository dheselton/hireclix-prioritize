import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CreateWorkDialog } from "@/components/pm/CreateWorkDialog";

export type CreateWorkStep = "select" | "request" | "project";

type CreateWorkContextValue = {
  openCreateWork: (step?: CreateWorkStep) => void;
  closeCreateWork: () => void;
};

const CreateWorkContext = createContext<CreateWorkContextValue | null>(null);

/**
 * App-level host for CreateWorkDialog so the form stays mounted across
 * in-app navigation (Daily Briefing ↔ All Work, etc.).
 */
export function CreateWorkProvider({ children }: { children: ReactNode }) {
  const [openStep, setOpenStep] = useState<CreateWorkStep | null>(null);

  const openCreateWork = useCallback((step: CreateWorkStep = "select") => {
    setOpenStep(step);
  }, []);

  const closeCreateWork = useCallback(() => {
    setOpenStep(null);
  }, []);

  const value = useMemo(
    () => ({ openCreateWork, closeCreateWork }),
    [openCreateWork, closeCreateWork],
  );

  return (
    <CreateWorkContext.Provider value={value}>
      {children}
      <CreateWorkDialog
        open={openStep !== null}
        onOpenChange={(v) => { if (!v) setOpenStep(null); }}
        initialStep={openStep ?? "select"}
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
