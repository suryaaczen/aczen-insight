// Supabase Edge Function: media
// Mistral-backed OCR (documents/images) and audio transcription (Voxtral).
//
// Deploy:  supabase functions deploy media --no-verify-jwt
// Secrets: requires MISTRAL_API_KEY (already set for chat function)
//
// Actions:
//   POST ?action=ocr        body: { "data_url": "data:..." }  →  { text, pages }
//   POST ?action=transcribe body: multipart/form-data with "file" + optional "language"
//                                                            →  { text, language, duration }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

function err(status: number, message: string) {
  return json({ error: message }, { status });
}

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_TRANSCRIBE_URL = "https://api.mistral.ai/v1/audio/transcriptions";
const OCR_MODEL = Deno.env.get("MISTRAL_OCR_MODEL") ?? "mistral-ocr-latest";
const TRANSCRIBE_MODEL =
  Deno.env.get("MISTRAL_TRANSCRIBE_MODEL") ?? "voxtral-mini-latest";

async function handleOcr(req: Request) {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) return err(500, "MISTRAL_API_KEY not configured");

  let body: { data_url?: string; document_url?: string; image_url?: string };
  try {
    body = await req.json();
  } catch {
    return err(400, "Invalid JSON");
  }

  const url = (body.data_url ?? body.document_url ?? body.image_url ?? "").trim();
  if (!url) return err(400, "data_url required (data: URI or https URL)");

  // Heuristic: PDFs and most documents go through `document_url`; raster images use `image_url`.
  // Mistral OCR accepts a data: URI in either field.
  const isImage = /^data:image\//i.test(url) || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(url);
  const documentField = isImage
    ? { type: "image_url", image_url: url }
    : { type: "document_url", document_url: url };

  const res = await fetch(MISTRAL_OCR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      document: documentField,
      include_image_base64: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return err(502, `Mistral OCR ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  const pages: Array<{ index: number; markdown: string }> = (data.pages ?? []).map(
    (p: { index: number; markdown?: string; text?: string }) => ({
      index: p.index,
      markdown: (p.markdown ?? p.text ?? "").toString(),
    }),
  );
  const text = pages
    .map((p) => p.markdown)
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return json({ text, pages, model: data.model ?? OCR_MODEL });
}

async function handleTranscribe(req: Request) {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) return err(500, "MISTRAL_API_KEY not configured");

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return err(400, "Expected multipart/form-data with 'file'");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "Could not parse multipart body");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return err(400, "'file' field required");
  // Voxtral supports audio formats <= 20MB per request — guard so we don't shovel huge blobs upstream.
  if (file.size > 20 * 1024 * 1024) return err(413, "Audio file too large (20MB max)");

  const language = (form.get("language") ?? "").toString().trim();

  const upstream = new FormData();
  upstream.set("model", TRANSCRIBE_MODEL);
  upstream.set("file", file, file.name || "audio.webm");
  if (language) upstream.set("language", language);

  const res = await fetch(MISTRAL_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return err(502, `Mistral transcribe ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  return json({
    text: (data.text ?? "").toString(),
    language: data.language ?? null,
    duration: data.duration ?? null,
    model: data.model ?? TRANSCRIBE_MODEL,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err(405, "Method not allowed");
  }
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  try {
    if (action === "ocr") return await handleOcr(req);
    if (action === "transcribe") return await handleTranscribe(req);
    return err(400, "action must be 'ocr' or 'transcribe'");
  } catch (e) {
    return err(500, e instanceof Error ? e.message : "internal error");
  }
});
