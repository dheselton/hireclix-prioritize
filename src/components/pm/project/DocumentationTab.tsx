import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/pm/project/RichTextEditor";
import { useMockUsers } from "@/lib/pm/mockUser";
import { supabase } from "@/integrations/supabase/client";
import type { PmProject } from "@/types/pm";
import { toast } from "sonner";
import { BookOpen, Save } from "lucide-react";

interface Props {
  project: PmProject;
  canEdit: boolean;
  onProjectChange?: (next: PmProject) => void;
}

/**
 * Career-site Documentation tab — visible while a project is in Support mode.
 * Stores rich-text HTML in pm_projects.custom_fields.documentation so any team
 * member can review caveats (e.g. "Adoration has Home Health vs Hospice filter").
 */
export function DocumentationTab({ project, canEdit, onProjectChange }: Props) {
  const users = useMockUsers();
  const initial = String((project.custom_fields as any)?.documentation ?? "");
  const [html, setHtml] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHtml(initial);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const next = { ...(project.custom_fields ?? {}), documentation: html };
      const { data, error } = await supabase
        .from("pm_projects")
        .update({ custom_fields: next })
        .eq("id", project.id)
        .select()
        .single();
      if (error) throw error;
      toast.success("Documentation saved");
      setDirty(false);
      if (data) onProjectChange?.(data as unknown as PmProject);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" /> Site documentation
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capture caveats, integrations, custom logic, vendor accounts, and anything
              the team needs to know when supporting this site.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>

        {canEdit ? (
          <RichTextEditor
            value={html}
            onChange={(v) => { setHtml(v); setDirty(true); }}
            users={users}
            placeholder="Document caveats, custom components, vendor logins, integrations, gotchas…"
          />
        ) : html ? (
          <div
            className="prose prose-sm max-w-none text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="text-sm text-muted-foreground italic">No documentation yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
