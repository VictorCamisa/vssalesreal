import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Globe, MessageCircle, Loader2, Plus, Users2, MessageSquare, Contact, Smartphone, QrCode, RefreshCw, Trash2, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type EvolutionInstance = {
  name: string;
  state: string;
  owner: string | null;
};

export default function Prospecting() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeKeywords, setScrapeKeywords] = useState("");
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [evolutionGroup, setEvolutionGroup] = useState("");
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [whatsappMode, setWhatsappMode] = useState<"group" | "conversation" | "contact" | "all">("all");
  const [evolutionPhone, setEvolutionPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // Instance management
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"waiting" | "connected" | "error">("waiting");

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return phone;
  };

  const capitalizeName = (name: string) =>
    name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  const fetchInstances = useCallback(async () => {
    if (!profile?.org_id) return;
    setInstancesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "list", org_id: profile.org_id },
      });
      if (error) throw error;
      setInstances(data?.instances || []);
      if (data?.instances?.length && !selectedInstance) {
        const connected = data.instances.find((i: EvolutionInstance) => i.state === "open");
        setSelectedInstance(connected?.name || data.instances[0].name);
      }
    } catch {
      // silently fail
    } finally {
      setInstancesLoading(false);
    }
  }, [profile?.org_id, selectedInstance]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const handleCreateInstance = async () => {
    if (!profile?.org_id || !newInstanceName.trim()) return;
    setCreatingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "create", org_id: profile.org_id, instance_name: newInstanceName.trim() },
      });
      if (error) throw error;

      toast({ title: "Instância criada!", description: `${newInstanceName} pronta para conexão.` });

      if (data?.qrcode?.base64 || data?.qrcode) {
        const qr = typeof data.qrcode === "string" ? data.qrcode : data.qrcode.base64;
        if (qr) {
          setQrCode(qr);
          setQrInstanceName(newInstanceName.trim());
          setConnectionStatus("waiting");
          setQrDialogOpen(true);
        }
      }

      setNewInstanceName("");
      await fetchInstances();
      setSelectedInstance(newInstanceName.trim());
    } catch (error: any) {
      toast({ title: "Erro ao criar instância", description: error.message, variant: "destructive" });
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleGetQR = async (instanceName: string) => {
    if (!profile?.org_id) return;
    setQrLoading(true);
    setQrInstanceName(instanceName);
    setQrDialogOpen(true);
    setQrCode("");
    setConnectionStatus("waiting");
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "qrcode", org_id: profile.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      setQrCode(data?.qrcode || "");
    } catch (error: any) {
      toast({ title: "Erro ao obter QR Code", description: error.message, variant: "destructive" });
      setQrDialogOpen(false);
    } finally {
      setQrLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!profile?.org_id) return;
    try {
      const { error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "delete", org_id: profile.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      toast({ title: "Instância removida" });
      if (selectedInstance === instanceName) setSelectedInstance("");
      await fetchInstances();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // Poll status while QR dialog is open (every 3s) + auto-refresh QR every 25s
  useEffect(() => {
    if (!qrDialogOpen || !qrInstanceName || !profile?.org_id) return;

    let qrRefreshCount = 0;

    const statusInterval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("manage-evolution", {
          body: { action: "status", org_id: profile.org_id, instance_name: qrInstanceName },
        });
        if (data?.state === "open") {
          setConnectionStatus("connected");
          toast({ title: "✅ WhatsApp conectado!", description: `Instância ${qrInstanceName} online.` });
          setTimeout(() => {
            setQrDialogOpen(false);
            fetchInstances();
            setSelectedInstance(qrInstanceName);
          }, 1500);
        }
      } catch { /* ignore */ }

      // Auto-refresh QR every ~25s (8 cycles of 3s)
      qrRefreshCount++;
      if (qrRefreshCount % 8 === 0) {
        try {
          const { data } = await supabase.functions.invoke("manage-evolution", {
            body: { action: "qrcode", org_id: profile.org_id, instance_name: qrInstanceName },
          });
          if (data?.qrcode) setQrCode(data.qrcode);
        } catch { /* ignore */ }
      }
    }, 3000);

    return () => clearInterval(statusInterval);
  }, [qrDialogOpen, qrInstanceName, profile?.org_id]);

  const handleScrape = async () => {
    if (!profile?.org_id || !scrapeUrl) return;
    setScrapingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-leads", {
        body: { org_id: profile.org_id, url: scrapeUrl, keywords: scrapeKeywords },
      });
      if (error) throw error;
      toast({ title: "Prospecção concluída!", description: `${data?.count || 0} leads capturados.` });
      setScrapeUrl("");
      setScrapeKeywords("");
    } catch (error: any) {
      toast({ title: "Erro no scraping", description: error.message, variant: "destructive" });
    } finally {
      setScrapingLoading(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.org_id) return;
    setManualLoading(true);
    try {
      const { error } = await supabase.from("leads_raw").insert({
        org_id: profile.org_id,
        name: capitalizeName(manualName),
        phone: formatPhone(manualPhone),
        email: manualEmail || null,
        source: "manual" as const,
        status: "pending" as const,
      });
      if (error) throw error;
      toast({ title: "Lead adicionado!", description: `${manualName} salvo com sucesso.` });
      setManualName("");
      setManualPhone("");
      setManualEmail("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setManualLoading(false);
    }
  };

  const instanceState = (state: string) => {
    if (state === "open") return <Badge className="bg-success/10 text-success border-success/30 rounded-lg text-[10px]" variant="outline"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
    if (state === "close" || state === "closed") return <Badge className="bg-warning/10 text-warning border-warning/30 rounded-lg text-[10px]" variant="outline"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>;
    return <Badge variant="outline" className="text-muted-foreground rounded-lg text-[10px]">Aguardando</Badge>;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Search className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prospecção</h1>
          <p className="text-muted-foreground text-sm">Web Scraping, WhatsApp e entrada manual</p>
        </div>
      </div>

      <Tabs defaultValue="web">
        <TabsList className="bg-secondary/30 rounded-xl p-1 h-auto">
          <TabsTrigger value="web" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4">
            <Globe className="h-3.5 w-3.5 mr-1.5" />Web Scraping
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4">
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />WhatsApp
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="mt-4">
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Web Scraping via Firecrawl</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Insira a URL e palavras-chave para extrair contatos</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">URL alvo</Label>
                <Input placeholder="https://exemplo.com/contatos" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} className="rounded-xl bg-secondary/30 border-border/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Palavras-chave (opcional)</Label>
                <Textarea placeholder="vendas, marketing, diretor..." value={scrapeKeywords} onChange={(e) => setScrapeKeywords(e.target.value)} rows={2} className="rounded-xl bg-secondary/30 border-border/30 resize-none" />
              </div>
              <Button onClick={handleScrape} disabled={scrapingLoading || !scrapeUrl} className="rounded-xl gradient-primary hover:opacity-90">
                {scrapingLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Prospectando...</> : <><Search className="h-4 w-4 mr-2" />Iniciar Prospecção</>}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4 space-y-4">
          {/* Instance Management */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Instâncias WhatsApp
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Gerencie suas conexões com o WhatsApp</p>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchInstances} disabled={instancesLoading} className="rounded-xl">
                <RefreshCw className={`h-4 w-4 ${instancesLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Create new instance */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome da nova instância"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                className="rounded-xl bg-secondary/30 border-border/30"
                onKeyDown={(e) => e.key === "Enter" && handleCreateInstance()}
              />
              <Button onClick={handleCreateInstance} disabled={creatingInstance || !newInstanceName.trim()} className="rounded-xl gradient-primary hover:opacity-90 shrink-0">
                {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Criar</>}
              </Button>
            </div>

            {/* Instance list */}
            {instances.length > 0 ? (
              <div className="space-y-2">
                {instances.map((inst) => (
                  <div
                    key={inst.name}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedInstance === inst.name ? "bg-primary/5 border-primary/30" : "bg-secondary/20 border-border/30 hover:border-border/50"
                    }`}
                    onClick={() => setSelectedInstance(inst.name)}
                  >
                    <div className="flex items-center gap-3">
                      {selectedInstance === inst.name && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">{inst.name}</p>
                        {inst.owner && <p className="text-[11px] text-muted-foreground">{inst.owner}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {instanceState(inst.state)}
                      {inst.state !== "open" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); handleGetQR(inst.name); }}>
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteInstance(inst.name); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !instancesLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma instância encontrada. Crie uma para começar.</p>
            ) : null}
          </div>

          {/* Extraction options */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Extração via Evolution API</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Extraia contatos do WhatsApp por grupo, conversa ou contato
                {selectedInstance && <span className="text-primary ml-1">• {selectedInstance}</span>}
              </p>
            </div>

            <div className="flex gap-2">
              {[
                { key: "all" as const, label: "Todos", icon: Smartphone },
                { key: "group" as const, label: "Grupo", icon: Users2 },
                { key: "conversation" as const, label: "Conversa", icon: MessageSquare },
                { key: "contact" as const, label: "Contato", icon: Contact },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setWhatsappMode(opt.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 border ${
                    whatsappMode === opt.key ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                  }`}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {whatsappMode === "group" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Nome do grupo</Label>
                  <Input placeholder="Grupo de Vendas Regional" value={evolutionGroup} onChange={(e) => setEvolutionGroup(e.target.value)} className="rounded-xl bg-secondary/30 border-border/30" />
                  <p className="text-[11px] text-muted-foreground">Busca parcial pelo nome do grupo na sua instância</p>
                </div>
              )}
              {(whatsappMode === "conversation" || whatsappMode === "contact") && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{whatsappMode === "conversation" ? "Número do telefone" : "Número do contato"}</Label>
                  <Input placeholder="+5511999999999" value={evolutionPhone} onChange={(e) => setEvolutionPhone(e.target.value)} className="rounded-xl bg-secondary/30 border-border/30" />
                  <p className="text-[11px] text-muted-foreground">{whatsappMode === "conversation" ? "Extrai dados de contato de uma conversa direta" : "Importa um contato diretamente pelo número"}</p>
                </div>
              )}

              <Button
                onClick={async () => {
                  if (!profile?.org_id) return;
                  setEvolutionLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("extract-whatsapp", {
                      body: {
                        org_id: profile.org_id,
                        mode: whatsappMode,
                        instance_name: selectedInstance || undefined,
                        group_name: whatsappMode === "group" ? evolutionGroup : undefined,
                        phone: whatsappMode !== "group" ? evolutionPhone : undefined,
                      },
                    });
                    if (error) throw error;
                    const desc = whatsappMode === "all"
                      ? `${data?.count || 0} contatos extraídos (${data?.total_contacts || 0} total, ${data?.already_existing || 0} já existiam)`
                      : whatsappMode === "group"
                      ? `${data?.count || 0} contatos extraídos do grupo ${data?.group || ""}`
                      : whatsappMode === "conversation"
                      ? `${data?.count || 0} contatos extraídos da conversa${data?.contact_name ? ` com ${data.contact_name}` : ""}`
                      : `${data?.count || 0} contato importado${data?.contact_name ? `: ${data.contact_name}` : ""}`;
                    toast({ title: "Extração concluída!", description: desc });
                    setEvolutionGroup("");
                    setEvolutionPhone("");
                  } catch (error: any) {
                    toast({ title: "Erro na extração", description: error.message, variant: "destructive" });
                  } finally {
                    setEvolutionLoading(false);
                  }
                }}
                disabled={evolutionLoading || !selectedInstance || (whatsappMode === "group" ? !evolutionGroup : whatsappMode === "all" ? false : !evolutionPhone)}
                className="rounded-xl gradient-primary hover:opacity-90"
              >
                {evolutionLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Extraindo...</> : <><MessageCircle className="h-4 w-4 mr-2" />Extrair Contatos</>}
              </Button>

              {!selectedInstance && instances.length === 0 && (
                <p className="text-xs text-warning">⚠ Crie e conecte uma instância acima para começar a extrair.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Adicionar Lead Manualmente</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Insira os dados do lead</p>
            </div>
            <form onSubmit={handleManualAdd} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Nome</Label>
                  <Input placeholder="João Silva" value={manualName} onChange={(e) => setManualName(e.target.value)} required className="rounded-xl bg-secondary/30 border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Telefone</Label>
                  <Input placeholder="(11) 99999-9999" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} required className="rounded-xl bg-secondary/30 border-border/30" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Email (opcional)</Label>
                <Input type="email" placeholder="joao@empresa.com" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="rounded-xl bg-secondary/30 border-border/30" />
              </div>
              <Button type="submit" disabled={manualLoading} className="rounded-xl gradient-primary hover:opacity-90">
                {manualLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Plus className="h-4 w-4 mr-2" />Adicionar Lead</>}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="glass border-border/30 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com o WhatsApp na instância <span className="text-primary font-medium">{qrInstanceName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 space-y-4">
            {connectionStatus === "connected" ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="h-16 w-16 rounded-full bg-success/15 flex items-center justify-center animate-pulse">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <p className="text-sm font-medium text-success">WhatsApp conectado com sucesso!</p>
                <p className="text-xs text-muted-foreground">Fechando automaticamente...</p>
              </div>
            ) : qrLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrCode ? (
              <>
                <div className="bg-white p-4 rounded-2xl">
                  <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="w-64 h-64" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  Aguardando leitura do QR Code...
                </div>
                <p className="text-xs text-muted-foreground text-center">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</p>
                <Button variant="outline" size="sm" onClick={() => handleGetQR(qrInstanceName)} className="rounded-xl border-border/50">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Atualizar QR
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8">Não foi possível gerar o QR Code.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
