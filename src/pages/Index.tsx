import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, TrendingUp, Smartphone, Loader2, MessageCircle,
  Search, Send, Kanban, Brain, ArrowRight, Sparkles, Calendar,
  Activity, Zap, Clock, ChevronRight, Bot, BarChart3
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

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

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
    { title: "Total Leads", value: stats.leads, icon: Users, color: "text-primary", glow: "shadow-[0_0_20px_-5px_hsl(174_70%_48%/0.3)]" },
    { title: "No Pipeline", value: stats.opportunities, icon: Kanban, color: "text-chart-4", glow: "shadow-[0_0_20px_-5px_hsl(262_80%_62%/0.3)]" },
    { title: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-warning", glow: "shadow-[0_0_20px_-5px_hsl(36_85%_55%/0.3)]" },
    { title: "Convertidos", value: stats.converted, icon: Sparkles, color: "text-success", glow: "shadow-[0_0_20px_-5px_hsl(160_55%_45%/0.3)]" },
  ];

  const statusItems = [
    {
      label: "WhatsApp",
      value: instanceCount > 0 ? `${instanceCount} número${instanceCount > 1 ? "s" : ""}` : "Não conectado",
      icon: Smartphone, active: instanceCount > 0, href: "/whatsapp",
    },
    { label: "Agente IA", value: aiEnabled ? "Ativo" : "Inativo", icon: Bot, active: aiEnabled, href: "/ai" },
    { label: "Conversas", value: `${stats.activeConversations}`, icon: MessageCircle, active: stats.activeConversations > 0, href: "/crm" },
    { label: "Disparos", value: `${stats.broadcasts} campanha${stats.broadcasts !== 1 ? "s" : ""}`, icon: Send, active: stats.broadcasts > 0, href: "/broadcasts" },
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
    <div className="space-y-6 max-w-7xl">
      {/* Welcome */}
      <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
        <div className="glass-card p-5 sm:p-6 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Olá, {profile?.full_name?.split(" ")[0] || "Usuário"} 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Aqui está o resumo da sua operação de vendas.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground/70 bg-secondary/30 px-3 py-1.5 rounded-full">
              <Clock className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.05 * i }}>
            <div className={`glass-card p-5 hover:${kpi.glow} transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 border border-border/30`}>
                  <kpi.icon className={`h-[18px] w-[18px] ${kpi.color}`} />
                </div>
              </div>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">{kpi.title}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart + Status */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Chart */}
        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.2 }} className="lg:col-span-3">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Leads — últimos 7 dias</h3>
              </div>
              <Link to="/leads" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Ver todos <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="h-[160px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={leadsChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                      backdropFilter: "blur(12px)",
                    }}
                  />
                  <Area type="monotone" dataKey="count" name="Leads" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#leadGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Status */}
        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.25 }} className="lg:col-span-2">
          <div className="glass-card p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Status</h3>
            </div>
            <div className="space-y-2">
              {statusItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 transition-colors group"
                >
                  <div className={`h-2 w-2 rounded-full shrink-0 ${item.active ? "bg-success animate-glow-pulse" : "bg-muted-foreground/20"}`} />
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{item.label}</p>
                  </div>
                  <span className={`text-[11px] ${item.active ? "text-success" : "text-muted-foreground"}`}>
                    {item.value}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Quick Actions */}
        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.3 }}>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Ações rápidas</p>
            <div className="grid gap-3 grid-cols-2">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.href}
                  className="glass-card p-4 flex items-center gap-3 group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/50 border border-border/30 group-hover:border-primary/30 transition-colors">
                    <action.icon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.35 }}>
          <div className="glass-card p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Atividade recente</h3>
            </div>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-2">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 p-2 rounded-lg">
                    <div className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${act.success ? "bg-success" : "bg-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-foreground/80 truncate">{act.description}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(act.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
