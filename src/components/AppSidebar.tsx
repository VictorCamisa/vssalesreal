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
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <img src={vsLogo} alt="VS SALES" className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="group-data-[collapsible=icon]:hidden overflow-hidden">
            <p className="text-sm font-bold tracking-tight text-foreground">VS Sales</p>
            <p className="text-[10px] text-muted-foreground font-medium">Soluções em vendas</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        {/* Dashboard */}
        <NavLink
          to={dashboardItem.url}
          end
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-1"
          activeClassName="!bg-primary/10 !text-primary font-medium"
        >
          <dashboardItem.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
        </NavLink>

        {/* Divider */}
        <div className="h-px bg-border mx-2 my-3 group-data-[collapsible=icon]:hidden" />

        {/* Module groups */}
        <div className="space-y-1.5 group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">Módulos</p>
          {moduleGroups.map((group) => (
            <button
              key={group.label}
              onClick={() => navigate(group.items[0].url)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-colors group/item"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-muted-foreground group-hover/item:text-primary transition-colors shrink-0">
                <group.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground/90 group-hover/item:text-foreground">{group.label}</p>
                <p className="text-[10px] text-muted-foreground/60 truncate">
                  {group.items.map((i) => i.title).join(" · ")}
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/item:text-muted-foreground/60 transition-colors shrink-0" />
            </button>
          ))}
        </div>

        {/* Collapsed icons */}
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-1 pt-2">
          {moduleGroups.map((group) => (
            <button
              key={group.label}
              onClick={() => navigate(group.items[0].url)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={group.label}
            >
              <group.icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-accent/50 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-[13px] font-medium truncate text-foreground">{profile?.full_name || "Usuário"}</p>
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-muted-foreground">Conta</p>
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
