import { Outlet } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";

export function AppLayout() {
  return (
    <div className="min-h-screen w-full bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
