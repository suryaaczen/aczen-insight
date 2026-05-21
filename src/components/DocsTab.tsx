import { useState } from "react";
import { Copy, Check, AlertTriangle, Terminal, Zap, Code2 } from "lucide-react";

const API_BASE = "https://api.aczen.ai/v1";

interface Endpoint {
  method: string;
  path: string;
  title: string;
  description: string;
  example: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/chat/completions",
    title: "Chat (streaming)",
    description:
      "Streaming chat completions. Server-Sent Events response. Set web=true to ground answers in fresh web sources.",
    example: `curl -N -X POST ${API_BASE}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $ACZEN_API_KEY" \\
  -d '{
    "model": "aczenai-32k",
    "messages": [
      { "role": "user", "content": "Explain GST input tax credit briefly." }
    ],
    "web": false,
    "stream": true
  }'`,
  },
  {
    method: "POST",
    path: "/artifacts",
    title: "Generate artifact",
    description:
      "Produce a visual SVG diagram from a prompt and recent conversation. Returns { title, svg }.",
    example: `curl -X POST ${API_BASE}/artifacts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $ACZEN_API_KEY" \\
  -d '{
    "model": "aczenai-32k",
    "prompt": "How OAuth 2.0 PKCE flow works",
    "messages": [
      { "role": "user", "content": "Explain OAuth PKCE." }
    ]
  }'`,
  },
];

const QUICKSTART = `import { Aczen } from "@aczenai/32k";

const client = new Aczen({ apiKey: process.env.ACZEN_API_KEY });

const stream = await client.chat.stream({
  model: "aczenai-32k",
  messages: [
    { role: "user", content: "What's the difference between TDS and TCS?" },
  ],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta ?? "");
}`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative">
      <pre className="bg-background border border-border rounded-xl p-4 pr-14 text-xs text-foreground/90 overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:text-primary transition"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  POST: "bg-primary/15 text-primary border-primary/30",
};

export default function DocsTab() {
  return (
    <div className="space-y-6">
      {/* Install */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
          <Terminal className="size-3.5" />
          Install
        </div>
        <h3 className="font-display text-lg mt-1">Get the SDK</h3>
        <p className="text-sm text-muted-foreground mt-1">
          The Aczen client works in Node 18+, Deno, Bun, and modern browsers.
        </p>
        <div className="mt-4">
          <CodeBlock code={`npm install @aczenai/32k`} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Also available via <code className="font-mono text-foreground">pnpm add @aczenai/32k</code>{" "}
          and <code className="font-mono text-foreground">yarn add @aczenai/32k</code>.
        </p>
      </div>

      {/* Models */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
          <Zap className="size-3.5" />
          Models
        </div>
        <h3 className="font-display text-lg mt-1">aczenai-32k</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Aczen's flagship 32K-context model. Tuned for code, writing, math, and Indian
          legal / finance / banking topics. Supports streaming, web grounding, and SVG
          artifact generation.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs">
          <Stat label="Context" value="32,768 tokens" />
          <Stat label="Output" value="up to 8,192 tokens" />
          <Stat label="Latency" value="~280ms TTFT" />
        </div>
      </div>

      {/* Quickstart */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <Code2 className="size-3.5" />
            Quickstart
          </div>
          <h3 className="font-display text-lg mt-1">Stream a completion</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Read your API key from <code className="font-mono text-foreground">ACZEN_API_KEY</code>{" "}
            and stream tokens straight to stdout.
          </p>
        </div>
        <CodeBlock code={QUICKSTART} />
      </div>

      {/* Base URL + auth */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-display text-lg">Base URL</h3>
        <p className="text-sm text-muted-foreground mt-1">
          REST endpoints live at:
        </p>
        <code className="mt-3 inline-block bg-background border border-border rounded-lg px-3 py-2 text-primary text-sm font-mono">
          {API_BASE}
        </code>
        <div className="mt-4 flex gap-2 items-start text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
          <p>
            Pass your key via the <code className="font-mono">Authorization: Bearer</code> header.
            Per-developer API keys with usage tracking are coming up next.
          </p>
        </div>
      </div>

      {/* Endpoints */}
      {ENDPOINTS.map((ep) => (
        <div key={ep.path} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${METHOD_COLORS[ep.method]}`}
            >
              {ep.method}
            </span>
            <code className="text-sm font-mono text-foreground break-all">
              {API_BASE}
              {ep.path}
            </code>
          </div>
          <div>
            <h4 className="font-display text-base">{ep.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{ep.description}</p>
          </div>
          <CodeBlock code={ep.example} />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}
