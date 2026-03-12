import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://vssalesreal.lovable.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Detect if lead looks like a company (B2B) or a person (B2C) */
function detectLeadType(lead: { name?: string | null; email?: string | null; phone?: string | null }): "b2b" | "b2c" {
  const name = (lead.name || "").toLowerCase().trim();
  const email = (lead.email || "").toLowerCase().trim();

  // Company indicators in name
  const companyKeywords = [
    "ltda", "eireli", "me ", " me", "s/a", "s.a.", "sa ", "corp", "inc",
    "group", "grupo", "holding", "consulting", "consultoria", "soluções",
    "tecnologia", "tech", "digital", "marketing", "agência", "agencia",
    "studio", "estúdio", "indústria", "industria", "comércio", "comercio",
    "serviços", "servicos", "assessoria", "engenharia", "construtora",
    "imobiliária", "imobiliaria", "clínica", "clinica", "laboratório",
    "laboratorio", "farmácia", "farmacia", "academia", "escola",
    "instituto", "associação", "associacao", "fundação", "fundacao",
    "cooperativa", "distribuidora", "transportadora", "editora",
    "empreendimentos", "incorporadora", "securitizadora", "seguros",
    "corretora", "financeira", "bank", "banco", "capital",
    "restaurante", "hotel", "pousada", "resort",
  ];

  for (const kw of companyKeywords) {
    if (name.includes(kw)) return "b2b";
  }

  // Email with corporate domain (not personal providers)
  const personalDomains = [
    "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
    "live.com", "msn.com", "uol.com.br", "bol.com.br", "terra.com.br",
    "ig.com.br", "globo.com", "protonmail.com", "aol.com",
  ];
  if (email && email.includes("@")) {
    const domain = email.split("@")[1];
    if (domain && !personalDomains.includes(domain)) return "b2b";
  }

  // Names with all caps or very short (likely acronyms / companies)
  if (name.length > 0 && name === name.toUpperCase() && name.length <= 12 && !name.includes(" ")) return "b2b";

  return "b2c";
}

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
      const leadType = detectLeadType(lead);

      const b2bPrompt = `Analise este lead EMPRESARIAL (B2B) e gere um perfil comercial completo para prospecção:

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

      const b2cPrompt = `Analise este lead de PESSOA FÍSICA (B2C / consumidor final) e gere um perfil para abordagem comercial:

DADOS DO LEAD:
- Nome: ${lead.name || "Desconhecido"}
- Telefone: ${lead.phone || "N/A"}
- Email: ${lead.email || "N/A"}
${companyContext}

ANÁLISE SOLICITADA:
1. Perfil demográfico estimado (faixa etária, gênero provável)
2. Localização (cidade/estado baseado no DDD)
3. Classe social/poder aquisitivo estimado
4. Interesses e estilo de vida prováveis
5. Redes sociais prováveis (Instagram, Facebook)
6. Necessidades e motivações de compra prováveis
7. Melhor canal de abordagem (WhatsApp/Email/Telefone)
8. Melhor horário e dia da semana para contato
9. Score de conversão (0-100) com justificativa — considere o FIT com nossos produtos/serviços
10. 2-3 gatilhos emocionais/argumentos de venda personalizados
11. Objeções prováveis e como contorná-las

Responda APENAS em JSON válido.`;

      const systemPromptB2B = "Você é um analista de inteligência comercial sênior especializado em vendas B2B. Analise leads empresariais e retorne JSON com: empresa, cargo, nivel_decisao (C-level/Gerência/Operacional), segmento, porte_empresa (micro/pequena/média/grande), localizacao, redes_sociais (objeto com linkedin, instagram), dores_provaveis (array), canal_ideal, melhor_horario, score_conversao (0-100), justificativa_score, argumentos_venda (array de strings), objecoes_provaveis (array de objetos com objecao e contorno), tipo_lead ('b2b'), observacoes.";

      const systemPromptB2C = "Você é um analista de inteligência comercial sênior especializado em vendas B2C para consumidores finais. Analise leads de pessoas físicas e retorne JSON com: perfil_demografico (objeto com faixa_etaria, genero_provavel), localizacao, classe_social, interesses (array), redes_sociais (objeto com instagram, facebook), necessidades_provaveis (array), canal_ideal, melhor_horario, score_conversao (0-100), justificativa_score, gatilhos_venda (array de strings), objecoes_provaveis (array de objetos com objecao e contorno), tipo_lead ('b2c'), observacoes. NÃO invente dados de empresa, cargo ou segmento B2B — este é um consumidor final.";

      const prompt = leadType === "b2b" ? b2bPrompt : b2cPrompt;
      const systemPrompt = leadType === "b2b" ? systemPromptB2B : systemPromptB2C;

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
              { role: "system", content: systemPrompt },
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

        let enrichmentData: any = { raw_response: content, tipo_lead: leadType };
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            enrichmentData = { ...JSON.parse(jsonMatch[0]), tipo_lead: leadType };
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
