import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/whatsapp": "Conexão WhatsApp",
  "/leads": "Meus Leads",
  "/prospecting": "Prospecção",
  "/crm": "CRM Pipeline",
  "/ai": "Agente IA",
  "/settings": "Configurações",
};

export function AppLayout() {
  const location = useLocation();
  const { profile } = useAuth();
  const pageTitle = PAGE_TITLES[location.pathname] || "";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full gradient-mesh">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center justify-between border-b border-border/30 px-6 shrink-0 backdrop-blur-sm bg-background/50">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-primary-foreground">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-6 lg:p-8">
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
