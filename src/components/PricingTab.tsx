import { Check, Sparkles } from "lucide-react";

interface Tier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "₹0",
    period: "/mo",
    description: "For exploring & prototyping.",
    features: [
      "500 API calls / month",
      "All 4 letter templates",
      "Search across Legal, Finance, Banking",
      "Community support",
    ],
    cta: "Start free",
  },
  {
    name: "Growth",
    price: "₹4,999",
    period: "/mo",
    description: "For startups shipping in production.",
    features: [
      "10,000 API calls / month",
      "All letter templates + custom",
      "Priority search latency",
      "Email support, 24h SLA",
      "Webhook integrations",
    ],
    cta: "Upgrade to Growth",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For regulated institutions at scale.",
    features: [
      "Unlimited calls & custom rate limits",
      "Dedicated infra + SSO",
      "Custom domain training",
      "Compliance & audit logs",
      "Dedicated success manager",
    ],
    cta: "Talk to sales",
  },
];

export default function PricingTab() {
  return (
    <div className="space-y-10">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl text-foreground">Pricing that scales with you</h2>
        <p className="text-muted-foreground mt-3">Start free. Upgrade when your compliance workflow grows.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`relative rounded-2xl p-7 flex flex-col border transition ${
              t.highlight
                ? "bg-card border-primary/50 shadow-[0_0_0_1px_rgba(0,212,170,0.2),0_20px_60px_-20px_rgba(0,212,170,0.35)]"
                : "bg-card border-border"
            }`}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-3" /> Most popular
              </span>
            )}
            <h3 className="font-display text-xl text-foreground">{t.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{t.description}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-4xl text-foreground">{t.price}</span>
              {t.period && <span className="text-muted-foreground text-sm">{t.period}</span>}
            </div>
            <ul className="mt-6 space-y-3 flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                  <Check className="size-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={`mt-7 w-full rounded-xl px-5 py-3 text-sm font-semibold transition ${
                t.highlight
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-background border border-border text-foreground hover:border-primary/40 hover:text-primary"
              }`}
            >
              {t.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}