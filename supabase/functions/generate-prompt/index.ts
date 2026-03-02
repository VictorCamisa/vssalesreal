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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.org_id) throw new Error("No org");

    const { user_description, prompt_type } = await req.json();
    if (!user_description || !prompt_type) throw new Error("Missing user_description or prompt_type");

    // Fetch company data
    const { data: company } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("org_id", profile.org_id)
      .maybeSingle();

    // Build context about the company
    const prefix = prompt_type === "b2b" ? "b2b" : "b2c";
    const companyCtx = company ? `
DADOS DA EMPRESA:
- Nome: ${company.company_name || "Não informado"}
- Segmento: ${company.segment || "Não informado"}
- Descrição: ${company.description || "Não informado"}
- Tom de Voz (${prefix.toUpperCase()}): ${company[`${prefix}_tone_of_voice`] || company.tone_of_voice || "Não informado"}
- Público-Alvo (${prefix.toUpperCase()}): ${company[`${prefix}_target_audience`] || company.target_audience || "Não informado"}
- Diferenciais (${prefix.toUpperCase()}): ${company[`${prefix}_differentials`] || company.differentials || "Não informado"}
- Processo de Vendas (${prefix.toUpperCase()}): ${company[`${prefix}_sales_process`] || company.sales_process || "Não informado"}
- Ticket Médio (${prefix.toUpperCase()}): ${company[`${prefix}_avg_ticket`] || company.avg_ticket || "Não informado"}
- Produtos: ${JSON.stringify((company[`${prefix}_products_services`] || company.products_services || []).slice(0, 10))}
- Objeções: ${JSON.stringify((company[`${prefix}_objections_faq`] || company.objections_faq || []).slice(0, 10))}
` : "Dados da empresa não encontrados.";

    const typeLabels: Record<string, string> = {
      b2b: "B2B (vendas para empresas)",
      b2c_broadcast: "B2C Disparo (consumidor final que respondeu a uma campanha de marketing)",
      b2c_organic: "B2C Qualificativo (consumidor final que chegou organicamente)",
    };

    const systemPrompt = `Você é um especialista em criação de prompts de sistema para agentes de vendas por WhatsApp.

Seu trabalho é gerar um prompt de sistema COMPLETO, PROFISSIONAL e PRONTO PARA USO baseado na descrição do usuário e nos dados da empresa.

TIPO DE PROMPT: ${typeLabels[prompt_type] || prompt_type}

${companyCtx}

REGRAS OBRIGATÓRIAS DO PROMPT GERADO:
1. O prompt deve ser em português brasileiro
2. Deve incluir REGRAS claras e objetivas para o agente
3. Deve definir o tom de voz e personalidade
4. Deve incluir instruções sobre o que NUNCA fazer
5. Deve ser específico para o tipo "${typeLabels[prompt_type]}"
6. ${prompt_type === "b2b" ? "NUNCA mencione festas, churrascos, consumo pessoal. Foco em ROI, dados, cases." : ""}
7. ${prompt_type.startsWith("b2c") ? "NUNCA mencione PDV, revenda, estabelecimento comercial. Foco em consumo pessoal." : ""}
8. Deve usar os dados REAIS da empresa fornecidos acima (produtos, preços, diferenciais)
9. O prompt deve ter entre 500 e 1500 caracteres — conciso mas completo
10. NÃO coloque explicações antes ou depois do prompt. Retorne APENAS o prompt pronto.
11. O prompt deve começar com "Você é..." definindo o papel do agente

IMPORTANTE: Retorne SOMENTE o prompt final, sem comentários, sem explicações, sem blocos de código.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: user_description },
        ],
        stream: false,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiResp.json();
    const generatedPrompt = aiData.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ prompt: generatedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-prompt error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
