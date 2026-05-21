import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, LogIn } from "lucide-react";
import { useAuth, signInWithGoogle, signOut, displayName, avatarUrl, initials } from "@/lib/auth";

export default function AccountMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (loading) {
    return (
      <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground">
        <div className="size-6 rounded-full bg-muted animate-pulse" />
        <span className="flex-1 text-left">…</span>
      </button>
    );
  }

  if (!user) {
    return (
      <button
        onClick={() => signInWithGoogle().catch((e) => alert(e.message))}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition"
      >
        <GoogleIcon className="size-4" />
        <span className="flex-1 text-left">Sign in with Google</span>
        <LogIn className="size-3.5" />
      </button>
    );
  }

  const name = displayName(user);
  const avatar = avatarUrl(user);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-6 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-semibold">
            {initials(user)}
          </div>
        )}
        <span className="flex-1 text-left truncate">{name}</span>
        <Settings className="size-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-card shadow-lg py-1 z-30">
          <div className="px-3 py-2 border-b border-border/60">
            <div className="text-xs font-medium text-foreground truncate">{name}</div>
            {user.email && (
              <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
            )}
          </div>
          <button
            onClick={async () => {
              await signOut();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
