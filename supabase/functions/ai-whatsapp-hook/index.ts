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
    const body = await req.json();

    // Evolution API webhook payload
    const event = body.event;
    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) {
      return new Response(JSON.stringify({ ignored: true, reason: "own message" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const instanceName = body.instance;
    const remoteJid = messageData.key?.remoteJid || "";
    const pushName = messageData.pushName || "";
    const messageText = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || "";

    if (!messageText || remoteJid.endsWith("@g.us")) {
      return new Response(JSON.stringify({ ignored: true, reason: "no text or group" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find which org owns this instance
    const { data: integrations } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("service_name", "evolution");

    let orgId: string | null = null;
    let integration: any = null;

    for (const integ of integrations || []) {
      const config = integ.config as any;
      const byUser = config?.instances_by_user || {};
      for (const userId of Object.keys(byUser)) {
        if ((byUser[userId] as string[]).includes(instanceName)) {
          orgId = integ.org_id;
          integration = integ;
          break;
        }
      }
      if (orgId) break;
    }

    if (!orgId || !integration) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if chatbot is enabled for this instance
    const { data: aiConfig } = await supabaseAdmin
      .from("ai_configs")
      .select("*")
      .eq("org_id", orgId)
      .eq("config_type", "chatbot")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!aiConfig?.enabled) {
      return new Response(JSON.stringify({ ignored: true, reason: "chatbot disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check business hours
    if (aiConfig.only_outside_hours && aiConfig.schedule_start && aiConfig.schedule_end) {
      const now = new Date();
      const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const currentMinutes = brTime.getHours() * 60 + brTime.getMinutes();

      const [startH, startM] = (aiConfig.schedule_start as string).split(":").map(Number);
      const [endH, endM] = (aiConfig.schedule_end as string).split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const currentDay = brTime.getDay() === 0 ? 7 : brTime.getDay();
      const isWorkDay = (aiConfig.schedule_days as number[] || [1,2,3,4,5]).includes(currentDay);
      const isWorkHours = isWorkDay && currentMinutes >= startMinutes && currentMinutes <= endMinutes;

      if (isWorkHours) {
        return new Response(JSON.stringify({ ignored: true, reason: "within business hours" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch knowledge base
    const { data: kbDocs } = await supabaseAdmin
      .from("ai_knowledge_docs")
      .select("title, content")
      .eq("org_id", orgId)
      .limit(20);

    const knowledgeContext = kbDocs?.length
      ? `\n\n--- BASE DE CONHECIMENTO ---\n${kbDocs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")}\n--- FIM ---`
      : "";

    const systemPrompt = `Você é um assistente virtual via WhatsApp para uma empresa.
${aiConfig.system_prompt || "Seja educado, prestativo e profissional."}
Regras:
- Responda de forma curta e direta (WhatsApp)
- Use emojis com moderação
- Se não souber a resposta, diga que vai encaminhar para um atendente humano
- Nunca invente informações
- Responda em português brasileiro${knowledgeContext}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const temperature = aiConfig.temperature ? Number(aiConfig.temperature) : 0.7;

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
          { role: "user", content: `[${pushName}]: ${messageText}` },
        ],
        temperature,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "";

    if (!reply) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send reply via Evolution API
    const evolutionUrl = integration.endpoint_url;
    const evolutionKey = integration.api_key;

    const phone = remoteJid.replace("@s.whatsapp.net", "");

    const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        text: reply,
      }),
    });

    if (!sendResponse.ok) {
      console.error("Evolution send error:", sendResponse.status, await sendResponse.text());
    }

    return new Response(JSON.stringify({ success: true, reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-whatsapp-hook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
