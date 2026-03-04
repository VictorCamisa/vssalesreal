import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { broadcast_id, org_id } = body;

    if (!broadcast_id || !org_id) return json({ error: "broadcast_id and org_id are required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get broadcast details
    const { data: broadcast, error: bErr } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("id", broadcast_id)
      .eq("org_id", org_id)
      .single();

    if (bErr || !broadcast) return json({ error: "Broadcast not found" }, 404);
    if (broadcast.status !== "running") return json({ error: "Broadcast is not in running status" }, 400);

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return json({ error: "Evolution API not configured" }, 500);
    }

    // Helper: check if instance is online
    const isInstanceOnline = async (name: string): Promise<boolean> => {
      try {
        const stResp = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${name}`, {
          headers: { apikey: EVOLUTION_API_KEY },
        });
        if (stResp.ok) {
          const stData = await stResp.json();
          return (stData.instance?.state || stData.state) === "open";
        }
        await stResp.text();
      } catch { /* ignore */ }
      return false;
    };

    // Helper: find any online instance for the org
    const findOnlineInstance = async (): Promise<string | null> => {
      const { data: evoInteg } = await supabase
        .from("integrations")
        .select("config")
        .eq("org_id", org_id)
        .eq("service_name", "evolution")
        .maybeSingle();
      if (!evoInteg?.config) return null;
      const config = evoInteg.config as any;
      const instancesByUser = config.instances_by_user || {};
      for (const uid of Object.keys(instancesByUser)) {
        for (const inst of (instancesByUser[uid] as string[]) || []) {
          if (await isInstanceOnline(inst)) return inst;
        }
      }
      return null;
    };

    // Get instance to use — always verify it's online
    let instanceName = broadcast.instance_name;
    if (instanceName) {
      const online = await isInstanceOnline(instanceName);
      if (!online) {
        console.log(`Configured instance "${instanceName}" is offline, searching for online instance...`);
        instanceName = await findOnlineInstance();
      }
    } else {
      instanceName = await findOnlineInstance();
    }

    if (!instanceName) {
      await supabase.from("broadcasts").update({ status: "paused" }).eq("id", broadcast_id);
      return json({ error: "Nenhuma instância WhatsApp online encontrada. Disparo pausado." }, 400);
    }
    console.log(`Using instance: ${instanceName}`);

    // Load scenario prompt from ai_scenarios (replaces ai_configs)
    const scenarioKey = (broadcast as any).scenario_key || "broadcast_own_base";
    let scenarioPrompt = "";
    let maxBlocks = 2;
    let maxCharsPerBlock = 200;
    let useEmoji = true;
    let scenarioTemperature = 0.4;

    if (broadcast.ai_enabled) {
      const { data: scenario } = await supabase
        .from("ai_scenarios")
        .select("system_prompt, behavior, temperature")
        .eq("org_id", org_id)
        .eq("scenario_key", scenarioKey)
        .maybeSingle();

      if (scenario?.system_prompt) {
        scenarioPrompt = scenario.system_prompt;
      }
      if (scenario) {
        const beh = (scenario.behavior || {}) as any;
        maxBlocks = Number(beh.max_blocks) || 2;
        maxCharsPerBlock = Number(beh.max_chars_per_block) || 200;
        useEmoji = beh.use_emoji !== false;
        scenarioTemperature = Math.min(Number(scenario.temperature) || 0.7, 0.4);
      }
    }

    // Get company profile for context
    let companyContext = "";
    if (broadcast.ai_enabled) {
      const { data: company } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("org_id", org_id)
        .maybeSingle();

      if (company) {
        const cp = company as any;
        companyContext = [
          cp.company_name ? `EMPRESA: ${cp.company_name}` : "",
          cp.segment ? `SEGMENTO: ${cp.segment}` : "",
          cp.description ? `DESCRIÇÃO: ${cp.description}` : "",
          cp.target_audience ? `PÚBLICO-ALVO: ${cp.target_audience}` : "",
          cp.tone_of_voice ? `TOM DE VOZ: ${cp.tone_of_voice}` : "",
          cp.differentials ? `DIFERENCIAIS: ${cp.differentials}` : "",
          cp.products_services && (cp.products_services as any[]).length > 0 ? `PRODUTOS/SERVIÇOS: ${JSON.stringify(cp.products_services)}` : "",
        ].filter(Boolean).join("\n");
      }
    }

    // Load knowledge base for the org
    let knowledgeContext = "";
    if (broadcast.ai_enabled) {
      const { data: docs } = await supabase
        .from("ai_knowledge_docs")
        .select("title, content, summary")
        .eq("org_id", org_id)
        .limit(10);
      if (docs && docs.length > 0) {
        knowledgeContext = "\n--- BASE DE CONHECIMENTO (ÚNICA FONTE DE VERDADE) ---\n" +
          docs.map((d: any) => `[${d.title}]: ${d.content || d.summary || ""}`).join("\n") +
          "\n--- FIM DA BASE ---";
      }
    }

    // Build final system prompt for AI generation with anti-hallucination
    const antiHallucinationRule = `=== REGRA NÚMERO 1 (INVIOLÁVEL) ===
- NUNCA invente produtos, serviços ou processos. Se não está escrito abaixo, NÃO EXISTE.
- Se o dado não está na base de conhecimento, NÃO mencione.
- Suas respostas devem ser CURTAS e baseadas EXCLUSIVAMENTE nos dados fornecidos.
${!useEmoji ? "- NUNCA use emojis. ZERO emojis." : ""}
=== FIM DA REGRA ===\n`;

    const fullSystemPrompt = [
      antiHallucinationRule,
      scenarioPrompt,
      companyContext ? `\n--- CONTEXTO DA EMPRESA ---\n${companyContext}` : "",
      knowledgeContext,
      `\nREGRAS DE FORMATO:
- Divida a mensagem em EXATAMENTE ${maxBlocks} blocos curtos (máximo ${maxCharsPerBlock} caracteres cada).
- Separe cada bloco com ---BLOCO--- numa linha isolada.
- NUNCA invente informações. Use APENAS dados fornecidos acima.
- Escreva de forma NATURAL para WhatsApp.
- NÃO coloque a resposta entre aspas.`,
    ].filter(Boolean).join("\n");

    // Get pending broadcast leads
    const { data: bLeads } = await supabase
      .from("broadcast_leads")
      .select("id, lead_id, lead:leads_raw(name, phone, enrichment_data)")
      .eq("broadcast_id", broadcast_id)
      .eq("status", "pending")
      .limit(50);

    if (!bLeads || bLeads.length === 0) {
      await supabase.from("broadcasts").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", broadcast_id);
      return json({ success: true, message: "All messages sent. Broadcast completed.", sent: 0 });
    }

    // Helper: send message in blocks with human-like delays
    const sendInBlocks = async (phone: string, fullMessage: string): Promise<boolean> => {
      let blocks = fullMessage.split(/---BLOCO---/i).map(b => b.trim()).filter(b => b.length > 0);
      if (blocks.length <= 1) {
        blocks = fullMessage.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
      }
      if (blocks.length === 0) blocks = [fullMessage];

      // HARD CAP: respect max_blocks from scenario
      blocks = blocks.slice(0, maxBlocks);

      // HARD CAP: truncate each block
      blocks = blocks.map(block => {
        if (block.length > maxCharsPerBlock) {
          const cut = block.substring(0, maxCharsPerBlock);
          const lastSpace = cut.lastIndexOf(" ");
          return lastSpace > maxCharsPerBlock * 0.7 ? cut.substring(0, lastSpace) : cut;
        }
        return block;
      });

      let success = false;
      for (let i = 0; i < blocks.length; i++) {
        if (i > 0) {
          const baseDelay = 1000 + Math.random() * 2000;
          const lengthBonus = Math.min(blocks[i].length * 10, 1000);
          await new Promise(resolve => setTimeout(resolve, baseDelay + lengthBonus));
        }

        const sendResp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify({ number: phone, text: blocks[i] }),
        });

        if (sendResp.ok) {
          await sendResp.json();
          success = true;
        } else {
          console.error("Block send error:", sendResp.status, await sendResp.text());
        }
      }
      return success;
    };

    let sentCount = 0;
    let failCount = 0;
    const delayMs = (broadcast.delay_between_messages || 10) * 1000;

    for (const bl of bLeads) {
      const lead = (bl as any).lead;
      if (!lead?.phone) {
        await supabase.from("broadcast_leads").update({
          status: "failed", error_message: "Lead sem telefone",
        }).eq("id", bl.id);
        failCount++;
        continue;
      }

      // Check if broadcast was paused/cancelled during execution
      if (sentCount > 0 && sentCount % 10 === 0) {
        const { data: freshB } = await supabase.from("broadcasts").select("status").eq("id", broadcast_id).single();
        if (freshB && freshB.status !== "running") {
          console.log("Broadcast paused/cancelled during execution");
          break;
        }
      }

      // Generate or use template message
      let messageText = broadcast.message_template || "";

      // Replace variables
      if (messageText) {
        messageText = messageText
          .replace(/\{nome\}/gi, lead.name?.split(" ")[0] || "")
          .replace(/\{nome_completo\}/gi, lead.name || "")
          .replace(/\{telefone\}/gi, lead.phone || "");
      }

      // If AI is enabled and no template, generate with AI using scenario prompt
      if (broadcast.ai_enabled && !messageText && LOVABLE_API_KEY && fullSystemPrompt) {
        try {
          const leadFirstName = lead.name?.split(" ")[0] || "";
          const leadContext = leadFirstName ? `Lead: ${leadFirstName}` : "Lead sem nome identificado";

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: fullSystemPrompt },
                { role: "user", content: `Crie UMA mensagem de primeiro contato para: ${leadContext}. ${broadcast.description ? `Contexto da campanha: ${broadcast.description}` : ""}. Use EXATAMENTE ${maxBlocks} blocos. Retorne APENAS os blocos separados por ---BLOCO---, sem aspas.` },
              ],
              temperature: scenarioTemperature,
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            messageText = (aiData.choices?.[0]?.message?.content || "").trim();
            // Remove wrapping quotes
            messageText = messageText.replace(/^[""](.*)[""]$/s, "$1").trim();
            // Strip emojis if disabled
            if (!useEmoji) {
              messageText = messageText.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "").trim();
            }
            // Replace name placeholders
            if (leadFirstName) {
              messageText = messageText.replace(/\[Nome\]/gi, leadFirstName);
            } else {
              messageText = messageText.replace(/\[Nome\]\s*/gi, "");
            }
          } else {
            await aiResp.text();
          }
        } catch (e) {
          console.error("AI message generation error:", e);
        }
      }

      if (!messageText) {
        await supabase.from("broadcast_leads").update({
          status: "failed", error_message: "Sem mensagem para enviar",
        }).eq("id", bl.id);
        failCount++;
        continue;
      }

      // Send via Evolution API — in blocks with human-like delays
      const cleanPhone = lead.phone.replace(/\D/g, "");
      try {
        const success = await sendInBlocks(cleanPhone, messageText);

        if (success) {
          const storedMsg = messageText.replace(/---BLOCO---/gi, "\n").trim();
          const sentAt = new Date().toISOString();
          await supabase.from("broadcast_leads").update({
            status: "sent",
            sent_at: sentAt,
            message_sent: storedMsg,
          }).eq("id", bl.id);

          // Save broadcast message to chat_messages so the webhook has full history
          const remoteJidMsg = `${cleanPhone}@s.whatsapp.net`;
          try {
            await supabase.from("chat_messages").insert({
              org_id: org_id,
              instance_name: instanceName!,
              remote_jid: remoteJidMsg,
              from_me: true,
              message_text: storedMsg,
              push_name: null,
              message_id: `broadcast_${broadcast_id}_${bl.id}`,
              timestamp: sentAt,
            });
          } catch (e) { console.error("Save broadcast chat_message error:", e); }

          // Create/update conversation_tracker with scenario_key
          const remoteJid = `${cleanPhone}@s.whatsapp.net`;
          const { data: existingConv } = await supabase
            .from("conversation_tracker")
            .select("id")
            .eq("org_id", org_id)
            .eq("instance_name", instanceName!)
            .eq("remote_jid", remoteJid)
            .maybeSingle();

          if (!existingConv) {
            await supabase.from("conversation_tracker").insert({
              org_id: org_id,
              instance_name: instanceName!,
              remote_jid: remoteJid,
              push_name: lead.name || null,
              last_bot_msg_at: new Date().toISOString(),
              last_customer_msg_at: new Date().toISOString(),
              lead_id: bl.lead_id,
              scenario_key: scenarioKey,
            });
          } else {
            await supabase.from("conversation_tracker").update({
              last_bot_msg_at: new Date().toISOString(),
              lead_id: bl.lead_id,
              scenario_key: scenarioKey,
            }).eq("id", existingConv.id);
          }

          sentCount++;
        } else {
          await supabase.from("broadcast_leads").update({
            status: "failed", error_message: "API error: all blocks failed",
          }).eq("id", bl.id);
          failCount++;
        }
      } catch (e) {
        await supabase.from("broadcast_leads").update({
          status: "failed",
          error_message: e instanceof Error ? e.message : "Unknown error",
        }).eq("id", bl.id);
        failCount++;
      }

      // Delay between leads
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Update broadcast counters
    const { data: stats } = await supabase
      .from("broadcast_leads")
      .select("status")
      .eq("broadcast_id", broadcast_id);

    const counts = {
      sent_count: stats?.filter(s => s.status === "sent").length || 0,
      failed_count: stats?.filter(s => s.status === "failed").length || 0,
      delivered_count: stats?.filter(s => s.status === "delivered").length || 0,
      read_count: stats?.filter(s => s.status === "read").length || 0,
      replied_count: stats?.filter(s => s.status === "replied").length || 0,
    };

    const pending = stats?.filter(s => s.status === "pending").length || 0;
    if (pending === 0) {
      await supabase.from("broadcasts").update({
        ...counts,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", broadcast_id);
    } else {
      await supabase.from("broadcasts").update(counts).eq("id", broadcast_id);
    }

    // Auto-continue if there are remaining leads
    if (pending > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/execute-broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({ broadcast_id, org_id }),
      }).catch((err) => console.error("Auto-continue error:", err));
    }

    return json({
      success: true,
      sent: sentCount,
      failed: failCount,
      remaining: pending,
    });
  } catch (e) {
    console.error("execute-broadcast error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
