import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface RepeatableListProps<T> {
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderItem: (item: T, index: number, onChange: (updated: T) => void) => React.ReactNode;
  addLabel?: string;
  emptyMessage?: string;
}

export function RepeatableList<T>({
  items,
  onAdd,
  onRemove,
  renderItem,
  addLabel = "Add Item",
  emptyMessage = "No items added yet."
}: RepeatableListProps<T>) {
  const handleItemChange = (index: number, updated: T) => {
    // This is handled by parent through renderItem callback
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
      ) : (
        items.map((item, index) => (
          <div key={index} className="relative group border border-border rounded-lg p-3 bg-card/50">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 touch-action text-destructive hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            {renderItem(item, index, (updated) => handleItemChange(index, updated))}
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="mt-2"
      >
        <Plus className="h-3 w-3 mr-1" />
        {addLabel}
      </Button>
    </div>
  );
}
