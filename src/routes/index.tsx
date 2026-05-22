import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Sun,
  Moon,
  ArrowRight,
  Globe,
  WandSparkles,
  ShieldCheck,
  Code2,
  Zap,
  MessageSquare,
  LineChart,
} from "lucide-react";
import { useAuth, signInWithGoogle } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [dark, setDark] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  const goToChat = () => navigate({ to: "/chat" });

  const signIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed.");
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 h-14 px-4 sm:px-8 flex items-center justify-between border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg">Aczen</span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            to="/finance"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition"
          >
            <LineChart className="size-3.5" />
            Finance
          </Link>
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDark((d) => !d)}
            className="p-2 rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          {!loading && user ? (
            <button
              onClick={goToChat}
              className="text-sm bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-medium hover:opacity-90 transition inline-flex items-center gap-1.5"
            >
              Open chat
              <ArrowRight className="size-3.5" />
            </button>
          ) : (
            <button
              onClick={signIn}
              disabled={signingIn}
              className="text-sm bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {signingIn ? "Signing in…" : "Sign in"}
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-24 size-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -top-20 right-0 size-80 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="size-3" />
              aczenai-32k · now in preview
            </span>
            <h1 className="mt-5 font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-tight">
              The AI assistant built for{" "}
              <span className="text-primary">Indian work</span>.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl">
              Aczen answers anything — code, writing, math — with deeper expertise on Indian
              legal, finance, and banking. Web-grounded sources, visual artifacts, and a 32K
              context window.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {user ? (
                <button
                  onClick={goToChat}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition"
                >
                  Open chat
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  onClick={signIn}
                  disabled={signingIn}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-60"
                >
                  {signingIn ? "Signing in…" : "Start chatting — it's free"}
                  <ArrowRight className="size-4" />
                </button>
              )}
              <a
                href="#features"
                className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 rounded-xl font-medium hover:border-primary/40 hover:text-primary transition"
              >
                See what it does
              </a>
            </div>
            {authError && (
              <p className="mt-3 text-xs text-destructive">{authError}</p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                Sign in with Google
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-3.5 text-primary" />
                Streaming responses
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-3.5 text-primary" />
                Live web sources
              </span>
            </div>
          </div>
          <HeroMockup />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
            Built for real work, not demos
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every chat is saved, sharable, and grounded in fresh information when you need it.
          </p>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feature
            icon={Globe}
            title="Fresh web sources"
            body="Toggle Web and Aczen pulls live results from across the internet, then cites them inline so you can verify."
          />
          <Feature
            icon={WandSparkles}
            title="Visual artifacts"
            body="Turn any explanation into a clean SVG diagram — flows, architectures, comparisons — with one click."
          />
          <Feature
            icon={MessageSquare}
            title="Chats that stick"
            body="Conversations save to your account and rise to the top of your recents as you reply."
          />
          <Feature
            icon={ShieldCheck}
            title="Indian expertise"
            body="GST, SEBI, RBI, TDS / TCS, NI Act — Aczen knows the local regulations and case context."
          />
          <Feature
            icon={Code2}
            title="Developer-ready"
            body={`Drop in the @aczenai/32k SDK and stream completions from Node, Deno, Bun, or the browser.`}
          />
          <Feature
            icon={Zap}
            title="32K context"
            body="Long documents, multi-turn debugging, sprawling code reviews — Aczen keeps the thread."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border/60 bg-card/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
              From question to answer in three steps
            </h2>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            <Step
              n={1}
              title="Ask anything"
              body="Type a question, paste a doc, or pick a suggestion. Add Web to ground the answer in fresh sources."
            />
            <Step
              n={2}
              title="Stream the answer"
              body="Tokens stream in real time, with sources and code blocks formatted cleanly as they arrive."
            />
            <Step
              n={3}
              title="Iterate or share"
              body="Generate an artifact, share a read-only link, or come back later — your history is saved."
            />
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight">
            Free to try. Pay only when you scale.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Twenty messages a day on the house. Upgrade for unlimited use, faster models, and
            API access.
          </p>
          <div className="mt-7">
            {user ? (
              <button
                onClick={goToChat}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition"
              >
                Open chat
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                onClick={signIn}
                disabled={signingIn}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {signingIn ? "Signing in…" : "Sign in and start"}
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="size-3.5 text-primary-foreground" />
            </div>
            <span className="font-display text-sm text-foreground">Aczen</span>
            <span className="ml-2">© {new Date().getFullYear()} Aczen Intelligence</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/chat" className="hover:text-foreground transition">Chat</Link>
            <Link to="/finance" className="hover:text-foreground transition">Finance</Link>
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition">
      <div className="inline-flex items-center justify-center size-9 rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <h3 className="mt-4 font-display text-lg">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="text-xs font-semibold text-primary">Step {n}</div>
      <h3 className="mt-2 font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-2xl -z-10" />
      <div className="rounded-2xl border border-border bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="h-9 px-3 flex items-center gap-1.5 border-b border-border/60 bg-background/60">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-3 text-[11px] text-muted-foreground">aczen.ai / chat</span>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-accent text-accent-foreground px-3.5 py-2 text-[13px]">
              Summarise Section 138 of the NI Act for a cheque bounce notice.
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="size-7 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles className="size-3.5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="text-[13px] leading-relaxed text-foreground">
                Section 138 makes cheque dishonour a criminal offence when the cheque is
                returned for insufficient funds or because it exceeds the arrangement with the
                bank…
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-md border border-border bg-background px-2.5 py-2">
                  <div className="aspect-[16/9] rounded bg-gradient-to-br from-primary/30 to-primary/5 mb-2" />
                  <div className="text-[10px] text-muted-foreground">[1] indiacode.nic.in</div>
                </div>
                <div className="rounded-md border border-border bg-background px-2.5 py-2">
                  <div className="aspect-[16/9] rounded bg-gradient-to-br from-amber-400/30 to-amber-400/5 mb-2" />
                  <div className="text-[10px] text-muted-foreground">[2] rbi.org.in</div>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[11px] text-primary px-2 py-1 rounded-md border border-primary/30 bg-primary/10 mt-1">
                <WandSparkles className="size-3" />
                Generate artifact
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
