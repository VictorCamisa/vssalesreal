import { Search } from "lucide-react";

export default function Prospecting() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          Prospecção
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Geração de demanda via Web Scraping e WhatsApp
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-border/50 p-12 text-center text-muted-foreground">
        Configure suas integrações em Configurações para começar a prospectar.
      </div>
    </div>
  );
}
