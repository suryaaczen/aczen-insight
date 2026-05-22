import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ArrowUp,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  ExternalLink,
  Newspaper,
  Calendar,
  ThumbsUp,
  Users,
  FileText,
  Building2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  formatCurrency,
  formatLargeNumber,
  formatNumber,
  formatPercent,
  getAiAbout,
  getHistorical,
  getNews,
  getQuote,
  getSummary,
  searchSymbols,
  type AiAboutResult,
  type HistoricalResult,
  type NewsItem,
  type Quote,
  type SearchResultRow,
  type SummaryResult,
} from "@/lib/finance";
import { streamChat, type ChatMessage } from "@/lib/chat";
import Markdown from "@/components/Markdown";

export const Route = createFileRoute("/finance")({
  component: FinancePage,
});

const DEFAULT_SYMBOL = "RELIANCE.NS";
const RANGES: { label: string; range: string; interval: string }[] = [
  { label: "1D", range: "1d", interval: "5m" },
  { label: "5D", range: "5d", interval: "15m" },
  { label: "1M", range: "1mo", interval: "1d" },
  { label: "6M", range: "6mo", interval: "1d" },
  { label: "1Y", range: "1y", interval: "1d" },
  { label: "5Y", range: "5y", interval: "1wk" },
];

function FinancePage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [historical, setHistorical] = useState<HistoricalResult | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [aiAbout, setAiAbout] = useState<AiAboutResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [rangeIdx, setRangeIdx] = useState(4); // 1Y
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quote drives the hero card — fail loudly if it can't load.
  useEffect(() => {
    let cancelled = false;
    setLoadingQuote(true);
    setError(null);
    getQuote(symbol)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Summary can 401 transiently. Surface its own error so the rest of the page still renders.
  useEffect(() => {
    let cancelled = false;
    setSummaryError(null);
    getSummary(symbol)
      .then((s) => {
        if (cancelled) return;
        setSummary(s);
      })
      .catch((e) => {
        if (cancelled) return;
        setSummaryError(e instanceof Error ? e.message : String(e));
        setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;
    setLoadingNews(true);
    getNews(symbol)
      .then((r) => {
        if (cancelled) return;
        setNews(r.news);
      })
      .catch(() => {
        if (cancelled) return;
        setNews([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingNews(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // AI-generated profile. Always populates so we have a fallback when Yahoo's quoteSummary
  // is unavailable, and gives us narrative content (segments, products, risks) Yahoo doesn't.
  useEffect(() => {
    let cancelled = false;
    setAiLoading(true);
    setAiAbout(null);
    getAiAbout(symbol, quote?.longName ?? quote?.shortName ?? undefined)
      .then((r) => {
        if (cancelled) return;
        setAiAbout(r);
      })
      .catch(() => {
        if (cancelled) return;
        setAiAbout(null);
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // intentionally not depending on `quote` so a slow quote response doesn't refetch AI
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Load chart when symbol or range changes.
  useEffect(() => {
    let cancelled = false;
    setLoadingChart(true);
    const r = RANGES[rangeIdx];
    getHistorical(symbol, r.range, r.interval)
      .then((h) => {
        if (cancelled) return;
        setHistorical(h);
      })
      .catch(() => {
        if (cancelled) return;
        setHistorical(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingChart(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, rangeIdx]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header onPickSymbol={(s) => setSymbol(s)} currentSymbol={symbol} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <QuoteCard quote={quote} loading={loadingQuote} />

        <ChartCard
          historical={historical}
          loading={loadingChart}
          rangeIdx={rangeIdx}
          onRangeChange={setRangeIdx}
        />

        <CompanyInfo quote={quote} summary={summary} aiAbout={aiAbout} />

        <AiOverviewSection aiAbout={aiAbout} loading={aiLoading} />

        <KeyStats quote={quote} summary={summary} aiAbout={aiAbout} />

        <Profile summary={summary} />

        <NewsSection news={news} loading={loadingNews} aiAbout={aiAbout} />

        <EarningsSection summary={summary} currency={quote?.currency ?? null} />

        <AnalystSection summary={summary} currency={quote?.currency ?? null} />

        <HoldersSection summary={summary} />

        <InsiderTransactionsSection summary={summary} />

        <FilingsSection summary={summary} />

        {summaryError && !summary && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-muted-foreground">
            Company details temporarily unavailable: {summaryError}
          </div>
        )}
      </main>

      <ChatBar quote={quote} summary={summary} news={news} />
    </div>
  );
}

function Header({
  onPickSymbol,
  currentSymbol,
}: {
  onPickSymbol: (symbol: string) => void;
  currentSymbol: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchSymbols(query)
        .then((r) => setResults(r.quotes))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = (sym: string) => {
    onPickSymbol(sym);
    setOpen(false);
    setQuery("");
  };

  return (
    <header className="sticky top-0 z-20 h-14 px-4 sm:px-6 flex items-center justify-between border-b border-border/60 bg-background/85 backdrop-blur gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="size-7 rounded-md bg-primary flex items-center justify-center">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <span className="font-display text-lg">Aczen</span>
        <span className="hidden sm:inline text-xs text-muted-foreground ml-2">· Finance</span>
      </div>

      <div className="relative flex-1 max-w-xl" ref={boxRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={`Search stocks (e.g. ${currentSymbol})`}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm outline-none focus:border-primary/50 transition"
          />
        </div>
        {open && (query.trim() || searching) && (
          <div className="absolute top-full mt-2 inset-x-0 rounded-xl border border-border bg-card shadow-lg z-30 overflow-hidden">
            {searching ? (
              <div className="px-3 py-3 text-xs text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">No matches.</div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.symbol}>
                    <button
                      type="button"
                      onClick={() => pick(r.symbol)}
                      className="w-full text-left px-3 py-2 hover:bg-accent/40 transition flex items-center gap-3"
                    >
                      <div className="font-mono text-xs text-primary shrink-0">{r.symbol}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">
                          {r.longname ?? r.shortname ?? r.symbol}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {[r.type, r.exchange].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function QuoteCard({ quote, loading }: { quote: Quote | null; loading: boolean }) {
  if (loading || !quote) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 h-40 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const up = (quote.regularMarketChange ?? 0) >= 0;
  const ChangeIcon = up ? ArrowUpRight : ArrowDownRight;
  const colorClass = up ? "text-emerald-500" : "text-destructive";

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            {quote.exchangeName ?? quote.instrumentType ?? "Equity"}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight mt-0.5">
            {quote.longName ?? quote.shortName ?? quote.symbol}
          </h1>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">{quote.symbol}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl sm:text-4xl tracking-tight">
            {formatCurrency(quote.regularMarketPrice, quote.currency)}
          </div>
          <div className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${colorClass}`}>
            <ChangeIcon className="size-4" />
            {formatNumber(quote.regularMarketChange, 2)} ({formatPercent(
              quote.regularMarketChangePercent,
              2,
            )})
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3 text-sm">
        <Metric label="Open" value={formatCurrency(quote.regularMarketOpen, quote.currency)} />
        <Metric label="Prev close" value={formatCurrency(quote.regularMarketPreviousClose, quote.currency)} />
        <Metric label="Day high" value={formatCurrency(quote.regularMarketDayHigh, quote.currency)} />
        <Metric label="Day low" value={formatCurrency(quote.regularMarketDayLow, quote.currency)} />
        <Metric label="52w high" value={formatCurrency(quote.fiftyTwoWeekHigh, quote.currency)} />
        <Metric label="52w low" value={formatCurrency(quote.fiftyTwoWeekLow, quote.currency)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({
  historical,
  loading,
  rangeIdx,
  onRangeChange,
}: {
  historical: HistoricalResult | null;
  loading: boolean;
  rangeIdx: number;
  onRangeChange: (idx: number) => void;
}) {
  const data = useMemo(() => {
    if (!historical) return [];
    return historical.points.map((p) => ({
      ts: new Date(p.date).getTime(),
      close: p.close,
    }));
  }, [historical]);

  const trend =
    data.length >= 2 && data[0].close != null && data[data.length - 1].close != null
      ? (data[data.length - 1].close as number) - (data[0].close as number)
      : 0;
  const lineColor = trend >= 0 ? "oklch(0.65 0.18 145)" : "oklch(0.62 0.21 25)";
  const fillColor = trend >= 0 ? "oklch(0.65 0.18 145 / 25%)" : "oklch(0.62 0.21 25 / 25%)";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <TrendingUp className="size-4 text-primary" />
          Price history
        </div>
        <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => onRangeChange(i)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition ${
                i === rangeIdx
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="financeArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={fillColor} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0 0 / 35%)" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                tick={{ fontSize: 11 }}
                stroke="oklch(0.6 0 0 / 70%)"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11 }}
                width={50}
                stroke="oklch(0.6 0 0 / 70%)"
                tickFormatter={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => new Date(v as number).toLocaleString()}
                formatter={(value: unknown) => [
                  Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }),
                  "Close",
                ]}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#financeArea)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CompanyInfo({
  quote,
  summary,
  aiAbout,
}: {
  quote: Quote | null;
  summary: SummaryResult | null;
  aiAbout: AiAboutResult | null;
}) {
  const profile = summary?.modules.assetProfile;
  const ai = aiAbout?.about;
  if (!profile && !ai && !quote) return null;

  // Merge: Yahoo wins, AI fills gaps.
  const sector = profile?.sector ?? ai?.sector ?? null;
  const industry = profile?.industry ?? ai?.industry ?? null;
  const country = profile?.country ?? ai?.country ?? null;
  const city = profile?.city ?? ai?.headquarters ?? null;
  const employees = profile?.fullTimeEmployees ?? ai?.employees ?? null;
  const website = profile?.website ?? ai?.website ?? null;
  const description = profile?.longBusinessSummary ?? ai?.description ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">About</h2>
        {!profile && ai && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> AI-generated
          </span>
        )}
      </div>
      <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
        <Metric label="Sector" value={sector ?? "—"} />
        <Metric label="Industry" value={industry ?? "—"} />
        <Metric label="Country" value={country ?? "—"} />
        <Metric label="HQ" value={city ?? "—"} />
        <Metric
          label="Employees"
          value={employees ? Number(employees).toLocaleString() : "—"}
        />
        <Metric label="Website" value={website ? "Open ↗" : "—"} />
      </div>
      {description && (
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{description}</p>
      )}
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          <ExternalLink className="size-3" />
        </a>
      )}
      {quote && (
        <div className="sr-only">Quote currency: {quote.currency}</div>
      )}
    </div>
  );
}

function AiOverviewSection({
  aiAbout,
  loading,
}: {
  aiAbout: AiAboutResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 h-32 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const a = aiAbout?.about;
  if (!a) return null;
  const segments = a.businessSegments ?? [];
  const products = a.products ?? [];
  const markets = a.majorMarkets ?? [];
  const competitors = a.competitors ?? [];
  const risks = a.risks ?? [];
  const opps = a.opportunities ?? [];
  const anyContent =
    segments.length || products.length || markets.length || competitors.length || risks.length || opps.length;
  if (!anyContent) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg inline-flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Aczen overview
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {aiAbout?.source === "mistral+apify" ? "AI + web sources" : "AI"}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        {segments.length > 0 && (
          <ChipBlock title="Business segments" items={segments} />
        )}
        {products.length > 0 && <ChipBlock title="Products & services" items={products} />}
        {markets.length > 0 && <ChipBlock title="Major markets" items={markets} />}
        {competitors.length > 0 && <ChipBlock title="Competitors" items={competitors} />}
        {opps.length > 0 && (
          <BulletBlock title="Opportunities" items={opps} accent="text-emerald-600" />
        )}
        {risks.length > 0 && (
          <BulletBlock title="Risks" items={risks} accent="text-destructive" />
        )}
      </div>
      {(a.ceo || a.founded) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {a.ceo && <span>CEO: <span className="text-foreground">{a.ceo}</span></span>}
          {a.founded && <span>Founded: <span className="text-foreground">{a.founded}</span></span>}
        </div>
      )}
    </div>
  );
}

function ChipBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center text-xs px-2.5 py-1 rounded-full border border-border bg-background text-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function BulletBlock({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-1.5 size-1.5 rounded-full ${accent ?? "bg-primary"} shrink-0`} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyStats({
  quote,
  summary,
  aiAbout,
}: {
  quote: Quote | null;
  summary: SummaryResult | null;
  aiAbout: AiAboutResult | null;
}) {
  const det = summary?.modules.summaryDetail;
  const fin = summary?.modules.financialData;
  const key = summary?.modules.defaultKeyStatistics;
  const aiMetrics = aiAbout?.about?.keyMetrics ?? [];

  // If Yahoo gave us nothing, render the AI metric cards instead so the section never blanks.
  if (!det && !fin && !key) {
    if (aiMetrics.length === 0) return null;
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">Key statistics</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> AI-generated
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          {aiMetrics.map((m, i) => (
            <Metric key={i} label={m.label} value={m.value || "—"} />
          ))}
        </div>
      </div>
    );
  }

  const marketCap = det?.marketCap ?? key?.enterpriseValue ?? null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg">Key statistics</h2>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 text-sm">
        <Metric label="Market cap" value={formatLargeNumber(marketCap)} />
        <Metric label="P/E (trailing)" value={formatNumber(det?.trailingPE ?? key?.trailingPE, 2)} />
        <Metric label="P/E (forward)" value={formatNumber(det?.forwardPE ?? key?.forwardPE, 2)} />
        <Metric label="PEG" value={formatNumber(key?.pegRatio, 2)} />
        <Metric label="P/B" value={formatNumber(key?.priceToBook, 2)} />
        <Metric
          label="Dividend yield"
          value={det?.dividendYield ? formatPercent((det.dividendYield ?? 0) * 100, 2) : "—"}
        />
        <Metric label="Beta" value={formatNumber(det?.beta, 2)} />
        <Metric label="Avg volume" value={formatLargeNumber(det?.averageVolume)} />
        <Metric label="Revenue (TTM)" value={formatLargeNumber(fin?.totalRevenue)} />
        <Metric
          label="Revenue growth"
          value={fin?.revenueGrowth ? formatPercent((fin.revenueGrowth ?? 0) * 100, 2) : "—"}
        />
        <Metric
          label="Profit margin"
          value={fin?.profitMargins ? formatPercent((fin.profitMargins ?? 0) * 100, 2) : "—"}
        />
        <Metric
          label="ROE"
          value={fin?.returnOnEquity ? formatPercent((fin.returnOnEquity ?? 0) * 100, 2) : "—"}
        />
        <Metric
          label="Target price"
          value={formatCurrency(fin?.targetMeanPrice ?? null, quote?.currency ?? null)}
        />
        <Metric label="Analyst rating" value={fin?.recommendationKey ?? "—"} />
        <Metric label="Shares out" value={formatLargeNumber(key?.sharesOutstanding)} />
        <Metric label="Float" value={formatLargeNumber(key?.floatShares)} />
      </div>
    </div>
  );
}

function Profile({ summary }: { summary: SummaryResult | null }) {
  const fin = summary?.modules.financialData;
  if (!fin) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg">Margins</h2>
      <div className="mt-3 grid sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <Metric
          label="Gross margin"
          value={fin.grossMargins ? formatPercent((fin.grossMargins ?? 0) * 100, 2) : "—"}
        />
        <Metric
          label="Operating margin"
          value={fin.operatingMargins ? formatPercent((fin.operatingMargins ?? 0) * 100, 2) : "—"}
        />
        <Metric
          label="Profit margin"
          value={fin.profitMargins ? formatPercent((fin.profitMargins ?? 0) * 100, 2) : "—"}
        />
      </div>
    </div>
  );
}

function NewsSection({
  news,
  loading,
  aiAbout,
}: {
  news: NewsItem[];
  loading: boolean;
  aiAbout: AiAboutResult | null;
}) {
  const aiNews = aiAbout?.about?.recentNews ?? [];
  const showAiFallback = !loading && news.length === 0 && aiNews.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Newspaper className="size-4 text-primary" />
          Latest news
        </div>
        {showAiFallback && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> AI-curated
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : news.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {news.map((n) => (
            <NewsCard key={n.uuid ?? n.link ?? n.title} item={n} />
          ))}
        </div>
      ) : aiNews.length > 0 ? (
        <ul className="space-y-3">
          {aiNews.map((n, i) => (
            <li key={i} className="rounded-xl border border-border bg-background p-3">
              <div className="text-sm font-medium text-foreground">{n.headline}</div>
              {n.summary && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{n.summary}</p>
              )}
              <div className="mt-2 text-[11px] text-muted-foreground">
                {[n.source, n.date].filter(Boolean).join(" · ") || "—"}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">No news for this symbol.</div>
      )}
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const [imgSrc, setImgSrc] = useState(item.thumbnail);
  const when = item.publishedAt ? timeAgo(item.publishedAt) : null;
  return (
    <a
      href={item.link ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-xl border border-border bg-background hover:border-primary/40 transition"
    >
      {imgSrc && (
        <div className="aspect-[16/9] overflow-hidden bg-accent/40 border-b border-border/60">
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgSrc(null)}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        </div>
      )}
      <div className="p-3.5">
        <div className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-2">
          {item.title}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{item.publisher ?? "—"}</span>
          {when && <span>· {when}</span>}
        </div>
      </div>
    </a>
  );
}

function EarningsSection({
  summary,
  currency,
}: {
  summary: SummaryResult | null;
  currency: string | null;
}) {
  const cal = summary?.modules.calendarEvents;
  const earn = summary?.modules.earnings;
  if (!cal && !earn) return null;
  const nextEarningsRaw = cal?.earnings?.earningsDate?.[0];
  const nextEarnings = nextEarningsRaw ? new Date(nextEarningsRaw * 1000) : null;
  const exDiv = cal?.exDividendDate ? new Date(cal.exDividendDate * 1000) : null;
  const divDate = cal?.dividendDate ? new Date(cal.dividendDate * 1000) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-4">
        <Calendar className="size-4 text-primary" />
        Earnings & calendar
      </div>
      <div className="grid sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <Metric
          label="Next earnings"
          value={nextEarnings ? nextEarnings.toLocaleDateString() : "—"}
        />
        <Metric
          label="EPS estimate"
          value={formatCurrency(cal?.earnings?.earningsAverage ?? null, currency)}
        />
        <Metric
          label="Revenue estimate"
          value={formatLargeNumber(cal?.earnings?.revenueAverage ?? null)}
        />
        <Metric label="Ex-dividend date" value={exDiv ? exDiv.toLocaleDateString() : "—"} />
        <Metric label="Dividend date" value={divDate ? divDate.toLocaleDateString() : "—"} />
        <Metric
          label="Current quarter EPS est."
          value={formatCurrency(earn?.earningsChart?.currentQuarterEstimate ?? null, currency)}
        />
      </div>
      {earn?.earningsChart?.quarterly && earn.earningsChart.quarterly.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Recent quarterly EPS
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {earn.earningsChart.quarterly.map((q, i) => {
              const surprise =
                typeof q.actual === "number" && typeof q.estimate === "number"
                  ? q.actual - q.estimate
                  : 0;
              const beat = surprise > 0;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {q.date ?? "—"}
                  </div>
                  <div className="mt-0.5 text-sm font-medium tabular-nums">
                    {formatCurrency(q.actual ?? null, currency)}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    est {formatCurrency(q.estimate ?? null, currency)}
                  </div>
                  {typeof q.actual === "number" && typeof q.estimate === "number" && (
                    <div
                      className={`mt-1 text-[11px] font-medium tabular-nums ${
                        beat ? "text-emerald-500" : "text-destructive"
                      }`}
                    >
                      {beat ? "+" : ""}
                      {formatNumber(surprise, 2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalystSection({
  summary,
  currency,
}: {
  summary: SummaryResult | null;
  currency: string | null;
}) {
  const rec = summary?.modules.recommendationTrend?.trend ?? [];
  const upgrades = summary?.modules.upgradeDowngradeHistory?.history ?? [];
  const fin = summary?.modules.financialData;
  if (rec.length === 0 && upgrades.length === 0 && !fin) return null;
  const current = rec.find((r) => r.period === "0m") ?? rec[0];
  const total = current
    ? (current.strongBuy ?? 0) +
      (current.buy ?? 0) +
      (current.hold ?? 0) +
      (current.sell ?? 0) +
      (current.strongSell ?? 0)
    : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-4">
        <ThumbsUp className="size-4 text-primary" />
        Analyst ratings
      </div>
      <div className="grid sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
        <Metric
          label="Recommendation"
          value={fin?.recommendationKey?.replace(/_/g, " ") ?? "—"}
        />
        <Metric label="Mean (1=Buy, 5=Sell)" value={formatNumber(fin?.recommendationMean, 2)} />
        <Metric label="# of analysts" value={fin?.numberOfAnalystOpinions?.toString() ?? "—"} />
        <Metric label="Target mean" value={formatCurrency(fin?.targetMeanPrice ?? null, currency)} />
        <Metric label="Target high" value={formatCurrency(fin?.targetHighPrice ?? null, currency)} />
        <Metric label="Target low" value={formatCurrency(fin?.targetLowPrice ?? null, currency)} />
      </div>

      {current && total > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Current breakdown
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-background border border-border">
            <Segment label="Strong Buy" count={current.strongBuy ?? 0} total={total} color="bg-emerald-600" />
            <Segment label="Buy" count={current.buy ?? 0} total={total} color="bg-emerald-400" />
            <Segment label="Hold" count={current.hold ?? 0} total={total} color="bg-amber-400" />
            <Segment label="Sell" count={current.sell ?? 0} total={total} color="bg-orange-500" />
            <Segment label="Strong Sell" count={current.strongSell ?? 0} total={total} color="bg-destructive" />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <RatingLegend dot="bg-emerald-600" label="Strong Buy" count={current.strongBuy ?? 0} />
            <RatingLegend dot="bg-emerald-400" label="Buy" count={current.buy ?? 0} />
            <RatingLegend dot="bg-amber-400" label="Hold" count={current.hold ?? 0} />
            <RatingLegend dot="bg-orange-500" label="Sell" count={current.sell ?? 0} />
            <RatingLegend dot="bg-destructive" label="Strong Sell" count={current.strongSell ?? 0} />
          </div>
        </div>
      )}

      {upgrades.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Recent rating changes
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-12 px-3 py-2 bg-accent/40 text-[11px] font-medium text-muted-foreground uppercase">
              <div className="col-span-3">Date</div>
              <div className="col-span-4">Firm</div>
              <div className="col-span-3">Change</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            <ul className="divide-y divide-border/60">
              {upgrades.slice(0, 8).map((u, i) => (
                <li key={i} className="grid grid-cols-12 px-3 py-2 text-xs items-center">
                  <div className="col-span-3 text-muted-foreground">
                    {u.epochGradeDate
                      ? new Date(u.epochGradeDate * 1000).toLocaleDateString()
                      : "—"}
                  </div>
                  <div className="col-span-4 truncate">{u.firm ?? "—"}</div>
                  <div className="col-span-3 text-muted-foreground truncate">
                    {u.fromGrade ? `${u.fromGrade} → ${u.toGrade ?? "?"}` : (u.toGrade ?? "—")}
                  </div>
                  <div className="col-span-2 text-right capitalize text-muted-foreground">
                    {u.action ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Segment({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  if (!count) return null;
  const pct = (count / total) * 100;
  return (
    <div
      className={`${color}`}
      style={{ width: `${pct}%` }}
      title={`${label}: ${count}`}
    />
  );
}

function RatingLegend({ dot, label, count }: { dot: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-sm ${dot}`} />
      {label} ({count})
    </span>
  );
}

function HoldersSection({ summary }: { summary: SummaryResult | null }) {
  const breakdown = summary?.modules.majorHoldersBreakdown;
  const insiders = summary?.modules.insiderHolders?.holders ?? [];
  if (!breakdown && insiders.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-4">
        <Users className="size-4 text-primary" />
        Ownership
      </div>
      {breakdown && (
        <div className="grid sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          <Metric
            label="Insider %"
            value={
              breakdown.insidersPercentHeld != null
                ? formatPercent(breakdown.insidersPercentHeld * 100, 2)
                : "—"
            }
          />
          <Metric
            label="Institutions %"
            value={
              breakdown.institutionsPercentHeld != null
                ? formatPercent(breakdown.institutionsPercentHeld * 100, 2)
                : "—"
            }
          />
          <Metric
            label="Institutions of float %"
            value={
              breakdown.institutionsFloatPercentHeld != null
                ? formatPercent(breakdown.institutionsFloatPercentHeld * 100, 2)
                : "—"
            }
          />
          <Metric
            label="# of institutions"
            value={breakdown.institutionsCount?.toString() ?? "—"}
          />
        </div>
      )}
      {insiders.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Insider holders
          </div>
          <ul className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
            {insiders.slice(0, 8).map((h, i) => (
              <li
                key={i}
                className="px-3 py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                <div className="font-medium text-foreground">{h.name}</div>
                <div className="text-muted-foreground truncate">{h.relation}</div>
                {h.positionDirect != null && (
                  <div className="ml-auto text-muted-foreground tabular-nums">
                    {formatLargeNumber(h.positionDirect)} shares
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InsiderTransactionsSection({ summary }: { summary: SummaryResult | null }) {
  const txns = summary?.modules.insiderTransactions?.transactions ?? [];
  if (txns.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-4">
        <Building2 className="size-4 text-primary" />
        Insider transactions
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 bg-accent/40 text-[11px] font-medium text-muted-foreground uppercase">
          <div className="col-span-3">Date</div>
          <div className="col-span-4">Insider</div>
          <div className="col-span-3">Action</div>
          <div className="col-span-2 text-right">Shares</div>
        </div>
        <ul className="divide-y divide-border/60">
          {txns.slice(0, 10).map((t, i) => (
            <li key={i} className="grid grid-cols-12 px-3 py-2 text-xs items-center">
              <div className="col-span-3 text-muted-foreground">
                {t.startDate ? new Date(t.startDate * 1000).toLocaleDateString() : "—"}
              </div>
              <div className="col-span-4">
                <div className="font-medium truncate">{t.filerName ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t.filerRelation ?? ""}
                </div>
              </div>
              <div className="col-span-3 text-muted-foreground truncate">
                {t.transactionText ?? "—"}
              </div>
              <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                {t.shares ? formatLargeNumber(t.shares) : "—"}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilingsSection({ summary }: { summary: SummaryResult | null }) {
  const filings = summary?.modules.secFilings?.filings ?? [];
  if (filings.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-4">
        <FileText className="size-4 text-primary" />
        SEC filings
      </div>
      <ul className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
        {filings.slice(0, 10).map((f, i) => (
          <li key={i} className="px-3 py-2 text-xs flex items-center gap-3">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              {f.type ?? "—"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-foreground truncate">{f.title ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground">{f.date ?? "—"}</div>
            </div>
            {f.edgarUrl && (
              <a
                href={f.edgarUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Open
                <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface AskMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
}

function ChatBar({
  quote,
  summary,
  news,
}: {
  quote: Quote | null;
  summary: SummaryResult | null;
  news: NewsItem[];
}) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<AskMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const stockContext = useMemo(() => {
    if (!quote) return "";
    const profile = summary?.modules.assetProfile;
    const det = summary?.modules.summaryDetail;
    const fin = summary?.modules.financialData;
    const cal = summary?.modules.calendarEvents;
    const lines = [
      `Symbol: ${quote.symbol}`,
      `Name: ${quote.longName ?? quote.shortName ?? quote.symbol}`,
      `Exchange: ${quote.exchangeName ?? "—"}`,
      `Price: ${formatCurrency(quote.regularMarketPrice, quote.currency)} (${formatPercent(quote.regularMarketChangePercent, 2)})`,
      `Day range: ${formatCurrency(quote.regularMarketDayLow, quote.currency)} – ${formatCurrency(quote.regularMarketDayHigh, quote.currency)}`,
      `52w range: ${formatCurrency(quote.fiftyTwoWeekLow, quote.currency)} – ${formatCurrency(quote.fiftyTwoWeekHigh, quote.currency)}`,
      profile?.sector && `Sector: ${profile.sector}`,
      profile?.industry && `Industry: ${profile.industry}`,
      profile?.country && `HQ: ${profile.country}`,
      profile?.fullTimeEmployees && `Employees: ${profile.fullTimeEmployees.toLocaleString()}`,
      det?.marketCap && `Market cap: ${formatLargeNumber(det.marketCap)}`,
      det?.trailingPE && `P/E (trailing): ${formatNumber(det.trailingPE, 2)}`,
      det?.forwardPE && `P/E (forward): ${formatNumber(det.forwardPE, 2)}`,
      det?.dividendYield && `Dividend yield: ${formatPercent((det.dividendYield ?? 0) * 100, 2)}`,
      fin?.totalRevenue && `Revenue (TTM): ${formatLargeNumber(fin.totalRevenue)}`,
      fin?.revenueGrowth && `Revenue growth: ${formatPercent((fin.revenueGrowth ?? 0) * 100, 2)}`,
      fin?.profitMargins && `Profit margin: ${formatPercent((fin.profitMargins ?? 0) * 100, 2)}`,
      fin?.returnOnEquity && `ROE: ${formatPercent((fin.returnOnEquity ?? 0) * 100, 2)}`,
      fin?.recommendationKey && `Analyst rating: ${fin.recommendationKey}`,
      fin?.targetMeanPrice &&
        `Analyst target (mean): ${formatCurrency(fin.targetMeanPrice, quote.currency)}`,
      cal?.earnings?.earningsDate?.[0] &&
        `Next earnings: ${new Date(cal.earnings.earningsDate[0] * 1000).toLocaleDateString()}`,
    ].filter(Boolean);
    const newsBlock = news.slice(0, 6).map((n, i) => {
      const when = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : "";
      return `${i + 1}. ${n.title}${n.publisher ? ` — ${n.publisher}` : ""}${when ? ` (${when})` : ""}`;
    });
    if (newsBlock.length > 0) {
      lines.push("", "Recent news headlines:", ...newsBlock);
    }
    return lines.join("\n");
  }, [quote, summary, news]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setOpen(true);
    const next: AskMessage[] = [
      ...history,
      { role: "user", content: q },
      { role: "assistant", content: "", streaming: true },
    ];
    setHistory(next);
    setLoading(true);

    const apiHistory: ChatMessage[] = next
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    await streamChat(apiHistory, {
      useWeb: false,
      settings: {
        model: "mistral-large-latest",
        contextWindow: "16k",
        systemInstructions: `You are Aczen Finance Copilot. Answer questions about the stock below using the live data provided. Be concise and quantitative. If the user asks about something not present, say so. Do not give investment advice without a disclaimer.\n\nCurrent stock context:\n${stockContext}`,
        temperature: 0.4,
        maxTokens: 1024,
        reasoningEffort: "medium",
      },
      onDelta: (delta) => {
        setHistory((h) => {
          const copy = [...h];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + delta, streaming: true };
          }
          return copy;
        });
      },
      onDone: () => {
        setHistory((h) => {
          const copy = [...h];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, streaming: false };
          }
          return copy;
        });
        setLoading(false);
      },
      onError: (e) => {
        setHistory((h) => {
          const copy = [...h];
          copy[copy.length - 1] = { role: "assistant", content: e, error: true };
          return copy;
        });
        setLoading(false);
      },
    });
  };

  return (
    <div className="sticky bottom-0 border-t border-border/60 bg-background/95 backdrop-blur">
      {open && history.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 max-h-72 overflow-y-auto space-y-4">
          {history.map((m, i) => (
            <AskBubble key={i} msg={m} />
          ))}
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="rounded-2xl border border-border bg-card focus-within:border-primary/50 transition">
          <div className="flex items-center gap-2 px-3 py-2">
            <Sparkles className="size-4 text-primary shrink-0" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                quote
                  ? `Ask about ${quote.shortName ?? quote.symbol}…`
                  : "Ask about this stock…"
              }
              className="flex-1 bg-transparent outline-none text-sm py-1.5"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || loading}
              className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0"
              aria-label="Ask"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Answers use the live data shown above. Not investment advice.
        </p>
      </div>
    </div>
  );
}

function AskBubble({ msg }: { msg: AskMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-accent text-accent-foreground rounded-2xl rounded-tr-md px-3.5 py-2 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="size-7 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
        <Sparkles className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        {!msg.content && msg.streaming ? (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" />
            Thinking…
          </div>
        ) : msg.error ? (
          <div className="text-sm text-destructive whitespace-pre-wrap">{msg.content}</div>
        ) : (
          <Markdown>{msg.content}</Markdown>
        )}
      </div>
    </div>
  );
}
