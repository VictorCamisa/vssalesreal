import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, Sparkles, ArrowRight, Trash2, Loader2, Download } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
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

export default function Leads() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [enriching, setEnriching] = useState(false);
  const [converting, setConverting] = useState(false);

  const fetchLeads = async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("leads_raw")
      .select("id, name, phone, email, source, status, created_at, enrichment_data")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [profile?.org_id]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch = !searchQuery ||
        l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.phone?.includes(searchQuery) ||
        l.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchSource = sourceFilter === "all" || l.source === sourceFilter;
      return matchSearch && matchStatus && matchSource;
    });
  }, [leads, searchQuery, statusFilter, sourceFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((l) => l.id)));
    }
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
    } finally {
      setEnriching(false);
    }
  };

  const handleConvertToCRM = async () => {
    if (!profile?.org_id || selected.size === 0) return;
    setConverting(true);
    try {
      const { data: stages } = await supabase
        .from("crm_stages")
        .select("id")
        .eq("org_id", profile.org_id)
        .order("stage_order")
        .limit(1);
      if (!stages?.length) throw new Error("Crie estágios no CRM primeiro.");

      const opportunities = Array.from(selected).map((lead_id) => ({
        org_id: profile.org_id!,
        lead_id,
        stage_id: stages[0].id,
      }));

      const { error: oppError } = await supabase.from("opportunities").insert(opportunities);
      if (oppError) throw oppError;

      await supabase
        .from("leads_raw")
        .update({ status: "converted" as const })
        .in("id", Array.from(selected));

      toast({ title: "Leads enviados ao CRM!", description: `${selected.size} oportunidades criadas.` });
      setSelected(new Set());
      fetchLeads();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  const handleDiscard = async () => {
    if (selected.size === 0) return;
    await supabase
      .from("leads_raw")
      .update({ status: "discarded" as const })
      .in("id", Array.from(selected));
    toast({ title: "Leads descartados." });
    setSelected(new Set());
    fetchLeads();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground text-sm">
              Triagem e qualificação — {leads.length} leads
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => {
            const rows = [["Nome", "Telefone", "Email", "Fonte", "Status"]];
            filtered.forEach((l) => rows.push([l.name || "", l.phone || "", l.email || "", l.source, statusLabels[l.status] || l.status]));
            const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="h-3 w-3 mr-1" />Exportar CSV
          </Button>

          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg bg-secondary/50">{selected.size} selecionados</span>
              <Button size="sm" className="rounded-xl h-8 text-xs" onClick={handleEnrich} disabled={enriching}>
                {enriching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Enriquecer
              </Button>
              <Button size="sm" className="rounded-xl h-8 text-xs gradient-primary" onClick={handleConvertToCRM} disabled={converting}>
                {converting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                CRM
              </Button>
              <Button size="sm" variant="destructive" className="rounded-xl h-8 text-xs" onClick={handleDiscard}>
                <Trash2 className="h-3 w-3 mr-1" />Descartar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl bg-secondary/30 border-border/30"
          />
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

      {/* Table */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          {leads.length === 0
            ? "Nenhum lead capturado ainda. Inicie uma prospecção primeiro."
            : "Nenhum lead encontrado com os filtros aplicados."}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telefone</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fonte</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className={`border-border/20 transition-colors ${selected.has(lead.id) ? "bg-primary/5" : "hover:bg-secondary/30"}`}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-sm">{lead.name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{lead.phone || "—"}</TableCell>
                  <TableCell className="text-sm">{lead.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize rounded-lg text-[10px] font-medium">{lead.source}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[lead.status] || ""} rounded-lg text-[10px] font-medium`} variant="outline">
                      {statusLabels[lead.status] || lead.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
