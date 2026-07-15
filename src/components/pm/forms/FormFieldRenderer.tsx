import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FormFieldRow {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string | null;
  options?: any;
  conditionals?: any;
}

/**
 * Rule shape: `{ field: "<slug>", in: ["Value A", "Value B"] }`
 * `field` is the slug of another field's label (see slugifyLabel).
 * Multiple rules = AND. Empty/missing = always visible.
 * For checkbox_group values (arrays), a match = any array element in `in`.
 */
export function isFieldVisible(
  field: FormFieldRow,
  valuesBySlug: Record<string, any>,
): boolean {
  const rules = Array.isArray(field.conditionals) ? field.conditionals : [];
  if (rules.length === 0) return true;
  for (const rule of rules) {
    if (!rule || !rule.field || !Array.isArray(rule.in)) continue;
    const v = valuesBySlug[rule.field];
    const arr = Array.isArray(v) ? v : v == null ? [] : [v];
    if (!arr.some((x) => rule.in.includes(x))) return false;
  }
  return true;
}


interface Props {
  field: FormFieldRow;
  value: any;
  onChange: (v: any) => void;
}

export function FormFieldRenderer({ field, value, onChange }: Props) {
  const opts: string[] = Array.isArray(field.options) ? field.options : [];
  return (
    <div>
      <Label>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
        />
      ) : field.type === "dropdown" ? (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Select"} /></SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.type === "checkbox_group" ? (
        <div className="flex flex-wrap gap-3 pt-1">
          {opts.map((o) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const checked = arr.includes(o);
            return (
              <label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = c ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next);
                  }}
                />
                {o}
              </label>
            );
          })}
        </div>
      ) : (
        <Input
          type={
            field.type === "email" ? "email" :
            field.type === "number" ? "number" :
            field.type === "date" ? "date" : "text"
          }
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
        />
      )}
    </div>
  );
}
