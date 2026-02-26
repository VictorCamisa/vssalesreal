import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import vsLogo from "@/assets/vs-sales-logo.png";
import {
  Users, FileText, BarChart3, Settings, LogOut, Mail,
  Phone, Building2, TrendingUp, Activity, Database,
  Edit3, Save, X, Search, ShoppingCart, MessageCircle,
  CheckCircle2, XCircle, AlertCircle,
  DollarSign, RefreshCw, UserPlus, Copy,
  Loader2, Trash2, User, ArrowLeft, Package, Plus,
  Target, Lightbulb, ShieldCheck, Globe, Instagram,
  Linkedin, Facebook, MapPin, Upload, Sparkles, HelpCircle, Link2
} from "lucide-react";

type Tab = "metrics" | "pending" | "users" | "leads" | "content" | "companies";

interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  form_token: string;
}

type CompanyProfileData = {
  id: string;
  org_id: string;
  company_name: string;
  logo_url: string | null;
  segment: string | null;
  description: string;
  mission: string;
  vision: string;
  values: string;
  products_services: { name: string; description: string; price?: string }[];
  target_audience: string;
  differentials: string;
  tone_of_voice: string;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  founded_year: number | null;
  team_size: string | null;
  avg_ticket: string | null;
  sales_process: string;
  objections_faq: { question: string; answer: string }[];
};

const emptyCompanyProfile: Omit<CompanyProfileData, "id" | "org_id"> = {
  company_name: "", logo_url: null, segment: null, description: "", mission: "", vision: "", values: "",
  products_services: [], target_audience: "", differentials: "", tone_of_voice: "",
  website: null, instagram: null, linkedin: null, facebook: null, phone: null, email: null,
  address: null, cnpj: null, founded_year: null, team_size: null, avg_ticket: null,
  sales_process: "", objections_faq: [],
};

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

const PLAN_PRICES: Record<string, string> = {
  Starter: "1.497",
  Pro: "2.497",
  Agency: "3.497",
};

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
  const [loading, setLoading] = useState(true);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [creatingUser, setCreatingUser] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<Record<string, { email: string; password: string }>>({});
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const session = (await supabase.auth.getSession()).data.session;
    const [leadsRes, contentRes, usersRes, orgsRes] = await Promise.all([
      supabase.from("site_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("site_content").select("*"),
      supabase.functions.invoke("admin-list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }),
      supabase.from("organizations").select("*").order("created_at", { ascending: false }),
    ]);
    if (leadsRes.data) setSiteLeads(leadsRes.data as SiteLead[]);
    if (contentRes.data) setSiteContent(contentRes.data);
    if (usersRes.data?.users) setUsers(usersRes.data.users);
    if (orgsRes.data) setOrganizations(orgsRes.data);
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

  const approveSale = async (sale: SiteLead) => {
    setCreatingUser(sale.id);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const planName = sale.plan_selected || parsePlanFromMessage(sale.message);
      const { data, error: fnError } = await supabase.functions.invoke("admin-create-user", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { email: sale.email, full_name: sale.name, plan: planName },
      });

      if (fnError || data?.error) {
        toast({ title: "Erro ao criar usuário", description: data?.error || fnError?.message, variant: "destructive" });
        setCreatingUser(null);
        return;
      }

      // Update sale status to approved
      await supabase.from("site_leads").update({ status: "approved" }).eq("id", sale.id);
      setSiteLeads(prev => prev.map(l => l.id === sale.id ? { ...l, status: "approved" } : l));

      setCreatedCredentials(prev => ({
        ...prev,
        [sale.id]: { email: data.email, password: data.temp_password },
      }));

      toast({ title: "✅ Venda aprovada!", description: `Usuário ${data.email} criado com sucesso.` });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setCreatingUser(null);
  };

  const rejectSale = async (id: string) => {
    if (!confirm("Recusar esta venda? O registro será marcado como recusado.")) return;
    const { error } = await supabase.from("site_leads").update({ status: "rejected" }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSiteLeads(prev => prev.map(l => l.id === id ? { ...l, status: "rejected" } : l));
      toast({ title: "Venda recusada." });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  // Derived data
  const checkoutLeads = siteLeads.filter(l => l.form_source.startsWith("checkout_"));
  const nonCheckoutLeads = siteLeads.filter(l => !l.form_source.startsWith("checkout_"));
  const pendingSales = checkoutLeads.filter(l => l.status === "new");
  const approvedSales = checkoutLeads.filter(l => l.status === "approved");
  const rejectedSales = checkoutLeads.filter(l => l.status === "rejected");

  const filteredLeads = nonCheckoutLeads.filter(l => {
    if (leadFilter !== "all" && l.form_source !== leadFilter) return false;
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

  const pendingUsers = users.filter(u => !u.org_id);

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "metrics", label: "Métricas", icon: BarChart3 },
    { key: "pending", label: "Pendentes", icon: AlertCircle, badge: pendingSales.length + pendingUsers.length },
    { key: "companies", label: "Empresas", icon: Building2, badge: organizations.length },
    { key: "users", label: "Usuários", icon: Users },
    { key: "leads", label: "Formulários", icon: FileText },
    { key: "content", label: "Conteúdo", icon: Settings },
  ];

  // Company profile management
  const loadCompanyProfile = async (orgId: string) => {
    setLoadingCompany(true);
    setSelectedOrgId(orgId);
    const { data: cp } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    if (cp) {
      setCompanyProfile({
        ...cp,
        products_services: (cp.products_services as any) || [],
        objections_faq: (cp.objections_faq as any) || [],
      } as CompanyProfileData);
    } else {
      setCompanyProfile({ ...emptyCompanyProfile, id: "", org_id: orgId } as CompanyProfileData);
    }
    setLoadingCompany(false);
  };

  const updateCompanyField = (field: keyof CompanyProfileData, value: any) => {
    setCompanyProfile(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const saveCompanyProfile = async () => {
    if (!companyProfile || !selectedOrgId) return;
    setSavingCompany(true);
    const { id, ...rest } = companyProfile;
    const payload = { ...rest, org_id: selectedOrgId };

    if (id) {
      const { error } = await supabase.from("company_profiles").update(payload).eq("id", id);
      if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      else toast({ title: "Perfil da empresa salvo!" });
    } else {
      const { data: inserted, error } = await supabase.from("company_profiles").insert(payload).select().single();
      if (error) toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      else {
        setCompanyProfile({ ...companyProfile, id: inserted.id } as CompanyProfileData);
        toast({ title: "Perfil da empresa criado!" });
      }
    }
    setSavingCompany(false);
  };

  const addCompanyProduct = () => {
    if (!companyProfile) return;
    updateCompanyField("products_services", [...companyProfile.products_services, { name: "", description: "", price: "" }]);
  };
  const updateCompanyProduct = (idx: number, field: string, value: string) => {
    if (!companyProfile) return;
    const updated = [...companyProfile.products_services];
    (updated[idx] as any)[field] = value;
    updateCompanyField("products_services", updated);
  };
  const removeCompanyProduct = (idx: number) => {
    if (!companyProfile) return;
    updateCompanyField("products_services", companyProfile.products_services.filter((_, i) => i !== idx));
  };
  const addCompanyFaq = () => {
    if (!companyProfile) return;
    updateCompanyField("objections_faq", [...companyProfile.objections_faq, { question: "", answer: "" }]);
  };
  const updateCompanyFaq = (idx: number, field: string, value: string) => {
    if (!companyProfile) return;
    const updated = [...companyProfile.objections_faq];
    (updated[idx] as any)[field] = value;
    updateCompanyField("objections_faq", updated);
  };
  const removeCompanyFaq = (idx: number) => {
    if (!companyProfile) return;
    updateCompanyField("objections_faq", companyProfile.objections_faq.filter((_, i) => i !== idx));
  };

  // Metrics
  const totalUsers = users.length;
  const usersWithOrg = users.filter(u => u.org_id).length;
  const totalSales = checkoutLeads.length;
  const totalLeads = nonCheckoutLeads.length;
  const todayLeads = siteLeads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length;

  const revenueEstimate = approvedSales.reduce((sum, l) => {
    const plan = l.plan_selected || parsePlanFromMessage(l.message);
    if (plan === "Starter") return sum + 1497;
    if (plan === "Pro") return sum + 2497;
    if (plan === "Agency") return sum + 3497;
    return sum;
  }, 0);

  const renderSaleCard = (sale: SiteLead) => {
    const planName = sale.plan_selected || parsePlanFromMessage(sale.message);
    const details = parseCheckoutDetails(sale.message);
    const isExpanded = expandedSale === sale.id;
    const isPending = sale.status === "new";
    const isApproved = sale.status === "approved";
    const isRejected = sale.status === "rejected";
    const creds = createdCredentials[sale.id];
    const isCreating = creatingUser === sale.id;

    const statusColor = isPending ? "#FFB800" : isApproved ? "#00FF88" : "#FF4444";
    const statusLabel = isPending ? "Pendente" : isApproved ? "Aprovado" : "Recusado";
    const StatusIcon = isPending ? AlertCircle : isApproved ? CheckCircle2 : XCircle;

    return (
      <div
        key={sale.id}
        className="rounded-xl border overflow-hidden transition-all"
        style={{
          borderColor: isExpanded ? `${statusColor}30` : "#1a1a2e",
          background: "#0d0d18",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
        >
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${statusColor}12` }}
          >
            <StatusIcon className="h-5 w-5" style={{ color: statusColor }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">{sale.name}</span>
              {planName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0057FF]/10 text-[#00D4FF] border border-[#00D4FF]/20 font-medium">
                  {planName} — R$ {PLAN_PRICES[planName] || "?"}/mês
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{sale.email}</span>
              {sale.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{sale.phone}</span>}
              {sale.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{sale.company}</span>}
            </div>
          </div>

          <span
            className="text-[10px] px-2.5 py-1 rounded-full font-semibold shrink-0"
            style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}25` }}
          >
            {statusLabel}
          </span>

          <span className="text-[10px] text-gray-600 shrink-0">
            {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Expanded */}
        {isExpanded && (
          <div className="border-t border-[#1a1a2e] p-5 space-y-5 bg-[#08081a]/50">
            {/* Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(details).map(([key, val]) =>
                val && val !== "undefined" ? (
                  <div key={key} className="text-xs">
                    <p className="text-gray-600 mb-0.5">{key}</p>
                    <p className="text-white font-medium">{val}</p>
                  </div>
                ) : null
              )}
            </div>

            {/* Credentials if just created */}
            {creds && (
              <div className="rounded-lg border border-[#00FF88]/20 bg-[#00FF88]/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-[#00FF88] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Credenciais de acesso criadas
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-white bg-[#0A0A14] px-2 py-1 rounded">{creds.email}</code>
                      <button onClick={() => copyToClipboard(creds.email)} className="text-gray-500 hover:text-[#00D4FF]"><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Senha temporária</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-white bg-[#0A0A14] px-2 py-1 rounded">{creds.password}</code>
                      <button onClick={() => copyToClipboard(creds.password)} className="text-gray-500 hover:text-[#00D4FF]"><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Envie essas credenciais ao cliente para ele acessar a plataforma.</p>
              </div>
            )}

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
            <div className="flex items-center justify-between pt-3 border-t border-[#1a1a2e]">
              <div className="flex gap-2">
                {/* Contact actions */}
                {sale.phone && (
                  <a
                    href={`https://wa.me/${sale.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] text-[11px] font-medium hover:bg-[#25D366]/20 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <a
                  href={`mailto:${sale.email}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0057FF]/10 text-[#00D4FF] text-[11px] font-medium hover:bg-[#0057FF]/20 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              </div>

              <div className="flex gap-2">
                {/* Approve / Create User */}
                {isPending && (
                  <>
                    <button
                      onClick={() => approveSale(sale)}
                      disabled={isCreating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00FF88]/10 text-[#00FF88] text-[11px] font-semibold hover:bg-[#00FF88]/20 transition-colors border border-[#00FF88]/20 disabled:opacity-50"
                    >
                      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      {isCreating ? "Criando..." : "Aprovar e Criar Usuário"}
                    </button>
                    <button
                      onClick={() => rejectSale(sale.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Recusar
                    </button>
                  </>
                )}

                {/* Delete */}
                <button
                  onClick={() => deleteLead(sale.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-gray-600 hover:text-red-400 hover:bg-red-400/[0.05] transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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
            {(tab === "users" || tab === "leads" || tab === "pending" || (tab === "companies" && !selectedOrgId)) && (
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
                      { label: "Vendas pendentes", value: pendingSales.length, icon: AlertCircle, color: "#FFB800" },
                      { label: "Vendas aprovadas", value: approvedSales.length, icon: CheckCircle2, color: "#00FF88" },
                      { label: "Vendas recusadas", value: rejectedSales.length, icon: XCircle, color: "#FF4444" },
                      { label: "MRR estimado", value: `R$ ${revenueEstimate.toLocaleString("pt-BR")}`, icon: DollarSign, color: "#00FF88" },
                      { label: "Total de Usuários", value: totalUsers, icon: Users, color: "#0057FF" },
                      { label: "Com Organização", value: usersWithOrg, icon: Building2, color: "#00D4FF" },
                      { label: "Leads do Site", value: totalLeads, icon: FileText, color: "#00D4FF" },
                      { label: "Atividades Hoje", value: todayLeads, icon: TrendingUp, color: "#FFB800" },
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

                  <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5">
                    <h3 className="text-xs font-semibold text-white mb-4 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#00D4FF]" />
                      Resumo de Vendas
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Pendentes", count: pendingSales.length, color: "#FFB800" },
                        { label: "Aprovadas", count: approvedSales.length, color: "#00FF88" },
                        { label: "Recusadas", count: rejectedSales.length, color: "#FF4444" },
                      ].map(s => (
                        <button
                          key={s.label}
                          onClick={() => { setTab("pending"); }}
                          className="text-center p-4 rounded-lg border border-[#1a1a2e] hover:border-opacity-60 transition-all hover:bg-white/[0.02]"
                        >
                          <p className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.count}</p>
                          <p className="text-[10px] text-gray-500">{s.label}</p>
                        </button>
                      ))}
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
              {tab === "pending" && (
                <div className="space-y-6">
                  {/* Pending checkout sales */}
                  {pendingSales.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <ShoppingCart className="h-4 w-4 text-[#FFB800]" />
                        Vendas aguardando aprovação ({pendingSales.length})
                      </h2>
                      <div className="space-y-3">
                        {pendingSales.map(sale => renderSaleCard(sale))}
                      </div>
                    </div>
                  )}

                  {/* Pending users without org */}
                  {pendingUsers.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <Users className="h-4 w-4 text-[#00D4FF]" />
                        Usuários sem organização ({pendingUsers.length})
                      </h2>
                      <div className="space-y-3">
                        {pendingUsers.map(u => (
                          <div key={u.id} className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18] p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#00D4FF]/10 shrink-0">
                              <User className="h-5 w-5 text-[#00D4FF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white">{u.full_name || "Sem nome"}</p>
                              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${
                                  u.provider === "google"
                                    ? "bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20"
                                    : "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20"
                                }`}>{u.provider === "google" ? "Google" : "Email"}</span>
                              </div>
                              <p className="text-[10px] text-gray-600 mt-0.5">
                                Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={async () => {
                                  setCreatingUser(u.id);
                                  try {
                                    const session = (await supabase.auth.getSession()).data.session;
                                    const { data, error: fnError } = await supabase.functions.invoke("admin-create-user", {
                                      headers: { Authorization: `Bearer ${session?.access_token}` },
                                      body: { email: u.email, full_name: u.full_name, existing_user_id: u.id },
                                    });
                                    if (fnError || data?.error) {
                                      toast({ title: "Erro", description: data?.error || fnError?.message, variant: "destructive" });
                                    } else {
                                      toast({ title: "✅ Usuário aprovado!", description: `Organização criada para ${u.email}.` });
                                      loadData();
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                                  }
                                  setCreatingUser(null);
                                }}
                                disabled={creatingUser === u.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00FF88]/10 text-[#00FF88] text-[11px] font-semibold hover:bg-[#00FF88]/20 transition-colors border border-[#00FF88]/20 disabled:opacity-50"
                              >
                                {creatingUser === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                {creatingUser === u.id ? "Aprovando..." : "Aprovar"}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Recusar e remover o usuário ${u.email}? Esta ação não pode ser desfeita.`)) return;
                                  try {
                                    const session = (await supabase.auth.getSession()).data.session;
                                    const { error: fnError } = await supabase.functions.invoke("admin-delete-user", {
                                      headers: { Authorization: `Bearer ${session?.access_token}` },
                                      body: { user_id: u.id },
                                    });
                                    if (fnError) {
                                      toast({ title: "Erro", description: fnError.message, variant: "destructive" });
                                    } else {
                                      toast({ title: "Usuário removido." });
                                      loadData();
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                                  }
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Recusar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approved sales */}
                  {approvedSales.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <CheckCircle2 className="h-4 w-4 text-[#00FF88]" />
                        Aprovadas ({approvedSales.length})
                      </h2>
                      <div className="space-y-3">
                        {approvedSales.map(sale => renderSaleCard(sale))}
                      </div>
                    </div>
                  )}

                  {/* Rejected sales */}
                  {rejectedSales.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <XCircle className="h-4 w-4 text-[#FF4444]" />
                        Recusadas ({rejectedSales.length})
                      </h2>
                      <div className="space-y-3">
                        {rejectedSales.map(sale => renderSaleCard(sale))}
                      </div>
                    </div>
                  )}

                  {checkoutLeads.length === 0 && pendingUsers.length === 0 && (
                    <div className="text-center py-16 text-sm text-gray-600">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                      Nenhum item pendente. Tudo em dia! 🎉
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

              {/* ══════ COMPANIES TAB ══════ */}
              {tab === "companies" && (
                <div className="space-y-6">
                  {!selectedOrgId ? (
                    /* Organization List */
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">Selecione uma organização para configurar o módulo empresa.</p>
                      <div className="grid gap-3">
                        {organizations.filter(o => {
                          if (!searchQuery) return true;
                          const q = searchQuery.toLowerCase();
                          return o.name.toLowerCase().includes(q);
                        }).map(org => {
                          const ownerUser = users.find(u => u.id === org.owner_id);
                          const formUrl = `${window.location.origin}/forms/${org.form_token}`;
                          return (
                            <div
                              key={org.id}
                              className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18] p-4 flex items-center gap-4 hover:border-[#00D4FF]/20 transition-all"
                            >
                              <div
                                onClick={() => loadCompanyProfile(org.id)}
                                className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer hover:bg-white/[0.02] rounded-lg -m-2 p-2 transition-colors"
                              >
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#0057FF]/10 shrink-0">
                                  <Building2 className="h-5 w-5 text-[#00D4FF]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white">{org.name}</p>
                                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                    {ownerUser && <span className="flex items-center gap-1"><User className="h-3 w-3" />{ownerUser.full_name || ownerUser.email}</span>}
                                    <span>Criada em {new Date(org.created_at).toLocaleDateString("pt-BR")}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(formUrl);
                                    toast({ title: "Link copiado!", description: formUrl });
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0057FF]/10 text-[#00D4FF] text-[10px] font-semibold hover:bg-[#0057FF]/20 transition-colors border border-[#00D4FF]/20"
                                  title="Copiar link do formulário"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  Link de Forms
                                </button>
                                <button
                                  onClick={() => loadCompanyProfile(org.id)}
                                  className="h-8 w-8 rounded-lg bg-white/[0.03] text-gray-500 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {organizations.length === 0 && (
                          <div className="text-center py-16 text-sm text-gray-600">
                            <Building2 className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                            Nenhuma organização cadastrada.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Company Profile Editor */
                    <div className="space-y-6">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => { setSelectedOrgId(null); setCompanyProfile(null); }}
                            className="h-8 w-8 rounded-lg bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {organizations.find(o => o.id === selectedOrgId)?.name || "Organização"}
                            </p>
                            <p className="text-[10px] text-gray-500">Configurar módulo empresa</p>
                          </div>
                        </div>
                        <button
                          onClick={saveCompanyProfile}
                          disabled={savingCompany || loadingCompany}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00FF88]/10 text-[#00FF88] text-[11px] font-semibold hover:bg-[#00FF88]/20 transition-colors border border-[#00FF88]/20 disabled:opacity-50"
                        >
                          {savingCompany ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          {savingCompany ? "Salvando..." : "Salvar Tudo"}
                        </button>
                      </div>

                      {loadingCompany ? (
                        <div className="flex items-center justify-center h-64">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00D4FF]/30 border-t-[#00D4FF]" />
                        </div>
                      ) : companyProfile ? (
                        <div className="space-y-6">
                          {/* Completeness */}
                          {(() => {
                            const cp = companyProfile;
                            const fields = [
                              cp.company_name, cp.description, cp.segment, cp.mission,
                              cp.target_audience, cp.differentials, cp.tone_of_voice,
                              cp.phone, cp.email, cp.sales_process, cp.logo_url,
                              cp.products_services.length > 0 ? "yes" : "",
                              cp.objections_faq.length > 0 ? "yes" : "",
                            ];
                            const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
                            return (
                              <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-white flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#00D4FF]" /> Perfil de IA</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0057FF]/10 text-[#00D4FF] border border-[#00D4FF]/20">{completeness}% completo</span>
                                </div>
                                <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                                  <div className="h-full bg-[#00D4FF] rounded-full transition-all duration-500" style={{ width: `${completeness}%` }} />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Identity */}
                          <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5 space-y-4">
                            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-[#00D4FF]" /> Identidade
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Nome da Empresa *</label>
                                <input
                                  value={companyProfile.company_name}
                                  onChange={e => updateCompanyField("company_name", e.target.value)}
                                  className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30"
                                  placeholder="Ex: VS Soluções"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Segmento</label>
                                <input
                                  value={companyProfile.segment || ""}
                                  onChange={e => updateCompanyField("segment", e.target.value)}
                                  className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30"
                                  placeholder="Ex: Tecnologia B2B"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">CNPJ</label>
                                <input
                                  value={companyProfile.cnpj || ""}
                                  onChange={e => updateCompanyField("cnpj", e.target.value)}
                                  className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30"
                                  placeholder="00.000.000/0000-00"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Ano de Fundação</label>
                                <input
                                  type="number"
                                  value={companyProfile.founded_year || ""}
                                  onChange={e => updateCompanyField("founded_year", e.target.value ? Number(e.target.value) : null)}
                                  className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30"
                                  placeholder="2020"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Descrição</label>
                              <textarea
                                rows={3}
                                value={companyProfile.description}
                                onChange={e => updateCompanyField("description", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none"
                                placeholder="O que a empresa faz, qual problema resolve..."
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Missão</label>
                                <textarea rows={2} value={companyProfile.mission} onChange={e => updateCompanyField("mission", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="Propósito" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Visão</label>
                                <textarea rows={2} value={companyProfile.vision} onChange={e => updateCompanyField("vision", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="Onde quer chegar" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Valores</label>
                                <textarea rows={2} value={companyProfile.values} onChange={e => updateCompanyField("values", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="O que guia a empresa" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Tamanho da Equipe</label>
                                <input value={companyProfile.team_size || ""} onChange={e => updateCompanyField("team_size", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="Ex: 10-50" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Ticket Médio</label>
                                <input value={companyProfile.avg_ticket || ""} onChange={e => updateCompanyField("avg_ticket", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="Ex: R$ 2.000/mês" />
                              </div>
                            </div>
                          </div>

                          {/* Products */}
                          <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                                <Package className="h-4 w-4 text-[#00FF88]" /> Produtos & Serviços
                              </h3>
                              <button onClick={addCompanyProduct} className="flex items-center gap-1 text-[10px] text-[#00D4FF] hover:text-white transition-colors">
                                <Plus className="h-3 w-3" /> Adicionar
                              </button>
                            </div>
                            {companyProfile.products_services.length === 0 && (
                              <p className="text-xs text-gray-600 text-center py-4">Nenhum produto cadastrado.</p>
                            )}
                            {companyProfile.products_services.map((product, idx) => (
                              <div key={idx} className="p-3 rounded-lg border border-[#1a1a2e] bg-[#0A0A14]/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-gray-500">Produto {idx + 1}</span>
                                  <button onClick={() => removeCompanyProduct(idx)} className="text-gray-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <input value={product.name} onChange={e => updateCompanyProduct(idx, "name", e.target.value)} className="h-8 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-xs text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="Nome" />
                                  <input value={product.price || ""} onChange={e => updateCompanyProduct(idx, "price", e.target.value)} className="h-8 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-xs text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="Preço" />
                                </div>
                                <textarea rows={2} value={product.description} onChange={e => updateCompanyProduct(idx, "description", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-xs text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="Descrição" />
                              </div>
                            ))}
                          </div>

                          {/* Strategy */}
                          <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5 space-y-4">
                            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                              <Target className="h-4 w-4 text-[#FFB800]" /> Estratégia Comercial
                            </h3>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Público-Alvo</label>
                              <textarea rows={3} value={companyProfile.target_audience} onChange={e => updateCompanyField("target_audience", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="Cliente ideal, segmento, porte..." />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Diferenciais</label>
                              <textarea rows={3} value={companyProfile.differentials} onChange={e => updateCompanyField("differentials", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="O que diferencia da concorrência..." />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Tom de Voz</label>
                              <textarea rows={2} value={companyProfile.tone_of_voice} onChange={e => updateCompanyField("tone_of_voice", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="Profissional, consultivo..." />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Processo de Vendas</label>
                              <textarea rows={3} value={companyProfile.sales_process} onChange={e => updateCompanyField("sales_process", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="Etapas do funil, qualificação..." />
                            </div>
                          </div>

                          {/* FAQ / Objections */}
                          <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                                <HelpCircle className="h-4 w-4 text-[#FF4444]" /> Objeções & FAQ
                              </h3>
                              <button onClick={addCompanyFaq} className="flex items-center gap-1 text-[10px] text-[#00D4FF] hover:text-white transition-colors">
                                <Plus className="h-3 w-3" /> Adicionar
                              </button>
                            </div>
                            {companyProfile.objections_faq.length === 0 && (
                              <p className="text-xs text-gray-600 text-center py-4">Nenhuma objeção cadastrada.</p>
                            )}
                            {companyProfile.objections_faq.map((faq, idx) => (
                              <div key={idx} className="p-3 rounded-lg border border-[#1a1a2e] bg-[#0A0A14]/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-gray-500">Objeção {idx + 1}</span>
                                  <button onClick={() => removeCompanyFaq(idx)} className="text-gray-600 hover:text-red-400"><X className="h-3 w-3" /></button>
                                </div>
                                <input value={faq.question} onChange={e => updateCompanyFaq(idx, "question", e.target.value)} className="w-full h-8 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-xs text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="Pergunta / Objeção" />
                                <textarea rows={2} value={faq.answer} onChange={e => updateCompanyFaq(idx, "answer", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-xs text-white focus:outline-none focus:border-[#00D4FF]/30 resize-none" placeholder="Resposta / Contorno" />
                              </div>
                            ))}
                          </div>

                          {/* Contact */}
                          <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-5 space-y-4">
                            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                              <Globe className="h-4 w-4 text-[#0057FF]" /> Contato & Redes
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Telefone</label>
                                <input value={companyProfile.phone || ""} onChange={e => updateCompanyField("phone", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="+55 11 99999-9999" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
                                <input value={companyProfile.email || ""} onChange={e => updateCompanyField("email", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="contato@empresa.com" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Website</label>
                                <input value={companyProfile.website || ""} onChange={e => updateCompanyField("website", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="https://www.empresa.com" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Endereço</label>
                                <input value={companyProfile.address || ""} onChange={e => updateCompanyField("address", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="Cidade, Estado" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Instagram</label>
                                <input value={companyProfile.instagram || ""} onChange={e => updateCompanyField("instagram", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="@empresa" />
                              </div>
                              <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">LinkedIn</label>
                                <input value={companyProfile.linkedin || ""} onChange={e => updateCompanyField("linkedin", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-[#0A0A14] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/30" placeholder="linkedin.com/company/..." />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
