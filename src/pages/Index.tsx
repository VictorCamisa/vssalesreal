import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Users, TrendingUp, Smartphone, Loader2, MessageCircle,
  Search, Send, Kanban, Brain, Calendar,
  Zap, Clock, Bot, BarChart3, ArrowUpRight, Sparkles, ArrowRight
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

interface RecentActivity {
  id: string;
  action: string;
  description: string;
  created_at: string;
  success: boolean;
}

export default function Index() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    leads: 0, opportunities: 0, converted: 0, appointments: 0,
    activeConversations: 0, broadcasts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [instanceCount, setInstanceCount] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [leadsChart, setLeadsChart] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    if (!profile?.org_id) return;
    const orgId = profile.org_id;

    const fetchAll = async () => {
      try {
        const [leadsRes, oppsRes, convertedRes, intRes, appointRes, convosRes, broadcastsRes, aiRes, activityRes] = await Promise.all([
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "converted"),
          supabase.from("integrations").select("config").eq("org_id", orgId).eq("service_name", "evolution").maybeSingle(),
          supabase.from("appointments").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "scheduled"),
          supabase.from("conversation_tracker").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("broadcasts").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "draft"),
          supabase.from("ai_configs").select("enabled").eq("org_id", orgId).eq("config_type", "chatbot").eq("enabled", true),
          supabase.from("activity_logs").select("id, action, description, created_at, success").eq("org_id", orgId).order("created_at", { ascending: false }).limit(8),
        ]);

        setStats({
          leads: leadsRes.count ?? 0,
          opportunities: oppsRes.count ?? 0,
          converted: convertedRes.count ?? 0,
          appointments: appointRes.count ?? 0,
          activeConversations: convosRes.count ?? 0,
          broadcasts: broadcastsRes.count ?? 0,
        });

        setAiEnabled((aiRes.data?.length ?? 0) > 0);
        setActivities(activityRes.data ?? []);

        if (intRes.data?.config) {
          const cfg = intRes.data.config as any;
          const byUser = cfg?.instances_by_user || {};
          const total = Object.values(byUser).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
          setInstanceCount(total as number);
        }

        const now = new Date();
        const days: { label: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
          const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
          const { count } = await supabase
            .from("leads_raw")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .gte("created_at", dayStart)
            .lt("created_at", dayEnd);
          days.push({
            label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
            count: count ?? 0,
          });
        }
        setLeadsChart(days);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [profile?.org_id]);

  const conversionRate = stats.leads > 0 ? ((stats.converted / stats.leads) * 100).toFixed(1) : "0";

  const kpis = [
    { title: "Total Leads", value: stats.leads, icon: Users, color: "text-primary", bg: "bg-primary/10", trend: "+12%" },
    { title: "No Pipeline", value: stats.opportunities, icon: Kanban, color: "text-chart-4", bg: "bg-chart-4/10", trend: "+5%" },
    { title: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10", trend: null },
    { title: "Convertidos", value: stats.converted, icon: Sparkles, color: "text-success", bg: "bg-success/10", trend: null },
  ];

  const statusItems = [
    { label: "WhatsApp", value: instanceCount > 0 ? `${instanceCount} número${instanceCount > 1 ? "s" : ""}` : "Não conectado", icon: Smartphone, active: instanceCount > 0, href: "/whatsapp" },
    { label: "Agente IA", value: aiEnabled ? "Ativo" : "Inativo", icon: Bot, active: aiEnabled, href: "/ai" },
    { label: "Conversas", value: `${stats.activeConversations}`, icon: MessageCircle, active: stats.activeConversations > 0, href: "/crm" },
    { label: "Disparos", value: `${stats.broadcasts} campanha${stats.broadcasts !== 1 ? "s" : ""}`, icon: Send, active: stats.broadcasts > 0, href: "/broadcasts" },
  ];

  const quickActions = [
    { label: "Prospectar", desc: "Buscar novos leads", href: "/prospecting", icon: Search, color: "text-primary" },
    { label: "Pipeline", desc: "Gerenciar vendas", href: "/crm", icon: Kanban, color: "text-chart-4" },
    { label: "Agente IA", desc: "Configurar IA", href: "/ai", icon: Brain, color: "text-violet-400" },
    { label: "Agenda", desc: "Ver reuniões", href: "/appointments", icon: Calendar, color: "text-warning" },
  ];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Visão geral</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Olá, {profile?.full_name?.split(" ")[0] || "Usuário"} 👋
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="glass-card p-5 group hover:shadow-card transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              {kpi.trend && (
                <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">{kpi.trend}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">{kpi.title}</p>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold tracking-tight text-foreground">{kpi.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Chart + Status */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Leads — últimos 7 dias</h3>
            </div>
            <Link to="/leads" className="text-sm text-primary hover:underline flex items-center gap-1 font-medium">
              Ver todos <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="h-[220px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={leadsChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                    padding: "8px 12px",
                  }}
                />
                <Area type="monotone" dataKey="count" name="Leads" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#leadGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Status operacional</h3>
          </div>
          <div className="space-y-1">
            {statusItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors group"
              >
                <div className={`h-2 w-2 rounded-full shrink-0 ${item.active ? "bg-success" : "bg-muted-foreground/30"}`} />
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1 text-foreground/80 group-hover:text-foreground">{item.label}</span>
                <span className={`text-sm font-medium ${item.active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.value}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ações rápidas</p>
          <div className="grid gap-3 grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="glass-card p-4 flex items-center gap-3 group hover:shadow-card transition-all"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent group-hover:bg-primary/10 transition-colors">
                  <action.icon className={`h-5 w-5 text-muted-foreground group-hover:${action.color} transition-colors`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Atividade recente</h3>
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma atividade recente</p>
          ) : (
            <div className="space-y-1">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${act.success ? "bg-primary" : "bg-destructive"}`} />
                  <p className="text-sm text-foreground/70 flex-1 leading-relaxed">{act.description}</p>
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{timeAgo(act.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
