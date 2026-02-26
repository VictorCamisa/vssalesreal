import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Users, TrendingUp, Smartphone, Loader2, MessageCircle,
  Search, Send, Kanban, Brain, ArrowRight, Sparkles, Calendar
} from "lucide-react";

export default function Index() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ leads: 0, opportunities: 0, converted: 0, appointments: 0 });
  const [loading, setLoading] = useState(true);
  const [instanceCount, setInstanceCount] = useState(0);

  useEffect(() => {
    if (!profile?.org_id) return;
    const orgId = profile.org_id;
    const fetchStats = async () => {
      try {
        const [leadsRes, oppsRes, convertedRes, intRes, appointRes] = await Promise.all([
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "converted"),
          supabase.from("integrations").select("config").eq("org_id", orgId).eq("service_name", "evolution").maybeSingle(),
          supabase.from("appointments").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "scheduled"),
        ]);
        setStats({
          leads: leadsRes.count ?? 0,
          opportunities: oppsRes.count ?? 0,
          converted: convertedRes.count ?? 0,
          appointments: appointRes.count ?? 0,
        });
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

  const conversionRate = stats.leads > 0 ? ((stats.converted / stats.leads) * 100).toFixed(1) : "0";

  const cards = [
    { title: "Leads", value: stats.leads, icon: Users, accent: "text-primary", bg: "bg-primary/8" },
    { title: "No Pipeline", value: stats.opportunities, icon: Kanban, accent: "text-violet-500", bg: "bg-violet-500/8" },
    { title: "WhatsApp", value: instanceCount, icon: Smartphone, accent: "text-success", bg: "bg-success/8" },
    { title: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, accent: "text-amber-500", bg: "bg-amber-500/8" },
    { title: "Agendamentos", value: stats.appointments, icon: Calendar, accent: "text-blue-500", bg: "bg-blue-500/8" },
    { title: "Convertidos", value: stats.converted, icon: Sparkles, accent: "text-emerald-500", bg: "bg-emerald-500/8" },
  ];

  const quickActions = [
    { label: "Prospectar", desc: "Buscar leads", href: "/prospecting", icon: Search, accent: "text-primary" },
    { label: "Pipeline", desc: "Ver CRM", href: "/crm", icon: Kanban, accent: "text-violet-500" },
    { label: "WhatsApp", desc: "Conectar", href: "/whatsapp", icon: Smartphone, accent: "text-success" },
    { label: "Disparos", desc: "Campanhas", href: "/broadcasts", icon: Send, accent: "text-amber-500" },
    { label: "Agente IA", desc: "Configurar", href: "/ai", icon: Brain, accent: "text-blue-500" },
    { label: "Agendamentos", desc: "Reuniões", href: "/appointments", icon: Calendar, accent: "text-emerald-500" },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Welcome */}
      <div>
        <h1 className="page-title">
          Olá, {profile?.full_name?.split(" ")[0] || "Usuário"} 👋
        </h1>
        <p className="page-description">Aqui está o resumo da sua operação.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.title} className="stat-card">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg} mb-3`}>
              <card.icon className={`h-4 w-4 ${card.accent}`} />
            </div>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-xl font-semibold tracking-tight">{card.value}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">Ações rápidas</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="glass-card p-3.5 flex items-center gap-3 group hover:border-primary/20 hover:shadow-md transition-all duration-200"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/80">
                <action.icon className={`h-4 w-4 ${action.accent}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-[11px] text-muted-foreground">{action.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* Pipeline Summary */}
      {stats.opportunities > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Kanban className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Pipeline ativo</p>
            </div>
            <Link to="/crm" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver CRM <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-semibold">{stats.opportunities}</p>
              <p className="text-[11px] text-muted-foreground">oportunidades</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-2xl font-semibold">{stats.converted}</p>
              <p className="text-[11px] text-muted-foreground">convertidos</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-2xl font-semibold text-primary">{conversionRate}%</p>
              <p className="text-[11px] text-muted-foreground">taxa</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
