import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "https://vssalesreal.lovable.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "NOT_FOUND";

  return new Response(JSON.stringify({ service_role_key: key }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": allowedOrigin },
  });
});
