import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { claimAnonymousChats } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // detectSessionInUrl is true, so supabase-js will have parsed the hash
      // or executed exchangeCodeForSession already. Just read the session.
      const { data, error: e } = await supabase.auth.getSession();
      if (cancelled) return;
      if (e) {
        setError(e.message);
        return;
      }
      const user = data.session?.user;
      if (user) {
        try {
          await claimAnonymousChats(user);
        } catch (err) {
          console.warn("claim failed", err);
        }
      }
      navigate({ to: "/" });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="max-w-sm text-center px-6">
        {error ? (
          <>
            <AlertTriangle className="size-8 mx-auto text-destructive" />
            <h1 className="mt-3 font-display text-xl">Sign-in failed</h1>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-4 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90"
            >
              Go home
            </button>
          </>
        ) : (
          <>
            <Loader2 className="size-8 mx-auto animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Finishing sign-in…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
