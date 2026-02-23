import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Globe, MessageCircle, Loader2, Plus, Users2, MessageSquare, Contact } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function Prospecting() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeKeywords, setScrapeKeywords] = useState("");
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [evolutionGroup, setEvolutionGroup] = useState("");
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [whatsappMode, setWhatsappMode] = useState<"group" | "conversation" | "contact">("group");
  const [evolutionPhone, setEvolutionPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return phone;
  };

  const capitalizeName = (name: string) =>
    name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  const handleScrape = async () => {
    if (!profile?.org_id || !scrapeUrl) return;
    setScrapingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-leads", {
        body: { org_id: profile.org_id, url: scrapeUrl, keywords: scrapeKeywords },
      });
      if (error) throw error;
      toast({ title: "Prospecção concluída!", description: `${data?.count || 0} leads capturados.` });
      setScrapeUrl("");
      setScrapeKeywords("");
    } catch (error: any) {
      toast({ title: "Erro no scraping", description: error.message, variant: "destructive" });
    } finally {
      setScrapingLoading(false);
    }
  };

  const handleEvolution = async () => {
    if (!profile?.org_id || !evolutionGroup) return;
    setEvolutionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", {
        body: { org_id: profile.org_id, group_name: evolutionGroup },
      });
      if (error) throw error;
      toast({ title: "Extração concluída!", description: `${data?.count || 0} contatos extraídos.` });
      setEvolutionGroup("");
    } catch (error: any) {
      toast({ title: "Erro na extração", description: error.message, variant: "destructive" });
    } finally {
      setEvolutionLoading(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.org_id) return;
    setManualLoading(true);
    try {
      const { error } = await supabase.from("leads_raw").insert({
        org_id: profile.org_id,
        name: capitalizeName(manualName),
        phone: formatPhone(manualPhone),
        email: manualEmail || null,
        source: "manual" as const,
        status: "pending" as const,
      });
      if (error) throw error;
      toast({ title: "Lead adicionado!", description: `${manualName} salvo com sucesso.` });
      setManualName("");
      setManualPhone("");
      setManualEmail("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          <Search className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prospecção</h1>
          <p className="text-muted-foreground text-sm">
            Web Scraping, WhatsApp e entrada manual
          </p>
        </div>
      </div>

      <Tabs defaultValue="web">
        <TabsList className="bg-secondary/30 rounded-xl p-1 h-auto">
          <TabsTrigger value="web" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4">
            <Globe className="h-3.5 w-3.5 mr-1.5" />Web Scraping
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4">
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />WhatsApp
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-4">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="mt-4">
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Web Scraping via Firecrawl</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Insira a URL e palavras-chave para extrair contatos</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">URL alvo</Label>
                <Input
                  placeholder="https://exemplo.com/contatos"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  className="rounded-xl bg-secondary/30 border-border/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Palavras-chave (opcional)</Label>
                <Textarea
                  placeholder="vendas, marketing, diretor..."
                  value={scrapeKeywords}
                  onChange={(e) => setScrapeKeywords(e.target.value)}
                  rows={2}
                  className="rounded-xl bg-secondary/30 border-border/30 resize-none"
                />
              </div>
              <Button onClick={handleScrape} disabled={scrapingLoading || !scrapeUrl} className="rounded-xl gradient-primary hover:opacity-90">
                {scrapingLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Prospectando...</> : <><Search className="h-4 w-4 mr-2" />Iniciar Prospecção</>}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Extração via Evolution API</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Extraia contatos do WhatsApp por grupo, conversa ou contato</p>
            </div>

            {/* Sub-options */}
            <div className="flex gap-2">
              {[
                { key: "group" as const, label: "Grupo", icon: Users2 },
                { key: "conversation" as const, label: "Conversa", icon: MessageSquare },
                { key: "contact" as const, label: "Contato", icon: Contact },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setWhatsappMode(opt.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 border ${
                    whatsappMode === opt.key
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                  }`}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {whatsappMode === "group" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Nome do grupo</Label>
                  <Input
                    placeholder="Grupo de Vendas Regional"
                    value={evolutionGroup}
                    onChange={(e) => setEvolutionGroup(e.target.value)}
                    className="rounded-xl bg-secondary/30 border-border/30"
                  />
                  <p className="text-[11px] text-muted-foreground">Busca parcial pelo nome do grupo na sua instância</p>
                </div>
              )}

              {whatsappMode === "conversation" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Número do telefone</Label>
                  <Input
                    placeholder="+5511999999999"
                    value={evolutionPhone}
                    onChange={(e) => setEvolutionPhone(e.target.value)}
                    className="rounded-xl bg-secondary/30 border-border/30"
                  />
                  <p className="text-[11px] text-muted-foreground">Extrai dados de contato de uma conversa direta</p>
                </div>
              )}

              {whatsappMode === "contact" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Número do contato</Label>
                  <Input
                    placeholder="+5511999999999"
                    value={evolutionPhone}
                    onChange={(e) => setEvolutionPhone(e.target.value)}
                    className="rounded-xl bg-secondary/30 border-border/30"
                  />
                  <p className="text-[11px] text-muted-foreground">Importa um contato diretamente pelo número</p>
                </div>
              )}

              <Button
                onClick={async () => {
                  if (!profile?.org_id) return;
                  setEvolutionLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("extract-whatsapp", {
                      body: {
                        org_id: profile.org_id,
                        mode: whatsappMode,
                        group_name: whatsappMode === "group" ? evolutionGroup : undefined,
                        phone: whatsappMode !== "group" ? evolutionPhone : undefined,
                      },
                    });
                    if (error) throw error;
                    const desc = whatsappMode === "group"
                      ? `${data?.count || 0} contatos extraídos do grupo ${data?.group || ""}`
                      : whatsappMode === "conversation"
                      ? `${data?.count || 0} contatos extraídos da conversa${data?.contact_name ? ` com ${data.contact_name}` : ""}`
                      : `${data?.count || 0} contato importado${data?.contact_name ? `: ${data.contact_name}` : ""}`;
                    toast({ title: "Extração concluída!", description: desc });
                    setEvolutionGroup("");
                    setEvolutionPhone("");
                  } catch (error: any) {
                    toast({ title: "Erro na extração", description: error.message, variant: "destructive" });
                  } finally {
                    setEvolutionLoading(false);
                  }
                }}
                disabled={evolutionLoading || (whatsappMode === "group" ? !evolutionGroup : !evolutionPhone)}
                className="rounded-xl gradient-primary hover:opacity-90"
              >
                {evolutionLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Extraindo...</> : <><MessageCircle className="h-4 w-4 mr-2" />Extrair Contatos</>}
              </Button>
            </div>
          </div>
        </TabsContent>

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
      </Tabs>
    </div>
  );
}
