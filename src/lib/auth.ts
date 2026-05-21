import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getSessionId } from "./session";

const CLAIMED_KEY = "aczen.session_claimed";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.localStorage.removeItem(CLAIMED_KEY);
}

// Re-key any anonymous conversations from the local session_id to the
// newly authenticated user_id. Runs once per browser/session pair.
export async function claimAnonymousChats(user: User): Promise<number> {
  const sessionId = getSessionId();
  const flagKey = `${CLAIMED_KEY}:${user.id}:${sessionId}`;
  if (window.localStorage.getItem(flagKey) === "1") return 0;

  const { data, error } = await supabase.rpc("claim_session_conversations", {
    p_session_id: sessionId,
  });
  if (error) {
    console.warn("claim_session_conversations failed", error);
    return 0;
  }
  window.localStorage.setItem(flagKey, "1");
  return (data as number) ?? 0;
}

export function displayName(user: User | null | undefined): string {
  if (!user) return "";
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return (
    (meta.full_name as string) ||
    (meta.name as string) ||
    user.email ||
    "Account"
  );
}

export function avatarUrl(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return (meta.avatar_url as string) || (meta.picture as string) || null;
}

export function initials(user: User | null | undefined): string {
  if (!user) return "A";
  const name = displayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 1).toUpperCase() || "A";
}
