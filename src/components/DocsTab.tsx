import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface Endpoint {
  method: string;
  path: string;
  title: string;
  description: string;
  curl: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/search",
    title: "Intelligence Search",
    description: "Query Legal, Finance, or Banking knowledge with AI-grounded answers.",
    curl: `curl -X POST ${API_BASE_URL}/api/search \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "GST on export of services in India",
    "domain": "finance"
  }'`,
  },
  {
    method: "POST",
    path: "/api/letter/generate",
    title: "Letter Generator",
    description: "Generate a formatted letter from a template + field values.",
    curl: `curl -X POST ${API_BASE_URL}/api/letter/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "rbi_grievance",
    "fields": {
      "complainant_name": "Asha Mehta",
      "bank_name": "HDFC Bank",
      "account_number": "XXXX1234",
      "complaint_date": "2026-03-12",
      "issue": "Unauthorized debit of INR 25,000"
    }
  }'`,
  },
  {
    method: "GET",
    path: "/api/templates",
    title: "List Templates",
    description: "Fetch available letter templates and required fields.",
    curl: `curl ${API_BASE_URL}/api/templates`,
  },
];

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
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-display text-lg">Base URL</h3>
        <p className="text-sm text-muted-foreground mt-1">All endpoints are prefixed with:</p>
        <code className="mt-3 inline-block bg-background border border-border rounded-lg px-3 py-2 text-primary text-sm font-mono">
          {API_BASE_URL}
        </code>
      </div>

      {ENDPOINTS.map((ep) => (
        <div key={ep.path + ep.method} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
            <code className="text-sm font-mono text-foreground">{ep.path}</code>
          </div>
          <div>
            <h4 className="font-display text-base">{ep.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{ep.description}</p>
          </div>
          <CodeBlock code={ep.curl} />
        </div>
      ))}
    </div>
  );
}