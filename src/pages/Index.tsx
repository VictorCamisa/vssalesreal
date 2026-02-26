import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, TrendingUp, Smartphone, Loader2, MessageCircle } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MOCK_FUNNEL_DATA, MOCK_LEADS_OVER_TIME } from "@/data/mockData";

export default function Index() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ leads: 0, opportunities: 0, converted: 0 });
  const [loading, setLoading] = useState(true);
  const [instanceCount, setInstanceCount] = useState(0);

  useEffect(() => {
    if (!profile?.org_id) return;
    const orgId = profile.org_id;
    const fetchStats = async () => {
      try {
        const [leadsRes, oppsRes, convertedRes, intRes] = await Promise.all([
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "converted"),
          supabase.from("integrations").select("config").eq("org_id", orgId).eq("service_name", "evolution").maybeSingle(),
        ]);
        setStats({ leads: leadsRes.count ?? 0, opportunities: oppsRes.count ?? 0, converted: convertedRes.count ?? 0 });
        if (intRes.data?.config) {
          const cfg = intRes.data.config as any;
          const byUser = cfg?.instances_by_user || {};
          const total = Object.values(byUser).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
          setInstanceCount(total as number);
        }
      } catch (error) { console.error("Failed to fetch stats:", error); }
      finally { setLoading(false); }
    };
    fetchStats();
  }, [profile?.org_id]);

  const cards = [
    { title: "Leads Capturados", value: stats.leads, icon: Users, color: "text-primary" },
    { title: "Instâncias WhatsApp", value: instanceCount, icon: Smartphone, color: "text-success" },
    { title: "Conversas IA", value: stats.opportunities, icon: MessageCircle, color: "text-warning" },
    { title: "Vendas Concluídas", value: stats.converted, icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border rounded-lg p-5">
          <h2 className="text-sm font-medium mb-1">Funil de Conversão</h2>
          <p className="text-xs text-muted-foreground mb-4">Eficiência do Agente IA</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_FUNNEL_DATA} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis dataKey="stage" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: 12, color: "hsl(var(--foreground))" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-lg p-5">
          <h2 className="text-sm font-medium mb-1">Últimos 7 dias</h2>
          <p className="text-xs text-muted-foreground mb-4">Leads, qualificados e vendas</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MOCK_LEADS_OVER_TIME}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: 12, color: "hsl(var(--foreground))" }} />
              <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Leads" />
              <Line type="monotone" dataKey="qualified" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="Qualificados" />
              <Line type="monotone" dataKey="sales" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Vendas" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border rounded-lg p-5">
        <h2 className="text-sm font-medium mb-3">Ações Rápidas</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            { label: "Conectar WhatsApp", desc: "Configurar instância", href: "/whatsapp", icon: "📱" },
            { label: "Nova Prospecção", desc: "Buscar leads por nicho", href: "/prospecting", icon: "🔍" },
            { label: "Novo Disparo", desc: "Criar campanha", href: "/broadcasts", icon: "🚀" },
            { label: "Pipeline CRM", desc: "Acompanhar negócios", href: "/crm", icon: "📊" },
          ].map((action) => (
            <a key={action.label} href={action.href}
              className="flex items-center gap-2.5 p-3 rounded-lg border hover:bg-secondary/50 hover:border-primary/30 transition-colors group">
              <span className="text-xl">{action.icon}</span>
              <div>
                <p className="text-xs font-medium group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-[10px] text-muted-foreground">{action.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
