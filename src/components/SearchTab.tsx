import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  ExternalLink,
  Sparkles,
  Paperclip,
  Globe,
  Square,
  Share2,
  Check,
  Copy,
  WandSparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  generateArtifact,
  streamChat,
  type ChatArtifact,
  type ChatMessage,
  type ChatSettings,
  type ChatSource,
} from "@/lib/chat";
import { ocrFile, transcribeAudio, isTtsSupported } from "@/lib/media";
import Markdown from "@/components/Markdown";
import {
  appendMessage,
  createConversation,
  ensureShareToken,
  listMessages,
  shareUrl,
  type Conversation,
} from "@/lib/conversations";

interface UiMessage {
  role: "user" | "assistant" | "artifact";
  content: string;
  sources?: ChatSource[];
  artifact?: ChatArtifact;
  streaming?: boolean;
  error?: boolean;
  webRequested?: boolean;
}

const ARTIFACT_PREFIX = "__ACZEN_ARTIFACT__";

function encodeArtifact(artifact: ChatArtifact) {
  return `${ARTIFACT_PREFIX}${JSON.stringify(artifact)}`;
}

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

function shouldOfferArtifact(content: string) {
  if (content.length < 260) return false;
  return /concept|architecture|flow|process|pipeline|algorithm|system|network|token|bucket|queue|cache|database|auth|rate|compare|difference|workflow|lifecycle|diagram|visual/i.test(
    content,
  );
}

const SUGGESTED = [
  { q: "Explain GST input tax credit in simple terms", tag: "Finance" },
  { q: "Write a Python script to dedupe a CSV by email", tag: "Code" },
  { q: "Draft an email asking for a salary review", tag: "Writing" },
  { q: "RBI repo rate impact on home loan EMIs", tag: "Banking" },
  { q: "Summarize Section 138 NI Act cheque bounce", tag: "Legal" },
  { q: "What's the difference between TDS and TCS?", tag: "Tax" },
];

interface SearchTabProps {
  onMessageSent?: () => void;
  activeConversationId: string | null;
  onConversationChange: (id: string | null) => void;
  onConversationListChanged: () => void;
  settings: ChatSettings;
}

export default function SearchTab({
  onMessageSent,
  activeConversationId,
  onConversationChange,
  onConversationListChanged,
  settings,
}: SearchTabProps) {
  const [input, setInput] = useState("");
  const [useWeb, setUseWeb] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const convIdRef = useRef<string | null>(activeConversationId);
  // Tracks the conversation whose messages are currently rendered. When we
  // create a conversation inside send() we set this to the new id so the
  // effect below skips re-fetching and clobbering the in-flight stream.
  const loadedConvIdRef = useRef<string | null>(activeConversationId);

  useEffect(() => {
    convIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    let cancelled = false;
    if (!activeConversationId) {
      loadedConvIdRef.current = null;
      setMessages([]);
      setActiveConv(null);
      return;
    }
    if (loadedConvIdRef.current === activeConversationId) return;
    loadedConvIdRef.current = activeConversationId;
    (async () => {
      const stored = await listMessages(activeConversationId);
      if (cancelled || loadedConvIdRef.current !== activeConversationId) return;
      setMessages(
        stored
          .filter((m) => m.role !== "system")
          .map((m) => {
            const artifact = decodeArtifact(m.content);
            if (artifact) {
              return {
                role: "artifact",
                content: "",
                artifact,
              } satisfies UiMessage;
            }
            return {
              role: m.role as "user" | "assistant",
              content: m.content,
              sources: m.sources ?? undefined,
            } satisfies UiMessage;
          }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

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

    let convId = convIdRef.current;
    if (!convId) {
      const created = await createConversation(q);
      if (!created) {
        setMessages((m) => [
          ...m,
          { role: "user", content: q },
          {
            role: "assistant",
            content: "Could not create a chat session. Check Supabase config.",
            error: true,
          },
        ]);
        return;
      }
      convId = created.id;
      convIdRef.current = convId;
      // Mark as already loaded so the load effect below doesn't race with the
      // streaming response and overwrite the in-memory messages.
      loadedConvIdRef.current = convId;
      setActiveConv(created);
      onConversationChange(convId);
      onConversationListChanged();
    }

    const nextHistory: UiMessage[] = [
      ...messages,
      { role: "user", content: q },
      { role: "assistant", content: "", streaming: true, webRequested: useWeb },
    ];
    setMessages(nextHistory);
    setLoading(true);

    // Persist the user turn immediately so it's safe even if the assistant
    // stream is aborted.
    appendMessage(convId, "user", q).catch(() => {});

    const apiHistory: ChatMessage[] = nextHistory
      .slice(0, -1)
      .filter((m) => m.role !== "artifact")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    let finalSources: ChatSource[] | undefined;
    let finalContent = "";

    await streamChat(apiHistory, {
      useWeb,
      settings,
      signal: controller.signal,
      onSources: (sources) => {
        finalSources = sources;
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, sources };
          }
          return copy;
        });
      },
      onDelta: (delta) => {
        finalContent += delta;
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              content: last.content + delta,
              streaming: true,
            };
          }
          return copy;
        });
      },
      onDone: async () => {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, streaming: false };
          }
          return copy;
        });
        setLoading(false);
        abortRef.current = null;
        if (convId && finalContent) {
          appendMessage(convId, "assistant", finalContent, finalSources).then(
            () => onConversationListChanged(),
          );
        }
        onMessageSent?.();
      },
      onError: (err) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: err,
            error: true,
          };
          return copy;
        });
        setLoading(false);
        abortRef.current = null;
        onMessageSent?.();
      },
    });
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant" && last.streaming) {
        copy[copy.length - 1] = { ...last, streaming: false };
      }
      return copy;
    });
  };

  const onPickFile = () => {
    if (ocrLoading || loading) return;
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setOcrError(null);
    setOcrLoading(true);
    try {
      const result = await ocrFile(file);
      const extracted = result.text.trim();
      if (!extracted) {
        setOcrError("No text could be extracted from the file.");
        return;
      }
      const block = `Content from ${file.name}:\n\n${extracted}\n\n`;
      setInput((prev) => (prev ? `${prev}\n\n${block}` : block));
      // Resize the textarea so the user can see the inserted text.
      requestAnimationFrame(() => autoGrow());
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrLoading(false);
    }
  };

  const startRecording = async () => {
    if (recording || transcribing || loading) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const ext = (recorder.mimeType.split("/")[1] ?? "webm").split(";")[0];
          const result = await transcribeAudio(blob, `voice.${ext}`);
          const text = result.text.trim();
          if (text) {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
            requestAnimationFrame(() => autoGrow());
          }
        } catch (err) {
          setOcrError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setOcrError("Could not access microphone. Allow it in your browser settings.");
    }
  };

  const stopRecording = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  const createArtifact = async (afterIndex: number) => {
    if (loading) return;
    const target = messages[afterIndex];
    if (!target || target.role !== "assistant" || target.error || target.streaming) return;

    const apiHistory: ChatMessage[] = messages
      .slice(0, afterIndex + 1)
      .filter((m) => m.role !== "artifact")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const loadingArtifact: UiMessage = {
      role: "artifact",
      content: "",
      streaming: true,
    };
    setMessages((current) => [
      ...current.slice(0, afterIndex + 1),
      loadingArtifact,
      ...current.slice(afterIndex + 1),
    ]);

    try {
      const artifact = await generateArtifact(apiHistory, target.content, settings);
      setMessages((current) => {
        const copy = [...current];
        const idx = copy.findIndex((m, i) => i > afterIndex && m.role === "artifact" && m.streaming);
        if (idx !== -1) {
          copy[idx] = { role: "artifact", content: "", artifact };
        }
        return copy;
      });
      if (convIdRef.current) {
        appendMessage(convIdRef.current, "assistant", encodeArtifact(artifact)).then(() =>
          onConversationListChanged(),
        );
      }
      onMessageSent?.();
    } catch (e) {
      setMessages((current) => {
        const copy = [...current];
        const idx = copy.findIndex((m, i) => i > afterIndex && m.role === "artifact" && m.streaming);
        if (idx !== -1) {
          copy[idx] = {
            role: "artifact",
            content: e instanceof Error ? e.message : "Could not generate artifact.",
            error: true,
          };
        }
        return copy;
      });
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
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={onFileChosen}
      />
      {!empty && activeConversationId && (
        <div className="border-b border-border/60 px-4 sm:px-6 py-2 flex items-center justify-end">
          <ShareButton
            conversationId={activeConversationId}
            initialToken={activeConv?.share_token ?? null}
          />
        </div>
      )}
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
                  Ask anything — code, writing, math, or Indian legal / finance / banking.
                </p>
              </div>

              <Composer
                input={input}
                setInput={setInput}
                onKey={onKey}
                autoGrow={autoGrow}
                send={() => send(input)}
                stop={stop}
                loading={loading}
                useWeb={useWeb}
                setUseWeb={setUseWeb}
                taRef={taRef}
                large
                onAttach={onPickFile}
                ocrLoading={ocrLoading}
                ocrError={ocrError}
                clearOcrError={() => setOcrError(null)}
                recording={recording}
                transcribing={transcribing}
                toggleRecording={toggleRecording}
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
                      <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                        {s.tag}
                      </div>
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
              <MessageBubble
                key={i}
                msg={m}
                onGenerateArtifact={
                  m.role === "assistant" && shouldOfferArtifact(m.content)
                    ? () => createArtifact(i)
                    : undefined
                }
              />
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
              stop={stop}
              loading={loading}
              useWeb={useWeb}
              setUseWeb={setUseWeb}
              taRef={taRef}
              onAttach={onPickFile}
              ocrLoading={ocrLoading}
              ocrError={ocrError}
              clearOcrError={() => setOcrError(null)}
              recording={recording}
              transcribing={transcribing}
              toggleRecording={toggleRecording}
            />
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Aczen can make mistakes. Verify important details.
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

function ShareButton({
  conversationId,
  initialToken,
}: {
  conversationId: string;
  initialToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setToken(initialToken);
  }, [initialToken, conversationId]);

  const share = async () => {
    setLoading(true);
    const t = await ensureShareToken(conversationId);
    setToken(t);
    setLoading(false);
    setOpen(true);
  };

  const url = token ? shareUrl(token) : "";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={share}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:text-primary transition disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Share2 className="size-3.5" />
        )}
        Share
      </button>
      {open && url && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-lg p-3 z-20"
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-xs text-muted-foreground mb-2">
            Anyone with this link can read this chat.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-background border border-border rounded-md px-2 py-1.5 text-xs font-mono outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onGenerateArtifact,
}: {
  msg: UiMessage;
  onGenerateArtifact?: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  // Cleanup TTS if this bubble unmounts while reading.
  useEffect(() => {
    return () => {
      if (speaking && typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, [speaking]);

  if (msg.role === "artifact") {
    return <ArtifactBubble msg={msg} />;
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
  const isEmpty = !msg.content && msg.streaming;
  const toggleSpeak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    // Strip markdown markers for a more natural read-aloud.
    const cleaned = msg.content.replace(/[#`*_~>]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };
  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="flex-1 min-w-0 space-y-3">
        {isEmpty ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm pt-1.5">
            <Loader2 className="size-3.5 animate-spin" />
            Thinking…
          </div>
        ) : msg.error ? (
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-destructive">
            {msg.content}
          </div>
        ) : (
          <div className="relative">
            <Markdown>{msg.content}</Markdown>
            {msg.streaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/70 align-middle animate-pulse" />
            )}
          </div>
        )}
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
        {msg.webRequested &&
          !msg.streaming &&
          !msg.error &&
          (!msg.sources || msg.sources.length === 0) && (
            <div className="pt-2">
              <div className="inline-flex items-start gap-2 text-[11px] text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5">
                <Globe className="size-3.5 text-amber-500 mt-px shrink-0" />
                <span>
                  Web search returned no sources. The answer above is unsourced — set{" "}
                  <code className="font-mono">APIFY_TOKEN</code> in your Supabase function
                  secrets to enable web grounding.
                </span>
              </div>
            </div>
          )}
        {!msg.streaming && !msg.error && msg.content && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isTtsSupported() && (
              <button
                type="button"
                onClick={toggleSpeak}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                  speaking
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
                title={speaking ? "Stop reading" : "Read aloud"}
              >
                {speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                {speaking ? "Stop" : "Read aloud"}
              </button>
            )}
            {onGenerateArtifact && (
              <button
                type="button"
                onClick={onGenerateArtifact}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary transition"
              >
                <WandSparkles className="size-3.5" />
                Generate artifact
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceCard({ source, index }: { source: ChatSource; index: number }) {
  const [imgSrc, setImgSrc] = useState(source.imageUrl ?? faviconFor(source.link));
  const [failed, setFailed] = useState(false);
  return (
    <a
      href={source.link}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-lg border border-border bg-card hover:border-primary/40 transition group"
    >
      {imgSrc && !failed && (
        <div className="aspect-[16/9] overflow-hidden bg-accent/50 border-b border-border/60">
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => {
              // Try the favicon as a fallback. If that also fails, hide the box.
              const fallback = faviconFor(source.link);
              if (fallback && fallback !== imgSrc) setImgSrc(fallback);
              else setFailed(true);
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
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{source.snippet}</p>
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

function faviconFor(link: string): string | undefined {
  try {
    const host = new URL(link).hostname;
    return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(host)}`;
  } catch {
    return undefined;
  }
}

function ArtifactBubble({ msg }: { msg: UiMessage }) {
  if (msg.streaming) {
    return (
      <div className="flex gap-3">
        <Avatar />
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          Generating visual artifact...
        </div>
      </div>
    );
  }

  if (msg.error || !msg.artifact) {
    return (
      <div className="flex gap-3">
        <Avatar />
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-destructive">
          {msg.content || "Could not generate artifact."}
        </div>
      </div>
    );
  }

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fbfaf7;color:#222;font-family:Inter,system-ui,sans-serif}svg{display:block;width:100%;height:auto}</style></head><body>${msg.artifact.svg}</body></html>`;

  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
          <WandSparkles className="size-3.5 text-primary" />
          <div className="text-sm font-medium truncate">{msg.artifact.title}</div>
        </div>
        <iframe
          title={msg.artifact.title}
          sandbox=""
          srcDoc={srcDoc}
          className="w-full h-[420px] bg-white"
        />
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
  stop: () => void;
  loading: boolean;
  useWeb: boolean;
  setUseWeb: (v: boolean) => void;
  taRef: React.RefObject<HTMLTextAreaElement | null>;
  large?: boolean;
  onAttach: () => void;
  ocrLoading: boolean;
  ocrError: string | null;
  clearOcrError: () => void;
  recording: boolean;
  transcribing: boolean;
  toggleRecording: () => void;
}

function Composer({
  input,
  setInput,
  onKey,
  autoGrow,
  send,
  stop,
  loading,
  useWeb,
  setUseWeb,
  taRef,
  large,
  onAttach,
  ocrLoading,
  ocrError,
  clearOcrError,
  recording,
  transcribing,
  toggleRecording,
}: ComposerProps) {
  return (
    <div className="rounded-3xl border border-border bg-card shadow-[0_4px_24px_-12px_rgba(0,0,0,0.15)] focus-within:border-primary/50 focus-within:shadow-[0_6px_28px_-10px_rgba(204,120,92,0.25)] transition">
      {(ocrLoading || transcribing || recording || ocrError) && (
        <div className="px-5 pt-3 -mb-1">
          {ocrLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary">
              <Loader2 className="size-3 animate-spin" />
              Extracting text from file…
            </span>
          )}
          {transcribing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary">
              <Loader2 className="size-3 animate-spin" />
              Transcribing audio…
            </span>
          )}
          {recording && !transcribing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
              <span className="size-2 rounded-full bg-destructive animate-pulse" />
              Recording — tap mic again to stop
            </span>
          )}
          {ocrError && (
            <span
              className="inline-flex items-center gap-2 text-xs text-destructive cursor-pointer"
              onClick={clearOcrError}
              title="Dismiss"
            >
              {ocrError}
            </span>
          )}
        </div>
      )}
      <textarea
        ref={taRef}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          autoGrow();
        }}
        onKeyDown={onKey}
        rows={1}
        placeholder="Ask anything…"
        className={`w-full bg-transparent resize-none outline-none px-5 ${large ? "pt-5" : "pt-4"} pb-2 text-[15px] placeholder:text-muted-foreground`}
      />
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={onAttach}
            disabled={ocrLoading || loading}
            className="p-2 rounded-lg text-muted-foreground hover:bg-accent shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Attach file (OCR)"
            title="Attach a PDF or image — Mistral OCR will extract text"
          >
            {ocrLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={transcribing || loading}
            className={`p-2 rounded-lg shrink-0 transition disabled:opacity-50 disabled:cursor-not-allowed ${
              recording
                ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
                : "text-muted-foreground hover:bg-accent"
            }`}
            aria-label={recording ? "Stop recording" : "Record voice"}
            title={recording ? "Stop recording" : "Record voice — Mistral Voxtral will transcribe"}
          >
            {transcribing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : recording ? (
              <MicOff className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setUseWeb(!useWeb)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition shrink-0 ${
              useWeb
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-transparent border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Ground answer in fresh web sources"
          >
            <Globe className="size-3.5" />
            Web
          </button>
        </div>
        {loading ? (
          <button
            type="button"
            onClick={stop}
            className="size-9 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition shrink-0"
            aria-label="Stop"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={!input.trim()}
            className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
