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

const moduleAccent: Record<string, string> = {
  "Comunicação": "text-emerald-400",
  "Vendas": "text-blue-400",
  "Inteligência": "text-violet-400",
  "Configuração": "text-orange-400",
};

const tabActive: Record<string, string> = {
  "Comunicação": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "Vendas": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Inteligência": "bg-violet-500/10 text-violet-400 border-violet-500/30",
  "Configuração": "bg-orange-500/10 text-orange-400 border-orange-500/30",
};

interface Props {
  module: ModuleGroup;
  currentPath: string;
}

export function ModuleNavbar({ module, currentPath }: Props) {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";
  const accent = moduleAccent[module.label] || "text-primary";
  const activeTab = tabActive[module.label] || "bg-primary/10 text-primary border-primary/30";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center h-12 px-3 sm:px-5">
        {/* Left: back + brand + module */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary shadow-sm shadow-primary/20">
            <img src={vsLogo} alt="VS" className="h-3.5 w-3.5 brightness-[10]" />
          </div>

          <div className="h-4 w-px bg-border/50 mx-0.5" />

          <div className="flex items-center gap-1.5">
            <module.icon className={`h-3.5 w-3.5 ${accent}`} />
            <span className={`text-[13px] font-semibold ${accent}`}>{module.label}</span>
          </div>
        </div>

        {/* Tabs - more visible */}
        <nav className="flex items-center ml-4 gap-1 overflow-x-auto scrollbar-none">
          {module.items.map((item) => {
            const isActive = currentPath === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border transition-all whitespace-nowrap ${
                  isActive
                    ? activeTab
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/50 hover:border-border/50"
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
