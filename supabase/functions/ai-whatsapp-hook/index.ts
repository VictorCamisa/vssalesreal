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

    // Check if chatbot is enabled for this instance — support smart routing
    // Smart agents use instance_name like "INSTANCE__role", so we match both exact and prefixed names
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

    // Determine if smart routing is active
    const smartConfig = aiConfigs.find((c: any) => (c.config as any)?.routing_mode === "smart");
    const aiConfig = smartConfig || aiConfigs[0];
    const isSmartRouting = !!(smartConfig && (smartConfig.config as any)?.routing_mode === "smart");

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

    // Build system prompt from modular config or fallback to legacy prompt
    const configData = aiConfig.config as any;
    const modularCfg = configData?.modular;
    let systemPrompt = "";

    // Smart routing: enrich prompt with conversation history for context detection
    let smartRoutingContext = "";
    if (isSmartRouting) {
      // Fetch recent conversation history for better persona detection
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
      // --- Build prompt from modular sections ---
      const formalityLabels = ["muito informal e descontraído", "informal e amigável", "neutro e equilibrado", "formal e profissional", "muito formal e corporativo"];
      const energyLabels = ["calmo e tranquilo", "sereno", "equilibrado", "animado e positivo", "muito energético e entusiasmado"];
      const formalityIdx = Math.round((modularCfg.tone?.formality || 30) / 25);
      const energyIdx = Math.round((modularCfg.tone?.energy || 60) / 25);
      const emojiMap: Record<string, string> = {
        none: "NÃO use emojis em nenhuma mensagem",
        minimal: "Use emojis com muita moderação (1 a cada 3 mensagens no máximo)",
        moderate: "Use emojis com moderação (máximo 1 por mensagem/bloco)",
        frequent: "Use emojis livremente (2+ por mensagem quando natural)",
      };

      const parts: string[] = [];
      parts.push(`Você é um assistente virtual via WhatsApp para uma empresa.`);
      parts.push(`${aiConfig.system_prompt || "Seja educado, prestativo e profissional."}`);

      // Anti-hallucination rules
      parts.push(`\nREGRAS ANTI-ALUCINAÇÃO (MÁXIMA PRIORIDADE):`);
      parts.push(`- NUNCA invente informações sobre o lead (negócio, Instagram, localização, nome de empresa, etc.)`);
      parts.push(`- Se você NÃO tem dados sobre o lead, NÃO mencione nada específico sobre ele`);
      parts.push(`- Quando o lead manda apenas "oi" ou "olá", responda com uma saudação simples e se apresente`);
      parts.push(`- Use APENAS informações que foram EXPLICITAMENTE fornecidas no contexto abaixo`);
      parts.push(`- É melhor ser genérico do que inventar qualquer dado`);
      // Tone
      parts.push(`\nTOM DE VOZ:`);
      parts.push(`- Seja ${formalityLabels[formalityIdx]} no tom`);
      parts.push(`- Energia: ${energyLabels[energyIdx]}`);
      parts.push(`- ${emojiMap[modularCfg.tone?.emoji_usage || "moderate"]}`);
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

      // Golden rules
      if (modularCfg.golden_rules?.length) {
        parts.push(`\nREGRAS DE OURO:`);
        modularCfg.golden_rules.forEach((r: string, i: number) => { if (r.trim()) parts.push(`${i + 1}. ${r}`); });
      }

      // Objections
      if (modularCfg.objections?.length) {
        parts.push(`\nCONTORNO DE OBJEÇÕES:`);
        modularCfg.objections.forEach((o: any) => {
          if (o.trigger?.trim()) parts.push(`- Se disser "${o.trigger}" → ${o.response}`);
        });
      }

      // CTAs
      if (modularCfg.ctas?.length) {
        parts.push(`\nCTAs PREFERIDOS (use quando apropriado):`);
        modularCfg.ctas.forEach((c: any) => { if (c.label?.trim()) parts.push(`- ${c.label}: "${c.text}"`); });
      }

      // Block config
      const blocks = modularCfg.blocks || { max_blocks: 4, max_chars_per_block: 200, max_emojis_per_block: 1 };
      parts.push(`\nFORMATO DE RESPOSTA (CRÍTICO):`);
      parts.push(`- Divida SEMPRE sua resposta em blocos CURTOS de no máximo ${blocks.max_chars_per_block} caracteres cada`);
      parts.push(`- Separe cada bloco com a marcação ---BLOCO--- (numa linha isolada)`);
      parts.push(`- Máximo ${blocks.max_blocks} blocos por resposta`);
      parts.push(`- Máximo ${blocks.max_emojis_per_block} emoji(s) por bloco`);
      parts.push(`- Cada bloco deve ser uma mensagem independente e natural`);

      // Scheduling capability
      parts.push(`\nCAPACIDADE DE AGENDAMENTO:`);
      parts.push(`Quando o lead quiser agendar, pergunte data e horário. Com data e hora, inclua: [AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]`);
      parts.push(`Para cancelar: [CANCELAR:TELEFONE_DO_LEAD]. Para verificar agenda: [VERIFICAR:YYYY-MM-DD]`);
      parts.push(`Esses comandos são invisíveis ao lead. NÃO mostre os comandos.`);

      parts.push(`\nResponda SEMPRE em português brasileiro.`);

      systemPrompt = parts.join("\n") + companyContext + knowledgeContext + smartRoutingContext;
    } else if (modularCfg?.use_custom_prompt && modularCfg?.custom_base_prompt) {
      // Custom manual prompt
      systemPrompt = modularCfg.custom_base_prompt + companyContext + knowledgeContext + smartRoutingContext;
    } else {
      // Legacy fallback
      systemPrompt = `Você é um assistente virtual via WhatsApp para uma empresa.
${aiConfig.system_prompt || "Seja educado, prestativo e profissional."}

REGRAS ANTI-ALUCINAÇÃO (MÁXIMA PRIORIDADE):
- NUNCA invente informações sobre o lead (negócio, Instagram, localização, nome de empresa, etc.)
- Se você NÃO tem dados sobre o lead, NÃO mencione nada específico sobre ele
- Quando o lead manda apenas "oi" ou "olá", responda com uma saudação simples e se apresente
- Use APENAS informações que foram EXPLICITAMENTE fornecidas no contexto
- É melhor ser genérico do que inventar qualquer dado

CAPACIDADE DE AGENDAMENTO:
Você pode agendar, verificar e cancelar reuniões. Quando o lead quiser agendar:
1. Pergunte data e horário preferido
2. Quando tiver data e hora, inclua no final da sua resposta (invisível ao lead): [AGENDAR:YYYY-MM-DD:HH:MM:NOME_DO_LEAD]
3. Para cancelar: [CANCELAR:TELEFONE_DO_LEAD]
4. Para verificar agenda: [VERIFICAR:YYYY-MM-DD]
Esses comandos serão processados automaticamente. NÃO mostre os comandos ao lead.

FORMATO DE RESPOSTA (CRÍTICO):
- Divida SEMPRE sua resposta em blocos CURTOS de no máximo 2 linhas cada
- Separe cada bloco com a marcação ---BLOCO--- (numa linha isolada)
- Cada bloco deve ser uma mensagem independente e natural
- Máximo 3-4 blocos por resposta

Regras:
- Mensagens CURTAS e naturais (como um humano digitaria)
- Use emojis com moderação (1 por bloco no máximo)
- Se não souber a resposta, diga que vai encaminhar para um atendente humano
- Nunca invente informações
- Responda em português brasileiro${companyContext}${knowledgeContext}${smartRoutingContext}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const baseTemp = aiConfig.temperature ? Number(aiConfig.temperature) : 0.7;
    // Use lower temperature to prevent hallucinations
    const temperature = Math.min(baseTemp, 0.5);

    // Build conversation history: check if this lead was contacted via broadcast
    const conversationMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Check for previous broadcast message sent to this lead
    const phone = remoteJid.replace("@s.whatsapp.net", "");

    // Find matching broadcast lead by phone
    let broadcastContext = "";
    const { data: matchedLead } = await supabaseAdmin
      .from("leads_raw")
      .select("id, name")
      .eq("org_id", orgId)
      .or(`phone.ilike.%${phone}%,phone.ilike.%${phone.slice(-8)}%`)
      .maybeSingle();

    if (matchedLead) {
      const { data: leadBroadcast } = await supabaseAdmin
        .from("broadcast_leads")
        .select("message_sent, sent_at, broadcast:broadcasts(name, description, audience_type)")
        .eq("lead_id", matchedLead.id)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadBroadcast?.message_sent) {
        // Add the broadcast message as assistant context so AI knows what was said
        conversationMessages.push({
          role: "assistant",
          content: leadBroadcast.message_sent,
        });
        const bcast = leadBroadcast.broadcast as any;
        const audienceType = bcast?.audience_type || "b2c";
        console.log(`Broadcast context found: audience_type=${audienceType}, campaign="${bcast?.name}"`);
        
        // CRITICAL: When lead came from a broadcast, COMPLETELY REPLACE the agent's system prompt
        // to prevent B2B agent instructions from overriding the broadcast's audience type
        let audiencePrompt = "";
        if (audienceType === "b2b") {
          audiencePrompt = `Você é um consultor comercial via WhatsApp. Este lead é um PARCEIRO DE NEGÓCIO (B2B - empresa, bar, restaurante, distribuidora).

ABORDAGEM B2B:
- Foque em: ROI, volume, logística de entrega, parceria comercial, reposição, margem de lucro
- Trate como um potencial parceiro de negócio
- Use linguagem profissional e dados concretos
- Ofereça condições comerciais, volumes e prazos`;
        } else {
          audiencePrompt = `Você é um consultor via WhatsApp. Este lead é um CLIENTE FINAL (pessoa física, consumidor).

ABORDAGEM B2C (OBRIGATÓRIA - NUNCA DESVIE):
- Foque EXCLUSIVAMENTE em: eventos pessoais, aniversários, churrascos, festas, happy hours, confraternizações, consumo pessoal
- PROIBIDO: perguntar sobre negócio, estabelecimento, bar, restaurante, empresa, PDV, giro de bebidas, parceiros, setor de eventos
- PROIBIDO: usar termos como "PDV", "parceiros", "reposição", "volume comercial", "ponto de venda"
- Venda o PRODUTO diretamente para CONSUMO PESSOAL e momentos especiais
- Linguagem leve, amigável e focada na experiência pessoal do cliente
- Sugira sabores, quantidades para festas, harmonizações`;
        }

        // Build the replacement system prompt with company context but WITHOUT the agent's B2B instructions
        broadcastContext = `${audiencePrompt}

CONTEXTO DA CAMPANHA: Esta conversa começou a partir de um disparo da campanha "${bcast?.name || ""}". ${bcast?.description ? `Objetivo: ${bcast.description}.` : ""}
O lead está respondendo à mensagem que você enviou acima. Continue a conversa naturalmente.
NÃO repita a mesma mensagem que já foi enviada.

REGRAS ANTI-ALUCINAÇÃO:
- NUNCA invente informações sobre o lead
- Use APENAS informações fornecidas no contexto
- É melhor ser genérico do que inventar qualquer dado

FORMATO DE RESPOSTA:
- Divida sua resposta em blocos CURTOS de no máximo 200 caracteres cada
- Separe cada bloco com ---BLOCO---
- Máximo 4 blocos por resposta
- Use emojis com moderação (1 por bloco no máximo)
- Responda em português brasileiro`;
      }
    }

    // If broadcast context was found, REPLACE the entire system prompt (don't append)
    if (broadcastContext) {
      console.log("REPLACING system prompt with broadcast-specific prompt");
      conversationMessages[0].content = broadcastContext + companyContext + knowledgeContext;
    }

    // Add the current user message
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

    // Process scheduling commands embedded in AI response
    // phone already declared above (line 396)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const agendarMatch = reply.match(/\[AGENDAR:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):([^\]]+)\]/);
    const cancelarMatch = reply.match(/\[CANCELAR:([^\]]+)\]/);
    const verificarMatch = reply.match(/\[VERIFICAR:(\d{4}-\d{2}-\d{2})\]/);

    // Remove commands from visible reply
    reply = reply.replace(/\[AGENDAR:[^\]]+\]/g, "").replace(/\[CANCELAR:[^\]]+\]/g, "").replace(/\[VERIFICAR:[^\]]+\]/g, "").replace(/\[PERFIL:[^\]]+\]/g, "").trim();

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

    // Send reply via Evolution API (global credentials) — in short blocks
    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Split reply into blocks for human-like delivery
    const blocks = reply.split(/---BLOCO---/i).map((b: string) => b.trim()).filter((b: string) => b.length > 0);
    
    // If no blocks marker found, split by double newline or send as single
    const messageParts = blocks.length > 1 ? blocks : 
      reply.split(/\n\n+/).map((b: string) => b.trim()).filter((b: string) => b.length > 0);
    
    // Ensure we have at least one message
    const finalParts = messageParts.length > 0 ? messageParts : [reply];

    // Use modular delay config if available
    const blockCfg = modularCfg?.blocks || { delay_min_ms: 1000, delay_max_ms: 3000 };
    const delayMin = blockCfg.delay_min_ms || 1000;
    const delayMax = blockCfg.delay_max_ms || 3000;

    let sendSuccess = false;
    for (let i = 0; i < finalParts.length; i++) {
      // Add typing delay between messages using configured range
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
      }
    }

    if (sendSuccess) {
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
