import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  created_at: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  enriched: "bg-primary/10 text-primary border-primary/20",
  converted: "bg-success/10 text-success border-success/20",
  discarded: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Leads() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!profile?.org_id) return;
    supabase
      .from("leads_raw")
      .select("id, name, phone, email, source, status, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setLeads(data ?? []));
  }, [profile?.org_id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Leads Raspados
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Inbox de triagem e qualificação</p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 p-12 text-center text-muted-foreground">
          Nenhum lead capturado ainda. Inicie uma prospecção primeiro.
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{lead.phone || "—"}</TableCell>
                  <TableCell>{lead.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{lead.source}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[lead.status] || ""} variant="outline">
                      {lead.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
