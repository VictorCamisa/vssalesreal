import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { ModuleNavbar } from "@/components/ModuleNavbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { findCurrentModule } from "@/lib/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppLayout() {
  const { pathname } = useLocation();
  const currentModule = findCurrentModule(pathname);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Module sub-nav or minimal top bar */}
            {currentModule ? (
              <ModuleNavbar module={currentModule} currentPath={pathname} />
            ) : (
              <header className="sticky top-0 z-40 h-11 border-b border-border/50 bg-background/95 backdrop-blur-sm flex items-center justify-end px-4 gap-2">
                <ThemeToggle />
              </header>
            )}

            <main className="flex-1 w-full overflow-x-hidden">
              <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 animate-fade-in">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
