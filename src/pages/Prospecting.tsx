import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Globe, MessageCircle, Loader2, Plus, Users2, MessageSquare,
  Contact, Smartphone, QrCode, RefreshCw, Trash2, Wifi, WifiOff,
  CheckCircle2, MapPin, Tag, X, Zap, ChevronRight, Eye, Download,
  ArrowRight, Sparkles, MoreVertical, Phone, Building2, User, Upload,
  FileSpreadsheet, AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EvolutionInstance = {
  name: string;
  state: string;
  owner: string | null;
};

type ScrapeResult = {
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
};

type ScrapeJob = {
  id: string;
  url: string;
  keywords: string;
  status: "running" | "completed" | "failed";
  results: ScrapeResult[];
  results_count: number;
  created_at: string;
  error_message?: string;
};

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

  // Scraping state
  const [scrapeJobs, setScrapeJobs] = useState<ScrapeJob[]>([]);
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [viewResults, setViewResults] = useState<ScrapeJob | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardUrl, setWizardUrl] = useState("");
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
  // Groups selection
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string; size: number }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Manual state
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // File upload state
  const [fileUploading, setFileUploading] = useState(false);
  const [fileParsedLeads, setFileParsedLeads] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [fileError, setFileError] = useState("");

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return phone;
  };

  const capitalizeName = (name: string) =>
    name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

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

  // Poll status while QR dialog is open
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

  // === Web Scraping ===
  const activeNiche = customNiche || selectedNiche;

  const resetWizard = () => {
    setWizardStep(1); setWizardUrl(""); setSelectedNiche(""); setCustomNiche("");
    setKeywords([]); setKeywordInput("");
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords(prev => [...prev, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleScrape = async () => {
    if (!profile?.org_id || !wizardUrl) return;
    setScrapingLoading(true);
    setWizardOpen(false);

    const jobId = crypto.randomUUID();
    const newJob: ScrapeJob = {
      id: jobId, url: wizardUrl, keywords: [...keywords, activeNiche].filter(Boolean).join(", "),
      status: "running", results: [], results_count: 0, created_at: new Date().toISOString(),
    };
    setScrapeJobs(prev => [newJob, ...prev]);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-leads", {
        body: { org_id: profile.org_id, url: wizardUrl, keywords: [...keywords, activeNiche].filter(Boolean).join(", ") },
      });
      if (error) throw error;

      setScrapeJobs(prev => prev.map(j => j.id === jobId ? {
        ...j, status: "completed" as const, results_count: data?.count || 0,
        results: data?.results || [],
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
  // Fetch available groups for selection
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
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const selectAllGroups = () => {
    if (selectedGroupIds.size === availableGroups.length) setSelectedGroupIds(new Set());
    else setSelectedGroupIds(new Set(availableGroups.map(g => g.id)));
  };

  const handleWhatsappExtract = async () => {
    if (!profile?.org_id) return;
    setEvolutionLoading(true);
    try {
      const body: any = {
        org_id: profile.org_id, mode: whatsappMode, instance_name: selectedInstance || undefined,
      };
      if (whatsappMode === "group") {
        body.group_ids = Array.from(selectedGroupIds);
      }
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", { body });
      if (error) throw error;
      const desc = whatsappMode === "group"
        ? `${data?.count || 0} contatos extraídos de ${data?.groups?.length || 0} grupo(s)`
        : whatsappMode === "conversation"
        ? `${data?.count || 0} conversas extraídas (${data?.total_conversations || 0} total, ${data?.already_existing || 0} já existiam)`
        : `${data?.count || 0} contatos importados (${data?.total_contacts || 0} total, ${data?.already_existing || 0} já existiam)`;
      toast({ title: "Extração concluída!", description: desc });
      setSelectedGroupIds(new Set());
    } catch (error: any) {
      toast({ title: "Erro na extração", description: error.message, variant: "destructive" });
    } finally { setEvolutionLoading(false); }
  };

  // === Manual Add ===
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
    setFileError("");
    setFileParsedLeads([]);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt"].includes(ext || "")) {
      setFileError("Formato não suportado. Use arquivos .csv ou .txt");
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        setFileError("Arquivo vazio ou sem dados suficientes.");
        return;
      }

      // Detect separator
      const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      const header = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ""));

      // Find column indices
      const nameIdx = header.findIndex(h => ["nome", "name", "nome completo", "full_name", "fullname"].includes(h));
      const phoneIdx = header.findIndex(h => ["telefone", "phone", "celular", "whatsapp", "tel", "fone", "numero"].includes(h));
      const emailIdx = header.findIndex(h => ["email", "e-mail", "e_mail"].includes(h));

      if (phoneIdx === -1 && nameIdx === -1) {
        setFileError("Não encontrei colunas de 'nome' ou 'telefone' no cabeçalho. Use: nome, telefone, email.");
        return;
      }

      const parsed = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
        return {
          name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
          phone: phoneIdx >= 0 ? cols[phoneIdx] || "" : "",
          email: emailIdx >= 0 ? cols[emailIdx] || "" : "",
        };
      }).filter(l => l.name || l.phone);

      if (parsed.length === 0) {
        setFileError("Nenhum lead válido encontrado no arquivo.");
        return;
      }

      setFileParsedLeads(parsed);
    } catch {
      setFileError("Erro ao ler o arquivo.");
    }
    // Reset input
    e.target.value = "";
  };

  const handleFileImport = async () => {
    if (!profile?.org_id || fileParsedLeads.length === 0) return;
    setFileUploading(true);
    try {
      const batch = fileParsedLeads.map(l => ({
        org_id: profile.org_id!,
        name: l.name ? capitalizeName(l.name) : null,
        phone: l.phone ? formatPhone(l.phone) : null,
        email: l.email || null,
        source: "import" as const,
        status: "pending" as const,
      }));

      // Insert in chunks of 500
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const { error } = await supabase.from("leads_raw").insert(chunk);
        if (error) throw error;
      }

      toast({ title: "Importação concluída!", description: `${batch.length} leads importados do arquivo.` });
      setFileParsedLeads([]);
    } catch (error: any) {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    } finally { setFileUploading(false); }
  };

  const instanceState = (state: string) => {
    if (state === "open") return <Badge className="bg-success/10 text-success border-success/30 rounded-lg text-[10px]" variant="outline"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
    if (state === "close" || state === "closed") return <Badge className="bg-warning/10 text-warning border-warning/30 rounded-lg text-[10px]" variant="outline"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>;
    return <Badge variant="outline" className="text-muted-foreground rounded-lg text-[10px]">Aguardando</Badge>;
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    running: { color: "bg-warning/15 text-warning", label: "Raspando..." },
    completed: { color: "bg-success/15 text-success", label: "Concluído" },
    failed: { color: "bg-destructive/15 text-destructive", label: "Falhou" },
  };

  const completedJobs = scrapeJobs.filter(j => j.status === "completed").length;
  const totalResults = scrapeJobs.reduce((a, j) => a + (j.results_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Search className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prospecção</h1>
          <p className="text-muted-foreground text-sm">Web Scraping, WhatsApp e entrada manual</p>
        </div>
      </div>

      <Tabs defaultValue="web" className="space-y-6">
        <TabsList className="glass rounded-xl p-1.5 h-auto gap-1.5 flex-wrap">
          {[
            { id: "web", label: "Web Scraping", icon: Globe, desc: "Raspagem inteligente de leads" },
            { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, desc: "Extração via Evolution API" },
            { id: "manual", label: "Manual", icon: Plus, desc: "Adicionar lead manualmente" },
            { id: "file", label: "Arquivo", icon: Upload, desc: "Importar leads de arquivo" },
          ].map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2.5 flex-col sm:flex-row items-start sm:items-center rounded-lg"
            >
              <tab.icon className="h-4 w-4" />
              <div className="text-left">
                <span className="block text-sm font-medium">{tab.label}</span>
                <span className="block text-[10px] opacity-70 sm:hidden">{tab.desc}</span>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ===== WEB SCRAPING TAB ===== */}
        <TabsContent value="web" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Raspagens", value: scrapeJobs.length, icon: Search, color: "text-primary" },
              { label: "Concluídas", value: completedJobs, icon: CheckCircle2, color: "text-success" },
              { label: "Leads Encontrados", value: totalResults, icon: Users2, color: "text-chart-4" },
            ].map(m => (
              <div key={m.label} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{m.label}</p>
                    <p className="text-2xl font-bold mt-1">{m.value}</p>
                  </div>
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Header + Action */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Gerador de Demanda
            </h3>
            <Button className="gap-2 rounded-xl" onClick={() => { resetWizard(); setWizardOpen(true); }}>
              <Plus className="h-4 w-4" /> Nova Pesquisa
            </Button>
          </div>

          {/* Jobs List */}
          {scrapeJobs.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma pesquisa realizada</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Use o Gerador de Demanda para encontrar leads por URL, nicho e palavras-chave.</p>
              <Button onClick={() => { resetWizard(); setWizardOpen(true); }} className="gap-2 rounded-xl">
                <Sparkles className="h-4 w-4" /> Iniciar Pesquisa
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {scrapeJobs.map(job => {
                const cfg = statusConfig[job.status] || statusConfig.running;
                return (
                  <div key={job.id} className="glass rounded-xl p-5 transition-all hover:border-primary/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <h3 className="font-semibold truncate">{job.url}</h3>
                          <Badge className={cfg.color} variant="secondary">{cfg.label}</Badge>
                          {job.results_count > 0 && (
                            <Badge variant="outline" className="gap-1 rounded-lg"><Users2 className="h-3 w-3" />{job.results_count} leads</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {job.url}</span>
                          {job.keywords && <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {job.keywords}</span>}
                          <span className="text-xs">{new Date(job.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        {job.error_message && <p className="text-xs text-destructive mt-1">{job.error_message}</p>}
                        {job.status === "running" && <div className="mt-2 max-w-md"><Progress value={45} className="h-1.5" /></div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {job.status === "completed" && job.results_count > 0 && (
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => { setViewResults(job); setSelectedResults(new Set()); }}>
                            <Eye className="h-3.5 w-3.5" /> Ver Leads
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== WHATSAPP TAB ===== */}
        <TabsContent value="whatsapp" className="space-y-4">
          {/* Simple Instance Creation */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Conectar WhatsApp
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Escolha um nome e conecte seu WhatsApp instantaneamente</p>
              </div>
              {instances.length > 0 && (
                <Button variant="ghost" size="icon" onClick={fetchInstances} disabled={instancesLoading} className="rounded-xl">
                  <RefreshCw className={`h-4 w-4 ${instancesLoading ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>

            {/* Connected instances summary */}
            {instances.length > 0 && (
              <div className="space-y-2">
                {instances.map((inst) => (
                  <div key={inst.name}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedInstance === inst.name ? "bg-primary/5 border-primary/30" : "bg-secondary/20 border-border/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setSelectedInstance(inst.name)}>
                      {selectedInstance === inst.name && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      <p className="text-sm font-medium">{inst.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {instanceState(inst.state)}
                      {inst.state !== "open" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleGetQR(inst.name)}>
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDeleteInstance(inst.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create new instance - always visible */}
            <div className="flex gap-2">
              <Input placeholder="Nome da instância (ex: meu-whatsapp)" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)}
                className="rounded-xl bg-secondary/30 border-border/30" onKeyDown={(e) => e.key === "Enter" && handleCreateInstance()} />
              <Button onClick={handleCreateInstance} disabled={creatingInstance || !newInstanceName.trim()} className="rounded-xl gradient-primary hover:opacity-90 shrink-0 gap-1.5">
                {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" />Criar e Conectar</>}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Ao criar, o QR Code será exibido automaticamente para você escanear com o WhatsApp.</p>
          </div>

          {/* Extraction options */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Extração de Contatos</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Extraia contatos do WhatsApp
                {selectedInstance && <span className="text-primary ml-1">• {selectedInstance}</span>}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { key: "group" as const, label: "Grupos", icon: Users2, desc: "Selecione grupos e extraia membros" },
                { key: "conversation" as const, label: "Conversas", icon: MessageSquare, desc: "Todas as conversas (nome + telefone)" },
                { key: "contact" as const, label: "Contatos Salvos", icon: Contact, desc: "Contatos salvos no telefone" },
              ].map((opt) => (
                <button key={opt.key} onClick={() => { setWhatsappMode(opt.key); if (opt.key === "group" && availableGroups.length === 0 && selectedInstance) handleFetchGroups(); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                    whatsappMode === opt.key ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                  }`}>
                  <opt.icon className="h-3.5 w-3.5" />{opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* GROUP MODE: Show selectable group list */}
              {whatsappMode === "group" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Selecione os grupos</Label>
                    <div className="flex gap-2">
                      {availableGroups.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={selectAllGroups} className="text-xs h-7 rounded-lg">
                          {selectedGroupIds.size === availableGroups.length ? "Desmarcar todos" : "Selecionar todos"}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={handleFetchGroups} disabled={groupsLoading || !selectedInstance} className="text-xs h-7 rounded-lg gap-1">
                        <RefreshCw className={`h-3 w-3 ${groupsLoading ? "animate-spin" : ""}`} />
                        {availableGroups.length === 0 ? "Carregar Grupos" : "Atualizar"}
                      </Button>
                    </div>
                  </div>

                  {groupsLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-sm">Buscando grupos...</span>
                    </div>
                  ) : availableGroups.length > 0 ? (
                    <ScrollArea className="h-[280px] rounded-xl border border-border/30 bg-secondary/10">
                      <div className="p-2 space-y-1">
                        {availableGroups.map((group) => (
                          <div
                            key={group.id}
                            onClick={() => toggleGroupSelection(group.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              selectedGroupIds.has(group.id) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                            }`}
                          >
                            <Checkbox checked={selectedGroupIds.has(group.id)} className="pointer-events-none" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{group.name}</p>
                              <p className="text-[11px] text-muted-foreground">{group.size} participantes</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : !selectedInstance ? (
                    <p className="text-xs text-warning py-4 text-center">⚠ Selecione uma instância conectada acima</p>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">Clique em "Carregar Grupos" para ver os grupos disponíveis</p>
                  )}

                  {selectedGroupIds.size > 0 && (
                    <p className="text-xs text-primary font-medium">{selectedGroupIds.size} grupo(s) selecionado(s)</p>
                  )}
                </div>
              )}

              {/* CONVERSATION MODE: Simple description */}
              {whatsappMode === "conversation" && (
                <div className="glass rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Extrair todas as conversas</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Puxa nome e telefone de todas as pessoas com quem você conversou nesta instância. Sem conteúdo das mensagens.
                  </p>
                </div>
              )}

              {/* CONTACT MODE: Simple description */}
              {whatsappMode === "contact" && (
                <div className="glass rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Contact className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Importar contatos salvos</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Importa todos os contatos salvos no telefone conectado a esta instância (apenas os que possuem nome).
                  </p>
                </div>
              )}

              <Button onClick={handleWhatsappExtract}
                disabled={evolutionLoading || !selectedInstance || (whatsappMode === "group" && selectedGroupIds.size === 0)}
                className="rounded-xl gradient-primary hover:opacity-90 w-full sm:w-auto">
                {evolutionLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Extraindo...</> : <><MessageCircle className="h-4 w-4 mr-2" />
                  {whatsappMode === "group" ? `Extrair de ${selectedGroupIds.size} grupo(s)` : whatsappMode === "conversation" ? "Extrair Todas as Conversas" : "Importar Contatos Salvos"}
                </>}
              </Button>

              {!selectedInstance && instances.length === 0 && (
                <p className="text-xs text-warning">⚠ Crie e conecte uma instância acima para começar a extrair.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== MANUAL TAB ===== */}
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

        {/* ===== FILE UPLOAD TAB ===== */}
        <TabsContent value="file" className="mt-4">
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Importar Leads de Arquivo</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Envie um arquivo CSV com colunas: nome, telefone, email</p>
            </div>

            <div className="space-y-4">
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border/50 rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Clique para selecionar arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .csv, .txt (separado por vírgula, ponto-e-vírgula ou tab)</p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fileError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {fileError}
                </div>
              )}

              {fileParsedLeads.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{fileParsedLeads.length} leads encontrados no arquivo</p>
                    <Button variant="ghost" size="sm" onClick={() => setFileParsedLeads([])} className="text-xs text-muted-foreground">
                      <X className="h-3 w-3 mr-1" />Limpar
                    </Button>
                  </div>

                  <ScrollArea className="h-[250px] rounded-xl border border-border/30">
                    <div className="divide-y divide-border/30">
                      {fileParsedLeads.slice(0, 100).map((l, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                          <span className="flex-1 truncate font-medium">{l.name || "—"}</span>
                          <span className="text-muted-foreground text-xs">{l.phone || "—"}</span>
                          <span className="text-muted-foreground text-xs truncate max-w-[150px]">{l.email || "—"}</span>
                        </div>
                      ))}
                      {fileParsedLeads.length > 100 && (
                        <div className="px-4 py-2.5 text-xs text-muted-foreground text-center">
                          ...e mais {fileParsedLeads.length - 100} leads
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <Button onClick={handleFileImport} disabled={fileUploading} className="rounded-xl gradient-primary hover:opacity-90 w-full sm:w-auto">
                    {fileUploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</> : <><Upload className="h-4 w-4 mr-2" />Importar {fileParsedLeads.length} Leads</>}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== WIZARD DIALOG ===== */}
      <Dialog open={wizardOpen} onOpenChange={v => { if (!scrapingLoading) setWizardOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              Nova Pesquisa de Demanda
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && "Insira a URL e escolha o segmento de mercado"}
              {wizardStep === 2 && "Adicione palavras-chave para refinar os resultados"}
              {wizardStep === 3 && "Revise e inicie a pesquisa"}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s < wizardStep ? "bg-primary text-primary-foreground" :
                  s === wizardStep ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {s < wizardStep ? <CheckCircle2 className="h-4 w-4" /> : s}
                </div>
                {s < 3 && <div className={`flex-1 h-0.5 rounded-full transition-all ${s < wizardStep ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: URL + Niche */}
          {wizardStep === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">URL para Raspagem *</Label>
                <Input value={wizardUrl} onChange={e => setWizardUrl(e.target.value)} placeholder="https://exemplo.com/contatos"
                  className="rounded-xl bg-secondary/30 border-border/30" />
              </div>
              <div>
                <Label className="text-sm font-semibold">Segmento / Nicho (opcional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {PRESET_NICHES.map(n => (
                    <button key={n.value} onClick={() => { setSelectedNiche(n.value); setCustomNiche(""); }}
                      className={`text-left p-3 rounded-xl border transition-all text-sm ${
                        selectedNiche === n.value
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "border-border/50 hover:border-primary/30 hover:bg-muted/50"
                      }`}>
                      <span className="text-lg">{n.icon}</span>
                      <p className="font-medium mt-1">{n.label}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">Ou digite um nicho personalizado</Label>
                  <Input value={customNiche} onChange={e => { setCustomNiche(e.target.value); setSelectedNiche(""); }}
                    placeholder="Ex: clínicas estéticas, pet shops..." className="mt-1 rounded-xl bg-secondary/30 border-border/30" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Keywords */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Palavras-chave (opcional)</Label>
              <p className="text-xs text-muted-foreground -mt-2">Refine a busca adicionando termos específicos</p>
              <div className="flex gap-2">
                <Input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                  placeholder="Ex: vendas, marketing, diretor..." className="flex-1 rounded-xl bg-secondary/30 border-border/30"
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())} />
                <Button variant="outline" size="sm" onClick={addKeyword} className="rounded-xl">Adicionar</Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map(kw => (
                    <Badge key={kw} variant="outline" className="gap-1 pr-1 rounded-lg">
                      <Tag className="h-3 w-3" /> {kw}
                      <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-5 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">URL</p>
                  <p className="text-sm font-semibold mt-1 flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />{wizardUrl}</p>
                </div>
                {activeNiche && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Nicho</p>
                    <p className="text-sm font-semibold mt-1">{activeNiche}</p>
                  </div>
                )}
                {keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Palavras-chave</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {keywords.map(kw => <Badge key={kw} variant="outline" className="rounded-lg"><Tag className="h-3 w-3 mr-1" />{kw}</Badge>)}
                    </div>
                  </div>
                )}
                <div className="border-t border-border/50 pt-3">
                  <p className="text-xs text-muted-foreground">
                    A pesquisa irá raspar a página e extrair contatos{activeNiche ? ` focando em ${activeNiche}` : ""}. Os leads encontrados serão adicionados automaticamente à sua base.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <DialogFooter className="flex items-center justify-between gap-3 sm:justify-between">
            <div>
              {wizardStep > 1 && !scrapingLoading && (
                <Button variant="ghost" size="sm" onClick={() => setWizardStep(s => s - 1)} className="rounded-xl">Voltar</Button>
              )}
            </div>
            <div className="flex gap-2">
              {wizardStep < 3 && (
                <Button onClick={() => setWizardStep(s => s + 1)} disabled={wizardStep === 1 && !wizardUrl.trim()} className="gap-1.5 rounded-xl">
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {wizardStep === 3 && (
                <Button onClick={handleScrape} disabled={scrapingLoading} className="gap-2 rounded-xl gradient-primary">
                  {scrapingLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Raspando...</> : <><Zap className="h-4 w-4" /> Iniciar Pesquisa</>}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== RESULTS DIALOG ===== */}
      <Dialog open={!!viewResults} onOpenChange={() => { setViewResults(null); setSelectedResults(new Set()); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Resultados — {viewResults?.url}
              <Badge variant="outline" className="rounded-lg">{viewResults?.results_count || 0} encontrados</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {viewResults?.results && viewResults.results.length > 0 ? (
              viewResults.results.map((r, i) => (
                <div key={i} className="glass rounded-lg p-4 hover:bg-muted/30 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-primary" />
                        {r.name || `Lead ${i + 1}`}
                      </h4>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                        {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                        {r.email && <span className="flex items-center gap-1">✉ {r.email}</span>}
                        {r.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{r.company}</span>}
                        {r.role && <span className="flex items-center gap-1">{r.role}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Os leads foram salvos diretamente na base. Confira na página de Leads.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== QR CODE DIALOG ===== */}
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
