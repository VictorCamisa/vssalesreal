import {
  LayoutDashboard, Search, Users, Kanban, LogOut, Brain,
  Smartphone, Send, Building2, Calendar,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
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

export function AppSidebar() {
  const { signOut, profile } = useAuth();

  const renderNav = (items: typeof mainNav) => (
    <SidebarMenu className="space-y-0.5">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild tooltip={item.title} className="h-8">
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-2.5 px-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150 text-[13px]"
              activeClassName="bg-primary/10 text-primary font-medium !text-primary"
            >
              <item.icon className="h-[15px] w-[15px] shrink-0" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <img src={vsLogo} alt="VS SALES" className="h-7 w-auto shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[13px] font-semibold text-foreground leading-none">VS SALES</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 tracking-wider uppercase">Soluções</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium px-2.5 mb-0.5">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNav(mainNav)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3">
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium px-2.5 mb-0.5">
            Ferramentas
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNav(toolsNav)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1">
              <p className="text-[11px] font-medium truncate">{profile?.full_name || "Usuário"}</p>
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
