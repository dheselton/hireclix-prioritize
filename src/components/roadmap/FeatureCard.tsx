import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, CheckSquare } from "lucide-react";
import type { Feature } from "@/types/roadmap";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  feature: Feature;
  onClick: () => void;
}

const statusColors: Record<string, string> = {
  "Scope/Ideation": "badge-muted",
  "Design": "badge-primary",
  "In Development": "badge-accent",
  "QA": "badge-primary",
  "Approved": "badge-success",
  "Released": "badge-success"
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-rose-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export function FeatureCard({ feature, onClick }: FeatureCardProps) {
  return (
    <Card 
      className="p-4 cursor-pointer hover:shadow-md transition-shadow bg-card border border-border"
      onClick={onClick}
    >
      <h4 className="font-semibold text-sm mb-3 text-foreground">{feature.title}</h4>
      
      <div className="space-y-2">
        {feature.product_category && (
          <Badge className="badge-primary text-xs">{feature.product_category.name}</Badge>
        )}
        
        <div className="flex flex-wrap gap-1">
          <Badge className="badge-muted text-xs">{feature.feature_level}</Badge>
          <Badge className="badge-muted text-xs">{feature.feature_type}</Badge>
          <Badge className={`${statusColors[feature.status]} text-xs`}>
            {feature.status}
          </Badge>
        </div>

        {(feature.assignees?.length ?? 0) > 0 && (
          <div className="flex -space-x-2 mt-2">
            {feature.assignees!.slice(0, 3).map((assignee, idx) => (
              <Avatar key={idx} className={cn("w-6 h-6 border-2 border-background", getAvatarColor(assignee))}>
                <AvatarFallback className="text-[10px] text-white bg-transparent">
                  {getInitials(assignee)}
                </AvatarFallback>
              </Avatar>
            ))}
            {feature.assignees!.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background text-muted-foreground font-medium">
                +{feature.assignees!.length - 3}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {feature.due_date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(feature.due_date), 'MMM d')}
            </div>
          )}
          {(feature.subtask_count ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              {feature.subtask_count}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
