import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, org_id, instance_name } = body;

    if (!org_id) return json({ error: "org_id is required" }, 400);

    // Get Evolution API credentials from integrations table
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("api_key, endpoint_url, config")
      .eq("org_id", org_id)
      .eq("service_name", "evolution")
      .single();

    if (!integration?.api_key || !integration?.endpoint_url) {
      return json({ error: "Evolution API não configurada. Vá em Configurações e adicione a API Key e URL." }, 400);
    }

    const baseUrl = integration.endpoint_url.replace(/\/$/, "");
    const apiKey = integration.api_key;

    // ============================================
    // ACTION: create - Create a new instance
    // ============================================
    if (action === "create") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      console.log("Creating instance:", instance_name);

      const response = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instance_name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Create instance error:", response.status, errText);
        return json({ error: `Erro ao criar instância: ${response.status} - ${errText}` }, 502);
      }

      const data = await response.json();
      console.log("Instance created:", JSON.stringify(data));

      // Save instance name to org's integration config
      const currentConfig = integration.config || {};
      const orgInstances: string[] = (currentConfig as any).instances || [];
      if (!orgInstances.includes(instance_name)) {
        orgInstances.push(instance_name);
      }
      await supabaseAdmin
        .from("integrations")
        .update({ config: { ...(currentConfig as any), instances: orgInstances } })
        .eq("org_id", org_id)
        .eq("service_name", "evolution");

      return json({
        instance: data.instance,
        qrcode: data.qrcode,
        hash: data.hash,
      });
    }

    // ============================================
    // ACTION: qrcode - Get QR code for connection
    // ============================================
    if (action === "qrcode") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      console.log("Fetching QR code for:", instance_name);

      const response = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("QR code error:", response.status, errText);
        return json({ error: `Erro ao obter QR code: ${response.status}` }, 502);
      }

      const data = await response.json();
      return json({ qrcode: data.base64 || data.qrcode, code: data.code });
    }

    // ============================================
    // ACTION: status - Check instance connection
    // ============================================
    if (action === "status") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        return json({ state: "unknown" });
      }

      const data = await response.json();
      return json({ state: data.instance?.state || data.state || "unknown" });
    }

    // ============================================
    // ACTION: list - List all instances
    // ============================================
    if (action === "list") {
      // Get org's registered instances from config
      const currentConfig = (integration as any).config || {};
      const orgInstances: string[] = currentConfig.instances || [];

      if (orgInstances.length === 0) {
        return json({ instances: [] });
      }

      const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("List instances error:", response.status, errText);
        return json({ error: `Erro ao listar instâncias: ${response.status}` }, 502);
      }

      const data = await response.json();
      const allInstances = Array.isArray(data) ? data : [];
      const instances = allInstances
        .filter((inst: any) => {
          const name = inst.instance?.instanceName || inst.instanceName;
          return orgInstances.includes(name);
        })
        .map((inst: any) => ({
          name: inst.instance?.instanceName || inst.instanceName,
          state: inst.instance?.state || inst.state || "unknown",
          owner: inst.instance?.owner || null,
        }));

      return json({ instances });
    }

    // ============================================
    // ACTION: delete - Delete an instance
    // ============================================
    if (action === "delete") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/delete/${instance_name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const errText = await response.text();
        return json({ error: `Erro ao deletar: ${response.status} - ${errText}` }, 502);
      }

      // Remove instance from org config
      const currentConfig = (integration as any).config || {};
      const orgInstances: string[] = (currentConfig.instances || []).filter((n: string) => n !== instance_name);
      await supabaseAdmin
        .from("integrations")
        .update({ config: { ...currentConfig, instances: orgInstances } })
        .eq("org_id", org_id)
        .eq("service_name", "evolution");

      return json({ success: true });
    }

    return json({ error: `Ação inválida: ${action}. Use 'create', 'qrcode', 'status', 'list' ou 'delete'.` }, 400);

  } catch (e) {
    console.error("manage-evolution error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
