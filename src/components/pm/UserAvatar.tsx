import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMockUsers } from "@/lib/pm/mockUser";
import { cn } from "@/lib/utils";

export function UserAvatar({ userId, size = "sm", className }: { userId?: string | null; size?: "xs"|"sm"|"md"; className?: string }) {
  const users = useMockUsers();
  const user = users.find(u => u.id === userId);
  const sz = size === "xs" ? "h-5 w-5 text-[9px]" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[10px]";
  if (!user) {
    return <div className={cn("rounded-full border border-dashed border-muted-foreground/40", sz, className)} title="Unassigned" />;
  }
  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2);
  const bg = user.avatar_color ?? undefined;
  const src = user.avatar_url?.trim() || undefined;
  return (
    <Avatar className={cn(sz, className)} title={user.name}>
      <AvatarImage src={src} />
      <AvatarFallback
        className="font-medium text-white"
        style={bg ? { backgroundColor: bg } : undefined}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
