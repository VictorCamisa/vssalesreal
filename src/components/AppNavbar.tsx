import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Smartphone, Users, Search, Send,
  Kanban, Calendar, Brain, Building2, UserCheck,
  LogOut, Menu, X, ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { useAuth } from "@/contexts/AuthContext";
import vsLogo from "@/assets/vs-sales-logo.png";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "WhatsApp", url: "/whatsapp", icon: Smartphone },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Prospecção", url: "/prospecting", icon: Search },
  { title: "Disparos", url: "/broadcasts", icon: Send },
];

const toolsNav = [
  { title: "CRM Pipeline", url: "/crm", icon: Kanban },
  { title: "Agendamentos", url: "/appointments", icon: Calendar },
  { title: "Agente IA", url: "/ai", icon: Brain },
  { title: "Empresa", url: "/company", icon: Building2 },
];

export function AppNavbar() {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isToolActive = toolsNav.some((t) => location.pathname === t.url);

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 items-center px-4 sm:px-6 lg:px-8 gap-1">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 mr-6 shrink-0">
            <img src={vsLogo} alt="VS SALES" className="h-7 w-auto" />
            <div className="hidden sm:block">
              <p className="text-[13px] font-bold text-foreground leading-none tracking-tight">VS SALES</p>
              <p className="text-[8px] text-muted-foreground tracking-[0.2em] uppercase">Soluções</p>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1">
            {mainNav.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === "/"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150"
                activeClassName="!text-primary !bg-primary/10 font-medium"
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.title}</span>
              </NavLink>
            ))}

            {/* Tools Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150 outline-none",
                    isToolActive && "!text-primary !bg-primary/10 font-medium"
                  )}
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span>Ferramentas</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {toolsNav.map((item) => (
                  <DropdownMenuItem key={item.url} asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2.5 px-2 py-1.5 text-[13px] cursor-pointer"
                      activeClassName="text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.title}</span>
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent/60 transition-colors outline-none">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-[11px] font-bold text-white shadow-soft">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden md:inline text-[13px] font-medium text-foreground/80 max-w-[120px] truncate">
                    {profile?.full_name?.split(" ")[0] || "Usuário"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{profile?.full_name || "Usuário"}</p>
                  <p className="text-[11px] text-muted-foreground">Gerenciar conta</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[13px]">Onboarding</span>
                    <OnboardingDialog />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="text-[13px]">Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden h-9 w-9"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border/50 bg-card/95 backdrop-blur-xl animate-fade-in">
            <div className="p-3 space-y-1">
              <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium px-2 mb-1">
                Principal
              </p>
              {mainNav.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all"
                  activeClassName="!text-primary !bg-primary/10 font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
              <div className="h-px bg-border/50 my-2" />
              <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium px-2 mb-1">
                Ferramentas
              </p>
              {toolsNav.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all"
                  activeClassName="!text-primary !bg-primary/10 font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
