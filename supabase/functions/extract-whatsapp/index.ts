import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { org_id, group_name } = await req.json();
    if (!org_id || !group_name) {
      return new Response(JSON.stringify({ error: "org_id and group_name are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Evolution API credentials from integrations table
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("api_key, endpoint_url")
      .eq("org_id", org_id)
      .eq("service_name", "evolution")
      .single();

    if (!integration?.api_key || !integration?.endpoint_url) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada. Vá em Configurações para adicionar URL e API Key." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = integration.endpoint_url.replace(/\/$/, "");
    const apiKey = integration.api_key;

    console.log("Fetching groups from Evolution API:", baseUrl);

    // 1. List all groups to find matching one
    const groupsResponse = await fetch(`${baseUrl}/group/fetchAllGroups/default`, {
      method: "GET",
      headers: { apikey: apiKey },
    });

    if (!groupsResponse.ok) {
      const errText = await groupsResponse.text();
      console.error("Evolution groups error:", groupsResponse.status, errText);
      return new Response(JSON.stringify({ error: `Evolution API error: ${groupsResponse.status}. Verifique a URL e API Key.` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groups = await groupsResponse.json();
    const targetGroup = (Array.isArray(groups) ? groups : []).find(
      (g: any) => g.subject?.toLowerCase().includes(group_name.toLowerCase())
    );

    if (!targetGroup) {
      return new Response(JSON.stringify({ error: `Grupo "${group_name}" não encontrado. Grupos disponíveis: ${(groups || []).slice(0, 5).map((g: any) => g.subject).join(", ")}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Found group:", targetGroup.subject, "ID:", targetGroup.id);

    // 2. Get group participants
    const participantsResponse = await fetch(`${baseUrl}/group/participants/default?groupJid=${targetGroup.id}`, {
      method: "GET",
      headers: { apikey: apiKey },
    });

    if (!participantsResponse.ok) {
      const errText = await participantsResponse.text();
      console.error("Evolution participants error:", participantsResponse.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao buscar participantes do grupo." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const participantsData = await participantsResponse.json();
    const participants = participantsData?.participants || participantsData || [];

    if (!Array.isArray(participants) || participants.length === 0) {
      return new Response(JSON.stringify({ count: 0, message: "Nenhum participante encontrado no grupo." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Format phone numbers and deduplicate
    const formatPhone = (jid: string) => {
      const digits = jid.replace(/@.*/, "").replace(/\D/g, "");
      return digits ? `+${digits}` : null;
    };

    const phones = participants.map((p: any) => formatPhone(p.id || "")).filter(Boolean);

    // Check existing
    const { data: existingLeads } = await supabaseAdmin
      .from("leads_raw")
      .select("phone")
      .eq("org_id", org_id)
      .in("phone", phones);
    const existingPhones = new Set((existingLeads || []).map((l) => l.phone));

    const newLeads = participants
      .map((p: any) => {
        const phone = formatPhone(p.id || "");
        if (!phone || existingPhones.has(phone)) return null;
        return {
          org_id,
          name: p.name || p.notify || null,
          phone,
          source: "whatsapp" as const,
          status: "pending" as const,
          enrichment_data: { group: targetGroup.subject, group_id: targetGroup.id },
        };
      })
      .filter(Boolean);

    if (newLeads.length > 0) {
      const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(newLeads);
      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ count: newLeads.length, total_participants: participants.length, group: targetGroup.subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-whatsapp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
