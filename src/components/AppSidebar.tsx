import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { moduleGroups, dashboardItem } from "@/lib/navigation";
import { NavLink } from "@/components/NavLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const moduleColors: Record<string, { bg: string; text: string; activeBg: string; border: string }> = {
  "Comunicação": { bg: "bg-emerald-500/8", text: "text-emerald-400", activeBg: "bg-emerald-500/15", border: "border-emerald-500/25" },
  "Vendas": { bg: "bg-blue-500/8", text: "text-blue-400", activeBg: "bg-blue-500/15", border: "border-blue-500/25" },
  "Inteligência": { bg: "bg-violet-500/8", text: "text-violet-400", activeBg: "bg-violet-500/15", border: "border-violet-500/25" },
  "Configuração": { bg: "bg-orange-500/8", text: "text-orange-400", activeBg: "bg-orange-500/15", border: "border-orange-500/25" },
};

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
    <Sidebar collapsible="icon" className="border-r border-border/60 bg-sidebar-background">
      {/* Header */}
      <SidebarHeader className={`${collapsed ? "px-2 pt-3 pb-2" : "px-4 pt-4 pb-3"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="relative shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/25">
              <img src={vsLogo} alt="VS" className="h-4 w-4 brightness-[10]" />
            </div>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground tracking-tight leading-none">VS Sales</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Plataforma de vendas</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={`${collapsed ? "px-1.5" : "px-3"} flex-1 overflow-y-auto pt-1`}>
        {/* Dashboard */}
        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink
              to={dashboardItem.url}
              end
              className={`flex items-center ${collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"} rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all font-medium mb-1`}
              activeClassName="!bg-primary/12 !text-primary"
            >
              <dashboardItem.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>Dashboard</span>}
            </NavLink>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Dashboard</TooltipContent>}
        </Tooltip>

        {/* Separator */}
        <div className={`${collapsed ? "mx-1" : "mx-2"} my-2 h-px bg-border/60`} />

        {/* Module groups */}
        <div className="space-y-1">
          {moduleGroups.map((group) => {
            const colors = moduleColors[group.label] || moduleColors["Configuração"];
            const groupActive = isGroupActive(group.items);

            return (
              <div key={group.label}>
                {/* Group label - only when expanded */}
                {!collapsed && (
                  <p className={`px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${groupActive ? colors.text : "text-muted-foreground/50"}`}>
                    {group.label}
                  </p>
                )}

                {/* Items */}
                <div className={collapsed ? "space-y-0.5" : "space-y-0.5"}>
                  {group.items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <Tooltip key={item.url}>
                        <TooltipTrigger asChild>
                          <NavLink
                            to={item.url}
                            className={`flex items-center ${collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"} rounded-lg text-[13px] transition-all font-medium ${
                              active
                                ? `${colors.activeBg} ${colors.text} border ${colors.border}`
                                : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/60 border border-transparent"
                            }`}
                            activeClassName=""
                          >
                            <item.icon className={`h-[16px] w-[16px] shrink-0 ${active ? colors.text : ""}`} />
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
        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={`w-full ${collapsed ? "h-8 px-0" : "h-8 justify-start gap-2 px-3"} text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 rounded-lg mb-1`}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <><ChevronLeft className="h-3.5 w-3.5" /><span className="text-[11px]">Recolher</span></>}
        </Button>

        {/* User */}
        <div className={`rounded-lg border border-border/50 bg-accent/30 ${collapsed ? "p-1.5" : "p-2.5"}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[10px] font-bold text-primary cursor-default">
                  {initials}
                </div>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{firstName}</TooltipContent>}
            </Tooltip>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">{firstName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span className="text-[9px] text-muted-foreground">online</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="h-6 w-6 shrink-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-md"
                >
                  <LogOut className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
