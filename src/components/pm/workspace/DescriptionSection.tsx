import { useEffect, useRef, useState } from "react";
import { RichTextEditor } from "@/components/pm/project/RichTextEditor";
import { useMockUsers } from "@/lib/pm/mockUser";
import type { PmTask } from "@/types/pm";

interface Props {
  task: PmTask;
  patch: (p: Partial<PmTask>) => Promise<void> | void;
}

export function DescriptionSection({ task, patch }: Props) {
  const users = useMockUsers();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.description || "");
  const initialRef = useRef(task.description || "");

  useEffect(() => {
    if (!editing) {
      setValue(task.description || "");
      initialRef.current = task.description || "";
    }
  }, [task.description, editing]);

  const hasContent = !!(value && value.replace(/<[^>]*>/g, "").trim());

  async function handleBlur() {
    setEditing(false);
    if (value !== initialRef.current) {
      await patch({ description: value });
      initialRef.current = value;
    }
  }

  return (
    <section className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Description &amp; Notes
      </div>
      {editing || !hasContent ? (
        <RichTextEditor
          value={value}
          onChange={setValue}
          onBlur={handleBlur}
          placeholder="Add notes, context, or instructions for this task..."
          users={users}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={e => { if (e.key === "Enter") setEditing(true); }}
          className="min-h-[96px] p-3 text-sm border border-border rounded-md bg-background cursor-text hover:bg-muted/30 transition [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      )}
    </section>
  );
}
