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

    // Get company profile for AI context — STRICT model isolation
    let companyContext = "";
    // Use audience_type from broadcast (set by user in wizard)
    let businessMode = (broadcast as any).audience_type || "b2c";
    let customModelPrompt = "";
    if (broadcast.ai_enabled) {
      const { data: company } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("org_id", org_id)
        .maybeSingle();
      
      if (company) {
        const cp = company as any;
        const prefix = businessMode === "b2b" || businessMode === "b2c" ? businessMode : null;
        // STRICT: use ONLY model-specific fields, no fallback to general
        const targetAudience = prefix ? (cp[`${prefix}_target_audience`] || "") : (cp.target_audience || "");
        const toneOfVoice = prefix ? (cp[`${prefix}_tone_of_voice`] || "") : (cp.tone_of_voice || "");
        const differentials = prefix ? (cp[`${prefix}_differentials`] || "") : (cp.differentials || "");
        const products = prefix ? (cp[`${prefix}_products_services`] || []) : (cp.products_services || []);

        companyContext = `
EMPRESA: ${cp.company_name || ""}
SEGMENTO: ${cp.segment || ""}
DESCRIÇÃO: ${cp.description || ""}
PÚBLICO-ALVO: ${targetAudience}
TOM DE VOZ: ${toneOfVoice}
DIFERENCIAIS: ${differentials}
PRODUTOS/SERVIÇOS: ${products.length > 0 ? JSON.stringify(products) : ""}
[Modelo ${(prefix || "geral").toUpperCase()} EXCLUSIVO — NÃO use informações de outro modelo]`.trim();
      }

      // Get AI agent system prompt + modular config if configured
      if (broadcast.ai_config_id) {
        const { data: aiConfig } = await supabase
          .from("ai_configs")
          .select("system_prompt, config")
          .eq("id", broadcast.ai_config_id)
          .maybeSingle();
        if (aiConfig?.system_prompt) {
          companyContext += `\n\nINSTRUÇÕES DO AGENTE:\n${aiConfig.system_prompt.substring(0, 500)}`;
        }
        // Check modular config for explicit business mode override
        const modCfg = aiConfig?.config as any;
        if (modCfg?.modular?.business_mode) {
          businessMode = modCfg.modular.business_mode;
        }
        // Use model-specific custom prompt if configured
        if (businessMode === "b2b" && modCfg?.prompt_b2b) {
          customModelPrompt = modCfg.prompt_b2b;
        } else if (businessMode === "b2c" && modCfg?.prompt_b2c_broadcast) {
          customModelPrompt = modCfg.prompt_b2c_broadcast;
        }
      }
    }

    // Build audience-specific instruction
    let audienceInstruction = "";
    if (businessMode === "b2b") {
      audienceInstruction = `TIPO DE LEAD: Este é um lead B2B (empresa/estabelecimento). Foque EXCLUSIVAMENTE em: ROI, volume, logística, parceria comercial, reposição. Trate como um potencial parceiro de negócio. PROIBIDO usar termos B2C como consumo pessoal, festa, churrasco, aniversário.`;
    } else {
      audienceInstruction = `TIPO DE LEAD: Este é um CLIENTE FINAL (consumidor/pessoa física). Foque EXCLUSIVAMENTE em: eventos, aniversários, churrascos, festas, happy hours, consumo pessoal, experiência, sabor, praticidade. PROIBIDO falar como se fosse vender para restaurante/bar/empresa. PROIBIDO usar termos B2B como PDV, parceria comercial, reposição, volume comercial, CNPJ. Venda o PRODUTO diretamente para CONSUMO PESSOAL.`;
    }
    // Prepend custom model prompt if available
    if (customModelPrompt) {
      audienceInstruction = customModelPrompt + "\n\n" + audienceInstruction;
    }

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
      // Split by ---BLOCO--- marker first
      let blocks = fullMessage.split(/---BLOCO---/i).map(b => b.trim()).filter(b => b.length > 0);
      
      // If no blocks, split by double newlines
      if (blocks.length <= 1) {
        blocks = fullMessage.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
      }
      
      // Ensure at least one block
      if (blocks.length === 0) blocks = [fullMessage];
      
      let success = false;
      for (let i = 0; i < blocks.length; i++) {
        // Human-like delay between blocks (1-3 seconds + length bonus)
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
          body: JSON.stringify({
            number: phone,
            text: blocks[i],
          }),
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
          status: "failed",
          error_message: "Lead sem telefone",
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

      // If AI is enabled and no template, generate with AI
      if (broadcast.ai_enabled && !messageText && LOVABLE_API_KEY) {
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
                { role: "system", content: `Você é um SDR expert que trabalha na empresa descrita abaixo.

${audienceInstruction}

REGRAS OBRIGATÓRIAS:
- Use APENAS informações REAIS da empresa abaixo. NUNCA invente nomes de empresas, produtos ou dados.
- Se não souber algo, NÃO mencione.
- Escreva de forma NATURAL para WhatsApp.
- Divida a mensagem em 2-3 blocos curtos (máximo 150 caracteres cada).
- Separe cada bloco com ---BLOCO--- numa linha isolada.
- O primeiro bloco deve ser uma saudação rápida e pessoal.
- O segundo bloco deve apresentar o valor/produto.
- O terceiro bloco (opcional) deve ter um CTA suave.

${companyContext || "ATENÇÃO: Não há dados da empresa configurados. Escreva uma mensagem genérica e profissional sem inventar nenhum nome de empresa ou produto."}` },
                { role: "user", content: `Crie UMA mensagem de primeiro contato para: ${leadContext}. ${broadcast.description ? `Contexto da campanha: ${broadcast.description}` : ""}. Retorne APENAS os blocos da mensagem separados por ---BLOCO---, sem aspas ou formatação extra.` },
              ],
              temperature: 0.7,
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            messageText = (aiData.choices?.[0]?.message?.content || "").trim();
            // Remove quotes if AI wraps in quotes
            if (messageText.startsWith('"') && messageText.endsWith('"')) {
              messageText = messageText.slice(1, -1);
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
          status: "failed",
          error_message: "Sem mensagem para enviar",
        }).eq("id", bl.id);
        failCount++;
        continue;
      }

      // Send via Evolution API — in blocks with human-like delays
      const cleanPhone = lead.phone.replace(/\D/g, "");
      try {
        const success = await sendInBlocks(cleanPhone, messageText);

        if (success) {
          // Store the full message (all blocks joined)
          const storedMsg = messageText.replace(/---BLOCO---/gi, "\n").trim();
          await supabase.from("broadcast_leads").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            message_sent: storedMsg,
          }).eq("id", bl.id);

          // Create/update conversation_tracker so ai-whatsapp-hook can continue
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
              ai_config_id: broadcast.ai_config_id || null,
            });
          } else {
            await supabase.from("conversation_tracker").update({
              last_bot_msg_at: new Date().toISOString(),
              lead_id: bl.lead_id,
              ai_config_id: broadcast.ai_config_id || null,
            }).eq("id", existingConv.id);
          }

          sentCount++;
        } else {
          await supabase.from("broadcast_leads").update({
            status: "failed",
            error_message: "API error: all blocks failed",
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
