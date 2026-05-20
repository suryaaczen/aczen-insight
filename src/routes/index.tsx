import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MessageSquarePlus,
  Sparkles,
  FileText,
  Code2,
  CreditCard,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import SearchTab from "@/components/SearchTab";
import LetterTab from "@/components/LetterTab";
import DocsTab from "@/components/DocsTab";
import PricingTab from "@/components/PricingTab";

export const Route = createFileRoute("/")({
  component: Index,
});

type TabId = "search" | "letter" | "docs" | "pricing";

const NAV: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "search", label: "New chat", icon: MessageSquarePlus },
  { id: "letter", label: "Letters", icon: FileText },
  { id: "docs", label: "API docs", icon: Code2 },
  { id: "pricing", label: "Pricing", icon: CreditCard },
];

const RECENTS = [
  "GST on export of services",
  "RBI repo rate impact",
  "Section 138 cheque bounce",
  "SEBI SME IPO 2024",
];

function Index() {
  const [tab, setTab] = useState<TabId>("search");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  const titles: Record<TabId, string> = {
    search: "Aczen",
    letter: "Letter generator",
    docs: "API documentation",
    pricing: "Plans & pricing",
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } shrink-0 transition-[width] duration-300 ease-out overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground`}
      >
        <div className="w-64 h-full flex flex-col">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="size-7 rounded-md bg-primary flex items-center justify-center">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg leading-none">Aczen</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </div>

          <div className="px-3">
            <button
              onClick={() => setTab("search")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-sidebar-accent/60 hover:bg-sidebar-accent transition"
            >
              <MessageSquarePlus className="size-4 text-primary" />
              New chat
            </button>
          </div>

          <nav className="px-2 py-3 space-y-0.5">
            {NAV.slice(1).map((n) => {
              const Icon = n.icon;
              const active = tab === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>

          <div className="px-4 mt-2 mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            Recents
          </div>
          <div className="px-2 flex-1 overflow-y-auto space-y-0.5">
            {RECENTS.map((r) => (
              <button
                key={r}
                onClick={() => setTab("search")}
                className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground truncate"
              >
                {r}
              </button>
            ))}
          </div>

          <div className="border-t border-sidebar-border p-2">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
              <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-semibold">
                A
              </div>
              <span className="flex-1 text-left">Account</span>
              <Settings className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-3 sm:px-5 flex items-center justify-between border-b border-border/60">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Open sidebar"
              >
                <PanelLeft className="size-4" />
              </button>
            )}
            <span className="font-display text-lg">{titles[tab]}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-md text-muted-foreground hover:bg-accent"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              onClick={() => setTab("pricing")}
              className="hidden sm:inline-flex text-sm bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-medium hover:opacity-90 transition"
            >
              Upgrade
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {tab === "search" && <SearchTab />}
          {tab !== "search" && (
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
              {tab === "letter" && <LetterTab />}
              {tab === "docs" && <DocsTab />}
              {tab === "pricing" && <PricingTab />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
