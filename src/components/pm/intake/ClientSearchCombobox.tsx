import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { NewClientPopover } from "@/components/pm/NewClientPopover";
import { useInternalClientIds } from "@/lib/pm/clients";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

export interface ClientOption { id: string; name: string; is_internal?: boolean }

interface Props {
  value: string;
  onChange: (id: string) => void;
  clients: ClientOption[];
  onClientsChanged: (next: ClientOption[], created?: ClientOption) => void;
  placeholder?: string;
  disabled?: boolean;
  /** When false, hide inline client creation (public forms). */
  allowCreate?: boolean;
}

/** Searchable client picker with inline "New client" affordance. */
export function ClientSearchCombobox({ value, onChange, clients, onClientsChanged, placeholder = "Search clients…", disabled, allowCreate = true }: Props) {
  const [open, setOpen] = useState(false);
  const internalIds = useInternalClientIds();
  const isInternal = (id: string) => internalIds.has(id) || !!clients.find(c => c.id === id)?.is_internal;
  const selected = useMemo(() => clients.find(c => c.id === value), [clients, value]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={cn(
                "w-full justify-between font-normal",
                selected && isInternal(selected.id) && "ring-1 ring-[hsl(var(--internal)/0.5)]",
                !selected && "text-muted-foreground",
              )}
            >
              <span className="truncate">
                {selected ? (
                  <>
                    {selected.name}
                    {isInternal(selected.id) && <span className="internal-pill ml-2">Internal</span>}
                  </>
                ) : placeholder}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 z-50 bg-popover w-[--radix-popover-trigger-width]" align="start">
            <Command>
              <CommandInput placeholder="Search clients…" />
              <CommandList>
                <CommandEmpty>No clients found.</CommandEmpty>
                <CommandGroup>
                  {clients.map(c => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => { onChange(c.id); setOpen(false); }}
                    >
                      <Check className={cn("h-4 w-4 mr-2", value === c.id ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1">{c.name}</span>
                      {isInternal(c.id) && <span className="internal-pill">Internal</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {allowCreate && (
        <NewClientPopover
          onCreated={(c) => {
            const next = [...clients, c].sort((a, b) => a.name.localeCompare(b.name));
            onClientsChanged(next, c);
            onChange(c.id);
          }}
        />
      )}
    </div>
  );
}
