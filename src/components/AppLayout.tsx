import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full gradient-mesh">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center border-b border-border/30 px-6 shrink-0 backdrop-blur-sm bg-background/50">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
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
