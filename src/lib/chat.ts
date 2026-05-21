import { CHAT_FN_URL } from "./api";
import { supabase } from "./supabase";
import { getSessionId } from "./session";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatSource {
  title: string;
  snippet: string;
  link: string;
  imageUrl?: string;
  siteName?: string;
}

export interface ChatSettings {
  model: string;
  contextWindow: string;
  systemInstructions: string;
  temperature: number;
  maxTokens: number;
  reasoningEffort: "low" | "medium" | "high";
}

export interface ChatArtifact {
  title: string;
  svg: string;
}

export interface StreamHandlers {
  onDelta: (delta: string) => void;
  onSources?: (sources: ChatSource[]) => void;
  onDone?: () => void;
  onError?: (err: string) => void;
  signal?: AbortSignal;
}

export async function generateArtifact(
  messages: ChatMessage[],
  prompt: string,
  settings: ChatSettings,
): Promise<ChatArtifact> {
  if (!CHAT_FN_URL) {
    throw new Error("Supabase URL not configured. Set VITE_SUPABASE_URL in .env.local.");
  }

  const { data: session } = await supabase.auth.getSession();
  const authHeader = session.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  const res = await fetch(CHAT_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authHeader}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      "x-session-id": getSessionId(),
    },
    body: JSON.stringify({ artifact: true, artifactPrompt: prompt, messages, settings }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Artifact failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as ChatArtifact;
}

export async function streamChat(
  messages: ChatMessage[],
  opts: { useWeb?: boolean; settings?: ChatSettings } & StreamHandlers,
) {
  if (!CHAT_FN_URL) {
    opts.onError?.("Supabase URL not configured. Set VITE_SUPABASE_URL in .env.local.");
    return;
  }

  const { data: session } = await supabase.auth.getSession();
  const authHeader = session.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  let res: Response;
  try {
    res = await fetch(CHAT_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authHeader}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        "x-session-id": getSessionId(),
      },
      body: JSON.stringify({ messages, useWeb: !!opts.useWeb, settings: opts.settings }),
      signal: opts.signal,
    });
  } catch (e) {
    opts.onError?.(e instanceof Error ? e.message : String(e));
    return;
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    opts.onError?.(`Chat failed (${res.status}): ${text || res.statusText}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";

    for (const ev of events) {
      const lines = ev.split("\n");
      let eventName = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      if (eventName === "sources") {
        try {
          opts.onSources?.(JSON.parse(dataStr));
        } catch {
          /* ignore */
        }
      } else if (eventName === "done") {
        opts.onDone?.();
      } else if (eventName === "error") {
        try {
          const parsed = JSON.parse(dataStr);
          opts.onError?.(parsed.error ?? "Unknown error");
        } catch {
          opts.onError?.(dataStr);
        }
      } else {
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.delta) opts.onDelta(parsed.delta);
        } catch {
          /* ignore */
        }
      }
    }
  }
  opts.onDone?.();
}
