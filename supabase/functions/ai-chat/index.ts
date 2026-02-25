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

    const { messages, org_id, mode } = await req.json();
    // mode: "assistant" (internal helper) | "generate_message" (prospecting copy)

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch AI config for this org + mode
    const configType = mode === "generate_message" ? "messages" : "assistant";
    const { data: aiConfig } = await supabaseAdmin
      .from("ai_configs")
      .select("*")
      .eq("org_id", org_id)
      .eq("config_type", configType)
      .maybeSingle();

    // Fetch knowledge base docs for context
    const { data: kbDocs } = await supabaseAdmin
      .from("ai_knowledge_docs")
      .select("title, content")
      .eq("org_id", org_id)
      .limit(20);

    const knowledgeContext = kbDocs?.length
      ? `\n\n--- BASE DE CONHECIMENTO ---\n${kbDocs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")}\n--- FIM DA BASE ---`
      : "";

    let systemPrompt = "";

    if (mode === "generate_message") {
      systemPrompt = `Você é um especialista em copywriting e vendas B2B. Gere mensagens personalizadas de prospecção.
${aiConfig?.system_prompt || ""}
Regras:
- Mensagens curtas, diretas e personalizadas
- Tom profissional mas humano
- Inclua CTA claro
- Retorne 3 variações de mensagem
- Formate em markdown${knowledgeContext}`;
    } else {
      systemPrompt = `Você é um assistente de vendas inteligente integrado a um CRM.
${aiConfig?.system_prompt || ""}
Você tem acesso à base de conhecimento da empresa e ajuda a equipe com:
- Análise de leads e sugestões de abordagem
- Resumos de conversas e insights
- Estratégias de vendas
- Respostas para objeções comuns
Responda sempre em português brasileiro.${knowledgeContext}`;
    }

    const temperature = aiConfig?.temperature ? Number(aiConfig.temperature) : 0.7;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
