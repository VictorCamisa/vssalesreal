import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Search, Sparkles, ArrowRight, Trash2, Loader2, Download,
  Upload, Plus, Eye, MoreVertical, Target, BarChart3, Filter,
  Phone, Mail, Globe, X, Building2, User
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  tags: string[] | null;
  created_at: string;
  enrichment_data: any;
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  enriched: "bg-primary/10 text-primary border-primary/30",
  converted: "bg-success/10 text-success border-success/30",
  discarded: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  enriched: "Enriquecido",
  converted: "Convertido",
  discarded: "Descartado",
};

const sourceLabels: Record<string, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  manual: "Manual",
  import: "Importação",
};

export default function Leads() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [enriching, setEnriching] = useState(false);
  const [converting, setConverting] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  // Add lead dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "" });
  const [addLoading, setAddLoading] = useState(false);

  const fetchLeads = async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("leads_raw")
      .select("id, name, phone, email, source, status, tags, created_at, enrichment_data")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [profile?.org_id]);

  const enrichedCount = leads.filter(l => !!l.enrichment_data && Object.keys(l.enrichment_data).length > 1).length;
  const pendingCount = leads.filter(l => l.status === "pending").length;
  const convertedCount = leads.filter(l => l.status === "converted").length;
  const conversionRate = leads.length > 0 ? ((convertedCount / leads.length) * 100).toFixed(1) : "0";

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch = !searchQuery ||
        l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.phone?.includes(searchQuery) ||
        l.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchSource = sourceFilter === "all" || l.source === sourceFilter;

      let matchQuick = true;
      if (quickFilter === "enriched") matchQuick = !!l.enrichment_data && Object.keys(l.enrichment_data).length > 1;
      else if (quickFilter === "not_enriched") matchQuick = !l.enrichment_data || Object.keys(l.enrichment_data).length <= 1;
      else if (quickFilter === "pending") matchQuick = l.status === "pending";
      else if (quickFilter === "converted") matchQuick = l.status === "converted";

      return matchSearch && matchStatus && matchSource && matchQuick;
    });
  }, [leads, searchQuery, statusFilter, sourceFilter, quickFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  };

  const handleEnrich = async () => {
    if (selected.size === 0) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-lead", {
        body: { lead_ids: Array.from(selected), org_id: profile?.org_id },
      });
      if (error) throw error;
      toast({ title: "Enriquecimento concluído!", description: `${data?.enriched || 0} leads enriquecidos.` });
      setSelected(new Set());
      fetchLeads();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setEnriching(false); }
  };

  const handleEnrichSingle = async (lead: Lead) => {
    setEnrichingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-lead", {
        body: { lead_ids: [lead.id], org_id: profile?.org_id },
      });
      if (error) throw error;
      toast({ title: "Lead enriquecido!" });
      fetchLeads();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setEnrichingId(null); }
  };

  const handleConvertToCRM = async () => {
    if (!profile?.org_id || selected.size === 0) return;
    setConverting(true);
    try {
      const { data: stages } = await supabase
        .from("crm_stages").select("id").eq("org_id", profile.org_id).order("stage_order").limit(1);
      if (!stages?.length) throw new Error("Crie estágios no CRM primeiro.");

      const opportunities = Array.from(selected).map((lead_id) => ({
        org_id: profile.org_id!, lead_id, stage_id: stages[0].id,
      }));

      const { error: oppError } = await supabase.from("opportunities").insert(opportunities);
      if (oppError) throw oppError;

      await supabase.from("leads_raw").update({ status: "converted" as const }).in("id", Array.from(selected));

      toast({ title: "Leads enviados ao CRM!", description: `${selected.size} oportunidades criadas.` });
      setSelected(new Set());
      fetchLeads();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setConverting(false); }
  };

  const handleDiscard = async () => {
    if (selected.size === 0) return;
    await supabase.from("leads_raw").update({ status: "discarded" as const }).in("id", Array.from(selected));
    toast({ title: "Leads descartados." });
    setSelected(new Set());
    fetchLeads();
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from("leads_raw").delete().in("id", Array.from(selected));
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${selected.size} leads excluídos.` });
    setSelected(new Set());
    fetchLeads();
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.org_id) return;
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: any = { org_id: profile.org_id, source: "import", status: "pending" };
      headers.forEach((h, i) => {
        if (h.includes("nome") || h.includes("name")) obj.name = values[i];
        else if (h.includes("email")) obj.email = values[i];
        else if (h.includes("telefone") || h.includes("phone") || h.includes("celular")) obj.phone = values[i];
      });
      return obj;
    }).filter(r => r.name || r.phone || r.email);
    if (rows.length === 0) { toast({ title: "CSV vazio ou inválido", variant: "destructive" }); return; }
    const { error } = await supabase.from("leads_raw").insert(rows);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${rows.length} leads importados!` });
    fetchLeads();
  };

  const handleAddLead = async () => {
    if (!profile?.org_id || !newLead.name.trim()) return;
    setAddLoading(true);
    try {
      const formatPhone = (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
        if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
        return phone;
      };
      const { error } = await supabase.from("leads_raw").insert({
        org_id: profile.org_id,
        name: newLead.name.replace(/\b\w/g, c => c.toUpperCase()).trim(),
        phone: newLead.phone ? formatPhone(newLead.phone) : null,
        email: newLead.email || null,
        source: "manual" as const, status: "pending" as const,
      });
      if (error) throw error;
      toast({ title: "Lead adicionado!" });
      setNewLead({ name: "", phone: "", email: "" });
      setAddOpen(false);
      fetchLeads();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setAddLoading(false); }
  };

  const exportCSV = () => {
    const rows = [["Nome", "Telefone", "Email", "Fonte", "Status"]];
    filtered.forEach((l) => rows.push([l.name || "", l.phone || "", l.email || "", sourceLabels[l.source] || l.source, statusLabels[l.status] || l.status]));
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado!" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
       <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-description">Triagem e qualificação — {leads.length} leads</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
              <span><Upload className="h-4 w-4" /> Importar CSV</span>
            </Button>
          </label>
          <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button size="sm" className="rounded-xl gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: leads.length, icon: Users, color: "text-primary" },
          { label: "Enriquecidos", value: enrichedCount, icon: Sparkles, color: "text-chart-4" },
          { label: "Pendentes", value: pendingCount, icon: Target, color: "text-warning" },
          { label: "Conversão", value: `${conversionRate}%`, icon: BarChart3, color: "text-success" },
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

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "Todos", count: leads.length },
          { key: "pending", label: "Pendentes", count: pendingCount },
          { key: "enriched", label: "Enriquecidos", count: enrichedCount },
          { key: "not_enriched", label: "Sem Enriquecimento", count: leads.length - enrichedCount },
          { key: "converted", label: "Convertidos", count: convertedCount },
        ].map(f => (
          <button key={f.key} onClick={() => setQuickFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              quickFilter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
            }`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone ou email..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-secondary/30 border-border/30" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] rounded-xl bg-secondary/30 border-border/30"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="enriched">Enriquecido</SelectItem>
            <SelectItem value="converted">Convertido</SelectItem>
            <SelectItem value="discarded">Descartado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[130px] rounded-xl bg-secondary/30 border-border/30"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="import">Importação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="glass rounded-xl p-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg bg-secondary/50">{selected.size} selecionados</span>
          <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5" onClick={handleEnrich} disabled={enriching}>
            {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Enriquecer
          </Button>
          <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5 gradient-primary" onClick={handleConvertToCRM} disabled={converting}>
            {converting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />} Enviar ao CRM
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1.5" onClick={handleDiscard}>
            <X className="h-3 w-3" /> Descartar
          </Button>
          <Button size="sm" variant="destructive" className="rounded-xl h-8 text-xs gap-1.5" onClick={handleDelete}>
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">
            {leads.length === 0 ? "Nenhum lead capturado ainda" : "Nenhum lead encontrado"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {leads.length === 0 ? "Inicie uma prospecção ou adicione leads manualmente." : "Ajuste os filtros aplicados."}
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telefone</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fonte</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className={`border-border/20 transition-colors ${selected.has(lead.id) ? "bg-primary/5" : "hover:bg-secondary/30"}`}>
                  <TableCell><Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} /></TableCell>
                  <TableCell>
                    <button onClick={() => setDetailLead(lead)} className="text-left hover:text-primary transition-colors">
                      <span className="font-medium text-sm">{lead.name || "—"}</span>
                      {lead.enrichment_data && Object.keys(lead.enrichment_data).length > 1 && (
                        <Sparkles className="h-3 w-3 text-chart-4 inline ml-1.5" />
                      )}
                      {lead.enrichment_data?.empresa && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{lead.enrichment_data.empresa}</p>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{lead.phone || "—"}</TableCell>
                  <TableCell className="text-sm hidden md:table-cell">{lead.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize rounded-lg text-[10px] font-medium">{sourceLabels[lead.source] || lead.source}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[lead.status] || ""} rounded-lg text-[10px] font-medium`} variant="outline">
                      {statusLabels[lead.status] || lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => setDetailLead(lead)}>
                          <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEnrichSingle(lead)} disabled={enrichingId === lead.id}>
                          <Sparkles className="h-4 w-4 mr-2" /> Enriquecer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={async () => {
                          await supabase.from("leads_raw").delete().eq("id", lead.id);
                          toast({ title: "Lead excluído" }); fetchLeads();
                        }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Lead Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {detailLead?.name || "Lead"}
            </DialogTitle>
          </DialogHeader>

          {detailLead && (
            <div className="space-y-4">
              {/* Contact info */}
              <div className="glass rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</h4>
                {detailLead.phone && <p className="text-sm flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{detailLead.phone}</p>}
                {detailLead.email && <p className="text-sm flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{detailLead.email}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="capitalize rounded-lg text-[10px]">{sourceLabels[detailLead.source] || detailLead.source}</Badge>
                  <Badge className={`${statusColors[detailLead.status]} rounded-lg text-[10px]`} variant="outline">{statusLabels[detailLead.status]}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Criado em {new Date(detailLead.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>

              {/* Enrichment */}
              {detailLead.enrichment_data && Object.keys(detailLead.enrichment_data).length > 1 ? (() => {
                const ed = detailLead.enrichment_data;
                const company = ed.empresa || ed.company || ed.descricao_empresa || null;
                const role = ed.cargo_estimado || ed.role || null;
                const segment = ed.segmento || ed.segment || null;
                const score = ed.score_conversao ?? ed.score ?? null;
                const website = ed.website || null;
                const instagram = ed.instagram || null;
                const linkedin = ed.linkedin || null;
                const size = ed.porte || ed.tamanho || null;
                const location = ed.localizacao || ed.location || null;
                const pains = ed.dores_provaveis || ed.dores || [];
                const products = ed.produtos_servicos || ed.produtos || [];
                const salesArgs = ed.argumentos_venda || [];
                const channel = ed.canal_ideal || null;
                const decisionLevel = ed.nivel_decisao || null;
                const notes = ed.observacoes_importantes || ed.analysis || null;
                const sources = ed.fontes_utilizadas || [];

                return (
                <div className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Enriquecimento IA</h4>
                      <p className="text-[10px] text-muted-foreground">Gerado por IA</p>
                    </div>
                  </div>

                  {score !== null && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
                      <div className="text-2xl font-bold text-primary font-mono">{score}</div>
                      <div>
                        <p className="text-xs font-medium">Score de Conversão</p>
                        <p className="text-[10px] text-muted-foreground">Baseado nos dados coletados</p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm space-y-2">
                    {company && <p><strong>Empresa:</strong> {company}</p>}
                    {role && <p><strong>Cargo:</strong> {role}</p>}
                    {segment && <p><strong>Segmento:</strong> {segment}</p>}
                    {size && <p><strong>Porte:</strong> {size}</p>}
                    {location && <p><strong>Localização:</strong> {location}</p>}
                    {decisionLevel && <p><strong>Nível de Decisão:</strong> {decisionLevel}</p>}
                    {channel && <p><strong>Canal Ideal:</strong> {channel}</p>}
                    {website && website !== "N/A" && <p><strong>Website:</strong> <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{website}</a></p>}
                    {instagram && instagram !== "N/A" && <p><strong>Instagram:</strong> {instagram}</p>}
                    {linkedin && linkedin !== "N/A" && <p><strong>LinkedIn:</strong> {linkedin}</p>}
                  </div>

                  {products.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Produtos/Serviços</p>
                      <div className="flex flex-wrap gap-1.5">
                        {products.map((p: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] rounded-md">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {pains.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dores Prováveis</p>
                      <ul className="space-y-1">
                        {pains.map((d: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-destructive">•</span>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {salesArgs.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Argumentos de Venda</p>
                      <ul className="space-y-1">
                        {salesArgs.map((a: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-success">✓</span>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {notes && (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observações</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{notes}</p>
                    </div>
                  )}

                  {sources.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">Fontes: {sources.join(", ")}</p>
                  )}
                </div>
                );
              })() : (
                <div className="glass rounded-xl p-4 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sem dados de enriquecimento</p>
                  <Button size="sm" variant="outline" className="mt-2 rounded-xl gap-1.5" onClick={() => handleEnrichSingle(detailLead)}
                    disabled={enrichingId === detailLead.id}>
                    {enrichingId === detailLead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Enriquecer agora
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Lead Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Novo Lead</DialogTitle>
            <DialogDescription>Adicione um lead manualmente à sua base.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input value={newLead.name} onChange={e => setNewLead(prev => ({ ...prev, name: e.target.value }))}
                placeholder="João Silva" className="rounded-xl bg-secondary/30 border-border/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Telefone</Label>
                <Input value={newLead.phone} onChange={e => setNewLead(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999" className="rounded-xl bg-secondary/30 border-border/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Email</Label>
                <Input value={newLead.email} onChange={e => setNewLead(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@empresa.com" className="rounded-xl bg-secondary/30 border-border/30" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAddLead} disabled={addLoading || !newLead.name.trim()} className="rounded-xl gap-2">
              {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
