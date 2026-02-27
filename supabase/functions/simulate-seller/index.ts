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

    const orgId = profile.org_id;
    const { messages } = await req.json();

    // Fetch all context in parallel
    const [companyRes, aiConfigRes, knowledgeRes, leadsCountRes, oppsRes] = await Promise.all([
      supabase.from("company_profiles").select("*").eq("org_id", orgId).maybeSingle(),
      supabase.from("ai_configs").select("*").eq("org_id", orgId).eq("enabled", true).limit(1),
      supabase.from("ai_knowledge_docs").select("title, summary, keywords").eq("org_id", orgId),
      supabase.from("leads_raw").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("opportunities").select("value, probability").eq("org_id", orgId),
    ]);

    const company = companyRes.data;
    const aiConfig = aiConfigRes.data?.[0];
    const knowledgeDocs = knowledgeRes.data || [];
    const totalLeads = leadsCountRes.count || 0;
    const opps = oppsRes.data || [];
    const pipelineValue = opps.reduce((sum: number, o: any) => sum + (Number(o.value) || 0), 0);

    // Build rich system prompt
    let systemPrompt = `Você é o vendedor virtual da empresa. Responda EXATAMENTE como o vendedor real responderia, usando todas as informações abaixo.\n\n`;

    if (company) {
      systemPrompt += `## EMPRESA\n`;
      systemPrompt += `- Nome: ${company.company_name}\n`;
      if (company.segment) systemPrompt += `- Segmento: ${company.segment}\n`;
      if (company.description) systemPrompt += `- Descrição: ${company.description}\n`;
      if (company.mission) systemPrompt += `- Missão: ${company.mission}\n`;
      if (company.differentials) systemPrompt += `- Diferenciais: ${company.differentials}\n`;
      if (company.target_audience) systemPrompt += `- Público-alvo: ${company.target_audience}\n`;
      if (company.tone_of_voice) systemPrompt += `- Tom de voz: ${company.tone_of_voice}\n`;
      if (company.avg_ticket) systemPrompt += `- Ticket médio: ${company.avg_ticket}\n`;
      if (company.sales_process) systemPrompt += `- Processo de vendas: ${company.sales_process}\n`;

      const products = company.products_services as any[];
      if (products?.length) {
        systemPrompt += `\n## PRODUTOS/SERVIÇOS\n`;
        products.forEach((p: any) => {
          systemPrompt += `- ${p.name}: ${p.description}${p.price ? ` (${p.price})` : ""}\n`;
        });
      }

      const faqs = company.objections_faq as any[];
      if (faqs?.length) {
        systemPrompt += `\n## OBJEÇÕES E RESPOSTAS\n`;
        faqs.forEach((f: any) => {
          systemPrompt += `- Objeção: "${f.question}" → Resposta: "${f.answer}"\n`;
        });
      }
    }

    if (aiConfig?.system_prompt) {
      systemPrompt += `\n## PERSONALIDADE DO AGENTE\n${aiConfig.system_prompt}\n`;
    }

    if (knowledgeDocs.length > 0) {
      systemPrompt += `\n## BASE DE CONHECIMENTO (${knowledgeDocs.length} documentos)\n`;
      knowledgeDocs.slice(0, 10).forEach((doc: any) => {
        systemPrompt += `- ${doc.title}${doc.summary ? `: ${doc.summary}` : ""}\n`;
      });
    }

    systemPrompt += `\n## CONTEXTO OPERACIONAL\n`;
    systemPrompt += `- Total de leads na base: ${totalLeads}\n`;
    systemPrompt += `- Valor total no pipeline: R$ ${pipelineValue.toLocaleString("pt-BR")}\n`;
    systemPrompt += `- Oportunidades ativas: ${opps.length}\n`;

    systemPrompt += `\n## REGRAS\n`;
    systemPrompt += `- Responda como se fosse uma conversa real de WhatsApp\n`;
    systemPrompt += `- Use o tom de voz da empresa\n`;
    systemPrompt += `- Mensagens curtas (máx 4 linhas)\n`;
    systemPrompt += `- Use emojis com moderação\n`;
    systemPrompt += `- NUNCA invente informações sobre produtos/preços que não estão listados acima\n`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("simulate-seller error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
