export type ProjectTabId = "overview" | "tasks" | "timeline" | "files" | "snippets";

export function ProjectTabs({ value, onChange, tabs }: {
  value: ProjectTabId;
  onChange: (v: ProjectTabId) => void;
  tabs?: { id: ProjectTabId; label: string }[];
}) {
  const items = tabs ?? [
    { id: "overview" as const, label: "Overview" },
    { id: "tasks" as const, label: "Tasks" },
    { id: "timeline" as const, label: "Timeline" },
    { id: "files" as const, label: "Files" },
  ];
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-1">
        {items.map(t => {
          const active = t.id === value;
          return (
            <button key={t.id} type="button" onClick={() => onChange(t.id)}
              className={`px-3 h-9 text-sm font-medium -mb-px border-b-2 transition ${
                active ? "border-info text-info" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
