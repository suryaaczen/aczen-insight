import { SUPABASE_URL } from "./supabase";
import { getSessionId } from "./session";

export interface Quota {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export const QUOTA_FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/quota` : "";

export async function fetchQuota(): Promise<Quota | null> {
  if (!QUOTA_FN_URL) return null;
  const sessionId = getSessionId();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
  try {
    const res = await fetch(QUOTA_FN_URL, {
      headers: {
        Authorization: `Bearer ${anon}`,
        apikey: anon,
        "x-session-id": sessionId,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as Quota;
  } catch {
    return null;
  }
}
