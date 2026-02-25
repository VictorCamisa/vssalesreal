import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Brain, MessageSquare, Sparkles, Save, Loader2, Plus, Trash2,
  Clock, ToggleLeft, ToggleRight, Send, FileText, Zap, Copy, Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// ---- Types ----
type AiConfig = {
  id?: string;
  org_id: string;
  config_type: string;
  instance_name?: string | null;
  enabled: boolean;
  system_prompt: string;
  temperature: number;
  schedule_start: string | null;
  schedule_end: string | null;
  schedule_days: number[];
  only_outside_hours: boolean;
  config: Record<string, any>;
};

type KnowledgeDoc = {
  id?: string;
  org_id: string;
  title: string;
  content: string;
  keywords?: string[];
  summary?: string;
  processed?: boolean;
  chunks?: any[];
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const DAY_LABELS: Record<number, string> = {
  1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom",
};

// ========== CHATBOT TAB ==========
function ChatbotTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [instances, setInstances] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, AiConfig>>({});
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    setWebhookUrl(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-whatsapp-hook`);
  }, []);

  // Load instances from Evolution integration
  useEffect(() => {
    if (!orgId || !user) return;
    (async () => {
      setLoadingInstances(true);
      try {
        const { data } = await supabase
          .from("integrations")
          .select("*")
          .eq("org_id", orgId)
          .eq("service_name", "evolution")
          .maybeSingle();

        if (data?.config) {
          const config = data.config as any;
          const byUser = config?.instances_by_user || {};
          const userInstances = byUser[user.id] || [];
          setInstances(userInstances);
          if (userInstances.length > 0 && !selectedInstance) {
            setSelectedInstance(userInstances[0]);
          }
        }
      } catch (e) {
        console.error(e);
      }
      setLoadingInstances(false);
    })();
  }, [orgId, user]);

  // Load chatbot configs for all instances
  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("ai_configs")
      .select("*")
      .eq("org_id", orgId)
      .eq("config_type", "chatbot")
      .then(({ data }) => {
        const map: Record<string, AiConfig> = {};
        data?.forEach((row: any) => {
          if (row.instance_name) {
            map[row.instance_name] = {
              ...row,
              schedule_days: row.schedule_days || [1, 2, 3, 4, 5],
              temperature: Number(row.temperature) || 0.7,
              config: row.config || {},
            };
          }
        });
        setConfigs(map);
      });
  }, [orgId]);

  const currentConfig = configs[selectedInstance] || {
    org_id: orgId,
    config_type: "chatbot",
    instance_name: selectedInstance,
    enabled: false,
    system_prompt: "",
    temperature: 0.7,
    schedule_start: "08:00",
    schedule_end: "18:00",
    schedule_days: [1, 2, 3, 4, 5],
    only_outside_hours: false,
    config: {},
  };

  const updateConfig = (partial: Partial<AiConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedInstance]: { ...currentConfig, ...partial },
    }));
  };

  const handleSave = async () => {
    if (!selectedInstance) return;
    setSaving(true);
    try {
      const payload = {
        org_id: orgId,
        config_type: "chatbot",
        instance_name: selectedInstance,
        enabled: currentConfig.enabled,
        system_prompt: currentConfig.system_prompt,
        temperature: currentConfig.temperature,
        schedule_start: currentConfig.schedule_start,
        schedule_end: currentConfig.schedule_end,
        schedule_days: currentConfig.schedule_days,
        only_outside_hours: currentConfig.only_outside_hours,
        config: currentConfig.config,
      };

      if (currentConfig.id) {
        await supabase.from("ai_configs").update(payload).eq("id", currentConfig.id);
      } else {
        const { data } = await supabase.from("ai_configs").insert(payload).select().single();
        if (data) updateConfig({ id: data.id });
      }
      toast({ title: "Salvo!", description: "Configuração do chatbot atualizada." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const [copied, setCopied] = useState(false);
  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingInstances) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center space-y-3">
        <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h3 className="text-lg font-semibold">Nenhuma instância WhatsApp</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Crie uma instância WhatsApp na aba de Prospecção para configurar o chatbot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Instance selector */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
              <MessageSquare className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">Instância WhatsApp</h3>
              <p className="text-xs text-muted-foreground">Selecione a instância para configurar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={currentConfig.enabled}
              onCheckedChange={(v) => updateConfig({ enabled: v })}
            />
            <Badge variant="outline" className={currentConfig.enabled ? "bg-success/10 text-success border-success/30 text-xs" : "text-xs"}>
              {currentConfig.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>

        <Select value={selectedInstance} onValueChange={setSelectedInstance}>
          <SelectTrigger className="rounded-xl bg-secondary/30">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {instances.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Webhook URL */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-warning" />
          <Label className="font-semibold text-sm">Webhook URL</Label>
        </div>
        <p className="text-xs text-muted-foreground">Configure este URL como webhook da instância na Evolution API para receber mensagens.</p>
        <div className="flex gap-2">
          <Input readOnly value={webhookUrl} className="rounded-xl bg-secondary/30 font-mono text-xs" />
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={copyWebhook}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Prompt */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <Label className="font-semibold text-sm">Prompt / Personalidade do Bot</Label>
        <Textarea
          placeholder="Ex: Você é a assistente virtual da empresa X. Seja simpática, profissional e ajude com dúvidas sobre nossos produtos..."
          value={currentConfig.system_prompt}
          onChange={(e) => updateConfig({ system_prompt: e.target.value })}
          rows={5}
          className="rounded-xl bg-secondary/30 resize-none"
        />
      </div>

      {/* Temperature */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-sm">Criatividade (Temperature)</Label>
          <Badge variant="outline" className="font-mono text-xs">{currentConfig.temperature.toFixed(1)}</Badge>
        </div>
        <Slider
          value={[currentConfig.temperature]}
          min={0}
          max={1}
          step={0.1}
          onValueChange={([v]) => updateConfig({ temperature: v })}
          className="py-2"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Preciso</span>
          <span>Criativo</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <Label className="font-semibold text-sm">Horário de Atendimento</Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={currentConfig.only_outside_hours}
            onCheckedChange={(v) => updateConfig({ only_outside_hours: v })}
          />
          <span className="text-sm">Só responder fora do horário comercial</span>
        </div>

        {currentConfig.only_outside_hours && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={currentConfig.schedule_start || "08:00"}
                  onChange={(e) => updateConfig({ schedule_start: e.target.value })}
                  className="rounded-xl bg-secondary/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={currentConfig.schedule_end || "18:00"}
                  onChange={(e) => updateConfig({ schedule_end: e.target.value })}
                  className="rounded-xl bg-secondary/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Dias úteis</Label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <label key={d} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={currentConfig.schedule_days.includes(d)}
                      onCheckedChange={(checked) => {
                        const days = checked
                          ? [...currentConfig.schedule_days, d]
                          : currentConfig.schedule_days.filter((x) => x !== d);
                        updateConfig({ schedule_days: days });
                      }}
                    />
                    {DAY_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl gradient-primary hover:opacity-90 h-11">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Save className="h-4 w-4 mr-2" />Salvar Configuração</>}
      </Button>
    </div>
  );
}

// ========== ASSISTANT TAB ==========
function AssistantTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("ai_configs")
      .select("*")
      .eq("org_id", orgId)
      .eq("config_type", "assistant")
      .is("instance_name", null)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setConfig({ ...data, temperature: Number(data.temperature) || 0.7, schedule_days: data.schedule_days || [] });
      });
  }, [orgId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMsgs = [...messages, userMsg];

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMsgs, org_id: orgId, mode: "assistant" }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = {
        org_id: orgId,
        config_type: "assistant",
        instance_name: null,
        enabled: true,
        system_prompt: config.system_prompt,
        temperature: config.temperature,
      };
      if (config.id) {
        await supabase.from("ai_configs").update(payload).eq("id", config.id);
      } else {
        const { data } = await supabase.from("ai_configs").insert(payload).select().single();
        if (data) setConfig((prev) => prev ? { ...prev, id: data.id } : prev);
      }
      toast({ title: "Salvo!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingConfig(false);
  };

  return (
    <div className="space-y-4">
      {/* Config toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Assistente IA interno para sua equipe</p>
        <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? "Fechar Config" : "⚙️ Configurar"}
        </Button>
      </div>

      {showConfig && (
        <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Prompt do Assistente</Label>
            <Textarea
              placeholder="Defina a personalidade e instruções do assistente interno..."
              value={config?.system_prompt || ""}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, system_prompt: e.target.value } : {
                org_id: orgId, config_type: "assistant", enabled: true, system_prompt: e.target.value,
                temperature: 0.7, schedule_start: null, schedule_end: null, schedule_days: [], only_outside_hours: false, config: {},
              })}
              rows={4}
              className="rounded-xl bg-secondary/30 resize-none"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Criatividade</Label>
              <Badge variant="outline" className="font-mono text-xs">{(config?.temperature ?? 0.7).toFixed(1)}</Badge>
            </div>
            <Slider
              value={[config?.temperature ?? 0.7]}
              min={0} max={1} step={0.1}
              onValueChange={([v]) => setConfig((prev) => prev ? { ...prev, temperature: v } : prev)}
            />
          </div>
          <Button onClick={saveConfig} disabled={savingConfig} size="sm" className="rounded-xl gradient-primary">
            {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Salvar
          </Button>
        </div>
      )}

      {/* Chat */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: "60vh" }}>
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <Brain className="h-10 w-10 text-primary/40" />
              <p className="text-sm text-muted-foreground">Pergunte qualquer coisa sobre seus leads, estratégias de vendas, ou peça análises.</p>
            </div>
          )}
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "gradient-primary text-primary-foreground"
                    : "bg-secondary/50 text-foreground"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 rounded-2xl px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
          <div ref={scrollRef} />
        </ScrollArea>

        <div className="border-t border-border/50 p-3 flex gap-2">
          <Input
            placeholder="Pergunte algo..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="rounded-xl bg-secondary/30 border-0"
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon" className="rounded-xl gradient-primary shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========== KNOWLEDGE BASE TAB ==========
function KnowledgeBaseTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadDocs = useCallback(async () => {
    const { data } = await supabase
      .from("ai_knowledge_docs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (data) setDocs(data as KnowledgeDoc[]);
  }, [orgId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const processDoc = async (docId: string) => {
    setProcessingIds((prev) => new Set([...prev, docId]));
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-knowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ doc_id: docId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erro ao processar");
      toast({ title: "Processado!", description: `${result.chunks_count} chunks, ${result.keywords_count} keywords` });
      await loadDocs();
    } catch (e: any) {
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    }
    setProcessingIds((prev) => { const s = new Set(prev); s.delete(docId); return s; });
  };

  const addDoc = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const { data } = await supabase.from("ai_knowledge_docs").insert({
        org_id: orgId,
        title: newTitle.trim(),
        content: newContent.trim(),
      }).select().single();
      setNewTitle("");
      setNewContent("");
      await loadDocs();
      toast({ title: "Documento adicionado! Processando..." });
      // Auto-process
      if (data?.id) processDoc(data.id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const deleteDoc = async (id: string) => {
    await supabase.from("ai_knowledge_docs").delete().eq("id", id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    toast({ title: "Removido" });
  };

  const reprocessAll = async () => {
    const unprocessed = docs.filter((d) => !d.processed && d.id);
    if (unprocessed.length === 0) {
      toast({ title: "Todos os documentos já estão processados!" });
      return;
    }
    toast({ title: `Processando ${unprocessed.length} documento(s)...` });
    for (const doc of unprocessed) {
      if (doc.id) await processDoc(doc.id);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Adicione documentos que a IA usará como contexto. Documentos são processados automaticamente com chunking e keywords.
        </p>
        <Button variant="outline" size="sm" className="rounded-xl text-xs shrink-0" onClick={reprocessAll}>
          <Zap className="h-3.5 w-3.5 mr-1.5" />Processar Pendentes
        </Button>
      </div>

      {/* Add new doc */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <Label className="font-semibold text-sm">Novo Documento</Label>
        </div>
        <Input
          placeholder="Título (ex: FAQ, Tabela de Preços, Sobre a Empresa...)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="rounded-xl bg-secondary/30"
        />
        <Textarea
          placeholder="Cole aqui o conteúdo completo do documento..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={6}
          className="rounded-xl bg-secondary/30 resize-none"
        />
        <Button onClick={addDoc} disabled={saving || !newTitle.trim() || !newContent.trim()} className="rounded-xl gradient-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Adicionar
        </Button>
      </div>

      {/* Doc list */}
      <div className="space-y-3">
        {docs.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum documento na base de conhecimento</p>
          </div>
        )}
        {docs.map((doc) => {
          const isProcessing = doc.id ? processingIds.has(doc.id) : false;
          return (
            <div key={doc.id} className="glass rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">{doc.title}</h4>
                  {doc.processed ? (
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                      <Check className="h-2.5 w-2.5 mr-0.5" />Processado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                      Pendente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!doc.processed && doc.id && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => doc.id && processDoc(doc.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-warning" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => doc.id && deleteDoc(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {doc.processed && doc.summary && (
                <p className="text-xs text-muted-foreground italic">{doc.summary}</p>
              )}
              {doc.processed && doc.keywords?.length ? (
                <div className="flex flex-wrap gap-1">
                  {doc.keywords.slice(0, 12).map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] py-0">{kw}</Badge>
                  ))}
                  {doc.keywords.length > 12 && (
                    <Badge variant="secondary" className="text-[10px] py-0">+{doc.keywords.length - 12}</Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground line-clamp-3">{doc.content}</p>
              )}
              {doc.processed && doc.chunks?.length && (
                <p className="text-[10px] text-muted-foreground/60">{doc.chunks.length} chunk(s) indexados</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== MESSAGE GENERATION TAB ==========
function MessagesTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    supabase
      .from("ai_configs")
      .select("*")
      .eq("org_id", orgId)
      .eq("config_type", "messages")
      .is("instance_name", null)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setConfig({ ...data, temperature: Number(data.temperature) || 0.8, schedule_days: data.schedule_days || [] });
      });
  }, [orgId]);

  const generate = async () => {
    if (!context.trim()) return;
    setIsLoading(true);
    setResult("");

    let assistantSoFar = "";

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: context }],
          org_id: orgId,
          mode: "generate_message",
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              assistantSoFar += content;
              setResult(assistantSoFar);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const payload = {
        org_id: orgId,
        config_type: "messages",
        instance_name: null,
        enabled: true,
        system_prompt: config.system_prompt,
        temperature: config.temperature,
      };
      if (config.id) {
        await supabase.from("ai_configs").update(payload).eq("id", config.id);
      } else {
        const { data } = await supabase.from("ai_configs").insert(payload).select().single();
        if (data) setConfig((prev) => prev ? { ...prev, id: data.id } : prev);
      }
      toast({ title: "Salvo!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingConfig(false);
  };

  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gere mensagens personalizadas de prospecção com IA</p>
        <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? "Fechar Config" : "⚙️ Configurar"}
        </Button>
      </div>

      {showConfig && (
        <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Instruções para geração</Label>
            <Textarea
              placeholder="Ex: Use tom informal, foque nos benefícios do produto X, inclua cases de sucesso..."
              value={config?.system_prompt || ""}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, system_prompt: e.target.value } : {
                org_id: orgId, config_type: "messages", enabled: true, system_prompt: e.target.value,
                temperature: 0.8, schedule_start: null, schedule_end: null, schedule_days: [], only_outside_hours: false, config: {},
              })}
              rows={3}
              className="rounded-xl bg-secondary/30 resize-none"
            />
          </div>
          <Button onClick={saveConfig} disabled={savingConfig} size="sm" className="rounded-xl gradient-primary">
            {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Salvar
          </Button>
        </div>
      )}

      <div className="glass rounded-2xl p-5 space-y-3">
        <Label className="font-semibold text-sm">Contexto do Lead</Label>
        <Textarea
          placeholder="Cole informações do lead: nome, empresa, segmento, cargo... Quanto mais contexto, melhor a mensagem."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={4}
          className="rounded-xl bg-secondary/30 resize-none"
        />
        <Button onClick={generate} disabled={isLoading || !context.trim()} className="rounded-xl gradient-primary w-full">
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar Mensagens</>}
        </Button>
      </div>

      {result && (
        <div className="glass rounded-2xl p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-sm">Mensagens Geradas</Label>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
              navigator.clipboard.writeText(result);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              Copiar
            </Button>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-sm whitespace-pre-wrap">{result}</div>
        </div>
      )}
    </div>
  );
}

// ========== MAIN PAGE ==========
export default function AIPage() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inteligência Artificial</h1>
          <p className="text-muted-foreground text-sm">Configure chatbot, assistente e geração de conteúdo</p>
        </div>
      </div>

      <Tabs defaultValue="chatbot">
        <TabsList className="bg-secondary/30 rounded-xl p-1 h-auto flex-wrap">
          <TabsTrigger value="chatbot" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Bot className="h-3.5 w-3.5 mr-1.5" />Chatbot WhatsApp
          </TabsTrigger>
          <TabsTrigger value="assistant" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Brain className="h-3.5 w-3.5 mr-1.5" />Assistente
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <FileText className="h-3.5 w-3.5 mr-1.5" />Base de Conhecimento
          </TabsTrigger>
          <TabsTrigger value="messages" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Gerar Mensagens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chatbot" className="mt-4">
          <ChatbotTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="assistant" className="mt-4">
          <AssistantTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeBaseTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <MessagesTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
