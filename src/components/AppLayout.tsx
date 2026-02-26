import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Smartphone, Users, Search, Send,
  Kanban, Calendar, Brain, Building2
} from "lucide-react";

const PAGE_META: Record<string, { title: string; icon: any }> = {
  "/": { title: "Dashboard", icon: LayoutDashboard },
  "/whatsapp": { title: "WhatsApp", icon: Smartphone },
  "/leads": { title: "Leads", icon: Users },
  "/prospecting": { title: "Prospecção", icon: Search },
  "/broadcasts": { title: "Disparos", icon: Send },
  "/crm": { title: "CRM Pipeline", icon: Kanban },
  "/ai": { title: "Agente IA", icon: Brain },
  "/company": { title: "Empresa", icon: Building2 },
  "/appointments": { title: "Agendamentos", icon: Calendar },
};

export function AppLayout() {
  const location = useLocation();
  const { profile } = useAuth();
  const meta = PAGE_META[location.pathname];
  const PageIcon = meta?.icon;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex h-12 sm:h-11 items-center justify-between border-b border-border/50 px-3 sm:px-4 shrink-0 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-7 sm:w-7" />
              {meta && (
                <div className="flex items-center gap-1.5 sm:gap-2 text-sm">
                  <span className="text-muted-foreground/40 hidden sm:inline">/</span>
                  {PageIcon && <PageIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />}
                  <span className="font-medium text-foreground/80 text-xs sm:text-sm">{meta.title}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <div className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-primary/10 text-[11px] sm:text-[10px] font-semibold text-primary">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-3 sm:p-5">
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
