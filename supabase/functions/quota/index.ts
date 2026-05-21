// Supabase Edge Function: quota
// Returns the caller's daily message usage for the current UTC day.
//
// Deploy:  supabase functions deploy quota --no-verify-jwt
// Identifies the caller via the x-session-id header (browser-generated UUID).

const DAILY_LIMIT = parseInt(Deno.env.get("DAILY_MESSAGE_LIMIT") ?? "20", 10);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function nextUtcMidnight(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return next.toISOString();
}

async function getTodaysCount(sessionId: string): Promise<number> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !sessionId) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const url = `${SUPABASE_URL}/rest/v1/usage_daily?session_id=eq.${encodeURIComponent(
    sessionId,
  )}&day=eq.${today}&select=count`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) return 0;
    const rows = (await res.json()) as { count: number }[];
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const sessionId =
    req.headers.get("x-session-id") ?? new URL(req.url).searchParams.get("session_id") ?? "";

  const used = sessionId ? await getTodaysCount(sessionId) : 0;
  const remaining = Math.max(0, DAILY_LIMIT - used);

  return new Response(
    JSON.stringify({
      used,
      limit: DAILY_LIMIT,
      remaining,
      resetsAt: nextUtcMidnight(),
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
