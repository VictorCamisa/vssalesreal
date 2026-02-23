import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Kanban, Loader2, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

    // Optimistic update
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Kanban className="h-6 w-6 text-primary" />
          CRM Pipeline
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão de oportunidades com Kanban — {opportunities.length} oportunidades
        </p>
      </div>

      {stages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 p-12 text-center text-muted-foreground">
          Nenhum estágio configurado. Crie estágios no onboarding ou configurações.
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageOpps = getOppsByStage(stage.id);
              return (
                <div key={stage.id} className="flex-shrink-0 w-72">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{stage.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{stageOpps.length}</Badge>
                      {stageTotal(stage.id) > 0 && (
                        <span className="text-xs text-muted-foreground">
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
                        className={`min-h-[200px] space-y-2 rounded-lg border p-2 transition-colors ${
                          snapshot.isDraggingOver
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/30 bg-secondary/20"
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
                                <Card
                                  className={`border-border/50 bg-card/90 transition-shadow ${
                                    snapshot.isDragging ? "shadow-lg ring-1 ring-primary/30" : ""
                                  }`}
                                >
                                  <CardContent className="p-3 space-y-2">
                                    <div className="flex items-start justify-between">
                                      <p className="text-sm font-medium leading-tight">
                                        {opp.lead?.name || "Lead sem nome"}
                                      </p>
                                      <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                    </div>
                                    {opp.lead?.phone && (
                                      <p className="text-xs text-muted-foreground font-mono">
                                        {opp.lead.phone}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2">
                                      {opp.value ? (
                                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                                          {formatCurrency(opp.value)}
                                        </Badge>
                                      ) : null}
                                      {opp.probability ? (
                                        <Badge variant="outline" className="text-xs">
                                          {opp.probability}%
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {opp.notes && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">{opp.notes}</p>
                                    )}
                                  </CardContent>
                                </Card>
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
