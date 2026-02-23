import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Kanban, Loader2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

type Stage = { id: string; name: string; stage_order: number };
type Opportunity = {
  id: string;
  stage_id: string;
  value: number | null;
  probability: number | null;
  notes: string | null;
  lead: { name: string | null; phone: string | null; email: string | null } | null;
};

export default function CRM() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    const [stagesRes, oppsRes] = await Promise.all([
      supabase
        .from("crm_stages")
        .select("id, name, stage_order")
        .eq("org_id", profile.org_id)
        .order("stage_order"),
      supabase
        .from("opportunities")
        .select("id, stage_id, value, probability, notes, lead:leads_raw(name, phone, email)")
        .eq("org_id", profile.org_id),
    ]);
    setStages(stagesRes.data ?? []);
    setOpportunities(
      (oppsRes.data ?? []).map((o: any) => ({
        ...o,
        lead: Array.isArray(o.lead) ? o.lead[0] || null : o.lead,
      }))
    );
    setLoading(false);
  }, [profile?.org_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getOppsByStage = (stageId: string) =>
    opportunities.filter((o) => o.stage_id === stageId);

  const stageTotal = (stageId: string) =>
    getOppsByStage(stageId).reduce((sum, o) => sum + (o.value || 0), 0);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStageId = destination.droppableId;

    setOpportunities((prev) =>
      prev.map((o) => (o.id === draggableId ? { ...o, stage_id: newStageId } : o))
    );

    const { error } = await supabase
      .from("opportunities")
      .update({ stage_id: newStageId })
      .eq("id", draggableId);

    if (error) {
      toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
      fetchData();
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const stageColors = [
    "border-t-primary/60",
    "border-t-chart-4/60", 
    "border-t-warning/60",
    "border-t-success/60",
    "border-t-destructive/60",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Kanban className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM Pipeline</h1>
          <p className="text-muted-foreground text-sm">
            {opportunities.length} oportunidades em {stages.length} estágios
          </p>
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          Nenhum estágio configurado. Crie estágios no onboarding ou configurações.
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
            {stages.map((stage, idx) => {
              const stageOpps = getOppsByStage(stage.id);
              return (
                <div key={stage.id} className="flex-shrink-0 w-72">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold">{stage.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] rounded-md font-medium">{stageOpps.length}</Badge>
                      {stageTotal(stage.id) > 0 && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatCurrency(stageTotal(stage.id))}
                        </span>
                      )}
                    </div>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] space-y-2.5 rounded-2xl border-t-2 p-3 transition-all duration-200 ${stageColors[idx % stageColors.length]} ${
                          snapshot.isDraggingOver
                            ? "bg-primary/5 border border-primary/20"
                            : "glass-subtle"
                        }`}
                      >
                        {stageOpps.map((opp, index) => (
                          <Draggable key={opp.id} draggableId={opp.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <div
                                  className={`glass rounded-xl p-3.5 space-y-2 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                                    snapshot.isDragging ? "shadow-xl ring-1 ring-primary/30 scale-[1.02]" : "hover:border-primary/20"
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm font-semibold leading-tight">
                                      {opp.lead?.name || "Lead sem nome"}
                                    </p>
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                                  </div>
                                  {opp.lead?.phone && (
                                    <p className="text-[11px] text-muted-foreground font-mono">
                                      {opp.lead.phone}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {opp.value ? (
                                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 rounded-md">
                                        {formatCurrency(opp.value)}
                                      </Badge>
                                    ) : null}
                                    {opp.probability ? (
                                      <Badge variant="outline" className="text-[10px] rounded-md">
                                        {opp.probability}%
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {opp.notes && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">{opp.notes}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
