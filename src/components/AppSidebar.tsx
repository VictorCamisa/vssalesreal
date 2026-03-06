import { useNavigate } from "react-router-dom";
import { LogOut, ArrowRight, Terminal, Cpu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { moduleGroups, dashboardItem } from "@/lib/navigation";
import { NavLink } from "@/components/NavLink";

const moduleColors: Record<string, { accent: string; iconBg: string; glow: string }> = {
  "Comunicação": {
    accent: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    glow: "shadow-emerald-500/5",
  },
  "Vendas": {
    accent: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    glow: "shadow-blue-500/5",
  },
  "Inteligência": {
    accent: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    glow: "shadow-violet-500/5",
  },
  "Configuração": {
    accent: "text-orange-400",
    iconBg: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    glow: "shadow-orange-500/5",
  },
};

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/50 bg-background">
      {/* Brand header */}
      <SidebarHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
              <img src={vsLogo} alt="VS" className="h-4 w-4 brightness-[10]" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-background" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground tracking-tight leading-none">VS Sales</p>
            <div className="flex items-center gap-1 mt-1">
              <Terminal className="h-2.5 w-2.5 text-primary" />
              <span className="text-[9px] font-mono text-primary tracking-wider uppercase">Pro v2.0</span>
            </div>
          </div>
        </div>

        {/* Decorative line */}
        <div className="mt-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
          <Cpu className="h-2.5 w-2.5 text-muted-foreground/30" />
          <div className="h-px flex-1 bg-gradient-to-l from-primary/30 to-transparent" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 flex-1 overflow-y-auto">
        {/* Dashboard link */}
        <NavLink
          to={dashboardItem.url}
          end
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all font-medium mb-5 border border-transparent hover:border-border/50"
          activeClassName="!bg-primary/10 !text-primary !border-primary/20"
        >
          <dashboardItem.icon className="h-[18px] w-[18px] shrink-0" />
          <span>Dashboard</span>
        </NavLink>

        {/* Section label */}
        <p className="px-3 text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 mb-2">Módulos</p>

        {/* Module cards */}
        <div className="space-y-1.5">
          {moduleGroups.map((group) => {
            const colors = moduleColors[group.label] || moduleColors["Configuração"];
            return (
              <button
                key={group.label}
                onClick={() => navigate(group.items[0].url)}
                className={`w-full rounded-lg border border-border/40 hover:border-border bg-card/50 hover:bg-card p-3 text-left transition-all duration-200 group/card ${colors.glow} hover:shadow-md`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${colors.iconBg} shrink-0 transition-transform group-hover/card:scale-110`}>
                    <group.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-[12px] font-semibold ${colors.accent}`}>{group.label}</p>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/20 group-hover/card:text-muted-foreground/60 group-hover/card:translate-x-0.5 transition-all" />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {group.items.map((item, idx) => (
                        <span key={item.url} className="text-[10px] text-muted-foreground/50 font-mono">
                          {item.title}{idx < group.items.length - 1 ? " ·" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="p-3">
        <div className="rounded-lg border border-border/50 bg-card/30 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/15 text-[10px] font-mono font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground truncate">{firstName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[9px] font-mono text-muted-foreground">online</span>
                <OnboardingDialog />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-7 w-7 shrink-0 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
