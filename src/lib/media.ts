import { MEDIA_FN_URL } from "./api";
import { supabase } from "./supabase";

async function authHeaders(extra: Record<string, string> = {}) {
  const { data } = await supabase.auth.getSession();
  const auth = data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
  return {
    Authorization: `Bearer ${auth}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    ...extra,
  };
}

export interface OcrResult {
  text: string;
  pages: { index: number; markdown: string }[];
  model: string;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export async function ocrFile(file: File): Promise<OcrResult> {
  if (!MEDIA_FN_URL) throw new Error("Media endpoint not configured");
  const dataUrl = await fileToDataUrl(file);
  const res = await fetch(`${MEDIA_FN_URL}?action=ocr`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ data_url: dataUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `OCR failed (${res.status})`);
  }
  return (await res.json()) as OcrResult;
}

export interface TranscribeResult {
  text: string;
  language: string | null;
  duration: number | null;
  model: string;
}

export async function transcribeAudio(
  blob: Blob,
  filename = "audio.webm",
  language = "",
): Promise<TranscribeResult> {
  if (!MEDIA_FN_URL) throw new Error("Media endpoint not configured");
  const form = new FormData();
  form.append("file", blob, filename);
  if (language) form.append("language", language);
  const res = await fetch(`${MEDIA_FN_URL}?action=transcribe`, {
    method: "POST",
    // Do NOT set Content-Type here — fetch sets the multipart boundary automatically.
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Transcribe failed (${res.status})`);
  }
  return (await res.json()) as TranscribeResult;
}

// Browser TTS using the Web Speech API. Returns a stop function.
export function speakText(text: string, opts: { lang?: string; rate?: number } = {}): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return () => {};
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = opts.lang ?? "en-US";
  utter.rate = opts.rate ?? 1;
  window.speechSynthesis.speak(utter);
  return () => window.speechSynthesis.cancel();
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}
