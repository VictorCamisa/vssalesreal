import { Outlet, useLocation } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";
import { AppSidebar } from "@/components/AppSidebar";
import { ModuleNavbar } from "@/components/ModuleNavbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { findCurrentModule } from "@/lib/navigation";

export function AppLayout() {
  const { pathname } = useLocation();
  const currentModule = findCurrentModule(pathname);
  const isDashboard = pathname === "/";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* Sidebar only on dashboard */}
        {isDashboard && <AppSidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Module navbar when inside a module, global navbar on dashboard */}
          {currentModule ? (
            <ModuleNavbar module={currentModule} currentPath={pathname} />
          ) : (
            <AppNavbar />
          )}

          <main className="flex-1 w-full overflow-x-hidden">
            <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
