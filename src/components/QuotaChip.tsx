import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { fetchQuota, type Quota } from "@/lib/quota";

interface Props {
  tick: number;
  onUpgrade?: () => void;
}

export default function QuotaChip({ tick, onUpgrade }: Props) {
  const [q, setQ] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQuota().then((data) => {
      if (!cancelled) {
        setQ(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (loading && !q) {
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground">
        <Zap className="size-3.5" />
        …
      </div>
    );
  }

  if (!q) return null;

  const ratio = q.limit > 0 ? q.remaining / q.limit : 1;
  const low = ratio <= 0.25;
  const exhausted = q.remaining === 0;

  const tone = exhausted
    ? "bg-destructive/10 border-destructive/40 text-destructive"
    : low
      ? "bg-amber-500/10 border-amber-500/40 text-amber-600"
      : "bg-primary/10 border-primary/30 text-primary";

  return (
    <button
      type="button"
      onClick={exhausted ? onUpgrade : undefined}
      title={
        exhausted
          ? `Resets at ${new Date(q.resetsAt).toLocaleString()}. Click to upgrade.`
          : `${q.used}/${q.limit} used today · resets at ${new Date(q.resetsAt).toLocaleString()}`
      }
      className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${tone} ${
        exhausted ? "cursor-pointer hover:opacity-90" : "cursor-default"
      }`}
    >
      <Zap className="size-3.5" />
      {exhausted ? "0 left today" : `${q.remaining} / ${q.limit} left today`}
    </button>
  );
}
