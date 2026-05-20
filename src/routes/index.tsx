import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, FileText, Code2, CreditCard } from "lucide-react";
import SearchTab from "@/components/SearchTab";
import LetterTab from "@/components/LetterTab";
import DocsTab from "@/components/DocsTab";
import PricingTab from "@/components/PricingTab";

export const Route = createFileRoute("/")({
  component: Index,
});

type TabId = "search" | "letter" | "docs" | "pricing";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "letter", label: "Letter Generator", icon: FileText },
  { id: "docs", label: "API Docs", icon: Code2 },
  { id: "pricing", label: "Pricing", icon: CreditCard },
];

function Index() {
  const [tab, setTab] = useState<TabId>("search");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 size-[400px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-30 bg-background/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground">A</span>
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-base font-semibold">Aczen Intelligence</h1>
              <p className="text-[11px] text-muted-foreground">Legal · Finance · Banking</p>
            </div>
          </div>
          <a
            href="#pricing"
            onClick={(e) => { e.preventDefault(); setTab("pricing"); }}
            className="hidden sm:inline-flex text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition"
          >
            Get API Key
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-20">
        {tab === "search" && (
          <section className="mb-8 text-center">
            <h2 className="font-display text-3xl md:text-5xl tracking-tight">
              Intelligence for India's <span className="text-primary">regulated</span> stack.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Search compliance, draft legal letters, and ship with our API — across GST, RBI, SEBI, and more.
            </p>
          </section>
        )}

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-card border border-border rounded-2xl p-1.5 gap-1 overflow-x-auto max-w-full">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_rgba(0,212,170,0.5)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {tab === "search" && <SearchTab />}
          {tab === "letter" && <LetterTab />}
          {tab === "docs" && <DocsTab />}
          {tab === "pricing" && <PricingTab />}
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aczen Intelligence · Built for India's compliance teams
      </footer>
    </div>
  );
}
