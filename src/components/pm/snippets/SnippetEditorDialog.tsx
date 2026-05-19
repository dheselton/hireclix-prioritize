import { useEffect, useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Snippet, SnippetCategory, SnippetInput } from "@/lib/pm/snippets";

const LANGUAGES = ["HTML", "CSS", "JavaScript", "JSON", "Liquid", "Other"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Snippet | null;
  categories: SnippetCategory[];
  allTags: string[];
  projects: { id: string; title: string }[];
  onSave: (input: SnippetInput) => Promise<void> | void;
}

export function SnippetEditorDialog({
  open,
  onOpenChange,
  initial,
  categories,
  allTags,
  projects,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [language, setLanguage] = useState<string>("JavaScript");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [variations, setVariations] = useState<{ name: string; code: string }[]>([
    { name: "Default", code: "" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setCategoryId(initial.category_id ?? "");
      setLanguage(initial.language ?? "JavaScript");
      setTags(initial.tags ?? []);
      setProjectIds(initial.project_ids ?? []);
      setVariations(
        initial.variations.length
          ? initial.variations.map(v => ({ name: v.name, code: v.code }))
          : [{ name: "Default", code: "" }],
      );
    } else {
      setTitle("");
      setDescription("");
      setCategoryId(categories[0]?.id ?? "");
      setLanguage("JavaScript");
      setTags([]);
      setProjectIds([]);
      setVariations([{ name: "Default", code: "" }]);
    }
    setTagInput("");
  }, [open, initial, categories]);

  const addTag = (t: string) => {
    const v = t.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  };

  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  const tagSuggestions = allTags
    .filter(t => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()))
    .slice(0, 6);

  const moveVar = (from: number, to: number) => {
    if (to < 0 || to >= variations.length) return;
    const next = [...variations];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setVariations(next);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId || null,
        language,
        tags,
        project_ids: projectIds,
        variations: variations.length ? variations : [{ name: "Default", code: "" }],
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleProject = (id: string) => {
    setProjectIds(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Snippet" : "New Snippet"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Sticky nav on scroll" />
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="What this snippet does and when to use it"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tags</Label>
              <div className="flex flex-wrap gap-1 p-1.5 border border-input rounded-md min-h-10 bg-background">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[12px] px-1.5 py-0.5 rounded bg-muted">
                    {t}
                    <button onClick={() => setTags(tags.filter(x => x !== t))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-[80px] bg-transparent outline-none text-sm"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder={tags.length ? "" : "Type and press Enter"}
                />
              </div>
              {tagInput && tagSuggestions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {tagSuggestions.map(t => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-border hover:bg-accent"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Variations *</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVariations([...variations, { name: `Variation ${variations.length + 1}`, code: "" }])}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Variation
              </Button>
            </div>
            <div className="space-y-3">
              {variations.map((v, i) => (
                <div key={i} className="border border-border rounded-md p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button onClick={() => moveVar(i, i - 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0}>
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </button>
                    </div>
                    <Input
                      value={v.name}
                      onChange={e => {
                        const next = [...variations];
                        next[i] = { ...v, name: e.target.value };
                        setVariations(next);
                      }}
                      placeholder="Variation name"
                      className="h-8"
                    />
                    {variations.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setVariations(variations.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={v.code}
                    onChange={e => {
                      const next = [...variations];
                      next[i] = { ...v, code: e.target.value };
                      setVariations(next);
                    }}
                    rows={6}
                    className="font-mono text-xs"
                    placeholder="// Code"
                  />
                </div>
              ))}
            </div>
          </div>

          {projects.length > 0 && (
            <div>
              <Label className="text-xs">Used In Projects</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {projects.map(p => {
                  const active = projectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProject(p.id)}
                      className={
                        "text-[12px] px-2 py-1 rounded-full border transition-colors " +
                        (active
                          ? "bg-info text-info-foreground border-info"
                          : "border-border text-muted-foreground hover:bg-accent")
                      }
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save Snippet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
