import { useState } from "react";
import { LogOut, Menu, X, ChevronDown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { useAuth } from "@/contexts/AuthContext";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { allNavItems } from "@/lib/navigation";

export function AppNavbar() {
  const { signOut, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 sm:px-6 gap-4">
        {/* Mobile */}
        <div className="lg:hidden flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="h-8 w-8"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <NavLink to="/" className="flex items-center gap-2">
            <img src={vsLogo} alt="VS" className="h-6 w-6 rounded" />
            <span className="text-sm font-bold">VS Sales</span>
          </NavLink>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-accent transition-colors outline-none">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
                  {profile?.full_name?.split(" ")[0] || "Usuário"}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{profile?.full_name || "Usuário"}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm">Onboarding</span>
                  <OnboardingDialog />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 pt-14" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <nav
            className="relative w-72 h-full bg-background border-r border-border overflow-y-auto animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 space-y-0.5">
              {allNavItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  activeClassName="!text-primary !bg-primary/10 font-medium"
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
