import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, TrendingUp, Zap, Loader2 } from "lucide-react";

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
    { title: "Leads Capturados", value: stats.leads, icon: Users, color: "text-primary" },
    { title: "Em Pipeline", value: stats.opportunities, icon: Target, color: "text-warning" },
    { title: "Convertidos", value: stats.converted, icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua operação comercial</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="border-border/50 bg-card/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-3xl font-bold">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
