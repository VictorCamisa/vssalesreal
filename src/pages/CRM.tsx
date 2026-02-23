import { Kanban } from "lucide-react";

export default function CRM() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Kanban className="h-6 w-6 text-primary" />
          CRM Pipeline
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão de oportunidades com Kanban drag-and-drop
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-border/50 p-12 text-center text-muted-foreground">
        O Kanban será implementado na próxima fase com drag-and-drop.
      </div>
    </div>
  );
}
