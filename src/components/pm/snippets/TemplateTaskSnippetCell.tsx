import { useCallback, useEffect, useState } from "react";
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SnippetSearchPopover } from "@/components/pm/snippets/SnippetSearchPopover";
import {
  fetchTemplateTaskSnippetIds,
  linkSnippetToTemplateTask,
  unlinkSnippetFromTemplateTask,
} from "@/lib/pm/taskSnippets";

interface Props {
  templateTaskId: string;
  onChange?: () => void;
}

const ELIGIBLE_TYPES = new Set(["design", "development", "dev"]);
export const isSnippetEligibleType = (type: string | null | undefined) =>
  !!type && ELIGIBLE_TYPES.has(type.toLowerCase());

export function TemplateTaskSnippetCell({ templateTaskId, onChange }: Props) {
  const [ids, setIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await fetchTemplateTaskSnippetIds(templateTaskId);
      setIds(next);
    } catch (e: any) {
      // soft fail
    }
  }, [templateTaskId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleToggle = async (snippetId: string, willLink: boolean) => {
    try {
      if (willLink) await linkSnippetToTemplateTask(templateTaskId, snippetId);
      else await unlinkSnippetFromTemplateTask(templateTaskId, snippetId);
      await reload();
      onChange?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update snippet link");
    }
  };

  const count = ids.length;

  return (
    <SnippetSearchPopover
      open={open}
      onOpenChange={setOpen}
      linkedSnippetIds={ids}
      onToggle={handleToggle}
      align="end"
    >
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 text-[11px] rounded-full border px-2 py-0.5 transition",
          count > 0
            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border text-muted-foreground hover:bg-muted/40",
        )}
        title={count > 0 ? `${count} snippet${count === 1 ? "" : "s"} linked` : "Link snippets"}
      >
        <Code2 className="h-3 w-3" />
        {count > 0 ? `${count} snippet${count === 1 ? "" : "s"}` : "Link snippets"}
      </button>
    </SnippetSearchPopover>
  );
}
