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

    // Auth check
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

    const { org_id, url, keywords } = await req.json();
    if (!org_id || !url) {
      return new Response(JSON.stringify({ error: "org_id and url are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Firecrawl API key from environment (Lovable connector)
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlApiKey) {
      return new Response(JSON.stringify({ error: "Firecrawl não configurado. Conecte o conector Firecrawl no projeto." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping URL:", formattedUrl);

    // Call Firecrawl scrape API
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: [{ type: "json", prompt: `Extract all contact information (name, phone, email, company, role) from this page. ${keywords ? `Focus on: ${keywords}` : ""}`, schema: {
          type: "object",
          properties: {
            contacts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string" },
                  company: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        }}],
        onlyMainContent: true,
      }),
    });

    if (!firecrawlResponse.ok) {
      const errText = await firecrawlResponse.text();
      console.error("Firecrawl error:", firecrawlResponse.status, errText);
      return new Response(JSON.stringify({ error: `Firecrawl error: ${firecrawlResponse.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firecrawlData = await firecrawlResponse.json();
    console.log("Firecrawl response received");

    // Extract contacts from JSON extraction
    let contacts: any[] = [];
    const jsonData = firecrawlData?.data?.json;
    if (jsonData?.contacts && Array.isArray(jsonData.contacts)) {
      contacts = jsonData.contacts;
    }

    if (contacts.length === 0) {
      return new Response(JSON.stringify({ count: 0, message: "Nenhum contato encontrado na página." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format and deduplicate
    const formatPhone = (phone: string) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) return null;
      if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
      if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
      return `+${digits}`;
    };

    const capitalizeName = (name: string) =>
      name ? name.replace(/\b\w/g, (c) => c.toUpperCase()).trim() : null;

    // Check existing phones to deduplicate
    const phones = contacts.map((c) => formatPhone(c.phone || "")).filter(Boolean);
    const { data: existingLeads } = await supabaseAdmin
      .from("leads_raw")
      .select("phone")
      .eq("org_id", org_id)
      .in("phone", phones);
    const existingPhones = new Set((existingLeads || []).map((l) => l.phone));

    const newLeads = contacts
      .map((c) => ({
        org_id,
        name: capitalizeName(c.name || ""),
        phone: formatPhone(c.phone || ""),
        email: c.email || null,
        source: "web" as const,
        status: "pending" as const,
        enrichment_data: { company: c.company, role: c.role, scraped_from: formattedUrl },
      }))
      .filter((l) => l.phone && !existingPhones.has(l.phone));

    if (newLeads.length > 0) {
      const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(newLeads);
      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ count: newLeads.length, total_found: contacts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scrape-leads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
