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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center h-14 px-4 sm:px-6">
        {/* Left: Back + Logo + Module */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <img src={vsLogo} alt="VS" className="h-6 w-6 rounded" />

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <module.icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{module.label}</span>
          </div>
        </div>

        {/* Center: tabs */}
        <nav className="flex items-center gap-0.5 ml-6 overflow-x-auto scrollbar-none">
          {module.items.map((item) => {
            const isActive = currentPath === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? "text-primary bg-primary/8"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                activeClassName=""
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-accent transition-colors outline-none">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{profile?.full_name || "Usuário"}</p>
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
