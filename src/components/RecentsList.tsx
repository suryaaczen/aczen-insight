import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Share2, Trash2, Check, Copy } from "lucide-react";
import {
  deleteConversation,
  ensureShareToken,
  listConversations,
  renameConversation,
  shareUrl,
  type Conversation,
} from "@/lib/conversations";
import { useAuth } from "@/lib/auth";

interface Props {
  activeId: string | null;
  refreshKey: number;
  onSelect: (id: string) => void;
  onChanged: () => void;
}

export default function RecentsList({ activeId, refreshKey, onSelect, onChanged }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listConversations(40).then((rows) => {
      if (cancelled) return;
      setItems(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, user?.id]);

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No chats yet. Start one and it'll show up here.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {items.map((c) => (
        <Row
          key={c.id}
          conv={c}
          active={c.id === activeId}
          onSelect={() => onSelect(c.id)}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function Row({
  conv,
  active,
  onSelect,
  onChanged,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title ?? "Untitled chat");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrlStr, setShareUrlStr] = useState<string | null>(
    conv.share_token ? shareUrl(conv.share_token) : null,
  );
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(conv.title ?? "Untitled chat");
    setShareUrlStr(conv.share_token ? shareUrl(conv.share_token) : null);
  }, [conv]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setShareOpen(false);
      }
    };
    if (menuOpen || shareOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen, shareOpen]);

  const submitRename = async () => {
    if (title.trim() && title.trim() !== conv.title) {
      await renameConversation(conv.id, title.trim());
      onChanged();
    }
    setEditing(false);
  };

  const onShare = async () => {
    setMenuOpen(false);
    const token = await ensureShareToken(conv.id);
    if (token) {
      setShareUrlStr(shareUrl(token));
      setShareOpen(true);
      onChanged();
    }
  };

  const onDelete = async () => {
    setMenuOpen(false);
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    await deleteConversation(conv.id);
    onChanged();
  };

  const copy = async () => {
    if (!shareUrlStr) return;
    await navigator.clipboard.writeText(shareUrlStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group" ref={ref}>
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full bg-background border border-primary/50 rounded-lg text-sm px-3 py-1.5 outline-none"
        />
      ) : (
        <button
          onClick={onSelect}
          className={`w-full text-left pl-3 pr-8 py-1.5 rounded-lg text-sm truncate transition ${
            active
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          }`}
          title={conv.title ?? "Untitled chat"}
        >
          {conv.title ?? "Untitled chat"}
        </button>
      )}

      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent transition"
          aria-label="Chat options"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      )}

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-card shadow-lg py-1 z-30">
          <MenuItem icon={Pencil} label="Rename" onClick={() => { setMenuOpen(false); setEditing(true); }} />
          <MenuItem icon={Share2} label="Share" onClick={onShare} />
          <MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
        </div>
      )}

      {shareOpen && shareUrlStr && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-card shadow-lg p-3 z-30">
          <p className="text-[11px] text-muted-foreground mb-2">
            Anyone with this link can read this chat.
          </p>
          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={shareUrlStr}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-[11px] font-mono outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent ${
        danger ? "text-destructive hover:text-destructive" : "text-foreground"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
