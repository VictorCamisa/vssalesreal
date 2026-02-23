import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { lead_ids, org_id } = await req.json();
    if (!lead_ids?.length || !org_id) throw new Error("lead_ids and org_id are required");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch leads
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leads_raw")
      .select("id, name, phone, email")
      .in("id", lead_ids)
      .eq("org_id", org_id);

    if (leadsError) throw leadsError;
    if (!leads?.length) throw new Error("No leads found");

    let enriched = 0;

    for (const lead of leads) {
      const prompt = `Enriqueça os dados deste lead comercial e retorne informações relevantes para prospecção B2B:
Nome: ${lead.name || "Desconhecido"}
Telefone: ${lead.phone || "N/A"}
Email: ${lead.email || "N/A"}

Retorne informações como: empresa provável, cargo estimado, segmento de mercado, cidade/estado, redes sociais prováveis, e uma pontuação de 0-100 indicando potencial de conversão. Responda em JSON.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Você é um assistente de inteligência comercial B2B. Responda em JSON válido com campos: empresa, cargo, segmento, localizacao, redes_sociais, score_conversao (0-100), observacoes." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResponse.status === 429) {
          console.warn("Rate limited, stopping enrichment");
          break;
        }
        if (aiResponse.status === 402) {
          throw new Error("Créditos de IA insuficientes. Adicione créditos na sua workspace.");
        }
        if (!aiResponse.ok) {
          console.error("AI error for lead", lead.id, aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        // Try to parse JSON from the response
        let enrichmentData: any = { raw_response: content };
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            enrichmentData = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Keep raw response
        }

        await supabaseAdmin
          .from("leads_raw")
          .update({
            enrichment_data: enrichmentData,
            status: "enriched",
          })
          .eq("id", lead.id);

        enriched++;
      } catch (leadError) {
        console.error("Error enriching lead", lead.id, leadError);
      }
    }

    return new Response(JSON.stringify({ enriched, total: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-lead error:", e);
    const status = e instanceof Error && e.message === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
