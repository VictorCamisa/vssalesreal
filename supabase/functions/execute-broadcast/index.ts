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

    // Get pending broadcast leads
    const { data: bLeads } = await supabase
      .from("broadcast_leads")
      .select("id, lead_id, lead:leads_raw(name, phone)")
      .eq("broadcast_id", broadcast_id)
      .eq("status", "pending")
      .limit(50); // Process in batches

    if (!bLeads || bLeads.length === 0) {
      // All done
      await supabase.from("broadcasts").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", broadcast_id);
      return json({ success: true, message: "All messages sent. Broadcast completed.", sent: 0 });
    }

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
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "Você é um SDR expert. Escreva mensagens curtas e naturais para WhatsApp. Máx 3 frases." },
                { role: "user", content: `Crie uma mensagem de prospecção para ${lead.name || "o lead"}. ${broadcast.description || ""}. Retorne APENAS o texto da mensagem.` },
              ],
              temperature: 0.8,
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            messageText = (aiData.choices?.[0]?.message?.content || "").trim();
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

      // Send via Evolution API
      const cleanPhone = lead.phone.replace(/\D/g, "");
      try {
        const sendResp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: messageText,
          }),
        });

        if (sendResp.ok) {
          await sendResp.json();
          await supabase.from("broadcast_leads").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            message_sent: messageText,
          }).eq("id", bl.id);
          sentCount++;
        } else {
          const errText = await sendResp.text();
          await supabase.from("broadcast_leads").update({
            status: "failed",
            error_message: `API error: ${sendResp.status}`,
          }).eq("id", bl.id);
          failCount++;
          console.error("Send error:", sendResp.status, errText);
        }
      } catch (e) {
        await supabase.from("broadcast_leads").update({
          status: "failed",
          error_message: e instanceof Error ? e.message : "Unknown error",
        }).eq("id", bl.id);
        failCount++;
      }

      // Delay between messages
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
      counts.sent_count = counts.sent_count; // no-op just for clarity
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
      // Fire and forget: trigger next batch
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
