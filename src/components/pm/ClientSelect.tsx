import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewClientPopover } from "./NewClientPopover";
import { useInternalClientIds } from "@/lib/pm/clients";
import { cn } from "@/lib/utils";

interface Client { id: string; name: string; is_internal?: boolean }

interface Props {
  value: string;
  onChange: (id: string) => void;
  clients: Client[];
  onClientsChanged: (next: Client[], created?: Client) => void;
  placeholder?: string;
  required?: boolean;
}

export function ClientSelect({ value, onChange, clients, onClientsChanged, placeholder = "Select client" }: Props) {
  const internalIds = useInternalClientIds();
  const isInternal = (id: string) => internalIds.has(id) || !!clients.find(c => c.id === id)?.is_internal;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={cn(value && isInternal(value) && "ring-1 ring-[hsl(var(--internal)/0.5)]")}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {clients.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground italic">No clients yet — create one →</div>
            )}
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>
                <span className="inline-flex items-center gap-2">
                  <span>{c.name}</span>
                  {isInternal(c.id) && <span className="internal-pill">Internal</span>}
                </span>
              </SelectItem>
            ))}
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
