import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "Firecrawl não configurado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI não configurada." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { org_id, niche, city, state, bairro, limit = 20 } = await req.json();
    if (!org_id || !niche) {
      return new Response(JSON.stringify({ error: "org_id e niche são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build precise location-based search query
    const locationParts: string[] = [];
    if (bairro) locationParts.push(bairro);
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);
    const locationStr = locationParts.join(", ");

    // Build search query: segment + exact location
    const searchQuery = `${niche} ${locationStr} contato telefone whatsapp`;
    const searchLimit = Math.min(Math.max(limit, 5), 50);

    console.log(`Searching: "${searchQuery}" (limit: ${searchLimit}, location: ${locationStr})`);

    // Step 1: Firecrawl SEARCH - find real business pages (with retry)
    let searchResponse: Response | null = null;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: searchLimit,
            lang: "pt-br",
            country: "br",
            scrapeOptions: {
              formats: ["markdown"],
              onlyMainContent: true,
            },
          }),
        });
        if (searchResponse.ok || searchResponse.status < 500) break;
        const errText = await searchResponse.text();
        console.error(`Firecrawl attempt ${attempt}/${maxRetries} failed: ${searchResponse.status} ${errText}`);
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000 * attempt));
      } catch (fetchErr) {
        console.error(`Firecrawl fetch error attempt ${attempt}:`, fetchErr);
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }

    if (!searchResponse || !searchResponse.ok) {
      const status = searchResponse?.status || 502;
      return new Response(JSON.stringify({ error: `Erro na busca após ${maxRetries} tentativas (status: ${status}). Tente novamente em alguns instantes.` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchData = await searchResponse.json();
    const results = searchData?.data || searchData?.results || [];
    console.log(`Search returned ${results.length} results`);

    if (results.length === 0) {
      return new Response(JSON.stringify({ count: 0, results: [], message: "Nenhum resultado encontrado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Build context from all scraped pages
    const pagesContent = results.map((r: any, i: number) => {
      const title = r.title || r.metadata?.title || `Resultado ${i + 1}`;
      const url = r.url || r.metadata?.sourceURL || "";
      const markdown = r.markdown || r.content || "";
      // Truncate to avoid token limits
      const trimmed = markdown.substring(0, 3000);
      return `--- PÁGINA ${i + 1}: ${title} (${url}) ---\n${trimmed}`;
    }).join("\n\n");

    // Step 3: Use AI to extract structured contacts from all pages
    const extractionPrompt = `Analise as páginas abaixo e extraia TODOS os contatos de empresas do segmento "${niche}" localizadas em ${locationStr || "qualquer lugar"}.

PÁGINAS RASPADAS:
${pagesContent}

INSTRUÇÕES:
- Extraia nome completo da pessoa ou empresa
- Telefone (com DDD brasileiro)  
- Email
- Nome da empresa
- Cargo/função da pessoa
- Cidade e estado
- Website da empresa
- Segmento/ramo de atuação

FILTRO OBRIGATÓRIO DE LOCALIDADE:
${city ? `- APENAS extraia contatos de empresas localizadas em ${locationStr}.` : ""}
${city ? `- Se o contato NÃO tiver relação clara com ${locationStr}, NÃO inclua.` : ""}
${state ? `- O DDD do telefone deve ser compatível com o estado ${state}. Se for de outro estado, DESCARTE.` : ""}
- Se não conseguir confirmar a localidade, inclua apenas se houver forte indicação de que é da região.

REGRAS:
- Extraia TODOS os contatos da região correta, não apenas o primeiro
- Telefones devem estar no formato brasileiro com DDD
- Se não encontrar um campo, deixe null
- NÃO invente dados, extraia apenas o que está nas páginas
- Priorize contatos com telefone
- DESCARTE contatos que claramente são de outra cidade/estado

Responda APENAS com JSON válido no formato:
{
  "contacts": [
    {
      "name": "string ou null",
      "phone": "string ou null", 
      "email": "string ou null",
      "company": "string ou null",
      "role": "string ou null",
      "city": "string ou null",
      "website": "string ou null",
      "segment": "string ou null",
      "extra_info": "string ou null"
    }
  ]
}`;

    console.log("Sending to AI for extraction...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em extração de dados de contato comercial. Extraia com precisão todos os contatos encontrados nas páginas. ${locationStr ? `FILTRE RIGOROSAMENTE: inclua APENAS contatos de ${locationStr}. Descarte qualquer contato de outra cidade ou estado.` : ""} Retorne APENAS JSON válido sem markdown.`,
          },
          { role: "user", content: extractionPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI extraction error:", aiResponse.status);
      return new Response(JSON.stringify({ error: "Erro na extração por IA" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let contacts: any[] = [];
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        contacts = parsed.contacts || [];
      }
    } catch (e) {
      console.error("JSON parse error:", e);
    }

    console.log(`AI extracted ${contacts.length} contacts`);

    if (contacts.length === 0) {
      return new Response(JSON.stringify({ 
        count: 0, results: [], pages_searched: results.length,
        message: "Nenhum contato extraído das páginas encontradas." 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 4: Format and deduplicate
    const formatPhone = (phone: string) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) return null;
      if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
      if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
      if (digits.length === 8 || digits.length === 9) return null; // no DDD
      return `+${digits}`;
    };

    const capitalizeName = (name: string) =>
      name ? name.replace(/\b\w/g, (c) => c.toUpperCase()).trim() : null;

    // Deduplicate within batch by phone and email
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const uniqueContacts = contacts.filter((c: any) => {
      const phone = formatPhone(c.phone || "");
      const email = c.email?.toLowerCase()?.trim();
      if (phone && seenPhones.has(phone)) return false;
      if (!phone && email && seenEmails.has(email)) return false;
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);
      return phone || email; // must have at least phone or email
    });

    // Check existing in DB to avoid duplicates
    const phonesToCheck = uniqueContacts.map((c: any) => formatPhone(c.phone || "")).filter(Boolean);
    const emailsToCheck = uniqueContacts.map((c: any) => c.email?.toLowerCase()?.trim()).filter(Boolean);

    let existingPhones = new Set<string>();
    let existingEmails = new Set<string>();

    if (phonesToCheck.length > 0) {
      const { data: existingByPhone } = await supabaseAdmin
        .from("leads_raw")
        .select("phone")
        .eq("org_id", org_id)
        .in("phone", phonesToCheck);
      existingPhones = new Set((existingByPhone || []).map((l: any) => l.phone));
    }

    if (emailsToCheck.length > 0) {
      const { data: existingByEmail } = await supabaseAdmin
        .from("leads_raw")
        .select("email")
        .eq("org_id", org_id)
        .in("email", emailsToCheck);
      existingEmails = new Set((existingByEmail || []).map((l: any) => l.email?.toLowerCase()));
    }

    const newLeads = uniqueContacts
      .map((c: any) => {
        const phone = formatPhone(c.phone || "");
        const email = c.email?.toLowerCase()?.trim() || null;
        return {
          org_id,
          name: capitalizeName(c.name || c.company || "") || "Lead sem nome",
          phone,
          email,
          source: "web" as const,
          status: "pending" as const,
          enrichment_data: {
            company: c.company || null,
            role: c.role || null,
            city: c.city || null,
            website: c.website || null,
            segment: c.segment || null,
            extra_info: c.extra_info || null,
            scraped_niche: niche,
            scraped_location: locationStr,
            scraped_at: new Date().toISOString(),
          },
        };
      })
      .filter((l: any) => {
        if (l.phone && existingPhones.has(l.phone)) return false;
        if (!l.phone && l.email && existingEmails.has(l.email)) return false;
        return true;
      });

    // Step 5: Save to DB
    let savedCount = 0;
    if (newLeads.length > 0) {
      for (let i = 0; i < newLeads.length; i += 100) {
        const chunk = newLeads.slice(i, i + 100);
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(chunk);
        if (insertError) {
          console.error("Insert error:", insertError);
        } else {
          savedCount += chunk.length;
        }
      }
    }

    // Build results for display
    const displayResults = uniqueContacts.map((c: any) => ({
      name: capitalizeName(c.name || c.company || "") || null,
      phone: formatPhone(c.phone || ""),
      email: c.email || null,
      company: c.company || null,
      role: c.role || null,
      city: c.city || null,
      website: c.website || null,
      segment: c.segment || null,
    }));

    console.log(`Done: ${savedCount} saved, ${contacts.length - newLeads.length} duplicates skipped`);

    return new Response(JSON.stringify({
      count: savedCount,
      total_found: contacts.length,
      duplicates_skipped: contacts.length - newLeads.length,
      pages_searched: results.length,
      results: displayResults,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("scrape-leads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
