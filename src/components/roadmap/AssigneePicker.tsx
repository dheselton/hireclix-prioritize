import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface AssigneePickerProps {
  value: string[];
  onChange: (assignees: string[]) => void;
  className?: string;
}

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

export function AssigneePicker({ value = [], onChange, className }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, role')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setTeamMembers(data);
      }
      setLoading(false);
    };

    fetchTeamMembers();
  }, []);

  const toggleAssignee = (name: string) => {
    if (value.includes(name)) {
      onChange(value.filter(n => n !== name));
    } else {
      onChange([...value, name]);
    }
  };

  const removeAssignee = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(n => n !== name));
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Selected assignees display */}
      <div className="flex flex-wrap items-center gap-2">
        {value.map((name) => (
          <div
            key={name}
            className="flex items-center gap-1.5 bg-muted rounded-full pl-1 pr-2 py-1 group"
          >
            <Avatar className={cn("w-6 h-6", getAvatarColor(name))}>
              <AvatarFallback className="text-[10px] text-white bg-transparent">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground">{name.split(' ')[0]}</span>
            <button
              onClick={(e) => removeAssignee(name, e)}
              className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add assignee button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 rounded-full p-0 border-dashed"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 bg-popover border border-border shadow-lg z-50" align="start">
            <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
              Team Members
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                Loading...
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                No team members found
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {teamMembers.map((member) => {
                  const isSelected = value.includes(member.name);
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleAssignee(member.name)}
                      className={cn(
                        "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <Avatar className={cn("w-8 h-8", getAvatarColor(member.name))}>
                        <AvatarFallback className="text-xs text-white bg-transparent">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {member.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Click + to add assignees
        </p>
      )}
    </div>
  );
}
