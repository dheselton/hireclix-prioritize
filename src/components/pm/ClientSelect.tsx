import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewClientPopover } from "./NewClientPopover";

interface Client { id: string; name: string }

interface Props {
  value: string;
  onChange: (id: string) => void;
  clients: Client[];
  onClientsChanged: (next: Client[], created?: Client) => void;
  placeholder?: string;
  required?: boolean;
}

export function ClientSelect({ value, onChange, clients, onClientsChanged, placeholder = "Select client" }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {clients.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground italic">No clients yet — create one →</div>
            )}
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <NewClientPopover
        onCreated={(c) => {
          const next = [...clients, c].sort((a, b) => a.name.localeCompare(b.name));
          onClientsChanged(next, c);
          onChange(c.id);
        }}
      />
    </div>
  );
}
