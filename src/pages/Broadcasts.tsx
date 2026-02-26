import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Send, Play, Pause, Clock, Users, MessageCircle, Zap, Brain,
  Plus, Settings, ChevronRight, Loader2, BarChart3, Target, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type Campaign = {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  type: "manual" | "automated";
  channel: "whatsapp" | "email";
  totalLeads: number;
  sent: number;
  replied: number;
  converted: number;
  createdAt: string;
  aiEnabled: boolean;
};

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: "1", name: "Outbound Imobiliárias SP", status: "running", type: "automated", channel: "whatsapp", totalLeads: 150, sent: 87, replied: 34, converted: 8, createdAt: "2026-02-25", aiEnabled: true },
  { id: "2", name: "Follow-up Clínicas Médicas", status: "paused", type: "automated", channel: "whatsapp", totalLeads: 80, sent: 45, replied: 12, converted: 3, createdAt: "2026-02-24", aiEnabled: true },
  { id: "3", name: "Campanha Manual - Contadores", status: "completed", type: "manual", channel: "whatsapp", totalLeads: 50, sent: 50, replied: 22, converted: 6, createdAt: "2026-02-22", aiEnabled: false },
  { id: "4", name: "Re-engajamento Base Fria", status: "draft", type: "automated", channel: "whatsapp", totalLeads: 200, sent: 0, replied: 0, converted: 0, createdAt: "2026-02-26", aiEnabled: true },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Rascunho", color: "text-muted-foreground bg-secondary", icon: Settings },
  running: { label: "Ativo", color: "text-success bg-success/10", icon: Play },
  paused: { label: "Pausado", color: "text-warning bg-warning/10", icon: Pause },
  completed: { label: "Concluído", color: "text-primary bg-primary/10", icon: CheckCircle2 },
};

export default function Broadcasts() {
  const { profile } = useAuth();
  const [campaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);

  const totalSent = campaigns.reduce((a, c) => a + c.sent, 0);
  const totalReplied = campaigns.reduce((a, c) => a + c.replied, 0);
  const totalConverted = campaigns.reduce((a, c) => a + c.converted, 0);
  const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Disparos</h1>
          <p className="text-sm text-muted-foreground">Gerencie campanhas de disparo manual e automatizado</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setNewCampaignOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Nova Campanha
        </Button>
      </div>

      {/* Global AI Toggle */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Disparo Automático com IA</p>
              <p className="text-xs text-muted-foreground">A IA gerencia a cadência, follow-ups e qualificação automaticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={autoDispatch} onCheckedChange={setAutoDispatch} />
            <Badge variant="outline" className={`text-[10px] ${autoDispatch ? "bg-success/10 text-success border-success/30" : ""}`}>
              {autoDispatch ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Campanhas", value: campaigns.length, icon: Send, color: "text-primary" },
          { label: "Mensagens Enviadas", value: totalSent, icon: MessageCircle, color: "text-muted-foreground" },
          { label: "Taxa de Resposta", value: `${replyRate}%`, icon: BarChart3, color: "text-success" },
          { label: "Conversões", value: totalConverted, icon: Target, color: "text-warning" },
        ].map(m => (
          <div key={m.label} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </div>
            <p className="text-xl font-semibold">{m.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Campaigns */}
      <Tabs defaultValue="all">
        <TabsList className="bg-secondary h-8 p-0.5 rounded-lg gap-0.5">
          <TabsTrigger value="all" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">Todas</TabsTrigger>
          <TabsTrigger value="running" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">Ativas</TabsTrigger>
          <TabsTrigger value="automated" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">Automatizadas</TabsTrigger>
          <TabsTrigger value="manual" className="text-xs rounded-md px-3 h-7 data-[state=active]:bg-card data-[state=active]:shadow-sm">Manuais</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-2">
          {campaigns.map(campaign => {
            const cfg = statusConfig[campaign.status];
            const StatusIcon = cfg.icon;
            const progress = campaign.totalLeads > 0 ? (campaign.sent / campaign.totalLeads) * 100 : 0;
            return (
              <div key={campaign.id} className="border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{campaign.name}</p>
                      <Badge variant="secondary" className={`text-[10px] gap-1 ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" />{cfg.label}
                      </Badge>
                      {campaign.aiEnabled && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                          <Brain className="h-3 w-3" />IA
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{campaign.type === "automated" ? "Auto" : "Manual"}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{campaign.totalLeads} leads</span>
                      <span className="flex items-center gap-1"><Send className="h-3 w-3" />{campaign.sent} enviadas</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{campaign.replied} respostas</span>
                      <span className="flex items-center gap-1"><Target className="h-3 w-3" />{campaign.converted} conversões</span>
                    </div>
                    {campaign.status === "running" && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 max-w-xs h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{progress.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {campaign.status === "running" && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Pause className="h-3 w-3" />Pausar</Button>
                    )}
                    {campaign.status === "paused" && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1"><Play className="h-3 w-3" />Retomar</Button>
                    )}
                    {campaign.status === "draft" && (
                      <Button size="sm" className="text-xs h-7 gap-1"><Play className="h-3 w-3" />Iniciar</Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="running" className="mt-4 space-y-2">
          {campaigns.filter(c => c.status === "running").map(campaign => {
            const cfg = statusConfig[campaign.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={campaign.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{campaign.name}</p>
                  <Badge variant="secondary" className={`text-[10px] gap-1 ${cfg.color}`}><StatusIcon className="h-3 w-3" />{cfg.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{campaign.sent}/{campaign.totalLeads} enviadas • {campaign.replied} respostas</p>
              </div>
            );
          })}
          {campaigns.filter(c => c.status === "running").length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma campanha ativa</p>
          )}
        </TabsContent>

        <TabsContent value="automated" className="mt-4 space-y-2">
          {campaigns.filter(c => c.type === "automated").map(campaign => {
            const cfg = statusConfig[campaign.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={campaign.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{campaign.name}</p>
                  <Badge variant="secondary" className={`text-[10px] gap-1 ${cfg.color}`}><StatusIcon className="h-3 w-3" />{cfg.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{campaign.sent}/{campaign.totalLeads} enviadas</p>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="manual" className="mt-4 space-y-2">
          {campaigns.filter(c => c.type === "manual").map(campaign => {
            const cfg = statusConfig[campaign.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={campaign.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{campaign.name}</p>
                  <Badge variant="secondary" className={`text-[10px] gap-1 ${cfg.color}`}><StatusIcon className="h-3 w-3" />{cfg.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{campaign.sent}/{campaign.totalLeads} enviadas</p>
              </div>
            );
          })}
          {campaigns.filter(c => c.type === "manual").length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma campanha manual</p>
          )}
        </TabsContent>
      </Tabs>

      {/* New Campaign Dialog */}
      <Dialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Nova Campanha de Disparo</DialogTitle>
            <DialogDescription className="text-xs">Configure os detalhes da campanha</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Campanha</Label>
              <Input placeholder="Ex: Outbound Imobiliárias SP" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select defaultValue="automated">
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automated">Automatizada (IA gerencia)</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Origem dos Leads</Label>
              <Select defaultValue="all">
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os leads pendentes</SelectItem>
                  <SelectItem value="web">Prospecção Web</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="import">Importação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem Inicial (opcional)</Label>
              <Textarea placeholder="A IA pode gerar automaticamente..." rows={3} className="text-sm resize-none" />
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <p className="text-xs font-medium">Agente IA</p>
                <p className="text-[10px] text-muted-foreground">IA qualifica e faz follow-up</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewCampaignOpen(false)} className="text-xs">Cancelar</Button>
            <Button size="sm" onClick={() => setNewCampaignOpen(false)} className="text-xs gap-1"><Zap className="h-3.5 w-3.5" />Criar Campanha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
