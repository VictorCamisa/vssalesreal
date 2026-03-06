import { useNavigate } from "react-router-dom";
import { LogOut, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { moduleGroups, dashboardItem } from "@/lib/navigation";
import { NavLink } from "@/components/NavLink";

const moduleColors: Record<string, { gradient: string; iconBg: string; border: string }> = {
  "Comunicação": {
    gradient: "from-emerald-500/10 to-emerald-500/5",
    iconBg: "bg-emerald-500/15 text-emerald-400",
    border: "border-emerald-500/10 hover:border-emerald-500/25",
  },
  "Vendas": {
    gradient: "from-blue-500/10 to-blue-500/5",
    iconBg: "bg-blue-500/15 text-blue-400",
    border: "border-blue-500/10 hover:border-blue-500/25",
  },
  "Inteligência": {
    gradient: "from-violet-500/10 to-violet-500/5",
    iconBg: "bg-violet-500/15 text-violet-400",
    border: "border-violet-500/10 hover:border-violet-500/25",
  },
  "Configuração": {
    gradient: "from-orange-500/10 to-orange-500/5",
    iconBg: "bg-orange-500/15 text-orange-400",
    border: "border-orange-500/10 hover:border-orange-500/25",
  },
};

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar-background">
      {/* Brand */}
      <SidebarHeader className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <img src={vsLogo} alt="VS SALES" className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[15px] font-bold text-foreground tracking-tight leading-none">VS Sales</p>
            <p className="text-[10px] text-primary font-semibold mt-0.5 tracking-wide uppercase">Pro</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 flex-1">
        {/* Dashboard */}
        <NavLink
          to={dashboardItem.url}
          end
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-all font-medium mb-4"
          activeClassName="!bg-primary/10 !text-primary"
        >
          <dashboardItem.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
        </NavLink>

        {/* Module cards */}
        <div className="space-y-2.5 group-data-[collapsible=icon]:hidden">
          {moduleGroups.map((group) => {
            const colors = moduleColors[group.label] || moduleColors["Configuração"];
            return (
              <button
                key={group.label}
                onClick={() => navigate(group.items[0].url)}
                className={`w-full rounded-xl border bg-gradient-to-br ${colors.gradient} ${colors.border} p-3.5 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group/card`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.iconBg} shrink-0 transition-transform group-hover/card:scale-105`}>
                    <group.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-foreground">{group.label}</p>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover/card:text-muted-foreground group-hover/card:translate-x-0.5 transition-all" />
                    </div>
                    <div className="flex flex-wrap gap-x-1 gap-y-0 mt-1">
                      {group.items.map((item, idx) => (
                        <span key={item.url} className="text-[10px] text-muted-foreground/70">
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

        {/* Collapsed icons */}
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-1 pt-1">
          {moduleGroups.map((group) => {
            const colors = moduleColors[group.label] || moduleColors["Configuração"];
            return (
              <button
                key={group.label}
                onClick={() => navigate(group.items[0].url)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.iconBg} transition-all hover:scale-105`}
                title={group.label}
              >
                <group.icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-border bg-accent/40 p-3 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 text-[11px] font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">{firstName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-muted-foreground">Online</span>
                <OnboardingDialog />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Collapsed */}
          <div className="hidden group-data-[collapsible=icon]:block">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-[10px] font-bold text-primary">
              {initials}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
