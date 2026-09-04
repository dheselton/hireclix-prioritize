import { cn } from "@/lib/utils";

const MONOGRAM_COLORS = [
  "#4F46E5", "#0891B2", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#DB2777", "#2563EB", "#0D9488", "#CA8A04",
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return MONOGRAM_COLORS[Math.abs(hash) % MONOGRAM_COLORS.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  name: string;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  title?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

/** Client logo with deterministic-color initials monogram fallback. */
export function ClientLogo({ name, logoUrl, size = "sm", className, title }: Props) {
  const sz = SIZE[size];
  const initials = initialsFor(name);
  const bg = colorForName(name || "?");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        title={title ?? name}
        className={cn(
          "rounded-md object-contain bg-background border border-border shrink-0",
          sz,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-md flex items-center justify-center font-semibold text-white shrink-0",
        sz,
        className,
      )}
      style={{ backgroundColor: bg }}
      title={title ?? name}
      aria-hidden={!name}
    >
      {initials}
    </div>
  );
}
