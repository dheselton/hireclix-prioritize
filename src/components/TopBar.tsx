import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

export function TopBar() {
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-border bg-card flex items-center px-4 gap-4 sticky top-0 z-40">
      <SidebarTrigger className="flex-shrink-0" />
      
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search customers, docs, integrations..."
            className="pl-10 bg-background"
          />
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-accent text-accent-foreground hover:bg-accent-hover flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Add</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover border-border z-50">
          <DropdownMenuItem onClick={() => navigate("/customers?action=add")}>
            Add Customer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/internal-docs?action=add")}>
            Add Internal Doc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/client-docs?action=add")}>
            Add Client Doc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/integrations?action=add")}>
            Add Integration
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
