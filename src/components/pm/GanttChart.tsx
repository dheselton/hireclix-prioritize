import { useMemo, useRef, useState } from "react";
import type { PmTask, PmDependency } from "@/types/pm";
import { TYPE_COLORS } from "@/types/pm";
import { computeCriticalPath, recalculateForward, type DateDiff } from "@/lib/pm/scheduler";
import { fmtDateShort } from "@/lib/pm/format";
import { cn } from "@/lib/utils";

const day = 86400000;
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function GanttChart({
  tasks, deps, onTaskClick, onProposeReschedule, dayWidth = 28, rowHeight = 36,
}: {
  tasks: PmTask[];
  deps: PmDependency[];
  onTaskClick?: (id: string) => void;
  onProposeReschedule?: (diffs: DateDiff[]) => void;
  dayWidth?: number;
  rowHeight?: number;
}) {
  const dated = tasks.filter(t => t.start_date && t.due_date);
  const { min, max } = useMemo(() => {
    if (!dated.length) return { min: new Date(), max: new Date(Date.now() + 30 * day) };
    let mn = new Date(dated[0].start_date!);
    let mx = new Date(dated[0].due_date!);
    for (const t of dated) {
      const s = new Date(t.start_date!), e = new Date(t.due_date!);
      if (s < mn) mn = s; if (e > mx) mx = e;
    }
    mn = new Date(mn.getTime() - 2 * day);
    mx = new Date(mx.getTime() + 2 * day);
    return { min: mn, max: mx };
  }, [dated]);

  const totalDays = Math.max(1, Math.round((max.getTime() - min.getTime()) / day) + 1);
  const width = totalDays * dayWidth;
  const headerHeight = 28;
  const height = headerHeight + dated.length * rowHeight + 20;
  const critical = useMemo(() => computeCriticalPath(tasks, deps), [tasks, deps]);

  const xFor = (d: Date) => Math.round(((d.getTime() - min.getTime()) / day) * dayWidth);
  const todayX = xFor(new Date());

  const taskRowIndex = new Map(dated.map((t, i) => [t.id, i]));

  // drag state
  const [drag, setDrag] = useState<{ id: string; startX: number; offsetDays: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  function onMouseDown(e: React.MouseEvent, t: PmTask) {
    setDrag({ id: t.id, startX: e.clientX, offsetDays: 0 });
    e.stopPropagation();
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const days = Math.round(dx / dayWidth);
    if (days !== drag.offsetDays) setDrag({ ...drag, offsetDays: days });
  }
  function onMouseUp() {
    if (!drag || !onProposeReschedule) { setDrag(null); return; }
    const t = tasks.find(x => x.id === drag.id);
    if (t && t.start_date && t.due_date && drag.offsetDays !== 0) {
      const ns = new Date(t.start_date); ns.setDate(ns.getDate() + drag.offsetDays);
      const ne = new Date(t.due_date); ne.setDate(ne.getDate() + drag.offsetDays);
      const diffs = recalculateForward(t.id, { start: fmt(ns), end: fmt(ne) }, tasks, deps);
      onProposeReschedule(diffs);
    }
    setDrag(null);
  }

  // build month headers
  const months: { label: string; x: number; w: number }[] = [];
  {
    let cur = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cur <= max) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const startX = xFor(cur < min ? min : cur);
      const endX = xFor(next > max ? max : next);
      months.push({ label: cur.toLocaleString("default", { month: "short", year: "2-digit" }), x: startX, w: endX - startX });
      cur = next;
    }
  }

  return (
    <div className="overflow-auto border border-border rounded-lg bg-card">
      <svg ref={svgRef} width={width} height={height} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <defs>
          <pattern id="lockedHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="hsl(var(--background))" fillOpacity="0.18" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--background))" strokeOpacity="0.45" strokeWidth="2" />
          </pattern>
        </defs>
        {/* month header */}
        {months.map((m, i) => (
          <g key={i}>
            <rect x={m.x} y={0} width={m.w} height={headerHeight} fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
            <text x={m.x + 6} y={18} className="fill-foreground text-[11px] font-medium">{m.label}</text>
          </g>
        ))}
        {/* row backgrounds */}
        {dated.map((t, i) => (
          <rect key={t.id} x={0} y={headerHeight + i * rowHeight} width={width} height={rowHeight}
            fill={i % 2 === 0 ? "hsl(var(--muted) / 0.2)" : "transparent"} />
        ))}
        {/* today line */}
        {todayX >= 0 && todayX <= width && (
          <line x1={todayX} y1={headerHeight} x2={todayX} y2={height} stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="3 3" />
        )}
        {/* dependency arrows */}
        {deps.map(d => {
          const fromIdx = taskRowIndex.get(d.depends_on_task_id);
          const toIdx = taskRowIndex.get(d.task_id);
          const from = tasks.find(t => t.id === d.depends_on_task_id);
          const to = tasks.find(t => t.id === d.task_id);
          if (fromIdx == null || toIdx == null || !from?.due_date || !to?.start_date) return null;
          const x1 = xFor(new Date(from.due_date)) + dayWidth;
          const y1 = headerHeight + fromIdx * rowHeight + rowHeight / 2;
          const x2 = xFor(new Date(to.start_date));
          const y2 = headerHeight + toIdx * rowHeight + rowHeight / 2;
          const mx = (x1 + x2) / 2;
          const lag = d.lag_days || 0;
          return (
            <g key={d.id}>
              <path d={`M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`} stroke="hsl(var(--muted-foreground))" strokeWidth={1} fill="none" />
              <polygon points={`${x2},${y2} ${x2-5},${y2-3} ${x2-5},${y2+3}`} fill="hsl(var(--muted-foreground))" />
              {lag > 0 && (
                <g>
                  <rect x={x2 - 22} y={y2 - 16} width={20} height={12} rx={2} fill="hsl(var(--background))" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
                  <text x={x2 - 12} y={y2 - 7} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">+{lag}d</text>
                </g>
              )}
            </g>
          );
        })}
        {/* bars */}
        {dated.map((t, i) => {
          const offset = drag?.id === t.id ? drag.offsetDays * dayWidth : 0;
          const x = xFor(new Date(t.start_date!)) + offset;
          const w = Math.max(dayWidth, (Math.round((new Date(t.due_date!).getTime() - new Date(t.start_date!).getTime()) / day) + 1) * dayWidth);
          const y = headerHeight + i * rowHeight + 4;
          const h = rowHeight - 8;
          const isCritical = critical.has(t.id);
          const locked = !!(t as any).locked;
          const minDur = (t as any).min_duration_days as number | null | undefined;
          const atMin = locked && minDur != null && t.duration_days <= minDur;
          const belowRec = !locked && minDur != null && t.duration_days < minDur;
          const tooltip = atMin
            ? "Minimum duration — cannot compress further"
            : belowRec ? `Below recommended (${minDur}d)` : `${t.title} (${t.duration_days}d)`;
          return (
            <g key={t.id} onClick={() => onTaskClick?.(t.id)} onMouseDown={(e) => onMouseDown(e, t)} style={{ cursor: "grab" }}>
              <title>{tooltip}</title>
              <rect x={x} y={y} width={w} height={h} rx={4} fill={TYPE_COLORS[t.type]}
                stroke={belowRec ? "hsl(40 95% 55%)" : isCritical ? "hsl(var(--foreground))" : "transparent"}
                strokeWidth={belowRec ? 2 : isCritical ? 2 : 0} opacity={0.85} />
              {locked && <rect x={x} y={y} width={w} height={h} rx={4} fill="url(#lockedHatch)" pointerEvents="none" />}
              {locked && <text x={x + 4} y={y + h / 2 + 4} className="text-[10px] pointer-events-none" fill="white">🔒</text>}
              <text x={x + (locked ? 18 : 6)} y={y + h / 2 + 4} className="fill-white text-[11px] font-medium pointer-events-none">{t.title}</text>
              {belowRec && <text x={x + w - 12} y={y + h / 2 + 4} className="text-[11px] pointer-events-none" fill="hsl(40 95% 55%)">⚠</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
