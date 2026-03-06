import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, ChevronDown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import vsLogo from "@/assets/vs-sales-logo.png";
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
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="flex items-center h-12 px-3 sm:px-5">
        {/* Left */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
            <img src={vsLogo} alt="VS" className="h-3.5 w-3.5 brightness-[10]" />
          </div>

          <div className="h-3.5 w-px bg-border mx-0.5" />

          <div className="flex items-center gap-1.5">
            <module.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[13px] font-semibold text-foreground">{module.label}</span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center ml-4 gap-0.5 overflow-x-auto scrollbar-none">
          {module.items.map((item) => {
            const isActive = currentPath === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
                activeClassName=""
              >
                <item.icon className="h-3 w-3" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Right */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-accent transition-colors outline-none">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-[9px] font-bold text-primary">
                  {initials}
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-lg">
              <div className="px-2.5 py-1.5">
                <p className="text-[12px] font-medium">{profile?.full_name || "Usuário"}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive cursor-pointer text-[12px]"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
