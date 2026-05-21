import { supabase } from "./supabase";
import { getSessionId } from "./session";
import type { ChatSource } from "./chat";

export interface Conversation {
  id: string;
  user_id: string | null;
  session_id: string | null;
  title: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage {
  id: number;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: ChatSource[] | null;
  created_at: string;
}

function genShareToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return (
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

function trimTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 57).trimEnd() + "…";
}

export async function listConversations(limit = 50): Promise<Conversation[]> {
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id ?? null;
  const sessionId = getSessionId();

  let query = supabase
    .from("conversations")
    .select("id,user_id,session_id,title,share_token,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  query = userId
    ? query.eq("user_id", userId)
    : query.is("user_id", null).eq("session_id", sessionId);

  const { data, error } = await query;
  if (error) {
    console.warn("listConversations failed", error);
    return [];
  }
  return (data as Conversation[]) ?? [];
}

export async function createConversation(
  firstUserMessage?: string,
): Promise<Conversation | null> {
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id ?? null;
  const sessionId = getSessionId();

  const insert = {
    user_id: userId,
    session_id: userId ? null : sessionId,
    title: firstUserMessage ? trimTitle(firstUserMessage) : null,
  };

  const { data, error } = await supabase
    .from("conversations")
    .insert(insert)
    .select("id,user_id,session_id,title,share_token,created_at,updated_at")
    .single();

  if (error) {
    console.warn("createConversation failed", error);
    return null;
  }
  return data as Conversation;
}

export async function getConversation(
  id: string,
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id,user_id,session_id,title,share_token,created_at,updated_at")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Conversation;
}

export async function getConversationByShareToken(
  token: string,
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id,user_id,session_id,title,share_token,created_at,updated_at")
    .eq("share_token", token)
    .maybeSingle();
  if (error) return null;
  return (data as Conversation) ?? null;
}

export async function listMessages(
  conversationId: string,
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id,conversation_id,role,content,sources,created_at")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: true });
  if (error) {
    console.warn("listMessages failed", error);
    return [];
  }
  return (data as StoredMessage[]) ?? [];
}

export async function appendMessage(
  conversationId: string,
  role: StoredMessage["role"],
  content: string,
  sources?: ChatSource[],
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role,
    content,
    sources: sources ?? null,
  });
  if (error) console.warn("appendMessage failed", error);

  // Bump updated_at so the conversation rises in the recents list.
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ title: trimTitle(title), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.warn("renameConversation failed", error);
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) console.warn("deleteConversation failed", error);
}

export async function ensureShareToken(
  conversationId: string,
): Promise<string | null> {
  const existing = await getConversation(conversationId);
  if (!existing) return null;
  if (existing.share_token) return existing.share_token;

  const token = genShareToken();
  const { error } = await supabase
    .from("conversations")
    .update({ share_token: token })
    .eq("id", conversationId);
  if (error) {
    console.warn("ensureShareToken failed", error);
    return null;
  }
  return token;
}

export async function revokeShareToken(
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ share_token: null })
    .eq("id", conversationId);
  if (error) console.warn("revokeShareToken failed", error);
}

export function shareUrl(token: string): string {
  if (typeof window === "undefined") return `/share/${token}`;
  return `${window.location.origin}/share/${token}`;
}

export function autoTitle(text: string): string {
  return trimTitle(text);
}
