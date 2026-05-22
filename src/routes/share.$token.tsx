import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ExternalLink, Loader2, ArrowLeft, WandSparkles } from "lucide-react";
import Markdown from "@/components/Markdown";
import {
  getConversationByShareToken,
  listMessages,
  type Conversation,
  type StoredMessage,
} from "@/lib/conversations";
import type { ChatArtifact, ChatSource } from "@/lib/chat";

export const Route = createFileRoute("/share/$token")({
  component: SharedConversation,
});

const ARTIFACT_PREFIX = "__ACZEN_ARTIFACT__";

function decodeArtifact(content: string): ChatArtifact | null {
  if (!content.startsWith(ARTIFACT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(ARTIFACT_PREFIX.length));
    if (typeof parsed.title === "string" && typeof parsed.svg === "string") return parsed;
  } catch {
    return null;
  }
  return null;
}

function SharedConversation() {
  const { token } = Route.useParams();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      const c = await getConversationByShareToken(token);
      if (cancelled) return;
      if (!c) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setConv(c);
      const m = await listMessages(c.id);
      if (cancelled) return;
      setMessages(m.filter((x) => x.role !== "system"));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !conv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl">Chat not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This share link is invalid or was revoked by the owner.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90"
          >
            <ArrowLeft className="size-4" />
            Go to Aczen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-border/60 sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg">Aczen</span>
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
            · shared chat
          </span>
        </div>
        <Link
          to="/chat"
          className="text-sm bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg font-medium hover:opacity-90 transition"
        >
          Try Aczen
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 pb-4 border-b border-border/60">
          <h1 className="font-display text-2xl tracking-tight">
            {conv.title ?? "Shared chat"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Shared on {new Date(conv.updated_at).toLocaleString()} · read-only snapshot
          </p>
        </div>

        <div className="space-y-8">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This chat has no messages yet.
            </p>
          )}
          {messages.map((m) => (
            <SharedBubble key={m.id} msg={m} />
          ))}
        </div>
      </main>
    </div>
  );
}

function SharedBubble({ msg }: { msg: StoredMessage }) {
  const artifact = decodeArtifact(msg.content);
  if (artifact) {
    return <SharedArtifact artifact={artifact} />;
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-accent text-accent-foreground rounded-2xl rounded-tr-md px-4 py-3 text-[15px] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="size-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
        <Sparkles className="size-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <Markdown>{msg.content}</Markdown>
        {msg.sources && msg.sources.length > 0 && (
          <div className="pt-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Web sources
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {msg.sources.map((s, i) => (
                <SourceCard key={i} source={s} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceCard({ source, index }: { source: ChatSource; index: number }) {
  return (
    <a
      href={source.link}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-lg border border-border bg-card hover:border-primary/40 transition group"
    >
      {source.imageUrl && (
        <div className="aspect-[16/9] overflow-hidden bg-accent/50 border-b border-border/60">
          <img
            src={source.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.parentElement?.classList.add("hidden");
            }}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-2">
            [{index + 1}] {source.title}
          </div>
          <ExternalLink className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {source.snippet}
        </p>
        <div className="mt-2 text-[11px] text-muted-foreground truncate">
          {source.siteName || safeHost(source.link)}
        </div>
      </div>
    </a>
  );
}

function safeHost(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

function SharedArtifact({ artifact }: { artifact: ChatArtifact }) {
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fbfaf7;color:#222;font-family:Inter,system-ui,sans-serif}svg{display:block;width:100%;height:auto}</style></head><body>${artifact.svg}</body></html>`;

  return (
    <div className="flex gap-3">
      <div className="size-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
        <Sparkles className="size-4" />
      </div>
      <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
          <WandSparkles className="size-3.5 text-primary" />
          <div className="text-sm font-medium truncate">{artifact.title}</div>
        </div>
        <iframe title={artifact.title} sandbox="" srcDoc={srcDoc} className="w-full h-[420px] bg-white" />
      </div>
    </div>
  );
}
