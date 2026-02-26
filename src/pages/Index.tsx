import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Target, TrendingUp, Smartphone, Loader2, ArrowUpRight, MessageCircle } from "lucide-react";
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
        setStats({
          leads: leadsRes.count ?? 0,
          opportunities: oppsRes.count ?? 0,
          converted: convertedRes.count ?? 0,
        });
        // Count instances from config
        if (intRes.data?.config) {
          const cfg = intRes.data.config as any;
          const byUser = cfg?.instances_by_user || {};
          const total = Object.values(byUser).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
          setInstanceCount(total as number);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [profile?.org_id]);

  const cards = [
    {
      title: "Leads Capturados",
      value: stats.leads,
      icon: Users,
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      change: "+12%",
    },
    {
      title: "Instâncias WhatsApp",
      value: instanceCount,
      icon: Smartphone,
      iconBg: "bg-success/15",
      iconColor: "text-success",
      change: "Ativas",
    },
    {
      title: "Conversas IA",
      value: stats.opportunities,
      icon: MessageCircle,
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
      change: "Em andamento",
    },
    {
      title: "Vendas Concluídas",
      value: stats.converted,
      icon: TrendingUp,
      iconBg: "bg-success/15",
      iconColor: "text-success",
      change: "+8%",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <div
            key={card.title}
            className="group glass rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 cursor-default"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
              <div className="flex items-center gap-1 text-success text-xs font-medium">
                <ArrowUpRight className="h-3 w-3" />
                {card.change}
              </div>
            </div>
            <div>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-3xl font-bold tracking-tight">{card.value}</div>
              )}
              <p className="text-sm text-muted-foreground mt-1">{card.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Funnel */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Funil de Conversão</h2>
          <p className="text-sm text-muted-foreground mb-4">Eficiência do Agente IA</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={MOCK_FUNNEL_DATA} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis dataKey="stage" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={90} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Evolution line chart */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Evolução - Últimos 7 dias</h2>
          <p className="text-sm text-muted-foreground mb-4">Leads, qualificados e vendas</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={MOCK_LEADS_OVER_TIME}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Leads" />
              <Line type="monotone" dataKey="qualified" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="Qualificados" />
              <Line type="monotone" dataKey="sales" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Vendas" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Conectar WhatsApp", desc: "Configurar instância", href: "/whatsapp", icon: "📱" },
            { label: "Nova Prospecção", desc: "Buscar leads na web", href: "/prospecting", icon: "🔍" },
            { label: "Ver Leads", desc: "Gerenciar sua base", href: "/leads", icon: "👥" },
            { label: "Pipeline CRM", desc: "Acompanhar negócios", href: "/crm", icon: "📊" },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 border border-border/30 hover:border-primary/30 transition-all duration-200 group"
            >
              <span className="text-2xl">{action.icon}</span>
              <div>
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
