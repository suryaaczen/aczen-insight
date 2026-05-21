-- Chat persistence for Aczen.
-- Phase 1: anonymous chats keyed by browser session id. RLS allows insert/select
-- by anyone (suitable for an unauthenticated MVP). Tighten when auth lands.

create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  session_id    text,
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists conversations_user_idx    on public.conversations(user_id);
create index if not exists conversations_session_idx on public.conversations(session_id);

create table if not exists public.messages (
  id              bigserial primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  sources         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv_idx on public.messages(conversation_id, id);

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- Permissive policies for Phase 1 (anonymous). Replace with auth.uid()-based
-- policies once user accounts are introduced.
drop policy if exists "anon read conversations"   on public.conversations;
drop policy if exists "anon write conversations"  on public.conversations;
drop policy if exists "anon update conversations" on public.conversations;
drop policy if exists "anon read messages"        on public.messages;
drop policy if exists "anon write messages"       on public.messages;

create policy "anon read conversations"   on public.conversations for select using (true);
create policy "anon write conversations"  on public.conversations for insert with check (true);
create policy "anon update conversations" on public.conversations for update using (true);
create policy "anon read messages"        on public.messages      for select using (true);
create policy "anon write messages"       on public.messages      for insert with check (true);
