// Supabase Edge Function: chat
// Streams a Mistral chat completion back to the client as SSE.
// Optionally grounds the answer in fresh web sources via Apify RAG Web Browser.
//
// Deploy:  supabase functions deploy chat --no-verify-jwt
// Secrets: supabase secrets set MISTRAL_API_KEY=... APIFY_TOKEN=...

// deno-lint-ignore-file no-explicit-any

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = Deno.env.get("MISTRAL_MODEL") ?? "mistral-large-latest";
const APIFY_ACTOR = "apify~rag-web-browser";
const DAILY_LIMIT = parseInt(Deno.env.get("DAILY_MESSAGE_LIMIT") ?? "20", 10);
const ALLOWED_MODELS = new Set([
  "mistral-large-latest",
  "mistral-medium-latest",
  "mistral-small-latest",
  "magistral-medium-latest",
  "codestral-latest",
]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

async function incrementUsage(sessionId: string): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !sessionId) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_usage_daily`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_session_id: sessionId }),
    });
  } catch (e) {
    console.warn("increment_usage_daily failed", e);
  }
}

interface Source {
  title: string;
  snippet: string;
  link: string;
  imageUrl?: string;
  siteName?: string;
}

interface ChatRequest {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  useWeb?: boolean;
  domain?: string;
  artifact?: boolean;
  artifactPrompt?: string;
  settings?: {
    model?: string;
    contextWindow?: string;
    systemInstructions?: string;
    temperature?: number;
    maxTokens?: number;
    reasoningEffort?: "low" | "medium" | "high";
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are Aczen, a helpful AI assistant. You answer any question clearly and accurately — coding, writing, math, general knowledge, and (with deeper expertise) Indian legal, finance, and banking topics like GST, RBI, SEBI, and compliance. Use Markdown for structure. Be concise but thorough. If the user provides web sources, ground your answer in them and cite with [1], [2] style references mapping to the source order.`;

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function contextCharLimit(contextWindow: string | undefined) {
  switch (contextWindow) {
    case "4k":
      return 12000;
    case "8k":
      return 24000;
    case "16k":
      return 48000;
    case "32k":
      return 96000;
    default:
      return 48000;
  }
}

function normalizeSettings(settings: ChatRequest["settings"] = {}) {
  const model =
    settings.model && ALLOWED_MODELS.has(settings.model) ? settings.model : MISTRAL_MODEL;
  const contextWindow = settings.contextWindow ?? "16k";
  const reasoningEffort = settings.reasoningEffort ?? "medium";
  return {
    model,
    contextWindow,
    systemInstructions: (settings.systemInstructions ?? "").toString().trim().slice(0, 4000),
    temperature: clampNumber(settings.temperature, 0, 1.5, 0.5),
    maxTokens: Math.round(clampNumber(settings.maxTokens, 256, 8192, 2048)),
    reasoningEffort,
  };
}

function trimMessagesToContext(messages: ChatRequest["messages"], contextWindow: string) {
  const limit = contextCharLimit(contextWindow);
  let used = 0;
  const kept: ChatRequest["messages"] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const size = messages[i].content.length;
    if (kept.length > 0 && used + size > limit) break;
    kept.unshift(messages[i]);
    used += size;
  }
  return kept;
}

async function fetchWebSources(query: string): Promise<Source[]> {
  const token = Deno.env.get("APIFY_TOKEN");
  if (!token) return [];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=45`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          maxResults: 5,
          outputFormats: ["markdown"],
        }),
      },
    );
    if (!res.ok) {
      console.warn("apify failed", res.status, await res.text());
      return [];
    }
    const items = (await res.json()) as any[];
    const sources = items
      .slice(0, 5)
      .map((it) => ({
        title: it.metadata?.title ?? it.title ?? it.url ?? "Source",
        snippet: (it.markdown ?? it.text ?? it.description ?? "").toString().slice(0, 400),
        link: it.metadata?.url ?? it.url ?? "",
        imageUrl: firstString(
          it.metadata?.image,
          it.metadata?.imageUrl,
          it.metadata?.ogImage,
          it.metadata?.["og:image"],
          it.metadata?.twitterImage,
          it.image,
          it.imageUrl,
          it.thumbnail,
          it.thumbnailUrl,
        ),
        siteName: firstString(
          it.metadata?.siteName,
          it.metadata?.["og:site_name"],
          it.siteName,
          it.hostname,
        ),
      }))
      .filter((s) => s.link);
    return await Promise.all(
      sources.map(async (source) => ({
        ...source,
        imageUrl: source.imageUrl ?? (await fetchPageImage(source.link)),
      })),
    );
  } catch (e) {
    console.warn("apify error", e);
    return [];
  }
}

// Mimics a real browser so news sites and CDNs don't gate the HTML behind a UA
// allowlist. Generic "Bot" UAs get 403'd by Cloudflare/Akamai on many publishers.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchPageImage(link: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(link, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return faviconFor(link);
    const html = (await res.text()).slice(0, 200000);
    const image =
      firstMetaContent(html, "property", "og:image:secure_url") ??
      firstMetaContent(html, "property", "og:image:url") ??
      firstMetaContent(html, "property", "og:image") ??
      firstMetaContent(html, "name", "twitter:image:src") ??
      firstMetaContent(html, "name", "twitter:image") ??
      firstLinkHref(html, "image_src") ??
      firstArticleImage(html);
    if (!image) return faviconFor(link);
    try {
      return new URL(image, link).toString();
    } catch {
      return faviconFor(link);
    }
  } catch {
    return faviconFor(link);
  } finally {
    clearTimeout(timeout);
  }
}

function firstMetaContent(html: string, attr: "name" | "property", value: string) {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] ?? match?.[2];
}

function firstLinkHref(html: string, rel: string) {
  const match = html.match(
    new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, "i"),
  );
  return match?.[1];
}

function firstArticleImage(html: string) {
  // Last-resort: pull the src of the first <img> with an http(s) source — most
  // hero images live near the top of the body and have absolute URLs.
  const match = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  return match?.[1];
}

function faviconFor(link: string): string | undefined {
  try {
    const host = new URL(link).hostname;
    // Google's favicon service — high availability, served over HTTPS, allows hotlinking.
    return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(host)}`;
  } catch {
    return undefined;
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const found = value.find((x) => typeof x === "string" && x.trim());
      if (typeof found === "string") return found.trim();
    }
  }
  return undefined;
}

function buildMessagesWithSources(
  messages: ChatRequest["messages"],
  sources: Source[],
  settings: ReturnType<typeof normalizeSettings>,
) {
  const custom = settings.systemInstructions
    ? `\n\nUser system instructions:\n${settings.systemInstructions}`
    : "";
  const effortHint = `\n\nReasoning effort: ${settings.reasoningEffort}. Match the depth of reasoning to this setting while keeping the final answer clear.`;
  const sys = { role: "system" as const, content: `${SYSTEM_PROMPT}${custom}${effortHint}` };
  messages = trimMessagesToContext(messages, settings.contextWindow);
  if (sources.length === 0) return [sys, ...messages];
  const lastIdx = messages.length - 1;
  const last = messages[lastIdx];
  const block = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.link}\nExcerpt: ${s.snippet}`)
    .join("\n\n");
  const enriched = {
    ...last,
    content: `${last.content}\n\n---\nWeb sources to ground your answer in:\n${block}`,
  };
  return [sys, ...messages.slice(0, lastIdx), enriched];
}

function extractSvg(text: string): string {
  const match = text.match(/<svg[\s\S]*?<\/svg>/i);
  return match?.[0] ?? "";
}

function cleanSvg(svg: unknown) {
  if (typeof svg !== "string") return "";
  return svg
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .trim();
}

// Models with reliable instruction-following for raw SVG output. We force the
// artifact request to use one of these regardless of the user's chat model,
// because reasoning/code-tuned models often wrap SVG in commentary.
const ARTIFACT_MODEL_FALLBACK = "mistral-large-latest";

function deriveTitle(prompt: string, text: string) {
  const tagged = text.match(/<!--\s*title:\s*([^\n>-]+?)\s*-->/i);
  if (tagged?.[1]) return tagged[1].trim();
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 60) return cleaned || "Concept diagram";
  return cleaned.slice(0, 57).trimEnd() + "…";
}

async function generateArtifactResponse(
  apiKey: string,
  body: ChatRequest,
  settings: ReturnType<typeof normalizeSettings>,
) {
  const prompt = (body.artifactPrompt ?? "").toString().trim().slice(0, 2000);
  const recent = trimMessagesToContext(body.messages, settings.contextWindow)
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");
  const artifactPrompt = `Create one educational concept artifact as a clean inline SVG diagram.

OUTPUT FORMAT (very important):
- Begin with an HTML comment containing the title, on its own line:  <!-- title: short title here -->
- Then output ONE complete <svg>...</svg> element.
- No prose, no markdown, no code fences, no JSON wrapper — just the comment and the SVG.

Rules for the SVG:
- Use viewBox="0 0 960 560" and width/height attributes that scale.
- Self-contained: boxes, arrows, text labels, simple color accents.
- Do not use scripts, external images, <foreignObject>, animations, or HTML outside SVG.

User request for artifact:
${prompt}

Recent conversation:
${recent}`;

  const model = ALLOWED_MODELS.has(settings.model) ? settings.model : ARTIFACT_MODEL_FALLBACK;

  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a precise visual explainer. Output ONE inline <svg> diagram preceded by an HTML title comment. Do not include any other text.",
        },
        { role: "user", content: artifactPrompt },
      ],
      temperature: Math.min(settings.temperature, 0.6),
      max_tokens: Math.min(settings.maxTokens, 4096),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return new Response(JSON.stringify({ error: `Mistral ${res.status}: ${errText}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const json = await res.json();
  const text = (json.choices?.[0]?.message?.content ?? "").toString();
  const svg = cleanSvg(extractSvg(text));

  if (!svg.startsWith("<svg")) {
    // Surface a snippet of what the model actually returned so debugging is easier.
    const debug = text.slice(0, 200).replace(/\s+/g, " ").trim();
    return new Response(
      JSON.stringify({
        error: `Could not extract SVG from artifact response. Model returned: ${debug || "(empty)"}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const title = deriveTitle(prompt, text);

  return new Response(
    JSON.stringify({
      title: title.slice(0, 80),
      svg,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "MISTRAL_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = req.headers.get("x-session-id") ?? "";
  if (sessionId) {
    const used = await getTodaysCount(sessionId);
    if (used >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({
          error: `Daily limit reached (${used}/${DAILY_LIMIT}). Resets at 00:00 UTC.`,
          used,
          limit: DAILY_LIMIT,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const sources = body.useWeb && lastUser ? await fetchWebSources(lastUser.content) : [];
  const settings = normalizeSettings(body.settings);

  if (body.artifact) {
    const artifactRes = await generateArtifactResponse(apiKey, body, settings);
    if (sessionId && artifactRes.ok) incrementUsage(sessionId);
    return artifactRes;
  }

  const mistralRes = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: buildMessagesWithSources(body.messages, sources, settings),
      stream: true,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    }),
  });

  if (!mistralRes.ok || !mistralRes.body) {
    const errText = await mistralRes.text();
    return new Response(JSON.stringify({ error: `Mistral ${mistralRes.status}: ${errText}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Count this message against the daily quota now that the upstream accepted it.
  if (sessionId) {
    incrementUsage(sessionId);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      if (sources.length > 0) {
        controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`));
      }
      const reader = mistralRes.body!.getReader();
      let buf = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
              continue;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
