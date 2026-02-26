import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIPELINE_STAGES = [
  { key: "lead", name: "Lead", order: 0 },
  { key: "enriched", name: "Enriquecidas", order: 1 },
  { key: "contacted", name: "Contato Feito", order: 2 },
  { key: "prospecting", name: "Em Prospecção", order: 3 },
  { key: "qualified", name: "Qualificado", order: 4 },
  { key: "scheduled", name: "Agendado", order: 5 },
  { key: "proposal", name: "Reunião / Proposta", order: 6 },
  { key: "won", name: "Ganho", order: 7 },
  { key: "lost", name: "Perdido", order: 8 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all organizations
    const { data: orgs } = await supabase.from("organizations").select("id");
    if (!orgs?.length) return respond({ message: "No orgs" });

    const results: any[] = [];

    for (const org of orgs) {
      const orgId = org.id;

      // Get CRM stages for this org
      const { data: stages } = await supabase
        .from("crm_stages")
        .select("id, name, stage_order")
        .eq("org_id", orgId)
        .order("stage_order");

      if (!stages?.length) continue;

      // Build stage lookup by normalized name
      const stageByName = new Map<string, { id: string; name: string; order: number }>();
      for (const s of stages) {
        const normalized = s.name.trim().toLowerCase();
        stageByName.set(normalized, { id: s.id, name: s.name, order: s.stage_order });
      }

      const findStageId = (key: string): string | null => {
        const def = PIPELINE_STAGES.find(p => p.key === key);
        if (!def) return null;
        const found = stageByName.get(def.name.toLowerCase());
        return found?.id || null;
      };

      const leadStageId = findStageId("lead");
      const enrichedStageId = findStageId("enriched");
      const contactedStageId = findStageId("contacted");
      const prospectingStageId = findStageId("prospecting");
      const qualifiedStageId = findStageId("qualified");
      const scheduledStageId = findStageId("scheduled");

      if (!leadStageId || !enrichedStageId || !contactedStageId) continue;

      // Get Evolution API integration for sending messages
      const { data: evoInteg } = await supabase
        .from("integrations")
        .select("api_key, endpoint_url, config")
        .eq("org_id", orgId)
        .eq("service_name", "evolution")
        .maybeSingle();

      // Get company profile for personalized messages
      const { data: companyProfile } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();

      // =========================================
      // STAGE 1: Lead → Enriquecidas
      // Move leads with name + phone to Enriquecidas
      // =========================================
      const { data: leadOpps } = await supabase
        .from("opportunities")
        .select("id, lead_id, automation_status, leads_raw!inner(name, phone, email)")
        .eq("org_id", orgId)
        .eq("stage_id", leadStageId)
        .in("automation_status", ["idle", null]);

      let movedToEnriched = 0;
      for (const opp of leadOpps || []) {
        const lead = (opp as any).leads_raw;
        if (lead?.name && lead?.phone) {
          await supabase
            .from("opportunities")
            .update({ stage_id: enrichedStageId, automation_status: "pending_enrichment" })
            .eq("id", opp.id);
          movedToEnriched++;
        }
      }

      // =========================================
      // STAGE 2: Enriquecidas → Contato Feito
      // Deep enrich + generate message + send WhatsApp
      // =========================================
      const { data: enrichOpps } = await supabase
        .from("opportunities")
        .select("id, lead_id, leads_raw!inner(id, name, phone, email, enrichment_data)")
        .eq("org_id", orgId)
        .eq("stage_id", enrichedStageId)
        .eq("automation_status", "pending_enrichment");

      let enrichedAndSent = 0;
      for (const opp of enrichOpps || []) {
        const lead = (opp as any).leads_raw;
        try {
          // Step A: Deep enrichment via Firecrawl + AI
          const enrichmentData = await deepEnrichLead(lead, FIRECRAWL_API_KEY, LOVABLE_API_KEY);

          // Save enrichment data
          await supabase
            .from("leads_raw")
            .update({ enrichment_data: enrichmentData, status: "enriched" })
            .eq("id", lead.id);

          // Step B: Generate personalized WhatsApp message
          const personalizedMsg = await generatePersonalizedMessage(
            lead, enrichmentData, companyProfile, LOVABLE_API_KEY
          );

          // Step C: Send WhatsApp message
          let messageSent = false;
          if (evoInteg?.api_key && evoInteg?.endpoint_url && lead.phone) {
            messageSent = await sendWhatsAppMessage(
              evoInteg, lead.phone, personalizedMsg, orgId, supabase
            );
          }

          if (messageSent && contactedStageId) {
            await supabase
              .from("opportunities")
              .update({
                stage_id: contactedStageId,
                automation_status: "awaiting_response",
                personalized_message: personalizedMsg,
                message_sent_at: new Date().toISOString(),
              })
              .eq("id", opp.id);
            enrichedAndSent++;
          } else {
            // Mark as enriched but failed to send
            await supabase
              .from("opportunities")
              .update({
                automation_status: "enriched_no_send",
                personalized_message: personalizedMsg,
              })
              .eq("id", opp.id);
          }
        } catch (err) {
          console.error("Enrichment error for opp:", opp.id, err);
          await supabase
            .from("opportunities")
            .update({ automation_status: "enrichment_failed" })
            .eq("id", opp.id);
        }
      }

      // =========================================
      // STAGE 3: Contato Feito → Em Prospecção
      // After 3 customer messages, move to prospecting
      // =========================================
      if (prospectingStageId) {
        const { data: contactedOpps } = await supabase
          .from("opportunities")
          .select("id, lead_id, leads_raw!inner(phone)")
          .eq("org_id", orgId)
          .eq("stage_id", contactedStageId)
          .eq("automation_status", "awaiting_response");

        let movedToProspecting = 0;
        for (const opp of contactedOpps || []) {
          const phone = (opp as any).leads_raw?.phone;
          if (!phone) continue;

          // Check conversation tracker for message count
          const phoneClean = phone.replace(/\D/g, "");
          const { data: conv } = await supabase
            .from("conversation_tracker")
            .select("customer_msg_count")
            .eq("org_id", orgId)
            .or(`remote_jid.ilike.%${phoneClean}%,remote_jid.ilike.%${phoneClean.slice(-8)}%`)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (conv && conv.customer_msg_count >= 3) {
            await supabase
              .from("opportunities")
              .update({ stage_id: prospectingStageId, automation_status: "qualifying" })
              .eq("id", opp.id);
            movedToProspecting++;
          }
        }
      }

      // =========================================
      // STAGE 4: Em Prospecção → Qualificado
      // AI analyzes conversation for BANT qualification
      // =========================================
      if (prospectingStageId && qualifiedStageId) {
        const { data: prospectOpps } = await supabase
          .from("opportunities")
          .select("id, lead_id, leads_raw!inner(name, phone, enrichment_data)")
          .eq("org_id", orgId)
          .eq("stage_id", prospectingStageId)
          .eq("automation_status", "qualifying");

        for (const opp of prospectOpps || []) {
          const lead = (opp as any).leads_raw;
          const phone = lead?.phone?.replace(/\D/g, "");
          if (!phone) continue;

          // Get conversation history from tracker
          const { data: conv } = await supabase
            .from("conversation_tracker")
            .select("*")
            .eq("org_id", orgId)
            .or(`remote_jid.ilike.%${phone}%,remote_jid.ilike.%${phone.slice(-8)}%`)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!conv || conv.customer_msg_count < 5) continue;

          // Ask AI to evaluate qualification
          const qualResult = await evaluateQualification(lead, conv, LOVABLE_API_KEY);
          if (qualResult.qualified) {
            await supabase
              .from("opportunities")
              .update({
                stage_id: qualifiedStageId,
                automation_status: "qualified",
                probability: qualResult.score || 50,
                notes: `Qualificação automática: ${qualResult.reason}`,
              })
              .eq("id", opp.id);
          }
        }
      }

      // =========================================
      // STAGE 5: Qualificado → Agendado
      // AI detects meeting intent in conversation
      // =========================================
      if (qualifiedStageId && scheduledStageId) {
        const { data: qualOpps } = await supabase
          .from("opportunities")
          .select("id, lead_id, leads_raw!inner(phone)")
          .eq("org_id", orgId)
          .eq("stage_id", qualifiedStageId)
          .eq("automation_status", "qualified");

        for (const opp of qualOpps || []) {
          const phone = (opp as any).leads_raw?.phone?.replace(/\D/g, "");
          if (!phone) continue;

          // Check if appointment exists for this lead
          const { data: appointment } = await supabase
            .from("appointments")
            .select("id")
            .eq("org_id", orgId)
            .eq("lead_id", opp.lead_id)
            .eq("status", "scheduled")
            .maybeSingle();

          if (appointment) {
            await supabase
              .from("opportunities")
              .update({ stage_id: scheduledStageId, automation_status: "scheduled" })
              .eq("id", opp.id);
          }
        }
      }

      results.push({
        org_id: orgId,
        moved_to_enriched: movedToEnriched,
        enriched_and_sent: enrichedAndSent,
      });
    }

    return respond({ success: true, results });
  } catch (e) {
    console.error("crm-pipeline-automation error:", e);
    return respond({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// DEEP ENRICHMENT: Firecrawl scraping + AI synthesis
// ============================================================
async function deepEnrichLead(
  lead: { name: string; phone: string; email: string | null; enrichment_data: any },
  firecrawlKey: string | undefined,
  lovableKey: string
): Promise<any> {
  const existingData = lead.enrichment_data || {};
  const scrapedData: string[] = [];

  // Try to scrape website if available from existing enrichment
  const website = existingData.website || existingData.site;
  if (website && firecrawlKey) {
    try {
      const scraped = await firecrawlScrape(website, firecrawlKey);
      if (scraped) scrapedData.push(`[WEBSITE] ${scraped.substring(0, 3000)}`);
    } catch (e) {
      console.error("Firecrawl website error:", e);
    }
  }

  // Try to scrape Instagram if available
  const instagram = existingData.redes_sociais?.instagram || existingData.instagram;
  if (instagram && firecrawlKey) {
    try {
      const igUrl = instagram.startsWith("http") ? instagram : `https://instagram.com/${instagram.replace("@", "")}`;
      const scraped = await firecrawlScrape(igUrl, firecrawlKey);
      if (scraped) scrapedData.push(`[INSTAGRAM] ${scraped.substring(0, 2000)}`);
    } catch (e) {
      console.error("Firecrawl Instagram error:", e);
    }
  }

  // Search for the company/person online using Firecrawl search
  if (firecrawlKey && lead.name) {
    try {
      const searchQuery = `${lead.name} ${existingData.empresa || ""} empresa contato`;
      const searchResults = await firecrawlSearch(searchQuery, firecrawlKey);
      if (searchResults) scrapedData.push(`[BUSCA ONLINE] ${searchResults.substring(0, 2000)}`);
    } catch (e) {
      console.error("Firecrawl search error:", e);
    }
  }

  // Synthesize all data with AI
  const prompt = `Analise TODOS os dados abaixo e gere um perfil comercial COMPLETO e detalhado:

DADOS DO LEAD:
- Nome: ${lead.name}
- Telefone: ${lead.phone}
- Email: ${lead.email || "N/A"}

DADOS EXISTENTES:
${JSON.stringify(existingData, null, 2)}

DADOS RASPADOS DA WEB:
${scrapedData.join("\n\n") || "Nenhum dado raspado disponível"}

GERE UM JSON COMPLETO COM:
1. empresa (nome completo)
2. cnpj_estimado (se encontrado)
3. segmento (segmento de mercado)
4. porte (micro/pequena/média/grande)
5. website
6. instagram
7. linkedin
8. localizacao (cidade/estado)
9. cargo_estimado
10. nivel_decisao (C-level/Gerência/Operacional)
11. descricao_empresa (breve, 2-3 frases)
12. produtos_servicos (array de strings)
13. dores_provaveis (array de strings)
14. canal_ideal
15. score_conversao (0-100)
16. argumentos_venda (array de 3 strings personalizadas)
17. observacoes_importantes
18. fontes_utilizadas (array de URLs consultadas)

Responda APENAS em JSON válido.`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: "Você é um analista de inteligência comercial sênior especializado em enriquecimento de leads B2B. Retorne SEMPRE JSON válido.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    throw new Error(`AI enrichment failed: ${aiResponse.status} - ${errText}`);
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return { ...existingData, raw_deep_enrichment: content };
}

// ============================================================
// PERSONALIZED MESSAGE GENERATION
// ============================================================
async function generatePersonalizedMessage(
  lead: any,
  enrichment: any,
  companyProfile: any,
  lovableKey: string
): Promise<string> {
  let companyContext = "";
  if (companyProfile) {
    const cp = companyProfile as any;
    const parts: string[] = [];
    if (cp.company_name) parts.push(`Empresa: ${cp.company_name}`);
    if (cp.segment) parts.push(`Segmento: ${cp.segment}`);
    if (cp.description) parts.push(`Sobre: ${cp.description}`);
    if (cp.differentials) parts.push(`Diferenciais: ${cp.differentials}`);
    if (cp.tone_of_voice) parts.push(`Tom de voz: ${cp.tone_of_voice}`);
    const products = cp.products_services || [];
    if (products.length > 0) {
      parts.push("Produtos: " + products.map((p: any) => `${p.name}: ${p.description}`).join("; "));
    }
    companyContext = parts.join("\n");
  }

  const prompt = `Crie uma mensagem de prospecção 100% PERSONALIZADA para WhatsApp.

SOBRE NOSSA EMPRESA:
${companyContext || "Não disponível"}

SOBRE O LEAD:
Nome: ${lead.name}
${enrichment.empresa ? `Empresa: ${enrichment.empresa}` : ""}
${enrichment.cargo_estimado ? `Cargo: ${enrichment.cargo_estimado}` : ""}
${enrichment.segmento ? `Segmento: ${enrichment.segmento}` : ""}
${enrichment.descricao_empresa ? `Sobre a empresa dele: ${enrichment.descricao_empresa}` : ""}
${enrichment.dores_provaveis?.length ? `Dores prováveis: ${enrichment.dores_provaveis.join(", ")}` : ""}
${enrichment.argumentos_venda?.length ? `Argumentos relevantes: ${enrichment.argumentos_venda.join("; ")}` : ""}

REGRAS DA MENSAGEM:
1. CURTA (máx 3-4 frases para WhatsApp)
2. Mencione algo ESPECÍFICO da empresa/pessoa do lead
3. Gere CURIOSIDADE sem vender diretamente
4. Pergunte algo que provoque resposta
5. Tom natural, como se fosse de pessoa para pessoa
6. NÃO use saudações genéricas como "Prezado" ou "Caro"
7. Use o primeiro nome do lead
8. NÃO inclua assinatura ou despedida formal

Retorne APENAS o texto da mensagem, sem aspas nem formatação.`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você é um SDR top performer. Escreva mensagens curtas, personalizadas e que geram resposta." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!aiResponse.ok) throw new Error(`Message generation failed: ${aiResponse.status}`);

  const aiData = await aiResponse.json();
  return (aiData.choices?.[0]?.message?.content || "").trim();
}

// ============================================================
// QUALIFICATION EVALUATION
// ============================================================
async function evaluateQualification(
  lead: any,
  conversation: any,
  lovableKey: string
): Promise<{ qualified: boolean; score: number; reason: string }> {
  const prompt = `Analise este lead e determine se está QUALIFICADO usando o framework BANT:

LEAD:
Nome: ${lead.name}
${JSON.stringify(lead.enrichment_data || {}, null, 2)}

CONVERSA:
- Total de mensagens do cliente: ${conversation.customer_msg_count}
- Última mensagem: ${conversation.last_customer_msg_at}
- Follow-up step: ${conversation.last_follow_up_step}

Avalie usando BANT:
B (Budget) - Tem orçamento?
A (Authority) - É decisor?
N (Need) - Tem necessidade clara?
T (Timeline) - Tem urgência?

Retorne JSON: { "qualified": boolean, "score": 0-100, "reason": "motivo em 1 frase", "bant": { "budget": bool, "authority": bool, "need": bool, "timeline": bool } }`;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você é um analista de qualificação de leads. Retorne APENAS JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!aiResponse.ok) return { qualified: false, score: 0, reason: "AI evaluation failed" };

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return { qualified: false, score: 0, reason: "Failed to parse" };
}

// ============================================================
// FIRECRAWL HELPERS
// ============================================================
async function firecrawlScrape(url: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      await response.text();
      return null;
    }

    const data = await response.json();
    return data.data?.markdown || data.markdown || null;
  } catch {
    return null;
  }
}

async function firecrawlSearch(query: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 3,
      }),
    });

    if (!response.ok) {
      await response.text();
      return null;
    }

    const data = await response.json();
    const results = data.data || [];
    return results.map((r: any) => `${r.title}: ${r.description || ""}`).join("\n");
  } catch {
    return null;
  }
}

// ============================================================
// WHATSAPP SEND HELPER
// ============================================================
async function sendWhatsAppMessage(
  evoInteg: any,
  phone: string,
  message: string,
  orgId: string,
  supabase: any
): Promise<boolean> {
  const baseUrl = evoInteg.endpoint_url.replace(/\/$/, "");
  const apiKey = evoInteg.api_key;
  const config = evoInteg.config || {};

  // Find first connected instance for this org
  const instancesByUser = config.instances_by_user || {};
  let instanceName: string | null = null;

  for (const userId of Object.keys(instancesByUser)) {
    const instances = instancesByUser[userId] as string[];
    if (instances?.length > 0) {
      // Check if instance is connected
      for (const inst of instances) {
        try {
          const stateResp = await fetch(`${baseUrl}/instance/connectionState/${inst}`, {
            method: "GET",
            headers: { apikey: apiKey },
          });
          if (stateResp.ok) {
            const stateData = await stateResp.json();
            if ((stateData.instance?.state || stateData.state) === "open") {
              instanceName = inst;
              break;
            }
          } else {
            await stateResp.text();
          }
        } catch { /* continue */ }
      }
      if (instanceName) break;
    }
  }

  if (!instanceName) {
    console.error("No connected WhatsApp instance found for org:", orgId);
    return false;
  }

  const cleanPhone = phone.replace(/\D/g, "");

  try {
    const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      console.error("WhatsApp send error:", response.status, await response.text());
      return false;
    }
    await response.json();

    // Track conversation
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;
    const { data: existing } = await supabase
      .from("conversation_tracker")
      .select("id")
      .eq("org_id", orgId)
      .eq("instance_name", instanceName)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    if (!existing) {
      await supabase.from("conversation_tracker").insert({
        org_id: orgId,
        instance_name: instanceName,
        remote_jid: remoteJid,
        last_customer_msg_at: new Date().toISOString(),
        last_bot_msg_at: new Date().toISOString(),
        customer_msg_count: 0,
      });
    } else {
      await supabase
        .from("conversation_tracker")
        .update({ last_bot_msg_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    return true;
  } catch (e) {
    console.error("WhatsApp send exception:", e);
    return false;
  }
}
