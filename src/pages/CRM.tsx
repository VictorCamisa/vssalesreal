import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Kanban, Loader2, GripVertical, Plus, Trash2, Edit,
  Phone, Mail, Sparkles, BarChart3, Target,
  DollarSign, Percent, X, Users, Bot, Zap,
  UserCheck, Headphones, Briefcase, Eye, Filter,
  ArrowRight, CheckCircle2, XCircle, Calendar,
  MessageSquare, Search as SearchIcon, TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

// ─── Pipeline Definition ───────────────────────────────────────────
const PIPELINE_STAGES = [
  {
    key: "lead",
    name: "Lead",
    icon: Users,
    color: "bg-muted-foreground",
    borderColor: "border-t-muted-foreground/60",
    roles: ["sdr"],
    aiTemplate: null,
    description: "Leads recém-capturados, sem contato",
  },
  {
    key: "enriched",
    name: "Enriquecidas",
    icon: Sparkles,
    color: "bg-chart-4",
    borderColor: "border-t-chart-4/60",
    roles: ["sdr"],
    aiTemplate: "Pesquisa & Qualificação",
    aiHint: "Pesquisa sobre a empresa, cargo e dados públicos para preparar abordagem.",
    description: "Leads com dados enriquecidos pela IA",
  },
  {
    key: "contacted",
    name: "Contato Feito",
    icon: MessageSquare,
    color: "bg-primary",
    borderColor: "border-t-primary/60",
    roles: ["sdr"],
    aiTemplate: "SDR — BANT",
    aiHint: "Qualificação rápida: Budget, Authority, Need, Timeline. Identificar se há fit.",
    description: "Primeiro contato realizado",
  },
  {
    key: "prospecting",
    name: "Em Prospecção",
    icon: SearchIcon,
    color: "bg-chart-4",
    borderColor: "border-t-chart-4/60",
    roles: ["sdr", "bdr"],
    aiTemplate: "BDR — SPIN Selling",
    aiHint: "Perguntas de Situação, Problema, Implicação e Necessidade para aprofundar dor.",
    description: "Em cadência ativa de prospecção",
  },
  {
    key: "qualified",
    name: "Qualificado",
    icon: CheckCircle2,
    color: "bg-success",
    borderColor: "border-t-success/60",
    roles: ["bdr"],
    aiTemplate: "BDR — MEDDIC",
    aiHint: "Metrics, Economic Buyer, Decision Criteria/Process, Identify Pain, Champion.",
    description: "Lead qualificado e com interesse confirmado",
  },
  {
    key: "scheduled",
    name: "Agendado",
    icon: Calendar,
    color: "bg-warning",
    borderColor: "border-t-warning/60",
    roles: ["bdr", "closer"],
    aiTemplate: "Prep de Reunião",
    aiHint: "Preparar pauta, pesquisar empresa, montar proposta de valor personalizada.",
    description: "Reunião ou demo agendada",
  },
  {
    key: "proposal",
    name: "Reunião / Proposta",
    icon: Briefcase,
    color: "bg-primary",
    borderColor: "border-t-primary/60",
    roles: ["closer"],
    aiTemplate: "Closer — LAER + Negociação",
    aiHint: "Listen, Acknowledge, Explore, Respond. Técnicas de fechamento e tratamento de objeções.",
    description: "Proposta apresentada, em negociação",
  },
  {
    key: "won",
    name: "Ganho",
    icon: TrendingUp,
    color: "bg-success",
    borderColor: "border-t-success/60",
    roles: ["closer", "cs"],
    aiTemplate: "CS — Onboarding",
    aiHint: "Plano de onboarding, setup inicial, primeiros marcos de sucesso.",
    description: "Deal fechado — cliente convertido!",
  },
  {
    key: "lost",
    name: "Perdido",
    icon: XCircle,
    color: "bg-destructive",
    borderColor: "border-t-destructive/60",
    roles: ["closer"],
    aiTemplate: "Win-Back",
    aiHint: "Análise de motivo de perda. Cadência de reativação em 30/60/90 dias.",
    description: "Oportunidade perdida",
  },
];

const VIEW_TABS = [
  { key: "all", label: "Visão Geral", icon: Eye, stageFilter: null },
  { key: "sdr", label: "SDR", icon: Zap, stageFilter: "sdr" },
  { key: "bdr", label: "BDR", icon: UserCheck, stageFilter: "bdr" },
  { key: "closer", label: "Closer", icon: Target, stageFilter: "closer" },
  { key: "cs", label: "CS", icon: Headphones, stageFilter: "cs" },
];

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
  const [activeView, setActiveView] = useState("all");
  const [aiConfigDialog, setAiConfigDialog] = useState<typeof PIPELINE_STAGES[0] | null>(null);

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
    
    let currentStages = stagesRes.data ?? [];
    
    // Auto-seed pipeline if no stages exist
    if (currentStages.length === 0) {
      const stagesToInsert = PIPELINE_STAGES.map((s, i) => ({
        org_id: profile.org_id!,
        name: s.name,
        stage_order: i,
      }));
      const { data: newStages } = await supabase.from("crm_stages").insert(stagesToInsert).select("id, name, stage_order").order("stage_order");
      currentStages = newStages ?? [];
    }
    
    setStages(currentStages);
    setOpportunities(
      (oppsRes.data ?? []).map((o: any) => ({
        ...o,
        lead: Array.isArray(o.lead) ? o.lead[0] || null : o.lead,
      }))
    );
    setLoading(false);
  }, [profile?.org_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Map DB stages to pipeline definition by order
  const stageMap = useMemo(() => {
    const map = new Map<string, typeof PIPELINE_STAGES[0]>();
    stages.forEach((s, i) => {
      if (i < PIPELINE_STAGES.length) {
        map.set(s.id, PIPELINE_STAGES[i]);
      }
    });
    return map;
  }, [stages]);

  // Filter stages based on active view
  const visibleStages = useMemo(() => {
    const tab = VIEW_TABS.find(t => t.key === activeView);
    if (!tab?.stageFilter) return stages;
    return stages.filter(s => {
      const def = stageMap.get(s.id);
      return def?.roles.includes(tab.stageFilter!);
    });
  }, [stages, activeView, stageMap]);

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

  // Stats per view
  const viewOpps = useMemo(() => {
    const visibleIds = new Set(visibleStages.map(s => s.id));
    return opportunities.filter(o => visibleIds.has(o.stage_id));
  }, [opportunities, visibleStages]);

  const totalValue = viewOpps.reduce((sum, o) => sum + (o.value || 0), 0);
  const avgProbability = viewOpps.length > 0
    ? Math.round(viewOpps.reduce((sum, o) => sum + (o.probability || 0), 0) / viewOpps.length)
    : 0;

  // Conversion rate: leads that reached "won"
  const wonStage = stages.find((_, i) => PIPELINE_STAGES[i]?.key === "won");
  const wonCount = wonStage ? getOppsByStage(wonStage.id).length : 0;
  const conversionRate = opportunities.length > 0 ? Math.round((wonCount / opportunities.length) * 100) : 0;

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Kanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">CRM Pipeline</h1>
              <p className="text-muted-foreground text-sm">
                {opportunities.length} oportunidades · {conversionRate}% conversão
              </p>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
          <TabsList className="w-full justify-start gap-1 bg-secondary/30 rounded-xl p-1 h-auto flex-wrap">
            {VIEW_TABS.map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="rounded-lg gap-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2"
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.stageFilter && (
                  <Badge variant="outline" className="text-[9px] rounded-md ml-1 h-4 min-w-4 px-1">
                    {stages.filter(s => {
                      const def = stageMap.get(s.id);
                      return def?.roles.includes(tab.stageFilter!);
                    }).reduce((sum, s) => sum + getOppsByStage(s.id).length, 0)}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Oportunidades", value: viewOpps.length, icon: Target, color: "text-primary" },
            { label: "Valor Total", value: formatCurrency(totalValue), icon: DollarSign, color: "text-success" },
            { label: "Prob. Média", value: `${avgProbability}%`, icon: Percent, color: "text-chart-4" },
            { label: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-warning" },
          ].map(m => (
            <div key={m.label} className="glass rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{m.label}</p>
                  <p className="text-lg font-bold mt-0.5">{m.value}</p>
                </div>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
            {visibleStages.map((stage) => {
              const stageOpps = getOppsByStage(stage.id);
              const def = stageMap.get(stage.id);
              const StageIcon = def?.icon || Target;
              
              return (
                <div key={stage.id} className="flex-shrink-0 w-[260px]">
                  {/* Stage Header */}
                  <div className="mb-2 px-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-5 w-5 rounded-md flex items-center justify-center ${def?.color || "bg-muted"}`}>
                          <StageIcon className="h-3 w-3 text-white" />
                        </div>
                        <h3 className="text-xs font-bold truncate">{stage.name}</h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] rounded-md font-medium h-4 min-w-4 px-1">
                          {stageOpps.length}
                        </Badge>
                        {def?.aiTemplate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setAiConfigDialog(def)}
                                className="h-5 w-5 rounded-md flex items-center justify-center bg-chart-4/15 hover:bg-chart-4/25 transition-colors"
                              >
                                <Bot className="h-3 w-3 text-chart-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-52">
                              <p className="font-semibold">{def.aiTemplate}</p>
                              <p className="text-muted-foreground">{def.aiHint}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    {stageTotal(stage.id) > 0 && (
                      <p className="text-[10px] text-muted-foreground font-mono pl-6">{formatCurrency(stageTotal(stage.id))}</p>
                    )}
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={`min-h-[180px] space-y-2 rounded-xl border-t-2 p-2.5 transition-all duration-200 ${def?.borderColor || "border-t-muted/60"} ${
                          snapshot.isDraggingOver ? "bg-primary/5 border border-primary/20" : "glass-subtle"
                        }`}>
                        {stageOpps.map((opp, index) => (
                          <Draggable key={opp.id} draggableId={opp.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                <div className={`glass rounded-xl p-3 space-y-1.5 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                                  snapshot.isDragging ? "shadow-xl ring-1 ring-primary/30 scale-[1.02]" : "hover:border-primary/20"
                                }`}
                                  onClick={() => openOppDetail(opp)}>
                                  <div className="flex items-start justify-between">
                                    <p className="text-xs font-semibold leading-tight truncate">{opp.lead?.name || "Lead sem nome"}</p>
                                    <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                                  </div>
                                  {opp.lead?.phone && (
                                    <p className="text-[10px] text-muted-foreground font-mono truncate">{opp.lead.phone}</p>
                                  )}
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {opp.value ? (
                                      <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/20 rounded-md h-4 px-1">
                                        {formatCurrency(opp.value)}
                                      </Badge>
                                    ) : null}
                                    {opp.probability ? (
                                      <Badge variant="outline" className="text-[9px] rounded-md h-4 px-1">{opp.probability}%</Badge>
                                    ) : null}
                                    {opp.lead?.enrichment_data && Object.keys(opp.lead.enrichment_data).length > 1 && (
                                      <Sparkles className="h-2.5 w-2.5 text-chart-4" />
                                    )}
                                  </div>
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

        {/* AI Config Dialog */}
        <Dialog open={!!aiConfigDialog} onOpenChange={() => setAiConfigDialog(null)}>
          <DialogContent className="sm:max-w-md glass border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-chart-4" />
                IA — {aiConfigDialog?.name}
              </DialogTitle>
              <DialogDescription>{aiConfigDialog?.description}</DialogDescription>
            </DialogHeader>
            {aiConfigDialog && (
              <div className="space-y-4">
                <div className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${aiConfigDialog.color}`}>
                      <aiConfigDialog.icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{aiConfigDialog.aiTemplate}</p>
                      <p className="text-[11px] text-muted-foreground">Template automático para este estágio</p>
                    </div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiConfigDialog.aiHint}</p>
                  </div>
                </div>

                <div className="glass rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Papéis com acesso</h4>
                  <div className="flex gap-2 flex-wrap">
                    {aiConfigDialog.roles.map(role => (
                      <Badge key={role} className="rounded-md text-[10px] uppercase font-bold tracking-wider">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Como funciona</h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      Quando um lead entra neste estágio, a IA automaticamente usa o template <strong>{aiConfigDialog.aiTemplate}</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      As respostas via WhatsApp seguirão a estratégia definida
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      O contexto da empresa é injetado automaticamente no prompt
                    </li>
                  </ul>
                </div>
              </div>
            )}
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
              {detailOpp && (
                <DialogDescription>
                  {(() => {
                    const def = stageMap.get(detailOpp.stage_id);
                    return def ? `Estágio: ${def.name}` : "";
                  })()}
                </DialogDescription>
              )}
            </DialogHeader>

            {detailOpp && (
              <div className="space-y-4">
                {/* Current stage badge */}
                {(() => {
                  const def = stageMap.get(detailOpp.stage_id);
                  if (!def) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded-md flex items-center justify-center ${def.color}`}>
                        <def.icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-medium">{def.name}</span>
                      {def.aiTemplate && (
                        <Badge variant="outline" className="text-[9px] rounded-md gap-1">
                          <Bot className="h-2.5 w-2.5" /> {def.aiTemplate}
                        </Badge>
                      )}
                    </div>
                  );
                })()}

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
    </TooltipProvider>
  );
}
