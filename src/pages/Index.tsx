import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  Users, TrendingUp, Smartphone, Loader2, MessageCircle,
  Search, Send, Kanban, Brain, ArrowRight, Sparkles, Calendar,
  Activity, Zap, Clock, ChevronRight, Bot, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

        // Leads dos últimos 7 dias
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
    { title: "Total Leads", value: stats.leads, icon: Users, accent: "text-primary", bg: "bg-primary/10", trend: null },
    { title: "No Pipeline", value: stats.opportunities, icon: Kanban, accent: "text-violet-500", bg: "bg-violet-500/10", trend: null },
    { title: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, accent: "text-amber-500", bg: "bg-amber-500/10", trend: null },
    { title: "Convertidos", value: stats.converted, icon: Sparkles, accent: "text-emerald-500", bg: "bg-emerald-500/10", trend: null },
  ];

  const statusItems = [
    {
      label: "WhatsApp",
      value: instanceCount > 0 ? `${instanceCount} número${instanceCount > 1 ? "s" : ""}` : "Não conectado",
      icon: Smartphone,
      active: instanceCount > 0,
      href: "/whatsapp",
    },
    {
      label: "Agente IA",
      value: aiEnabled ? "Ativo" : "Inativo",
      icon: Bot,
      active: aiEnabled,
      href: "/ai",
    },
    {
      label: "Conversas",
      value: `${stats.activeConversations}`,
      icon: MessageCircle,
      active: stats.activeConversations > 0,
      href: "/crm",
    },
    {
      label: "Disparos",
      value: `${stats.broadcasts} campanha${stats.broadcasts !== 1 ? "s" : ""}`,
      icon: Send,
      active: stats.broadcasts > 0,
      href: "/broadcasts",
    },
  ];

  const quickActions = [
    { label: "Prospectar", desc: "Buscar novos leads", href: "/prospecting", icon: Search },
    { label: "Pipeline", desc: "Gerenciar oportunidades", href: "/crm", icon: Kanban },
    { label: "Agente IA", desc: "Configurar automação", href: "/ai", icon: Brain },
    { label: "Agendamentos", desc: "Ver reuniões", href: "/appointments", icon: Calendar },
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
    <div className="space-y-5 max-w-6xl">
      {/* Welcome Banner */}
      <div className="glass-card p-4 sm:p-5 relative overflow-hidden gradient-banner">
        <div className="absolute inset-0 gradient-primary opacity-[0.06] dark:opacity-[0.04]" />
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
              Olá, {profile?.full_name?.split(" ")[0] || "Usuário"} 👋
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Aqui está o resumo da sua operação de vendas.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="stat-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
              </div>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">{kpi.title}</p>
          </div>
        ))}
      </div>

      {/* Middle Row: Chart + Status */}
      <div className="grid gap-3 lg:grid-cols-5">
        {/* Leads Chart */}
        <Card className="lg:col-span-3 border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Leads nos últimos 7 dias
              </CardTitle>
              <Link to="/leads" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Ver todos <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {loading ? (
              <div className="h-[140px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={leadsChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Area type="monotone" dataKey="count" name="Leads" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#leadGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Panel */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {statusItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
              >
                <div className={`h-2 w-2 rounded-full ${item.active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{item.label}</p>
                </div>
                <span className={`text-[10px] ${item.active ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {item.value}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Quick Actions + Recent Activity */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Quick Actions */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Ações rápidas</p>
          <div className="grid gap-2 grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="glass-card p-3 flex items-center gap-2.5 group hover:border-primary/20 hover:shadow-md transition-all duration-200"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80">
                  <action.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Atividade recente
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-1.5">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 p-1.5 rounded-lg">
                    <div className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${act.success ? "bg-emerald-500" : "bg-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground/80 truncate">{act.description}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(act.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
