import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const formatPhone = (jid: string) => {
  const digits = jid.replace(/@.*/, "").replace(/\D/g, "");
  return digits ? `+${digits}` : null;
};

const formatJid = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { org_id, mode = "group", group_name, phone } = body;

    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("EVOLUTION_API_KEY");
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    if (!apiKey || !evolutionUrl) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada. Adicione os secrets EVOLUTION_API_KEY e EVOLUTION_API_URL." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = evolutionUrl.replace(/\/$/, "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const instance = "default";

    // ============================================
    // MODE: GROUP - extract participants from group
    // ============================================
    if (mode === "group") {
      if (!group_name) {
        return new Response(JSON.stringify({ error: "group_name is required for group mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log("Mode: group | Fetching groups from:", baseUrl);

      const groupsResponse = await fetch(`${baseUrl}/group/fetchAllGroups/${instance}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!groupsResponse.ok) {
        const errText = await groupsResponse.text();
        console.error("Evolution groups error:", groupsResponse.status, errText);
        return new Response(JSON.stringify({ error: `Evolution API error: ${groupsResponse.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const groups = await groupsResponse.json();
      const targetGroup = (Array.isArray(groups) ? groups : []).find(
        (g: any) => g.subject?.toLowerCase().includes(group_name.toLowerCase())
      );

      if (!targetGroup) {
        return new Response(JSON.stringify({ error: `Grupo "${group_name}" não encontrado. Disponíveis: ${(groups || []).slice(0, 5).map((g: any) => g.subject).join(", ")}` }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Found group:", targetGroup.subject);

      const participantsResponse = await fetch(`${baseUrl}/group/participants/${instance}?groupJid=${targetGroup.id}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (!participantsResponse.ok) {
        return new Response(JSON.stringify({ error: "Erro ao buscar participantes do grupo." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const participantsData = await participantsResponse.json();
      const participants = participantsData?.participants || participantsData || [];

      if (!Array.isArray(participants) || participants.length === 0) {
        return new Response(JSON.stringify({ count: 0, message: "Nenhum participante encontrado." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phones = participants.map((p: any) => formatPhone(p.id || "")).filter(Boolean);
      const { data: existingLeads } = await supabaseAdmin
        .from("leads_raw").select("phone").eq("org_id", org_id).in("phone", phones);
      const existingPhones = new Set((existingLeads || []).map((l) => l.phone));

      const newLeads = participants
        .map((p: any) => {
          const ph = formatPhone(p.id || "");
          if (!ph || existingPhones.has(ph)) return null;
          return {
            org_id,
            name: p.name || p.notify || null,
            phone: ph,
            source: "whatsapp" as const,
            status: "pending" as const,
            enrichment_data: { group: targetGroup.subject, group_id: targetGroup.id, extraction_type: "group" },
          };
        })
        .filter(Boolean);

      if (newLeads.length > 0) {
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(newLeads);
        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({ count: newLeads.length, total_participants: participants.length, group: targetGroup.subject }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================================================
    // MODE: CONVERSATION - extract contacts from a chat
    // ==================================================
    if (mode === "conversation") {
      if (!phone) {
        return new Response(JSON.stringify({ error: "phone is required for conversation mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const remoteJid = formatJid(phone);
      console.log("Mode: conversation | Fetching messages with:", remoteJid);

      // 1. Get contact profile info
      const contactResponse = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { id: remoteJid } }),
      });

      let contactName: string | null = null;
      if (contactResponse.ok) {
        const contacts = await contactResponse.json();
        const contact = Array.isArray(contacts) ? contacts[0] : contacts;
        contactName = contact?.pushName || contact?.name || contact?.verifiedName || null;
        console.log("Contact found:", contactName);
      }

      // 2. Fetch messages from the conversation to extract mentioned numbers
      const messagesResponse = await fetch(`${baseUrl}/chat/findMessages/${instance}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit: 200,
        }),
      });

      let extractedPhones = new Set<string>();
      const formattedPhone = formatPhone(remoteJid);
      if (formattedPhone) extractedPhones.add(formattedPhone);

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const messages = Array.isArray(messagesData) ? messagesData : messagesData?.messages || [];

        // Extract phone numbers mentioned in messages
        const phoneRegex = /\+?\d{10,15}/g;
        for (const msg of messages) {
          const text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "";
          const vcard = msg?.message?.contactMessage?.vcard || msg?.message?.contactsArrayMessage?.contacts?.map((c: any) => c.vcard).join(" ") || "";

          const combined = `${text} ${vcard}`;
          const matches = combined.match(phoneRegex);
          if (matches) {
            for (const m of matches) {
              const ph = formatPhone(m);
              if (ph) extractedPhones.add(ph);
            }
          }

          // Also extract from vCard TEL fields
          const telMatches = vcard.match(/TEL[^:]*:([+\d\s-]+)/gi);
          if (telMatches) {
            for (const t of telMatches) {
              const num = t.replace(/TEL[^:]*:/i, "").trim();
              const ph = formatPhone(num);
              if (ph) extractedPhones.add(ph);
            }
          }
        }

        console.log(`Extracted ${extractedPhones.size} unique phones from conversation`);
      }

      // 3. Deduplicate and insert
      const phonesArr = Array.from(extractedPhones);
      const { data: existingLeads } = await supabaseAdmin
        .from("leads_raw").select("phone").eq("org_id", org_id).in("phone", phonesArr);
      const existingPhones = new Set((existingLeads || []).map((l) => l.phone));

      const newLeads = phonesArr
        .filter((ph) => !existingPhones.has(ph))
        .map((ph) => ({
          org_id,
          name: ph === formattedPhone ? contactName : null,
          phone: ph,
          source: "whatsapp" as const,
          status: "pending" as const,
          enrichment_data: { extraction_type: "conversation", conversation_with: formattedPhone },
        }));

      if (newLeads.length > 0) {
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(newLeads);
        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({ count: newLeads.length, total_found: extractedPhones.size, contact_name: contactName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // MODE: CONTACT - import a single contact
    // ============================================
    if (mode === "contact") {
      if (!phone) {
        return new Response(JSON.stringify({ error: "phone is required for contact mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const remoteJid = formatJid(phone);
      console.log("Mode: contact | Fetching contact:", remoteJid);

      // Fetch contact info from Evolution
      const contactResponse = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { id: remoteJid } }),
      });

      let contactName: string | null = null;
      let profilePicUrl: string | null = null;

      if (contactResponse.ok) {
        const contacts = await contactResponse.json();
        const contact = Array.isArray(contacts) ? contacts[0] : contacts;
        contactName = contact?.pushName || contact?.name || contact?.verifiedName || null;
        profilePicUrl = contact?.profilePictureUrl || null;
        console.log("Contact found:", contactName);
      }

      // Also try to fetch profile picture
      try {
        const picResponse = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instance}`, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: phone.replace(/\D/g, "") }),
        });
        if (picResponse.ok) {
          const picData = await picResponse.json();
          profilePicUrl = picData?.profilePictureUrl || picData?.url || profilePicUrl;
        }
      } catch (_) { /* ignore */ }

      const formattedPhone = formatPhone(remoteJid);
      if (!formattedPhone) {
        return new Response(JSON.stringify({ error: "Número inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from("leads_raw").select("id").eq("org_id", org_id).eq("phone", formattedPhone).limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ count: 0, message: "Contato já existe na base.", contact_name: contactName }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertError } = await supabaseAdmin.from("leads_raw").insert({
        org_id,
        name: contactName,
        phone: formattedPhone,
        source: "whatsapp" as const,
        status: "pending" as const,
        enrichment_data: { extraction_type: "contact", profile_pic: profilePicUrl },
      });

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ count: 1, contact_name: contactName, phone: formattedPhone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Modo inválido: ${mode}. Use 'group', 'conversation' ou 'contact'.` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("extract-whatsapp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
