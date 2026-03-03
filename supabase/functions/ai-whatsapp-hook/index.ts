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
    if (body.event !== "messages.upsert") {
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

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---- Helper: save message ----
    const saveMessage = async (orgId: string, instName: string, jid: string, fromMe: boolean, text: string, pName?: string, msgId?: string) => {
      try {
        await supabaseAdmin.from("chat_messages").insert({
          org_id: orgId, instance_name: instName, remote_jid: jid, from_me: fromMe,
          message_text: text, push_name: pName || null,
          message_id: msgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
        });
      } catch (e) { console.error("saveMessage error:", e); }
    };

    // ---- Find org via instance ----
    const { data: integrations } = await supabaseAdmin.from("integrations").select("*").eq("service_name", "evolution");
    let orgId: string | null = null;
    for (const integ of integrations || []) {
      const config = integ.config as any;
      const byUser = config?.instances_by_user || {};
      for (const userId of Object.keys(byUser)) {
        if ((byUser[userId] as string[]).includes(instanceName)) { orgId = integ.org_id; break; }
      }
      if (orgId) break;
    }
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Save incoming message
    await saveMessage(orgId, instanceName, remoteJid, false, messageText, pushName, messageData.key?.id || null);

    // ---- Check if any scenario is enabled for this org ----
    const { data: scenarios } = await supabaseAdmin
      .from("ai_scenarios")
      .select("*")
      .eq("org_id", orgId)
      .eq("enabled", true);

    if (!scenarios || scenarios.length === 0) {
      return new Response(JSON.stringify({ ignored: true, reason: "no active scenarios" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Determine scenario ----
    const phone = remoteJid.replace("@s.whatsapp.net", "");
    let scenarioKey = "organic_inbound"; // default

    // Check if lead came from a broadcast
    const { data: matchedLead } = await supabaseAdmin
      .from("leads_raw")
      .select("id, name")
      .eq("org_id", orgId)
      .or(`phone.ilike.%${phone}%,phone.ilike.%${phone.slice(-8)}%`)
      .maybeSingle();

    let broadcastContext = "";
    let broadcastMessage = "";

    if (matchedLead) {
      const { data: leadBroadcast } = await supabaseAdmin
        .from("broadcast_leads")
        .select("message_sent, sent_at, broadcast:broadcasts(id, name, description, scenario_key)")
        .eq("lead_id", matchedLead.id)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadBroadcast?.message_sent) {
        broadcastMessage = leadBroadcast.message_sent;
        const bcast = leadBroadcast.broadcast as any;
        scenarioKey = bcast?.scenario_key || "broadcast_own_base";
        broadcastContext = `\n\nCONTEXTO DA CAMPANHA: Conversa iniciada pelo disparo "${bcast?.name || ""}". ${bcast?.description ? `Objetivo: ${bcast.description}.` : ""}
O lead está respondendo à mensagem acima. Continue naturalmente. NÃO repita a mensagem já enviada.`;
        console.log(`Broadcast context: scenario_key=${scenarioKey}, campaign="${bcast?.name}"`);
      }
    }

    // Find the scenario
    const scenario = scenarios.find((s: any) => s.scenario_key === scenarioKey)
      || scenarios.find((s: any) => s.scenario_key === "organic_inbound")
      || scenarios[0];

    if (!scenario) {
      return new Response(JSON.stringify({ ignored: true, reason: "scenario not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Using scenario: ${scenario.scenario_key} (${scenario.name})`);

    // ---- Behavior settings (read ALL from user config) ----
    const behavior = scenario.behavior as any || {};
    const maxMessages = behavior.max_messages ?? 15;
    const delaySeconds = behavior.delay_seconds ?? 5;
    const contextWindow = behavior.context_window ?? 20;
    const splitMessages = behavior.split_messages !== false;
    const maxCharsPerBlock = behavior.max_chars_per_block ?? 200;
    const useEmoji = behavior.use_emoji !== false;
    const activeEngagement = behavior.active_engagement !== false;
    const hidePrices = behavior.hide_prices === true;
    const greetingMessage = behavior.greeting_message || "";
    const farewellMessage = behavior.farewell_message || "";
    const outOfHoursMessage = behavior.out_of_hours_message || "";
    const handoffKeywords: string[] = behavior.handoff_keywords || [];

    // ---- Track conversation ----
    const { data: existingConv } = await supabaseAdmin
      .from("conversation_tracker")
      .select("id, customer_msg_count, scenario_key")
      .eq("org_id", orgId)
      .eq("instance_name", instanceName)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    let customerMsgCount = 0;
    let botMsgCount = 0;

    if (existingConv) {
      customerMsgCount = (existingConv.customer_msg_count || 0) + 1;
      botMsgCount = customerMsgCount;
      await supabaseAdmin.rpc("increment_customer_msg_count", { p_conv_id: existingConv.id });
      await supabaseAdmin.from("conversation_tracker").update({
        last_customer_msg_at: new Date().toISOString(),
        push_name: pushName || undefined,
        last_follow_up_step: 0,
        follow_up_paused: false,
        scenario_key: scenarioKey,
      }).eq("id", existingConv.id);
    } else {
      customerMsgCount = 1;
      await supabaseAdmin.from("conversation_tracker").insert({
        org_id: orgId,
        instance_name: instanceName,
        remote_jid: remoteJid,
        push_name: pushName || null,
        last_customer_msg_at: new Date().toISOString(),
        lead_id: matchedLead?.id || null,
        scenario_key: scenarioKey,
      });
    }

    // ---- Max messages limit ----
    if (botMsgCount >= maxMessages) {
      console.log(`Max messages reached (${botMsgCount}/${maxMessages})`);
      return new Response(JSON.stringify({ ignored: true, reason: "max_messages_reached" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Response delay ----
    if (delaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }

    // ---- Fetch company profile ----
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

    // ---- Smart knowledge retrieval ----
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
        } else { score = 1; }
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

    // ---- Handoff keyword check ----
    if (handoffKeywords.length > 0) {
      const lowerMsg = messageText.toLowerCase();
      const triggered = handoffKeywords.some((kw: string) => lowerMsg.includes(kw.toLowerCase()));
      if (triggered) {
        console.log(`Handoff keyword triggered: "${messageText}"`);
        // Don't auto-reply, let human handle
        return new Response(JSON.stringify({ ignored: true, reason: "handoff_keyword_triggered" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ---- Greeting message for first contact ----
    if (customerMsgCount === 1 && greetingMessage) {
      // Will be prepended to AI response below
    }

    // ---- Build system prompt ----
    // The scenario system_prompt is the SINGLE SOURCE OF TRUTH configured by the user
    // We ONLY append technical rules that the user cannot control (format, scheduling commands)
    const behaviorParts: string[] = [];
    behaviorParts.push(`\nCONFIGURAÇÕES TÉCNICAS (aplicadas automaticamente):`);
    behaviorParts.push(`- Máximo de mensagens nesta conversa: ${maxMessages} (após isso, encaminhe para atendente humano)`);
    behaviorParts.push(`- Você já enviou ~${botMsgCount} mensagens nesta conversa`);

    if (splitMessages) {
      behaviorParts.push(`\nFORMATO DE RESPOSTA:`);
      behaviorParts.push(`- Divida sua resposta em blocos de no máximo ${maxCharsPerBlock} caracteres cada`);
      behaviorParts.push(`- Separe cada bloco com ---BLOCO--- (numa linha isolada)`);
      behaviorParts.push(`- Máximo 4 blocos por resposta`);
    } else {
      behaviorParts.push(`\nFORMATO DE RESPOSTA:`);
      behaviorParts.push(`- Responda em uma única mensagem fluida e natural`);
      behaviorParts.push(`- Máximo 600 caracteres por resposta`);
    }

    if (!useEmoji) behaviorParts.push(`- NÃO use emojis na resposta`);
    if (activeEngagement) behaviorParts.push(`- A ÚLTIMA mensagem DEVE terminar com uma PERGUNTA ABERTA ou convite para responder`);
    if (hidePrices) behaviorParts.push(`- NUNCA mencione preços ou valores. Se perguntarem, diga que precisa entender melhor a necessidade primeiro ou encaminhe para atendente`);

    behaviorParts.push(`\nCAPACIDADE DE AGENDAMENTO:`);
    behaviorParts.push(`Quando o lead quiser agendar, pergunte data e horário. Com data e hora, inclua: [AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]`);
    behaviorParts.push(`Para cancelar: [CANCELAR:TELEFONE_DO_LEAD]. NÃO mostre os comandos ao lead.`);
    behaviorParts.push(`\nResponda SEMPRE em português brasileiro.`);

    const behaviorRules = behaviorParts.join("\n");

    const systemPrompt = scenario.system_prompt + "\n" + behaviorRules + broadcastContext + companyContext + knowledgeContext;

    // ---- Build conversation messages ----
    const conversationMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add broadcast message as assistant context
    if (broadcastMessage) {
      conversationMessages.push({ role: "assistant", content: broadcastMessage });
    }

    // Load conversation history
    const { data: historyMsgs } = await supabaseAdmin
      .from("chat_messages")
      .select("from_me, message_text, push_name, timestamp")
      .eq("org_id", orgId)
      .eq("instance_name", instanceName)
      .eq("remote_jid", remoteJid)
      .order("timestamp", { ascending: false })
      .limit(contextWindow);

    if (historyMsgs && historyMsgs.length > 0) {
      const sorted = [...historyMsgs].reverse();
      for (const hm of sorted) {
        if (!hm.from_me && hm.message_text === messageText) continue;
        conversationMessages.push({
          role: hm.from_me ? "assistant" : "user",
          content: hm.from_me ? hm.message_text : `[${hm.push_name || pushName}]: ${hm.message_text}`,
        });
      }
    }

    // Add current message
    conversationMessages.push({ role: "user", content: `[${pushName}]: ${messageText}` });

    // ---- Call AI ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const temperature = Number(scenario.temperature) || 0.7;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: conversationMessages, temperature }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    let reply = aiData.choices?.[0]?.message?.content || "";
    if (!reply) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- Process scheduling commands ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const agendarMatch = reply.match(/\[AGENDAR:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):([^\]]+)\]/);
    const cancelarMatch = reply.match(/\[CANCELAR:([^\]]+)\]/);
    reply = reply.replace(/\[AGENDAR:[^\]]+\]/g, "").replace(/\[CANCELAR:[^\]]+\]/g, "").replace(/\[VERIFICAR:[^\]]+\]/g, "").trim();

    if (agendarMatch) {
      try {
        const aptResponse = await fetch(`${supabaseUrl}/functions/v1/manage-appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            action: "create", org_id: orgId,
            date: agendarMatch[1], time: agendarMatch[2],
            lead_name: agendarMatch[3] || pushName, lead_phone: phone,
          }),
        });
        const aptResult = await aptResponse.json();
        console.log("Appointment result:", JSON.stringify(aptResult));

        if (aptResult.success && matchedLead) {
          try {
            const { data: stages } = await supabaseAdmin.from("crm_stages").select("id, name, stage_order").eq("org_id", orgId).order("stage_order");
            const agendamentoStage = stages?.find((s: any) => s.name.toLowerCase().includes("agendament") || s.name.toLowerCase().includes("reunião") || s.name.toLowerCase().includes("qualificad"));
            const targetStage = agendamentoStage || (stages && stages.length >= 3 ? stages[2] : stages?.[stages.length - 1]);
            if (targetStage) {
              const { data: existingOpp } = await supabaseAdmin.from("opportunities").select("id").eq("org_id", orgId).eq("lead_id", matchedLead.id).maybeSingle();
              if (existingOpp) {
                await supabaseAdmin.from("opportunities").update({ stage_id: targetStage.id, notes: `Agendamento: ${agendarMatch[1]} às ${agendarMatch[2]}` }).eq("id", existingOpp.id);
              } else {
                await supabaseAdmin.from("opportunities").insert({ org_id: orgId, lead_id: matchedLead.id, stage_id: targetStage.id, notes: `Agendamento via IA: ${agendarMatch[1]} às ${agendarMatch[2]}`, automation_status: "completed" });
              }
            }
            await supabaseAdmin.from("conversation_tracker").update({ pipeline_stage_key: "agendamento" }).eq("org_id", orgId).eq("instance_name", instanceName).eq("remote_jid", remoteJid);
          } catch (crmErr) { console.error("CRM update error:", crmErr); }
        }
      } catch (e) { console.error("Scheduling error:", e); }
    }

    if (cancelarMatch) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/manage-appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "cancel", org_id: orgId, lead_phone: cancelarMatch[1] || phone, reason: "Cancelado pelo lead via WhatsApp" }),
        });
      } catch (e) { console.error("Cancel error:", e); }
    }

    // ---- Send reply via Evolution API ----
    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Prepend greeting message on first contact
    let greetingBlock: string | null = null;
    if (customerMsgCount === 1 && greetingMessage) {
      const cp = companyProfile as any;
      greetingBlock = greetingMessage.replace(/\{empresa\}/gi, cp?.company_name || "");
    }

    let finalParts: string[];
    if (splitMessages) {
      const blocks = reply.split(/---BLOCO---/i).map((b: string) => b.trim()).filter((b: string) => b.length > 0);
      finalParts = blocks.length > 1 ? blocks : reply.split(/\n\n+/).map((b: string) => b.trim()).filter((b: string) => b.length > 0);
      if (finalParts.length === 0) finalParts = [reply];
    } else {
      // Single message mode — send as one block
      finalParts = [reply.replace(/---BLOCO---/gi, "\n").trim()];
    }

    // Prepend greeting
    if (greetingBlock) finalParts.unshift(greetingBlock);

    let sendSuccess = false;
    for (let i = 0; i < finalParts.length; i++) {
      if (i > 0) {
        const baseDelay = 1000 + Math.random() * 2000;
        const lengthBonus = Math.min(finalParts[i].length * 10, 1000);
        await new Promise(resolve => setTimeout(resolve, Math.min(baseDelay + lengthBonus, 4000)));
      }

      const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: phone, text: finalParts[i] }),
      });

      if (!sendResponse.ok) {
        console.error("Evolution send error:", sendResponse.status, await sendResponse.text());
      } else {
        sendSuccess = true;
        await saveMessage(orgId!, instanceName, remoteJid, true, finalParts[i], undefined, `bot_${Date.now()}_${i}`);
      }
    }

    if (sendSuccess) {
      await supabaseAdmin.from("conversation_tracker").update({ last_bot_msg_at: new Date().toISOString() }).eq("org_id", orgId).eq("instance_name", instanceName).eq("remote_jid", remoteJid);
    }

    return new Response(JSON.stringify({ success: true, reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-whatsapp-hook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
