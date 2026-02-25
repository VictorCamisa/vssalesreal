import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Kanban, Loader2, GripVertical, Plus, Settings, Trash2, Edit,
  Eye, MoreVertical, Phone, Mail, Sparkles, BarChart3, Target,
  DollarSign, Percent, X, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

type Stage = { id: string; name: string; stage_order: number };
type Opportunity = {
  id: string;
  stage_id: string;
  value: number | null;
  probability: number | null;
  notes: string | null;
  lead_id: string;
  lead: { name: string | null; phone: string | null; email: string | null; enrichment_data: any } | null;
};

export default function CRM() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  // Stage management
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  // Opportunity detail
  const [detailOpp, setDetailOpp] = useState<Opportunity | null>(null);
  const [editingOpp, setEditingOpp] = useState(false);
  const [oppValue, setOppValue] = useState("");
  const [oppProbability, setOppProbability] = useState("");
  const [oppNotes, setOppNotes] = useState("");

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    const [stagesRes, oppsRes] = await Promise.all([
      supabase.from("crm_stages").select("id, name, stage_order").eq("org_id", profile.org_id).order("stage_order"),
      supabase.from("opportunities").select("id, stage_id, value, probability, notes, lead_id, lead:leads_raw(name, phone, email, enrichment_data)").eq("org_id", profile.org_id),
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

  const getOppsByStage = (stageId: string) => opportunities.filter((o) => o.stage_id === stageId);
  const stageTotal = (stageId: string) => getOppsByStage(stageId).reduce((sum, o) => sum + (o.value || 0), 0);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStageId = destination.droppableId;
    setOpportunities((prev) => prev.map((o) => (o.id === draggableId ? { ...o, stage_id: newStageId } : o)));
    const { error } = await supabase.from("opportunities").update({ stage_id: newStageId }).eq("id", draggableId);
    if (error) { toast({ title: "Erro ao mover", description: error.message, variant: "destructive" }); fetchData(); }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Stage CRUD
  const addStage = async () => {
    if (!profile?.org_id || !newStageName.trim()) return;
    const nextOrder = stages.length > 0 ? Math.max(...stages.map(s => s.stage_order)) + 1 : 0;
    const { error } = await supabase.from("crm_stages").insert({
      name: newStageName.trim(), stage_order: nextOrder, org_id: profile.org_id,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Estágio criado!" });
    setNewStageName("");
    fetchData();
  };

  const updateStage = async () => {
    if (!editingStage || !newStageName.trim()) return;
    const { error } = await supabase.from("crm_stages").update({ name: newStageName.trim() }).eq("id", editingStage.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Estágio atualizado!" });
    setEditingStage(null); setNewStageName("");
    fetchData();
  };

  const deleteStage = async (stageId: string) => {
    const opps = getOppsByStage(stageId);
    if (opps.length > 0) {
      toast({ title: "Não é possível excluir", description: "Mova ou exclua as oportunidades deste estágio primeiro.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("crm_stages").delete().eq("id", stageId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Estágio excluído!" });
    fetchData();
  };

  // Opportunity update
  const saveOppDetails = async () => {
    if (!detailOpp) return;
    const { error } = await supabase.from("opportunities").update({
      value: oppValue ? parseFloat(oppValue) : null,
      probability: oppProbability ? parseInt(oppProbability) : null,
      notes: oppNotes || null,
    }).eq("id", detailOpp.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Oportunidade atualizada!" });
    setEditingOpp(false);
    fetchData();
  };

  const deleteOpp = async (oppId: string) => {
    const { error } = await supabase.from("opportunities").delete().eq("id", oppId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Oportunidade excluída!" });
    setDetailOpp(null);
    fetchData();
  };

  const openOppDetail = (opp: Opportunity) => {
    setDetailOpp(opp);
    setOppValue(opp.value?.toString() || "");
    setOppProbability(opp.probability?.toString() || "");
    setOppNotes(opp.notes || "");
    setEditingOpp(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const totalValue = opportunities.reduce((sum, o) => sum + (o.value || 0), 0);
  const avgProbability = opportunities.length > 0
    ? Math.round(opportunities.reduce((sum, o) => sum + (o.probability || 0), 0) / opportunities.length)
    : 0;

  const stageColors = [
    "border-t-primary/60", "border-t-chart-4/60", "border-t-warning/60",
    "border-t-success/60", "border-t-destructive/60",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => { setStageDialogOpen(true); setEditingStage(null); setNewStageName(""); }}>
            <Settings className="h-4 w-4" /> Gerenciar Estágios
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Oportunidades", value: opportunities.length, icon: Target, color: "text-primary" },
          { label: "Valor Total", value: formatCurrency(totalValue), icon: DollarSign, color: "text-success" },
          { label: "Prob. Média", value: `${avgProbability}%`, icon: Percent, color: "text-chart-4" },
          { label: "Estágios", value: stages.length, icon: BarChart3, color: "text-warning" },
        ].map(m => (
          <div key={m.label} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{m.label}</p>
                <p className="text-xl font-bold mt-1">{m.value}</p>
              </div>
              <m.icon className={`h-5 w-5 ${m.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      {stages.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Kanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Nenhum estágio configurado</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Crie estágios para montar seu pipeline de vendas.</p>
          <Button onClick={() => { setStageDialogOpen(true); setEditingStage(null); setNewStageName(""); }} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> Criar Estágios
          </Button>
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
                        <span className="text-[10px] text-muted-foreground font-mono">{formatCurrency(stageTotal(stage.id))}</span>
                      )}
                    </div>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={`min-h-[200px] space-y-2.5 rounded-2xl border-t-2 p-3 transition-all duration-200 ${stageColors[idx % stageColors.length]} ${
                          snapshot.isDraggingOver ? "bg-primary/5 border border-primary/20" : "glass-subtle"
                        }`}>
                        {stageOpps.map((opp, index) => (
                          <Draggable key={opp.id} draggableId={opp.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                <div className={`glass rounded-xl p-3.5 space-y-2 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                                  snapshot.isDragging ? "shadow-xl ring-1 ring-primary/30 scale-[1.02]" : "hover:border-primary/20"
                                }`}
                                  onClick={() => openOppDetail(opp)}>
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm font-semibold leading-tight">{opp.lead?.name || "Lead sem nome"}</p>
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                                  </div>
                                  {opp.lead?.phone && (
                                    <p className="text-[11px] text-muted-foreground font-mono">{opp.lead.phone}</p>
                                  )}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {opp.value ? (
                                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 rounded-md">
                                        {formatCurrency(opp.value)}
                                      </Badge>
                                    ) : null}
                                    {opp.probability ? (
                                      <Badge variant="outline" className="text-[10px] rounded-md">{opp.probability}%</Badge>
                                    ) : null}
                                    {opp.lead?.enrichment_data && Object.keys(opp.lead.enrichment_data).length > 1 && (
                                      <Sparkles className="h-3 w-3 text-chart-4" />
                                    )}
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

      {/* Stage Management Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="sm:max-w-md glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Gerenciar Estágios
            </DialogTitle>
            <DialogDescription>Adicione, edite ou remova estágios do pipeline.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add/Edit form */}
            <div className="flex gap-2">
              <Input value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="Nome do estágio"
                className="rounded-xl bg-secondary/30 border-border/30"
                onKeyDown={e => e.key === "Enter" && (editingStage ? updateStage() : addStage())} />
              <Button onClick={editingStage ? updateStage : addStage} disabled={!newStageName.trim()} className="rounded-xl shrink-0">
                {editingStage ? "Salvar" : <><Plus className="h-4 w-4 mr-1" />Criar</>}
              </Button>
              {editingStage && (
                <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => { setEditingStage(null); setNewStageName(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Stages list */}
            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div key={stage.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${
                      ["bg-primary", "bg-chart-4", "bg-warning", "bg-success", "bg-destructive"][idx % 5]
                    }`} />
                    <span className="text-sm font-medium">{stage.name}</span>
                    <Badge variant="outline" className="text-[10px] rounded-md">{getOppsByStage(stage.id).length}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                      onClick={() => { setEditingStage(stage); setNewStageName(stage.name); }}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
                      onClick={() => deleteStage(stage.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Opportunity Detail Dialog */}
      <Dialog open={!!detailOpp} onOpenChange={() => setDetailOpp(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {detailOpp?.lead?.name || "Oportunidade"}
            </DialogTitle>
          </DialogHeader>

          {detailOpp && (
            <div className="space-y-4">
              {/* Lead info */}
              <div className="glass rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato do Lead</h4>
                {detailOpp.lead?.phone && <p className="text-sm flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{detailOpp.lead.phone}</p>}
                {detailOpp.lead?.email && <p className="text-sm flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{detailOpp.lead.email}</p>}
                {detailOpp.lead?.enrichment_data?.company && <p className="text-sm flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" />{detailOpp.lead.enrichment_data.company}</p>}
              </div>

              {/* Opportunity data */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Oportunidade</h4>
                  <Button variant="ghost" size="sm" className="rounded-lg h-7 text-xs"
                    onClick={() => setEditingOpp(!editingOpp)}>
                    <Edit className="h-3 w-3 mr-1" />{editingOpp ? "Cancelar" : "Editar"}
                  </Button>
                </div>

                {editingOpp ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input value={oppValue} onChange={e => setOppValue(e.target.value)} type="number" placeholder="10000"
                          className="rounded-xl bg-secondary/30 border-border/30" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Probabilidade (%)</Label>
                        <Input value={oppProbability} onChange={e => setOppProbability(e.target.value)} type="number" placeholder="50" min="0" max="100"
                          className="rounded-xl bg-secondary/30 border-border/30" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Observações</Label>
                      <Textarea value={oppNotes} onChange={e => setOppNotes(e.target.value)} rows={3}
                        placeholder="Anotações sobre esta oportunidade..." className="rounded-xl bg-secondary/30 border-border/30 resize-none" />
                    </div>
                    <Button onClick={saveOppDetails} className="rounded-xl w-full gap-2">
                      Salvar Alterações
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="glass rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor</p>
                        <p className="text-lg font-bold text-success mt-0.5">
                          {detailOpp.value ? formatCurrency(detailOpp.value) : "—"}
                        </p>
                      </div>
                      <div className="glass rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Probabilidade</p>
                        <p className="text-lg font-bold mt-0.5">
                          {detailOpp.probability ? `${detailOpp.probability}%` : "—"}
                        </p>
                      </div>
                    </div>
                    {detailOpp.notes && (
                      <div className="glass rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                        <p className="text-sm text-muted-foreground">{detailOpp.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Enrichment preview */}
              {detailOpp.lead?.enrichment_data && Object.keys(detailOpp.lead.enrichment_data).length > 1 && (
                <div className="glass rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-chart-4" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enriquecimento IA</h4>
                  </div>
                  {detailOpp.lead.enrichment_data.score && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="text-xl font-bold text-primary font-mono">{detailOpp.lead.enrichment_data.score}</div>
                      <p className="text-xs">Score de Qualificação</p>
                    </div>
                  )}
                  {detailOpp.lead.enrichment_data.segment && <p className="text-sm"><strong>Segmento:</strong> {detailOpp.lead.enrichment_data.segment}</p>}
                  {detailOpp.lead.enrichment_data.role && <p className="text-sm"><strong>Cargo:</strong> {detailOpp.lead.enrichment_data.role}</p>}
                </div>
              )}

              {/* Delete */}
              <Button variant="destructive" size="sm" className="rounded-xl gap-2 w-full" onClick={() => deleteOpp(detailOpp.id)}>
                <Trash2 className="h-4 w-4" /> Excluir Oportunidade
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
