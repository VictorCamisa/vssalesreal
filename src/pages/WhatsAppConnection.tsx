import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone, QrCode, Wifi, WifiOff, Loader2, Plus, Trash2,
  RefreshCw, CheckCircle2, AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type EvolutionInstance = {
  name: string;
  state: string;
  owner: string | null;
};

export default function WhatsAppConnection() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"waiting" | "connected" | "error">("waiting");

  const fetchInstances = useCallback(async () => {
    if (!profile?.org_id) return;
    setInstancesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "list", org_id: profile.org_id },
      });
      if (error) throw error;
      setInstances(data?.instances || []);
    } catch { /* silently fail */ }
    finally { setInstancesLoading(false); }
  }, [profile?.org_id]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const handleCreateInstance = async () => {
    if (!profile?.org_id || !newInstanceName.trim()) return;
    setCreatingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "create", org_id: profile.org_id, instance_name: newInstanceName.trim() },
      });
      if (error) throw error;
      toast({ title: "Instância criada!", description: `${newInstanceName} pronta para conexão.` });
      if (data?.qrcode?.base64 || data?.qrcode) {
        const qr = typeof data.qrcode === "string" ? data.qrcode : data.qrcode.base64;
        if (qr) { setQrCode(qr); setQrInstanceName(newInstanceName.trim()); setConnectionStatus("waiting"); setQrDialogOpen(true); }
      }
      setNewInstanceName("");
      await fetchInstances();
    } catch (error: any) {
      toast({ title: "Erro ao criar instância", description: error.message, variant: "destructive" });
    } finally { setCreatingInstance(false); }
  };

  const handleGetQR = async (instanceName: string) => {
    if (!profile?.org_id) return;
    setQrLoading(true); setQrInstanceName(instanceName); setQrDialogOpen(true); setQrCode(""); setConnectionStatus("waiting");
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "qrcode", org_id: profile.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      setQrCode(data?.qrcode || "");
    } catch (error: any) {
      toast({ title: "Erro ao obter QR Code", description: error.message, variant: "destructive" });
      setQrDialogOpen(false);
    } finally { setQrLoading(false); }
  };

  const handleDeleteInstance = async (instanceName: string) => {
    if (!profile?.org_id) return;
    try {
      const { error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "delete", org_id: profile.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      toast({ title: "Instância removida" });
      await fetchInstances();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // Poll status while QR dialog is open
  useEffect(() => {
    if (!qrDialogOpen || !qrInstanceName || !profile?.org_id) return;
    let qrRefreshCount = 0;
    const statusInterval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("manage-evolution", {
          body: { action: "status", org_id: profile.org_id, instance_name: qrInstanceName },
        });
        if (data?.state === "open") {
          setConnectionStatus("connected");
          toast({ title: "✅ WhatsApp conectado!", description: `Instância ${qrInstanceName} online.` });
          setTimeout(() => { setQrDialogOpen(false); fetchInstances(); }, 1500);
        }
      } catch { /* ignore */ }
      qrRefreshCount++;
      if (qrRefreshCount % 8 === 0) {
        try {
          const { data } = await supabase.functions.invoke("manage-evolution", {
            body: { action: "qrcode", org_id: profile.org_id, instance_name: qrInstanceName },
          });
          if (data?.qrcode) setQrCode(data.qrcode);
        } catch { /* ignore */ }
      }
    }, 3000);
    return () => clearInterval(statusInterval);
  }, [qrDialogOpen, qrInstanceName, profile?.org_id]);

  const getStatusInfo = (state: string) => {
    switch (state) {
      case "open": return { label: "Online", color: "bg-success/10 text-success border-success/30", icon: Wifi };
      case "connecting": return { label: "Conectando", color: "bg-warning/10 text-warning border-warning/30", icon: RefreshCw };
      default: return { label: "Desconectado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: WifiOff };
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="page-title">Conexão WhatsApp</h1>
        <p className="page-description">Gerencie suas instâncias da Evolution API</p>
      </div>

      {/* QR Code Setup Card */}
      <div className="glass rounded-2xl p-8">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* QR Placeholder */}
          <div className="flex h-52 w-52 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-secondary/20">
            <div className="text-center space-y-2">
              <QrCode className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">Crie uma instância<br />para gerar o QR Code</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="flex-1 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Como conectar</h3>
              <div className="space-y-3">
                {[
                  { step: 1, text: "Abra o WhatsApp no seu celular" },
                  { step: 2, text: "Vá em Configurações → Aparelhos Conectados" },
                  { step: 3, text: 'Toque em "Conectar um aparelho" e escaneie o QR Code' },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                      {s.step}
                    </div>
                    <p className="text-sm">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Create instance */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome da instância (ex: Vendas)"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                className="rounded-xl bg-secondary/30 border-border/30"
                onKeyDown={(e) => e.key === "Enter" && handleCreateInstance()}
              />
              <Button onClick={handleCreateInstance} disabled={creatingInstance || !newInstanceName.trim()} className="rounded-xl gradient-primary shrink-0 gap-2">
                {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Instances List */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Suas Instâncias</h3>
          <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={fetchInstances} disabled={instancesLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${instancesLoading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {instancesLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : instances.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma instância criada ainda</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {instances.map((inst) => {
              const status = getStatusInfo(inst.state);
              const StatusIcon = status.icon;
              return (
                <div key={inst.name} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-4 w-4 ${inst.state === "open" ? "text-success" : inst.state === "connecting" ? "text-warning animate-spin" : "text-destructive"}`} />
                    <div>
                      <p className="text-sm font-semibold">{inst.name}</p>
                      <Badge variant="outline" className={`text-[10px] ${status.color}`}>{status.label}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {inst.state !== "open" && (
                      <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1" onClick={() => handleGetQR(inst.name)}>
                        <QrCode className="h-3.5 w-3.5" /> Conectar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteInstance(inst.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Conectar: {qrInstanceName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {connectionStatus === "connected" ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle2 className="h-16 w-16 text-success animate-pulse-glow" />
                <p className="text-lg font-semibold text-success">Conectado!</p>
              </div>
            ) : qrLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrCode ? (
              <>
                <div className="bg-white p-4 rounded-2xl">
                  <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  <p className="text-xs text-muted-foreground">Aguardando escaneamento...</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8">QR Code indisponível. Tente novamente.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
