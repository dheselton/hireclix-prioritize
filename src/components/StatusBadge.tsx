import { Badge } from "@/components/ui/badge";
import { CustomerStatus, IntegrationStatus, IntegrationHealth } from "@/types";

interface StatusBadgeProps {
  status: CustomerStatus | IntegrationStatus | IntegrationHealth;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants: Record<string, { variant: any; className: string }> = {
    Live: { variant: "default", className: "badge-success" },
    "In Progress": { variant: "secondary", className: "badge-accent" },
    Prospect: { variant: "outline", className: "badge-muted" },
    Paused: { variant: "secondary", className: "bg-muted/50 text-muted-foreground border-border" },
    Retired: { variant: "outline", className: "badge-primary" },
    GA: { variant: "default", className: "bg-primary/90 text-primary-foreground border-transparent" },
    Beta: { variant: "secondary", className: "badge-accent" },
    Planned: { variant: "outline", className: "badge-muted" },
    Deprecated: { variant: "outline", className: "bg-destructive/10 text-destructive border-destructive/30" },
    Healthy: { variant: "default", className: "badge-success" },
    Degraded: { variant: "secondary", className: "bg-orange-500/15 text-orange-700 border-transparent" },
    Down: { variant: "outline", className: "bg-destructive/10 text-destructive border-destructive/30" },
  };

  const config = variants[status] || { variant: "outline", className: "badge-muted" };

  return (
    <Badge variant={config.variant} className={config.className}>
      {status}
    </Badge>
  );
}
