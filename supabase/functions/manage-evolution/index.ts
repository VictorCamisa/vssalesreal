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

    const userId = user.id;
    const body = await req.json();
    const { action, org_id, instance_name } = body;

    if (!org_id) return json({ error: "org_id is required" }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("id, api_key, endpoint_url, config")
      .eq("org_id", org_id)
      .eq("service_name", "evolution")
      .single();

    if (!integration?.api_key || !integration?.endpoint_url) {
      return json({ error: "Evolution API não configurada. Vá em Configurações e adicione a API Key e URL." }, 400);
    }

    const baseUrl = integration.endpoint_url.replace(/\/$/, "");
    const apiKey = integration.api_key;
    const currentConfig = (integration.config as any) || {};

    // Helper: get/set per-user instances from config.instances_by_user
    const getUserInstances = (): string[] => {
      return currentConfig.instances_by_user?.[userId] || [];
    };
    const setUserInstances = async (names: string[]) => {
      const byUser = currentConfig.instances_by_user || {};
      byUser[userId] = names;
      await supabaseAdmin
        .from("integrations")
        .update({ config: { ...currentConfig, instances_by_user: byUser } })
        .eq("id", integration.id);
    };

    // ============================================
    // ACTION: create
    // ============================================
    if (action === "create") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

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
        return json({ error: `Erro ao criar instância: ${response.status} - ${errText}` }, 502);
      }

      const data = await response.json();

      // Persist to user's instance list
      const userInst = getUserInstances();
      if (!userInst.includes(instance_name)) {
        userInst.push(instance_name);
        await setUserInstances(userInst);
      }

      return json({ instance: data.instance, qrcode: data.qrcode, hash: data.hash });
    }

    // ============================================
    // ACTION: qrcode
    // ============================================
    if (action === "qrcode") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) {
        const errText = await response.text();
        return json({ error: `Erro ao obter QR code: ${response.status}` }, 502);
      }

      const data = await response.json();
      return json({ qrcode: data.base64 || data.qrcode, code: data.code });
    }

    // ============================================
    // ACTION: status
    // ============================================
    if (action === "status") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);

      const response = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!response.ok) return json({ state: "unknown" });

      const data = await response.json();
      const state = data.instance?.state || data.state || "unknown";

      // Persist if connected and not tracked
      if (state === "open") {
        const userInst = getUserInstances();
        if (!userInst.includes(instance_name)) {
          userInst.push(instance_name);
          await setUserInstances(userInst);
        }
      }

      return json({ state });
    }

    // ============================================
    // ACTION: list - List only THIS user's instances
    // ============================================
    if (action === "list") {
      const userInstances = getUserInstances();

      // Fetch all from Evolution API to hydrate state
      let apiMap: Record<string, { state: string; owner: string | null }> = {};
      try {
        const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: { apikey: apiKey },
        });
        if (response.ok) {
          const raw = await response.json();
          const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.instances) ? raw.instances : Array.isArray(raw?.data) ? raw.data : [];
          for (const inst of arr) {
            const name = inst?.instance?.instanceName || inst?.instanceName || inst?.name;
            if (name) {
              apiMap[name] = {
                state: inst?.instance?.state || inst?.state || "unknown",
                owner: inst?.instance?.owner || inst?.owner || null,
              };
            }
          }
        }
      } catch { /* ignore */ }

      // Only return instances belonging to this user
      let instances = userInstances.map((name) => ({
        name,
        state: apiMap[name]?.state || "unknown",
        owner: apiMap[name]?.owner || null,
      }));

      // For unknown states, check individually
      instances = await Promise.all(instances.map(async (inst) => {
        if (inst.state !== "unknown") return inst;
        try {
          const stateResp = await fetch(`${baseUrl}/instance/connectionState/${inst.name}`, {
            method: "GET",
            headers: { apikey: apiKey },
          });
          if (!stateResp.ok) return inst;
          const stateData = await stateResp.json();
          return { ...inst, state: stateData.instance?.state || stateData.state || "unknown" };
        } catch { return inst; }
      }));

      return json({ instances });
    }

    // ============================================
    // ACTION: delete
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

      // Remove from user's list
      const userInst = getUserInstances().filter((n) => n !== instance_name);
      await setUserInstances(userInst);

      return json({ success: true });
    }

    return json({ error: `Ação inválida: ${action}` }, 400);

  } catch (e) {
    console.error("manage-evolution error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
