import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMockUsers } from "@/lib/pm/mockUser";
import { Label } from "@/components/ui/label";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  helpText?: string;
}

export function RequesterPicker({ value, onChange, label = "Requested by", helpText }: Props) {
  const users = useMockUsers();
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
        <SelectContent className="z-50 bg-popover max-h-72">
          {users.map(u => (
            <SelectItem key={u.id} value={u.id}>
              {u.name} <span className="text-muted-foreground text-xs">· {u.role}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpText && <p className="text-xs text-muted-foreground mt-1">{helpText}</p>}
    </div>
  );
}
