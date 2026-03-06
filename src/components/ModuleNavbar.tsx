import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, ChevronDown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModuleGroup } from "@/lib/navigation";

interface Props {
  module: ModuleGroup;
  currentPath: string;
}

export function ModuleNavbar({ module, currentPath }: Props) {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center h-14 px-4 sm:px-6 gap-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2 text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Voltar</span>
        </Button>

        {/* Module label */}
        <div className="flex items-center gap-2 shrink-0">
          <module.icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{module.label}</span>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border/50 shrink-0" />

        {/* Module tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          {module.items.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all whitespace-nowrap"
              activeClassName="!text-primary !bg-primary/10 font-medium"
            >
              <item.icon className="h-3.5 w-3.5" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-accent/50 transition-colors outline-none">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 bg-popover/95 backdrop-blur-xl">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold">{profile?.full_name || "Usuário"}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
