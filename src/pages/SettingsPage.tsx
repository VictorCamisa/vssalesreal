import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie integrações e chaves de API
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-border/50 p-12 text-center text-muted-foreground">
        Módulo de configurações será implementado na próxima fase.
      </div>
    </div>
  );
}
