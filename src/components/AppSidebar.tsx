import {
  LayoutDashboard,
  Search,
  Users,
  Kanban,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospecção", url: "/prospecting", icon: Search },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "CRM", url: "/crm", icon: Kanban },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { signOut, profile } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary glow-sm">
            <Zap className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sm tracking-tight text-foreground">
              Vendas AI
            </span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Sales Intelligence</p>
          </div>
        </div>
      </SidebarHeader>

      <Separator className="mx-4 w-auto opacity-50" />

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} className="h-10 rounded-xl">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/80 transition-all duration-200"
                      activeClassName="bg-primary/10 text-primary font-semibold glow-sm"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-[13px]">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-xl glass-subtle group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-primary-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-semibold truncate">{profile?.full_name || "Usuário"}</p>
            <p className="text-[10px] text-muted-foreground truncate">Admin</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
