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

    // Helper: save message to chat_messages table
    const saveMessage = async (orgId: string, instName: string, jid: string, fromMe: boolean, text: string, pName?: string, msgId?: string) => {
      try {
        if (msgId) {
          await supabaseAdmin.from("chat_messages").upsert({
            org_id: orgId,
            instance_name: instName,
            remote_jid: jid,
            from_me: fromMe,
            message_text: text,
            push_name: pName || null,
            message_id: msgId,
            timestamp: new Date().toISOString(),
          }, { onConflict: "instance_name,message_id", ignoreDuplicates: true });
        } else {
          await supabaseAdmin.from("chat_messages").insert({
            org_id: orgId,
            instance_name: instName,
            remote_jid: jid,
            from_me: fromMe,
            message_text: text,
            push_name: pName || null,
            message_id: null,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) { console.error("saveMessage error:", e); }
    };

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

    // Save incoming customer message to chat_messages
    const incomingMsgId = messageData.key?.id || null;
    await saveMessage(orgId, instanceName, remoteJid, false, messageText, pushName, incomingMsgId);

    // Check if chatbot is enabled for this instance
    const { data: aiConfigs } = await supabaseAdmin
      .from("ai_configs")
      .select("*")
      .eq("org_id", orgId)
      .eq("config_type", "chatbot")
      .eq("enabled", true)
      .or(`instance_name.eq.${instanceName},instance_name.ilike.${instanceName}__%`);

    if (!aiConfigs || aiConfigs.length === 0) {
      console.log(`No active chatbot found for instance "${instanceName}" in org "${orgId}"`);
      return new Response(JSON.stringify({ ignored: true, reason: "chatbot disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`Found ${aiConfigs.length} active chatbot config(s) for instance "${instanceName}"`);

    const smartConfig = aiConfigs.find((c: any) => (c.config as any)?.routing_mode === "smart");
    const aiConfig = smartConfig || aiConfigs[0];
    const isSmartRouting = !!(smartConfig && (smartConfig.config as any)?.routing_mode === "smart");

    // ---- Read behavior settings ----
    const configData = aiConfig.config as any || {};
    const behavior = {
      max_messages_per_conversation: configData.behavior?.max_messages_per_conversation ?? 15,
      response_delay_seconds: configData.behavior?.response_delay_seconds ?? 3,
      client_wait_timeout_minutes: configData.behavior?.client_wait_timeout_minutes ?? 30,
      emoji_usage: configData.behavior?.emoji_usage ?? "moderate",
      context_window: configData.behavior?.context_window ?? 10,
    };

    // Track conversation
    const { data: existingConv } = await supabaseAdmin
      .from("conversation_tracker")
      .select("id, customer_msg_count, detected_audience")
      .eq("org_id", orgId)
      .eq("instance_name", instanceName)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    let customerMsgCount = 0;
    let detectedAudience: string | null = null;
    let botMsgCount = 0;

    if (existingConv) {
      customerMsgCount = (existingConv.customer_msg_count || 0) + 1;
      detectedAudience = (existingConv as any).detected_audience || null;
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
      
      // Estimate bot message count (customer messages ~ bot messages in 1:1 conversation)
      botMsgCount = customerMsgCount;
    } else {
      customerMsgCount = 1;
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

    // ---- Check max messages limit ----
    if (botMsgCount >= behavior.max_messages_per_conversation) {
      console.log(`Max messages reached (${botMsgCount}/${behavior.max_messages_per_conversation}). Stopping auto-reply.`);
      return new Response(JSON.stringify({ ignored: true, reason: "max_messages_reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Apply response delay ----
    if (behavior.response_delay_seconds > 0) {
      const delayMs = behavior.response_delay_seconds * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
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

    const buildCompanyContext = (cp: any, audience: string | null, strict = false): string => {
      const parts: string[] = [];
      if (cp.company_name) parts.push(`Empresa: ${cp.company_name}`);
      if (cp.segment) parts.push(`Segmento: ${cp.segment}`);
      if (cp.description) parts.push(`Sobre: ${cp.description}`);

      const prefix = audience === "b2b" || audience === "b2c" ? audience : null;

      const targetAudience = prefix ? cp[`${prefix}_target_audience`] : cp.target_audience;
      const differentials = prefix ? cp[`${prefix}_differentials`] : cp.differentials;
      const toneOfVoice = prefix ? cp[`${prefix}_tone_of_voice`] : cp.tone_of_voice;
      const salesProcess = prefix ? cp[`${prefix}_sales_process`] : cp.sales_process;
      const products = prefix 
        ? (cp[`${prefix}_products_services`] || [])
        : (cp.products_services || []);
      const faqs = prefix
        ? (cp[`${prefix}_objections_faq`] || [])
        : (cp.objections_faq || []);

      const ta = targetAudience || (!strict ? cp.target_audience : "");
      const df = differentials || (!strict ? cp.differentials : "");
      const tv = toneOfVoice || (!strict ? cp.tone_of_voice : "");
      const sp = salesProcess || (!strict ? cp.sales_process : "");
      const pd = products.length > 0 ? products : (!strict ? (cp.products_services || []) : []);
      const fq = faqs.length > 0 ? faqs : (!strict ? (cp.objections_faq || []) : []);

      if (ta) parts.push(`Público-alvo: ${ta}`);
      if (df) parts.push(`Diferenciais: ${df}`);
      if (tv) parts.push(`Tom de voz: ${tv}`);
      if (sp) parts.push(`Processo: ${sp}`);
      if (pd.length > 0) {
        parts.push("Produtos:\n" + pd.map((p: any) => `- ${p.name}${p.price ? ` (${p.price})` : ""}: ${p.description}`).join("\n"));
      }
      if (fq.length > 0) {
        parts.push("Objeções:\n" + fq.map((f: any) => `Q: ${f.question}\nR: ${f.answer}`).join("\n"));
      }
      if (prefix) parts.push(`\n[Modelo ${prefix.toUpperCase()} EXCLUSIVO — NÃO use informações de outro modelo]`);
      return `\n\n--- EMPRESA ---\n${parts.join("\n")}\n--- FIM ---`;
    };

    let companyContext = "";
    if (companyProfile) {
      companyContext = buildCompanyContext(companyProfile as any, detectedAudience, false);
    }

    // Smart knowledge retrieval
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

    // ---- Build behavior rules string (MUST survive all prompt replacements) ----
    const emojiMap: Record<string, string> = {
      none: "NÃO use emojis em nenhuma mensagem",
      minimal: "Use emojis com muita moderação (1 a cada 3 mensagens no máximo)",
      moderate: "Use emojis com moderação (máximo 1 por mensagem/bloco)",
      frequent: "Use emojis livremente (2+ por mensagem quando natural)",
    };
    const blocksCfg = (configData?.modular?.blocks) || { max_blocks: 4, max_chars_per_block: 200, max_emojis_per_block: 1 };
    const maxBlocks = blocksCfg.max_blocks ?? 4;
    const maxCharsPerBlock = blocksCfg.max_chars_per_block ?? 200;
    const maxEmojisPerBlock = blocksCfg.max_emojis_per_block ?? 1;

    const behaviorRules = `\n\nCONFIGURAÇÕES DE COMPORTAMENTO (OBRIGATÓRIO — NÃO IGNORE):
- ${emojiMap[behavior.emoji_usage] || emojiMap.moderate}
- Máximo de mensagens nesta conversa: ${behavior.max_messages_per_conversation} (após isso, encaminhe para atendente humano)
- Você já enviou ~${botMsgCount} mensagens nesta conversa

FORMATO DE RESPOSTA (CRÍTICO — MÁXIMA PRIORIDADE):
- Divida SEMPRE sua resposta em blocos CURTOS de no máximo ${maxCharsPerBlock} caracteres cada
- Separe cada bloco com a marcação ---BLOCO--- (numa linha isolada)
- Máximo ${maxBlocks} blocos por resposta. NUNCA exceda ${maxBlocks} blocos.
- Máximo ${maxEmojisPerBlock} emoji(s) por bloco
- Cada bloco deve ser uma mensagem independente e natural
- NÃO envie paredes de texto. Mensagens CURTAS como um humano digitaria.`;

    // Build system prompt
    const modularCfg = configData?.modular;
    let systemPrompt = "";

    let smartRoutingContext = "";
    if (isSmartRouting) {
      const { data: convTracker } = await supabaseAdmin
        .from("conversation_tracker")
        .select("customer_msg_count, pipeline_stage_key, push_name, last_customer_msg_at")
        .eq("org_id", orgId)
        .eq("instance_name", instanceName)
        .eq("remote_jid", remoteJid)
        .maybeSingle();

      if (convTracker) {
        const parts: string[] = [];
        parts.push(`\n\nCONTEXTO DA CONVERSA (use para escolher o perfil):`);
        parts.push(`- Mensagens do cliente: ${convTracker.customer_msg_count || 0}`);
        if (convTracker.pipeline_stage_key) parts.push(`- Estágio no pipeline: ${convTracker.pipeline_stage_key}`);
        if (convTracker.customer_msg_count === 0) parts.push(`- PRIMEIRO CONTATO — use perfil SDR/BDR`);
        smartRoutingContext = parts.join("\n");
      }
    }

    if (modularCfg && !modularCfg.use_custom_prompt) {
      const formalityLabels = ["muito informal e descontraído", "informal e amigável", "neutro e equilibrado", "formal e profissional", "muito formal e corporativo"];
      const energyLabels = ["calmo e tranquilo", "sereno", "equilibrado", "animado e positivo", "muito energético e entusiasmado"];
      const formalityIdx = Math.round((modularCfg.tone?.formality || 30) / 25);
      const energyIdx = Math.round((modularCfg.tone?.energy || 60) / 25);

      const parts: string[] = [];
      parts.push(`Você é um assistente virtual via WhatsApp para uma empresa.`);
      parts.push(`${aiConfig.system_prompt || "Seja educado, prestativo e profissional."}`);

      // Anti-hallucination
      parts.push(`\nREGRAS ANTI-ALUCINAÇÃO (MÁXIMA PRIORIDADE):`);
      parts.push(`- NUNCA invente informações sobre o lead`);
      parts.push(`- Se você NÃO tem dados sobre o lead, NÃO mencione nada específico`);
      parts.push(`- Use APENAS informações EXPLICITAMENTE fornecidas no contexto`);
      parts.push(`- É melhor ser genérico do que inventar qualquer dado`);

      // Behavior
      parts.push(behaviorRules);

      // Tone
      parts.push(`\nTOM DE VOZ:`);
      parts.push(`- Seja ${formalityLabels[formalityIdx]} no tom`);
      parts.push(`- Energia: ${energyLabels[energyIdx]}`);
      parts.push(`- ${emojiMap[modularCfg.tone?.emoji_usage || behavior.emoji_usage]}`);
      if (modularCfg.tone?.custom_instructions) parts.push(`- ${modularCfg.tone.custom_instructions}`);

      // B2B/B2C context
      const mode = modularCfg.business_mode || "hybrid";
      if (mode === "b2b") {
        parts.push(`\nCONTEXTO B2B:`);
        parts.push(`- Ciclo de decisão: ${modularCfg.b2b_context?.decision_cycle || "médio"}`);
        parts.push(`- Ticket médio: ${modularCfg.b2b_context?.avg_ticket || "não definido"}`);
        parts.push(`- Personas-alvo: ${modularCfg.b2b_context?.personas || "decisores"}`);
        parts.push(`- Método de qualificação: ${modularCfg.b2b_context?.qualification_method || "BANT"}`);
        parts.push(`- Foque em ROI, dados, cases e resultados mensuráveis`);
      } else if (mode === "b2c") {
        parts.push(`\nCONTEXTO B2C:`);
        parts.push(`- Nível de impulso de compra: ${modularCfg.b2c_context?.impulse_level || "médio"}`);
        parts.push(`- Sensibilidade a preço: ${modularCfg.b2c_context?.price_sensitivity || "média"}`);
        parts.push(`- Gatilhos emocionais: ${modularCfg.b2c_context?.emotional_triggers || "urgência, prova social"}`);
        parts.push(`- Jornada de compra: ${modularCfg.b2c_context?.purchase_journey || "curta"}`);
        parts.push(`- Foque em benefícios pessoais, emoção, experiência e facilidade`);
      } else {
        parts.push(`\nMODO HÍBRIDO B2B/B2C:`);
        parts.push(modularCfg.hybrid_detection_hint || "Detecte automaticamente se o lead é B2B ou B2C pela linguagem e adapte.");
        if (modularCfg.b2b_context?.personas) parts.push(`- Se B2B: personas ${modularCfg.b2b_context.personas}, método ${modularCfg.b2b_context.qualification_method || "BANT"}`);
        if (modularCfg.b2c_context?.emotional_triggers) parts.push(`- Se B2C: use gatilhos ${modularCfg.b2c_context.emotional_triggers}`);
      }

      if (modularCfg.golden_rules?.length) {
        parts.push(`\nREGRAS DE OURO:`);
        modularCfg.golden_rules.forEach((r: string, i: number) => { if (r.trim()) parts.push(`${i + 1}. ${r}`); });
      }

      if (modularCfg.objections?.length) {
        parts.push(`\nCONTORNO DE OBJEÇÕES:`);
        modularCfg.objections.forEach((o: any) => {
          if (o.trigger?.trim()) parts.push(`- Se disser "${o.trigger}" → ${o.response}`);
        });
      }

      if (modularCfg.ctas?.length) {
        parts.push(`\nCTAs PREFERIDOS (use quando apropriado):`);
        modularCfg.ctas.forEach((c: any) => { if (c.label?.trim()) parts.push(`- ${c.label}: "${c.text}"`); });
      }

      // Block formatting is already in behaviorRules, just add scheduling

      parts.push(`\nCAPACIDADE DE AGENDAMENTO:`);
      parts.push(`Quando o lead quiser agendar, pergunte data e horário. Com data e hora, inclua: [AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]`);
      parts.push(`Para cancelar: [CANCELAR:TELEFONE_DO_LEAD]. Para verificar agenda: [VERIFICAR:YYYY-MM-DD]`);
      parts.push(`Esses comandos são invisíveis ao lead. NÃO mostre os comandos.`);

      parts.push(`\nResponda SEMPRE em português brasileiro.`);

      systemPrompt = parts.join("\n") + companyContext + knowledgeContext + smartRoutingContext;
    } else if (modularCfg?.use_custom_prompt && modularCfg?.custom_base_prompt) {
      systemPrompt = modularCfg.custom_base_prompt + behaviorRules + companyContext + knowledgeContext + smartRoutingContext;
    } else {
      systemPrompt = `Você é um assistente virtual via WhatsApp para uma empresa.
${aiConfig.system_prompt || "Seja educado, prestativo e profissional."}

REGRAS ANTI-ALUCINAÇÃO (MÁXIMA PRIORIDADE):
- NUNCA invente informações sobre o lead
- Se você NÃO tem dados sobre o lead, NÃO mencione nada específico
- Use APENAS informações EXPLICITAMENTE fornecidas no contexto
- É melhor ser genérico do que inventar qualquer dado
${behaviorRules}

CAPACIDADE DE AGENDAMENTO:
Quando o lead quiser agendar:
1. Pergunte data e horário preferido
2. Quando tiver data e hora, inclua: [AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]
3. Para cancelar: [CANCELAR:TELEFONE_DO_LEAD]
4. Para verificar agenda: [VERIFICAR:YYYY-MM-DD]
Esses comandos são processados automaticamente. NÃO mostre os comandos ao lead.

Regras:
- Mensagens CURTAS e naturais (como um humano digitaria)
- Se não souber a resposta, diga que vai encaminhar para um atendente humano
- Nunca invente informações
- Responda em português brasileiro${companyContext}${knowledgeContext}${smartRoutingContext}`;
    }

    // --- Inject model-specific custom prompts from config ---
    const cfgPrompts = configData || {};
    if (detectedAudience === "b2b" && cfgPrompts.prompt_b2b) {
      const strictCompanyCtx = companyProfile ? buildCompanyContext(companyProfile as any, "b2b", true) : "";
      systemPrompt = cfgPrompts.prompt_b2b + behaviorRules + strictCompanyCtx + knowledgeContext;
      console.log("REPLACED system prompt with strict B2B custom prompt");
    } else if (detectedAudience === "b2c" && cfgPrompts.prompt_b2c_organic) {
      const strictCompanyCtx = companyProfile ? buildCompanyContext(companyProfile as any, "b2c", true) : "";
      systemPrompt = cfgPrompts.prompt_b2c_organic + behaviorRules + strictCompanyCtx + knowledgeContext;
      console.log("REPLACED system prompt with strict B2C organic prompt");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const baseTemp = aiConfig.temperature ? Number(aiConfig.temperature) : 0.7;
    const temperature = Math.min(baseTemp, 0.5);

    const conversationMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    const phone = remoteJid.replace("@s.whatsapp.net", "");

    const { data: matchedLead } = await supabaseAdmin
      .from("leads_raw")
      .select("id, name")
      .eq("org_id", orgId)
      .or(`phone.ilike.%${phone}%,phone.ilike.%${phone.slice(-8)}%`)
      .maybeSingle();

    if (matchedLead) {
      const { data: leadBroadcast } = await supabaseAdmin
        .from("broadcast_leads")
        .select("message_sent, sent_at, broadcast:broadcasts(id, name, description, audience_type, ai_config_id)")
        .eq("lead_id", matchedLead.id)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadBroadcast?.message_sent) {
        conversationMessages.push({
          role: "assistant",
          content: leadBroadcast.message_sent,
        });
        const bcast = leadBroadcast.broadcast as any;
        const broadcastAudienceType = bcast?.audience_type || "b2c";
        console.log(`Broadcast context found: audience_type=${broadcastAudienceType}, campaign="${bcast?.name}"`);

        if (!detectedAudience) {
          detectedAudience = broadcastAudienceType;
          await supabaseAdmin
            .from("conversation_tracker")
            .update({ detected_audience: broadcastAudienceType })
            .eq("org_id", orgId)
            .eq("instance_name", instanceName)
            .eq("remote_jid", remoteJid);
          console.log(`Saved detected_audience=${broadcastAudienceType} from broadcast`);
        }

        const strictBcastCtx = companyProfile ? buildCompanyContext(companyProfile as any, broadcastAudienceType, true) : "";

        const b2cNegativeRules = `
PROIBIÇÕES ABSOLUTAS (B2C - consumidor final):
- NÃO pergunte sobre negócio, empresa, estabelecimento
- NÃO use termos como: PDV, parceria comercial, reposição, volume comercial
- FOQUE em: consumo pessoal, festas, churrascos, eventos`;
        const b2bNegativeRules = `
PROIBIÇÕES ABSOLUTAS (B2B - empresa/negócio):
- NÃO mencione consumo pessoal, festa, churrasco
- FOQUE em: ROI, parceria, volume, cases, resultados`;

        const negativeRules = broadcastAudienceType === "b2c" ? b2cNegativeRules : b2bNegativeRules;
        const campaignCtx = `\n\nCONTEXTO DA CAMPANHA: Conversa iniciada pelo disparo "${bcast.name || ""}". ${bcast.description ? `Objetivo: ${bcast.description}.` : ""}
O lead está respondendo à mensagem acima. Continue naturalmente. NÃO repita a mensagem já enviada.${negativeRules}`;

        if (broadcastAudienceType === "b2c" && cfgPrompts.prompt_b2c_broadcast) {
          conversationMessages[0].content = cfgPrompts.prompt_b2c_broadcast + behaviorRules + campaignCtx + strictBcastCtx + knowledgeContext;
          console.log("REPLACED with strict B2C broadcast prompt");
        } else if (broadcastAudienceType === "b2b" && cfgPrompts.prompt_b2b) {
          conversationMessages[0].content = cfgPrompts.prompt_b2b + behaviorRules + campaignCtx + strictBcastCtx + knowledgeContext;
          console.log("REPLACED with strict B2B broadcast prompt");
        } else if (bcast?.ai_config_id) {
          const { data: broadcastAiConfig } = await supabaseAdmin
            .from("ai_configs")
            .select("system_prompt")
            .eq("id", bcast.ai_config_id)
            .maybeSingle();

          if (broadcastAiConfig?.system_prompt) {
            conversationMessages[0].content = broadcastAiConfig.system_prompt + behaviorRules + campaignCtx + strictBcastCtx + knowledgeContext;
          } else {
            conversationMessages[0].content = conversationMessages[0].content.replace(companyContext, "") + campaignCtx + strictBcastCtx;
          }
        } else {
          conversationMessages[0].content = conversationMessages[0].content.replace(companyContext, "") + campaignCtx + strictBcastCtx;
        }
      }
    }

    // --- AUDIENCE QUALIFICATION for organic leads ---
    const isFromBroadcast = !!(matchedLead && (await supabaseAdmin
      .from("broadcast_leads")
      .select("id")
      .eq("lead_id", matchedLead.id)
      .eq("status", "sent")
      .limit(1)
      .maybeSingle())?.data);

    const businessMode = modularCfg?.business_mode || "hybrid";

    if (!isFromBroadcast) {
      if (businessMode === "b2b" || businessMode === "b2c") {
        if (!detectedAudience) {
          detectedAudience = businessMode;
          if (existingConv) {
            await supabaseAdmin
              .from("conversation_tracker")
              .update({ detected_audience: businessMode })
              .eq("id", existingConv.id);
          }
        }
      } else if (businessMode === "hybrid" && !detectedAudience) {
        const qualificationQuestion = modularCfg?.hybrid_qualification_question || 
          "Você está buscando para consumo pessoal ou para o seu estabelecimento/empresa?";

        if (customerMsgCount <= 1) {
          conversationMessages[0].content += `\n\nINSTRUÇÃO OBRIGATÓRIA PARA PRIMEIRO CONTATO:
Após cumprimentar o lead, você DEVE fazer esta pergunta de qualificação de forma natural:
"${qualificationQuestion}"
NÃO pule esta pergunta.`;
        } else if (customerMsgCount === 2) {
          const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `Classify the user's response as either "b2b" or "b2c". Respond with ONLY "b2b" or "b2c".
B2B indicators: company, business, store, restaurant, bar, reseller, wholesale, CNPJ, commercial.
B2C indicators: personal, party, barbecue, birthday, event, home, friends, family.
If unclear, respond "b2c".` },
                { role: "user", content: messageText }
              ],
              temperature: 0,
              max_tokens: 5,
            }),
          });

          let audience = "b2c";
          if (classifyResponse.ok) {
            const classifyData = await classifyResponse.json();
            const answer = (classifyData.choices?.[0]?.message?.content || "").trim().toLowerCase();
            if (answer.includes("b2b")) audience = "b2b";
          }
          
          detectedAudience = audience;
          await supabaseAdmin
            .from("conversation_tracker")
            .update({ detected_audience: audience })
            .eq("org_id", orgId)
            .eq("instance_name", instanceName)
            .eq("remote_jid", remoteJid);
          console.log(`Hybrid mode: AI classified audience as ${audience}`);
        }
      }
    }

    // Inject audience context
    if (detectedAudience && !isFromBroadcast) {
      let audienceOverride = "";
      if (detectedAudience === "b2b") {
        audienceOverride = `\n\nCONTEXTO DE AUDIÊNCIA (DETECTADO):
Este lead é um PARCEIRO DE NEGÓCIO (B2B). Foque em ROI, volume, parceria.`;
      } else {
        audienceOverride = `\n\nCONTEXTO DE AUDIÊNCIA (DETECTADO):
Este lead é um CONSUMIDOR FINAL (B2C). Foque em experiência, eventos, praticidade.
PROIBIDO usar termos B2B: "PDV", "parceiros", "reposição".`;
      }
      conversationMessages[0].content += audienceOverride;
    }

    // Ensure scheduling instructions
    const schedulingInstructions = `\n\nCAPACIDADE DE AGENDAMENTO (SEMPRE ATIVO):
Quando o lead quiser agendar, pergunte data e horário. Com data e hora confirmados, inclua:
[AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]
Para cancelar: [CANCELAR:TELEFONE_DO_LEAD]. Para verificar agenda: [VERIFICAR:YYYY-MM-DD]
NÃO mostre os comandos ao lead.`;

    if (!conversationMessages[0].content.includes("[AGENDAR:")) {
      conversationMessages[0].content += schedulingInstructions;
    }

    // Add user message
    conversationMessages.push({
      role: "user",
      content: `[${pushName}]: ${messageText}`,
    });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: conversationMessages,
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

    // Process scheduling commands
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const agendarMatch = reply.match(/\[AGENDAR:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):([^\]]+)\]/);
    const cancelarMatch = reply.match(/\[CANCELAR:([^\]]+)\]/);

    reply = reply.replace(/\[AGENDAR:[^\]]+\]/g, "").replace(/\[CANCELAR:[^\]]+\]/g, "").replace(/\[VERIFICAR:[^\]]+\]/g, "").replace(/\[PERFIL:[^\]]+\]/g, "").trim();

    if (agendarMatch) {
      try {
        const aptResponse = await fetch(`${supabaseUrl}/functions/v1/manage-appointments`, {
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
        const aptResult = await aptResponse.json();
        console.log("Appointment result:", JSON.stringify(aptResult));

        if (aptResult.success) {
          try {
            const { data: crmLead } = await supabaseAdmin
              .from("leads_raw")
              .select("id")
              .eq("org_id", orgId)
              .or(`phone.ilike.%${phone}%,phone.ilike.%${phone.slice(-8)}%`)
              .maybeSingle();

            if (crmLead) {
              const { data: stages } = await supabaseAdmin
                .from("crm_stages")
                .select("id, name, stage_order")
                .eq("org_id", orgId)
                .order("stage_order");

              const agendamentoStage = stages?.find((s: any) =>
                s.name.toLowerCase().includes("agendament") ||
                s.name.toLowerCase().includes("reunião") ||
                s.name.toLowerCase().includes("reuniao") ||
                s.name.toLowerCase().includes("qualificad")
              );
              const targetStage = agendamentoStage || (stages && stages.length >= 3 ? stages[2] : stages?.[stages.length - 1]);

              if (targetStage) {
                const { data: existingOpp } = await supabaseAdmin
                  .from("opportunities")
                  .select("id")
                  .eq("org_id", orgId)
                  .eq("lead_id", crmLead.id)
                  .maybeSingle();

                if (existingOpp) {
                  await supabaseAdmin.from("opportunities").update({
                    stage_id: targetStage.id,
                    notes: `Agendamento automático: ${agendarMatch[1]} às ${agendarMatch[2]}`,
                    updated_at: new Date().toISOString(),
                  }).eq("id", existingOpp.id);
                } else {
                  await supabaseAdmin.from("opportunities").insert({
                    org_id: orgId,
                    lead_id: crmLead.id,
                    stage_id: targetStage.id,
                    notes: `Agendamento automático via IA: ${agendarMatch[1]} às ${agendarMatch[2]}`,
                    automation_status: "completed",
                  });
                }
              }

              await supabaseAdmin
                .from("conversation_tracker")
                .update({ pipeline_stage_key: "agendamento" })
                .eq("org_id", orgId)
                .eq("instance_name", instanceName)
                .eq("remote_jid", remoteJid);
            }
          } catch (crmErr) {
            console.error("CRM/Pipeline update error:", crmErr);
          }
        }
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

    // Send reply via Evolution API in blocks
    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    const blocks = reply.split(/---BLOCO---/i).map((b: string) => b.trim()).filter((b: string) => b.length > 0);
    const messageParts = blocks.length > 1 ? blocks : 
      reply.split(/\n\n+/).map((b: string) => b.trim()).filter((b: string) => b.length > 0);
    const finalParts = messageParts.length > 0 ? messageParts : [reply];

    const blockCfg = modularCfg?.blocks || { delay_min_ms: 1000, delay_max_ms: 3000 };
    const delayMin = blockCfg.delay_min_ms || 1000;
    const delayMax = blockCfg.delay_max_ms || 3000;

    let sendSuccess = false;
    for (let i = 0; i < finalParts.length; i++) {
      if (i > 0) {
        const baseDelay = delayMin + Math.random() * (delayMax - delayMin);
        const lengthBonus = Math.min(finalParts[i].length * 10, 1000);
        const delayMs = Math.min(baseDelay + lengthBonus, delayMax + 1000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: phone,
          text: finalParts[i],
        }),
      });

      if (!sendResponse.ok) {
        console.error("Evolution send error:", sendResponse.status, await sendResponse.text());
      } else {
        sendSuccess = true;
        // Save outgoing bot message
        await saveMessage(orgId!, instanceName, remoteJid, true, finalParts[i], undefined, `bot_${Date.now()}_${i}`);
      }
    }

    if (sendSuccess) {
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
