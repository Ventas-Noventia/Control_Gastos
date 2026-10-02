import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createAdminHandler } from "./handler.js";

// Estas variables viven en Supabase; no se incluyen claves en los archivos del sitio.
const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const handler =
  url && key
    ? createAdminHandler(
        createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
        corsHeaders,
      )
    : () =>
        new Response(
          JSON.stringify({ error: "Falta configurar la función en Supabase." }),
          {
            status: 503,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
Deno.serve(handler);
