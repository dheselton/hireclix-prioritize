import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  type SnippetCategory,
} from "@/lib/pm/snippets";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: SnippetCategory[];
  counts: Record<string, number>;
  onChanged: () => void;
}

export function ManageCategoriesDialog({ open, onOpenChange, categories, counts, onChanged }: Props) {
  const [localCats, setLocalCats] = useState<SnippetCategory[]>(categories);
  const [newName, setNewName] = useState("");

  useEffect(() => setLocalCats(categories), [categories, open]);

  const handleRename = async (id: string, name: string) => {
    setLocalCats(cs => cs.map(c => (c.id === id ? { ...c, name } : c)));
    await renameCategory(id, name);
    onChanged();
  };

  const handleDelete = async (c: SnippetCategory) => {
    const count = counts[c.id] ?? 0;
    if (count > 0 && !confirm(`Delete "${c.name}"? ${count} snippet(s) will be left uncategorized.`)) return;
    if (count === 0 && !confirm(`Delete "${c.name}"?`)) return;
    await deleteCategory(c.id);
    onChanged();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createCategory(newName.trim());
    setNewName("");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {localCats.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <Input
                value={c.name}
                onChange={e =>
                  setLocalCats(cs => cs.map(x => (x.id === c.id ? { ...x, name: e.target.value } : x)))
                }
                onBlur={() => handleRename(c.id, c.name)}
                className="h-9"
              />
              <span className="text-xs text-muted-foreground w-16 text-right">
                {counts[c.id] ?? 0} item{(counts[c.id] ?? 0) === 1 ? "" : "s"}
              </span>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDelete(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="New category name"
              className="h-9"
            />
            <Button onClick={handleAdd} size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
