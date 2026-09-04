import type { ReactNode } from "react";

export type ProjectTabId =
  | "support"
  | "overview"
  | "tasks"
  | "qa"
  | "timeline"
  | "pages"
  | "files"
  | "snippets"
  | "documentation"
  | "client";

export const PROJECT_TAB_IDS: ProjectTabId[] = [
  "support",
  "overview",
  "tasks",
  "qa",
  "timeline",
  "pages",
  "files",
  "snippets",
  "documentation",
  "client",
];

export type ProjectTabItem = { id: ProjectTabId; label: string; badge?: ReactNode };

export function ProjectTabs({ value, onChange, tabs }: {
  value: ProjectTabId;
  onChange: (v: ProjectTabId) => void;
  tabs?: ProjectTabItem[];
}) {
  const items = tabs ?? [
    { id: "overview" as const, label: "Overview" },
    { id: "tasks" as const, label: "Tasks" },
    { id: "timeline" as const, label: "Timeline" },
    { id: "files" as const, label: "Files" },
  ];
  return (
    <div className="border-b border-border -mx-3 px-3 md:mx-0 md:px-0">
      <div className="tab-strip" role="tablist">
        {items.map(t => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={`shrink-0 px-3 h-10 min-h-10 text-sm font-medium -mb-px border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                active ? "border-info text-info" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}
