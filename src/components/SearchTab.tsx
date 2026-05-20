import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, ExternalLink, Sparkles, Paperclip, Scale, Landmark, Banknote, Globe } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

type Domain = "all" | "legal" | "finance" | "banking";

interface Source { title: string; snippet: string; link: string }
interface ApiResult { domain?: string; answer: string; sources?: Source[] }

type Message =
  | { role: "user"; content: string; domain: Domain }
  | { role: "assistant"; content: string; domain?: string; sources?: Source[] }
  | { role: "assistant"; loading: true; content?: undefined };

const DOMAINS: { id: Domain; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "All", icon: Globe },
  { id: "legal", label: "Legal", icon: Scale },
  { id: "finance", label: "Finance", icon: Landmark },
  { id: "banking", label: "Banking", icon: Banknote },
];

const SUGGESTED = [
  { q: "GST on export of services in India", tag: "Finance" },
  { q: "RBI repo rate impact on home loans", tag: "Banking" },
  { q: "Section 138 NI Act cheque bounce", tag: "Legal" },
  { q: "SEBI SME IPO regulations 2024", tag: "Finance" },
  { q: "TDS rates for freelancers FY 2025-26", tag: "Finance" },
  { q: "IBC insolvency process timeline", tag: "Legal" },
];

export default function SearchTab() {
  const [input, setInput] = useState("");
  const [domain, setDomain] = useState<Domain>("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setMessages((m) => [...m, { role: "user", content: q, domain }, { role: "assistant", loading: true }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, domain }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ApiResult;
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "assistant", content: data.answer, domain: data.domain, sources: data.sources },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="min-h-full flex flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-primary/10 text-primary mb-4">
                  <Sparkles className="size-6" />
                </div>
                <h1 className="font-display text-4xl md:text-5xl tracking-tight">
                  {greeting()}, what's on your mind?
                </h1>
                <p className="text-muted-foreground mt-3">
                  Ask anything about GST, RBI, SEBI, or Indian legal compliance.
                </p>
              </div>

              <Composer
                input={input}
                setInput={setInput}
                onKey={onKey}
                autoGrow={autoGrow}
                send={() => send(input)}
                loading={loading}
                domain={domain}
                setDomain={setDomain}
                taRef={taRef}
                large
              />

              <div className="mt-8">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 text-center">
                  Suggested
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s.q}
                      onClick={() => send(s.q)}
                      className="text-left px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/40 transition group"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">{s.tag}</div>
                      <div className="text-sm mt-0.5 text-foreground">{s.q}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {!empty && (
        <div className="border-t border-border/60 bg-background/80 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
            <Composer
              input={input}
              setInput={setInput}
              onKey={onKey}
              autoGrow={autoGrow}
              send={() => send(input)}
              loading={loading}
              domain={domain}
              setDomain={setDomain}
              taRef={taRef}
            />
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Aczen can make mistakes. Verify important compliance details.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-accent text-accent-foreground rounded-2xl rounded-tr-md px-4 py-3 text-[15px] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  if ("loading" in msg && msg.loading) {
    return (
      <div className="flex gap-3">
        <Avatar />
        <div className="flex items-center gap-2 text-muted-foreground text-sm pt-1.5">
          <Loader2 className="size-3.5 animate-spin" />
          Thinking…
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="flex-1 min-w-0 space-y-3">
        <div className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
          {msg.content}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="pt-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Sources</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {msg.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">{s.title}</div>
                    <ExternalLink className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.snippet}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="size-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
      <Sparkles className="size-4" />
    </div>
  );
}

interface ComposerProps {
  input: string;
  setInput: (v: string) => void;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoGrow: () => void;
  send: () => void;
  loading: boolean;
  domain: Domain;
  setDomain: (d: Domain) => void;
  taRef: React.RefObject<HTMLTextAreaElement | null>;
  large?: boolean;
}

function Composer({ input, setInput, onKey, autoGrow, send, loading, domain, setDomain, taRef, large }: ComposerProps) {
  return (
    <div className="rounded-3xl border border-border bg-card shadow-[0_4px_24px_-12px_rgba(0,0,0,0.15)] focus-within:border-primary/50 focus-within:shadow-[0_6px_28px_-10px_rgba(204,120,92,0.25)] transition">
      <textarea
        ref={taRef}
        value={input}
        onChange={(e) => { setInput(e.target.value); autoGrow(); }}
        onKeyDown={onKey}
        rows={1}
        placeholder="Ask about GST, RBI, legal compliance..."
        className={`w-full bg-transparent resize-none outline-none px-5 ${large ? "pt-5" : "pt-4"} pb-2 text-[15px] placeholder:text-muted-foreground`}
      />
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            className="p-2 rounded-lg text-muted-foreground hover:bg-accent shrink-0"
            aria-label="Attach"
          >
            <Paperclip className="size-4" />
          </button>
          <div className="flex items-center gap-1">
            {DOMAINS.map((d) => {
              const Icon = d.icon;
              const active = domain === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDomain(d.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition shrink-0 ${
                    active
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0"
          aria-label="Send"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
    </div>
  );
}