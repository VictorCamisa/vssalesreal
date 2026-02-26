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

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { lead_ids, org_id } = await req.json();
    if (!lead_ids?.length || !org_id) throw new Error("lead_ids and org_id are required");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch company profile for richer context
    const { data: companyProfile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("org_id", org_id)
      .maybeSingle();

    let companyContext = "";
    if (companyProfile) {
      const cp = companyProfile as any;
      const parts: string[] = [];
      if (cp.company_name) parts.push(`Nossa Empresa: ${cp.company_name}`);
      if (cp.segment) parts.push(`Nosso Segmento: ${cp.segment}`);
      if (cp.description) parts.push(`O que fazemos: ${cp.description}`);
      if (cp.target_audience) parts.push(`Nosso Público-alvo: ${cp.target_audience}`);
      if (cp.differentials) parts.push(`Nossos Diferenciais: ${cp.differentials}`);
      if (cp.avg_ticket) parts.push(`Ticket Médio: ${cp.avg_ticket}`);
      if (cp.sales_process) parts.push(`Processo de Vendas: ${cp.sales_process}`);
      if (cp.tone_of_voice) parts.push(`Tom de Comunicação: ${cp.tone_of_voice}`);
      const products = cp.products_services || [];
      if (products.length > 0) {
        parts.push("Nossos Produtos/Serviços:\n" + products.map((p: any) => `- ${p.name}${p.price ? ` (${p.price})` : ""}: ${p.description}`).join("\n"));
      }
      const faqs = cp.objections_faq || [];
      if (faqs.length > 0) {
        parts.push("Objeções Comuns e Respostas:\n" + faqs.map((f: any) => `Q: ${f.question}\nR: ${f.answer}`).join("\n\n"));
      }
      companyContext = `\n\nCONTEXTO DA NOSSA EMPRESA (use para personalizar a análise e os argumentos de venda):\n${parts.join("\n")}`;
    }

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
      const prompt = `Analise este lead e gere um perfil comercial completo para prospecção:

DADOS DO LEAD:
- Nome: ${lead.name || "Desconhecido"}
- Telefone: ${lead.phone || "N/A"}
- Email: ${lead.email || "N/A"}
${companyContext}

ANÁLISE SOLICITADA:
1. Empresa provável (baseado em domínio do email ou DDD do telefone)
2. Cargo estimado e nível de decisão
3. Segmento de mercado e porte da empresa
4. Localização (cidade/estado baseado no DDD)
5. Redes sociais prováveis (LinkedIn URL estimada)
6. Dores e necessidades prováveis do segmento
7. Melhor canal de abordagem (WhatsApp/Email/LinkedIn/Telefone)
8. Melhor horário e dia da semana para contato
9. Score de conversão (0-100) com justificativa — considere o FIT com nossos produtos/serviços e público-alvo
10. 2-3 argumentos de venda personalizados para este lead com base nos nossos diferenciais e produtos
11. Objeções prováveis deste lead e como contorná-las com base nas nossas respostas padrão

Responda APENAS em JSON válido.`;

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
              { role: "system", content: "Você é um analista de inteligência comercial sênior. Analise leads e retorne JSON com: empresa, cargo, nivel_decisao (C-level/Gerência/Operacional), segmento, porte_empresa (micro/pequena/média/grande), localizacao, redes_sociais (objeto com linkedin, instagram), dores_provaveis (array), canal_ideal, melhor_horario, score_conversao (0-100), justificativa_score, argumentos_venda (array de strings personalizados com base nos produtos/diferenciais da empresa), objecoes_provaveis (array de objetos com objecao e contorno), observacoes. Quando tiver contexto da empresa vendedora, personalize os argumentos de venda e o score de conversão com base no fit entre o lead e os produtos/serviços oferecidos." },
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
