import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Users, TrendingUp, Smartphone, Loader2, MessageCircle,
  Search, Send, Kanban, Brain, Calendar,
  Zap, Clock, Bot, BarChart3, ArrowUpRight, Sparkles
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
          supabase.from("activity_logs").select("id, action, description, created_at, success").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
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
    { title: "Total Leads", value: stats.leads, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { title: "No Pipeline", value: stats.opportunities, icon: Kanban, color: "text-chart-4", bg: "bg-chart-4/10" },
    { title: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" },
    { title: "Convertidos", value: stats.converted, icon: Sparkles, color: "text-success", bg: "bg-success/10" },
  ];

  const statusItems = [
    { label: "WhatsApp", value: instanceCount > 0 ? `${instanceCount} número${instanceCount > 1 ? "s" : ""}` : "Não conectado", icon: Smartphone, active: instanceCount > 0, href: "/whatsapp" },
    { label: "Agente IA", value: aiEnabled ? "Ativo" : "Inativo", icon: Bot, active: aiEnabled, href: "/ai" },
    { label: "Conversas", value: `${stats.activeConversations}`, icon: MessageCircle, active: stats.activeConversations > 0, href: "/crm" },
    { label: "Disparos", value: `${stats.broadcasts} campanha${stats.broadcasts !== 1 ? "s" : ""}`, icon: Send, active: stats.broadcasts > 0, href: "/broadcasts" },
  ];

  const quickActions = [
    { label: "Prospectar", desc: "Buscar novos leads", href: "/prospecting", icon: Search },
    { label: "Pipeline", desc: "Gerenciar vendas", href: "/crm", icon: Kanban },
    { label: "Agente IA", desc: "Configurar IA", href: "/ai", icon: Brain },
    { label: "Agenda", desc: "Ver reuniões", href: "/appointments", icon: Calendar },
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
    <div className="space-y-5 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-end justify-between pt-1">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Visão geral</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Olá, {profile?.full_name?.split(" ")[0] || "Usuário"}
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`flex h-7 w-7 items-center justify-center rounded-md ${kpi.bg}`}>
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">{kpi.title}</p>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Chart + Status */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3 glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[12px] font-semibold text-foreground">Leads — últimos 7 dias</h3>
            </div>
            <Link to="/leads" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="h-[170px] flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={leadsChart} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "11px",
                    padding: "6px 10px",
                  }}
                />
                <Area type="monotone" dataKey="count" name="Leads" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#leadGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[12px] font-semibold text-foreground">Status</h3>
          </div>
          <div className="space-y-0.5">
            {statusItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.active ? "bg-success" : "bg-muted-foreground/20"}`} />
                <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[12px] font-medium flex-1 text-foreground/80">{item.label}</span>
                <span className={`text-[11px] font-medium ${item.active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.value}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions + Activity */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2">Ações rápidas</p>
          <div className="grid gap-2 grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="glass-card p-3 flex items-center gap-2.5 group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent group-hover:bg-primary/10 transition-colors">
                  <action.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground/90 group-hover:text-foreground">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[12px] font-semibold text-foreground">Atividade recente</h3>
          </div>
          {activities.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-6 text-center">Nenhuma atividade recente</p>
          ) : (
            <div className="space-y-0.5">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-2 px-1 py-1.5">
                  <div className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${act.success ? "bg-success" : "bg-destructive"}`} />
                  <p className="text-[11px] text-foreground/70 flex-1 leading-relaxed">{act.description}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(act.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
