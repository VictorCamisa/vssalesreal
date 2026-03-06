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
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar-background">
      {/* Header */}
      <SidebarHeader className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <img src={vsLogo} alt="VS" className="h-5 w-5 brightness-[10]" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden overflow-hidden">
            <p className="text-[13px] font-semibold text-foreground leading-tight">VS Sales</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Soluções em vendas</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-1">
        {/* Dashboard */}
        <NavLink
          to={dashboardItem.url}
          end
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors font-medium"
          activeClassName="!bg-accent !text-foreground"
        >
          <dashboardItem.icon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
        </NavLink>

        {/* Separator */}
        <div className="h-px bg-border my-3 mx-1 group-data-[collapsible=icon]:hidden" />

        {/* Label */}
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground px-3 mb-1.5 group-data-[collapsible=icon]:hidden">
          Módulos
        </p>

        {/* Module groups */}
        <div className="space-y-0.5 group-data-[collapsible=icon]:hidden">
          {moduleGroups.map((group) => (
            <button
              key={group.label}
              onClick={() => navigate(group.items[0].url)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors group/item"
            >
              <group.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover/item:text-foreground transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground/80 group-hover/item:text-foreground leading-tight">{group.label}</p>
                <p className="text-[10px] text-muted-foreground/70 truncate leading-tight mt-0.5">
                  {group.items.map((i) => i.title).join(" · ")}
                </p>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover/item:text-muted-foreground transition-colors shrink-0" />
            </button>
          ))}
        </div>

        {/* Collapsed icons */}
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-0.5 pt-1">
          {moduleGroups.map((group) => (
            <button
              key={group.label}
              onClick={() => navigate(group.items[0].url)}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={group.label}
            >
              <group.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="px-2.5 pb-3">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-accent/60 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[10px] font-bold text-primary">
            {initials}
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-[12px] font-medium truncate text-foreground/90">{profile?.full_name || "Usuário"}</p>
            <div className="flex items-center gap-1">
              <OnboardingDialog />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
