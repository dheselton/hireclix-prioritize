import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REQUEST_TYPE_GROUPS, REQUEST_TYPE_LABELS, type RequestType } from "@/lib/pm/requestTypes";

interface Props {
  value: RequestType | "";
  onChange: (v: RequestType) => void;
  placeholder?: string;
  className?: string;
}

/** Grouped request-type dropdown reused by CreateWorkDialog and the public Quick Request form. */
export function GroupedRequestTypeSelect({ value, onChange, placeholder = "Select a request type", className }: Props) {
  return (
    <Select value={value || undefined} onValueChange={(v) => onChange(v as RequestType)}>
      <SelectTrigger className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="z-50 bg-popover max-h-[60vh]">
        {REQUEST_TYPE_GROUPS.map(g => (
          <SelectGroup key={g.key}>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</SelectLabel>
            {g.types.map(t => (
              <SelectItem key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
