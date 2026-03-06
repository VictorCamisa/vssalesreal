import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Loader2, Sparkles, CheckCircle2, BookOpen,
  Settings2, MessageCircle, AlertTriangle, ChevronDown, ChevronUp,
  Save, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";

type Contact = {
  remote_jid: string;
  push_name: string | null;
  customer_msg_count: number;
  last_customer_msg_at: string;
  detected_audience: string | null;
};

type Analysis = {
  summary: string;
  rules: string[];
  model_responses: { situation: string; response: string }[];
  prompt_adjustments: { scenario_key: string; action: string; text: string }[];
  knowledge_doc_title: string;
  knowledge_doc_content: string;
};

interface Props {
  contacts: Contact[];
  onClose: () => void;
  orgId: string;
}

const formatPhone = (jid: string) => {
  const digits = jid.replace(/@.*/, "");
  if (digits.length >= 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return `+${digits}`;
};

export default function ConversationReview({ contacts, onClose, orgId }: Props) {
  const { toast } = useToast();
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [applied, setApplied] = useState(false);

  // Approval toggles
  const [applyRules, setApplyRules] = useState(true);
  const [applyPromptAdj, setApplyPromptAdj] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ rules: true, responses: true, prompts: true });

  const toggleJid = (jid: string) => {
    setSelectedJids(prev => {
      const next = new Set(prev);
      next.has(jid) ? next.delete(jid) : next.add(jid);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedJids.size === contacts.length) {
      setSelectedJids(new Set());
    } else {
      setSelectedJids(new Set(contacts.map(c => c.remote_jid)));
    }
  };

  const handleAnalyze = async () => {
    if (!selectedJids.size) { toast({ title: "Selecione ao menos 1 conversa", variant: "destructive" }); return; }
    if (!feedback.trim()) { toast({ title: "Descreva o que precisa melhorar", variant: "destructive" }); return; }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("review-conversations", {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: { action: "analyze", remote_jids: Array.from(selectedJids), feedback },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (e: any) {
      toast({ title: "Erro na análise", description: e.message, variant: "destructive" });
    }
    setAnalyzing(false);
  };

  const handleApply = async () => {
    if (!analysis) return;
    setApplying(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("review-conversations", {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: {
          action: "apply",
          analysis,
          apply_rules: applyRules,
          apply_prompt_adjustments: applyPromptAdj,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setApplied(true);
      toast({ title: "Correções aplicadas!", description: (data.results || []).join(". ") });
    } catch (e: any) {
      toast({ title: "Erro ao aplicar", description: e.message, variant: "destructive" });
    }
    setApplying(false);
  };

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4 -mt-2 sm:-mx-6 lg:-mx-8 rounded-2xl overflow-hidden border border-border/50 bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Revisar Conversas
          </h2>
          <p className="text-xs text-muted-foreground">
            Selecione conversas problemáticas e ensine a IA a melhorar
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Selection + Feedback */}
        <div className="lg:w-[380px] border-r border-border/50 flex flex-col overflow-hidden shrink-0">
          {/* Contact selection */}
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedJids.size} de {contacts.length} selecionadas
            </span>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
              {selectedJids.size === contacts.length ? "Desmarcar" : "Selecionar"} todas
            </Button>
          </div>

          <ScrollArea className="flex-1 max-h-[220px] lg:max-h-none">
            <div className="divide-y divide-border/30">
              {contacts.map(c => (
                <button
                  key={c.remote_jid}
                  onClick={() => toggleJid(c.remote_jid)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                    selectedJids.has(c.remote_jid) ? "bg-primary/10" : "hover:bg-secondary/40"
                  }`}
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedJids.has(c.remote_jid)
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30"
                  }`}>
                    {selectedJids.has(c.remote_jid) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.push_name || formatPhone(c.remote_jid)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatPhone(c.remote_jid)}</p>
                  </div>
                  {c.detected_audience && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">{c.detected_audience.toUpperCase()}</Badge>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Feedback input */}
          <div className="p-3 border-t border-border/50 space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> O que está errado?
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Ex: O bot está inventando produtos que não existem, oferecendo descontos sem autorização, repetindo a mesma frase..."
              rows={4}
              className="text-sm resize-none"
            />
            <Button
              className="w-full gap-2 rounded-xl"
              onClick={handleAnalyze}
              disabled={analyzing || !selectedJids.size || !feedback.trim()}
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? "Analisando..." : "Analisar e Sugerir Correções"}
            </Button>
          </div>
        </div>

        {/* Right: Analysis results */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {!analysis && !analyzing && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
                <Sparkles className="h-12 w-12 opacity-20 mb-3" />
                <p className="text-sm font-medium">Aguardando análise</p>
                <p className="text-xs mt-1 max-w-[280px] text-center">
                  Selecione as conversas com problemas, descreva o que não gostou e clique em analisar
                </p>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                <p className="text-sm font-medium">Analisando conversas...</p>
                <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos</p>
              </div>
            )}

            {analysis && (
              <div className="p-4 space-y-4">
                {applied && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <p className="text-sm text-success font-medium">Correções aplicadas com sucesso!</p>
                  </div>
                )}

                {/* Summary */}
                <div className="p-3 rounded-xl bg-secondary/40 border border-border/30">
                  <p className="text-sm font-medium mb-1">📋 Resumo</p>
                  <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                </div>

                {/* Rules */}
                {analysis.rules?.length > 0 && (
                  <Collapsible open={openSections.rules} onOpenChange={() => toggleSection("rules")}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Regras de Comportamento</span>
                        <Badge variant="secondary" className="text-[10px]">{analysis.rules.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={applyRules} onCheckedChange={setApplyRules} />
                        {openSections.rules ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1.5 pl-2">
                      {analysis.rules.map((rule, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-card border border-border/30">
                          <span className="text-primary text-xs font-bold mt-0.5">•</span>
                          <p className="text-sm">{rule}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Model Responses */}
                {analysis.model_responses?.length > 0 && (
                  <Collapsible open={openSections.responses} onOpenChange={() => toggleSection("responses")}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-chart-2" />
                        <span className="text-sm font-medium">Respostas Modelo</span>
                        <Badge variant="secondary" className="text-[10px]">{analysis.model_responses.length}</Badge>
                      </div>
                      {openSections.responses ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 pl-2">
                      {analysis.model_responses.map((mr, i) => (
                        <div key={i} className="p-3 rounded-lg bg-card border border-border/30 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">🎯 {mr.situation}</p>
                          <p className="text-sm bg-primary/5 p-2 rounded-lg border-l-2 border-primary">{mr.response}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Prompt Adjustments */}
                {analysis.prompt_adjustments?.length > 0 && (
                  <Collapsible open={openSections.prompts} onOpenChange={() => toggleSection("prompts")}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-chart-3" />
                        <span className="text-sm font-medium">Ajustes no Prompt</span>
                        <Badge variant="secondary" className="text-[10px]">{analysis.prompt_adjustments.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={applyPromptAdj} onCheckedChange={setApplyPromptAdj} />
                        {openSections.prompts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 pl-2">
                      {analysis.prompt_adjustments.map((adj, i) => (
                        <div key={i} className="p-3 rounded-lg bg-card border border-border/30 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{adj.scenario_key}</Badge>
                            <Badge className="text-[10px] bg-chart-3/15 text-chart-3 border-chart-3/30">{adj.action}</Badge>
                          </div>
                          <p className="text-sm whitespace-pre-wrap bg-secondary/30 p-2 rounded-lg font-mono text-xs">{adj.text}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Apply button */}
                {!applied && (
                  <div className="pt-2 flex gap-2">
                    <Button
                      className="flex-1 gap-2 rounded-xl"
                      onClick={handleApply}
                      disabled={applying || (!applyRules && !applyPromptAdj)}
                    >
                      {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {applying ? "Aplicando..." : "Aplicar Correções"}
                    </Button>
                    <Button variant="outline" className="rounded-xl gap-2" onClick={() => { setAnalysis(null); setApplied(false); }}>
                      <X className="h-4 w-4" /> Descartar
                    </Button>
                  </div>
                )}

                {applied && (
                  <div className="pt-2">
                    <Button variant="outline" className="w-full rounded-xl gap-2" onClick={onClose}>
                      <ArrowLeft className="h-4 w-4" /> Voltar às conversas
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}