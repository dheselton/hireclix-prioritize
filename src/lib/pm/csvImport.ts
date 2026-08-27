import {
  CSV_IMPORT_MAX_ROWS,
  downloadCsv,
  parseCsv,
  pickField,
  rowsToObjects,
} from "@/lib/pm/csv";
import { normalizeEmail } from "@/lib/pm/identity";
import { assertTaskKind, QA_SEVERITIES, type QaSeverity } from "@/lib/pm/taskKind";
import { ALL_TEAMS, DEFAULT_TEAMS_FOR_TYPE, TEAM_LABEL, type Team } from "@/lib/pm/teams";
import {
  PRIORITIES,
  TASK_TYPES,
  type PmPhase,
  type PmUser,
  type TaskPriority,
  type TaskType,
} from "@/types/pm";

export const QA_KIND = assertTaskKind("qa");

export const QA_CSV_HEADERS = ["Title", "Severity", "Environment", "Reporter", "Description"] as const;

export const TASK_CSV_HEADERS = [
  "Title",
  "Description",
  "Type",
  "Priority",
  "Phase",
  "Assignee",
  "Teams",
  "Start date",
  "Due date",
  "Duration days",
  "Tags",
] as const;

export type QaImportRow = {
  title: string;
  severity: QaSeverity;
  environment: string;
  reporter: string;
  description: string;
  warning?: string;
};

export type TaskImportRow = {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  phaseId: string | null;
  phaseLabel: string;
  assigneeId: string | null;
  assigneeLabel: string;
  teams: Team[];
  startDate: string | null;
  dueDate: string | null;
  durationDays: number;
  tags: string[];
  error?: string;
};

const SEVERITY_ALIASES: Record<string, QaSeverity> = {
  blocker: "blocker",
  blocking: "blocker",
  critical: "blocker",
  p0: "blocker",
  major: "major",
  high: "major",
  p1: "major",
  minor: "minor",
  medium: "minor",
  med: "minor",
  p2: "minor",
  cosmetic: "cosmetic",
  low: "cosmetic",
  polish: "cosmetic",
  p3: "cosmetic",
};

const PRIORITY_ALIASES: Record<string, TaskPriority> = {
  urgent: "urgent",
  critical: "urgent",
  p0: "urgent",
  high: "high",
  p1: "high",
  medium: "medium",
  med: "medium",
  normal: "medium",
  p2: "medium",
  low: "low",
  p3: "low",
};

const TYPE_ALIASES: Record<string, TaskType> = {
  design: "design",
  designer: "design",
  ux: "design",
  ui: "design",
  content: "content",
  copy: "content",
  dev: "dev",
  development: "dev",
  developer: "dev",
  engineering: "dev",
  eng: "dev",
  review: "review",
  approval: "approval",
  approve: "approval",
  qa: "qa",
  test: "qa",
  testing: "qa",
  strategy: "strategy",
  research: "research",
  analytics: "analytics",
  analysis: "analytics",
  reporting: "reporting",
  report: "reporting",
};

export function severityToPriority(severity: QaSeverity): TaskPriority {
  switch (severity) {
    case "blocker": return "urgent";
    case "major": return "high";
    case "minor": return "medium";
    case "cosmetic": return "low";
  }
}

function coerceSeverity(raw: string, fallback: QaSeverity): { value: QaSeverity; warning?: string } {
  const key = raw.trim().toLowerCase();
  if (!key) return { value: fallback };
  if (SEVERITY_ALIASES[key]) return { value: SEVERITY_ALIASES[key] };
  if (QA_SEVERITIES.includes(key as QaSeverity)) return { value: key as QaSeverity };
  return { value: fallback, warning: `Unknown severity "${raw}" — using ${fallback}` };
}

function coercePriority(raw: string, fallback: TaskPriority = "medium"): TaskPriority {
  const key = raw.trim().toLowerCase();
  if (!key) return fallback;
  return PRIORITY_ALIASES[key]
    ?? (PRIORITIES.includes(key as TaskPriority) ? (key as TaskPriority) : fallback);
}

function coerceType(raw: string, fallback: TaskType = "dev"): TaskType {
  const key = raw.trim().toLowerCase().replace(/[\s_\-]+/g, "");
  if (!key) return fallback;
  return TYPE_ALIASES[key]
    ?? (TASK_TYPES.includes(key as TaskType) ? (key as TaskType) : fallback);
}

function coerceTeams(raw: string, type: TaskType): Team[] {
  if (!raw.trim()) return [...(DEFAULT_TEAMS_FOR_TYPE[type] ?? [])];
  const labelMap = new Map(
    ALL_TEAMS.map(t => [TEAM_LABEL[t].toLowerCase().replace(/[\s/]+/g, ""), t]),
  );
  const out: Team[] = [];
  for (const part of raw.split(/[|;,/]+/)) {
    const key = part.trim().toLowerCase().replace(/[\s/]+/g, "");
    if (!key) continue;
    const team = (ALL_TEAMS as string[]).includes(key)
      ? (key as Team)
      : labelMap.get(key);
    if (team && !out.includes(team)) out.push(team);
  }
  return out.length ? out : [...(DEFAULT_TEAMS_FOR_TYPE[type] ?? [])];
}

function coerceDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function coerceTags(raw: string): string[] {
  return raw.split(/[|;,/]+/).map(t => t.trim()).filter(Boolean);
}

function resolveAssignee(raw: string, users: PmUser[]): { id: string | null; label: string; error?: string } {
  const q = raw.trim();
  if (!q) return { id: null, label: "" };
  const email = normalizeEmail(q);
  const byEmail = users.find(u => u.email && normalizeEmail(u.email) === email);
  if (byEmail) return { id: byEmail.id, label: byEmail.name };
  const lower = q.toLowerCase();
  const byName = users.filter(u => u.name.toLowerCase() === lower);
  if (byName.length === 1) return { id: byName[0].id, label: byName[0].name };
  if (byName.length > 1) return { id: null, label: q, error: `Ambiguous assignee "${q}"` };
  const partial = users.filter(u => u.name.toLowerCase().includes(lower));
  if (partial.length === 1) return { id: partial[0].id, label: partial[0].name };
  return { id: null, label: q, error: `Unknown assignee "${q}"` };
}

function resolvePhase(raw: string, phases: PmPhase[]): { id: string | null; label: string; error?: string } {
  const q = raw.trim();
  if (!q) return { id: null, label: "" };
  const lower = q.toLowerCase();
  const exact = phases.find(p => p.name.toLowerCase() === lower);
  if (exact) return { id: exact.id, label: exact.name };
  const partial = phases.filter(p => p.name.toLowerCase().includes(lower));
  if (partial.length === 1) return { id: partial[0].id, label: partial[0].name };
  return { id: null, label: q, error: `Unknown phase "${q}"` };
}

export function downloadQaCsvTemplate() {
  downloadCsv("qa-tickets-template.csv", [
    [...QA_CSV_HEADERS],
    ["Header logo blurry on mobile", "minor", "https://staging.example.com", "Jane at Acme", "Seen on iPhone Safari"],
    ["Contact form returns 500", "blocker", "https://staging.example.com/contact", "Jane at Acme", "Steps: submit empty form"],
    ["Typo Recieve on About", "cosmetic", "/about", "", ""],
  ]);
}

export function downloadTaskCsvTemplate() {
  downloadCsv("project-tasks-template.csv", [
    [...TASK_CSV_HEADERS],
    [
      "Build homepage hero",
      "Desktop + mobile comps",
      "design",
      "high",
      "Design",
      "dan@example.com",
      "Design",
      "2026-09-01",
      "2026-09-05",
      "5",
      "feature:home",
    ],
    [
      "Wire homepage hero",
      "",
      "dev",
      "medium",
      "Development",
      "",
      "Dev",
      "",
      "2026-09-12",
      "3",
      "",
    ],
  ]);
}

export function looksLikeCsvHeader(text: string): boolean {
  const rows = parseCsv(text);
  if (rows.length === 0) return false;
  const first = rows[0].map(c => c.trim().toLowerCase()).join("|");
  return /\btitle\b/.test(first) || /\bseverity\b/.test(first) || /\btype\b/.test(first);
}

export function parseQaCsv(
  text: string,
  opts?: { defaultSeverity?: QaSeverity; defaultEnvironment?: string; defaultReporter?: string },
): QaImportRow[] {
  const defaultSeverity = opts?.defaultSeverity ?? "major";
  const defaultEnvironment = opts?.defaultEnvironment ?? "";
  const defaultReporter = opts?.defaultReporter ?? "";
  const objects = rowsToObjects(parseCsv(text)).slice(0, CSV_IMPORT_MAX_ROWS);
  const rows: QaImportRow[] = [];

  for (const obj of objects) {
    const title = pickField(obj, ["title", "name", "ticket", "summary", "issue"]);
    if (!title || title.startsWith("#")) continue;
    const severityRaw = pickField(obj, ["severity", "sev", "priority"]);
    const { value: severity, warning } = coerceSeverity(severityRaw, defaultSeverity);
    rows.push({
      title: title.slice(0, 500),
      severity,
      environment: pickField(obj, ["environment", "env", "url", "page", "browser"]) || defaultEnvironment,
      reporter: pickField(obj, ["reporter", "reportedby", "reportedbyname", "reportername", "client"]) || defaultReporter,
      description: pickField(obj, ["description", "details", "notes", "body", "steps"]),
      warning,
    });
  }
  return rows;
}

export function parseTaskCsv(
  text: string,
  ctx: { phases: PmPhase[]; users: PmUser[] },
): TaskImportRow[] {
  const objects = rowsToObjects(parseCsv(text)).slice(0, CSV_IMPORT_MAX_ROWS);
  const rows: TaskImportRow[] = [];

  for (const obj of objects) {
    const title = pickField(obj, ["title", "name", "task", "summary"]);
    if (!title || title.startsWith("#")) continue;

    const type = coerceType(pickField(obj, ["type", "tasktype", "discipline"]));
    const priority = coercePriority(pickField(obj, ["priority", "prio"]));
    const phaseRaw = pickField(obj, ["phase", "phasename", "milestone"]);
    const assigneeRaw = pickField(obj, ["assignee", "assigneeemail", "email", "owner", "assignedto"]);
    const phase = resolvePhase(phaseRaw, ctx.phases);
    const assignee = resolveAssignee(assigneeRaw, ctx.users);
    const startRaw = pickField(obj, ["startdate", "start", "begins"]);
    const dueRaw = pickField(obj, ["duedate", "due", "deadline", "enddate"]);
    const startDate = startRaw ? coerceDate(startRaw) : null;
    const dueDate = dueRaw ? coerceDate(dueRaw) : null;
    const durationRaw = pickField(obj, ["durationdays", "duration", "days"]);
    const durationDays = Math.max(1, parseInt(durationRaw, 10) || 1);
    const errors: string[] = [];
    if (phase.error) errors.push(phase.error);
    if (assignee.error) errors.push(assignee.error);
    if (startRaw && !startDate) errors.push(`Bad start date "${startRaw}"`);
    if (dueRaw && !dueDate) errors.push(`Bad due date "${dueRaw}"`);

    rows.push({
      title: title.slice(0, 500),
      description: pickField(obj, ["description", "details", "notes", "body"]),
      type,
      priority,
      phaseId: phase.id,
      phaseLabel: phase.label,
      assigneeId: assignee.id,
      assigneeLabel: assignee.label,
      teams: coerceTeams(pickField(obj, ["teams", "team"]), type),
      startDate,
      dueDate,
      durationDays,
      tags: coerceTags(pickField(obj, ["tags", "tag"])),
      error: errors.length ? errors.join("; ") : undefined,
    });
  }
  return rows;
}
