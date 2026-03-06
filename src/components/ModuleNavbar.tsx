import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ModuleGroup } from "@/lib/navigation";

const moduleStyle: Record<string, { activeBg: string; activeText: string; activeBorder: string; dot: string }> = {
  "Comunicação": { activeBg: "bg-emerald-500/12", activeText: "text-emerald-400", activeBorder: "border-b-emerald-400", dot: "bg-emerald-400" },
  "Vendas": { activeBg: "bg-blue-500/12", activeText: "text-blue-400", activeBorder: "border-b-blue-400", dot: "bg-blue-400" },
  "Inteligência": { activeBg: "bg-violet-500/12", activeText: "text-violet-400", activeBorder: "border-b-violet-400", dot: "bg-violet-400" },
  "Configuração": { activeBg: "bg-orange-500/12", activeText: "text-orange-400", activeBorder: "border-b-orange-400", dot: "bg-orange-400" },
};

interface Props {
  module: ModuleGroup;
  currentPath: string;
}

export function ModuleNavbar({ module, currentPath }: Props) {
  const style = moduleStyle[module.label] || moduleStyle["Configuração"];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center h-11 px-4">
        {/* Module label */}
        <div className="flex items-center gap-2 shrink-0 mr-4">
          <module.icon className={`h-4 w-4 ${style.activeText}`} />
          <span className={`text-[13px] font-semibold ${style.activeText}`}>{module.label}</span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border/60 mr-3" />

        {/* Tabs */}
        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {module.items.map((item) => {
            const isActive = currentPath === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? `${style.activeBg} ${style.activeText} ${style.activeBorder}`
                    : "text-muted-foreground/60 border-b-transparent hover:text-foreground hover:bg-accent/50"
                }`}
                activeClassName=""
              >
                <item.icon className={`h-3.5 w-3.5 ${isActive ? style.activeText : ""}`} />
                <span>{item.title}</span>
                {isActive && <div className={`h-1.5 w-1.5 rounded-full ${style.dot} ml-0.5`} />}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1" />

        <ThemeToggle />
      </div>
    </header>
  );
}
