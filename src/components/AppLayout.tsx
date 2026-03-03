import { Outlet } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";

export function AppLayout() {
  return (
    <div className="min-h-screen w-full bg-background">
      <AppNavbar />
      <main className="w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
