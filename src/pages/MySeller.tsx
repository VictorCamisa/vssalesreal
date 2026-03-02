import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  UserCheck, Building2, Brain, BookOpen, Target, Package,
  Loader2, Send, ChevronDown, ChevronUp, Sparkles, Shield, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, Users, Zap, MessageCircle, RefreshCw,
  Bot, Lightbulb, HelpCircle, Save, Plus, X, Trash2,
  ArrowDown, Radio, Clock, Workflow, Briefcase, ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ---- Types ----
type ProductItem = { name: string; description: string; price?: string };
type FaqItem = { question: string; answer: string };

type CompanyData = {
  id?: string;
  company_name: string;
  segment: string | null;
  description: string;
  mission: string;
  tone_of_voice: string;
  differentials: string;
  target_audience: string;
  sales_process: string;
  avg_ticket: string | null;
  logo_url: string | null;
  products_services: ProductItem[];
  objections_faq: FaqItem[];
  phone: string | null;
  email: string | null;
  website: string | null;
  // B2B/B2C
  business_models: string[];
  b2b_target_audience: string;
  b2b_products_services: ProductItem[];
  b2b_differentials: string;
  b2b_objections_faq: FaqItem[];
  b2b_sales_process: string;
  b2b_avg_ticket: string | null;
  b2b_tone_of_voice: string;
  b2c_target_audience: string;
  b2c_products_services: ProductItem[];
  b2c_differentials: string;
  b2c_objections_faq: FaqItem[];
  b2c_sales_process: string;
  b2c_avg_ticket: string | null;
  b2c_tone_of_voice: string;
};

type AiConfig = {
  id: string;
  config_type: string;
  enabled: boolean;
  system_prompt: string;
  temperature: number;
  instance_name: string | null;
  config: Record<string, any>;
};

type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  keywords: string[];
  processed: boolean;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

// ---- Scorecard Logic ----
type ScoreCategory = {
  label: string;
  icon: any;
  score: number;
  maxScore: number;
  items: { name: string; filled: boolean }[];
};

function computeScore(company: CompanyData | null, aiConfigs: AiConfig[], docs: KnowledgeDoc[]): ScoreCategory[] {
  const identity: ScoreCategory = {
    label: "Identidade", icon: Building2, score: 0, maxScore: 5,
    items: [
      { name: "Nome da empresa", filled: !!company?.company_name },
      { name: "Descrição", filled: !!company?.description },
      { name: "Segmento", filled: !!company?.segment },
      { name: "Logo", filled: !!company?.logo_url },
      { name: "Tom de voz", filled: !!company?.tone_of_voice },
    ],
  };
  identity.score = identity.items.filter((i) => i.filled).length;

  const strategy: ScoreCategory = {
    label: "Estratégia", icon: Target, score: 0, maxScore: 5,
    items: [
      { name: "Público-alvo", filled: !!company?.target_audience },
      { name: "Diferenciais", filled: !!company?.differentials },
      { name: "Processo de vendas", filled: !!company?.sales_process },
      { name: "Ticket médio", filled: !!company?.avg_ticket },
      { name: "Missão definida", filled: !!company?.mission },
    ],
  };
  strategy.score = strategy.items.filter((i) => i.filled).length;

  const products: ScoreCategory = {
    label: "Produtos", icon: Package, score: 0, maxScore: 3,
    items: [
      { name: "Ao menos 1 produto", filled: (company?.products_services?.length || 0) >= 1 },
      { name: "3+ produtos", filled: (company?.products_services?.length || 0) >= 3 },
      { name: "FAQ de objeções", filled: (company?.objections_faq?.length || 0) >= 1 },
    ],
  };
  products.score = products.items.filter((i) => i.filled).length;

  const ai: ScoreCategory = {
    label: "Agente IA", icon: Brain, score: 0, maxScore: 3,
    items: [
      { name: "Agente configurado", filled: aiConfigs.length > 0 },
      { name: "Agente ativo", filled: aiConfigs.some((c) => c.enabled) },
      { name: "Prompt personalizado", filled: aiConfigs.some((c) => (c.system_prompt?.length || 0) > 50) },
    ],
  };
  ai.score = ai.items.filter((i) => i.filled).length;

  const knowledge: ScoreCategory = {
    label: "Conhecimento", icon: BookOpen, score: 0, maxScore: 4,
    items: [
      { name: "1+ documento", filled: docs.length >= 1 },
      { name: "3+ documentos", filled: docs.length >= 3 },
      { name: "Docs processados", filled: docs.some((d) => d.processed) },
      { name: "5+ documentos", filled: docs.length >= 5 },
    ],
  };
  knowledge.score = knowledge.items.filter((i) => i.filled).length;

  return [identity, strategy, products, ai, knowledge];
}

// ---- Streaming helper ----
const SIMULATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-seller`;

async function streamSimulator(
  messages: ChatMsg[],
  onDelta: (full: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { onError("Não autenticado"); return; }
    const resp = await fetch(SIMULATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      onError(err.error || `Erro ${resp.status}`);
      return;
    }
    const reader = resp.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) { full += content; onDelta(full); }
        } catch {}
      }
    }
  } catch (e: any) { onError(e.message); }
  onDone();
}

function ScoreBadge({ pct }: { pct: number }) {
  if (pct >= 80) return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Pronto</Badge>;
  if (pct >= 50) return <Badge className="bg-warning/15 text-warning border-warning/30 gap-1"><AlertTriangle className="h-3 w-3" /> Parcial</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Incompleto</Badge>;
}

const SCENARIOS = [
  { label: "Lead frio", prompt: "Oi, vi a empresa de vocês na internet. O que fazem?" },
  { label: "Pedido de preço", prompt: "Quanto custa o serviço de vocês?" },
  { label: "Objeção", prompt: "Achei muito caro, o concorrente cobra menos." },
  { label: "Urgência", prompt: "Preciso de uma solução pra ontem, conseguem atender?" },
  { label: "Pós-venda", prompt: "Estou com um problema no serviço que contratei." },
];

// ---- Inline editable field ----
function EditField({ label, value, onChange, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Preencha ${label.toLowerCase()}...`}
          rows={3}
          className="text-sm resize-none"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Preencha ${label.toLowerCase()}...`}
          className="text-sm h-9"
        />
      )}
    </div>
  );
}

// ====== COMPONENT ======
export default function MySeller() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const orgId = profile?.org_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [leadsCount, setLeadsCount] = useState(0);
  const [oppsCount, setOppsCount] = useState(0);
  const [pipelineValue, setPipelineValue] = useState(0);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const [viewMode, setViewMode] = useState<"general" | "b2b" | "b2c">("general");

  // ---- Company updater ----
  const updateCompany = (field: keyof CompanyData, value: any) => {
    setCompany((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const saveCompany = async () => {
    if (!company || !orgId) return;
    setSaving("company");
    const { id, ...rest } = company;
    const payload = { ...rest, org_id: orgId };
    if (id) {
      const { error } = await supabase.from("company_profiles").update(payload).eq("id", id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Perfil salvo!" });
    } else {
      const { data: inserted, error } = await supabase.from("company_profiles").insert(payload).select().single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { setCompany({ ...company, id: inserted.id }); toast({ title: "Perfil criado!" }); }
    }
    setSaving(null);
  };

  // ---- AI config updater ----
  const updateAiConfig = (configId: string, field: keyof AiConfig, value: any) => {
    setAiConfigs((prev) => prev.map((c) => c.id === configId ? { ...c, [field]: value } : c));
  };

  const saveAiConfig = async (configId: string) => {
    const cfg = aiConfigs.find((c) => c.id === configId);
    if (!cfg) return;
    setSaving(`ai-${configId}`);
    const { error } = await supabase.from("ai_configs").update({
      system_prompt: cfg.system_prompt,
      temperature: cfg.temperature,
      enabled: cfg.enabled,
    }).eq("id", configId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Agente IA salvo!" });
    setSaving(null);
  };

  // ---- Knowledge doc updater ----
  const updateDoc = (docId: string, field: keyof KnowledgeDoc, value: any) => {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, [field]: value } : d));
  };

  const saveDoc = async (docId: string) => {
    const doc = docs.find((d) => d.id === docId);
    if (!doc) return;
    setSaving(`doc-${docId}`);
    const { error } = await supabase.from("ai_knowledge_docs").update({
      title: doc.title,
      content: doc.content,
    }).eq("id", docId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Documento salvo!" });
    setSaving(null);
  };

  const addDoc = async () => {
    if (!orgId) return;
    const { data, error } = await supabase.from("ai_knowledge_docs").insert({
      org_id: orgId, title: "Novo documento", content: "",
    }).select().single();
    if (data) setDocs((prev) => [...prev, { ...data, keywords: [], processed: false } as any]);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
  };

  const deleteDoc = async (docId: string) => {
    const { error } = await supabase.from("ai_knowledge_docs").delete().eq("id", docId);
    if (!error) setDocs((prev) => prev.filter((d) => d.id !== docId));
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  };

  // ---- Products CRUD ----
  const addProduct = () => {
    if (!company) return;
    updateCompany("products_services", [...company.products_services, { name: "", description: "", price: "" }]);
  };
  const updateProduct = (idx: number, field: string, value: string) => {
    if (!company) return;
    const updated = [...company.products_services];
    (updated[idx] as any)[field] = value;
    updateCompany("products_services", updated);
  };
  const removeProduct = (idx: number) => {
    if (!company) return;
    updateCompany("products_services", company.products_services.filter((_, i) => i !== idx));
  };

  // ---- FAQ CRUD ----
  const addFaq = () => {
    if (!company) return;
    updateCompany("objections_faq", [...company.objections_faq, { question: "", answer: "" }]);
  };
  const updateFaq = (idx: number, field: string, value: string) => {
    if (!company) return;
    const updated = [...company.objections_faq];
    (updated[idx] as any)[field] = value;
    updateCompany("objections_faq", updated);
  };
  const removeFaq = (idx: number) => {
    if (!company) return;
    updateCompany("objections_faq", company.objections_faq.filter((_, i) => i !== idx));
  };

  // ---- Fetch ----
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [companyRes, aiRes, docsRes, leadsRes, oppsRes] = await Promise.all([
        supabase.from("company_profiles").select("*").eq("org_id", orgId).maybeSingle(),
        supabase.from("ai_configs").select("*").eq("org_id", orgId),
        supabase.from("ai_knowledge_docs").select("id, title, content, summary, keywords, processed").eq("org_id", orgId),
        supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("opportunities").select("value, probability").eq("org_id", orgId),
      ]);
      if (companyRes.data) {
        const cd = companyRes.data as any;
        setCompany({
          ...cd,
          products_services: cd.products_services || [],
          objections_faq: cd.objections_faq || [],
          business_models: cd.business_models || [],
          b2b_products_services: cd.b2b_products_services || [],
          b2b_objections_faq: cd.b2b_objections_faq || [],
          b2c_products_services: cd.b2c_products_services || [],
          b2c_objections_faq: cd.b2c_objections_faq || [],
        } as CompanyData);
      } else {
        setCompany({
          company_name: "", segment: null, description: "", mission: "", tone_of_voice: "", differentials: "",
          target_audience: "", sales_process: "", avg_ticket: null, logo_url: null, products_services: [],
          objections_faq: [], phone: null, email: null, website: null,
          business_models: [],
          b2b_target_audience: "", b2b_products_services: [], b2b_differentials: "", b2b_objections_faq: [],
          b2b_sales_process: "", b2b_avg_ticket: null, b2b_tone_of_voice: "",
          b2c_target_audience: "", b2c_products_services: [], b2c_differentials: "", b2c_objections_faq: [],
          b2c_sales_process: "", b2c_avg_ticket: null, b2c_tone_of_voice: "",
        });
      }
      setAiConfigs((aiRes.data as any[]) || []);
      setDocs((docsRes.data as any[]) || []);
      setLeadsCount(leadsRes.count || 0);
      const opportunities = oppsRes.data || [];
      setOppsCount(opportunities.length);
      setPipelineValue(opportunities.reduce((s: number, o: any) => s + (Number(o.value) || 0), 0));
      setLoading(false);
    })();
  }, [orgId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = text || chatInput.trim();
      if (!msg || chatLoading) return;
      setChatInput("");
      const userMsg: ChatMsg = { role: "user", content: msg };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatLoading(true);
      const allMsgs = [...chatMessages, userMsg];
      await streamSimulator(
        allMsgs,
        (full) => {
          setChatMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: full } : m));
            return [...prev, { role: "assistant", content: full }];
          });
        },
        () => setChatLoading(false),
        (err) => { setChatMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Erro: ${err}` }]); setChatLoading(false); },
      );
    },
    [chatInput, chatMessages, chatLoading],
  );

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const categories = computeScore(company, aiConfigs, docs);
  const totalScore = categories.reduce((s, c) => s + c.score, 0);
  const totalMax = categories.reduce((s, c) => s + c.maxScore, 0);
  const overallPct = Math.round((totalScore / totalMax) * 100);
  const activeAgent = aiConfigs.find((c) => c.enabled);
  const agentRole = activeAgent?.config_type || "Nenhum";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Meu Vendedor
            </h1>
            <p className="page-description">
              Visão 360° do seu agente de vendas. Edite tudo inline e salve por seção.
            </p>
          </div>
          {/* B2B/B2C Toggle */}
          <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
            <button
              onClick={() => setViewMode("general")}
              className={`text-xs py-1.5 px-3 rounded-md transition-colors ${viewMode === "general" ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              Geral
            </button>
            <button
              onClick={() => setViewMode("b2b")}
              className={`text-xs py-1.5 px-3 rounded-md transition-colors flex items-center gap-1 ${viewMode === "b2b" ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"} ${!company?.business_models?.includes("b2b") ? "opacity-50" : ""}`}
            >
              <Briefcase className="h-3 w-3" /> B2B
            </button>
            <button
              onClick={() => setViewMode("b2c")}
              className={`text-xs py-1.5 px-3 rounded-md transition-colors flex items-center gap-1 ${viewMode === "b2c" ? "bg-card shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"} ${!company?.business_models?.includes("b2c") ? "opacity-50" : ""}`}
            >
              <ShoppingBag className="h-3 w-3" /> B2C
            </button>
          </div>
        </div>
      </div>

      {/* ====== MAIN CARD ====== */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="" className="h-full w-full rounded-2xl object-contain p-1.5" />
              ) : (
                <Bot className="h-8 w-8" />
              )}
            </div>
            {activeAgent?.enabled && (
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-success border-2 border-card flex items-center justify-center">
                <Zap className="h-2.5 w-2.5 text-success-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold truncate">{company?.company_name || "Vendedor IA"}</h2>
              <ScoreBadge pct={overallPct} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeAgent ? (
                <>Papel: <span className="font-medium text-foreground">{agentRole}</span>
                  {activeAgent.instance_name && <> · Instância: <span className="font-medium text-foreground">{activeAgent.instance_name}</span></>}
                </>
              ) : "Nenhum agente IA ativo"}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {leadsCount} leads</span>
              <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {oppsCount} oportunidades</span>
              <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> R$ {pipelineValue.toLocaleString("pt-BR")}</span>
              <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {docs.length} docs</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Preparo do Vendedor</span>
            <span className="font-bold text-lg">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-3" />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {categories.map((cat) => {
            const pct = Math.round((cat.score / cat.maxScore) * 100);
            const Icon = cat.icon;
            return (
              <div key={cat.label} className="glass rounded-xl p-3 text-center space-y-1.5">
                <Icon className={`h-4 w-4 mx-auto ${pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`} />
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{cat.label}</p>
                <p className="text-sm font-bold">{cat.score}/{cat.maxScore}</p>
                <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ====== EDITABLE SECTIONS ====== */}
      <div className="space-y-2">

        {/* ---- IDENTITY (editable) ---- */}
        <Collapsible open={openSections["identity"]} onOpenChange={() => toggleSection("identity")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  {viewMode === "b2b" ? <Briefcase className="h-4 w-4 text-primary" /> : viewMode === "b2c" ? <ShoppingBag className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">
                    {viewMode === "b2b" ? "Perfil B2B — Empresas" : viewMode === "b2c" ? "Perfil B2C — Consumidores" : "Identidade & Tom de Voz"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{company?.company_name || "Não configurado"} · {company?.segment || "Sem segmento"}</p>
                </div>
              </div>
              {openSections["identity"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-4 animate-fade-in">
            {viewMode === "general" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <EditField label="Nome da Empresa" value={company?.company_name || ""} onChange={(v) => updateCompany("company_name", v)} placeholder="Ex: VS Soluções" />
                  <EditField label="Segmento" value={company?.segment || ""} onChange={(v) => updateCompany("segment", v)} placeholder="Ex: Tecnologia B2B" />
                </div>
                <EditField label="Descrição" value={company?.description || ""} onChange={(v) => updateCompany("description", v)} multiline placeholder="O que sua empresa faz?" />
                <div className="grid grid-cols-2 gap-4">
                  <EditField label="Missão" value={company?.mission || ""} onChange={(v) => updateCompany("mission", v)} multiline placeholder="Propósito da empresa" />
                  <EditField label="Tom de Voz" value={company?.tone_of_voice || ""} onChange={(v) => updateCompany("tone_of_voice", v)} multiline placeholder="Ex: Profissional mas acessível" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <EditField label="Diferenciais" value={company?.differentials || ""} onChange={(v) => updateCompany("differentials", v)} multiline placeholder="O que te diferencia?" />
                  <EditField label="Público-alvo" value={company?.target_audience || ""} onChange={(v) => updateCompany("target_audience", v)} multiline placeholder="Quem é o cliente ideal?" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <EditField label="Processo de Vendas" value={company?.sales_process || ""} onChange={(v) => updateCompany("sales_process", v)} multiline placeholder="Como funciona sua venda?" />
                  <EditField label="Ticket Médio" value={company?.avg_ticket || ""} onChange={(v) => updateCompany("avg_ticket", v)} placeholder="Ex: R$ 2.000/mês" />
                </div>
              </>
            ) : (
              <>
                {/* B2B or B2C specific fields */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  <p className="font-medium flex items-center gap-1.5">
                    {viewMode === "b2b" ? <Briefcase className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                    Perfil {viewMode === "b2b" ? "B2B" : "B2C"} — dados exclusivos para este modelo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Esses dados serão injetados na IA quando o contexto for {viewMode === "b2b" ? "empresarial" : "consumidor final"}.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <EditField label={`Público-Alvo (${viewMode.toUpperCase()})`} value={(company as any)?.[`${viewMode}_target_audience`] || ""} onChange={(v) => updateCompany(`${viewMode}_target_audience` as any, v)} multiline placeholder={viewMode === "b2b" ? "Empresas, porte, segmento, decisor..." : "Perfil demográfico, interesses, ocasiões..."} />
                  <EditField label={`Tom de Voz (${viewMode.toUpperCase()})`} value={(company as any)?.[`${viewMode}_tone_of_voice`] || ""} onChange={(v) => updateCompany(`${viewMode}_tone_of_voice` as any, v)} multiline placeholder={viewMode === "b2b" ? "Profissional, consultivo, dados e ROI" : "Amigável, leve, experiência e emoção"} />
                </div>
                <EditField label={`Diferenciais (${viewMode.toUpperCase()})`} value={(company as any)?.[`${viewMode}_differentials`] || ""} onChange={(v) => updateCompany(`${viewMode}_differentials` as any, v)} multiline placeholder={viewMode === "b2b" ? "Logística, preço por volume, suporte..." : "Qualidade, experiência, praticidade..."} />
                <div className="grid grid-cols-2 gap-4">
                  <EditField label={`Processo de Vendas (${viewMode.toUpperCase()})`} value={(company as any)?.[`${viewMode}_sales_process`] || ""} onChange={(v) => updateCompany(`${viewMode}_sales_process` as any, v)} multiline placeholder={viewMode === "b2b" ? "Prospecção → BANT → Proposta → Fechamento" : "Interesse → Recomendação → Pedido"} />
                  <EditField label={`Ticket Médio (${viewMode.toUpperCase()})`} value={(company as any)?.[`${viewMode}_avg_ticket`] || ""} onChange={(v) => updateCompany(`${viewMode}_avg_ticket` as any, v)} placeholder={viewMode === "b2b" ? "Ex: R$ 5.000/mês" : "Ex: R$ 200"} />
                </div>
              </>
            )}
            <div className="flex justify-end">
              <Button onClick={saveCompany} disabled={saving === "company"} size="sm" className="gap-1.5">
                {saving === "company" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ---- PRODUCTS (editable) ---- */}
        <Collapsible open={openSections["products"]} onOpenChange={() => toggleSection("products")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-chart-4/15 flex items-center justify-center"><Package className="h-4 w-4 text-chart-4" /></div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Produtos & Objeções</p>
                  <p className="text-[11px] text-muted-foreground">{company?.products_services?.length || 0} produtos · {company?.objections_faq?.length || 0} objeções</p>
                </div>
              </div>
              {openSections["products"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-4 animate-fade-in">
            {/* Products */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Produtos / Serviços</Label>
                <Button variant="outline" size="sm" onClick={addProduct} className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Produto</Button>
              </div>
              {company?.products_services?.map((p, i) => (
                <div key={i} className="rounded-lg border bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={p.name} onChange={(e) => updateProduct(i, "name", e.target.value)} placeholder="Nome do produto" className="text-sm h-8 flex-1" />
                    <Input value={p.price || ""} onChange={(e) => updateProduct(i, "price", e.target.value)} placeholder="Preço" className="text-sm h-8 w-32" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeProduct(i)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Textarea value={p.description} onChange={(e) => updateProduct(i, "description", e.target.value)} placeholder="Descrição do produto..." rows={2} className="text-sm resize-none" />
                </div>
              ))}
              {!company?.products_services?.length && <p className="text-sm text-muted-foreground italic text-center py-3">Nenhum produto cadastrado</p>}
            </div>

            {/* Objections FAQ */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><HelpCircle className="h-3 w-3" /> Objeções & Respostas</Label>
                <Button variant="outline" size="sm" onClick={addFaq} className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Objeção</Button>
              </div>
              {company?.objections_faq?.map((faq, i) => (
                <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={faq.question} onChange={(e) => updateFaq(i, "question", e.target.value)} placeholder="Ex: Está caro..." className="text-sm h-8 flex-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeFaq(i)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Textarea value={faq.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} placeholder="Como contornar essa objeção..." rows={2} className="text-sm resize-none" />
                </div>
              ))}
              {!company?.objections_faq?.length && <p className="text-sm text-muted-foreground italic text-center py-3">Nenhuma objeção mapeada</p>}
            </div>

            <div className="flex justify-end">
              <Button onClick={saveCompany} disabled={saving === "company"} size="sm" className="gap-1.5">
                {saving === "company" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar Produtos
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ---- AI AGENT (editable) ---- */}
        <Collapsible open={openSections["ai"]} onOpenChange={() => toggleSection("ai")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center"><Brain className="h-4 w-4 text-success" /></div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Agente IA</p>
                  <p className="text-[11px] text-muted-foreground">{aiConfigs.length} configurações · {aiConfigs.filter((c) => c.enabled).length} ativas</p>
                </div>
              </div>
              {openSections["ai"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-4 animate-fade-in">
            {aiConfigs.length > 0 ? (
              aiConfigs.map((cfg) => (
                <div key={cfg.id} className="rounded-lg border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{cfg.config_type}</p>
                      {cfg.instance_name && <Badge variant="outline" className="text-[10px]">{cfg.instance_name}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Ativo</Label>
                      <Switch checked={cfg.enabled} onCheckedChange={(v) => updateAiConfig(cfg.id, "enabled", v)} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Prompt do Sistema</Label>
                    <Textarea
                      value={cfg.system_prompt || ""}
                      onChange={(e) => updateAiConfig(cfg.id, "system_prompt", e.target.value)}
                      placeholder="Defina a personalidade e comportamento do agente..."
                      rows={6}
                      className="text-sm resize-none font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Temperatura: {cfg.temperature}</Label>
                    </div>
                    <Slider
                      value={[cfg.temperature]}
                      onValueChange={([v]) => updateAiConfig(cfg.id, "temperature", v)}
                      min={0} max={1} step={0.1}
                      className="py-2"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>Preciso</span><span>Criativo</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => saveAiConfig(cfg.id)} disabled={saving === `ai-${cfg.id}`} size="sm" className="gap-1.5">
                      {saving === `ai-${cfg.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar Agente
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum agente configurado. Configure em Agente IA.</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ---- KNOWLEDGE (editable) ---- */}
        <Collapsible open={openSections["knowledge"]} onOpenChange={() => toggleSection("knowledge")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center"><BookOpen className="h-4 w-4 text-warning" /></div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Base de Conhecimento</p>
                  <p className="text-[11px] text-muted-foreground">{docs.length} documentos · {docs.filter((d) => d.processed).length} processados</p>
                </div>
              </div>
              {openSections["knowledge"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-3 animate-fade-in">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addDoc} className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Documento</Button>
            </div>
            {docs.length > 0 ? (
              docs.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-secondary/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={doc.title} onChange={(e) => updateDoc(doc.id, "title", e.target.value)} placeholder="Título do documento" className="text-sm h-8 flex-1 font-medium" />
                    <Badge className={doc.processed ? "bg-success/15 text-success border-success/30 text-[9px]" : "bg-secondary text-muted-foreground text-[9px]"}>
                      {doc.processed ? "Processado" : "Pendente"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteDoc(doc.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Textarea value={doc.content} onChange={(e) => updateDoc(doc.id, "content", e.target.value)} placeholder="Conteúdo do documento..." rows={4} className="text-sm resize-none" />
                  {doc.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.keywords.slice(0, 8).map((k, i) => <Badge key={i} variant="outline" className="text-[9px] h-4">{k}</Badge>)}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={() => saveDoc(doc.id)} disabled={saving === `doc-${doc.id}`} size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                      {saving === `doc-${doc.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum documento na base</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Checklist */}
        {overallPct < 100 && (
          <Collapsible open={openSections["checklist"]} onOpenChange={() => toggleSection("checklist")}>
            <CollapsibleTrigger asChild>
              <button className="w-full glass-card p-4 flex items-center justify-between hover:border-warning/30 transition-colors border-warning/20">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center"><Lightbulb className="h-4 w-4 text-warning" /></div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">O que falta para {100 - overallPct > 30 ? "ativar" : "completar"} seu vendedor</p>
                    <p className="text-[11px] text-muted-foreground">{totalMax - totalScore} itens pendentes</p>
                  </div>
                </div>
                {openSections["checklist"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-2 animate-fade-in">
              {categories.flatMap((cat) =>
                cat.items.filter((item) => !item.filled).map((item) => (
                  <div key={`${cat.label}-${item.name}`} className="flex items-center gap-2 text-sm">
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="text-muted-foreground">{cat.label}:</span>
                    <span>{item.name}</span>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

        {/* ---- WORKFLOW / PIPELINE STEPS ---- */}
        <Collapsible open={openSections["workflow"]} onOpenChange={() => toggleSection("workflow")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Workflow className="h-4 w-4 text-primary" /></div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Fluxo do Agente — Como Tudo Funciona</p>
                  <p className="text-[11px] text-muted-foreground">Passo a passo do que acontece quando você dispara e o lead responde</p>
                </div>
              </div>
              {openSections["workflow"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-5 space-y-0 animate-fade-in">
            {(() => {
              const hasEvolution = true; // assumed configured
              const hasAiConfig = aiConfigs.length > 0;
              const hasActiveAgent = aiConfigs.some((c) => c.enabled);
              const hasKnowledge = docs.length > 0;
              const hasProducts = (company?.products_services?.length || 0) > 0;

              const steps = [
                {
                  icon: Radio,
                  title: "1. Disparo de Campanha",
                  desc: "Você cria um broadcast e seleciona os leads. O sistema envia as mensagens via WhatsApp em lotes de 50, com delay humanizado entre cada envio.",
                  agent: "Motor de Disparos",
                  status: "always" as const,
                  detail: "Variáveis como {nome} são substituídas automaticamente. Se IA estiver ativa, gera mensagens personalizadas.",
                },
                {
                  icon: MessageCircle,
                  title: "2. Lead Responde no WhatsApp",
                  desc: "A mensagem do lead chega via webhook da Evolution API e é processada automaticamente.",
                  agent: "Webhook Receptor",
                  status: hasEvolution ? "active" as const : "inactive" as const,
                  detail: "O sistema identifica qual organização e instância recebeu a mensagem, cria/atualiza o tracker de conversa e incrementa o contador de mensagens.",
                },
                {
                  icon: Brain,
                  title: "3. IA Gera a Resposta",
                  desc: "O agente de IA monta o contexto completo (empresa + produtos + objeções + base de conhecimento) e gera uma resposta natural.",
                  agent: "Agente de Vendas IA",
                  status: hasActiveAgent ? "active" as const : "inactive" as const,
                  detail: hasKnowledge
                    ? `Usando ${docs.length} docs da base + ${company?.products_services?.length || 0} produtos + ${company?.objections_faq?.length || 0} objeções como contexto.`
                    : "⚠️ Sem base de conhecimento. A IA responde só com dados da empresa.",
                },
                {
                  icon: Zap,
                  title: "4. Resposta Enviada em Blocos",
                  desc: "A resposta é fragmentada em blocos curtos e enviada com delays variáveis, simulando digitação humana real.",
                  agent: "Motor de Envio Humanizado",
                  status: "always" as const,
                  detail: "Cada bloco de 1-2 linhas é enviado com 1-3s de intervalo, calculado pelo tamanho do texto.",
                },
                {
                  icon: Clock,
                  title: "5. Follow-up Automático",
                  desc: "Se o lead não responder, o sistema de follow-up envia mensagens de reativação baseadas nas regras configuradas.",
                  agent: "Motor de Follow-up",
                  status: hasAiConfig ? "active" as const : "inactive" as const,
                  detail: "Cada etapa tem um delay configurável (ex: 30min, 2h, 24h). A IA varia a abordagem a cada step. Quando o lead responde, o follow-up reseta.",
                },
                {
                  icon: TrendingUp,
                  title: "6. Pipeline Atualiza Automaticamente",
                  desc: "O CRM move o lead pelo pipeline baseado no engajamento: 3+ respostas avança para prospecção, 5+ qualifica via BANT.",
                  agent: "Motor de Pipeline",
                  status: hasAiConfig ? "active" as const : "inactive" as const,
                  detail: "Automação roda periodicamente, analisa conversas ativas e envia mensagens personalizadas conforme o estágio do lead no pipeline.",
                },
                {
                  icon: Target,
                  title: "7. Agendamento Autônomo",
                  desc: "Se o lead pedir para agendar uma reunião, a IA detecta e cria o agendamento automaticamente no sistema.",
                  agent: "Agente de Agendamento",
                  status: hasActiveAgent ? "active" as const : "inactive" as const,
                  detail: "Comandos invisíveis [AGENDAR:DATA:HORA:NOME] são processados sem que o lead veja. Suporta cancelamento e verificação de agenda.",
                },
              ];

              return (
                <div className="relative">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = step.status === "active" || step.status === "always";
                    return (
                      <div key={i} className="relative flex gap-4">
                        {/* Vertical line */}
                        <div className="flex flex-col items-center">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground border border-border"
                          }`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          {i < steps.length - 1 && (
                            <div className={`w-0.5 flex-1 min-h-[24px] my-1 ${isActive ? "bg-primary/30" : "bg-border"}`} />
                          )}
                        </div>
                        {/* Content */}
                        <div className="pb-5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.title}</p>
                            <Badge variant={isActive ? "default" : "secondary"} className="text-[9px] h-4 px-1.5">
                              {step.agent}
                            </Badge>
                            {step.status === "inactive" && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1.5">Inativo</Badge>
                            )}
                          </div>
                          <p className={`text-xs mt-1 ${isActive ? "text-muted-foreground" : "text-muted-foreground/60"}`}>{step.desc}</p>
                          <p className={`text-[11px] mt-1.5 rounded-md px-2 py-1 inline-block ${
                            isActive ? "bg-secondary/60 text-muted-foreground" : "bg-secondary/30 text-muted-foreground/50"
                          }`}>{step.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CollapsibleContent>
        </Collapsible>

      {/* ====== SIMULATOR ====== */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center"><MessageCircle className="h-4 w-4 text-primary-foreground" /></div>
            <div>
              <p className="text-sm font-semibold">Simulador de Conversa</p>
              <p className="text-[11px] text-muted-foreground">Teste como seu vendedor responde em tempo real</p>
            </div>
          </div>
          {chatMessages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setChatMessages([])} className="gap-1 text-xs"><RefreshCw className="h-3 w-3" /> Limpar</Button>
          )}
        </div>

        {chatMessages.length === 0 && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Cenários prontos para testar:</p>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <Button key={s.label} variant="outline" size="sm" className="text-xs h-8" onClick={() => sendMessage(s.prompt)}>
                  <Sparkles className="h-3 w-3 mr-1" /> {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="h-80">
          <div className="p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary rounded-bl-md"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Simule uma mensagem de lead..." className="flex-1" disabled={chatLoading} />
            <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
