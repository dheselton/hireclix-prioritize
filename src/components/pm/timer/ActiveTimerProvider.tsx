import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { emitTimeChanged } from "@/lib/pm/time";
import { toast } from "sonner";

interface ActiveTimer {
  taskId: string | null;
  activityId: string | null;
  taskTitle: string;       // display label
  startedAt: number;       // epoch ms
}

interface Ctx {
  current: ActiveTimer | null;
  elapsedMs: number;
  start: (taskId: string, taskTitle: string) => Promise<void>;
  startActivity: (activityId: string, activityName: string) => Promise<void>;
  stop: (note?: string) => Promise<number | null>;
  isRunning: (taskId?: string) => boolean;
  isRunningActivity: (activityId?: string) => boolean;
}

const TimerCtx = createContext<Ctx | null>(null);
const LS_KEY = "pm.activeTimer";

function loadLS(): ActiveTimer | null {
  try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function saveLS(t: ActiveTimer | null) {
  try { t ? localStorage.setItem(LS_KEY, JSON.stringify(t)) : localStorage.removeItem(LS_KEY); } catch {}
}

export function ActiveTimerProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  const [current, setCurrent] = useState<ActiveTimer | null>(loadLS());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("pm_active_timers")
        .select("*, pm_tasks(title), pm_activities(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const isAct = !!(data as any).activity_id;
        const t: ActiveTimer = {
          taskId: (data as any).task_id ?? null,
          activityId: (data as any).activity_id ?? null,
          taskTitle: isAct ? ((data as any).pm_activities?.name ?? "Activity") : ((data as any).pm_tasks?.title ?? "Task"),
          startedAt: new Date(data.started_at).getTime(),
        };
        setCurrent(t); saveLS(t);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [!!current]);

  async function stopInternal(userId: string, t: ActiveTimer, note?: string): Promise<number> {
    const minutes = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
    await supabase.from("pm_time_entries").insert({
      task_id: t.taskId,
      activity_id: t.activityId,
      user_id: userId,
      minutes,
      note: note ?? "",
    } as any);
    await supabase.from("pm_active_timers").delete().eq("user_id", userId);
    emitTimeChanged();
    return minutes;
  }

  const startCore = useCallback(async (t: Omit<ActiveTimer, "startedAt">) => {
    if (!user) { toast.error("Select a user first"); return; }
    if (current) await stopInternal(user.id, current, undefined);
    const startedAt = Date.now();
    const next: ActiveTimer = { ...t, startedAt };
    setCurrent(next); saveLS(next); setNow(startedAt);
    await supabase.from("pm_active_timers").upsert({
      user_id: user.id,
      task_id: t.taskId,
      activity_id: t.activityId,
      started_at: new Date(startedAt).toISOString(),
    } as any);
    toast.success(`Timer started: ${t.taskTitle}`);
  }, [user?.id, current]);

  const start = useCallback((taskId: string, taskTitle: string) =>
    startCore({ taskId, activityId: null, taskTitle }), [startCore]);

  const startActivity = useCallback((activityId: string, activityName: string) =>
    startCore({ taskId: null, activityId, taskTitle: activityName }), [startCore]);

  const stop = useCallback(async (note?: string) => {
    if (!user || !current) return null;
    const mins = await stopInternal(user.id, current, note);
    setCurrent(null); saveLS(null);
    toast.success(`Logged ${mins}m to ${current.taskTitle}`);
    return mins;
  }, [user?.id, current]);

  const isRunning = useCallback((taskId?: string) => {
    if (!current || !current.taskId) return false;
    return taskId ? current.taskId === taskId : true;
  }, [current]);

  const isRunningActivity = useCallback((activityId?: string) => {
    if (!current || !current.activityId) return false;
    return activityId ? current.activityId === activityId : true;
  }, [current]);

  const elapsedMs = current ? now - current.startedAt : 0;

  return (
    <TimerCtx.Provider value={{ current, elapsedMs, start, startActivity, stop, isRunning, isRunningActivity }}>
      {children}
    </TimerCtx.Provider>
  );
}

export function useActiveTimer() {
  const ctx = useContext(TimerCtx);
  if (!ctx) throw new Error("useActiveTimer must be used within ActiveTimerProvider");
  return ctx;
}

export function formatHMS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
