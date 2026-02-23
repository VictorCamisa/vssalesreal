import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";

export default function Onboarding() {
  const { user } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Create org
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName, owner_id: user.id })
        .select()
        .single();
      if (orgError) throw orgError;

      // Update profile with org_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ org_id: org.id })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      // Add admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, org_id: org.id, role: "admin" });
      if (roleError) throw roleError;

      // Seed default CRM stages
      const stages = [
        { name: "Qualificação", stage_order: 0, org_id: org.id },
        { name: "Prospecção", stage_order: 1, org_id: org.id },
        { name: "Proposta", stage_order: 2, org_id: org.id },
        { name: "Negociação", stage_order: 3, org_id: org.id },
        { name: "Fechamento", stage_order: 4, org_id: org.id },
      ];
      await supabase.from("crm_stages").insert(stages);

      toast({ title: "Organização criada!", description: `${orgName} está pronta.` });
      // Force page reload to refetch profile
      window.location.href = "/";
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-2">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Crie sua organização</CardTitle>
          <CardDescription>
            Configure o nome da sua empresa para começar a usar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Nome da organização</Label>
              <Input
                id="orgName"
                placeholder="Minha Empresa Ltda"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar e continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
