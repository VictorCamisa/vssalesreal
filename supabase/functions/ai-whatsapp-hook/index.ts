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

    // Track conversation for follow-up system
    // When customer sends a message, reset follow-up state (they responded)
    const { data: existingConv } = await supabaseAdmin
      .from("conversation_tracker")
      .select("id")
      .eq("org_id", orgId)
      .eq("instance_name", instanceName)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    if (existingConv) {
      // Increment customer message count for pipeline automation
      await supabaseAdmin.rpc("increment_customer_msg_count", { p_conv_id: existingConv.id });
      await supabaseAdmin
        .from("conversation_tracker")
        .update({
          last_customer_msg_at: new Date().toISOString(),
          push_name: pushName || undefined,
          last_follow_up_step: 0,
          follow_up_paused: false,
          ai_config_id: aiConfig.id,
        })
        .eq("id", existingConv.id);
    } else {
      // Try to find matching lead by phone
      const phone = remoteJid.replace("@s.whatsapp.net", "");
      const { data: matchedLead } = await supabaseAdmin
        .from("leads_raw")
        .select("id")
        .eq("org_id", orgId)
        .or(`phone.ilike.%${phone}%,phone.ilike.%${phone.slice(-8)}%`)
        .maybeSingle();

      await supabaseAdmin
        .from("conversation_tracker")
        .insert({
          org_id: orgId,
          instance_name: instanceName,
          remote_jid: remoteJid,
          push_name: pushName || null,
          last_customer_msg_at: new Date().toISOString(),
          ai_config_id: aiConfig.id,
          lead_id: matchedLead?.id || null,
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

    // Fetch company profile for AI context
    const { data: companyProfile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();

    let companyContext = "";
    if (companyProfile) {
      const cp = companyProfile as any;
      const parts: string[] = [];
      if (cp.company_name) parts.push(`Empresa: ${cp.company_name}`);
      if (cp.segment) parts.push(`Segmento: ${cp.segment}`);
      if (cp.description) parts.push(`Sobre: ${cp.description}`);
      if (cp.target_audience) parts.push(`Público-alvo: ${cp.target_audience}`);
      if (cp.differentials) parts.push(`Diferenciais: ${cp.differentials}`);
      if (cp.tone_of_voice) parts.push(`Tom de voz: ${cp.tone_of_voice}`);
      if (cp.sales_process) parts.push(`Processo: ${cp.sales_process}`);
      const products = cp.products_services || [];
      if (products.length > 0) {
        parts.push("Produtos:\n" + products.map((p: any) => `- ${p.name}${p.price ? ` (${p.price})` : ""}: ${p.description}`).join("\n"));
      }
      const faqs = cp.objections_faq || [];
      if (faqs.length > 0) {
        parts.push("Objeções:\n" + faqs.map((f: any) => `Q: ${f.question}\nR: ${f.answer}`).join("\n"));
      }
      companyContext = `\n\n--- EMPRESA ---\n${parts.join("\n")}\n--- FIM ---`;
    }

    // Smart knowledge retrieval using keywords
    const queryWords = messageText.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);

    const { data: kbDocs } = await supabaseAdmin
      .from("ai_knowledge_docs")
      .select("title, content, summary, keywords, chunks, processed")
      .eq("org_id", orgId);

    let knowledgeContext = "";
    if (kbDocs?.length) {
      const scoredDocs = kbDocs.map((doc: any) => {
        let score = 0;
        if (doc.processed && doc.keywords?.length) {
          for (const kw of doc.keywords) {
            if (queryWords.some((qw: string) => kw.includes(qw) || qw.includes(kw))) score += 2;
          }
          const titleWords = doc.title.toLowerCase().split(/\W+/);
          for (const tw of titleWords) {
            if (queryWords.some((qw: string) => tw.includes(qw) || qw.includes(tw))) score += 3;
          }
        } else {
          score = 1;
        }
        return { ...doc, score };
      });

      scoredDocs.sort((a: any, b: any) => b.score - a.score);
      const relevantDocs = scoredDocs.filter((d: any) => d.score > 0).slice(0, 3);

      const contextParts: string[] = [];
      for (const doc of relevantDocs) {
        if (doc.processed && doc.chunks?.length) {
          const scoredChunks = doc.chunks.map((chunk: any) => {
            let cs = 0;
            const ct = (chunk.text || "").toLowerCase();
            for (const qw of queryWords) { if (ct.includes(qw)) cs++; }
            return { ...chunk, cs };
          });
          scoredChunks.sort((a: any, b: any) => b.cs - a.cs);
          contextParts.push(`## ${doc.title}\n${scoredChunks.slice(0, 2).map((c: any) => c.text).join("\n\n")}`);
        } else {
          contextParts.push(`## ${doc.title}\n${doc.content.substring(0, 1500)}`);
        }
      }

      if (relevantDocs.length === 0 && kbDocs.length > 0) {
        for (const doc of kbDocs.slice(0, 5)) {
          contextParts.push(`## ${(doc as any).title}\n${(doc as any).summary || (doc as any).content.substring(0, 400)}`);
        }
      }

      if (contextParts.length > 0) {
        knowledgeContext = `\n\n--- BASE DE CONHECIMENTO ---\n${contextParts.join("\n\n")}\n--- FIM ---`;
      }
    }

    const systemPrompt = `Você é um assistente virtual via WhatsApp para uma empresa.
${aiConfig.system_prompt || "Seja educado, prestativo e profissional."}

CAPACIDADE DE AGENDAMENTO:
Você pode agendar, verificar e cancelar reuniões. Quando o lead quiser agendar:
1. Pergunte data e horário preferido
2. Quando tiver data e hora, inclua no final da sua resposta (invisível ao lead): [AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]
3. Para cancelar: [CANCELAR:TELEFONE_DO_LEAD]
4. Para verificar agenda: [VERIFICAR:YYYY-MM-DD]
Esses comandos serão processados automaticamente. NÃO mostre os comandos ao lead.

Regras:
- Responda de forma curta e direta (WhatsApp)
- Use emojis com moderação
- Se não souber a resposta, diga que vai encaminhar para um atendente humano
- Nunca invente informações
- Responda em português brasileiro${companyContext}${knowledgeContext}`;

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
    let reply = aiData.choices?.[0]?.message?.content || "";

    if (!reply) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process scheduling commands embedded in AI response
    const phone = remoteJid.replace("@s.whatsapp.net", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const agendarMatch = reply.match(/\[AGENDAR:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):([^\]]+)\]/);
    const cancelarMatch = reply.match(/\[CANCELAR:([^\]]+)\]/);
    const verificarMatch = reply.match(/\[VERIFICAR:(\d{4}-\d{2}-\d{2})\]/);

    // Remove commands from visible reply
    reply = reply.replace(/\[AGENDAR:[^\]]+\]/g, "").replace(/\[CANCELAR:[^\]]+\]/g, "").replace(/\[VERIFICAR:[^\]]+\]/g, "").trim();

    if (agendarMatch) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/manage-appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            action: "create",
            org_id: orgId,
            date: agendarMatch[1],
            time: agendarMatch[2],
            lead_name: agendarMatch[3] || pushName,
            lead_phone: phone,
          }),
        });
      } catch (e) { console.error("Scheduling error:", e); }
    }

    if (cancelarMatch) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/manage-appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            action: "cancel",
            org_id: orgId,
            lead_phone: cancelarMatch[1] || phone,
            reason: "Cancelado pelo lead via WhatsApp",
          }),
        });
      } catch (e) { console.error("Cancel error:", e); }
    }

    // Send reply via Evolution API (global credentials)
    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

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
    } else {
      // Update conversation tracker with bot reply time
      await supabaseAdmin
        .from("conversation_tracker")
        .update({ last_bot_msg_at: new Date().toISOString() })
        .eq("org_id", orgId)
        .eq("instance_name", instanceName)
        .eq("remote_jid", remoteJid);
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
