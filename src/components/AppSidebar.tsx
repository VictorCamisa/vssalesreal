import { useNavigate } from "react-router-dom";
import { LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { moduleGroups, dashboardItem } from "@/lib/navigation";
import { NavLink } from "@/components/NavLink";

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/30">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <img src={vsLogo} alt="VS SALES" className="h-8 w-auto shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-bold text-foreground tracking-tight">VS SALES</p>
            <p className="text-[9px] text-muted-foreground tracking-widest uppercase">Soluções</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 space-y-4">
        {/* Dashboard link */}
        <NavLink
          to={dashboardItem.url}
          end
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
          activeClassName="!text-primary !bg-primary/10 font-semibold"
        >
          <dashboardItem.icon className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
        </NavLink>

        {/* Module groups as cards */}
        <div className="space-y-2 group-data-[collapsible=icon]:hidden">
          {moduleGroups.map((group) => (
            <button
              key={group.label}
              onClick={() => navigate(group.items[0].url)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-accent/50 transition-all group/card border border-transparent hover:border-border/30"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <group.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{group.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {group.items.map((i) => i.title).join(" · ")}
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover/card:text-muted-foreground transition-colors shrink-0" />
            </button>
          ))}
        </div>

        {/* Icon-only collapsed state */}
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-2">
          {moduleGroups.map((group) => (
            <button
              key={group.label}
              onClick={() => navigate(group.items[0].url)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent/50 transition-all text-muted-foreground hover:text-foreground"
              title={group.label}
            >
              <group.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-accent/30 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium truncate">{profile?.full_name || "Usuário"}</p>
              <OnboardingDialog />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
