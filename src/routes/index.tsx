import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MessageSquarePlus,
  Sparkles,
  Code2,
  CreditCard,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import SearchTab from "@/components/SearchTab";
import DocsTab from "@/components/DocsTab";
import PricingTab from "@/components/PricingTab";
import QuotaChip from "@/components/QuotaChip";
import RecentsList from "@/components/RecentsList";
import AccountMenu from "@/components/AccountMenu";
import { useAuth, claimAnonymousChats, signInWithGoogle } from "@/lib/auth";
import type { ChatSettings } from "@/lib/chat";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  component: Index,
});

type TabId = "search" | "docs" | "pricing";

const NAV: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "search", label: "New chat", icon: MessageSquarePlus },
  { id: "docs", label: "API docs", icon: Code2 },
  { id: "pricing", label: "Pricing", icon: CreditCard },
];

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  model: "mistral-large-latest",
  contextWindow: "16k",
  systemInstructions: "",
  temperature: 0.5,
  maxTokens: 2048,
  reasoningEffort: "medium",
};

const MODEL_OPTIONS = [
  { value: "mistral-large-latest", label: "Aczen 1T" },
  { value: "mistral-medium-latest", label: "Aczen 2T" },
  { value: "mistral-small-latest", label: "Aczen 0T" },
  { value: "magistral-medium-latest", label: "Aczen 2TL" },
  { value: "codestral-latest", label: "Agent Code (N/A)" },
];

function loadChatSettings(): ChatSettings {
  if (typeof window === "undefined") return DEFAULT_CHAT_SETTINGS;
  try {
    const raw = window.localStorage.getItem("aczen-chat-settings");
    if (!raw) return DEFAULT_CHAT_SETTINGS;
    return { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CHAT_SETTINGS;
  }
}

function Index() {
  const [tab, setTab] = useState<TabId>("search");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings>(loadChatSettings);
  const [quotaTick, setQuotaTick] = useState(0);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [recentsRefresh, setRecentsRefresh] = useState(0);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  useEffect(() => {
    window.localStorage.setItem("aczen-chat-settings", JSON.stringify(chatSettings));
  }, [chatSettings]);

  const updateChatSettings = <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => {
    setChatSettings((current) => ({ ...current, [key]: value }));
  };

  // When a user signs in, claim their anonymous chats and refresh the list.
  useEffect(() => {
    if (!user) return;
    claimAnonymousChats(user).then((n) => {
      if (n > 0) setRecentsRefresh((r) => r + 1);
    });
  }, [user?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <SignInScreen dark={dark} onToggleTheme={() => setDark((d) => !d)} />;
  }

  const titles: Record<TabId, string> = {
    search: "Aczen",
    docs: "API documentation",
    pricing: "Plans & pricing",
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setTab("search");
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
              onClick={startNewChat}
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

          {settingsOpen ? (
            <ModelSettingsPanel
              settings={chatSettings}
              onChange={updateChatSettings}
              onReset={() => setChatSettings(DEFAULT_CHAT_SETTINGS)}
            />
          ) : (
            <>
              <div className="px-4 mt-2 mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Recents
              </div>
              <div className="px-2 flex-1 overflow-y-auto">
                <RecentsList
                  activeId={activeConvId}
                  refreshKey={recentsRefresh}
                  onSelect={(id) => {
                    setActiveConvId(id);
                    setTab("search");
                  }}
                  onChanged={() => setRecentsRefresh((r) => r + 1)}
                />
              </div>
            </>
          )}

          <div className="border-t border-sidebar-border p-2">
            <AccountMenu />
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
            <QuotaChip tick={quotaTick} onUpgrade={() => setTab("pricing")} />
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-md text-muted-foreground hover:bg-accent"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              onClick={() => {
                setSettingsOpen((open) => !open);
                setSidebarOpen(true);
              }}
              className={`p-2 rounded-md hover:bg-accent ${
                settingsOpen ? "text-primary bg-accent" : "text-muted-foreground"
              }`}
              aria-label="Toggle model settings"
            >
              <SlidersHorizontal className="size-4" />
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
          {tab === "search" && (
            <SearchTab
              onMessageSent={() => setQuotaTick((t) => t + 1)}
              activeConversationId={activeConvId}
              onConversationChange={setActiveConvId}
              onConversationListChanged={() => setRecentsRefresh((r) => r + 1)}
              settings={chatSettings}
            />
          )}
          {tab !== "search" && (
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
              {tab === "docs" && <DocsTab />}
              {tab === "pricing" && <PricingTab />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ModelSettingsPanel({
  settings,
  onChange,
  onReset,
}: {
  settings: ChatSettings;
  onChange: <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3">
      <div className="px-1 mt-2 mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Model settings
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Updates apply to the next send.</div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-sidebar-foreground"
        >
          Reset
        </button>
      </div>

      <div className="space-y-4">
        <Field label="Model">
          <Select value={settings.model} onValueChange={(v) => onChange("model", v)}>
            <SelectTrigger className="h-8 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Context window">
          <Select value={settings.contextWindow} onValueChange={(v) => onChange("contextWindow", v)}>
            <SelectTrigger className="h-8 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4k">4K</SelectItem>
              <SelectItem value="8k">8K</SelectItem>
              <SelectItem value="16k">16K</SelectItem>
              <SelectItem value="32k">32K</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="System instructions">
          <Textarea
            value={settings.systemInstructions}
            onChange={(e) => onChange("systemInstructions", e.target.value)}
            rows={5}
            placeholder="How should Aczen respond?"
            className="min-h-28 resize-none bg-background/50 text-sm"
          />
        </Field>

        <SliderField
          label="Temperature"
          value={settings.temperature}
          display={settings.temperature.toFixed(1)}
          min={0}
          max={1.5}
          step={0.1}
          onChange={(v) => onChange("temperature", v)}
        />

        <SliderField
          label="Max tokens"
          value={settings.maxTokens}
          display={settings.maxTokens.toLocaleString()}
          min={256}
          max={8192}
          step={256}
          onChange={(v) => onChange("maxTokens", v)}
        />

        <Field label="Reasoning effort">
          <Select
            value={settings.reasoningEffort}
            onValueChange={(v) => onChange("reasoningEffort", v as ChatSettings["reasoningEffort"])}
          >
            <SelectTrigger className="h-8 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function SignInScreen({
  dark,
  onToggleTheme,
}: {
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="h-14 px-3 sm:px-6 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg">Aczen</span>
        </div>
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 text-primary mb-5">
            <Sparkles className="size-7" />
          </div>
          <h1 className="font-display text-3xl tracking-tight">Welcome to Aczen</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to start chatting — your conversations are saved to your account
            so you can pick up where you left off.
          </p>

          <button
            onClick={signIn}
            disabled={signingIn}
            className="mt-7 w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/40 transition text-sm font-medium disabled:opacity-60"
          >
            {signingIn ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GoogleIcon className="size-4" />
            )}
            Continue with Google
          </button>

          {error && (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          )}

          <p className="mt-8 text-[11px] text-muted-foreground">
            By signing in, you agree to use Aczen for personal and educational use.
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-sidebar-foreground/80">{label}</Label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-sidebar-foreground/80">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  );
}
