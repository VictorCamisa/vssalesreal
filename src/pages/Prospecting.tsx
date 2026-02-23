import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Globe, MessageCircle, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function Prospecting() {
  const { profile } = useAuth();
  const { toast } = useToast();

  // Firecrawl state
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeKeywords, setScrapeKeywords] = useState("");
  const [scrapingLoading, setScrapingLoading] = useState(false);

  // Evolution API state
  const [evolutionGroup, setEvolutionGroup] = useState("");
  const [evolutionLoading, setEvolutionLoading] = useState(false);

  // Manual add state
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
      toast({
        title: "Prospecção concluída!",
        description: `${data?.count || 0} leads capturados.`,
      });
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
      toast({
        title: "Extração concluída!",
        description: `${data?.count || 0} contatos extraídos.`,
      });
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          Prospecção
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Geração de demanda via Web Scraping, WhatsApp e entrada manual
        </p>
      </div>

      <Tabs defaultValue="web">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="web" className="text-xs"><Globe className="h-3.5 w-3.5 mr-1.5" />Web Scraping</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />WhatsApp</TabsTrigger>
          <TabsTrigger value="manual" className="text-xs"><Plus className="h-3.5 w-3.5 mr-1.5" />Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="web">
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">Web Scraping via Firecrawl</CardTitle>
              <CardDescription>Insira a URL e palavras-chave para extrair contatos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL alvo</Label>
                <Input
                  placeholder="https://exemplo.com/contatos"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Palavras-chave (opcional)</Label>
                <Textarea
                  placeholder="vendas, marketing, diretor..."
                  value={scrapeKeywords}
                  onChange={(e) => setScrapeKeywords(e.target.value)}
                  rows={2}
                />
              </div>
              <Button onClick={handleScrape} disabled={scrapingLoading || !scrapeUrl}>
                {scrapingLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Prospectando...</> : <><Search className="h-4 w-4 mr-2" />Iniciar Prospecção</>}
              </Button>
              <p className="text-xs text-muted-foreground">
                Configure sua chave Firecrawl em Configurações antes de usar.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">Extração via Evolution API</CardTitle>
              <CardDescription>Extraia contatos e membros de grupos do WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do grupo</Label>
                <Input
                  placeholder="Grupo de Vendas Regional"
                  value={evolutionGroup}
                  onChange={(e) => setEvolutionGroup(e.target.value)}
                />
              </div>
              <Button onClick={handleEvolution} disabled={evolutionLoading || !evolutionGroup}>
                {evolutionLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Extraindo...</> : <><MessageCircle className="h-4 w-4 mr-2" />Extrair Contatos</>}
              </Button>
              <p className="text-xs text-muted-foreground">
                Configure sua instância Evolution API em Configurações antes de usar.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <Card className="border-border/50 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">Adicionar Lead Manualmente</CardTitle>
              <CardDescription>Insira os dados do lead para adicionar à sua base</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualAdd} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input placeholder="João Silva" value={manualName} onChange={(e) => setManualName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input placeholder="(11) 99999-9999" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email (opcional)</Label>
                  <Input type="email" placeholder="joao@empresa.com" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} />
                </div>
                <Button type="submit" disabled={manualLoading}>
                  {manualLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : <><Plus className="h-4 w-4 mr-2" />Adicionar Lead</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
