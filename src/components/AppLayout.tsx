import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/whatsapp": "Conexão WhatsApp",
  "/leads": "Meus Leads",
  "/prospecting": "Prospecção",
  "/broadcasts": "Disparos",
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
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex h-12 items-center justify-between border-b px-4 shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-medium text-foreground">{pageTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-6">
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
