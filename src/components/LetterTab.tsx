import { useMemo, useState } from "react";
import { Copy, Download, Loader2, FileText, Check } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface Field {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number";
  placeholder?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  fields: Field[];
}

const TEMPLATES: Template[] = [
  {
    id: "rbi_grievance",
    name: "RBI Grievance",
    description: "File a complaint with the Reserve Bank of India ombudsman.",
    fields: [
      { name: "complainant_name", label: "Your Name", placeholder: "Full name" },
      { name: "bank_name", label: "Bank Name", placeholder: "e.g. HDFC Bank" },
      { name: "account_number", label: "Account Number" },
      { name: "complaint_date", label: "Date of Incident", type: "date" },
      { name: "issue", label: "Describe the Issue", type: "textarea", placeholder: "What happened..." },
    ],
  },
  {
    id: "gst_clarification",
    name: "GST Clarification",
    description: "Seek clarification from GST authorities.",
    fields: [
      { name: "business_name", label: "Business Name" },
      { name: "gstin", label: "GSTIN" },
      { name: "query", label: "Clarification Sought", type: "textarea" },
    ],
  },
  {
    id: "cheque_bounce",
    name: "Cheque Bounce Notice",
    description: "Section 138 NI Act legal notice.",
    fields: [
      { name: "sender_name", label: "Your Name" },
      { name: "drawer_name", label: "Drawer (Cheque Issuer)" },
      { name: "cheque_number", label: "Cheque Number" },
      { name: "cheque_amount", label: "Amount (INR)", type: "number" },
      { name: "cheque_date", label: "Cheque Date", type: "date" },
      { name: "bank_name", label: "Drawee Bank" },
    ],
  },
  {
    id: "loan_application",
    name: "Loan Application",
    description: "Formal request for a loan facility.",
    fields: [
      { name: "applicant_name", label: "Applicant Name" },
      { name: "loan_amount", label: "Loan Amount (INR)", type: "number" },
      { name: "purpose", label: "Purpose", type: "textarea" },
      { name: "tenure_months", label: "Tenure (months)", type: "number" },
    ],
  },
  {
    id: "sebi_complaint",
    name: "SEBI Complaint",
    description: "Lodge a complaint via SCORES portal.",
    fields: [
      { name: "investor_name", label: "Investor Name" },
      { name: "entity_name", label: "Entity Complained Against" },
      { name: "transaction_date", label: "Transaction Date", type: "date" },
      { name: "complaint_details", label: "Complaint Details", type: "textarea" },
    ],
  },
];

export default function LetterTab() {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId)!,
    [templateId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLetter(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/letter/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: templateId, fields: values }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setLetter(data.letter || data.content || JSON.stringify(data, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template</label>
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setValues({});
              setLetter(null);
            }}
            className="mt-2 w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground outline-none focus:border-primary/60"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-2">{template.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {template.fields.map((f) => (
            <div key={f.name}>
              <label className="text-sm text-foreground/90">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  rows={4}
                  required
                  value={values[f.name] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1.5 w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 resize-y"
                />
              ) : (
                <input
                  type={f.type || "text"}
                  required
                  value={values[f.name] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1.5 w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                />
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-xl px-5 py-3 font-semibold hover:opacity-90 disabled:opacity-40 transition inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Generate Letter
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">Preview</h3>
          {letter && (
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition"
              >
                <Download className="size-3.5" /> .txt
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 bg-background border border-border rounded-xl p-5 min-h-[400px] overflow-auto">
          {letter ? (
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{letter}</pre>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">
              {loading ? "Drafting your letter…" : "Your generated letter will appear here."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}