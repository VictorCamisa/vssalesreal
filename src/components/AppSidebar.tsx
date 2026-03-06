import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { moduleGroups, dashboardItem } from "@/lib/navigation";
import { NavLink } from "@/components/NavLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  const isActive = (url: string) => location.pathname === url;
  const isGroupActive = (items: { url: string }[]) => items.some(i => location.pathname === i.url);

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar-background">
      {/* Header with full logo */}
      <SidebarHeader className={`${collapsed ? "px-2 pt-3 pb-2" : "px-4 pt-4 pb-3"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          {collapsed ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
              <img src={vsLogo} alt="VS" className="h-5 w-5 brightness-[10]" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30 shrink-0">
                <img src={vsLogo} alt="VS" className="h-5 w-5 brightness-[10]" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground tracking-tight leading-none">VS Sales</p>
                <p className="text-xs text-muted-foreground mt-0.5">Plataforma de vendas</p>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={`${collapsed ? "px-1.5" : "px-3"} flex-1 overflow-y-auto pt-2`}>
        {/* Dashboard */}
        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink
              to={dashboardItem.url}
              end
              className={`flex items-center ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"} rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all font-medium mb-2`}
              activeClassName="!bg-primary/10 !text-primary"
            >
              <LayoutDashboard className={`${collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"} shrink-0`} />
              {!collapsed && <span>Dashboard</span>}
            </NavLink>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Dashboard</TooltipContent>}
        </Tooltip>

        {/* Separator */}
        <div className={`${collapsed ? "mx-1" : "mx-2"} my-2 h-px bg-border`} />

        {/* Module groups */}
        <div className="space-y-1">
          {moduleGroups.map((group) => {
            const groupActive = isGroupActive(group.items);

            return (
              <div key={group.label}>
                {!collapsed && (
                  <p className={`px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider ${groupActive ? "text-primary" : "text-muted-foreground/60"}`}>
                    {group.label}
                  </p>
                )}

                {/* Collapsed: show group icon as separator */}
                {collapsed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex justify-center py-1.5 my-1">
                        <div className={`h-0.5 w-5 rounded-full ${groupActive ? "bg-primary/50" : "bg-border"}`} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{group.label}</TooltipContent>
                  </Tooltip>
                )}

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <Tooltip key={item.url}>
                        <TooltipTrigger asChild>
                          <NavLink
                            to={item.url}
                            className={`flex items-center ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"} rounded-lg text-sm transition-all font-medium ${
                              active
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "text-foreground/70 hover:text-foreground hover:bg-accent border border-transparent"
                            }`}
                            activeClassName=""
                          >
                            <item.icon className={`${collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"} shrink-0 ${active ? "text-primary" : ""}`} />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
                        </TooltipTrigger>
                        {collapsed && <TooltipContent side="right">{item.title}</TooltipContent>}
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className={`${collapsed ? "p-1.5" : "p-3"}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={`w-full ${collapsed ? "h-9 px-0" : "h-9 justify-start gap-2 px-3"} text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg mb-1`}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="text-sm">Recolher</span></>}
        </Button>

        <div className={`rounded-lg border border-border bg-accent/40 ${collapsed ? "p-2" : "p-3"}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary cursor-default">
                  {initials}
                </div>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{firstName}</TooltipContent>}
            </Tooltip>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{firstName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span className="text-xs text-muted-foreground">online</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
