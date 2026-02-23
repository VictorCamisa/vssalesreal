import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Target, TrendingUp, Zap, Loader2, ArrowUpRight } from "lucide-react";

export default function Index() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ leads: 0, opportunities: 0, converted: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.org_id) return;
    const orgId = profile.org_id;

    const fetchStats = async () => {
      try {
        const [leadsRes, oppsRes, convertedRes] = await Promise.all([
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "converted"),
        ]);
        setStats({
          leads: leadsRes.count ?? 0,
          opportunities: oppsRes.count ?? 0,
          converted: convertedRes.count ?? 0,
        });
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
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      change: "+12%",
    },
    { 
      title: "Em Pipeline", 
      value: stats.opportunities, 
      icon: Target, 
      gradient: "from-warning/20 to-warning/5",
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
      change: "+5%",
    },
    { 
      title: "Convertidos", 
      value: stats.converted, 
      icon: TrendingUp, 
      gradient: "from-success/20 to-success/5",
      iconBg: "bg-success/15",
      iconColor: "text-success",
      change: "+8%",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary glow-sm">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Visão geral da sua operação comercial</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
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

      {/* Quick Actions */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
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
