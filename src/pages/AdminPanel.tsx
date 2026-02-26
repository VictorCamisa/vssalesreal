import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import vsLogo from "@/assets/vs-logo.png";
import {
  Users, FileText, BarChart3, Settings, LogOut, Mail,
  Phone, Building2, Calendar, TrendingUp, Activity, Database,
  Edit3, Save, X, Search, ShoppingCart, Eye, MessageCircle,
  Clock, CheckCircle2, XCircle, AlertCircle, ArrowRight,
  DollarSign, UserCheck, UserX, RefreshCw
} from "lucide-react";

type Tab = "metrics" | "sales" | "users" | "leads" | "content";

interface SiteLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  partnership_type: string | null;
  message: string | null;
  form_source: string;
  created_at: string;
  status: string;
  admin_notes: string | null;
  contacted_at: string | null;
  plan_selected: string | null;
}

interface SiteContent {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  org_id: string | null;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
}

const CONTENT_LABELS: Record<string, string> = {
  hero_title: "Título do Hero",
  hero_subtitle: "Subtítulo do Hero",
  counter_leads: "Contador de Leads",
  counter_hours: "Contador de Horas",
  price_start: "Preço inicial (R$)",
  slots_total: "Total de vagas",
  slots_filled: "Vagas preenchidas",
};

const SALE_STATUSES = [
  { key: "new", label: "Novo", color: "#00D4FF", icon: AlertCircle },
  { key: "contacted", label: "Contatado", color: "#FFB800", icon: MessageCircle },
  { key: "negotiating", label: "Negociando", color: "#0057FF", icon: Clock },
  { key: "closed_won", label: "Fechado ✓", color: "#00FF88", icon: CheckCircle2 },
  { key: "closed_lost", label: "Perdido", color: "#FF4444", icon: XCircle },
] as const;

function getStatusConfig(status: string) {
  return SALE_STATUSES.find(s => s.key === status) || SALE_STATUSES[0];
}

function parsePlanFromMessage(msg: string | null): string | null {
  if (!msg) return null;
  const match = msg.match(/\[CHECKOUT - (\w+)\]/);
  return match ? match[1] : null;
}

function parseCheckoutDetails(msg: string | null) {
  if (!msg) return {};
  const details: Record<string, string> = {};
  const parts = msg.replace(/\[CHECKOUT - \w+\]\s*/, "").split(" | ");
  parts.forEach(p => {
    const [key, ...rest] = p.split(": ");
    if (key && rest.length) details[key.trim()] = rest.join(": ").trim();
  });
  return details;
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("metrics");
  const [siteLeads, setSiteLeads] = useState<SiteLead[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadFilter, setLeadFilter] = useState<string>("all");
  const [saleFilter, setSaleFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const session = (await supabase.auth.getSession()).data.session;
    const [leadsRes, contentRes, usersRes] = await Promise.all([
      supabase.from("site_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("site_content").select("*"),
      supabase.functions.invoke("admin-list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
    ]);
    if (leadsRes.data) setSiteLeads(leadsRes.data as SiteLead[]);
    if (contentRes.data) setSiteContent(contentRes.data);
    if (usersRes.data?.users) setUsers(usersRes.data.users);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  const saveContent = async (key: string) => {
    const { error } = await supabase
      .from("site_content")
      .update({ value: editValue, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo!", description: `"${CONTENT_LABELS[key] || key}" atualizado.` });
      setSiteContent(prev => prev.map(c => c.key === key ? { ...c, value: editValue } : c));
      setEditingKey(null);
    }
  };

  const updateSaleStatus = async (id: string, status: string) => {
    const updates: Record<string, any> = { status };
    if (status === "contacted" && !siteLeads.find(l => l.id === id)?.contacted_at) {
      updates.contacted_at = new Date().toISOString();
    }
    const { error } = await supabase.from("site_leads").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSiteLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      toast({ title: "Status atualizado!" });
    }
  };

  const saveSaleNotes = async (id: string) => {
    const { error } = await supabase.from("site_leads").update({ admin_notes: notesValue }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSiteLeads(prev => prev.map(l => l.id === id ? { ...l, admin_notes: notesValue } : l));
      setEditingNotes(null);
      toast({ title: "Anotação salva!" });
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    const { error } = await supabase.from("site_leads").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSiteLeads(prev => prev.filter(l => l.id !== id));
      toast({ title: "Registro excluído." });
    }
  };

  // Derived data
  const checkoutLeads = siteLeads.filter(l => l.form_source.startsWith("checkout_"));
  const nonCheckoutLeads = siteLeads.filter(l => !l.form_source.startsWith("checkout_"));

  const filteredLeads = nonCheckoutLeads.filter(l => {
    if (leadFilter !== "all" && l.form_source !== leadFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || (l.company || "").toLowerCase().includes(q);
    }
    return true;
  });

  const filteredSales = checkoutLeads.filter(l => {
    if (saleFilter !== "all" && l.status !== saleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || (l.company || "").toLowerCase().includes(q);
    }
    return true;
  });

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "metrics", label: "Métricas", icon: BarChart3 },
    { key: "sales", label: "Vendas", icon: ShoppingCart, badge: checkoutLeads.filter(l => l.status === "new").length },
    { key: "users", label: "Usuários", icon: Users },
    { key: "leads", label: "Formulários", icon: FileText },
    { key: "content", label: "Conteúdo", icon: Settings },
  ];

  // Metrics
  const totalUsers = users.length;
  const usersWithOrg = users.filter(u => u.org_id).length;
  const totalSales = checkoutLeads.length;
  const newSales = checkoutLeads.filter(l => l.status === "new").length;
  const wonSales = checkoutLeads.filter(l => l.status === "closed_won").length;
  const totalLeads = nonCheckoutLeads.length;
  const todayLeads = siteLeads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length;

  const revenueEstimate = checkoutLeads
    .filter(l => l.status === "closed_won")
    .reduce((sum, l) => {
      const plan = parsePlanFromMessage(l.message);
      if (plan === "Starter") return sum + 1497;
      if (plan === "Pro") return sum + 2497;
      if (plan === "Agency") return sum + 3497;
      return sum;
    }, 0);

  return (
    <div className="min-h-screen flex" style={{ background: "#06060B", color: "#e0e0e0" }}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1a1a2e] flex flex-col bg-[#0A0A14] shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-[#1a1a2e]">
          <img src={vsLogo} alt="VS" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.1em" }}>VS ADMIN</p>
            <p className="text-[10px] text-gray-600">Painel Administrativo</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearchQuery(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                tab === t.key
                  ? "bg-[#0057FF]/15 text-[#00D4FF] font-medium"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.badge && t.badge > 0 ? (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF4444] text-white font-bold min-w-[18px] text-center">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1a1a2e]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-400/[0.05] transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="h-14 border-b border-[#1a1a2e] flex items-center justify-between px-6 bg-[#0A0A14]/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-sm font-semibold text-white">{tabs.find(t => t.key === tab)?.label}</h1>
          <div className="flex items-center gap-3">
            {(tab === "users" || tab === "leads" || tab === "sales") && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 pl-9 pr-3 rounded-lg bg-[#0d0d18] border border-[#1a1a2e] text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#00D4FF]/30 w-56"
                />
              </div>
            )}
            <button onClick={loadData} className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-[#00D4FF] transition-colors">
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
          </div>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00D4FF]/30 border-t-[#00D4FF]" />
            </div>
          ) : (
            <>
              {/* ══════ METRICS TAB ══════ */}
              {tab === "metrics" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Vendas (checkout)", value: totalSales, icon: ShoppingCart, color: "#0057FF" },
                      { label: "Vendas novas", value: newSales, icon: AlertCircle, color: "#FFB800" },
                      { label: "Vendas fechadas", value: wonSales, icon: CheckCircle2, color: "#00FF88" },
                      { label: "MRR estimado", value: `R$ ${revenueEstimate.toLocaleString("pt-BR")}`, icon: DollarSign, color: "#00FF88" },
                      { label: "Total de Usuários", value: totalUsers, icon: Users, color: "#0057FF" },
                      { label: "Com Organização", value: usersWithOrg, icon: Building2, color: "#00D4FF" },
                      { label: "Leads do Site", value: totalLeads, icon: FileText, color: "#00D4FF" },
                      { label: "Leads Hoje", value: todayLeads, icon: TrendingUp, color: "#FFB800" },
                    ].map(card => (
                      <div key={card.label} className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{card.label}</span>
                          <card.icon className="h-4 w-4" style={{ color: card.color }} />
                        </div>
                        <p className="text-2xl font-bold text-white">{card.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Sales pipeline summary */}
                  <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5">
                    <h3 className="text-xs font-semibold text-white mb-4 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#00D4FF]" />
                      Pipeline de Vendas
                    </h3>
                    <div className="grid grid-cols-5 gap-3">
                      {SALE_STATUSES.map(s => {
                        const count = checkoutLeads.filter(l => l.status === s.key).length;
                        return (
                          <button
                            key={s.key}
                            onClick={() => { setTab("sales"); setSaleFilter(s.key); }}
                            className="text-center p-3 rounded-lg border border-[#1a1a2e] hover:border-opacity-60 transition-all hover:bg-white/[0.02]"
                          >
                            <p className="text-xl font-bold mb-1" style={{ color: s.color }}>{count}</p>
                            <p className="text-[10px] text-gray-500">{s.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5">
                    <h3 className="text-xs font-semibold text-white mb-4 flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#00FF88]" />
                      Resumo Geral
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: "Usuários cadastrados", value: totalUsers },
                        { label: "Organizações ativas", value: usersWithOrg },
                        { label: "Pedidos de compra", value: totalSales },
                        { label: "Leads capturados (site)", value: totalLeads },
                        { label: "Atividades hoje", value: todayLeads },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between py-1 border-b border-[#1a1a2e] last:border-0">
                          <span className="text-xs text-gray-400">{r.label}</span>
                          <span className="text-xs font-semibold text-white">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ SALES TAB ══════ */}
              {tab === "sales" && (
                <div className="space-y-4">
                  {/* Status filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSaleFilter("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                        saleFilter === "all"
                          ? "bg-[#0057FF]/15 text-[#00D4FF] border border-[#00D4FF]/20"
                          : "text-gray-500 hover:text-gray-300 border border-transparent"
                      }`}
                    >
                      Todos ({checkoutLeads.length})
                    </button>
                    {SALE_STATUSES.map(s => {
                      const count = checkoutLeads.filter(l => l.status === s.key).length;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setSaleFilter(s.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 ${
                            saleFilter === s.key
                              ? "border"
                              : "text-gray-500 hover:text-gray-300 border border-transparent"
                          }`}
                          style={saleFilter === s.key ? { borderColor: `${s.color}30`, color: s.color, background: `${s.color}10` } : undefined}
                        >
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                          {s.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {filteredSales.length === 0 ? (
                    <div className="text-center py-16 text-sm text-gray-600">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                      Nenhuma venda encontrada.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredSales.map(sale => {
                        const statusConf = getStatusConfig(sale.status);
                        const StatusIcon = statusConf.icon;
                        const planName = parsePlanFromMessage(sale.message);
                        const details = parseCheckoutDetails(sale.message);
                        const isExpanded = expandedSale === sale.id;

                        return (
                          <div
                            key={sale.id}
                            className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 overflow-hidden transition-all"
                            style={isExpanded ? { borderColor: `${statusConf.color}20` } : undefined}
                          >
                            {/* Header row */}
                            <div
                              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                              onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                            >
                              {/* Status dot */}
                              <div
                                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: `${statusConf.color}12` }}
                              >
                                <StatusIcon className="h-4 w-4" style={{ color: statusConf.color }} />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-semibold text-white">{sale.name}</span>
                                  {planName && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0057FF]/10 text-[#00D4FF] border border-[#00D4FF]/20">
                                      {planName}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{sale.email}</span>
                                  {sale.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{sale.phone}</span>}
                                  {sale.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{sale.company}</span>}
                                </div>
                              </div>

                              {/* Status badge */}
                              <span
                                className="text-[10px] px-2.5 py-1 rounded-full font-medium shrink-0"
                                style={{ background: `${statusConf.color}15`, color: statusConf.color, border: `1px solid ${statusConf.color}25` }}
                              >
                                {statusConf.label}
                              </span>

                              {/* Date */}
                              <span className="text-[10px] text-gray-600 shrink-0">
                                {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>

                              <ArrowRight className={`h-3.5 w-3.5 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="border-t border-[#1a1a2e] p-4 space-y-4 bg-[#08081a]/50">
                                {/* Details grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {Object.entries(details).map(([key, val]) => (
                                    val && val !== "undefined" && (
                                      <div key={key} className="text-xs">
                                        <p className="text-gray-600 mb-0.5">{key}</p>
                                        <p className="text-white">{val || "—"}</p>
                                      </div>
                                    )
                                  ))}
                                  {sale.contacted_at && (
                                    <div className="text-xs">
                                      <p className="text-gray-600 mb-0.5">Contatado em</p>
                                      <p className="text-white">{new Date(sale.contacted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Status changer */}
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Alterar status</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {SALE_STATUSES.map(s => (
                                      <button
                                        key={s.key}
                                        onClick={() => updateSaleStatus(sale.id, s.key)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                                          sale.status === s.key ? "ring-1" : "opacity-60 hover:opacity-100"
                                        }`}
                                        style={{
                                          background: sale.status === s.key ? `${s.color}15` : "transparent",
                                          color: s.color,
                                          border: `1px solid ${s.color}${sale.status === s.key ? "40" : "15"}`,
                                        }}
                                      >
                                        <s.icon className="h-3 w-3" />
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Notes */}
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Anotações internas</p>
                                  {editingNotes === sale.id ? (
                                    <div className="flex gap-2">
                                      <textarea
                                        value={notesValue}
                                        onChange={e => setNotesValue(e.target.value)}
                                        rows={2}
                                        className="flex-1 px-3 py-2 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#00D4FF]/30 resize-none"
                                        placeholder="Ex: Cliente interessado, ligar amanhã às 14h..."
                                        autoFocus
                                      />
                                      <div className="flex flex-col gap-1">
                                        <button onClick={() => saveSaleNotes(sale.id)} className="h-8 w-8 rounded-lg bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20 flex items-center justify-center">
                                          <Save className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => setEditingNotes(null)} className="h-8 w-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center">
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => { setEditingNotes(sale.id); setNotesValue(sale.admin_notes || ""); }}
                                      className="px-3 py-2 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-xs text-gray-500 cursor-pointer hover:border-[#00D4FF]/20 transition-colors min-h-[36px]"
                                    >
                                      {sale.admin_notes || "Clique para adicionar anotação..."}
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-2 border-t border-[#1a1a2e]">
                                  <div className="flex gap-2">
                                    {sale.phone && (
                                      <a
                                        href={`https://wa.me/${sale.phone.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] text-[11px] font-medium hover:bg-[#25D366]/20 transition-colors"
                                      >
                                        <MessageCircle className="h-3 w-3" /> WhatsApp
                                      </a>
                                    )}
                                    <a
                                      href={`mailto:${sale.email}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0057FF]/10 text-[#00D4FF] text-[11px] font-medium hover:bg-[#0057FF]/20 transition-colors"
                                    >
                                      <Mail className="h-3 w-3" /> Email
                                    </a>
                                  </div>
                                  <button
                                    onClick={() => deleteLead(sale.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-gray-600 hover:text-red-400 hover:bg-red-400/[0.05] transition-colors"
                                  >
                                    <X className="h-3 w-3" /> Excluir
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ══════ USERS TAB ══════ */}
              {tab === "users" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{filteredUsers.length} usuários encontrados</p>
                  </div>
                  <div className="rounded-xl border border-[#1a1a2e] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#0d0d18] border-b border-[#1a1a2e]">
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Usuário</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Email</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Método</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Organização</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Último acesso</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Cadastro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="border-b border-[#1a1a2e] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#0057FF] to-[#00D4FF] flex items-center justify-center text-[10px] font-bold text-white">
                                  {(u.full_name || u.email || "?")[0].toUpperCase()}
                                </div>
                                <span className="text-sm text-white">{u.full_name || "Sem nome"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                u.provider === "google"
                                  ? "bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20"
                                  : "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20"
                              }`}>
                                {u.provider === "google" ? "Google" : "Email/Senha"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {u.org_id ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20">Ativa</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">Pendente</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(u.created_at).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-600">Nenhum usuário encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ══════ LEADS TAB ══════ */}
              {tab === "leads" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {[
                      { key: "all", label: "Todos" },
                      { key: "early_access", label: "Acesso Antecipado" },
                      { key: "partnership", label: "Parceria" },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setLeadFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                          leadFilter === f.key
                            ? "bg-[#0057FF]/15 text-[#00D4FF] border border-[#00D4FF]/20"
                            : "text-gray-500 hover:text-gray-300 border border-transparent"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                    <span className="text-[10px] text-gray-600 ml-auto">{filteredLeads.length} resultados</span>
                  </div>

                  <div className="rounded-xl border border-[#1a1a2e] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#0d0d18] border-b border-[#1a1a2e]">
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Nome</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Email</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Telefone</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Origem</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">Data</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map(l => (
                          <tr key={l.id} className="border-b border-[#1a1a2e] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-sm text-white">{l.name}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{l.email}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{l.phone || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                l.form_source === "partnership"
                                  ? "bg-[#0057FF]/10 text-[#00D4FF] border-[#00D4FF]/20"
                                  : "bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/20"
                              }`}>
                                {l.form_source === "partnership" ? "Parceria" : "Acesso Antecipado"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(l.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => deleteLead(l.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredLeads.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-600">Nenhum lead encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ══════ CONTENT TAB ══════ */}
              {tab === "content" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 mb-4">Edite os textos e números exibidos na landing page do VS SALES.</p>
                  {siteContent.map(c => (
                    <div key={c.id} className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                          {CONTENT_LABELS[c.key] || c.key}
                        </p>
                        {editingKey === c.key ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#00D4FF]/30 text-sm text-white focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm text-white truncate">{c.value}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {editingKey === c.key ? (
                          <>
                            <button onClick={() => saveContent(c.key)} className="h-8 w-8 rounded-lg bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20 flex items-center justify-center transition-colors">
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingKey(null)} className="h-8 w-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingKey(c.key); setEditValue(c.value); }} className="h-8 w-8 rounded-lg bg-white/[0.03] text-gray-500 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
