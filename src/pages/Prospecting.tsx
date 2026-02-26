import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Globe, MessageCircle, Loader2, Plus, Users2, MessageSquare,
  Contact, Smartphone, QrCode, RefreshCw, Trash2, Wifi, WifiOff,
  CheckCircle2, Tag, X, Zap, ChevronRight, Eye,
  Sparkles, Phone, Building2, User, Upload,
  FileSpreadsheet, AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type EvolutionInstance = { name: string; state: string; owner: string | null };
type ScrapeResult = { name: string | null; phone: string | null; email: string | null; company: string | null; role: string | null };
type ScrapeJob = { id: string; niche: string; keywords: string; status: "running" | "completed" | "failed"; results: ScrapeResult[]; results_count: number; created_at: string; error_message?: string };

const PRESET_NICHES = [
  { label: "Imobiliárias", value: "imobiliárias", icon: "🏠" },
  { label: "Clínicas Médicas", value: "clínicas médicas", icon: "🏥" },
  { label: "Escritórios de Advocacia", value: "escritórios de advocacia", icon: "⚖️" },
  { label: "Restaurantes", value: "restaurantes", icon: "🍽️" },
  { label: "Academias", value: "academias e fitness", icon: "💪" },
  { label: "E-commerces", value: "lojas online e-commerce", icon: "🛒" },
  { label: "Odontologia", value: "clínicas odontológicas", icon: "🦷" },
  { label: "Contabilidade", value: "escritórios de contabilidade", icon: "📊" },
  { label: "Educação", value: "escolas e cursos", icon: "📚" },
  { label: "Agências de Marketing", value: "agências de marketing digital", icon: "📢" },
  { label: "Pet Shops", value: "pet shops e veterinários", icon: "🐾" },
  { label: "Tecnologia", value: "empresas de tecnologia e SaaS", icon: "💻" },
];

export default function Prospecting() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [scrapeJobs, setScrapeJobs] = useState<ScrapeJob[]>([]);
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [viewResults, setViewResults] = useState<ScrapeJob | null>(null);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  // WhatsApp state
  const [whatsappMode, setWhatsappMode] = useState<"group" | "conversation" | "contact">("group");
  const [evolutionLoading, setEvolutionLoading] = useState(false);
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
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string; size: number }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Manual
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // File
  const [fileUploading, setFileUploading] = useState(false);
  const [fileParsedLeads, setFileParsedLeads] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [fileError, setFileError] = useState("");

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return phone;
  };

  const capitalizeName = (name: string) => name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  // === Instance Management ===
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
    } catch { /* silently fail */ }
    finally { setInstancesLoading(false); }
  }, [profile?.org_id, selectedInstance]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

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
        if (qr) { setQrCode(qr); setQrInstanceName(newInstanceName.trim()); setConnectionStatus("waiting"); setQrDialogOpen(true); }
      }
      setNewInstanceName("");
      await fetchInstances();
      setSelectedInstance(newInstanceName.trim());
    } catch (error: any) {
      toast({ title: "Erro ao criar instância", description: error.message, variant: "destructive" });
    } finally { setCreatingInstance(false); }
  };

  const handleGetQR = async (instanceName: string) => {
    if (!profile?.org_id) return;
    setQrLoading(true); setQrInstanceName(instanceName); setQrDialogOpen(true); setQrCode(""); setConnectionStatus("waiting");
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "qrcode", org_id: profile.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      setQrCode(data?.qrcode || "");
    } catch (error: any) {
      toast({ title: "Erro ao obter QR Code", description: error.message, variant: "destructive" });
      setQrDialogOpen(false);
    } finally { setQrLoading(false); }
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
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  };

  // Poll status
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
          setTimeout(() => { setQrDialogOpen(false); fetchInstances(); setSelectedInstance(qrInstanceName); }, 1500);
        }
      } catch { /* ignore */ }
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

  // === Web Scraping (by Niche) ===
  const activeNiche = customNiche || selectedNiche;

  const resetWizard = () => {
    setWizardStep(1); setSelectedNiche(""); setCustomNiche("");
    setKeywords([]); setKeywordInput("");
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords(prev => [...prev, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleScrape = async () => {
    if (!profile?.org_id || !activeNiche) return;
    setScrapingLoading(true);
    setWizardOpen(false);

    const jobId = crypto.randomUUID();
    const newJob: ScrapeJob = {
      id: jobId, niche: activeNiche, keywords: keywords.join(", "),
      status: "running", results: [], results_count: 0, created_at: new Date().toISOString(),
    };
    setScrapeJobs(prev => [newJob, ...prev]);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-leads", {
        body: { org_id: profile.org_id, url: `https://www.google.com/search?q=${encodeURIComponent(activeNiche)}`, keywords: [...keywords, activeNiche].filter(Boolean).join(", ") },
      });
      if (error) throw error;

      setScrapeJobs(prev => prev.map(j => j.id === jobId ? {
        ...j, status: "completed" as const, results_count: data?.count || 0, results: data?.results || [],
      } : j));
      toast({ title: "Prospecção concluída!", description: `${data?.count || 0} leads capturados.` });
      resetWizard();
    } catch (error: any) {
      setScrapeJobs(prev => prev.map(j => j.id === jobId ? {
        ...j, status: "failed" as const, error_message: error.message,
      } : j));
      toast({ title: "Erro no scraping", description: error.message, variant: "destructive" });
    } finally { setScrapingLoading(false); }
  };

  // === WhatsApp Extract ===
  const handleFetchGroups = async () => {
    if (!profile?.org_id || !selectedInstance) return;
    setGroupsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", {
        body: { org_id: profile.org_id, mode: "list_groups", instance_name: selectedInstance },
      });
      if (error) throw error;
      setAvailableGroups(data?.groups || []);
      setSelectedGroupIds(new Set());
    } catch (error: any) {
      toast({ title: "Erro ao buscar grupos", description: error.message, variant: "destructive" });
    } finally { setGroupsLoading(false); }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev => { const next = new Set(prev); next.has(groupId) ? next.delete(groupId) : next.add(groupId); return next; });
  };

  const selectAllGroups = () => {
    if (selectedGroupIds.size === availableGroups.length) setSelectedGroupIds(new Set());
    else setSelectedGroupIds(new Set(availableGroups.map(g => g.id)));
  };

  const handleWhatsappExtract = async () => {
    if (!profile?.org_id) return;
    setEvolutionLoading(true);
    try {
      const body: any = { org_id: profile.org_id, mode: whatsappMode, instance_name: selectedInstance || undefined };
      if (whatsappMode === "group") body.group_ids = Array.from(selectedGroupIds);
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", { body });
      if (error) throw error;
      const desc = whatsappMode === "group"
        ? `${data?.count || 0} contatos extraídos de ${data?.groups?.length || 0} grupo(s)`
        : whatsappMode === "conversation"
        ? `${data?.count || 0} conversas extraídas`
        : `${data?.count || 0} contatos importados`;
      toast({ title: "Extração concluída!", description: desc });
      setSelectedGroupIds(new Set());
    } catch (error: any) {
      toast({ title: "Erro na extração", description: error.message, variant: "destructive" });
    } finally { setEvolutionLoading(false); }
  };

  // === Manual ===
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.org_id) return;
    setManualLoading(true);
    try {
      const { error } = await supabase.from("leads_raw").insert({
        org_id: profile.org_id, name: capitalizeName(manualName),
        phone: formatPhone(manualPhone), email: manualEmail || null,
        source: "manual" as const, status: "pending" as const,
      });
      if (error) throw error;
      toast({ title: "Lead adicionado!", description: `${manualName} salvo com sucesso.` });
      setManualName(""); setManualPhone(""); setManualEmail("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setManualLoading(false); }
  };

  // === File Upload ===
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(""); setFileParsedLeads([]);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt"].includes(ext || "")) { setFileError("Formato não suportado. Use .csv ou .txt"); return; }
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setFileError("Arquivo vazio ou sem dados."); return; }
      const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      const header = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ""));
      const nameIdx = header.findIndex(h => ["nome", "name", "nome completo", "full_name", "fullname"].includes(h));
      const phoneIdx = header.findIndex(h => ["telefone", "phone", "celular", "whatsapp", "tel", "fone", "numero"].includes(h));
      const emailIdx = header.findIndex(h => ["email", "e-mail", "e_mail"].includes(h));
      if (phoneIdx === -1 && nameIdx === -1) { setFileError("Não encontrei colunas de 'nome' ou 'telefone'."); return; }
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
        return { name: nameIdx >= 0 ? cols[nameIdx] || "" : "", phone: phoneIdx >= 0 ? cols[phoneIdx] || "" : "", email: emailIdx >= 0 ? cols[emailIdx] || "" : "" };
      }).filter(l => l.name || l.phone);
      if (parsed.length === 0) { setFileError("Nenhum lead válido encontrado."); return; }
      setFileParsedLeads(parsed);
    } catch { setFileError("Erro ao ler o arquivo."); }
    e.target.value = "";
  };

  const handleFileImport = async () => {
    if (!profile?.org_id || fileParsedLeads.length === 0) return;
    setFileUploading(true);
    try {
      const batch = fileParsedLeads.map(l => ({
        org_id: profile.org_id!, name: l.name ? capitalizeName(l.name) : null,
        phone: l.phone ? formatPhone(l.phone) : null, email: l.email || null,
        source: "import" as const, status: "pending" as const,
      }));
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const { error } = await supabase.from("leads_raw").insert(chunk);
        if (error) throw error;
      }
      toast({ title: "Importação concluída!", description: `${batch.length} leads importados.` });
      setFileParsedLeads([]);
    } catch (error: any) {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    } finally { setFileUploading(false); }
  };

  const instanceState = (state: string) => {
    if (state === "open") return <Badge className="bg-success/10 text-success border-success/30 text-[10px]" variant="outline"><Wifi className="h-3 w-3 mr-1" />Online</Badge>;
    if (state === "close" || state === "closed") return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]" variant="outline"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Aguardando</Badge>;
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    running: { color: "bg-warning/15 text-warning", label: "Raspando..." },
    completed: { color: "bg-success/15 text-success", label: "Concluído" },
    failed: { color: "bg-destructive/15 text-destructive", label: "Falhou" },
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Prospecção</h1>
        <p className="text-sm text-muted-foreground">Encontre leads por nicho, WhatsApp ou importação</p>
      </div>

      <Tabs defaultValue="web" className="space-y-5">
        <TabsList className="bg-secondary h-9 p-0.5 rounded-lg gap-0.5">
          {[
            { id: "web", label: "Por Nicho", icon: Globe },
            { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
            { id: "manual", label: "Manual", icon: Plus },
            { id: "file", label: "Arquivo", icon: Upload },
          ].map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs rounded-md px-3 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ===== NICHE TAB ===== */}
        <TabsContent value="web" className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Gerador de Demanda</h3>
              <p className="text-xs text-muted-foreground">Pesquise leads por segmento de mercado</p>
            </div>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => { resetWizard(); setWizardOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> Nova Pesquisa
            </Button>
          </div>

          {scrapeJobs.length === 0 ? (
            <div className="border border-dashed rounded-lg p-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhuma pesquisa realizada</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Escolha um nicho para encontrar leads automaticamente</p>
              <Button size="sm" onClick={() => { resetWizard(); setWizardOpen(true); }} className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Iniciar Pesquisa
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {scrapeJobs.map(job => {
                const cfg = statusConfig[job.status];
                return (
                  <div key={job.id} className="border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{job.niche}</p>
                          <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                          {job.results_count > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Users2 className="h-3 w-3" />{job.results_count}</Badge>}
                        </div>
                        {job.keywords && <p className="text-xs text-muted-foreground"><Tag className="h-3 w-3 inline mr-1" />{job.keywords}</p>}
                        {job.status === "running" && <Progress value={45} className="h-1 mt-2 max-w-xs" />}
                        {job.error_message && <p className="text-xs text-destructive mt-1">{job.error_message}</p>}
                      </div>
                      {job.status === "completed" && job.results_count > 0 && (
                        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setViewResults(job)}>
                          <Eye className="h-3 w-3" /> Ver
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== WHATSAPP TAB ===== */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2"><Smartphone className="h-4 w-4 text-success" />Conectar WhatsApp</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Crie instâncias e extraia contatos</p>
              </div>
              {instances.length > 0 && (
                <Button variant="ghost" size="icon" onClick={fetchInstances} disabled={instancesLoading} className="h-8 w-8">
                  <RefreshCw className={`h-3.5 w-3.5 ${instancesLoading ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>

            {instances.length > 0 && (
              <div className="space-y-1.5">
                {instances.map((inst) => (
                  <div key={inst.name} className={`flex items-center justify-between p-2.5 rounded-md border transition-colors ${selectedInstance === inst.name ? "bg-primary/5 border-primary/30" : "hover:bg-secondary/50"}`}>
                    <div className="flex items-center gap-2.5 cursor-pointer flex-1" onClick={() => setSelectedInstance(inst.name)}>
                      {selectedInstance === inst.name && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <p className="text-sm">{inst.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {instanceState(inst.state)}
                      {inst.state !== "open" && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleGetQR(inst.name)}><QrCode className="h-3.5 w-3.5" /></Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteInstance(inst.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input placeholder="Nome da instância" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)}
                className="text-sm" onKeyDown={(e) => e.key === "Enter" && handleCreateInstance()} />
              <Button onClick={handleCreateInstance} disabled={creatingInstance || !newInstanceName.trim()} size="sm" className="shrink-0 gap-1.5 text-xs">
                {creatingInstance ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" />Criar</>}
              </Button>
            </div>
          </div>

          {/* Extraction */}
          <div className="border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-medium">Extração de Contatos</h3>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "group" as const, label: "Grupos", icon: Users2 },
                { key: "conversation" as const, label: "Conversas", icon: MessageSquare },
                { key: "contact" as const, label: "Contatos", icon: Contact },
              ].map((opt) => (
                <button key={opt.key} onClick={() => { setWhatsappMode(opt.key); if (opt.key === "group" && availableGroups.length === 0 && selectedInstance) handleFetchGroups(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    whatsappMode === opt.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  <opt.icon className="h-3 w-3" />{opt.label}
                </button>
              ))}
            </div>

            {whatsappMode === "group" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Selecione os grupos</p>
                  <div className="flex gap-1.5">
                    {availableGroups.length > 0 && <Button variant="ghost" size="sm" onClick={selectAllGroups} className="text-xs h-7">{selectedGroupIds.size === availableGroups.length ? "Desmarcar" : "Todos"}</Button>}
                    <Button variant="outline" size="sm" onClick={handleFetchGroups} disabled={groupsLoading || !selectedInstance} className="text-xs h-7 gap-1">
                      <RefreshCw className={`h-3 w-3 ${groupsLoading ? "animate-spin" : ""}`} />{availableGroups.length === 0 ? "Carregar" : "Atualizar"}
                    </Button>
                  </div>
                </div>
                {groupsLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span className="text-xs">Buscando...</span></div>
                ) : availableGroups.length > 0 ? (
                  <ScrollArea className="h-[200px] border rounded-md">
                    <div className="p-1.5 space-y-0.5">
                      {availableGroups.map((group) => (
                        <div key={group.id} onClick={() => toggleGroupSelection(group.id)}
                          className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${selectedGroupIds.has(group.id) ? "bg-primary/10" : "hover:bg-secondary"}`}>
                          <Checkbox checked={selectedGroupIds.has(group.id)} className="pointer-events-none" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{group.name}</p>
                            <p className="text-[10px] text-muted-foreground">{group.size} membros</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : !selectedInstance ? (
                  <p className="text-xs text-warning py-3 text-center">Selecione uma instância primeiro</p>
                ) : null}
              </div>
            )}

            <Button onClick={handleWhatsappExtract} size="sm" className="gap-1.5 text-xs"
              disabled={evolutionLoading || !selectedInstance || (whatsappMode === "group" && selectedGroupIds.size === 0)}>
              {evolutionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              {whatsappMode === "group" ? `Extrair de ${selectedGroupIds.size} grupo(s)` : whatsappMode === "conversation" ? "Extrair Conversas" : "Importar Contatos"}
            </Button>
          </div>
        </TabsContent>

        {/* ===== MANUAL TAB ===== */}
        <TabsContent value="manual">
          <div className="border rounded-lg p-5 space-y-4 max-w-lg">
            <h3 className="text-sm font-medium">Adicionar Lead Manualmente</h3>
            <form onSubmit={handleManualAdd} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input placeholder="João Silva" value={manualName} onChange={(e) => setManualName(e.target.value)} required className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input placeholder="(11) 99999-9999" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} required className="text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email (opcional)</Label>
                <Input type="email" placeholder="joao@empresa.com" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="text-sm" />
              </div>
              <Button type="submit" size="sm" disabled={manualLoading} className="gap-1.5 text-xs">
                {manualLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Adicionar Lead
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* ===== FILE TAB ===== */}
        <TabsContent value="file">
          <div className="border rounded-lg p-5 space-y-4 max-w-lg">
            <h3 className="text-sm font-medium">Importar de Arquivo</h3>
            <p className="text-xs text-muted-foreground">CSV com colunas: nome, telefone, email</p>
            <label htmlFor="file-upload" className="flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-medium">Clique para selecionar</p>
              <p className="text-[10px] text-muted-foreground">.csv, .txt</p>
              <input id="file-upload" type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
            {fileError && <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{fileError}</div>}
            {fileParsedLeads.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{fileParsedLeads.length} leads encontrados</p>
                  <Button variant="ghost" size="sm" onClick={() => setFileParsedLeads([])} className="text-xs h-6"><X className="h-3 w-3 mr-1" />Limpar</Button>
                </div>
                <ScrollArea className="h-[180px] border rounded-md">
                  <div className="divide-y">
                    {fileParsedLeads.slice(0, 50).map((l, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground w-5">{i + 1}</span>
                        <span className="flex-1 truncate font-medium">{l.name || "—"}</span>
                        <span className="text-muted-foreground">{l.phone || "—"}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button onClick={handleFileImport} size="sm" disabled={fileUploading} className="gap-1.5 text-xs">
                  {fileUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Importar {fileParsedLeads.length} Leads
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== WIZARD DIALOG ===== */}
      <Dialog open={wizardOpen} onOpenChange={v => { if (!scrapingLoading) setWizardOpen(v); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Nova Pesquisa de Demanda
            </DialogTitle>
            <DialogDescription className="text-xs">
              {wizardStep === 1 && "Escolha o segmento de mercado"}
              {wizardStep === 2 && "Adicione palavras-chave para refinar"}
              {wizardStep === 3 && "Revise e inicie a pesquisa"}
            </DialogDescription>
          </DialogHeader>

          {/* Steps */}
          <div className="flex items-center gap-2 my-1">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  s < wizardStep ? "bg-primary text-primary-foreground" :
                  s === wizardStep ? "bg-primary text-primary-foreground" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {s < wizardStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
                </div>
                {s < 3 && <div className={`flex-1 h-px transition-colors ${s < wizardStep ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Niche Selection */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Segmento / Nicho *</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {PRESET_NICHES.map(n => (
                    <button key={n.value} onClick={() => { setSelectedNiche(n.value); setCustomNiche(""); }}
                      className={`text-left p-3 rounded-lg border transition-all text-xs ${
                        selectedNiche === n.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30 hover:bg-secondary/50"
                      }`}>
                      <span className="text-base">{n.icon}</span>
                      <p className="font-medium mt-1.5">{n.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ou digite um nicho personalizado</Label>
                <Input value={customNiche} onChange={e => { setCustomNiche(e.target.value); setSelectedNiche(""); }}
                  placeholder="Ex: clínicas estéticas, pet shops..." className="mt-1 text-sm" />
              </div>
            </div>
          )}

          {/* Step 2: Keywords */}
          {wizardStep === 2 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Palavras-chave (opcional)</Label>
              <p className="text-xs text-muted-foreground -mt-1">Refine a busca com termos específicos</p>
              <div className="flex gap-2">
                <Input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} placeholder="Ex: vendas, diretor..." className="flex-1 text-sm"
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())} />
                <Button variant="outline" size="sm" onClick={addKeyword} className="text-xs">Adicionar</Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map(kw => (
                    <Badge key={kw} variant="secondary" className="gap-1 pr-1 text-xs">
                      {kw}
                      <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {wizardStep === 3 && (
            <div className="border rounded-lg p-4 space-y-3 bg-secondary/30">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Nicho</p>
                <p className="text-sm font-medium mt-0.5">{activeNiche}</p>
              </div>
              {keywords.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Palavras-chave</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {keywords.map(kw => <Badge key={kw} variant="secondary" className="text-[10px]">{kw}</Badge>)}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground border-t pt-3">
                A IA vai pesquisar e extrair contatos do nicho "{activeNiche}" automaticamente.
              </p>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div>
              {wizardStep > 1 && <Button variant="ghost" size="sm" onClick={() => setWizardStep(s => s - 1)} className="text-xs">Voltar</Button>}
            </div>
            <div className="flex gap-2">
              {wizardStep < 3 && (
                <Button onClick={() => setWizardStep(s => s + 1)} size="sm" disabled={wizardStep === 1 && !activeNiche} className="gap-1 text-xs">
                  Próximo <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {wizardStep === 3 && (
                <Button onClick={handleScrape} size="sm" disabled={scrapingLoading} className="gap-1.5 text-xs">
                  {scrapingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}Iniciar Pesquisa
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={!!viewResults} onOpenChange={() => setViewResults(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              Resultados — {viewResults?.niche}
              <Badge variant="outline" className="text-[10px]">{viewResults?.results_count || 0} leads</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            {viewResults?.results?.length ? viewResults.results.map((r, i) => (
              <div key={i} className="border rounded-md p-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><User className="h-3 w-3 text-primary" />{r.name || `Lead ${i + 1}`}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                  {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                  {r.email && <span>✉ {r.email}</span>}
                  {r.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{r.company}</span>}
                </div>
              </div>
            )) : <p className="text-xs text-muted-foreground text-center py-4">Leads salvos na base. Confira em "Meus Leads".</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" />Conectar WhatsApp</DialogTitle>
            <DialogDescription className="text-xs">Escaneie com o WhatsApp — <span className="text-primary font-medium">{qrInstanceName}</span></DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 space-y-3">
            {connectionStatus === "connected" ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="text-sm font-medium text-success">Conectado!</p>
              </div>
            ) : qrLoading ? (
              <div className="py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : qrCode ? (
              <>
                <div className="bg-white p-3 rounded-lg"><img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-56 h-56" /></div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />Aguardando leitura...</div>
                <Button variant="outline" size="sm" onClick={() => handleGetQR(qrInstanceName)} className="text-xs gap-1"><RefreshCw className="h-3 w-3" />Atualizar QR</Button>
              </>
            ) : <p className="text-xs text-muted-foreground py-6">Não foi possível gerar o QR Code.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
