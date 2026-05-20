import { useState } from "react";
import { Search, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

type Domain = "all" | "legal" | "finance" | "banking";

interface Source {
  title: string;
  snippet: string;
  link: string;
}

interface SearchResult {
  domain?: string;
  answer: string;
  sources?: Source[];
}

const DOMAINS: { id: Domain; label: string }[] = [
  { id: "all", label: "All" },
  { id: "legal", label: "Legal" },
  { id: "finance", label: "Finance" },
  { id: "banking", label: "Banking" },
];

const SUGGESTED = [
  "GST on export of services in India",
  "RBI repo rate impact on home loans",
  "Section 138 NI Act cheque bounce",
  "SEBI SME IPO regulations 2024",
  "TDS rates for freelancers FY 2025-26",
  "IBC insolvency process timeline",
];

const DOMAIN_COLORS: Record<string, string> = {
  legal: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  finance: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  banking: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  all: "bg-primary/15 text-primary border-primary/30",
};

export default function SearchTab() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<Domain>("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, domain }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as SearchResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const badgeKey = (result?.domain || domain).toLowerCase();

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about GST, RBI, legal compliance..."
            className="w-full bg-card border border-border rounded-2xl pl-12 pr-32 py-5 text-base text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDomain(d.id)}
              className={`px-4 py-1.5 rounded-full text-sm border transition ${
                domain === d.id
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </form>

      {loading && (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3 animate-pulse">
          <Loader2 className="size-7 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Searching across {domain} sources…</p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-2xl p-5 text-destructive text-sm">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${DOMAIN_COLORS[badgeKey] || DOMAIN_COLORS.all}`}>
                {result.domain || domain}
              </span>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Sparkles className="size-3" /> AI Answer
              </span>
            </div>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{result.answer}</p>
          </div>

          {result.sources && result.sources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Sources</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {result.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition">{s.title}</h4>
                      <ExternalLink className="size-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{s.snippet}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="bg-card/50 border border-border rounded-2xl p-8">
          <h3 className="font-display text-lg text-foreground mb-1">Try a query</h3>
          <p className="text-sm text-muted-foreground mb-5">Tap any suggestion to get started.</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  runSearch(s);
                }}
                className="px-4 py-2 rounded-full text-sm bg-card border border-border text-foreground hover:border-primary/40 hover:text-primary transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}