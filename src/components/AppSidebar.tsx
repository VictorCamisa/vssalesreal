import {
  LayoutDashboard,
  Search,
  Users,
  Kanban,
  Settings,
  LogOut,
  Brain,
  Smartphone,
  Send,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Conexão WhatsApp", url: "/whatsapp", icon: Smartphone },
  { title: "Meus Leads", url: "/leads", icon: Users },
  { title: "Prospecção", url: "/prospecting", icon: Search },
  { title: "Disparos", url: "/broadcasts", icon: Send },
];

const toolsNav = [
  { title: "CRM Pipeline", url: "/crm", icon: Kanban },
  { title: "Agente IA", url: "/ai", icon: Brain },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { signOut, profile } = useAuth();

  const renderNav = (items: typeof mainNav) => (
    <SidebarMenu className="space-y-0.5">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild tooltip={item.title} className="h-9">
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-3 px-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-[13px]"
              activeClassName="bg-primary/10 text-primary font-medium"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            VS
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-foreground leading-none">VS LEADS</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">por VS Soluções</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium px-3 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNav(mainNav)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium px-3 mb-1">
            Ferramentas
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNav(toolsNav)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary group-data-[collapsible=icon]:justify-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium truncate">{profile?.full_name || "Usuário"}</p>
              <OnboardingDialog />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
