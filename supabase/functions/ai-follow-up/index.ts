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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Find all conversations that need follow-up:
    // - Not paused (lead hasn't replied since last follow-up)
    // - Has an ai_config_id linked
    const { data: conversations, error: convErr } = await supabaseAdmin
      .from("conversation_tracker")
      .select("*")
      .eq("follow_up_paused", false)
      .not("ai_config_id", "is", null);

    if (convErr) {
      console.error("Error fetching conversations:", convErr);
      throw convErr;
    }

    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No conversations need follow-up" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all follow-up rules grouped by ai_config_id
    const configIds = [...new Set(conversations.map((c: any) => c.ai_config_id).filter(Boolean))];
    const { data: allRules } = await supabaseAdmin
      .from("follow_up_rules")
      .select("*")
      .in("ai_config_id", configIds)
      .eq("enabled", true)
      .order("step_order", { ascending: true });

    if (!allRules || allRules.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No follow-up rules configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group rules by ai_config_id
    const rulesByConfig: Record<string, any[]> = {};
    for (const rule of allRules) {
      if (!rulesByConfig[rule.ai_config_id]) rulesByConfig[rule.ai_config_id] = [];
      rulesByConfig[rule.ai_config_id].push(rule);
    }

    // Get integration info for Evolution API (grouped by org)
    const orgIds = [...new Set(conversations.map((c: any) => c.org_id))];
    const { data: integrations } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .in("org_id", orgIds)
      .eq("service_name", "evolution");

    const integrationByOrg: Record<string, any> = {};
    for (const integ of integrations || []) {
      integrationByOrg[integ.org_id] = integ;
    }

    // Get AI configs for system prompts
    const { data: aiConfigs } = await supabaseAdmin
      .from("ai_configs")
      .select("*")
      .in("id", configIds);

    const aiConfigById: Record<string, any> = {};
    for (const cfg of aiConfigs || []) {
      aiConfigById[cfg.id] = cfg;
    }

    const now = new Date();
    let processed = 0;
    const results: any[] = [];

    for (const conv of conversations) {
      const rules = rulesByConfig[conv.ai_config_id] || [];
      if (rules.length === 0) continue;

      const nextStep = conv.last_follow_up_step + 1;
      const rule = rules.find((r: any) => r.step_order === nextStep);

      if (!rule) {
        // All follow-up steps exhausted for this conversation
        continue;
      }

      // Check if enough time has passed since last bot message or last customer message
      const referenceTime = conv.last_bot_msg_at || conv.last_customer_msg_at;
      const refDate = new Date(referenceTime);
      const minutesSince = (now.getTime() - refDate.getTime()) / (1000 * 60);

      if (minutesSince < rule.delay_minutes) {
        // Not yet time for this follow-up
        continue;
      }

      const integration = integrationByOrg[conv.org_id];
      if (!integration) {
        console.error(`No Evolution integration for org ${conv.org_id}`);
        continue;
      }

      const aiConfig = aiConfigById[conv.ai_config_id];
      if (!aiConfig?.enabled) continue;

      // Generate follow-up message using AI
      const contextHint = rule.context_hint || "reativar a conversa de forma natural";
      const stepLabel = `${nextStep}º follow-up (de ${rules.length} total)`;

      const systemPrompt = `Você é um assistente de vendas via WhatsApp.
${aiConfig.system_prompt || "Seja educado, prestativo e profissional."}

SITUAÇÃO: O lead "${conv.push_name || 'cliente'}" não respondeu há ${Math.round(minutesSince)} minutos.
Este é o ${stepLabel}.
Objetivo do follow-up: ${contextHint}

REGRAS:
- Mensagem CURTA (máx 2 linhas)
- Tom natural, não robótico
- NÃO repita mensagens anteriores
- Varie a abordagem a cada etapa
- Se for o último follow-up, indique que está à disposição sem pressionar
- Use 1 emoji no máximo
- Responda APENAS com a mensagem, sem explicação`;

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
              { role: "user", content: `Gere a mensagem de follow-up #${nextStep} para ${conv.push_name || "o lead"}.` },
            ],
            temperature: aiConfig.temperature ? Number(aiConfig.temperature) : 0.7,
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI error for conv ${conv.id}:`, aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        const reply = aiData.choices?.[0]?.message?.content?.trim() || "";

        if (!reply) continue;

        // Send via Evolution API
        const phone = conv.remote_jid.replace("@s.whatsapp.net", "");
        const sendResponse = await fetch(
          `${integration.endpoint_url}/message/sendText/${conv.instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: integration.api_key,
            },
            body: JSON.stringify({ number: phone, text: reply }),
          }
        );

        if (!sendResponse.ok) {
          console.error(`Evolution send error for ${phone}:`, sendResponse.status);
          results.push({ conv_id: conv.id, status: "send_failed", phone });
          continue;
        }

        // Update conversation tracker
        await supabaseAdmin
          .from("conversation_tracker")
          .update({
            last_bot_msg_at: now.toISOString(),
            last_follow_up_step: nextStep,
            // If this was the last step, pause further follow-ups
            follow_up_paused: nextStep >= rules.length,
          })
          .eq("id", conv.id);

        processed++;
        results.push({ conv_id: conv.id, status: "sent", step: nextStep, phone });
        console.log(`Follow-up #${nextStep} sent to ${phone} on instance ${conv.instance_name}`);
      } catch (err) {
        console.error(`Error processing follow-up for conv ${conv.id}:`, err);
        results.push({ conv_id: conv.id, status: "error", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ processed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-follow-up error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
