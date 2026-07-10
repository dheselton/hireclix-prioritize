import { Loader2 } from "lucide-react";

export function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
