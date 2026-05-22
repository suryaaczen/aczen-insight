// Supabase Edge Function: finance
// Thin proxy over Yahoo Finance's public JSON endpoints. Browsers can't call
// these directly (CORS), so we round-trip them through here.
//
// Deploy:  supabase functions deploy finance --no-verify-jwt
// No secrets required — these are public unauthenticated endpoints.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // Cache reads in the CDN for a minute so we don't hammer Yahoo on every keystroke.
      "Cache-Control": "public, max-age=30, s-maxage=60",
      ...(init.headers ?? {}),
    },
  });
}

function err(status: number, message: string) {
  return json({ error: message }, { status });
}

async function yfetch(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json,text/javascript,*/*;q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://finance.yahoo.com/",
      ...extraHeaders,
    },
  });
}

// Crumb + session cookie required by quoteSummary. Cached per function instance.
let crumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null;

function extractCookies(res: Response): string {
  // Deno's Fetch exposes getSetCookie() which returns each Set-Cookie line separately.
  const list = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
  if (list && list.length > 0) {
    return list.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function getCrumb(force = false): Promise<{ crumb: string; cookie: string } | null> {
  if (!force && crumbCache && crumbCache.expiresAt > Date.now()) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }
  try {
    // Step 1: hit fc.yahoo.com to receive the A1/A3 session cookie.
    const consentRes = await fetch("https://fc.yahoo.com/", {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
    });
    let cookie = extractCookies(consentRes);
    if (!cookie) {
      // Some egress points get an immediate 302 to consent.yahoo.com; try guce.yahoo.com.
      const alt = await fetch("https://guce.yahoo.com/", {
        headers: { "User-Agent": BROWSER_UA },
        redirect: "manual",
      });
      cookie = extractCookies(alt);
    }
    if (!cookie) return null;
    // Step 2: exchange cookie for a crumb.
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": BROWSER_UA,
        Cookie: cookie,
        Accept: "text/plain,*/*",
      },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;
    crumbCache = { crumb, cookie, expiresAt: Date.now() + 1000 * 60 * 30 };
    return { crumb, cookie };
  } catch {
    return null;
  }
}

function sanitizeSymbol(s: string | null): string {
  if (!s) return "";
  return s.trim().toUpperCase().replace(/[^A-Z0-9.\-=^]/g, "").slice(0, 32);
}

async function handleQuote(symbol: string) {
  // v8 chart endpoint gives us price + day stats + 52w range in one call without a crumb.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=1d&interval=1m&includePrePost=false`;
  const res = await yfetch(url);
  if (!res.ok) return err(502, `Yahoo quote failed (${res.status})`);
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result) {
    const msg = body?.chart?.error?.description ?? "Symbol not found";
    return err(404, msg);
  }
  const meta = result.meta ?? {};
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const price = meta.regularMarketPrice ?? null;
  const change =
    typeof price === "number" && typeof previousClose === "number"
      ? price - previousClose
      : null;
  const changePercent =
    typeof change === "number" && typeof previousClose === "number" && previousClose !== 0
      ? (change / previousClose) * 100
      : null;
  return json({
    symbol: meta.symbol ?? symbol,
    shortName: meta.shortName ?? null,
    longName: meta.longName ?? null,
    exchangeName: meta.exchangeName ?? meta.fullExchangeName ?? null,
    currency: meta.currency ?? null,
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketDayHigh: meta.regularMarketDayHigh ?? null,
    regularMarketDayLow: meta.regularMarketDayLow ?? null,
    regularMarketVolume: meta.regularMarketVolume ?? null,
    regularMarketOpen: meta.regularMarketOpen ?? null,
    regularMarketPreviousClose: previousClose,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    marketState: meta.marketState ?? null,
    instrumentType: meta.instrumentType ?? null,
  });
}

async function handleHistorical(
  symbol: string,
  rangeParam: string | null,
  intervalParam: string | null,
) {
  const range = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"].includes(
    rangeParam ?? "",
  )
    ? rangeParam!
    : "1y";
  const interval = ["1m", "5m", "15m", "30m", "60m", "1d", "1wk", "1mo"].includes(
    intervalParam ?? "",
  )
    ? intervalParam!
    : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${range}&interval=${interval}`;
  const res = await yfetch(url);
  if (!res.ok) return err(502, `Yahoo historical failed (${res.status})`);
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result) {
    const msg = body?.chart?.error?.description ?? "Symbol not found";
    return err(404, msg);
  }
  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const points = timestamps
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString(),
      open: q.open?.[i] ?? null,
      high: q.high?.[i] ?? null,
      low: q.low?.[i] ?? null,
      close: q.close?.[i] ?? null,
      volume: q.volume?.[i] ?? null,
    }))
    .filter((p) => p.close !== null);
  return json({
    symbol: result.meta?.symbol ?? symbol,
    range,
    interval,
    currency: result.meta?.currency ?? null,
    points,
  });
}

async function handleSearch(q: string) {
  if (!q) return json({ quotes: [] });
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    q,
  )}&quotesCount=10&newsCount=0&lang=en-US&region=US`;
  const res = await yfetch(url);
  if (!res.ok) return err(502, `Yahoo search failed (${res.status})`);
  const body = await res.json();
  const quotes = (body?.quotes ?? [])
    .filter((row: Record<string, unknown>) => typeof row.symbol === "string")
    .map((row: Record<string, unknown>) => ({
      symbol: row.symbol,
      shortname: row.shortname ?? row.longname ?? null,
      longname: row.longname ?? null,
      exchange: row.exchDisp ?? row.exchange ?? null,
      type: row.quoteType ?? row.typeDisp ?? null,
      sector: row.sector ?? null,
      industry: row.industry ?? null,
    }));
  return json({ quotes });
}

const ALLOWED_MODULES = new Set([
  "assetProfile",
  "summaryProfile",
  "summaryDetail",
  "financialData",
  "defaultKeyStatistics",
  "price",
  "calendarEvents",
  "earnings",
  "earningsHistory",
  "earningsTrend",
  "recommendationTrend",
  "upgradeDowngradeHistory",
  "incomeStatementHistory",
  "incomeStatementHistoryQuarterly",
  "balanceSheetHistory",
  "balanceSheetHistoryQuarterly",
  "cashflowStatementHistory",
  "cashflowStatementHistoryQuarterly",
  "institutionOwnership",
  "fundOwnership",
  "majorHoldersBreakdown",
  "insiderHolders",
  "insiderTransactions",
  "secFilings",
]);

const DEFAULT_SUMMARY_MODULES =
  "assetProfile,summaryDetail,financialData,defaultKeyStatistics,calendarEvents,earnings,recommendationTrend,upgradeDowngradeHistory,majorHoldersBreakdown,insiderHolders,insiderTransactions,secFilings";

async function fetchSummaryOnce(symbol: string, modules: string[], auth: { crumb: string; cookie: string } | null) {
  const params = new URLSearchParams({ modules: modules.join(",") });
  if (auth) params.set("crumb", auth.crumb);
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol,
  )}?${params.toString()}`;
  return yfetch(url, auth ? { Cookie: auth.cookie } : {});
}

async function handleSummary(symbol: string, modulesParam: string | null) {
  const modules = (modulesParam ?? DEFAULT_SUMMARY_MODULES)
    .split(",")
    .map((m) => m.trim())
    .filter((m) => ALLOWED_MODULES.has(m));
  if (modules.length === 0) return err(400, "no valid modules");

  let auth = await getCrumb(false);
  let res = await fetchSummaryOnce(symbol, modules, auth);

  // 401 / 403 means stale crumb. Force a refresh and retry once.
  if (res.status === 401 || res.status === 403) {
    auth = await getCrumb(true);
    res = await fetchSummaryOnce(symbol, modules, auth);
  }

  if (!res.ok) return err(502, `Yahoo summary failed (${res.status})`);
  const body = await res.json();
  const result = body?.quoteSummary?.result?.[0];
  if (!result) {
    const msg = body?.quoteSummary?.error?.description ?? "Symbol not found";
    return err(404, msg);
  }
  return json({ symbol, modules: flattenYahoo(result) });
}

async function handleNews(symbol: string, q: string | null) {
  const query = (q ?? symbol).trim();
  if (!query) return err(400, "query required");
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query,
  )}&newsCount=15&quotesCount=0&lang=en-US&region=US&enableFuzzyQuery=false&enableEnhancedTrivialQuery=true`;
  const res = await yfetch(url);
  if (!res.ok) return err(502, `Yahoo news failed (${res.status})`);
  const body = await res.json();
  const news = (body?.news ?? []).map((n: Record<string, unknown>) => {
    const thumb =
      (n.thumbnail as { resolutions?: { url: string; width: number; height: number }[] })
        ?.resolutions ?? [];
    // Pick a resolution near 320px wide for fast loading and decent quality.
    const picked = thumb.find((r) => r.width >= 200 && r.width <= 400) ?? thumb[0];
    const published =
      typeof n.providerPublishTime === "number"
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : null;
    return {
      uuid: n.uuid ?? null,
      title: n.title ?? null,
      publisher: n.publisher ?? null,
      link: n.link ?? null,
      thumbnail: picked?.url ?? null,
      publishedAt: published,
      relatedTickers: Array.isArray(n.relatedTickers) ? n.relatedTickers : [],
      type: n.type ?? null,
    };
  });
  return json({ symbol, news });
}

async function apifyWebContext(query: string, maxResults = 3): Promise<string> {
  const token = Deno.env.get("APIFY_TOKEN");
  if (!token) return "";
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items?token=${token}&timeout=45`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, maxResults, outputFormats: ["markdown"] }),
      },
    );
    if (!res.ok) return "";
    const items = (await res.json()) as Array<{
      metadata?: { title?: string; url?: string };
      markdown?: string;
      text?: string;
      url?: string;
    }>;
    return items
      .slice(0, maxResults)
      .map((it, i) => {
        const title = it.metadata?.title ?? it.url ?? `Source ${i + 1}`;
        const url = it.metadata?.url ?? it.url ?? "";
        const body = (it.markdown ?? it.text ?? "").toString().slice(0, 2500);
        return `[${i + 1}] ${title}\nURL: ${url}\n${body}`;
      })
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

function extractJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function handleAiAbout(symbol: string, nameParam: string | null) {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) return err(500, "MISTRAL_API_KEY not configured");

  const hint = nameParam ? ` (${nameParam})` : "";
  // Pull fresh web context if Apify is configured; otherwise rely on Mistral knowledge.
  const webContext = await apifyWebContext(
    `${symbol}${hint} company overview business segments revenue market`,
    3,
  );

  const prompt = `Build an authoritative company profile for the publicly listed stock symbol "${symbol}"${hint}. ${
    webContext
      ? "Use these recent web sources as your primary reference and prefer their numbers when present:\n\n" +
        webContext
      : "Use your domain knowledge."
  }

Return strict JSON only, with this exact shape (use null for fields you genuinely don't know):
{
  "name": "Full legal company name",
  "ticker": "Primary listing ticker (e.g. RELIANCE.NS)",
  "exchange": "Exchange name",
  "sector": "GICS sector",
  "industry": "GICS industry",
  "country": "HQ country",
  "headquarters": "City, Country",
  "founded": <year or null>,
  "employees": <approximate count or null>,
  "ceo": "CEO full name or null",
  "website": "https://... or null",
  "description": "3-5 sentence company overview covering what they do and how they make money",
  "businessSegments": ["short label 1", "short label 2", "..."],
  "products": ["product/service 1", "product/service 2"],
  "majorMarkets": ["geo 1", "geo 2"],
  "keyMetrics": [
    { "label": "Market cap", "value": "approximate value or 'NA'" },
    { "label": "Revenue (TTM)", "value": "..." },
    { "label": "Net income", "value": "..." },
    { "label": "P/E", "value": "..." },
    { "label": "Employees", "value": "..." }
  ],
  "competitors": ["ticker or company 1", "ticker or company 2"],
  "recentNews": [
    { "headline": "...", "source": "publisher", "date": "YYYY-MM-DD or relative", "summary": "1-sentence summary" }
  ],
  "risks": ["short risk 1", "short risk 2"],
  "opportunities": ["short opportunity 1", "short opportunity 2"]
}`;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content:
            "You are a precise equity research assistant. Return strict JSON only — no commentary, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return err(502, `Mistral ai-about failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonFromText(text);
  if (!parsed || typeof parsed !== "object") {
    return err(502, "Could not parse AI about response");
  }
  return json({ symbol, source: webContext ? "mistral+apify" : "mistral", about: parsed });
}

function flattenYahoo(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(flattenYahoo);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("raw" in obj && Object.keys(obj).every((k) => ["raw", "fmt", "longFmt"].includes(k))) {
      return obj.raw ?? null;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = flattenYahoo(v);
    }
    return out;
  }
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return err(405, "Method not allowed");
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "quote";
  const symbol = sanitizeSymbol(url.searchParams.get("symbol"));

  try {
    switch (action) {
      case "quote":
        if (!symbol) return err(400, "symbol required");
        return await handleQuote(symbol);
      case "historical":
        if (!symbol) return err(400, "symbol required");
        return await handleHistorical(
          symbol,
          url.searchParams.get("range"),
          url.searchParams.get("interval"),
        );
      case "search": {
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, 64);
        return await handleSearch(q);
      }
      case "summary":
        if (!symbol) return err(400, "symbol required");
        return await handleSummary(symbol, url.searchParams.get("modules"));
      case "news":
        return await handleNews(symbol, url.searchParams.get("q"));
      case "ai-about":
        if (!symbol) return err(400, "symbol required");
        return await handleAiAbout(symbol, url.searchParams.get("name"));
      default:
        return err(400, `unknown action: ${action}`);
    }
  } catch (e) {
    return err(500, e instanceof Error ? e.message : "internal error");
  }
});
