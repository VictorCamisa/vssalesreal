import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import {
  UserCheck, Building2, Brain, BookOpen, Target, MessageSquare, Package,
  Loader2, Send, ChevronDown, ChevronUp, Sparkles, Shield, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, Users, Zap, MessageCircle, RefreshCw,
  Bot, Lightbulb, HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ---- Types ----
type CompanyData = {
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
  products_services: { name: string; description: string; price?: string }[];
  objections_faq: { question: string; answer: string }[];
  phone: string | null;
  email: string | null;
  website: string | null;
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
    label: "Identidade",
    icon: Building2,
    score: 0,
    maxScore: 5,
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
    label: "Estratégia",
    icon: Target,
    score: 0,
    maxScore: 5,
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
    label: "Produtos",
    icon: Package,
    score: 0,
    maxScore: 3,
    items: [
      { name: "Ao menos 1 produto", filled: (company?.products_services?.length || 0) >= 1 },
      { name: "3+ produtos", filled: (company?.products_services?.length || 0) >= 3 },
      { name: "FAQ de objeções", filled: (company?.objections_faq?.length || 0) >= 1 },
    ],
  };
  products.score = products.items.filter((i) => i.filled).length;

  const ai: ScoreCategory = {
    label: "Agente IA",
    icon: Brain,
    score: 0,
    maxScore: 3,
    items: [
      { name: "Agente configurado", filled: aiConfigs.length > 0 },
      { name: "Agente ativo", filled: aiConfigs.some((c) => c.enabled) },
      { name: "Prompt personalizado", filled: aiConfigs.some((c) => (c.system_prompt?.length || 0) > 50) },
    ],
  };
  ai.score = ai.items.filter((i) => i.filled).length;

  const knowledge: ScoreCategory = {
    label: "Conhecimento",
    icon: BookOpen,
    score: 0,
    maxScore: 4,
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
    const resp = await fetch(SIMULATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
          if (content) {
            full += content;
            onDelta(full);
          }
        } catch {}
      }
    }
  } catch (e: any) {
    onError(e.message);
  }
  onDone();
}

// ---- Score Badge ----
function ScoreBadge({ pct }: { pct: number }) {
  if (pct >= 80) return <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Pronto</Badge>;
  if (pct >= 50) return <Badge className="bg-warning/15 text-warning border-warning/30 gap-1"><AlertTriangle className="h-3 w-3" /> Parcial</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Incompleto</Badge>;
}

// ---- CHAT SCENARIOS ----
const SCENARIOS = [
  { label: "Lead frio", prompt: "Oi, vi a empresa de vocês na internet. O que fazem?" },
  { label: "Pedido de preço", prompt: "Quanto custa o serviço de vocês?" },
  { label: "Objeção", prompt: "Achei muito caro, o concorrente cobra menos." },
  { label: "Urgência", prompt: "Preciso de uma solução pra ontem, conseguem atender?" },
  { label: "Pós-venda", prompt: "Estou com um problema no serviço que contratei." },
];

// ====== COMPONENT ======
export default function MySeller() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [leadsCount, setLeadsCount] = useState(0);
  const [oppsCount, setOppsCount] = useState(0);
  const [pipelineValue, setPipelineValue] = useState(0);

  // Chat simulator
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Expandable sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Fetch all data
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [companyRes, aiRes, docsRes, leadsRes, oppsRes] = await Promise.all([
        supabase.from("company_profiles").select("*").eq("org_id", orgId).maybeSingle(),
        supabase.from("ai_configs").select("*").eq("org_id", orgId),
        supabase.from("ai_knowledge_docs").select("id, title, summary, keywords, processed").eq("org_id", orgId),
        supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("opportunities").select("value, probability").eq("org_id", orgId),
      ]);

      if (companyRes.data) {
        setCompany({
          ...companyRes.data,
          products_services: (companyRes.data.products_services as any) || [],
          objections_faq: (companyRes.data.objections_faq as any) || [],
        } as CompanyData);
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

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: full } : m));
            }
            return [...prev, { role: "assistant", content: full }];
          });
        },
        () => setChatLoading(false),
        (err) => {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: `⚠️ Erro: ${err}` },
          ]);
          setChatLoading(false);
        },
      );
    },
    [chatInput, chatMessages, chatLoading],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
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
        <h1 className="page-title flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" /> Meu Vendedor
        </h1>
        <p className="page-description">
          Visão 360° do seu agente de vendas: personalidade, conhecimento, preparo e simulador.
        </p>
      </div>

      {/* ====== MAIN CARD: Agent Summary ====== */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
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

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold truncate">
                {company?.company_name || "Vendedor IA"}
              </h2>
              <ScoreBadge pct={overallPct} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeAgent ? (
                <>
                  Papel: <span className="font-medium text-foreground">{agentRole}</span>
                  {activeAgent.instance_name && (
                    <> · Instância: <span className="font-medium text-foreground">{activeAgent.instance_name}</span></>
                  )}
                </>
              ) : (
                "Nenhum agente IA ativo"
              )}
            </p>

            {/* Quick stats */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {leadsCount} leads
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> {oppsCount} oportunidades
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> R$ {pipelineValue.toLocaleString("pt-BR")}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> {docs.length} docs
              </span>
            </div>
          </div>
        </div>

        {/* Scorecard bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" /> Preparo do Vendedor
            </span>
            <span className="font-bold text-lg">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-3" />
        </div>

        {/* Category scores */}
        <div className="grid grid-cols-5 gap-2">
          {categories.map((cat) => {
            const pct = Math.round((cat.score / cat.maxScore) * 100);
            const Icon = cat.icon;
            return (
              <div
                key={cat.label}
                className="glass rounded-xl p-3 text-center space-y-1.5"
              >
                <Icon className={`h-4 w-4 mx-auto ${pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`} />
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{cat.label}</p>
                <p className="text-sm font-bold">{cat.score}/{cat.maxScore}</p>
                <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ====== EXPANDABLE SECTIONS ====== */}
      <div className="space-y-2">
        {/* Company Identity */}
        <Collapsible open={openSections["identity"]} onOpenChange={() => toggleSection("identity")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Identidade & Tom de Voz</p>
                  <p className="text-[11px] text-muted-foreground">
                    {company?.company_name || "Não configurado"} · {company?.segment || "Sem segmento"}
                  </p>
                </div>
              </div>
              {openSections["identity"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Descrição</p>
                <p className="text-sm mt-1">{company?.description || <span className="text-muted-foreground italic">Não preenchido</span>}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Missão</p>
                <p className="text-sm mt-1">{company?.mission || <span className="text-muted-foreground italic">Não preenchido</span>}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tom de Voz</p>
              <p className="text-sm mt-1">{company?.tone_of_voice || <span className="text-muted-foreground italic">Não definido</span>}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Diferenciais</p>
                <p className="text-sm mt-1">{company?.differentials || <span className="text-muted-foreground italic">Não preenchido</span>}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Público-alvo</p>
                <p className="text-sm mt-1">{company?.target_audience || <span className="text-muted-foreground italic">Não preenchido</span>}</p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Products */}
        <Collapsible open={openSections["products"]} onOpenChange={() => toggleSection("products")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-chart-4/15 flex items-center justify-center">
                  <Package className="h-4 w-4 text-chart-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Produtos & Objeções</p>
                  <p className="text-[11px] text-muted-foreground">
                    {company?.products_services?.length || 0} produtos · {company?.objections_faq?.length || 0} objeções mapeadas
                  </p>
                </div>
              </div>
              {openSections["products"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-3 animate-fade-in">
            {company?.products_services?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {company.products_services.map((p, i) => (
                  <div key={i} className="rounded-lg bg-secondary/50 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.price && <Badge variant="outline" className="text-[10px]">{p.price}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum produto cadastrado</p>
            )}

            {(company?.objections_faq?.length || 0) > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" /> Objeções Mapeadas
                </p>
                {company!.objections_faq.map((faq, i) => (
                  <div key={i} className="rounded-lg bg-destructive/5 p-3 space-y-1">
                    <p className="text-xs font-medium text-destructive">❓ {faq.question}</p>
                    <p className="text-xs text-muted-foreground">✅ {faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* AI Agent */}
        <Collapsible open={openSections["ai"]} onOpenChange={() => toggleSection("ai")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-success" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Agente IA</p>
                  <p className="text-[11px] text-muted-foreground">
                    {aiConfigs.length} configurações · {aiConfigs.filter((c) => c.enabled).length} ativas
                  </p>
                </div>
              </div>
              {openSections["ai"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-3 animate-fade-in">
            {aiConfigs.length > 0 ? (
              aiConfigs.map((cfg) => (
                <div key={cfg.id} className="rounded-lg bg-secondary/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{cfg.config_type}</p>
                      {cfg.instance_name && <Badge variant="outline" className="text-[10px]">{cfg.instance_name}</Badge>}
                    </div>
                    <Badge className={cfg.enabled ? "bg-success/15 text-success border-success/30" : "bg-secondary text-muted-foreground"}>
                      {cfg.enabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {cfg.system_prompt?.slice(0, 200) || "Sem prompt personalizado"}
                    {(cfg.system_prompt?.length || 0) > 200 && "..."}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Temperatura: {cfg.temperature}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum agente configurado</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Knowledge */}
        <Collapsible open={openSections["knowledge"]} onOpenChange={() => toggleSection("knowledge")}>
          <CollapsibleTrigger asChild>
            <button className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-warning" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Base de Conhecimento</p>
                  <p className="text-[11px] text-muted-foreground">
                    {docs.length} documentos · {docs.filter((d) => d.processed).length} processados
                  </p>
                </div>
              </div>
              {openSections["knowledge"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-2 animate-fade-in">
            {docs.length > 0 ? (
              docs.map((doc) => (
                <div key={doc.id} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3">
                  <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    {doc.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{doc.summary}</p>}
                    {doc.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {doc.keywords.slice(0, 5).map((k, i) => (
                          <Badge key={i} variant="outline" className="text-[9px] h-4">{k}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge className={doc.processed ? "bg-success/15 text-success border-success/30 text-[9px]" : "bg-secondary text-muted-foreground text-[9px]"}>
                    {doc.processed ? "OK" : "Pendente"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum documento na base</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Checklist of missing items */}
        {overallPct < 100 && (
          <Collapsible open={openSections["checklist"]} onOpenChange={() => toggleSection("checklist")}>
            <CollapsibleTrigger asChild>
              <button className="w-full glass-card p-4 flex items-center justify-between hover:border-warning/30 transition-colors border-warning/20">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center">
                    <Lightbulb className="h-4 w-4 text-warning" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">O que falta para {100 - overallPct > 30 ? "ativar" : "completar"} seu vendedor</p>
                    <p className="text-[11px] text-muted-foreground">
                      {totalMax - totalScore} itens pendentes
                    </p>
                  </div>
                </div>
                {openSections["checklist"] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="glass-card border-t-0 rounded-t-none p-4 space-y-2 animate-fade-in">
              {categories.flatMap((cat) =>
                cat.items
                  .filter((item) => !item.filled)
                  .map((item) => (
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

      {/* ====== SIMULATOR ====== */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Simulador de Conversa</p>
              <p className="text-[11px] text-muted-foreground">Teste como seu vendedor responde em tempo real</p>
            </div>
          </div>
          {chatMessages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChatMessages([])}
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>

        {/* Scenarios */}
        {chatMessages.length === 0 && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Cenários prontos para testar:</p>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <Button
                  key={s.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => sendMessage(s.prompt)}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="h-80">
          <div className="p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Simule uma mensagem de lead..."
              className="flex-1"
              disabled={chatLoading}
            />
            <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
